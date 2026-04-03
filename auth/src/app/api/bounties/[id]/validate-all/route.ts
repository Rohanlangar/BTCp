// src/app/api/bounties/[id]/validate-all/route.ts
// Multi-Contributor ML Validation Pipeline
//
// For each submission on a bounty:
//   1. Fetch the issue data (from bounty's issueUrl)
//   2. Fetch each contributor's PR data
//   3. Run 4-layer ML pipeline (SBERT, CodeBERT, Bandit, Gemini)
//   4. Score, rank top 3, and save results
//
// Triggered by: Admin clicking "Launch ML Pipeline" button

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/auth";
import { auth } from "@/lib/auth";
import {
  parseGitHubUrl,
  createOctokit,
  fetchIssueData,
  fetchPRData,
} from "@/lib/github-fetcher";
import { runMLAnalysis } from "@/lib/ml-client";
import { runGeminiAnalysis } from "@/lib/gemini";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bountyId } = await params;

  // Auth check — admin only
  const cookieHeader = req.headers.get("cookie") || "";
  const session = await auth.api.getSession({ headers: { cookie: cookieHeader } });
  if (!session?.user || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    // 1. Get bounty data
    const bountyResult = await pool.query(
      `SELECT id, "issueUrl", "issueNumber", "repoOwner", "repoName"
       FROM bounties WHERE id = $1 LIMIT 1`,
      [bountyId]
    );
    if (bountyResult.rows.length === 0) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }
    const bounty = bountyResult.rows[0];

    // 2. Get all submissions for this bounty
    const subsResult = await pool.query(
      `SELECT s.*, u."name" as contributor_name, u."email" as contributor_email, u."image" as contributor_image
       FROM submissions s
       JOIN "user" u ON s.contributor_id = u.id
       WHERE s.bounty_id = $1 AND s.pr_url IS NOT NULL
       ORDER BY s.submitted_at ASC`,
      [bountyId]
    );
    const submissions = subsResult.rows;

    if (submissions.length === 0) {
      return NextResponse.json({ error: "No submissions to validate" }, { status: 400 });
    }

    // 3. Fetch issue data (shared across all submissions)
    const octokit = createOctokit();
    const issueParsed = parseGitHubUrl(bounty.issueUrl);
    const issueData = await fetchIssueData(
      octokit, issueParsed.owner, issueParsed.repo, issueParsed.number
    );

    // 4. Process each submission through the ML pipeline
    const results: any[] = [];

    for (const sub of submissions) {
      try {
        const prParsed = parseGitHubUrl(sub.pr_url);
        const prData = await fetchPRData(
          octokit, prParsed.owner, prParsed.repo, prParsed.number
        );

        // Run ML Layers 1-3 + Gemini Layer 4
        let mlResult: any = {
          relevance: 0,
          alignment: 0,
          security_score: 100,
          security_findings: [],
          security_metadata: { lines_extracted: 0, scanned_for_vulnerabilities: false },
        };
        let geminiResult: any = {
          quality_score: 50,
          reasoning: "Validation pending.",
          summary: "No summary available.",
        };

        try {
          const [ml, gemini] = await Promise.all([
            runMLAnalysis({
              issue_text: issueData.body,
              pr_text: prData.body || prData.title,
              code_diff: prData.diff,
            }).catch(e => {
              console.warn(`[ML] Layer 1-3 failed for sub ${sub.id}:`, e.message);
              return mlResult;
            }),
            runGeminiAnalysis(
              issueData.title,
              issueData.body,
              prData.title,
              prData.body,
              prData.diff,
              prData.files.map((f: any) => f.filename)
            ).catch(e => {
              console.warn(`[Gemini] Layer 4 failed for sub ${sub.id}:`, e.message);
              return geminiResult;
            }),
          ]);
          mlResult = ml;
          geminiResult = gemini;
        } catch (err: any) {
          console.error(`[Pipeline] Critical error in parallel analysis for ${sub.id}:`, err);
        }

        // Aggregate scores
        const overallScore = Math.round(
          0.25 * (mlResult?.relevance ?? 0) +
          0.25 * (mlResult?.alignment ?? 0) +
          0.25 * (mlResult?.security_score ?? 100) +
          0.25 * (geminiResult?.quality_score ?? 50)
        );

        const verdict =
          overallScore >= 70 ? "PASS" : overallScore >= 40 ? "WARN" : "FAIL";

        const isVetoed = (mlResult?.relevance ?? 0) < 40 && (mlResult?.relevance ?? 0) > 0;
        const finalVerdict = isVetoed ? "FAIL" : verdict;

        const fullReport = {
          layers: {
            relevance: {
              score: mlResult?.relevance ?? 0,
              model: "SBERT (all-MiniLM-L6-v2)",
              layer: 1,
              label: "Contextual Relevance",
              description: "Semantic similarity between issue and PR description",
            },
            alignment: {
              score: mlResult?.alignment ?? 0,
              model: "CodeBERT (microsoft/codebert-base)",
              layer: 2,
              label: "Code-Issue Alignment",
              description: "Semantic alignment between issue text and code changes",
            },
            security: {
              score: mlResult?.security_score ?? 100,
              model: "Bandit (Static Analysis)",
              layer: 3,
              label: "Security Audit",
              description: "Static security analysis of added code",
              findings: mlResult?.security_findings ?? [],
              metadata: mlResult?.security_metadata ?? {},
            },
            quality: {
              score: geminiResult?.quality_score ?? 50,
              model: "Gemini 2.0 Flash",
              layer: 4,
              label: "Code Quality & Summary",
              description: "LLM-powered code quality and completeness assessment",
              reasoning: geminiResult?.reasoning ?? "",
              summary: geminiResult?.summary ?? "",
            },
          },
          overall_score: overallScore,
          verdict: finalVerdict,
          veto_applied: isVetoed,
          veto_reason: isVetoed ? "SBERT relevance below 40%" : null,
          github: {
            issue: { title: issueData.title, url: bounty.issueUrl },
            pr: {
              title: prData.title,
              url: sub.pr_url,
              merged: prData.merged,
              state: prData.state,
              files_changed: prData.files.length,
              total_additions: prData.files.reduce((s: number, f: any) => s + f.additions, 0),
              total_deletions: prData.files.reduce((s: number, f: any) => s + f.deletions, 0),
            },
          },
          validated_at: new Date().toISOString(),
        };

        results.push({
          submission_id: sub.id,
          contributor_id: sub.contributor_id,
          contributor_name: sub.contributor_name,
          contributor_email: sub.contributor_email,
          contributor_image: sub.contributor_image,
          pr_url: sub.pr_url,
          documentation: sub.documentation,
          comments: sub.comments,
          overall_score: overallScore,
          verdict: finalVerdict,
          report: fullReport,
        });
      } catch (subErr: any) {
        console.error(`Failed to validate submission ${sub.id}:`, subErr);
        results.push({
          submission_id: sub.id,
          contributor_id: sub.contributor_id,
          contributor_name: sub.contributor_name,
          contributor_email: sub.contributor_email,
          contributor_image: sub.contributor_image,
          pr_url: sub.pr_url,
          documentation: sub.documentation,
          comments: sub.comments,
          overall_score: 0,
          verdict: "FAIL",
          report: null,
          error: subErr.message,
        });
      }
    }

    // 5. Rank by overall_score descending
    results.sort((a, b) => b.overall_score - a.overall_score);
    results.forEach((r, i) => { r.rank = i + 1; });

    // 6. Save results to DB
    for (const r of results) {
      await pool.query(
        `UPDATE submissions 
         SET ai_quality_score = $1, 
             ai_report_json = $2, 
             rank = $3, 
             status = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [
          r.overall_score,
          r.report ? JSON.stringify(r.report) : null,
          r.rank,
          r.report ? 'validated' : 'pending',
          r.submission_id,
        ]
      );
    }

    // 7. Update bounty status to UNDER_REVIEW
    // Using camelCase "updatedAt" to match the actual DB schema for bounties
    await pool.query(
      `UPDATE bounties 
       SET status = 'SUBMITTED', 
           "updatedAt" = NOW() 
       WHERE id = $1 AND status = 'OPEN'`,
      [bountyId]
    );

    // 8. Log activity
    try {
      await pool.query(
        `INSERT INTO activity_log (bounty_id, actor_id, action, metadata)
         VALUES ($1, $2, 'ML_VALIDATION_ALL', $3)`,
        [
          bountyId,
          session.user.id,
          JSON.stringify({
            total_submissions: results.length,
            top_3: results.slice(0, 3).map(r => ({
              contributor: r.contributor_name,
              score: r.overall_score,
              verdict: r.verdict,
            })),
          }),
        ]
      );
    } catch { /* activity_log may not exist */ }

    return NextResponse.json({
      success: true,
      total: results.length,
      rankings: results,
    });
  } catch (error: unknown) {
    console.error("Validate-all pipeline error:", error);
    const message = error instanceof Error ? error.message : "Validation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
