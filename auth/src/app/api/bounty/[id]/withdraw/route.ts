import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    
    const headersList = await headers();
    let session = await auth.api.getSession({ headers: { cookie: headersList.get("cookie") || "" } });

    if (!session || (session.user as any).role === "admin") {
      return NextResponse.json({ error: "Only contributors can withdraw claims" }, { status: 401 });
    }

    const contributorWallet = (session.user as any).walletAddress;

    // Check if the user has an active claim
    const claimCheck = await pool.query(`SELECT id FROM claims WHERE bounty_id = $1 AND contributor_id = $2 AND status = 'active'`, [id, session.user.id]);
    if (claimCheck.rows.length === 0) return NextResponse.json({ error: "No active claim found" }, { status: 404 });

    // Withdraw the claim
    await pool.query(`UPDATE claims SET status = 'abandoned' WHERE id = $1`, [claimCheck.rows[0].id]);

    // Re-open the bounty if it was fully claimed
    await pool.query(`
      UPDATE bounties 
      SET status = 'OPEN' 
      WHERE id = $1 AND status = 'CLAIMED'
    `, [id]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_log (bounty_id, actor_id, actor_wallet, action, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, session.user.id, contributorWallet, "withdrawn", JSON.stringify({ note: "Contributor abandoned their claim" })]
    );

    return NextResponse.json({ success: true, message: "Claim abandoned" });
  } catch (error) {
    console.error("Withdraw Claim Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
