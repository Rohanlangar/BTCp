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
      SELECT a.*, u.name as actor_name, u.image as actor_image
      FROM activity_log a
      LEFT JOIN "user" u ON a.actor_id = u.id
      WHERE a.bounty_id = $1
      ORDER BY a.timestamp DESC
    `, [id]);

    return NextResponse.json({ timeline: result.rows });
  } catch (error) {
    console.error("Get Bounty Activity Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
