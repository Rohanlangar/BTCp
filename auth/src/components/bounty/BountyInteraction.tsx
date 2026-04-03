"use client";

import { useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { authClient } from "@/lib/auth-client";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { useBountyContracts } from "@/hooks/useBountyContracts";
import { useRouter } from "next/navigation";

export function BountyInteraction({ bounty }: { bounty: any }) {
  const { activeAddress } = useWallet();
  const { data: session } = authClient.useSession();
  const { claimBounty, submitWork, loading, error, successMsg } = useBountyContracts();
  const router = useRouter();

  const [prUrl, setPrUrl] = useState("");
  const [localError, setLocalError] = useState("");

  if (!session?.user) {
    return (
      <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 text-center">
        <h3 className="text-white font-medium mb-4">Please log in to interact with this bounty</h3>
      </div>
    );
  }

  if (!activeAddress) {
    return (
      <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
        <h3 className="text-white font-medium mb-4 text-center">Connect your Algorand Wallet to continue</h3>
        <ConnectWallet />
      </div>
    );
  }

  const handleClaim = async () => {
    setLocalError("");
    try {
      await claimBounty(bounty.id, bounty.escrowAppId, bounty.registryBountyId);
      // Wait a moment for on-chain status to sync DB and then refresh the page
      setTimeout(() => {
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  const handleSubmitWork = async () => {
    setLocalError("");
    if (!prUrl.includes("github.com") && !prUrl.includes("pull")) {
      setLocalError("Please provide a valid GitHub Pull Request URL");
      return;
    }
    
    try {
      await submitWork(bounty.id, bounty.escrowAppId, bounty.registryBountyId, prUrl);
      setTimeout(() => {
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  return (
    <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 md:p-8 mt-4">
      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm break-words">
          {error}
        </div>
      )}
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

      {/* State Machine UI based on Bounty Status */}
      {bounty.status === "OPEN" && (
        <div className="text-center">
          <h3 className="text-xl font-bold text-white mb-2">Ready to contribute?</h3>
          <p className="text-slate-400 mb-6 max-w-sm mx-auto">
            Claiming this bounty locks it securely to your wallet on the Algorand blockchain.
          </p>
          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full md:w-auto px-8 py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-amber-950 font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]"
          >
            {loading ? "Locking Bounty On-Chain..." : "Lock & Claim Bounty"}
          </button>
        </div>
      )}

      {bounty.status === "CLAIMED" && bounty.contributorId === session.user.id && (
        <div>
          <h3 className="text-xl font-bold text-amber-400 mb-2">You claimed this bounty!</h3>
          <p className="text-slate-400 mb-6">
            Fork the repository, complete the fix, and submit the link to your Pull Request below.
          </p>
          
          <div className="flex flex-col gap-4">
            <input
              type="url"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              placeholder="https://github.com/owner/repo/pull/123"
              className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSubmitWork}
              disabled={loading || !prUrl}
              className="w-full px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)]"
            >
              {loading ? "Submitting Work On-Chain..." : "Submit Pull Request"}
            </button>
          </div>
        </div>
      )}

      {bounty.status === "CLAIMED" && bounty.contributorId !== session.user.id && (
        <div className="text-center p-4">
          <h3 className="text-white font-medium mb-1">This bounty is actively being worked on</h3>
          <p className="text-slate-400 text-sm">Someone else has claimed this interface. Check back later.</p>
        </div>
      )}

      {bounty.status === "SUBMITTED" && bounty.creatorId === session.user.id && (
        <div className="text-center">
          <h3 className="text-xl font-bold text-blue-400 mb-2">Work Submitted!</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            The contributor has submitted a Pull Request. Review their work, and once it is merged, you can settle this bounty from your Creator Dashboard to pay them out instantly.
          </p>
          <a
            href={bounty.prUrl}
            target="_blank"
            className="inline-block px-8 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium rounded-xl transition-all"
          >
            Review Pull Request &rarr;
          </a>
        </div>
      )}

      {bounty.status === "SUBMITTED" && bounty.contributorId === session.user.id && (
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Work successfully submitted</h3>
          <p className="text-slate-400 mb-2 text-sm max-w-sm mx-auto">
            Your PR rests warmly on the blockchain! The creator will review your work. Once merged, the smart contract will automatically securely disburse the reward to your wallet.
          </p>
        </div>
      )}

      {bounty.status === "SETTLED" && (
        <div className="text-center p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mb-3">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Bounty Successfully Settled</h3>
          <p className="text-slate-400 text-sm">
            This bounty cycle is complete. The fix was merged and the reward ALGO was automatically paid out to the contributor's wallet.
          </p>
        </div>
      )}
    </div>
  );
}
