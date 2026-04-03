"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChooseRolePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRoleSelection = async (role: "admin" | "contributor") => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, roleSelected: true }),
      });

      if (res.ok) {
        router.push("/connect-wallet");
      } else {
        console.error("Failed to update role");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-4 selection:bg-purple-500">
          How do you want to use <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">BountyChain</span>?
        </h1>
        <p className="text-gray-400 text-center mb-12 text-lg">
          Select your primary identity. You can always create a second account if you want to switch roles later.
        </p>
        
        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => handleRoleSelection("admin")}
            disabled={loading}
            className="group relative flex flex-col items-center p-8 rounded-2xl border border-gray-800 bg-gray-900/50 hover:bg-gray-800/80 transition-all duration-300 hover:scale-105 hover:border-purple-500/50"
          >
            <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">🏢</div>
            <h2 className="text-2xl font-bold mb-2">Admin</h2>
            <p className="text-gray-400 text-center">I want to POST bounties and manage developer submissions.</p>
          </button>
          
          <button
            onClick={() => handleRoleSelection("contributor")}
            disabled={loading}
            className="group relative flex flex-col items-center p-8 rounded-2xl border border-gray-800 bg-gray-900/50 hover:bg-gray-800/80 transition-all duration-300 hover:scale-105 hover:border-pink-500/50"
          >
            <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">👨‍💻</div>
            <h2 className="text-2xl font-bold mb-2">Contributor</h2>
            <p className="text-gray-400 text-center">I want to WORK on bounties and earn crypto rewards.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
