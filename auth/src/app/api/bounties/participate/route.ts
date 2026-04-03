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
    const { bountyId } = await request.json();

    if (!bountyId) {
      return NextResponse.json({ error: "Missing bountyId" }, { status: 400 });
    }

    // Check bounty exists and is OPEN
    const bountyResult = await pool.query(
      `SELECT id, status FROM bounties WHERE id = $1`,
      [bountyId]
    );
    if (bountyResult.rows.length === 0) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }
    if (bountyResult.rows[0].status !== "OPEN") {
      return NextResponse.json({ error: "Bounty is not open for participation" }, { status: 400 });
    }

    // Check if already participating
    const existingClaim = await pool.query(
      `SELECT id FROM claims WHERE bounty_id = $1 AND contributor_id = $2`,
      [bountyId, session.user.id]
    );
    if (existingClaim.rows.length > 0) {
      return NextResponse.json({ 
        success: true, 
        message: "Already participating", 
        claimId: existingClaim.rows[0].id 
      });
    }

    // Get contributor wallet from user table (optional)
    const userResult = await pool.query(
      `SELECT "walletAddress" FROM "user" WHERE id = $1`,
      [session.user.id]
    );
    const walletAddress = userResult.rows[0]?.walletAddress || null;

    // Create participation record (DB-only, no on-chain tx)
    const claimResult = await pool.query(
      `INSERT INTO claims (bounty_id, contributor_id, contributor_wallet, status, claimed_at, participated_at)
       VALUES ($1, $2, $3, 'active', NOW(), NOW())
       RETURNING *`,
      [bountyId, session.user.id, walletAddress]
    );

    return NextResponse.json({ 
      success: true, 
      claim: claimResult.rows[0] 
    });
  } catch (err: any) {
    console.error("Failed to participate in bounty:", err);
    return NextResponse.json({ error: err.message || "Server Error" }, { status: 500 });
  }
}
