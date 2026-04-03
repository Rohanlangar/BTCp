"use client";

import { authClient } from "@/lib/auth-client";

export function useWalletLinking() {
  const { data: session } = authClient.useSession();

  const linkWallet = async (
    walletAddress: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      // Validate Algorand wallet address format (58 base32 characters: A-Z, 2-7)
      const algorandAddressRegex = /^[A-Z2-7]{58}$/;
      if (!algorandAddressRegex.test(walletAddress)) {
        return {
          success: false,
          error: "Invalid wallet address format",
        };
      }

      // Check if user is authenticated
      if (!session?.user) {
        return {
          success: false,
          error: "User not authenticated",
        };
      }

      // Generate challenge message
      const timestamp = Date.now();
      const challenge = `Link wallet ${walletAddress} at ${timestamp}`;

      // Create a simple signature (in production, this would be a real signature from the wallet)
      const encodedChallenge = Buffer.from(challenge, "utf-8").toString(
        "base64"
      );

      // Send verification request to the server
      const response = await fetch("/api/user/verify-wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
          signature: encodedChallenge,
          challenge,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error || "Failed to verify wallet",
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error("Wallet linking error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  return { linkWallet };
}
