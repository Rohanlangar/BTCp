import { NextResponse } from "next/server";
import { pool } from "@/lib/auth";

export async function GET() {
  try {
    const query = `
      SELECT 
        b.*,
        u.name as creatorName,
        u.image as creatorImage
      FROM bounties b
      LEFT JOIN "user" u ON b."creatorId" = u.id
      ORDER BY b."createdAt" DESC
    `;
    const result = await pool.query(query);
    return NextResponse.json({ bounties: result.rows });
  } catch (err: any) {
    console.error("Failed to fetch bounties:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
