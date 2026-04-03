import { NextResponse, NextRequest } from "next/server";
import { pool } from "@/lib/auth";
import { auth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // id is escrowAppId
) {
  const cookieHeader = request.headers.get("cookie") || "";
  const session = await auth.api.getSession({ headers: { cookie: cookieHeader } });
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  
  try {
    const body = await request.json();
    const { contributorWallet, contributorGithub } = body;

    const query = `
      UPDATE bounties 
      SET 
        status = 'CLAIMED', 
        "contributorId" = $1, 
        "contributorWallet" = $2,
        "contributorGithub" = $3,
        "claimedAt" = NOW()
      WHERE "escrowAppId" = $4
      RETURNING *
    `;
    const values = [
      session.user.id,
      contributorWallet,
      contributorGithub || session.user.name,
      parseInt(id, 10)
    ];

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, bounty: result.rows[0] });
  } catch (err: any) {
    console.error("Failed to claim bounty:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
