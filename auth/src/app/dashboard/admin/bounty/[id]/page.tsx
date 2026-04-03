import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Pool } from "pg";
import Link from "next/link";
import { AdminBountyActivityClient } from "@/components/bounty/AdminBountyActivityClient";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export const dynamic = "force-dynamic";

export default async function AdminBountyActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: bountyId } = await params;
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: { cookie: headersList.get("cookie") || "" },
  });

  if (!session) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard/contributor");

  // Fetch bounty
  let bounty: any = null;
  try {
    const { rows } = await pool.query('SELECT * FROM bounties WHERE id = $1', [bountyId]);
    bounty = rows[0];
  } catch (error) {
    console.error("Failed to fetch bounty:", error);
  }

  if (!bounty) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Bounty Not Found</h1>
          <Link href="/dashboard/admin" className="text-blue-400 hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Fetch participants (claims)
  let participants: any[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u."name", u."email", u."image", u."githubHandle"
       FROM claims c
       JOIN "user" u ON c.contributor_id = u.id
       WHERE c.bounty_id = $1 ORDER BY c.claimed_at ASC`,
      [bountyId]
    );
    participants = rows;
  } catch { /* claims table may not exist */ }

  // Fetch submissions
  let submissions: any[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u."name" as contributor_name, u."email" as contributor_email, u."image" as contributor_image
       FROM submissions s
       JOIN "user" u ON s.contributor_id = u.id
       WHERE s.bounty_id = $1
       ORDER BY s.rank ASC NULLS LAST, s.ai_quality_score DESC NULLS LAST, s.submitted_at ASC`,
      [bountyId]
    );
    submissions = rows;
  } catch { /* submissions table may not exist */ }

  // Fetch activity log
  let activities: any[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT * FROM activity_log WHERE bounty_id = $1 ORDER BY timestamp DESC LIMIT 20`,
      [bountyId]
    );
    activities = rows;
  } catch { /* activity_log may not exist */ }

  const title = bounty.issueTitle || bounty.issueUrl || "Untitled Bounty";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex justify-between items-center sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="text-gray-500 hover:text-white transition-colors">
            ← Back
          </Link>
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-sm font-bold">B</div>
          <span className="font-bold text-lg">Bounty Activity</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-sm hidden md:block">{session.user.email}</span>
          {session.user.image && (
            <img src={session.user.image} alt="" className="w-8 h-8 rounded-full border-2 border-gray-700" />
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Bounty Overview */}
        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  ● {bounty.status}
                </span>
                <span className="text-[#ffee55] font-bold text-lg">{bounty.rewardAlgo} ALGO</span>
              </div>
              <h1 className="text-2xl font-bold mb-2">{title}</h1>
              {bounty.issueDescription && (
                <p className="text-gray-500 text-sm line-clamp-3 mb-3">{bounty.issueDescription}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
                {bounty.repoOwner && <span>📁 {bounty.repoOwner}/{bounty.repoName}</span>}
                {bounty.issueUrl && (
                  <a href={bounty.issueUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    View Issue ↗
                  </a>
                )}
                <span>Created {new Date(bounty.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex gap-4 text-center shrink-0">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 min-w-[100px]">
                <p className="text-purple-400 text-2xl font-bold">{participants.length}</p>
                <p className="text-gray-500 text-xs mt-1">Participants</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 min-w-[100px]">
                <p className="text-blue-400 text-2xl font-bold">{submissions.length}</p>
                <p className="text-gray-500 text-xs mt-1">Submissions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Participants List */}
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-purple-500/20 rounded-md flex items-center justify-center text-purple-400 text-xs">👥</span>
            Participants ({participants.length})
          </h2>
          {participants.length === 0 ? (
            <div className="bg-gray-900/30 border border-dashed border-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-500">No contributors have participated yet</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {participants.map((p: any) => {
                const hasSubmission = submissions.some((s: any) => s.contributor_id === p.contributor_id);
                return (
                  <div key={p.id} className="bg-gray-900/40 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
                    {p.image ? (
                      <img src={p.image} alt="" className="w-10 h-10 rounded-full border border-gray-700" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm font-bold">
                        {(p.name || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.name || p.email}</p>
                      <p className="text-gray-600 text-xs truncate">{p.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      hasSubmission 
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" 
                        : "bg-gray-500/10 text-gray-500 border border-gray-700"
                    }`}>
                      {hasSubmission ? "Submitted" : "Joined"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Submissions + ML Pipeline + Rankings — Client Component */}
        <AdminBountyActivityClient
          bountyId={bountyId}
          initialSubmissions={submissions}
          bountyStatus={bounty.status}
        />

        {/* Activity Log */}
        {activities.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-gray-500/20 rounded-md flex items-center justify-center text-gray-400 text-xs">📋</span>
              Activity Log
            </h2>
            <div className="space-y-2">
              {activities.map((a: any) => (
                <div key={a.id} className="bg-gray-900/30 border border-gray-800 rounded-lg px-4 py-3 flex items-center gap-3 text-sm">
                  <span className="text-gray-600 text-xs font-mono shrink-0">
                    {new Date(a.timestamp).toLocaleString()}
                  </span>
                  <span className="text-gray-400">{a.action}</span>
                  {a.metadata && (
                    <span className="text-gray-600 text-xs truncate">
                      {JSON.stringify(a.metadata).substring(0, 80)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
