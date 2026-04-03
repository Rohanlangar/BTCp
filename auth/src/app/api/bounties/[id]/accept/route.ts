// src/app/api/bounties/[id]/accept/route.ts
// POST /api/bounties/[id]/accept
//
// Admin selects a winning submission from the ML-ranked top 3.
// - Marks that submission as 'accepted' and the contributor as the winner
// - Marks all other submissions as 'rejected' and claims as 'lost'
// - Transitions bounty to 'ACCEPTED' state
// - Does NOT send money — that happens after the PR is merged on GitHub

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/auth";
import { auth } from "@/lib/auth";

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
    const { submissionId } = await req.json();

    if (!submissionId) {
      return NextResponse.json({ error: "Missing submissionId" }, { status: 400 });
    }

    // 1. Verify bounty exists, belongs to this admin, and is in a valid state
    const bountyResult = await pool.query(
      `SELECT id, status, "creatorId" FROM bounties WHERE id = $1 LIMIT 1`,
      [bountyId]
    );
    if (bountyResult.rows.length === 0) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }
    const bounty = bountyResult.rows[0];

    if (bounty.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Only the bounty creator can accept submissions" }, { status: 403 });
    }

    // Allow acceptance from SUBMITTED or UNDER_REVIEW states (after ML pipeline has run)
    if (!["SUBMITTED", "UNDER_REVIEW"].includes(bounty.status)) {
      return NextResponse.json(
        { error: `Cannot accept submissions when bounty is in '${bounty.status}' state. Must be SUBMITTED or UNDER_REVIEW.` },
        { status: 400 }
      );
    }

    // 2. Verify the submission exists and belongs to this bounty
    const subResult = await pool.query(
      `SELECT s.*, u."name" as contributor_name, u."walletAddress" as contributor_wallet, u."email" as contributor_email
       FROM submissions s
       JOIN "user" u ON s.contributor_id = u.id
       WHERE s.id = $1 AND s.bounty_id = $2`,
      [submissionId, bountyId]
    );
    if (subResult.rows.length === 0) {
      return NextResponse.json({ error: "Submission not found for this bounty" }, { status: 404 });
    }
    const winnerSub = subResult.rows[0];

    // 3. Mark the winning submission as 'accepted'
    await pool.query(
      `UPDATE submissions 
       SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [submissionId]
    );

    // 4. Mark all other submissions as 'rejected'
    await pool.query(
      `UPDATE submissions 
       SET status = 'rejected', updated_at = NOW()
       WHERE bounty_id = $1 AND id != $2 AND status != 'rejected'`,
      [bountyId, submissionId]
    );

    // 5. Update claims: winner = 'won', others = 'lost'
    await pool.query(
      `UPDATE claims SET status = 'won', updated_at = NOW()
       WHERE bounty_id = $1 AND contributor_id = $2`,
      [bountyId, winnerSub.contributor_id]
    );
    await pool.query(
      `UPDATE claims SET status = 'lost', updated_at = NOW()
       WHERE bounty_id = $1 AND contributor_id != $2 AND status NOT IN ('lost', 'abandoned')`,
      [bountyId, winnerSub.contributor_id]
    );

    // 6. Update bounty to ACCEPTED state with winner info
    await pool.query(
      `UPDATE bounties 
       SET status = 'ACCEPTED',
           "winnerId" = $1,
           "winnerWallet" = $2,
           "winnerSubmissionId" = $3,
           "acceptedAt" = NOW(),
           "updatedAt" = NOW()
       WHERE id = $4`,
      [winnerSub.contributor_id, winnerSub.contributor_wallet, submissionId, bountyId]
    );

    // 7. Log activity
    try {
      await pool.query(
        `INSERT INTO activity_log (bounty_id, actor_id, action, metadata)
         VALUES ($1, $2, 'WINNER_ACCEPTED', $3)`,
        [
          bountyId,
          session.user.id,
          JSON.stringify({
            winner_name: winnerSub.contributor_name,
            winner_email: winnerSub.contributor_email,
            winner_wallet: winnerSub.contributor_wallet,
            submission_id: submissionId,
            pr_url: winnerSub.pr_url,
            score: winnerSub.ai_quality_score,
            rank: winnerSub.rank,
          }),
        ]
      );
    } catch { /* activity_log may not exist */ }

    // 8. Send notification to winner (best-effort)
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, bounty_id, title, message, type)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          winnerSub.contributor_id,
          bountyId,
          "🎉 Your Submission Was Accepted!",
          "The admin has selected your PR as the winning submission. Once your PR is merged on GitHub, the bounty reward will be sent to your wallet.",
          "success",
        ]
      );
    } catch { /* notifications table may not exist */ }

    return NextResponse.json({
      success: true,
      winner: {
        contributor_id: winnerSub.contributor_id,
        contributor_name: winnerSub.contributor_name,
        contributor_email: winnerSub.contributor_email,
        contributor_wallet: winnerSub.contributor_wallet,
        submission_id: submissionId,
        pr_url: winnerSub.pr_url,
        score: winnerSub.ai_quality_score,
        rank: winnerSub.rank,
      },
    });
  } catch (error: unknown) {
    console.error("Accept submission error:", error);
    const message = error instanceof Error ? error.message : "Failed to accept submission";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
