"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useBountyContracts, DeployStep } from "@/hooks/useBountyContracts";

export function PostBountyForm() {
  const { createBounty, isConnected } = useBountyContracts();
  const { activeAddress } = useWallet();
  
  const [issueUrl, setIssueUrl] = useState("");
  const [rewardAmount, setRewardAmount] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState<DeployStep>("IDLE");
  
  const [deploySuccess, setDeploySuccess] = useState<{
    escrowAppId: number;
    bountyId: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueUrl || rewardAmount <= 0) {
      setError("Please provide a valid issue URL and reward amount.");
      return;
    }

    if (!isConnected) {
      setError("Please connect your wallet first.");
      return;
    }

    setError(null);
    setIsDeploying(true);
    setDeploySuccess(null);
    setDeployStep("IDLE");

    try {
      const result = await createBounty(issueUrl, rewardAmount, (step) => {
        setDeployStep(step);
      });
      setDeploySuccess(result);
      setIssueUrl("");
      setRewardAmount(1);
    } catch (err: any) {
      console.error("Failed to post bounty:", err);
      setError(err?.message || "An error occurred while posting the bounty.");
      setDeployStep("ERROR");
    } finally {
      setIsDeploying(false);
    }
  };

  if (!mounted) {
    return (
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6 border border-white/50 text-center flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6 border border-white/50 text-center">
        <p className="text-gray-600">Connect your wallet to post a bounty.</p>
      </div>
    );
  }

  // Helper to render deploy step UI
  const getStepMessage = () => {
    switch(deployStep) {
      case "COMPILING": return "Compiling TEAL programs...";
      case "DEPLOYING": return "Check Pera Wallet: Sign Escrow Deployment...";
      case "FUNDING": return "Check Pera Wallet: Sign MBR Funding (0.3 ALGO)...";
      case "REGISTERING": return "Check Pera Wallet: Sign Registry Link...";
      case "DEPOSITING": return "Check Pera Wallet: Sign Reward Deposit...";
      case "SUCCESS": return "Syncing with Database...";
      default: return "Create Escrow & Lock Bounty";
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-8 border border-white/50 relative overflow-hidden">
      {/* Connected Wallet Indicator */}
      <div className="mb-8 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-blue-600 font-bold">Connected Wallet</span>
          <span className="text-sm font-mono text-gray-700 truncate max-w-[200px] md:max-w-none">
            {activeAddress}
          </span>
        </div>
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
      </div>

      <h3 className="text-2xl font-bold text-gray-900 mb-6">Post a New Bounty</h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="issueUrl" className="block text-sm font-medium text-gray-700 mb-1">
            GitHub Issue URL
          </label>
          <input
            type="url"
            id="issueUrl"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors dark:text-gray-900"
            placeholder="https://github.com/org/repo/issues/123"
            value={issueUrl}
            onChange={(e) => setIssueUrl(e.target.value)}
            required
            disabled={isDeploying}
          />
        </div>

        <div>
          <label htmlFor="rewardAmount" className="block text-sm font-medium text-gray-700 mb-1">
            Reward Amount (ALGO)
          </label>
          <div className="relative">
            <input
              type="number"
              id="rewardAmount"
              min="0.1"
              step="0.1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors dark:text-gray-900 font-bold"
              value={rewardAmount}
              onChange={(e) => setRewardAmount(parseFloat(e.target.value))}
              required
              disabled={isDeploying}
            />
            <div className="absolute right-4 top-2 text-gray-500 font-medium">
              ALGO
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <strong>Blockchain Requirement:</strong> Creating a bounty requires locking approximately <strong>0.61 ALGO</strong> for network storage schema + fees. Total spendable ALGO needed: <strong>{(rewardAmount + 0.614).toFixed(3)} ALGO</strong>.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {deploySuccess && (
          <div className="p-4 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200">
            <p className="font-bold mb-2">✅ Bounty posted successfully!</p>
            <div className="space-y-1">
              <p>Escrow App ID: <strong>{deploySuccess.escrowAppId}</strong></p>
              <p>Registry Index: <strong>{deploySuccess.bountyId}</strong></p>
            </div>
            <a 
              href={`https://testnet.explorer.perawallet.app/application/${deploySuccess.escrowAppId}/`}
              target="_blank" 
              rel="noreferrer"
              className="mt-3 inline-block text-blue-600 font-medium hover:underline"
            >
              View on Pera Explorer →
            </a>
          </div>
        )}

        <button
          type="submit"
          disabled={isDeploying}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-80 shadow-md"
        >
          {isDeploying ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              {getStepMessage()}
            </span>
          ) : (
            getStepMessage()
          )}
        </button>
      </form>
    </div>
  );
}
