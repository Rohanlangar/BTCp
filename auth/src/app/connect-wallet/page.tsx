"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConnectWalletPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");

  const handleWalletConnect = async () => {
    setLoading(true);
    try {
      // Assuming Pera Wallet or similar wallet integration.
      // If you are using @perawallet/connect or @txnlab/use-wallet-react,
      // trigger the sign process here, get the address, and save it.
      
      const addressToSave = walletAddress || "MOCKADDRESSOFLENGTH5800000000000000000000000000000000000"; // 58 chars Mock
      
      const res = await fetch("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: addressToSave }),
      });

      if (res.ok) {
        // We push to /dashboard and the middleware will redirect appropriately
        router.push("/dashboard"); 
      } else {
        console.error("Failed to connect wallet via API");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
        <div className="text-5xl mb-6">🔗</div>
        <h1 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#ffee55] to-[#f59e0b]">
          Connect Wallet
        </h1>
        <p className="text-gray-400 mb-8">
          To finalize your account securely, connect your Pera Wallet to lock or receive ALGO rewards.
        </p>

        {/* Temporary input to simulate connecting. Replace with real Pera SDK button */}
        <input 
          type="text"
          placeholder="Paste real Pera Wallet here (or mock one will be used)"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          className="w-full p-4 mb-4 rounded-lg bg-black border border-gray-800 text-white focus:outline-none focus:border-[#ffee55] transition-colors"
        />
        
        <button
          onClick={handleWalletConnect}
          disabled={loading}
          className="w-full py-4 px-6 bg-[#ffee55] hover:bg-[#e6d64c] text-black font-bold rounded-xl transition-all duration-300 text-lg shadow-[0_0_20px_rgba(255,238,85,0.3)] hover:shadow-[0_0_30px_rgba(255,238,85,0.5)]"
        >
          {loading ? "Connecting..." : "Connect Pera Wallet"}
        </button>
      </div>
    </div>
  );
}
