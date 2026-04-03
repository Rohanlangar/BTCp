import { NextResponse, NextRequest } from "next/server";
import { pool } from "@/lib/auth";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") || "";
  const session = await auth.api.getSession({ headers: { cookie: cookieHeader } });
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { bountyId, prUrl, documentation, comments } = await request.json();

    if (!bountyId || !prUrl) {
      return NextResponse.json({ error: "Missing required fields: bountyId and prUrl are required" }, { status: 400 });
    }

    if (!documentation || documentation.trim().length < 10) {
      return NextResponse.json({ error: "Documentation is required (min 10 characters)" }, { status: 400 });
    }

    // Validate PR URL format
    if (!prUrl.includes("github.com") || !prUrl.includes("/pull/")) {
      return NextResponse.json({ error: "Please provide a valid GitHub Pull Request URL" }, { status: 400 });
    }

    // Check the contributor has participated (has a claim)
    const claimResult = await pool.query(
      `SELECT id FROM claims WHERE bounty_id = $1 AND contributor_id = $2 AND status = 'active'`,
      [bountyId, session.user.id]
    );

    if (claimResult.rows.length === 0) {
      return NextResponse.json({ error: "You must participate in this bounty before submitting" }, { status: 403 });
    }

    const claimId = claimResult.rows[0].id;

    // Check for duplicate submission
    const existingSub = await pool.query(
      `SELECT id FROM submissions WHERE bounty_id = $1 AND contributor_id = $2`,
      [bountyId, session.user.id]
    );

    let submission;
    if (existingSub.rows.length > 0) {
      // Update existing submission
      const updateResult = await pool.query(
        `UPDATE submissions 
         SET pr_url = $1, documentation = $2, comments = $3, 
             content_url = $1, status = 'pending', updated_at = NOW()
         WHERE bounty_id = $4 AND contributor_id = $5
         RETURNING *`,
        [prUrl, documentation, comments || null, bountyId, session.user.id]
      );
      submission = updateResult.rows[0];
    } else {
      // Create new submission
      const insertResult = await pool.query(
        `INSERT INTO submissions (bounty_id, claim_id, contributor_id, pr_url, content_url, documentation, comments, status, submitted_at)
         VALUES ($1, $2, $3, $4, $4, $5, $6, 'pending', NOW())
         RETURNING *`,
        [bountyId, claimId, session.user.id, prUrl, documentation, comments || null]
      );
      submission = insertResult.rows[0];
    }

    // Update claim status to 'submitted'
    await pool.query(
      `UPDATE claims SET status = 'submitted', updated_at = NOW() WHERE id = $1`,
      [claimId]
    );

    return NextResponse.json({ success: true, submission });
  } catch (err: any) {
    console.error("Failed to submit bounty work:", err);
    return NextResponse.json({ error: err.message || "Server Error" }, { status: 500 });
  }
}
