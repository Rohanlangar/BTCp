import { pool } from "@/lib/auth";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { BountyInteraction } from "@/components/bounty/BountyInteraction";

export const dynamic = "force-dynamic";

export default async function BountyDetail({ params }: { params: { id: string } }) {
  const { id } = params;

  let bounty: any = null;
  try {
    const { rows } = await pool.query('SELECT * FROM bounties WHERE id = $1', [id]);
    bounty = rows[0];
  } catch (error) {
    console.error("Failed to fetch bounty details:", error);
  }

  if (!bounty) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Bounty Not Found</h1>
          <p className="text-slate-400 mb-8">The bounty you're looking for does not exist or has been removed.</p>
          <Link href="/bounties" className="text-blue-500 hover:text-blue-400">
            &larr; Back to Explorer
          </Link>
        </div>
      </div>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(bounty.createdAt), { addSuffix: true });

  const statusColors: Record<string, string> = {
    OPEN: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    CLAIMED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    SUBMITTED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    SETTLED: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };
  const badgeClass = statusColors[bounty.status] || statusColors.OPEN;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-200 p-6 md:p-12 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-blue-500/5 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="mb-8">
          <Link href="/bounties" className="text-slate-500 hover:text-white transition-colors flex items-center gap-2">
            &larr; Back to Bounties
          </Link>
        </div>

        <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-10 backdrop-blur-xl shadow-2xl">
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className={`px-4 py-1.5 rounded-full text-sm font-semibold tracking-widest border ${badgeClass}`}>
                  {bounty.status}
                </span>
                <span className="text-slate-500 font-mono text-sm">
                  Registry ID: {bounty.registryBountyId || '?'}
                </span>
              </div>
              <h1 className="text-3xl font-extrabold text-white">
                {bounty.issueTitle || "Open Source Contribution"}
              </h1>
            </div>
            
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 min-w-[200px] text-center shrink-0">
              <div className="text-sm font-medium text-emerald-500/80 mb-2">REWARD</div>
              <div className="text-3xl font-black text-emerald-400">
                {Number(bounty.rewardAlgo).toFixed(2)} <span className="text-lg text-emerald-500">ALGO</span>
              </div>
            </div>
          </div>

          <div className="prose prose-invert max-w-none text-slate-300 mb-10">
            <h3 className="text-lg font-semibold text-white mb-2">Repository Link</h3>
            <a href={bounty.issueUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 break-all bg-white/5 p-4 rounded-xl block border border-white/5">
              {bounty.issueUrl}
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 text-sm border-y border-white/10 py-6">
            <div>
              <div className="text-slate-500 mb-1">Creator Wallet</div>
              <div className="font-mono text-slate-300 break-all">{bounty.creatorWallet}</div>
            </div>
            {bounty.contributorWallet && (
              <div>
                <div className="text-slate-500 mb-1">Contributor Wallet</div>
                <div className="font-mono text-amber-300 break-all">{bounty.contributorWallet}</div>
              </div>
            )}
            <div>
              <div className="text-slate-500 mb-1">Created</div>
              <div className="text-slate-300">{timeAgo}</div>
            </div>
            {bounty.escrowAppId && (
              <div>
                <div className="text-slate-500 mb-1">Escrow Smart Contract ID</div>
                <div className="text-slate-300 font-mono text-blue-400">{bounty.escrowAppId}</div>
              </div>
            )}
            {bounty.prUrl && (
              <div className="col-span-full">
                <div className="text-slate-500 mb-1">Submitted Pull Request</div>
                <a href={bounty.prUrl} target="_blank" className="font-mono text-blue-400 break-all bg-blue-500/10 p-2 rounded -mx-2 hover:bg-blue-500/20 block">{bounty.prUrl}</a>
              </div>
            )}
          </div>

          {/* Client-side Interaction Box */}
          <BountyInteraction bounty={bounty} />
          
        </div>
      </div>
    </div>
  );
}
