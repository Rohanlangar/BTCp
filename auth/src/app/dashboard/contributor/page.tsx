import { headers } from "next/headers";

export default async function ContributorDashboardPage() {
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12 border-b border-gray-800 pb-6">
          <h1 className="text-3xl font-bold">Contributor Dashboard</h1>
          <div className="flex gap-4 items-center">
            <span className="text-gray-400">👨‍💻 Contributor Mode</span>
            <div className="h-10 w-10 bg-gradient-to-tr from-cyan-500 to-blue-500 rounded-full"></div>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
            <h3 className="text-gray-400 font-medium mb-2">Claimed Bounties</h3>
            <p className="text-4xl font-bold text-white">2</p>
          </div>
          <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
            <h3 className="text-gray-400 font-medium mb-2">Reputation Score</h3>
            <p className="text-4xl font-bold text-white">942</p>
          </div>
          <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
            <h3 className="text-gray-400 font-medium mb-2">Total Earned (ALGO)</h3>
            <p className="text-4xl font-bold text-[#ffee55]">450</p>
          </div>
        </div>

        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Marketplace Preview</h2>
            <button className="bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors">
              Browse All Bounties
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
             {/* Mock cards */}
             <div className="bg-gray-900/30 p-6 rounded-2xl border border-gray-800 hover:border-blue-500/50 transition-colors">
               <h3 className="font-bold text-lg mb-2">Create React Native App</h3>
               <p className="text-gray-400 text-sm mb-4 line-clamp-2">Looking for an experienced dev to port our web dashboard into a React Native mobile application...</p>
               <div className="flex justify-between items-center">
                 <span className="text-[#ffee55] font-bold">1,000 ALGO</span>
                 <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Claim Bounty</button>
               </div>
             </div>
             <div className="bg-gray-900/30 p-6 rounded-2xl border border-gray-800 hover:border-blue-500/50 transition-colors">
               <h3 className="font-bold text-lg mb-2">Optimize DB Queries</h3>
               <p className="text-gray-400 text-sm mb-4 line-clamp-2">Our postgres database is running slow on complex joins. We need indexing and query optimizations.</p>
               <div className="flex justify-between items-center">
                 <span className="text-[#ffee55] font-bold">150 ALGO</span>
                 <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Claim Bounty</button>
               </div>
             </div>
          </div>
        </section>
      </div>
    </div>
  );
}
