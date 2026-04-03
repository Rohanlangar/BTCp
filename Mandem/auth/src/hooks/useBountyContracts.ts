"use client";

import { useWallet } from "@txnlab/use-wallet-react";
import { useCallback, useMemo, useState } from "react";
import algosdk from "algosdk";
import * as algorand from "@/lib/algorand";

export type DeployStep = 
  | "IDLE" 
  | "COMPILING" 
  | "DEPLOYING" 
  | "FUNDING" 
  | "REGISTERING" 
  | "DEPOSITING" 
  | "SUCCESS" 
  | "ERROR";

export function useBountyContracts() {
  const { activeAddress, signTransactions } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const isConnected = !!activeAddress;

  const createBounty = useCallback(async (
    issueUrl: string, 
    rewardAmountAlgo: number,
    onProgress?: (step: DeployStep) => void
  ) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    if (!activeAddress) throw new Error("Wallet not connected");
    if (!signTransactions) throw new Error("Wallet provider does not support signing");

    const sender = activeAddress;
    const client = algorand.getAlgodClient();
    const registryAppId = algorand.getRegistryAppId(); // sync, no await
    const deadlineTs = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    const rewardMicroAlgo = Math.floor(rewardAmountAlgo * 1_000_000);
    let escrowAppId = 0;
    
    try {
      // Pre-flight balance check:
      // Minimum amounts:
      // 1. Escrow App Creation MBR (100k + 207k) ~ 307k
      // 2. Escrow Funding MBR (base 100k + 146.5k box + padding) = 300k
      // 3. Transactions fees ~ 7k
      // 4. Reward amount = rewardMicroAlgo
      const appCreationMbr = 307000;
      const escrowFundingMbr = 300000;
      const fees = 7000;
      const totalRequiredTxn = appCreationMbr + escrowFundingMbr + fees + rewardMicroAlgo;
      
      const balanceCheck = await algorand.checkUserBalance(sender, totalRequiredTxn);
      if (!balanceCheck.sufficient) {
        throw new Error(`Insufficient balance. Required: ${(totalRequiredTxn / 1_000_000).toFixed(3)} ALGO. Current free balance is too low.`);
      }

      // 1. Fetch compiled TEAL from backend
      onProgress?.("COMPILING");
      const { approval, clear } = await algorand.getCompiledPrograms();

      // 2. Deploy Escrow — user signs Transaction object (not Uint8Array)
      onProgress?.("DEPLOYING");
      const deployTxn = await algorand.buildDeployEscrowTxn(
        sender, issueUrl, deadlineTs, registryAppId, approval, clear
      );
      // Encode deployTxn before signing
      const encodedDeployTxn = new Uint8Array(algosdk.encodeUnsignedTransaction(deployTxn));
      const signedDeployTxns = await signTransactions([encodedDeployTxn]);
      const validDeployTxns = signedDeployTxns.filter((t): t is Uint8Array => t !== null);
      if (validDeployTxns.length === 0) throw new Error("Deploy signature rejected");

      const deployRes = await client.sendRawTransaction(validDeployTxns).do();
      const confirmedDeploy = await algosdk.waitForConfirmation(client, deployRes.txid, 4);
      escrowAppId = Number(confirmedDeploy.applicationIndex);
      if (!escrowAppId) throw new Error("Failed to get AppID from deploy confirmation");
      
      const escrowAddress = algosdk.getApplicationAddress(escrowAppId).toString();
      console.log(`[createBounty] Escrow deployed: AppID=${escrowAppId}, address=${escrowAddress}`);
      
      // 3. Fund Escrow MBR (0.2 ALGO)
      onProgress?.("FUNDING");
      const fundTxn = await algorand.buildFundMBRTxn(sender, escrowAddress);
      const encodedFundTxn = new Uint8Array(algosdk.encodeUnsignedTransaction(fundTxn));
      const signedFundTxns = await signTransactions([encodedFundTxn]);
      const validFundTxns = signedFundTxns.filter((t): t is Uint8Array => t !== null);
      if (validFundTxns.length === 0) throw new Error("Fund MBR signature rejected");
      const fundRes = await client.sendRawTransaction(validFundTxns).do();
      await algosdk.waitForConfirmation(client, fundRes.txid, 4);
      console.log(`[createBounty] MBR funded`);

      // 4. Register with Registry
      onProgress?.("REGISTERING");
      const registerTxn = await algorand.buildRegisterEscrowTxn(sender, escrowAppId, registryAppId);
      const encodedRegisterTxn = new Uint8Array(algosdk.encodeUnsignedTransaction(registerTxn));
      const signedRegisterTxns = await signTransactions([encodedRegisterTxn]);
      const validRegisterTxns = signedRegisterTxns.filter((t): t is Uint8Array => t !== null);
      if (validRegisterTxns.length === 0) throw new Error("Register signature rejected");
      const registerRes = await client.sendRawTransaction(validRegisterTxns).do();
      await algosdk.waitForConfirmation(client, registerRes.txid, 4);
      console.log(`[createBounty] Registered with registry`);

      // Read bountyId assigned by registry
      const bountyId = await algorand.readGlobalState(escrowAppId, "bountyId") ?? 0;
      console.log(`[createBounty] bountyId from escrow global state: ${bountyId}`);
      if (!bountyId) throw new Error("bountyId not set after registration");

      // 5. Deposit Reward — atomic group [AppCall, PayTxn]
      onProgress?.("DEPOSITING");
      const depositGroup = await algorand.buildDepositRewardGroup(
        sender, escrowAppId, escrowAddress, registryAppId, rewardMicroAlgo, bountyId
      );
      const encodedDepositGroup = depositGroup.map(t => new Uint8Array(algosdk.encodeUnsignedTransaction(t)));
      const signedDepositGroup = await signTransactions(encodedDepositGroup);
      const validDepositGroup = signedDepositGroup.filter((t): t is Uint8Array => t !== null);
      if (validDepositGroup.length < depositGroup.length) throw new Error("Deposit group signature rejected");
      const depositRes = await client.sendRawTransaction(validDepositGroup).do();
      await algosdk.waitForConfirmation(client, depositRes.txid, 4);
      console.log(`[createBounty] Reward deposited`);

      onProgress?.("SUCCESS");

      // Sync to Supabase (best-effort, on-chain state is source of truth)
      try {
        const dbRes = await fetch("/api/bounties/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            escrowAppId,
            registryBountyId: bountyId,
            issueUrl,
            rewardAlgo: rewardAmountAlgo,
            creatorWallet: sender
          })
        });
        if (!dbRes.ok) {
          const dbErr = await dbRes.json();
          console.warn("[createBounty] DB sync failed (non-fatal):", dbErr);
        }
      } catch (dbErr) {
        console.warn("[createBounty] DB sync error (non-fatal):", dbErr);
      }

      return { escrowAppId, bountyId };
    } catch (err: any) {
      console.error("[createBounty] Failed:", err);
      setError(err.message || "Failed to create bounty");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeAddress, signTransactions]);

  const claimBounty = useCallback(async (supabaseBountyId: string, escrowAppId: number, registryBountyId: number) => {
    if (!activeAddress || !signTransactions) throw new Error("Wallet not ready");
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const registryAppId = algorand.getRegistryAppId();
      
      const txn = await algorand.buildClaimBountyTxn(activeAddress, escrowAppId, registryAppId, registryBountyId);
      const encodedTxn = new Uint8Array(algosdk.encodeUnsignedTransaction(txn));
      const signedTxns = await signTransactions([encodedTxn]);
      const validTxns = signedTxns.filter((t): t is Uint8Array => t !== null);
      if (validTxns.length === 0) throw new Error("Claim signature rejected");
      
      const client = algorand.getAlgodClient();
      const res = await client.sendRawTransaction(validTxns).do();
      await algosdk.waitForConfirmation(client, res.txid, 4);
      
      // Update Database
      const dbRes = await fetch("/api/bounties/claim", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: supabaseBountyId, contributorWallet: activeAddress })
      });
      if (!dbRes.ok) throw new Error("Failed to sync claim with database");

      setSuccessMsg("Success! Bounty locked securely on-chain.");
    } catch (err: any) {
      setError(err.message || "Failed to claim bounty");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeAddress, signTransactions]);

  const submitWork = useCallback(async (supabaseBountyId: string, escrowAppId: number, registryBountyId: number, prUrl: string) => {
    if (!activeAddress || !signTransactions) throw new Error("Wallet not ready");
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const registryAppId = algorand.getRegistryAppId();
      
      const txn = await algorand.buildSubmitWorkTxn(activeAddress, escrowAppId, registryAppId, prUrl);
      const encodedTxn = new Uint8Array(algosdk.encodeUnsignedTransaction(txn));
      const signedTxns = await signTransactions([encodedTxn]);
      const validTxns = signedTxns.filter((t): t is Uint8Array => t !== null);
      if (validTxns.length === 0) throw new Error("Submit signature rejected");
      
      const client = algorand.getAlgodClient();
      const res = await client.sendRawTransaction(validTxns).do();
      await algosdk.waitForConfirmation(client, res.txid, 4);
      
      const dbRes = await fetch("/api/bounties/submit", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: supabaseBountyId, prUrl })
      });
      if (!dbRes.ok) throw new Error("Failed to sync submission with database");

      setSuccessMsg("Success! PR securely attached to Escrow contract.");
    } catch (err: any) {
      setError(err.message || "Failed to submit PR to blockhain");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeAddress, signTransactions]);

  return useMemo(() => ({
    isConnected,
    createBounty,
    claimBounty,
    submitWork,
    loading,
    error,
    successMsg
  }), [isConnected, createBounty, claimBounty, submitWork, loading, error, successMsg]);
}
