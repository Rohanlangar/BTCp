"use client";

import { useState, useEffect } from "react";

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
}: {
  bountyId: string;
  initialSubmissions: Submission[];
}) {
  const [submissions] = useState(initialSubmissions);
  const [rankings, setRankings] = useState<RankedResult[] | null>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState<string | null>(null);
  const [expandedRank, setExpandedRank] = useState<number | null>(null);
  const [isMlOffline, setIsMlOffline] = useState<boolean | null>(null);

  // Check health on mount
  useEffect(() => {
    fetch("/api/bounties/health").then(res => res.json()).then(data => {
      setIsMlOffline(!data.ml_online);
    }).catch(() => setIsMlOffline(true));
  }, []);

  // Check if ML has already run (submissions have scores)
  const hasExistingScores = submissions.some(s => s.ai_quality_score != null && s.rank != null);

  // Build rankings from existing data if available
  const existingRankings: RankedResult[] | null = hasExistingScores
    ? submissions
        .filter(s => s.ai_quality_score != null)
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
        .map(s => ({
          submission_id: s.id,
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

  return (
    <div>
      {/* Submissions List */}
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
            {submissions.map((s) => (
              <div key={s.id} className="bg-gray-900/40 border border-gray-800 rounded-xl p-5">
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
            ))}
          </div>
        )}
      </section>

      {/* ML Pipeline Launcher */}
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
                disabled={mlLoading}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20 whitespace-nowrap"
              >
                {mlLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing {submissions.length} PRs...
                  </span>
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

      {/* Rankings Display — Top 3 */}
      {displayRankings && displayRankings.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
            <span className="w-6 h-6 bg-yellow-500/20 rounded-md flex items-center justify-center text-yellow-400 text-xs">🏆</span>
            ML Rankings — Top Contributors
          </h2>

          <div className="space-y-4">
            {displayRankings.slice(0, 3).map((r) => {
              const config = RANK_CONFIG[r.rank] || RANK_CONFIG[3];
              const isExpanded = expandedRank === r.rank;
              const report = r.report;

              return (
                <div key={r.submission_id} className={`border ${config.border} ${config.bg} rounded-2xl overflow-hidden transition-all`}>
                  {/* Rank Header */}
                  <div
                    className="p-6 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpandedRank(isExpanded ? null : r.rank)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{config.badge}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`text-sm font-bold ${config.text}`}>{config.label}</span>
                          <span className="font-bold text-white text-lg">{r.contributor_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                            r.verdict === "PASS" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                            r.verdict === "WARN" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                            "bg-red-500/20 text-red-400 border-red-500/30"
                          }`}>
                            {r.verdict}
                          </span>
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
    </div>
  );
}
