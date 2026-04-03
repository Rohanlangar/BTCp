import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const headersList = await headers();
    let session = await auth.api.getSession({ headers: { cookie: headersList.get("cookie") || "" } });

    if (!session || (session.user as any).role === "admin") {
      return NextResponse.json({ error: "Only contributors can claim bounties" }, { status: 401 });
    }

    const contributorWallet = (session.user as any).walletAddress;
    if (!contributorWallet) {
        return NextResponse.json({ error: "Wallet missing. Please connect your wallet first." }, { status: 400 });
    }

    // Verify bounty exists and is claimable
    const bountyCheck = await pool.query(`SELECT status, max_contributors FROM bounties WHERE id = $1`, [id]);
    if (bountyCheck.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const bounty = bountyCheck.rows[0];

    if (bounty.status !== 'OPEN') {
      return NextResponse.json({ error: "Bounty is not OPEN for claims" }, { status: 400 });
    }

    // Check if max contributors reached
    const claimsCheck = await pool.query(`SELECT count(*) FROM claims WHERE bounty_id = $1 AND status = 'active'`, [id]);
    if (parseInt(claimsCheck.rows[0].count) >= bounty.max_contributors) {
      return NextResponse.json({ error: "Bounty has reached max active claims" }, { status: 400 });
    }

    // Insert claim
    const result = await pool.query(
      `INSERT INTO claims (bounty_id, contributor_id, contributor_wallet)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, session.user.id, contributorWallet]
    );

    // Update bounty status if max reached
    if (parseInt(claimsCheck.rows[0].count) + 1 >= bounty.max_contributors) {
      await pool.query(`UPDATE bounties SET status = 'CLAIMED' WHERE id = $1`, [id]);
    }

    // Log activity
    await pool.query(
      `INSERT INTO activity_log (bounty_id, actor_id, actor_wallet, action, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, session.user.id, contributorWallet, "claimed", JSON.stringify({ note: "Claimed by contributor" })]
    );

    return NextResponse.json({ success: true, claim: result.rows[0] });
  } catch (error: any) {
    console.error("Claim Bounty Error:", error);
    if (error.code === '23505') return NextResponse.json({ error: "You already claimed this bounty" }, { status: 400 });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
