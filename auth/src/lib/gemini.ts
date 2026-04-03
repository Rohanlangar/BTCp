// src/lib/gemini.ts
// Layer 4: Gemini-powered code quality assessment and human-readable summary

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface GeminiResult {
  quality_score: number;   // 0-100
  reasoning: string;       // 2-3 sentence assessment
  summary: string;         // 1 paragraph for the dashboard
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run Gemini analysis on the PR.
 * Includes a simple retry mechanism for 429 (quota) errors.
 */
export async function runGeminiAnalysis(
  issueTitle: string,
  issueBody: string,
  prTitle: string,
  prBody: string,
  diff: string,
  fileNames: string[]
): Promise<GeminiResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are a senior code reviewer analyzing a GitHub Pull Request submission for a decentralized bounty platform on Algorand.

## THE PROBLEM (GitHub Issue)
**Title:** ${issueTitle}
**Description:** ${issueBody?.substring(0, 1500) || "No description provided"}

## THE SOLUTION (Pull Request)
**PR Title:** ${prTitle}
**PR Description:** ${prBody?.substring(0, 1500) || "No description provided"}
**Files Changed:** ${fileNames.join(", ")}

## CODE DIFF (truncated to 8000 chars)
\`\`\`diff
${diff.substring(0, 8000)}
\`\`\`

## YOUR TASK
Analyze this PR for:
1. **Code Quality**: Is the code well-structured, readable, and following best practices?
2. **Completeness**: Does the PR actually address the issue described?
3. **Potential Issues**: Any obvious bugs, edge cases, or maintainability concerns?

Return ONLY valid JSON (no markdown fences):
{
  "quality_score": <number 0-100>,
  "reasoning": "<2-3 sentence assessment of code quality, structure, and best practices>",
  "summary": "<1 paragraph summary of what this PR does and whether it solves the bounty, suitable for display on a public dashboard>"
}`;

  let lastError: any = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      try {
        return JSON.parse(clean);
      } catch {
        return {
          quality_score: 50,
          reasoning: "Review analysis completed but response was unparseable.",
          summary: text.substring(0, 500),
        };
      }
    } catch (error: any) {
      lastError = error;
      // If it's a quota error (429), wait and try again
      if (error?.status === 429 && attempt < maxRetries) {
        console.warn(`[Gemini] Quota exceeded (429). Retry attempt ${attempt} in 2s...`);
        await sleep(2000 * attempt); // Exponential backoff: 2s, 4s...
        continue;
      }
      // For other errors, or if we're out of retries, throw or use fallback
      break;
    }
  }

  console.error(`[Gemini] Failed after ${maxRetries} attempts:`, lastError?.message || lastError);
  return {
    quality_score: 0,
    reasoning: "ML Quota Exceeded. Static analysis (Layers 1-3) still active but Layer 4 (Gemini) summary failed.",
    summary: "Validation summary unavailable due to API rate limits. Please check mechanical scores for relevance and alignment.",
  };
}
