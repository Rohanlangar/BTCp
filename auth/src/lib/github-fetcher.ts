// src/lib/github-fetcher.ts
// Octokit-based GitHub data fetching for the ML validation pipeline.
// Separate from the raw fetch calls in /api/bounties/create — this fetches
// PR diffs and file-level patches that the ML models need.

import { Octokit } from "@octokit/rest";

/**
 * Parse a GitHub PR or Issue URL into components.
 * Handles: https://github.com/owner/repo/pull/123
 *          https://github.com/owner/repo/issues/456
 */
export function parseGitHubUrl(url: string): {
  owner: string;
  repo: string;
  number: number;
  type: "pull" | "issues";
} {
  const prMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (prMatch) {
    return { owner: prMatch[1], repo: prMatch[2], number: parseInt(prMatch[3]), type: "pull" };
  }
  const issueMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (issueMatch) {
    return { owner: issueMatch[1], repo: issueMatch[2], number: parseInt(issueMatch[3]), type: "issues" };
  }
  throw new Error(`Invalid GitHub URL: ${url}`);
}

/**
 * Create an Octokit instance.
 * Uses GITHUB_PAT from env, or falls back to GITHUB_CLIENT_SECRET if needed.
 */
export function createOctokit(): Octokit {
  const token = process.env.GITHUB_PAT || process.env.GITHUB_CLIENT_SECRET;
  return new Octokit({ auth: token });
}

/**
 * Fetch issue title and body for ML analysis.
 */
export async function fetchIssueData(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
) {
  const { data } = await octokit.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });
  return {
    title: data.title,
    body: data.body || "",
  };
}

/**
 * Fetch PR metadata, unified diff, and changed files list.
 * The diff is the key input for CodeBERT and Bandit.
 */
export async function fetchPRData(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
) {
  // 1. PR metadata (title, body, merge status)
  const { data: prMeta } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  // 2. Raw unified diff (this is what the ML models analyze)
  const { data: diffData } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: { format: "diff" },
  });

  // 3. Changed files list (file names + per-file patches)
  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
  });

  return {
    title: prMeta.title,
    body: prMeta.body || "",
    diff: diffData as unknown as string, // Octokit returns string when format=diff
    merged: prMeta.merged,
    state: prMeta.state,
    files: files.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch || "",
    })),
  };
}

/**
 * Check if a PR is merged (used by the "Approve & Settle" button).
 */
export async function checkPRMergeStatus(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
) {
  const { data } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  return {
    merged: data.merged,
    state: data.state,
    merged_at: data.merged_at,
    merge_commit_sha: data.merge_commit_sha,
  };
}
