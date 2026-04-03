import { pool } from "@/lib/auth";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

// Ensure this route is strictly dynamically rendered
export const dynamic = "force-dynamic";

export default async function BountyExplorer() {
  // Fetch bounties directly from the database server-side
  let bounties: any[] = [];
  try {
    const { rows } = await pool.query('SELECT * FROM bounties ORDER BY "createdAt" DESC');
    bounties = rows;
  } catch (error) {
    console.error("Failed to fetch bounties:", error);
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-200 p-8 sm:p-12 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/10 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-6 gap-6">
          <div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Bounty Explorer
            </h1>
            <p className="text-slate-400 mt-2">
              Discover active open-source bounties, claim issues, and earn ALGO securely.
            </p>
          </div>
          <Link 
            href="/dashboard"
            className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] whitespace-nowrap"
          >
            Create New Bounty
          </Link>
        </header>

        {bounties.length === 0 ? (
          <div className="text-center py-24 border border-white/5 rounded-2xl bg-white/[0.02] backdrop-blur-xl">
            <h3 className="text-2xl font-bold text-white mb-2">No active bounties</h3>
            <p className="text-slate-400">There are currently no bounties available on the platform.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bounties.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BountyCard({ bounty }: { bounty: any }) {
  const statusColors: Record<string, string> = {
    OPEN: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    CLAIMED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    SUBMITTED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ACCEPTED: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    AWAITING_SETTLEMENT: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    SETTLED: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  const badgeClass = statusColors[bounty.status] || "bg-slate-500/10 text-slate-400 border-slate-500/20";
  
  // Format the time nicely
  const timeAgo = bounty.createdAt 
    ? formatDistanceToNow(new Date(bounty.createdAt), { addSuffix: true }) 
    : "Recently";

  return (
    <Link href={`/bounties/${bounty.id}`} className="group block h-full">
      <div className="h-full flex flex-col p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-blue-500/50 hover:bg-white/[0.04] transition-all backdrop-blur-sm relative overflow-hidden shadow-xl shadow-black/20 group-hover:shadow-blue-900/20">
        
        {/* Top line mapping */}
        <div className="flex justify-between items-start mb-4">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold lowercase tracking-widest border ${badgeClass}`}>
            {bounty.status}
          </div>
          <div className="text-sm text-slate-500 font-medium font-mono">
            ID: {bounty.registryBountyId || '?'}
          </div>
        </div>

        {/* Content */}
        <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
          {bounty.issueTitle || "Open Source Issue"}
        </h3>
        
        <p className="text-sm text-slate-400 line-clamp-3 mb-6 flex-grow">
          Repository URL: <br/>
          <span className="text-blue-400/80 break-all truncate block w-full">{bounty.issueUrl}</span>
        </p>

        {/* Footer Metrics */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <div>
            <div className="text-xs text-slate-500 font-medium mb-1">REWARD</div>
            <div className="text-lg font-bold text-emerald-400 flex items-center gap-1.5">
              <span>{Number(bounty.rewardAlgo).toFixed(2)}</span>
              <span className="text-xs uppercase tracking-wider text-emerald-500">ALGO</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 font-medium mb-1">CREATED</div>
            <div className="text-sm font-medium text-slate-300">{timeAgo}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
