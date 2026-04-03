import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function GET(request: NextRequest) {
  try {
    const headersList = await headers();
    const cookieHeader = headersList.get("cookie");
    let session = null;
    try {
      session = await auth.api.getSession({ headers: { cookie: cookieHeader || "" } });
    } catch (e) {}

    // Check query params
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";

    let query = `
      SELECT b.*, 
             u.name as admin_name, 
             (SELECT COUNT(*) FROM claims c WHERE c.bounty_id = b.id AND c.status != 'abandoned') as claim_count,
             (SELECT COUNT(*) FROM submissions s WHERE s.bounty_id = b.id) as submission_count
      FROM bounties b
      JOIN "user" u ON b.admin_id = u.id
    `;
    
    // If not admin, hide DRAFT and only show published bounties
    let queryArgs: any[] = [];
    if (!session || (session.user as any).role !== "admin") {
      query += ` WHERE b.status != 'DRAFT' `;
    } else {
      query += ` WHERE 1=1 `;
    }

    if (filter === "open") {
      query += ` AND b.status = 'OPEN' `;
    }

    query += ` ORDER BY b.created_at DESC `;

    const result = await pool.query(query, queryArgs);

    return NextResponse.json({ bounties: result.rows });
  } catch (error) {
    console.error("List Bounties Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
