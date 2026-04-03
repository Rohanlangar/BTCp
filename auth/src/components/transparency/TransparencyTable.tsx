// src/components/transparency/TransparencyTable.tsx
// Detailed Bounty List for the Public Transparency Dashboard

import React from "react";

interface PublicBounty {
  id: string;
  title: string;
  status: string;
  amount_algo: number;
  owner_name: string;
  owner_wallet: string;
  contributor_count: number;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  OPEN: { label: "Open", bg: "bg-emerald-500/10", text: "text-emerald-400", icon: "🌐" },
  CLAIMED: { label: "Claimed", bg: "bg-blue-500/10", text: "text-blue-400", icon: "🔒" },
  SUBMITTED: { label: "In Review", bg: "bg-purple-500/10", text: "text-purple-400", icon: "⚖️" },
  SETTLED: { label: "Settled", bg: "bg-amber-500/10", text: "text-amber-400", icon: "✅" },
  CANCELLED: { label: "Cancelled", bg: "bg-red-500/10", text: "text-red-400", icon: "❌" },
};

export function TransparencyTable({ bounties }: { bounties: PublicBounty[] }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-wider">Project / Bounty</th>
              <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-wider">Owner</th>
              <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-wider text-center">Participants</th>
              <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-wider text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {bounties.map((b) => {
              const cfg = STATUS_CONFIG[b.status] || { label: b.status, bg: "bg-gray-500/10", text: "text-gray-400", icon: "❓" };
              return (
                <tr key={b.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-white group-hover:text-blue-400 transition-colors">{b.title}</div>
                    <div className="text-white/20 text-xs mt-0.5 truncate max-w-[200px]">{b.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
                         {b.owner_name[0].toUpperCase()}
                       </div>
                       <div>
                         <div className="text-sm font-semibold text-white/80">{b.owner_name}</div>
                         <div className="text-[10px] text-white/20 font-mono italic">
                           {b.owner_wallet ? `${b.owner_wallet.substring(0, 10)}...` : "No wallet linked"}
                         </div>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text} border border-current opacity-70`}>
                      <span className="text-[10px]">{cfg.icon}</span>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className={`text-sm font-bold ${b.contributor_count > 0 ? "text-blue-400" : "text-white/20"}`}>
                      {b.contributor_count}
                    </div>
                    <div className="text-[10px] text-white/20 uppercase tracking-widest">Contributors</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-black text-white">{b.amount_algo} ALGO</div>
                    <div className="text-[10px] text-white/20 uppercase">Locked Value</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {bounties.length === 0 && (
        <div className="p-12 text-center text-white/20">
          <p>No public bounty projects found.</p>
        </div>
      )}
    </div>
  );
}
