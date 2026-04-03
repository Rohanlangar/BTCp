import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Pool } from "pg";
import Link from "next/link";
import { ConnectWallet, PostBountyForm } from "@/components/DashboardClient";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT:        { bg: "bg-gray-500/20",    text: "text-gray-400",    label: "Draft" },
  OPEN:         { bg: "bg-green-500/20",   text: "text-green-400",   label: "Open" },
  CLAIMED:      { bg: "bg-blue-500/20",    text: "text-blue-400",    label: "Claimed" },
  IN_PROGRESS:  { bg: "bg-cyan-500/20",    text: "text-cyan-400",    label: "In Progress" },
  SUBMITTED:    { bg: "bg-yellow-500/20",  text: "text-yellow-400",  label: "Under Review" },
  UNDER_REVIEW: { bg: "bg-yellow-500/20",  text: "text-yellow-400",  label: "Under Review" },
  DISPUTED:     { bg: "bg-orange-500/20",  text: "text-orange-400",  label: "Disputed" },
  SETTLED:      { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Completed" },
  COMPLETED:    { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Completed" },
  CANCELLED:    { bg: "bg-red-500/20",     text: "text-red-400",     label: "Cancelled" },
  EXPIRED:      { bg: "bg-rose-500/20",    text: "text-rose-400",    label: "Expired" },
  REFUNDED:     { bg: "bg-purple-500/20",  text: "text-purple-400",  label: "Refunded" },
};

export default async function AdminDashboardPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: { cookie: headersList.get("cookie") || "" },
  });

  if (!session) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard/contributor");

  // Fetch bounties
  const bountiesResult = await pool.query(
    `SELECT * FROM bounties WHERE "creatorId" = $1 ORDER BY "createdAt" DESC`,
    [session.user.id]
  );
  const bounties = bountiesResult.rows;

  // Get participation counts per bounty from claims table
  let participantCounts: Record<string, number> = {};
  let submissionCounts: Record<string, number> = {};
  try {
    const claimsResult = await pool.query(
      `SELECT bounty_id, COUNT(*) as cnt FROM claims GROUP BY bounty_id`
    );
    claimsResult.rows.forEach((r: any) => { participantCounts[r.bounty_id] = parseInt(r.cnt); });
  } catch { /* claims table may not exist */ }

  try {
    const subsResult = await pool.query(
      `SELECT bounty_id, COUNT(*) as cnt FROM submissions GROUP BY bounty_id`
    );
    subsResult.rows.forEach((r: any) => { submissionCounts[r.bounty_id] = parseInt(r.cnt); });
  } catch { /* submissions table may not exist */ }

  // Analytics
  const isActive = (s: string) => ["OPEN", "CLAIMED", "IN_PROGRESS"].includes(s);
  const isComplete = (s: string) => ["SETTLED", "COMPLETED"].includes(s);
  const stats = {
    total: bounties.length,
    active: bounties.filter((b: any) => isActive(b.status)).length,
    underReview: bounties.filter((b: any) => ["SUBMITTED", "UNDER_REVIEW"].includes(b.status)).length,
    completed: bounties.filter((b: any) => isComplete(b.status)).length,
    totalLocked: bounties
      .filter((b: any) => !isComplete(b.status) && b.status !== "CANCELLED")
      .reduce((s: number, b: any) => s + parseFloat(b.rewardAlgo || 0), 0),
    totalPaid: bounties
      .filter((b: any) => isComplete(b.status))
      .reduce((s: number, b: any) => s + parseFloat(b.rewardAlgo || 0), 0),
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex justify-between items-center sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-sm font-bold">B</div>
          <span className="font-bold text-lg">BountyChain</span>
          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-medium border border-purple-500/30">Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block">
            <ConnectWallet />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm hidden lg:block">{session.user.email}</span>
            {session.user.image && (
              <img src={session.user.image} alt="" className="w-8 h-8 rounded-full border-2 border-gray-700" />
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage your bounties, view submissions, and run ML analysis</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Bounties", value: stats.total, color: "text-white" },
            { label: "Active / Open", value: stats.active, color: "text-green-400" },
            { label: "Under Review", value: stats.underReview, color: "text-yellow-400" },
            { label: "Completed", value: stats.completed, color: "text-emerald-400" },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">ALGO Locked in Escrow</p>
            <p className="text-3xl font-bold text-[#ffee55]">{stats.totalLocked.toFixed(2)} ALGO</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Total ALGO Paid Out</p>
            <p className="text-3xl font-bold text-emerald-400">{stats.totalPaid.toFixed(2)} ALGO</p>
          </div>
        </div>

        {/* Post New Bounty */}
        <section className="mb-12">
          <PostBountyForm />
        </section>

        {/* Bounties List */}
        <section>
          <h2 className="text-xl font-bold mb-4">Your Bounties</h2>

          {bounties.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl">
              <p className="text-5xl mb-4">📭</p>
              <p className="text-xl font-medium text-gray-300">No bounties posted yet</p>
              <p className="text-gray-600 mt-2 text-sm">Your team's contract integration will post bounties here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bounties.map((b: any) => {
                const style = STATUS_CONFIG[b.status] || STATUS_CONFIG["OPEN"];
                const title = b.issueTitle || b.issueUrl || "Untitled Bounty";
                const pCount = participantCounts[b.id] ?? 0;
                const sCount = submissionCounts[b.id] ?? 0;

                return (
                  <div key={b.id} className="bg-gray-900/40 border border-gray-800 hover:border-gray-700 rounded-2xl p-6 transition-all">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left: Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${style.bg} ${style.text}`}>
                            ● {style.label}
                          </span>
                          <span className="text-[#ffee55] font-bold">{b.rewardAlgo} ALGO</span>
                        </div>
                        <h3 className="font-bold text-lg leading-tight mb-1 truncate">{title}</h3>
                        {b.issueDescription && (
                          <p className="text-gray-500 text-sm line-clamp-2 mb-2">{b.issueDescription}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
                          {b.repoOwner && <span>📁 {b.repoOwner}/{b.repoName}</span>}
                          {b.issueNumber && <span>#{b.issueNumber}</span>}
                          <span className="text-purple-400">👥 {pCount} participants</span>
                          <span className="text-blue-400">📄 {sCount} submissions</span>
                          {b.escrowAppId && <span>Escrow: {b.escrowAppId}</span>}
                          <span>Posted {new Date(b.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex gap-2 flex-wrap shrink-0">
                        {/* Activity Button — always visible */}
                        <Link
                          href={`/dashboard/admin/bounty/${b.id}`}
                          className="text-xs bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 px-3 py-2 rounded-lg font-medium transition-colors border border-purple-500/20 flex items-center gap-1"
                        >
                          📊 View Activity
                          {pCount > 0 && (
                            <span className="bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-bold ml-1">
                              {pCount}
                            </span>
                          )}
                        </Link>

                        {b.status === "OPEN" && (
                          <a href={b.issueUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg font-medium transition-colors">
                            View Issue ↗
                          </a>
                        )}
                        {(b.status === "SUBMITTED" || b.status === "UNDER_REVIEW") && (
                          <>
                            <Link href={`/dashboard/admin/bounty/${b.id}`}
                              className="text-xs bg-yellow-500 hover:bg-yellow-400 text-black px-3 py-2 rounded-lg font-bold transition-colors">
                              Review Submissions
                            </Link>
                            <button className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg font-medium transition-colors">
                              Approve
                            </button>
                            <button className="text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 px-3 py-2 rounded-lg font-medium transition-colors border border-red-500/20">
                              Reject
                            </button>
                          </>
                        )}
                        {(b.status === "SETTLED" || b.status === "COMPLETED") && (
                          b.settledTxnId ? (
                            <a href={`https://testnet.algoexplorer.io/tx/${b.settledTxnId}`} target="_blank" rel="noopener noreferrer"
                              className="text-xs bg-emerald-600/20 text-emerald-400 px-3 py-2 rounded-lg font-medium border border-emerald-500/20">
                              View Txn ↗
                            </a>
                          ) : (
                            <span className="text-xs text-gray-600 py-2">✓ Settled</span>
                          )
                        )}
                        {b.status === "CANCELLED" && (
                          <span className="text-xs text-gray-600 py-2">Cancelled</span>
                        )}
                      </div>
                    </div>

                    {/* Submission info if exists (legacy prUrl) */}
                    {b.prUrl && (
                      <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-gray-500">PR Submitted:</span>
                        <a href={b.prUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 underline">{b.prUrl}</a>
                        {b.mlScores && (
                          <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                            AI Score: {(b.mlScores as any)?.overall_score ?? "N/A"}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
