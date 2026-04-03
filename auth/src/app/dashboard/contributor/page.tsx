import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Pool } from "pg";
import { ParticipateButton, SubmitWorkButton } from "@/components/bounty/ContributorActions";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  OPEN:         { bg: "bg-green-500/10",   text: "text-green-400",   label: "Open" },
  CLAIMED:      { bg: "bg-blue-500/10",    text: "text-blue-400",    label: "Claimed" },
  IN_PROGRESS:  { bg: "bg-cyan-500/10",    text: "text-cyan-400",    label: "In Progress" },
  SUBMITTED:    { bg: "bg-yellow-500/10",  text: "text-yellow-400",  label: "Under Review" },
  UNDER_REVIEW: { bg: "bg-yellow-500/10",  text: "text-yellow-400",  label: "Under Review" },
  DISPUTED:     { bg: "bg-orange-500/10",  text: "text-orange-400",  label: "Disputed" },
  SETTLED:      { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Completed" },
  COMPLETED:    { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Completed" },
  CANCELLED:    { bg: "bg-red-500/10",     text: "text-red-400",     label: "Cancelled" },
  EXPIRED:      { bg: "bg-gray-500/10",    text: "text-gray-400",    label: "Expired" },
};

export default async function ContributorDashboardPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: { cookie: headersList.get("cookie") || "" },
  });

  if (!session) redirect("/login");
  if ((session.user as any).role !== "contributor") redirect("/dashboard/admin");

  const userId = session.user.id;

  // All open bounties for marketplace
  const marketplaceResult = await pool.query(
    `SELECT * FROM bounties WHERE status = 'OPEN' ORDER BY "createdAt" DESC`
  );
  const marketplaceBounties = marketplaceResult.rows;

  // Get this contributor's claims (participations)
  let myClaims: Record<string, any> = {};
  try {
    const claimsResult = await pool.query(
      `SELECT c.*, b."issueTitle", b."issueDescription", b."issueUrl", b."rewardAlgo", 
              b."repoOwner", b."repoName", b."issueNumber", b.status as bounty_status, b."escrowAppId"
       FROM claims c
       JOIN bounties b ON c.bounty_id = b.id
       WHERE c.contributor_id = $1
       ORDER BY c.claimed_at DESC`,
      [userId]
    );
    claimsResult.rows.forEach((c: any) => {
      myClaims[c.bounty_id] = c;
    });
  } catch { /* claims table may not exist */ }

  // Get this contributor's submissions
  let mySubmissions: Record<string, any> = {};
  try {
    const submissionsResult = await pool.query(
      `SELECT * FROM submissions WHERE contributor_id = $1`,
      [userId]
    );
    submissionsResult.rows.forEach((s: any) => {
      mySubmissions[s.bounty_id] = s;
    });
  } catch { /* submissions table may not exist */ }

  // Also check old-style bounties where contributorId is set (backward compat)
  const myOldBountiesResult = await pool.query(
    `SELECT * FROM bounties 
     WHERE "contributorId" = $1 AND status NOT IN ('CANCELLED', 'OPEN')
     ORDER BY "claimedAt" DESC NULLS LAST`,
    [userId]
  );
  const myOldBounties = myOldBountiesResult.rows;

  // Build participated bounties list (from claims)
  const participatedBountyIds = Object.keys(myClaims);

  // Stats
  const userResult = await pool.query(
    `SELECT "reputationScore", "bountiesCompleted" FROM "user" WHERE id = $1`,
    [userId]
  );
  const userStats = userResult.rows[0] || {};

  const earnedResult = await pool.query(
    `SELECT COALESCE(SUM("rewardAlgo"), 0) as total 
     FROM bounties WHERE "contributorId" = $1 AND status = 'SETTLED'`,
    [userId]
  );
  const totalEarned = parseFloat(earnedResult.rows[0]?.total || 0);

  const stats = {
    activeParticipations: participatedBountyIds.length,
    pendingSubmissions: Object.values(mySubmissions).filter((s: any) => s.status === "pending").length,
    totalEarned,
    reputation: userStats.reputationScore ?? 0,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex justify-between items-center sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">B</div>
          <span className="font-bold text-lg">BountyChain</span>
          <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-medium border border-cyan-500/30">Contributor</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-sm hidden md:block">{session.user.email}</span>
          {session.user.image && (
            <img src={session.user.image} alt="" className="w-8 h-8 rounded-full border-2 border-gray-700" />
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Active Participations", value: stats.activeParticipations,  color: "text-blue-400" },
            { label: "Pending Submissions",   value: stats.pendingSubmissions,    color: "text-yellow-400" },
            { label: "Total Earned",          value: `${stats.totalEarned.toFixed(2)} ALGO`, color: "text-[#ffee55]" },
            { label: "Reputation",            value: stats.reputation,            color: "text-emerald-400" },
          ].map(s => (
            <div key={s.label} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* My Participated Bounties */}
        {participatedBountyIds.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4">My Participated Bounties</h2>
            <div className="space-y-4">
              {participatedBountyIds.map((bountyId) => {
                const claim = myClaims[bountyId];
                const submission = mySubmissions[bountyId];
                const title = claim.issueTitle || claim.issueUrl || "Untitled Bounty";
                const bountyStatus = claim.bounty_status || "OPEN";
                const style = STATUS_CONFIG[bountyStatus] ?? STATUS_CONFIG["OPEN"];

                return (
                  <div key={bountyId} className="bg-gray-900/40 border border-gray-800 hover:border-cyan-800/50 rounded-2xl p-6 transition-all">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${style.bg} ${style.text}`}>
                            ● {style.label}
                          </span>
                          <span className="text-[#ffee55] font-bold">{claim.rewardAlgo} ALGO</span>
                          {claim.status === "submitted" && (
                            <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
                              PR Submitted
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-lg leading-tight truncate">{title}</h3>
                        {claim.issueDescription && (
                          <p className="text-gray-500 text-sm mt-1 line-clamp-2">{claim.issueDescription}</p>
                        )}
                        {claim.repoOwner && (
                          <p className="text-gray-600 text-xs mt-2">📁 {claim.repoOwner}/{claim.repoName} #{claim.issueNumber}</p>
                        )}
                      </div>

                      <div className="shrink-0">
                        {!submission ? (
                          <SubmitWorkButton bountyId={bountyId} bountyTitle={title} />
                        ) : submission.status === "pending" ? (
                          <div className="px-5 py-2.5 bg-yellow-500/10 text-yellow-400 font-semibold rounded-xl text-sm text-center border border-yellow-500/20">
                            ⏳ Awaiting Review
                          </div>
                        ) : submission.status === "validated" && submission.rank && submission.rank <= 3 ? (
                          <div className="px-5 py-2.5 bg-emerald-500/10 text-emerald-400 font-semibold rounded-xl text-sm text-center border border-emerald-500/20">
                            🏆 Ranked #{submission.rank} — Score: {submission.ai_quality_score}%
                          </div>
                        ) : submission.status === "validated" ? (
                          <div className="px-5 py-2.5 bg-gray-500/10 text-gray-400 font-semibold rounded-xl text-sm text-center border border-gray-500/20">
                            Scored: {submission.ai_quality_score}% (Rank #{submission.rank})
                          </div>
                        ) : submission.status === "winner" ? (
                          <div className="px-5 py-2.5 bg-[#ffee55]/10 text-[#ffee55] font-semibold rounded-xl text-sm text-center border border-[#ffee55]/20">
                            🎉 Winner! Reward Incoming
                          </div>
                        ) : (
                          <div className="px-5 py-2.5 bg-gray-500/10 text-gray-400 font-semibold rounded-xl text-sm text-center border border-gray-500/20">
                            {submission.status}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Show PR if submitted */}
                    {submission?.pr_url && (
                      <div className="mt-4 pt-4 border-t border-gray-800">
                        <div className="flex items-center gap-2 text-sm flex-wrap mb-2">
                          <span className="text-gray-500">Your PR:</span>
                          <a href={submission.pr_url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-400 hover:underline truncate max-w-xs">{submission.pr_url}</a>
                          {submission.ai_quality_score != null && (
                            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                              AI Score: {submission.ai_quality_score}%
                            </span>
                          )}
                        </div>
                        {submission.documentation && (
                          <p className="text-gray-500 text-xs line-clamp-2 mt-1">📝 {submission.documentation}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Legacy: Old-style bounties (backward compat) */}
        {myOldBounties.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4">Legacy Bounties</h2>
            <div className="space-y-4">
              {myOldBounties.map((b: any) => {
                const style = STATUS_CONFIG[b.status] ?? STATUS_CONFIG["OPEN"];
                const title = b.issueTitle || b.issueUrl || "Untitled Bounty";
                return (
                  <div key={b.id} className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${style.bg} ${style.text}`}>● {style.label}</span>
                      <span className="text-[#ffee55] font-bold">{b.rewardAlgo} ALGO</span>
                    </div>
                    <h3 className="font-bold text-lg leading-tight truncate">{title}</h3>
                    {b.prUrl && (
                      <div className="mt-3 text-sm text-gray-500">
                        PR: <a href={b.prUrl} target="_blank" className="text-blue-400 hover:underline">{b.prUrl}</a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Open Marketplace */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Open Bounties</h2>
            <span className="text-gray-600 text-sm">{marketplaceBounties.length} available</span>
          </div>

          {marketplaceBounties.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl">
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-xl font-medium text-gray-300">No open bounties right now</p>
              <p className="text-gray-600 mt-2 text-sm">Check back soon — admins are posting new ones!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {marketplaceBounties.map((b: any) => {
                const title = b.issueTitle || b.issueUrl || "Untitled Bounty";
                const alreadyParticipating = !!myClaims[b.id];

                return (
                  <div key={b.id} className="bg-gray-900/40 border border-gray-800 hover:border-green-800/60 rounded-2xl p-6 transition-all flex flex-col gap-3">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold leading-tight line-clamp-2">{title}</h3>
                      <span className="shrink-0 text-xs bg-green-500/10 text-green-400 px-2.5 py-1 rounded-full font-semibold border border-green-500/20">● Open</span>
                    </div>

                    {b.issueDescription && (
                      <p className="text-gray-500 text-sm line-clamp-3">{b.issueDescription}</p>
                    )}

                    <div className="flex items-center justify-between text-sm mt-auto pt-2">
                      <span className="text-[#ffee55] font-bold text-lg">{b.rewardAlgo} ALGO</span>
                      {b.repoOwner && (
                        <span className="text-gray-600 text-xs">📁 {b.repoOwner}/{b.repoName}</span>
                      )}
                    </div>

                    {b.issueUrl && (
                      <a href={b.issueUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-gray-600 hover:text-gray-400 truncate">
                        🔗 {b.issueUrl}
                      </a>
                    )}

                    {alreadyParticipating ? (
                      <div className="w-full py-2.5 bg-cyan-500/10 text-cyan-400 font-semibold rounded-xl text-sm text-center border border-cyan-500/20">
                        ✓ Participating
                      </div>
                    ) : (
                      <ParticipateButton bountyId={b.id} />
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
