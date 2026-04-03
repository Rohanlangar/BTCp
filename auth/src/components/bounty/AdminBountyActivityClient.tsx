"use client";

import { useState, useEffect, useCallback } from "react";

interface Submission {
  id: string;
  contributor_id: string;
  contributor_name: string;
  contributor_email: string;
  contributor_image: string | null;
  pr_url: string;
  documentation: string;
  comments: string | null;
  ai_quality_score: number | null;
  ai_report_json: any;
  rank: number | null;
  status: string;
  submitted_at: string;
}

interface RankedResult {
  submission_id: string;
  contributor_id: string;
  contributor_name: string;
  contributor_email: string;
  contributor_image: string | null;
  pr_url: string;
  documentation: string;
  comments: string | null;
  overall_score: number;
  verdict: string;
  rank: number;
  report: any;
  error?: string;
}

interface WinnerInfo {
  contributor_id: string;
  contributor_name: string;
  contributor_email: string;
  contributor_wallet: string | null;
  submission_id: string;
  pr_url: string;
  score: number;
  rank: number;
}

const RANK_CONFIG: Record<number, { badge: string; border: string; bg: string; text: string; label: string }> = {
  1: { badge: "🥇", border: "border-yellow-500/40", bg: "bg-yellow-500/5", text: "text-yellow-400", label: "1st Place" },
  2: { badge: "🥈", border: "border-gray-400/40",   bg: "bg-gray-400/5",   text: "text-gray-300",  label: "2nd Place" },
  3: { badge: "🥉", border: "border-amber-600/40",  bg: "bg-amber-600/5",  text: "text-amber-500", label: "3rd Place" },
};

function ScoreBar({ score, color }: { score: number; color?: string }) {
  const barColor = color || (score > 80 ? "bg-emerald-500" : score > 60 ? "bg-amber-500" : "bg-red-500");
  return (
    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${score}%` }} />
    </div>
  );
}

export function AdminBountyActivityClient({
  bountyId,
  initialSubmissions,
  bountyStatus,
}: {
  bountyId: string;
  initialSubmissions: Submission[];
  bountyStatus: string;
}) {
  const [submissions] = useState(initialSubmissions);
  const [rankings, setRankings] = useState<RankedResult[] | null>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState<string | null>(null);
  const [expandedRank, setExpandedRank] = useState<number | null>(null);
  const [isMlOffline, setIsMlOffline] = useState<boolean | null>(null);

  // Accept & Merge state
  const [currentStatus, setCurrentStatus] = useState(bountyStatus);
  const [acceptLoading, setAcceptLoading] = useState<string | null>(null); // submission_id being accepted
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [winner, setWinner] = useState<WinnerInfo | null>(null);
  const [confirmAcceptId, setConfirmAcceptId] = useState<string | null>(null);
  const [mergeCheckLoading, setMergeCheckLoading] = useState(false);
  const [mergeStatus, setMergeStatus] = useState<{ merged: boolean; state: string; merged_at: string | null } | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // Check health on mount
  useEffect(() => {
    fetch("/api/bounties/health").then(res => res.json()).then(data => {
      setIsMlOffline(!data.ml_online);
    }).catch(() => setIsMlOffline(true));
  }, []);

  // Load existing winner info if bounty is already ACCEPTED or beyond
  useEffect(() => {
    if (["ACCEPTED", "AWAITING_SETTLEMENT", "SETTLED", "COMPLETED"].includes(currentStatus)) {
      // Find the accepted submission
      const acceptedSub = submissions.find(s => s.status === "accepted" || s.status === "merged");
      if (acceptedSub) {
        setWinner({
          contributor_id: acceptedSub.contributor_id,
          contributor_name: acceptedSub.contributor_name,
          contributor_email: acceptedSub.contributor_email,
          contributor_wallet: null,
          submission_id: acceptedSub.id,
          pr_url: acceptedSub.pr_url,
          score: acceptedSub.ai_quality_score || 0,
          rank: acceptedSub.rank || 1,
        });
      }
    }
  }, [currentStatus, submissions]);

  // Auto-poll merge status when bounty is ACCEPTED (every 30 seconds)
  useEffect(() => {
    if (currentStatus !== "ACCEPTED") return;
    
    const checkMerge = async () => {
      try {
        const res = await fetch(`/api/bounties/${bountyId}/check-merge`);
        if (res.ok) {
          const data = await res.json();
          setMergeStatus(data);
          if (data.merged) {
            setCurrentStatus("AWAITING_SETTLEMENT");
          }
        }
      } catch { /* ignore polling errors */ }
    };

    // Check immediately once
    checkMerge();
    
    // Then poll every 30 seconds
    const interval = setInterval(checkMerge, 30000);
    return () => clearInterval(interval);
  }, [currentStatus, bountyId]);

  // Check if ML has already run (submissions have scores)
  const hasExistingScores = submissions.some(s => s.ai_quality_score != null && s.rank != null);

  // Build rankings from existing data if available
  const existingRankings: RankedResult[] | null = hasExistingScores
    ? submissions
        .filter(s => s.ai_quality_score != null)
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
        .map(s => ({
          submission_id: s.id,
          contributor_id: s.contributor_id,
          contributor_name: s.contributor_name,
          contributor_email: s.contributor_email,
          contributor_image: s.contributor_image,
          pr_url: s.pr_url,
          documentation: s.documentation,
          comments: s.comments,
          overall_score: s.ai_quality_score!,
          verdict: s.ai_report_json?.verdict || "N/A",
          rank: s.rank!,
          report: typeof s.ai_report_json === 'string' ? JSON.parse(s.ai_report_json) : s.ai_report_json,
        }))
    : null;

  const displayRankings = rankings || existingRankings;

  const launchMLPipeline = async () => {
    setMlLoading(true);
    setMlError(null);
    setRankings(null);

    try {
      const res = await fetch(`/api/bounties/${bountyId}/validate-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ML pipeline failed");

      setRankings(data.rankings);
    } catch (err: any) {
      setMlError(err.message || "Failed to launch ML pipeline");
    } finally {
      setMlLoading(false);
    }
  };

  // Accept a submission as the winner
  const handleAccept = useCallback(async (submissionId: string) => {
    setAcceptLoading(submissionId);
    setAcceptError(null);
    setConfirmAcceptId(null);

    try {
      const res = await fetch(`/api/bounties/${bountyId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept submission");

      setWinner(data.winner);
      setCurrentStatus("ACCEPTED");
    } catch (err: any) {
      setAcceptError(err.message || "Failed to accept submission");
    } finally {
      setAcceptLoading(null);
    }
  }, [bountyId]);

  // Manually check merge status
  const handleCheckMerge = async () => {
    setMergeCheckLoading(true);
    setMergeError(null);

    try {
      const res = await fetch(`/api/bounties/${bountyId}/check-merge`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to check merge status");

      setMergeStatus(data);
      if (data.merged) {
        setCurrentStatus("AWAITING_SETTLEMENT");
      }
    } catch (err: any) {
      setMergeError(err.message || "Failed to check merge status");
    } finally {
      setMergeCheckLoading(false);
    }
  };

  // Can the admin accept a winner? Only when bounty is SUBMITTED (ML has run)
  const canAcceptWinner = ["SUBMITTED", "UNDER_REVIEW"].includes(currentStatus) && !winner;

  return (
    <div>
      {/* ───────── Winner Banner ───────── */}
      {winner && (
        <section className="mb-8">
          <div className={`rounded-2xl overflow-hidden border-2 ${
            currentStatus === "AWAITING_SETTLEMENT" 
              ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10"
              : "border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10"
          }`}>
            {/* Winner header */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🏆</span>
                <h2 className="text-lg font-bold text-white">
                  {currentStatus === "AWAITING_SETTLEMENT" ? "Winner Confirmed — PR Merged" : "Winner Selected"}
                </h2>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ml-auto ${
                  currentStatus === "AWAITING_SETTLEMENT"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-green-500/20 text-green-400 border border-green-500/30"
                }`}>
                  {currentStatus === "AWAITING_SETTLEMENT" ? "✅ Merged" : "⏳ Awaiting Merge"}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-2xl font-bold shadow-lg shadow-yellow-900/30">
                  🥇
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-lg font-bold">{winner.contributor_name}</p>
                  <p className="text-gray-400 text-sm">{winner.contributor_email}</p>
                  {winner.contributor_wallet && (
                    <p className="text-gray-500 text-xs font-mono mt-0.5 truncate">Wallet: {winner.contributor_wallet}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-3xl font-black text-white">{winner.score}%</p>
                  <p className="text-gray-500 text-xs">ML Score</p>
                </div>
              </div>

              <a
                href={winner.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 text-blue-400 text-sm hover:underline flex items-center gap-1"
              >
                🔗 {winner.pr_url}
              </a>
            </div>

            {/* Action area based on status */}
            <div className="border-t border-white/10 px-6 py-4 bg-white/[0.02]">
              {currentStatus === "ACCEPTED" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-yellow-400">⚠️</span>
                    <p className="text-gray-300">
                      <strong>Next step:</strong> Go to GitHub and merge this PR into your repository. Resolve any merge conflicts.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <a
                      href={winner.pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white font-medium rounded-xl transition-all text-sm flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                      Open PR on GitHub →
                    </a>
                    <button
                      onClick={handleCheckMerge}
                      disabled={mergeCheckLoading}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all text-sm flex items-center gap-2"
                    >
                      {mergeCheckLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>🔄 Check Merge Status</>
                      )}
                    </button>
                  </div>

                  {mergeStatus && !mergeStatus.merged && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm flex items-center gap-2">
                      <span>⏳</span>
                      <span>PR is <strong>{mergeStatus.state}</strong> — not yet merged. Merge it on GitHub and check again.</span>
                    </div>
                  )}

                  {mergeError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                      ❌ {mergeError}
                    </div>
                  )}

                  <p className="text-gray-600 text-xs flex items-center gap-1">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    Auto-checking merge status every 30 seconds...
                  </p>
                </div>
              )}

              {currentStatus === "AWAITING_SETTLEMENT" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-emerald-400">✅</span>
                    <p className="text-emerald-300">
                      PR has been merged successfully!
                      {mergeStatus?.merged_at && (
                        <span className="text-gray-500 ml-2 text-xs">
                          Merged at {new Date(mergeStatus.merged_at).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    disabled
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600/50 to-cyan-600/50 text-white/60 font-medium rounded-xl text-sm cursor-not-allowed flex items-center gap-2"
                  >
                    💰 Send Payment — Contract Integration Coming Soon
                  </button>
                  <p className="text-gray-600 text-xs">
                    The smart contract settlement will automatically transfer {winner.score ? "the bounty reward" : "funds"} to the winner&apos;s wallet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ───────── Accept Error ───────── */}
      {acceptError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          ❌ {acceptError}
          <button onClick={() => setAcceptError(null)} className="ml-3 text-red-500 hover:text-red-300 underline text-xs">Dismiss</button>
        </div>
      )}

      {/* ───────── Submissions List ───────── */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-500/20 rounded-md flex items-center justify-center text-blue-400 text-xs">📄</span>
          Submissions ({submissions.length})
        </h2>

        {submissions.length === 0 ? (
          <div className="bg-gray-900/30 border border-dashed border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500">No submissions yet. Contributors need to submit their PRs first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => {
              const isWinner = winner?.submission_id === s.id;
              return (
                <div key={s.id} className={`bg-gray-900/40 border rounded-xl p-5 ${
                  isWinner ? "border-green-500/30 bg-green-500/5" : "border-gray-800"
                }`}>
                  <div className="flex items-start gap-3">
                    {s.contributor_image ? (
                      <img src={s.contributor_image} alt="" className="w-9 h-9 rounded-full border border-gray-700 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {(s.contributor_name || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{s.contributor_name}</span>
                        <span className="text-gray-600 text-xs">{s.contributor_email}</span>
                        {isWinner && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30 font-bold">
                            🏆 Winner
                          </span>
                        )}
                        {s.rank != null && s.rank <= 3 && (
                          <span className="text-xs">{RANK_CONFIG[s.rank]?.badge}</span>
                        )}
                      </div>
                      <a href={s.pr_url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 text-xs hover:underline truncate block mt-1">
                        🔗 {s.pr_url}
                      </a>
                      {s.documentation && (
                        <p className="text-gray-500 text-xs mt-1.5 line-clamp-2">📝 {s.documentation}</p>
                      )}
                      {s.comments && (
                        <p className="text-gray-600 text-xs mt-1 italic">💬 {s.comments}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {s.ai_quality_score != null ? (
                        <div className="text-sm">
                          <span className="font-bold text-white">{s.ai_quality_score}%</span>
                          {s.rank && <span className="text-gray-500 text-xs ml-1">#{s.rank}</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded">Pending</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ───────── ML Pipeline Launcher ───────── */}
      {submissions.length > 0 && (
        <section className="mb-8">
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-7 h-7 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400 text-sm">AI</span>
                  ML Validation Pipeline
                </h3>
                <p className="text-gray-400 text-sm mt-1">
                  Run 4-layer analysis (SBERT → CodeBERT → Bandit → Gemini) on all {submissions.length} submissions and rank them
                </p>
              </div>
              <button
                onClick={launchMLPipeline}
                disabled={mlLoading || !!winner}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20 whitespace-nowrap"
              >
                {mlLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing {submissions.length} PRs...
                  </span>
                ) : winner ? (
                  "Winner Already Selected"
                ) : hasExistingScores ? (
                  "🔄 Re-Run ML Pipeline"
                ) : (
                  "🚀 Launch ML Pipeline"
                )}
              </button>
            </div>

            {mlError && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                ❌ {mlError}
              </div>
            )}

            {isMlOffline && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span><b>ML Validator Offline</b>: Python service not detected on localhost:8001. Using Gemini-only fallback with simplified scores.</span>
              </div>
            )}

            {mlLoading && (
              <div className="mt-4 flex items-center gap-3 text-sm text-gray-400">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                Fetching PRs from GitHub → Running SBERT → CodeBERT → Bandit → Gemini...
              </div>
            )}
          </div>
        </section>
      )}

      {/* ───────── Rankings Display — Top 3 ───────── */}
      {displayRankings && displayRankings.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
            <span className="w-6 h-6 bg-yellow-500/20 rounded-md flex items-center justify-center text-yellow-400 text-xs">🏆</span>
            ML Rankings — Top Contributors
            {canAcceptWinner && (
              <span className="ml-auto text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 font-medium animate-pulse">
                Select a winner below ↓
              </span>
            )}
          </h2>

          <div className="space-y-4">
            {displayRankings.slice(0, 3).map((r) => {
              const config = RANK_CONFIG[r.rank] || RANK_CONFIG[3];
              const isExpanded = expandedRank === r.rank;
              const report = r.report;
              const isThisWinner = winner?.submission_id === r.submission_id;
              const isBeingAccepted = acceptLoading === r.submission_id;

              return (
                <div key={r.submission_id} className={`border ${isThisWinner ? "border-green-500/40 bg-green-500/5" : config.border + " " + config.bg} rounded-2xl overflow-hidden transition-all`}>
                  {/* Rank Header */}
                  <div
                    className="p-6 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpandedRank(isExpanded ? null : r.rank)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{isThisWinner ? "🏆" : config.badge}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`text-sm font-bold ${isThisWinner ? "text-green-400" : config.text}`}>
                            {isThisWinner ? "Winner" : config.label}
                          </span>
                          <span className="font-bold text-white text-lg">{r.contributor_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                            r.verdict === "PASS" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                            r.verdict === "WARN" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                            "bg-red-500/20 text-red-400 border-red-500/30"
                          }`}>
                            {r.verdict}
                          </span>
                          {isThisWinner && (
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30 font-bold">
                              ✅ Accepted
                            </span>
                          )}
                        </div>
                        <a href={r.pr_url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-400 text-xs hover:underline mt-1 block truncate">
                          {r.pr_url}
                        </a>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-3xl font-black text-white">{r.overall_score}%</div>
                        <p className="text-gray-500 text-xs">Overall Score</p>
                      </div>

                      {/* Accept Button */}
                      {canAcceptWinner && (
                        <div className="shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                          {confirmAcceptId === r.submission_id ? (
                            <div className="flex flex-col gap-1.5">
                              <button
                                onClick={() => handleAccept(r.submission_id)}
                                disabled={isBeingAccepted}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                              >
                                {isBeingAccepted ? (
                                  <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Accepting...</>
                                ) : (
                                  <>✅ Confirm</>
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmAcceptId(null)}
                                className="px-4 py-1.5 text-gray-500 hover:text-gray-300 text-xs rounded-lg transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmAcceptId(r.submission_id)}
                              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20 whitespace-nowrap"
                            >
                              ✅ Accept &amp; Select
                            </button>
                          )}
                        </div>
                      )}

                      <div className="text-gray-500 text-lg shrink-0">
                        {isExpanded ? "▲" : "▼"}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && report && (
                    <div className="px-6 pb-6 border-t border-white/5 pt-5 space-y-5">
                      {/* 4-Layer Scores */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {report.layers && Object.entries(report.layers).map(([key, layer]: [string, any]) => (
                          <div key={key} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="text-white text-sm font-semibold">{layer.label}</span>
                                <span className="text-white/20 text-xs ml-2 font-mono">{layer.model}</span>
                              </div>
                              <span className="text-white font-bold">{layer.score}%</span>
                            </div>
                            <ScoreBar score={layer.score} />
                            {layer.description && (
                              <p className="text-white/30 text-xs mt-2">{layer.description}</p>
                            )}
                            {layer.reasoning && (
                              <p className="text-white/50 text-xs mt-2 italic border-t border-white/5 pt-2">
                                💡 {layer.reasoning}
                              </p>
                            )}
                            {layer.summary && (
                              <p className="text-white/60 text-xs mt-2 border-t border-white/5 pt-2">
                                📝 {layer.summary}
                              </p>
                            )}
                            {/* Security findings */}
                            {layer.findings && layer.findings.length > 0 && (
                              <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
                                {layer.findings.map((f: any, i: number) => (
                                  <div key={i} className="flex items-start gap-2 text-xs">
                                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                                      f.severity === "HIGH" ? "bg-red-500/20 text-red-400" :
                                      f.severity === "MEDIUM" ? "bg-amber-500/20 text-amber-400" :
                                      "bg-blue-500/20 text-blue-400"
                                    }`}>{f.severity}</span>
                                    <span className="text-white/50">{f.message}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Documentation */}
                      {r.documentation && (
                        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                          <h4 className="text-sm font-semibold text-white mb-2">📝 Contributor Documentation</h4>
                          <p className="text-white/60 text-sm whitespace-pre-wrap">{r.documentation}</p>
                        </div>
                      )}

                      {/* Comments */}
                      {r.comments && (
                        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                          <h4 className="text-sm font-semibold text-white/70 mb-2">💬 Additional Comments</h4>
                          <p className="text-white/50 text-sm">{r.comments}</p>
                        </div>
                      )}

                      {/* GitHub Data */}
                      {report.github && (
                        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                          <h4 className="text-sm font-semibold text-white mb-2">🔗 GitHub Analysis</h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-gray-500">Issue:</span> <span className="text-white/70">{report.github.issue?.title}</span></div>
                            <div><span className="text-gray-500">PR:</span> <span className="text-white/70">{report.github.pr?.title}</span></div>
                            <div><span className="text-gray-500">Files Changed:</span> <span className="text-emerald-400">{report.github.pr?.files_changed}</span></div>
                            <div><span className="text-gray-500">Lines:</span> <span className="text-emerald-400">+{report.github.pr?.total_additions} / -{report.github.pr?.total_deletions}</span></div>
                            <div><span className="text-gray-500">PR Status:</span> <span className={report.github.pr?.merged ? "text-emerald-400" : "text-amber-400"}>{report.github.pr?.merged ? "Merged ✅" : report.github.pr?.state}</span></div>
                          </div>
                        </div>
                      )}

                      {/* Veto */}
                      {report.veto_applied && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                          ⚡ Veto Applied: {report.veto_reason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Additional ranks (4+) in compact form */}
            {displayRankings.length > 3 && (
              <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Other Submissions</h4>
                <div className="space-y-2">
                  {displayRankings.slice(3).map((r) => (
                    <div key={r.submission_id} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-600 font-mono w-8">#{r.rank}</span>
                      <span className="text-white/70 flex-1 truncate">{r.contributor_name}</span>
                      <span className="text-white font-bold">{r.overall_score}%</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        r.verdict === "PASS" ? "text-emerald-400" :
                        r.verdict === "WARN" ? "text-amber-400" : "text-red-400"
                      }`}>{r.verdict}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ───────── Confirmation Modal ───────── */}
      {confirmAcceptId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setConfirmAcceptId(null)}>
          <div className="bg-[#1a1a1b] border border-gray-700 rounded-2xl p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-xl font-bold text-white mb-2">Confirm Winner Selection</h3>
              <p className="text-gray-400 text-sm">
                This will mark <strong className="text-white">
                  {displayRankings?.find(r => r.submission_id === confirmAcceptId)?.contributor_name}
                </strong> as the winner. All other submissions will be rejected.
              </p>
              <p className="text-gray-500 text-xs mt-3">
                You will then need to go to GitHub and merge their PR.
                Once merged, the bounty payment can be processed.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAcceptId(null)}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAccept(confirmAcceptId)}
                disabled={!!acceptLoading}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
              >
                {acceptLoading ? "Accepting..." : "✅ Accept Winner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
