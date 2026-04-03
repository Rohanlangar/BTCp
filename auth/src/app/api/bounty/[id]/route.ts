import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const result = await pool.query(`
      SELECT b.*, 
             u.name as admin_name, 
             u.image as admin_image,
             (SELECT COUNT(*) FROM claims c WHERE c.bounty_id = b.id AND c.status != 'abandoned') as claim_count,
             (SELECT COUNT(*) FROM submissions s WHERE s.bounty_id = b.id) as submission_count
      FROM bounties b
      JOIN "user" u ON b.admin_id = u.id
      WHERE b.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }

    return NextResponse.json({ bounty: result.rows[0] });
  } catch (error) {
    console.error("Get Bounty Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
