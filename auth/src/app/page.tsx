import { SignInButton } from "@/components/auth/SignInButton";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <span className="text-white text-4xl font-bold">BP</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
            Bounty Platform
          </h1>
          <p className="text-xl text-slate-300">
            Earn rewards by completing bounties
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-gradient-to-br from-white/95 to-white/90 backdrop-blur rounded-2xl shadow-2xl p-8 mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">
            Welcome
          </h2>
          <p className="text-gray-600 text-center mb-8 text-lg">
            Sign in to access the bounty platform and start earning rewards.
          </p>

          <div className="space-y-6">
            <SignInButton />

            {/* Features */}
            <div className="space-y-3 pt-6 border-t border-gray-200">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <p className="font-semibold text-gray-900">Browse Tasks</p>
                  <p className="text-sm text-gray-600">
                    Discover interesting bounties to complete
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-2xl">💼</span>
                <div>
                  <p className="font-semibold text-gray-900">Work & Submit</p>
                  <p className="text-sm text-gray-600">
                    Complete tasks and submit your solutions
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-2xl">💰</span>
                <div>
                  <p className="font-semibold text-gray-900">Get Paid</p>
                  <p className="text-sm text-gray-600">
                    Receive ALGO rewards directly to your wallet
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-4 text-center">
          <p className="text-white/70 text-sm">
            🔒 Secure authentication with GitHub OAuth
          </p>
        </div>
      </div>
    </div>
  );
}
