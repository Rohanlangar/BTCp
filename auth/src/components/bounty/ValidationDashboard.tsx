// src/components/bounty/ValidationDashboard.tsx
"use client";

import { useEffect, useState } from "react";

// ─── Type Definitions ────────────────────────────────────────

interface SecurityFinding {
  severity: string;
  message: string;
  rule: string;
}

interface LayerResult {
  score: number;
  model: string;
  layer: number;
  label: string;
  description: string;
  findings?: SecurityFinding[];
  metadata?: { lines_extracted: number; scanned_for_vulnerabilities: boolean };
  reasoning?: string;
  summary?: string;
}

interface ValidationReport {
  layers: {
    relevance: LayerResult;
    alignment: LayerResult;
    security: LayerResult;
    quality: LayerResult;
  };
  overall_score: number;
  verdict: "PASS" | "WARN" | "FAIL";
  veto_applied: boolean;
  veto_reason: string | null;
  github: {
    issue: { title: string; url: string };
    pr: {
      title: string;
      url: string;
      merged: boolean;
      state: string;
      files_changed: number;
      total_additions: number;
      total_deletions: number;
    };
  };
  validated_at: string;
}

// ─── Sub-Components ──────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  let classes: string;
  let label: string;
  if (score > 80) {
    classes = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    label = "PASS";
  } else if (score > 60) {
    classes = "bg-amber-500/20 text-amber-400 border-amber-500/30";
    label = "WARN";
  } else {
    classes = "bg-red-500/20 text-red-400 border-red-500/30";
    label = "FAIL";
  }
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${classes}`}>
      {label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score > 80 ? "bg-emerald-500" : score > 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

interface Props {
  bountyId: string;
  // Option A: Pass the report directly if you already have it
  report?: ValidationReport;
  // Option B: Let the component fetch it. Provide this if report is stored in DB.
  fetchUrl?: string;
}

export default function ValidationDashboard({ bountyId, report: initialReport, fetchUrl }: Props) {
  const [report, setReport] = useState<ValidationReport | null>(initialReport || null);
  const [loading, setLoading] = useState(!initialReport);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialReport) return;

    // Fetch validation results from the API or DB
    const url = fetchUrl || `/api/bounties/${bountyId}/validate`;

    async function fetchReport() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const data = await res.json();
        // If fetched from DB, the report is in ai_report_json
        setReport(data.ai_report_json ? JSON.parse(data.ai_report_json) : data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load results");
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [bountyId, fetchUrl, initialReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Running 4-layer ML validation...</p>
          <p className="text-white/30 text-xs">SBERT → CodeBERT → Bandit → Gemini</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <p className="text-red-400 font-medium">Validation Not Available</p>
        <p className="text-white/40 text-sm mt-1">{error || "No validation data found"}</p>
      </div>
    );
  }

  const layers = [
    report.layers.relevance,
    report.layers.alignment,
    report.layers.security,
    report.layers.quality,
  ];

  // Verdict styles
  const verdictConfig = {
    PASS: {
      border: "border-emerald-500/50",
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      icon: "✅",
      label: "VALIDATED & APPROVED",
    },
    WARN: {
      border: "border-amber-500/50",
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      icon: "⚠️",
      label: "NEEDS REVIEW",
    },
    FAIL: {
      border: "border-red-500/50",
      bg: "bg-red-500/10",
      text: "text-red-400",
      icon: "❌",
      label: "REJECTED",
    },
  };
  const v = verdictConfig[report.verdict];

  return (
    <div className="space-y-5">
      {/* ─── Section 1: Data Integrity Verification ─── */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
        <h3 className="text-amber-400 font-semibold text-xs uppercase tracking-widest mb-3">
          📋 Data Integrity Verification
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex gap-3">
            <span className="text-cyan-400 w-36 shrink-0 font-medium">Issue Title:</span>
            <span className="text-white/90 truncate">{report.github.issue.title}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-cyan-400 w-36 shrink-0 font-medium">PR Title:</span>
            <span className="text-white/90 truncate">{report.github.pr.title}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-cyan-400 w-36 shrink-0 font-medium">Analysis Content:</span>
            <span className="text-emerald-400 font-semibold">
              +{report.github.pr.total_additions} / -{report.github.pr.total_deletions} lines across{" "}
              {report.github.pr.files_changed} files
            </span>
          </div>
          <div className="flex gap-3">
            <span className="text-cyan-400 w-36 shrink-0 font-medium">PR Status:</span>
            <span className={report.github.pr.merged ? "text-emerald-400" : "text-amber-400"}>
              {report.github.pr.merged ? "✅ Merged" : `⏳ ${report.github.pr.state}`}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Section 2: 4-Layer Validation Table ─── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 bg-white/5">
          <h3 className="text-white font-semibold text-xs uppercase tracking-widest">
            🛡️ 4-Layer ML Validation Pipeline
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          {layers.map((layer) => (
            <div key={layer.layer} className="px-5 py-4 flex items-center gap-4">
              {/* Layer number */}
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 text-sm font-bold shrink-0">
                {layer.layer}
              </div>
              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium text-sm">{layer.label}</div>
                <div className="text-white/30 text-xs mt-0.5 font-mono">{layer.model}</div>
                <div className="mt-2">
                  <ScoreBar score={layer.score} />
                </div>
              </div>
              {/* Score */}
              <div className="text-white font-mono text-lg font-bold w-16 text-right shrink-0">
                {layer.score}%
              </div>
              {/* Badge */}
              <div className="w-20 flex justify-center shrink-0">
                <ScoreBadge score={layer.score} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Section 3: AI Summary (Gemini) ─── */}
      {report.layers.quality.summary && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5">
          <h3 className="text-blue-400 font-semibold text-xs uppercase tracking-widest mb-2">
            🤖 AI Summary (Gemini 2.0 Flash)
          </h3>
          <p className="text-white/80 text-sm leading-relaxed">{report.layers.quality.summary}</p>
          {report.layers.quality.reasoning && (
            <p className="text-white/40 text-xs mt-3 italic border-t border-white/5 pt-3">
              {report.layers.quality.reasoning}
            </p>
          )}
        </div>
      )}

      {/* ─── Section 4: Security Findings (if any) ─── */}
      {report.layers.security.findings && report.layers.security.findings.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
          <h3 className="text-red-400 font-semibold text-xs uppercase tracking-widest mb-3">
            🔒 Security Findings ({report.layers.security.findings.length})
          </h3>
          <div className="space-y-2">
            {report.layers.security.findings.map((finding, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${
                    finding.severity === "HIGH"
                      ? "bg-red-500/20 text-red-400"
                      : finding.severity === "MEDIUM"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-blue-500/20 text-blue-400"
                  }`}
                >
                  {finding.severity}
                </span>
                <span className="text-white/70">{finding.message}</span>
                <span className="text-white/20 ml-auto shrink-0 font-mono text-xs">
                  {finding.rule}
                </span>
              </div>
            ))}
          </div>
          {report.layers.security.metadata && (
            <p className="text-white/20 text-xs mt-3 border-t border-white/5 pt-2">
              Scanned {report.layers.security.metadata.lines_extracted} lines of added code
            </p>
          )}
        </div>
      )}

      {/* ─── Section 5: Final Verdict ─── */}
      <div className={`rounded-xl border-2 ${v.border} ${v.bg} p-6 text-center`}>
        <div className="text-5xl mb-3">{v.icon}</div>
        <div className="text-white font-mono text-4xl font-bold mb-2">
          {report.overall_score}%
        </div>
        <div className={`text-lg font-bold ${v.text} mb-1`}>{v.label}</div>
        {report.veto_applied && (
          <p className="text-red-400/70 text-sm mt-2">⚡ Veto: {report.veto_reason}</p>
        )}
        <p className="text-white/20 text-xs mt-3">
          Validated at {new Date(report.validated_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
