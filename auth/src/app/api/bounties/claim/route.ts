import { NextResponse, NextRequest } from "next/server";
import { pool } from "@/lib/auth";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // Requires authentication
  const cookieHeader = request.headers.get("cookie") || "";
  const session = await auth.api.getSession({ headers: { cookie: cookieHeader } });
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { bountyId, contributorWallet } = await request.json();

    if (!bountyId || !contributorWallet) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const query = `
      UPDATE "bounties" 
      SET 
        "status" = 'CLAIMED'::bounty_status,
        "contributorId" = $1,
        "contributorWallet" = $2,
        "claimedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE "id" = $3 AND "status" = 'OPEN'::bounty_status
      RETURNING *;
    `;
    
    const values = [
      session.user.id,
      contributorWallet,
      bountyId
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
       return NextResponse.json({ error: "Bounty not found or already claimed" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, bounty: result.rows[0] });
  } catch (err: any) {
    console.error("Failed to claim bounty:", err);
    return NextResponse.json({ error: err.message || "Server Error" }, { status: 500 });
  }
}
