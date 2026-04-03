// src/app/api/bounties/[id]/validate/route.ts
// 4-Layer ML Validation Pipeline Orchestrator
//
// Calls:
//   1. GitHub API (Octokit) → fetch issue body, PR body, PR diff
//   2. Python ML Service (localhost:8001) → Layers 1-3 (SBERT, CodeBERT, Bandit)
//   3. Gemini API → Layer 4 (quality score + summary)
//   4. Aggregates all scores → saves to submissions table
//
// Triggered by: POST /api/bounties/submit (after PR URL is recorded)

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import {
  parseGitHubUrl,
  createOctokit,
  fetchIssueData,
  fetchPRData,
} from "@/lib/github-fetcher";
import { runMLAnalysis } from "@/lib/ml-client";
import { runGeminiAnalysis } from "@/lib/gemini";

// Use the same DB pool pattern as your existing API routes
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bountyId } = await params;

  try {
    // ── 1. Get bounty data from DB ──────────────────────────────
    const bountyResult = await pool.query(
      `SELECT id, "issueUrl", "prUrl", "issueNumber", "repoOwner", "repoName"
       FROM bounties
       WHERE id = $1
       LIMIT 1`,
      [bountyId]
    );

    if (bountyResult.rows.length === 0) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }

    const bounty = bountyResult.rows[0];

    if (!bounty.prUrl) {
      return NextResponse.json(
        { error: "No PR URL submitted for this bounty" },
        { status: 400 }
      );
    }

    // ── 2. Parse URLs & Fetch GitHub Data ────────────────────────
    const octokit = createOctokit();

    const issueParsed = parseGitHubUrl(bounty.issueUrl);
    const prParsed = parseGitHubUrl(bounty.prUrl);

    const [issueData, prData] = await Promise.all([
      fetchIssueData(octokit, issueParsed.owner, issueParsed.repo, issueParsed.number),
      fetchPRData(octokit, prParsed.owner, prParsed.repo, prParsed.number),
    ]);

    // ── 3. Run ML Layers 1-3 + Gemini Layer 4 IN PARALLEL ───────
    const [mlResult, geminiResult] = await Promise.all([
      // Layers 1-3: Python ML service (localhost:8001)
      runMLAnalysis({
        issue_text: issueData.body,
        pr_text: prData.body || prData.title,
        code_diff: prData.diff,
      }),
      // Layer 4: Gemini API
      runGeminiAnalysis(
        issueData.title,
        issueData.body,
        prData.title,
        prData.body,
        prData.diff,
        prData.files.map((f) => f.filename)
      ),
    ]);

    // ── 4. Aggregate All 4 Layers ────────────────────────────────
    const overallScore = Math.round(
      0.25 * mlResult.relevance +
      0.25 * mlResult.alignment +
      0.25 * mlResult.security_score +
      0.25 * geminiResult.quality_score
    );

    const verdict =
      overallScore >= 70 ? "PASS" : overallScore >= 40 ? "WARN" : "FAIL";

    // Veto rule: if SBERT relevance < 40%, auto-reject regardless of other scores
    const isVetoed = mlResult.relevance < 40;
    const finalVerdict = isVetoed ? "FAIL" : verdict;

    // Full report JSON (stored in submissions.ai_report_json)
    const fullReport = {
      layers: {
        relevance: {
          score: mlResult.relevance,
          model: "SBERT (Fine-tuned all-MiniLM-L6-v2)",
          layer: 1,
          label: "Contextual Relevance",
          description: "Semantic similarity between issue description and PR description",
        },
        alignment: {
          score: mlResult.alignment,
          model: "CodeBERT (microsoft/codebert-base)",
          layer: 2,
          label: "Code-Issue Alignment",
          description: "Semantic alignment between issue text and actual code changes",
        },
        security: {
          score: mlResult.security_score,
          model: "Bandit (Static Analysis)",
          layer: 3,
          label: "Security Audit",
          description: "Static security analysis of newly added code lines",
          findings: mlResult.security_findings,
          metadata: mlResult.security_metadata,
        },
        quality: {
          score: geminiResult.quality_score,
          model: "Gemini 2.0 Flash",
          layer: 4,
          label: "Code Quality & Summary",
          description: "LLM-powered code quality assessment and summary",
          reasoning: geminiResult.reasoning,
          summary: geminiResult.summary,
        },
      },
      overall_score: overallScore,
      verdict: finalVerdict,
      veto_applied: isVetoed,
      veto_reason: isVetoed
        ? "SBERT relevance below 40% — PR does not address the issue"
        : null,
      github: {
        issue: { title: issueData.title, url: bounty.issueUrl },
        pr: {
          title: prData.title,
          url: bounty.prUrl,
          merged: prData.merged,
          state: prData.state,
          files_changed: prData.files.length,
          total_additions: prData.files.reduce((s, f) => s + f.additions, 0),
          total_deletions: prData.files.reduce((s, f) => s + f.deletions, 0),
        },
      },
      validated_at: new Date().toISOString(),
    };

    // ── 5. Save to bounties table (mlScores column) ──────────────
    // Store the full report as JSON on the bounty record
    await pool.query(
      `UPDATE bounties
       SET "mlScores" = $1,
           "updatedAt" = NOW()
       WHERE id = $2`,
      [
        JSON.stringify(fullReport),
        bountyId,
      ]
    );

    // Also try saving to submissions table if it exists
    try {
      await pool.query(
        `UPDATE submissions
         SET ai_quality_score = $1,
             ai_plagiarism_flag = $2,
             ai_report_json = $3,
             updated_at = NOW()
         WHERE bounty_id = $4`,
        [
          overallScore,
          isVetoed,
          JSON.stringify(fullReport),
          bountyId,
        ]
      );
    } catch {
      // submissions table may not have rows yet — non-fatal
      console.warn("[validate] Could not update submissions table (non-fatal)");
    }

    // Also log to activity_log (existing table)
    try {
      await pool.query(
        `INSERT INTO activity_log (bounty_id, actor_id, action, metadata)
         VALUES ($1, 'system', $2, $3)`,
        [
          bountyId,
          "ML_VALIDATION_COMPLETE",
          JSON.stringify({
            overall_score: overallScore,
            verdict: finalVerdict,
            layers: {
              sbert: mlResult.relevance,
              codebert: mlResult.alignment,
              bandit: mlResult.security_score,
              gemini: geminiResult.quality_score,
            },
          }),
        ]
      );
    } catch {
      // activity_log may not exist — non-fatal
      console.warn("[validate] Could not insert activity_log (non-fatal)");
    }

    return NextResponse.json(fullReport);
  } catch (error: unknown) {
    console.error("Validation pipeline error:", error);
    const message = error instanceof Error ? error.message : "Validation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
