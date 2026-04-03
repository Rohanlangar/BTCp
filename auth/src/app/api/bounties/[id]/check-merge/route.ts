// src/app/api/bounties/[id]/check-merge/route.ts
// GET /api/bounties/[id]/check-merge
//
// Checks whether the accepted PR has been merged on GitHub.
// If merged, transitions bounty to AWAITING_SETTLEMENT.
// Used by the admin dashboard to enable settlement (contract integration later).

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { parseGitHubUrl, createOctokit, checkPRMergeStatus } from "@/lib/github-fetcher";

export async function GET(
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
    // 1. Get the bounty + winning submission
    const bountyResult = await pool.query(
      `SELECT b.id, b.status, b."creatorId", b."winnerSubmissionId",
              s.pr_url, s.contributor_id
       FROM bounties b
       LEFT JOIN submissions s ON s.id = b."winnerSubmissionId"
       WHERE b.id = $1 LIMIT 1`,
      [bountyId]
    );

    if (bountyResult.rows.length === 0) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }

    const bounty = bountyResult.rows[0];

    if (bounty.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Only the bounty creator can check merge status" }, { status: 403 });
    }

    if (!bounty.winnerSubmissionId || !bounty.pr_url) {
      return NextResponse.json(
        { error: "No accepted submission found. Accept a winner first." },
        { status: 400 }
      );
    }

    // Only check when bounty is in ACCEPTED state
    if (bounty.status !== "ACCEPTED") {
      // If already AWAITING_SETTLEMENT or SETTLED, return merged=true
      if (["AWAITING_SETTLEMENT", "SETTLED", "COMPLETED"].includes(bounty.status)) {
        return NextResponse.json({
          merged: true,
          state: "closed",
          merged_at: null,
          bounty_status: bounty.status,
          message: "PR already verified as merged.",
        });
      }
      return NextResponse.json(
        { error: `Cannot check merge status when bounty is in '${bounty.status}' state.` },
        { status: 400 }
      );
    }

    // 2. Parse the PR URL and check merge status on GitHub
    const prParsed = parseGitHubUrl(bounty.pr_url);
    const octokit = createOctokit();
    const mergeStatus = await checkPRMergeStatus(
      octokit,
      prParsed.owner,
      prParsed.repo,
      prParsed.number
    );

    // 3. If merged, transition bounty to AWAITING_SETTLEMENT
    if (mergeStatus.merged) {
      await pool.query(
        `UPDATE bounties 
         SET status = 'AWAITING_SETTLEMENT',
             "mergeVerifiedAt" = NOW(),
             "updatedAt" = NOW()
         WHERE id = $1`,
        [bountyId]
      );

      // Update submission status to 'merged'
      await pool.query(
        `UPDATE submissions
         SET status = 'merged', updated_at = NOW()
         WHERE id = $1`,
        [bounty.winnerSubmissionId]
      );

      // Log activity
      try {
        await pool.query(
          `INSERT INTO activity_log (bounty_id, actor_id, action, metadata)
           VALUES ($1, $2, 'PR_MERGE_VERIFIED', $3)`,
          [
            bountyId,
            session.user.id,
            JSON.stringify({
              pr_url: bounty.pr_url,
              merged_at: mergeStatus.merged_at,
              merge_commit_sha: mergeStatus.merge_commit_sha,
            }),
          ]
        );
      } catch { /* activity_log may not exist */ }

      // Notify winner
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, bounty_id, title, message, type)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            bounty.contributor_id,
            bountyId,
            "✅ Your PR Has Been Merged!",
            "Your pull request has been merged on GitHub. The bounty payment will be processed shortly.",
            "success",
          ]
        );
      } catch { /* notifications table may not exist */ }
    }

    return NextResponse.json({
      merged: mergeStatus.merged,
      state: mergeStatus.state,
      merged_at: mergeStatus.merged_at,
      merge_commit_sha: mergeStatus.merge_commit_sha,
      bounty_status: mergeStatus.merged ? "AWAITING_SETTLEMENT" : "ACCEPTED",
    });
  } catch (error: unknown) {
    console.error("Check merge status error:", error);
    const message = error instanceof Error ? error.message : "Failed to check merge status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
