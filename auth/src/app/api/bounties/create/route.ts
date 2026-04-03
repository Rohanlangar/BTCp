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
    const { escrowAppId, registryBountyId, issueUrl, rewardAlgo, creatorWallet } = await request.json();

    // Check if valid input
    if (!escrowAppId || !registryBountyId || !issueUrl || !rewardAlgo || !creatorWallet) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch metadata from GitHub if it's a valid URL
    let issueTitle = issueUrl;
    let issueDescription = null;
    let repoOwner = null;
    let repoName = null;
    let issueNumber = null;

    try {
      const urlObj = new URL(issueUrl);
      if (urlObj.hostname === "github.com") {
        const parts = urlObj.pathname.split("/").filter(Boolean);
        if (parts.length >= 4 && parts[2] === "issues") {
          repoOwner = parts[0];
          repoName = parts[1];
          issueNumber = parseInt(parts[3], 10);

          // Fetch from GitHub API
          const ghRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}`);
          if (ghRes.ok) {
            const ghData = await ghRes.json();
            issueTitle = ghData.title || issueUrl;
            issueDescription = ghData.body || null;
          }
        }
      }
    } catch (e) {
      console.warn("Failed to parse/fetch GitHub issue details:", e);
    }

    // Insert into DB
    const query = `
      INSERT INTO "bounties" (
        "creatorId", 
        "creatorWallet", 
        "issueUrl", 
        "issueTitle",
        "issueDescription",
        "repoOwner",
        "repoName",
        "issueNumber",
        "rewardAlgo", 
        "escrowAppId", 
        "registryBountyId", 
        "status",
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'OPEN'::bounty_status, NOW(), NOW())
      RETURNING *;
    `;
    
    const values = [
      session.user.id,
      creatorWallet,
      issueUrl,
      issueTitle,
      issueDescription,
      repoOwner,
      repoName,
      issueNumber,
      rewardAlgo,
      escrowAppId,
      registryBountyId
    ];

    const result = await pool.query(query, values);
    
    return NextResponse.json({ success: true, bounty: result.rows[0] });
  } catch (err: any) {
    console.error("Failed to insert bounty into DB:", err);
    return NextResponse.json({ error: err.message || "Server Error" }, { status: 500 });
  }
}
