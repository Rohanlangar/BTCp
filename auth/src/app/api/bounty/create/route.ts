import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    let session = await auth.api.getSession({ headers: { cookie: headersList.get("cookie") || "" } });

    if (!session || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin only." }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, amount_algo, max_contributors, deadline, skill_tags } = body;

    const adminWallet = (session.user as any).walletAddress;
    if (!adminWallet) {
        return NextResponse.json({ error: "Admin wallet missing. Please link your wallet first." }, { status: 400 });
    }

    // Insert bounty (status defaults to DRAFT)
    const result = await pool.query(
      `INSERT INTO bounties 
        (title, description, admin_id, admin_wallet, amount_algo, max_contributors, deadline, skill_tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [title, description, session.user.id, adminWallet, amount_algo, max_contributors || 1, deadline, skill_tags]
    );

    const bounty = result.rows[0];

    // Log activity
    await pool.query(
      `INSERT INTO activity_log (bounty_id, actor_id, actor_wallet, action, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [bounty.id, session.user.id, adminWallet, "created", JSON.stringify({ note: "Bounty created as draft" })]
    );

    return NextResponse.json({ success: true, bounty });
  } catch (error) {
    console.error("Create Bounty Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
