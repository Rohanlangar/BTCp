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
    
    // Using unawaited headers in Next.js 15 requires context destructuring or manual await
    // This is Next 14/15 compatible:
    const headersList = await headers();
    let session = await auth.api.getSession({ headers: { cookie: headersList.get("cookie") || "" } });

    if (!session || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin only." }, { status: 401 });
    }

    const adminWallet = (session.user as any).walletAddress;

    // Verify ownership and state
    const bountyCheck = await pool.query(`SELECT status, admin_id FROM bounties WHERE id = $1`, [id]);
    if (bountyCheck.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const currentStatus = bountyCheck.rows[0].status;
    
    if (bountyCheck.rows[0].admin_id !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    
    if (currentStatus === 'COMPLETED' || currentStatus === 'CANCELLED' || currentStatus === 'REFUNDED') {
      return NextResponse.json({ error: "Bounty cannot be cancelled from its current state" }, { status: 400 });
    }

    // Cancel logic
    const result = await pool.query(
      `UPDATE bounties SET status = 'CANCELLED' WHERE id = $1 RETURNING *`,
      [id]
    );

    // Cancel all active claims instantly
    await pool.query(`UPDATE claims SET status = 'lost' WHERE bounty_id = $1`, [id]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_log (bounty_id, actor_id, actor_wallet, action, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, session.user.id, adminWallet, "cancelled", JSON.stringify({ note: "Bounty was cancelled by admin" })]
    );

    return NextResponse.json({ success: true, bounty: result.rows[0] });
  } catch (error) {
    console.error("Cancel Bounty Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
