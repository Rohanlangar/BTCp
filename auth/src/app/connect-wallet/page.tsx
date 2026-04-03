"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const ConnectWallet = dynamic(
  () => import("@/components/wallet/ConnectWallet").then((mod) => mod.ConnectWallet),
  { ssr: false }
);

export default function ConnectWalletPage() {
  const router = useRouter();

  // Called automatically 1.5s after successful wallet linking
  const handleLinked = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full bg-gray-900/50 border border-gray-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center relative z-10">
        <div className="w-16 h-16 bg-gradient-to-br from-[#ffee55] to-[#f59e0b] rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-yellow-500/20">
          <span className="text-3xl">🔗</span>
        </div>
        <h1 className="text-3xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-[#ffee55] to-[#f59e0b]">
          Connect Wallet
        </h1>
        <p className="text-gray-400 mb-8 text-center text-sm">
          Connect your Pera Wallet to lock or receive ALGO rewards. You will be redirected automatically.
        </p>

        {/* Real Pera Wallet — auto-redirects on success via onLinked */}
        <ConnectWallet onLinked={handleLinked} />

        {/* Manual fallback link */}
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-6 text-xs text-gray-600 hover:text-gray-400 transition-colors underline"
        >
          Skip for now → Continue to Dashboard
        </button>
      </div>
    </div>
  );
}
