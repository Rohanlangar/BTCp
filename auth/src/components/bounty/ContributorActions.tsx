"use client";

import { useState } from "react";
import { SubmitWorkModal } from "@/components/bounty/SubmitWorkModal";
import { useRouter } from "next/navigation";

// ─── Participate Button ──────────────────────────────────────
export function ParticipateButton({ bountyId }: { bountyId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleParticipate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bounties/participate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to participate");
      setDone(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="w-full py-2.5 bg-cyan-500/10 text-cyan-400 font-semibold rounded-xl text-sm text-center border border-cyan-500/20">
        ✓ Participating
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleParticipate}
        disabled={loading}
        className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-blue-900/20 disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Joining...
          </span>
        ) : (
          "Participate in Bounty →"
        )}
      </button>
      {error && <p className="text-red-400 text-xs mt-1.5 text-center">{error}</p>}
    </div>
  );
}

// ─── Submit Work Button (opens modal) ────────────────────────
export function SubmitWorkButton({ bountyId, bountyTitle }: { bountyId: string; bountyTitle: string }) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm w-full md:w-auto"
      >
        Submit Work →
      </button>
      {showModal && (
        <SubmitWorkModal
          bountyId={bountyId}
          bountyTitle={bountyTitle}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
