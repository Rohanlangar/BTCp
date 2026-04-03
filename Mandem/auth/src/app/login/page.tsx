import { SignInButton } from "@/components/auth/SignInButton";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  // If user is already logged in, redirect to dashboard
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie");

  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: cookieHeader || "",
      },
    });
    
    if (session?.user) {
      redirect("/dashboard");
    }
  } catch (error) {
    // User not authenticated, show login page
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-3xl font-bold">BP</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Bounty Platform
          </h1>
          <p className="text-slate-300 text-lg">
            Earn rewards by completing bounties
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-gradient-to-br from-white/95 to-white/90 backdrop-blur rounded-2xl shadow-2xl p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Sign In
          </h2>
          <p className="text-gray-600 mb-8">
            Connect with GitHub to get started
          </p>

          <div className="mb-6">
            <SignInButton />
          </div>

          {/* Info Section */}
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">ℹ️ What is this?</span>
              </p>
              <p className="text-sm text-blue-800 mt-2">
                The Bounty Platform is a decentralized marketplace where you can earn cryptocurrency by completing tasks and solving challenges.
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-900">
                <span className="font-semibold">✅ How it works</span>
              </p>
              <ol className="text-sm text-green-800 mt-2 space-y-1">
                <li>1. Sign in with GitHub</li>
                <li>2. Link your Algorand wallet</li>
                <li>3. Browse and complete bounties</li>
                <li>4. Get paid directly to your wallet</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-4 text-center">
          <p className="text-white/70 text-sm">
            We only access your GitHub account for authentication. Your wallet remains fully under your control.
          </p>
        </div>
      </div>
    </div>
  );
}
