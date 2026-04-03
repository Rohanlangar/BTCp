"use client";

import { useWallet } from "@txnlab/use-wallet-react";
import { useCallback, useMemo } from "react";

export function useBountyContracts() {
  const { activeAddress, signer } = useWallet();
  const isConnected = !!activeAddress;

  const createBounty = useCallback(async (issueUrl: string, rewardAmount: number) => {
    console.log("Creating bounty for:", issueUrl, "with reward:", rewardAmount);
    
    // This is a stub implementation. 
    // In a real hackathon project, this would use algosdk to deploy a contract.
    // For now, we'll simulate a successful deployment.
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      escrowAppId: Math.floor(Math.random() * 1000000),
      bountyId: Math.floor(Math.random() * 1000),
    };
  }, []);

  return useMemo(() => ({
    isConnected,
    createBounty,
  }), [isConnected, createBounty]);
}
