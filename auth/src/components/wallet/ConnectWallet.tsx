"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useWalletLinking } from "@/hooks/useWalletLinking";

/**
 * ConnectWallet — Real Pera Wallet connection via popup.
 *
 * Uses @txnlab/use-wallet-react to open the native Pera Wallet popup.
 * After the user connects via Pera, the wallet address is automatically
 * captured and linked to their account via the existing API.
 *
 * No more manual address pasting!
 */
interface ConnectWalletProps {
  onLinked?: () => void;
}

export function ConnectWallet({ onLinked }: ConnectWalletProps = {}) {
  const { wallets, activeAddress } = useWallet();
  const { linkWallet } = useWalletLinking();
  const [isLinking, setIsLinking] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Find the Pera Wallet instance
  const peraWallet = wallets?.[0]; // First wallet = PeraWallet

  const handleConnect = useCallback(async () => {
    if (!peraWallet) {
      setMessage({ type: "error", text: "Pera Wallet not available" });
      return;
    }

    try {
      setMessage(null);
      await peraWallet.connect();
    } catch (error) {
      console.error("Wallet connection error:", error);
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Failed to connect wallet",
      });
    }
  }, [peraWallet]);

  const handleDisconnect = useCallback(async () => {
    if (!peraWallet) return;

    try {
      await peraWallet.disconnect();
      setMessage(null);
    } catch (error) {
      console.error("Wallet disconnect error:", error);
    }
  }, [peraWallet]);

  const handleLinkWallet = useCallback(async () => {
    if (!activeAddress) {
      setMessage({ type: "error", text: "No wallet connected" });
      return;
    }

    setIsLinking(true);
    try {
      const result = await linkWallet(activeAddress);
      if (result.success) {
        setMessage({
          type: "success",
          text: `✅ Wallet linked! Redirecting to dashboard...`,
        });
        // Auto-redirect after short delay so user sees the success message
        if (onLinked) {
          setTimeout(onLinked, 1500);
        }
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to link wallet",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to link wallet",
      });
    } finally {
      setIsLinking(false);
    }
  }, [activeAddress, linkWallet]);

  const truncateAddress = (addr: string) =>
    `${addr.substring(0, 6)}...${addr.substring(addr.length - 6)}`;

  return (
    <div className="w-full">
      {activeAddress ? (
        /* ═══ CONNECTED STATE ═══ */
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-300 rounded-xl p-6 space-y-4">
          {/* Connection indicator */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-green-900">Pera Wallet Connected</p>
              <p className="text-sm text-green-700">
                Ready to sign transactions
              </p>
            </div>
          </div>

          {/* Address display */}
          <div className="bg-white/70 backdrop-blur rounded-lg p-4 border border-green-200/50">
            <p className="text-xs font-medium text-green-700 mb-1 uppercase tracking-wider">
              Active Address
            </p>
            <p className="font-mono text-sm text-green-900 break-all">
              {activeAddress}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleLinkWallet}
              disabled={isLinking}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {isLinking ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  Linking...
                </>
              ) : (
                <>🔗 Link to Account</>
              )}
            </button>

            <button
              onClick={handleDisconnect}
              className="px-4 py-3 bg-white text-red-600 border-2 border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 font-medium transition-all duration-200"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        /* ═══ DISCONNECTED STATE ═══ */
        <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-xl p-6 space-y-5">
          {/* Pera logo / branding */}
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-yellow-200/50">
              <span className="text-3xl">🔐</span>
            </div>
            <h4 className="text-lg font-bold text-gray-900 mb-1">
              Connect Your Wallet
            </h4>
            <p className="text-sm text-gray-600">
              Use Pera Wallet to securely sign transactions
            </p>
          </div>

          {/* Connect button */}
          <button
            onClick={handleConnect}
            className="w-full px-6 py-4 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 hover:from-yellow-500 hover:via-yellow-600 hover:to-amber-600 text-gray-900 rounded-xl font-bold text-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-yellow-300/30 flex items-center justify-center gap-3 transform hover:scale-[1.02]"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            Connect Pera Wallet
          </button>

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200/60 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-semibold mb-2">
              💡 Getting Started
            </p>
            <ol className="text-sm text-blue-800 space-y-1.5 ml-4 list-decimal">
              <li>
                Install the{" "}
                <a
                  href="https://perawallet.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline hover:text-blue-700"
                >
                  Pera Wallet
                </a>{" "}
                browser extension
              </li>
              <li>
                Create a wallet and switch to <strong>TestNet</strong>
              </li>
              <li>Click &quot;Connect Pera Wallet&quot; above</li>
              <li>Approve the connection in the Pera popup</li>
            </ol>
          </div>
        </div>
      )}

      {/* Status message */}
      {message && (
        <div
          className={`mt-4 p-4 rounded-lg font-medium transition-all duration-300 ${
            message.type === "success"
              ? "bg-green-100 text-green-800 border border-green-300"
              : "bg-red-100 text-red-800 border border-red-300"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
