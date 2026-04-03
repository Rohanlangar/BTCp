"use client";

import { authClient } from "@/lib/auth-client";
import { useState } from "react";

export function SignInButton() {
  const { data: session, isPending } = authClient.useSession();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/dashboard",
      });
    } catch (error) {
      console.error("Sign in error:", error);
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await authClient.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isPending) {
    return (
      <button
        disabled
        className="w-full px-4 py-3 bg-gray-200 text-gray-600 rounded-lg font-medium cursor-not-allowed"
      >
        Loading...
      </button>
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {session.user.image && (
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="w-8 h-8 rounded-full"
              />
            )}
            <div>
              <p className="font-medium text-gray-900 text-sm leading-none">
                {session.user.name}
              </p>
              <p className="text-gray-600 text-xs">{session.user.email}</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          disabled={isLoading}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors whitespace-nowrap"
        >
          {isLoading ? "..." : "Sign Out"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      disabled={isLoading}
      className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all flex items-center justify-center gap-2"
    >
      {isLoading ? (
        <>
          <span className="inline-block animate-spin">⌛</span>
          Signing in...
        </>
      ) : (
        <>
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.868-.013-1.703-2.782.603-3.369-1.343-3.369-1.343-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.544 2.914 1.19.092-.926.35-1.556.636-1.913-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.268.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.722c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.137 18.163 20 14.413 20 10c0-5.523-4.477-10-10-10z" />
          </svg>
          Sign in with GitHub
        </>
      )}
    </button>
  );
}
