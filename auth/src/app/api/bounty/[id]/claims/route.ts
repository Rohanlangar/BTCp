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
      SELECT c.*, u.name as contributor_name, u.image as contributor_image
      FROM claims c
      JOIN "user" u ON c.contributor_id = u.id
      WHERE c.bounty_id = $1
      ORDER BY c.claimed_at DESC
    `, [id]);

    return NextResponse.json({ claims: result.rows });
  } catch (error) {
    console.error("Get Bounty Claims Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
