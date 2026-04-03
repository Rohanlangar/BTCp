"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { SubmitWorkModal } from "@/components/bounty/SubmitWorkModal";
import { useRouter } from "next/navigation";

export function BountyInteraction({ bounty }: { bounty: any }) {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [hasParticipated, setHasParticipated] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check participation status on mount
  useEffect(() => {
    if (!session?.user) {
      setCheckingStatus(false);
      return;
    }

    async function checkStatus() {
      try {
        // Check if contributor has participated and/or submitted
        const res = await fetch(`/api/bounties/${bounty.id}/submissions`);
        if (res.ok) {
          const data = await res.json();
          const mySub = data.submissions?.find((s: any) => s.contributor_id === session?.user?.id);
          if (mySub) {
            setHasParticipated(true);
            setHasSubmitted(true);
          }
        }
      } catch { /* ignore */ }
      setCheckingStatus(false);
    }

    checkStatus();
  }, [bounty.id, session?.user?.id]);

  if (!session?.user) {
    return (
      <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 text-center">
        <h3 className="text-white font-medium mb-4">Please log in to interact with this bounty</h3>
      </div>
    );
  }

  const handleParticipate = async () => {
    setLoading(true);
    setLocalError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/bounties/participate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: bounty.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to participate");

      setHasParticipated(true);
      setSuccessMsg("You're now participating in this bounty! Submit your PR when ready.");
      router.refresh();
    } catch (err: any) {
      setLocalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 md:p-8 mt-4">
      {/* Messages */}
      {localError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm break-words">
          {localError}
        </div>
      )}
      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium text-center">
          {successMsg}
        </div>
      )}

      {checkingStatus ? (
        <div className="flex items-center justify-center p-8">
          <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* OPEN — Participate */}
          {bounty.status === "OPEN" && !hasParticipated && (
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-2">Ready to contribute?</h3>
              <p className="text-slate-400 mb-6 max-w-sm mx-auto">
                Join this bounty to start working on it. Multiple contributors can participate — the best submission wins!
              </p>
              <button
                onClick={handleParticipate}
                disabled={loading}
                className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]"
              >
                {loading ? "Joining..." : "Participate in Bounty →"}
              </button>
              <p className="text-slate-600 text-xs mt-3">No wallet transaction required — just join and start coding!</p>
            </div>
          )}

          {/* OPEN — Already participating, can submit */}
          {bounty.status === "OPEN" && hasParticipated && !hasSubmitted && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/20 text-cyan-400 mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">You&apos;re participating!</h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                Fork the repository, solve the issue, and submit your Pull Request along with documentation of your approach.
              </p>
              <button
                onClick={() => setShowSubmitModal(true)}
                className="w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)]"
              >
                Submit Your Work →
              </button>
            </div>
          )}

          {/* Already submitted */}
          {hasSubmitted && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Work Submitted!</h3>
              <p className="text-slate-400 mb-2 text-sm max-w-sm mx-auto">
                Your submission is in! The admin will run the ML validation pipeline to compare and rank all submissions.
              </p>
            </div>
          )}

          {/* SUBMITTED/UNDER_REVIEW — Creator view */}
          {bounty.status === "SUBMITTED" && bounty.creatorId === session.user.id && (
            <div className="text-center">
              <h3 className="text-xl font-bold text-blue-400 mb-2">Submissions Under Review</h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                Contributors have submitted their work. Visit the Activity page to launch the ML pipeline and review ranked submissions.
              </p>
              <a
                href={`/dashboard/admin/bounty/${bounty.id}`}
                className="inline-block px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-all"
              >
                View Activity & Run ML →
              </a>
            </div>
          )}

          {/* SETTLED */}
          {bounty.status === "SETTLED" && (
            <div className="text-center p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Bounty Successfully Settled</h3>
              <p className="text-slate-400 text-sm">
                This bounty is complete. The winning contributor has been paid.
              </p>
            </div>
          )}
        </>
      )}

      {/* Submit Modal */}
      {showSubmitModal && (
        <SubmitWorkModal
          bountyId={bounty.id}
          bountyTitle={bounty.issueTitle || "Bounty"}
          onClose={() => setShowSubmitModal(false)}
          onSuccess={() => {
            setShowSubmitModal(false);
            setHasSubmitted(true);
            setSuccessMsg("Work submitted successfully! The admin will review all submissions.");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
