import { headers } from "next/headers";

export default async function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12 border-b border-gray-800 pb-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-4 items-center">
            <span className="text-gray-400">🏢 Admin Mode</span>
            <div className="h-10 w-10 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full"></div>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
            <h3 className="text-gray-400 font-medium mb-2">Active Bounties</h3>
            <p className="text-4xl font-bold text-white">4</p>
          </div>
          <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
            <h3 className="text-gray-400 font-medium mb-2">Pending Submissions</h3>
            <p className="text-4xl font-bold text-white">12</p>
          </div>
          <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
            <h3 className="text-gray-400 font-medium mb-2">Total Locked (ALGO)</h3>
            <p className="text-4xl font-bold text-[#ffee55]">1,250</p>
          </div>
        </div>

        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Your Bounties</h2>
            <button className="bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors">
              + Post New Bounty
            </button>
          </div>
          <div className="bg-gray-900/30 rounded-2xl border border-gray-800 overflow-hidden">
             {/* Mock table */}
             <table className="w-full text-left">
                <thead className="bg-gray-900/80 text-gray-400 text-sm">
                  <tr>
                    <th className="p-4 font-medium">Bounty Title</th>
                    <th className="p-4 font-medium">Reward</th>
                    <th className="p-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  <tr>
                    <td className="p-4">Fix Smart Contract Reentrancy Vulnerability</td>
                    <td className="p-4 text-[#ffee55]">500 ALGO</td>
                    <td className="p-4"><span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold">Active</span></td>
                  </tr>
                  <tr>
                    <td className="p-4">Build Frontend UI for NFT Marketplace</td>
                    <td className="p-4 text-[#ffee55]">250 ALGO</td>
                    <td className="p-4"><span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-xs font-semibold">Reviewing</span></td>
                  </tr>
                </tbody>
             </table>
          </div>
        </section>
      </div>
    </div>
  );
}
