"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const ConnectWallet = dynamic(
  () => import("@/components/wallet/ConnectWallet").then((mod) => mod.ConnectWallet),
  { ssr: false }
);

export default function ConnectWalletPage() {

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px]" />

      <div className="max-w-md w-full bg-gray-900/50 border border-gray-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center relative z-10">
        <div className="w-16 h-16 bg-gradient-to-br from-[#ffee55] to-[#f59e0b] rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-yellow-500/20">
          <span className="text-3xl text-black">🔗</span>
        </div>
        <h1 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#ffee55] to-[#f59e0b]">
          Connect Wallet
        </h1>
        <p className="text-gray-400 mb-8 text-center text-sm font-medium">
          To finalize your account securely, connect your Pera Wallet to lock or receive ALGO rewards.
        </p>

        {/* This will render their beautiful QR Code modal automatically! */}
        <ConnectWallet />
        
        <Link 
          href="/dashboard"
          className="mt-8 text-sm font-semibold py-3 px-6 bg-white/10 hover:bg-white/20 rounded-xl transition-all w-full text-center"
        >
          Continue to Dashboard →
        </Link>
      </div>
    </div>
  );
}
