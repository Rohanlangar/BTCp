"use client";

import { useState } from "react";

interface SubmitWorkModalProps {
  bountyId: string;
  bountyTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function SubmitWorkModal({ bountyId, bountyTitle, onClose, onSuccess }: SubmitWorkModalProps) {
  const [prUrl, setPrUrl] = useState("");
  const [documentation, setDocumentation] = useState("");
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!prUrl.includes("github.com") || !prUrl.includes("/pull/")) {
      setError("Please provide a valid GitHub Pull Request URL (e.g., https://github.com/owner/repo/pull/123)");
      return;
    }

    if (!documentation || documentation.trim().length < 10) {
      setError("Documentation is required (minimum 10 characters). Describe your approach and changes.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/bounties/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId, prUrl, documentation, comments: comments || null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to submit work");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Submit Your Work</h2>
              <p className="text-white/40 text-sm mt-1 truncate max-w-md">{bountyTitle}</p>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* PR URL — Required */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Pull Request URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              placeholder="https://github.com/owner/repo/pull/123"
              required
              disabled={loading}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all disabled:opacity-50"
            />
            <p className="text-white/30 text-xs mt-1.5">Link to your GitHub Pull Request</p>
          </div>

          {/* Documentation — Required */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Documentation <span className="text-red-400">*</span>
            </label>
            <textarea
              value={documentation}
              onChange={(e) => setDocumentation(e.target.value)}
              placeholder="Describe your approach, what changes you made, how they solve the issue, and any relevant technical details..."
              required
              rows={5}
              disabled={loading}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all resize-none disabled:opacity-50"
            />
            <p className="text-white/30 text-xs mt-1.5">Explain your solution approach and any design decisions (min 10 chars)</p>
          </div>

          {/* Comments — Optional */}
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-2">
              Additional Comments <span className="text-white/20">(optional)</span>
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Any additional notes, edge cases handled, or questions for the reviewer..."
              rows={3}
              disabled={loading}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all resize-none disabled:opacity-50"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/60 font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !prUrl || !documentation}
              className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/30"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : (
                "Submit Work →"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
