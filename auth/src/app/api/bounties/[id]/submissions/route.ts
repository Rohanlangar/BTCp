import { NextResponse, NextRequest } from "next/server";
import { pool } from "@/lib/auth";
import { auth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bountyId } = await params;

  try {
    const result = await pool.query(
      `SELECT s.*, 
              u."name" as contributor_name, 
              u."email" as contributor_email,
              u."image" as contributor_image,
              u."githubHandle" as contributor_github
       FROM submissions s
       JOIN "user" u ON s.contributor_id = u.id
       WHERE s.bounty_id = $1
       ORDER BY s.rank ASC NULLS LAST, s.ai_quality_score DESC NULLS LAST, s.submitted_at ASC`,
      [bountyId]
    );

    return NextResponse.json({ submissions: result.rows });
  } catch (err: any) {
    console.error("Failed to fetch submissions:", err);
    return NextResponse.json({ error: err.message || "Server Error" }, { status: 500 });
  }
}
