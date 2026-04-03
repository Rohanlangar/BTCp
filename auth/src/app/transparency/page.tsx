// src/app/transparency/page.tsx
// Public Transparency Dashboard Page

import React from "react";
import { TransparencyStats } from "@/components/transparency/TransparencyStats";
import { TransparencyTable } from "@/components/transparency/TransparencyTable";
import Link from "next/link";

async function getTransparencyData() {
  // Use absolute URL for server-side fetch in Next.js
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/public/transparency`, {
    cache: "no-store", // Ensure real-time data
  });
  
  if (!res.ok) {
     return { summary: { live_count: 0, closed_count: 0, total_algo_locked: 0, total_participants: 0 }, bounties: [] };
  }
  
  return res.json();
}

export default async function TransparencyPage() {
  const data = await getTransparencyData();
  const { summary, bounties } = data;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 lg:p-16">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <header className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
               <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-medium group">
                 <span className="text-lg opacity-50 group-hover:opacity-100 transition-opacity">←</span>
                 Back to Marketplace
               </Link>
               <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent">
                  Transparency <br />
                  <span className="text-blue-500">Dashboard</span>
               </h1>
               <p className="text-white/40 max-w-xl text-lg leading-relaxed">
                  Real-time visibility into the BountyChain ecosystem. No accounts, no wallets — just pure, verifiable data on every active project.
               </p>
            </div>
            
            <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-2xl p-4 backdrop-blur-xl">
               <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
               </div>
               <div>
                  <div className="text-sm font-bold text-white">Live System Status</div>
                  <div className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Synced with Algorand TestNet</div>
               </div>
            </div>
          </div>
        </header>

        {/* Aggregate Stats */}
        <TransparencyStats summary={summary} />

        {/* Detailed Projects Board */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <span className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-white/40 text-sm">📁</span>
              Bounty Projects & Activity
            </h2>
            <div className="text-xs text-white/20 font-mono">Showing {bounties.length} entries</div>
          </div>
          
          <TransparencyTable bounties={bounties} />
        </div>

        {/* Footer info */}
        <footer className="mt-16 pt-8 border-t border-white/5 text-center">
           <p className="text-white/20 text-xs flex items-center justify-center gap-2">
             <span>🛡️ Stateless Transparency Module</span>
             <span className="opacity-40">•</span>
             <span>Decentralized Data Engine v1.0</span>
           </p>
        </footer>

      </div>
    </div>
  );
}
