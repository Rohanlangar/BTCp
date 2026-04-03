// src/app/api/github/pr-status/route.ts
// GET /api/github/pr-status?owner=X&repo=Y&pr_number=Z
// Returns merge status of a GitHub PR.
// Used by the admin dashboard to enable/disable the "Approve & Settle" button.

import { NextRequest, NextResponse } from "next/server";
import { createOctokit, checkPRMergeStatus } from "@/lib/github-fetcher";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const prNumber = searchParams.get("pr_number");

  if (!owner || !repo || !prNumber) {
    return NextResponse.json(
      { error: "Missing required params: owner, repo, pr_number" },
      { status: 400 }
    );
  }

  try {
    const octokit = createOctokit();
    const status = await checkPRMergeStatus(
      octokit,
      owner,
      repo,
      parseInt(prNumber)
    );
    return NextResponse.json(status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check PR status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
