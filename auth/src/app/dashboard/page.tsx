import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { SignInButton } from "@/components/auth/SignInButton";
import { DashboardClient, ConnectWallet, PostBountyForm } from "@/components/DashboardClient";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  // Get the session on the server side
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie");

  let session = null;
  try {
    const response = await auth.api.getSession({
      headers: {
        cookie: cookieHeader || "",
      },
    });
    session = response;
  } catch (error) {
    // Session not found, will show login
  }

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardClient>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Navigation */}
        <nav className="bg-white/10 backdrop-blur-md border-b border-white/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">BP</span>
              </div>
              <h1 className="text-2xl font-bold text-white hidden sm:block">
                Bounty Platform
              </h1>
            </div>
            <SignInButton />
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Welcome Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-white/95 to-white/90 backdrop-blur rounded-2xl shadow-2xl p-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Welcome, {session.user.name}!
                </h2>
                <p className="text-gray-600 mb-6">
                  Manage your profile, connect your wallet, and track your bounties.
                </p>

                {/* User Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/50 rounded-xl p-4">
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      Account Email
                    </p>
                    <p className="text-blue-900 font-semibold break-all">
                      {session.user.email}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200/50 rounded-xl p-4">
                    <p className="text-sm font-medium text-green-900 mb-1">
                      Account Status
                    </p>
                    <p className="text-green-900 font-semibold">
                      ✅ Active & Protected
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-col gap-4">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
                <p className="text-purple-100 text-sm font-medium">
                  Total Earnings
                </p>
                <p className="text-4xl font-bold mt-2">$0.00</p>
                <p className="text-purple-200 text-sm mt-2">Coming soon</p>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-xl p-6 text-white">
                <p className="text-orange-100 text-sm font-medium">
                  Bounties Completed
                </p>
                <p className="text-4xl font-bold mt-2">0</p>
                <p className="text-orange-200 text-sm mt-2">Start now</p>
              </div>
            </div>
          </div>

          {/* Wallet Section */}
          <div className="bg-gradient-to-br from-white/95 to-white/90 backdrop-blur rounded-2xl shadow-2xl p-8 mb-8">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Wallet Management
              </h3>
              <p className="text-gray-600">
                Connect your Algorand wallet to receive bounty payments.
              </p>
            </div>

            <ConnectWallet />
          </div>

          {/* Post Bounty Section */}
          <div className="mb-8">
            <PostBountyForm />
          </div>

          {/* Features Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-white/95 to-white/90 backdrop-blur rounded-2xl shadow-lg p-6 border border-white/50">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Browse Bounties</h4>
              <p className="text-gray-600 text-sm">
                Discover interesting tasks and challenges to complete.
              </p>
            </div>

            <div className="bg-gradient-to-br from-white/95 to-white/90 backdrop-blur rounded-2xl shadow-lg p-6 border border-white/50">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">✅</span>
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Submit Solutions</h4>
              <p className="text-gray-600 text-sm">
                Complete bounties and submit your work for review.
              </p>
            </div>

            <div className="bg-gradient-to-br from-white/95 to-white/90 backdrop-blur rounded-2xl shadow-lg p-6 border border-white/50">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">💰</span>
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Earn Rewards</h4>
              <p className="text-gray-600 text-sm">
                Get paid in ALGO directly to your wallet.
              </p>
            </div>
          </div>
        </main>
      </div>
    </DashboardClient>
  );
}
