// src/components/transparency/TransparencyStats.tsx
// Public Transparency Dashboard Statistics Cards

import React from "react";

interface TransparencySummary {
  live_count: number;
  closed_count: number;
  total_algo_locked: number;
  total_participants: number;
}

export function TransparencyStats({ summary }: { summary: TransparencySummary }) {
  const stats = [
    { 
      label: "Live Bounties", 
      value: summary.live_count, 
      sub: "Active Projects", 
      icon: "🟢", 
      color: "text-emerald-400", 
      hover: "hover:border-emerald-500/40" 
    },
    { 
      label: "Closed Bounties", 
      value: summary.closed_count, 
      sub: "Completed / Settled", 
      icon: "🔴", 
      color: "text-rose-400", 
      hover: "hover:border-rose-500/40" 
    },
    { 
      label: "Total Participants", 
      value: summary.total_participants, 
      sub: "Contributors Joined", 
      icon: "👥", 
      color: "text-blue-400", 
      hover: "hover:border-blue-500/40" 
    },
    { 
      label: "ALGO Locked in Escrow", 
      value: `${summary.total_algo_locked.toLocaleString()} ALGO`, 
      sub: "Total Market Value", 
      icon: "💰", 
      color: "text-yellow-400", 
      hover: "hover:border-yellow-500/40" 
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, i) => (
        <div 
          key={i} 
          className={`bg-white/[0.03] border border-white/5 rounded-2xl p-6 transition-all duration-300 ${stat.hover} group`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl opacity-70 group-hover:scale-110 transition-transform duration-300">{stat.icon}</span>
            <span className="text-white/10 text-xs font-mono">Real-time Stats</span>
          </div>
          <div className={`text-3xl font-black mb-1 ${stat.color}`}>
            {stat.value}
          </div>
          <div className="text-white/70 font-bold text-sm">{stat.label}</div>
          <div className="text-white/30 text-xs mt-1">{stat.sub}</div>
        </div>
      ))}
    </div>
  );
}
