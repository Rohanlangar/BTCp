"use client";

import { useState } from "react";
import { useBountyContracts } from "@/hooks/useBountyContracts";

export function PostBountyForm() {
  const { createBounty, isConnected } = useBountyContracts();
  
  const [issueUrl, setIssueUrl] = useState("");
  const [rewardAmount, setRewardAmount] = useState(1); // 1 ALGO default
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<{
    escrowAppId: number;
    bountyId: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    try {
      // By default REGISTRY_APP_ID is 0 in algorand.ts until deployed
      // It will just deploy Escrow + Fund MBR + Deposit Reward.
      const result = await createBounty(issueUrl, rewardAmount);
      setDeploySuccess(result);
      setIssueUrl("");
      setRewardAmount(1);
    } catch (err: any) {
      console.error("Failed to post bounty:", err);
      setError(err?.message || "An error occurred while posting the bounty.");
    } finally {
      setIsDeploying(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6 border border-white/50 text-center">
        <p className="text-gray-600">Connect your wallet to post a bounty.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-8 border border-white/50">
      <h3 className="text-2xl font-bold text-gray-900 mb-6">Post a New Bounty</h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Issue URL */}
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

        {/* Reward Amount */}
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors dark:text-gray-900"
              value={rewardAmount}
              onChange={(e) => setRewardAmount(parseFloat(e.target.value))}
              required
              disabled={isDeploying}
            />
            <div className="absolute right-4 top-2 text-gray-500 font-medium">
              ALGO
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            An additional 0.2 ALGO Minimum Balance Requirement (MBR) will be temporarily locked in the escrow contract.
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {deploySuccess && (
          <div className="p-4 bg-green-50 justify-between text-green-700 rounded-lg text-sm border border-green-200">
            <p className="font-bold mb-1">✅ Bounty posted successfully!</p>
            <p>Escrow App ID: <strong>{deploySuccess.escrowAppId}</strong></p>
            {deploySuccess.bountyId > 0 && (
              <p>Registry Index: <strong>{deploySuccess.bountyId}</strong></p>
            )}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isDeploying}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-md"
        >
          {isDeploying ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Deploying Escrow & Funding...
            </span>
          ) : (
            "Create Escrow & Lock Bounty"
          )}
        </button>
      </form>
    </div>
  );
}
