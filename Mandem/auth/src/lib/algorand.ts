import algosdk from "algosdk";

// Create algod client for testnet
export const getAlgodClient = () => {
  const algodAddress =
    process.env.NEXT_PUBLIC_ALGOD_ADDRESS || "https://testnet-api.algonode.cloud";
  const algodToken = process.env.NEXT_PUBLIC_ALGOD_TOKEN || "";
  return new algosdk.Algodv2(algodToken, algodAddress, "");
};

// Gets the Registry App ID from env — synchronous, no network call
export const getRegistryAppId = () => {
  const id = process.env.NEXT_PUBLIC_REGISTRY_APP_ID;
  if (!id) throw new Error("NEXT_PUBLIC_REGISTRY_APP_ID not set in .env.local");
  return parseInt(id, 10);
};

// Converts the base64 compiled program to Uint8Array safely
const b64ToArray = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Fetches the compiled TEAL from our backend API
export const getCompiledPrograms = async (): Promise<{ approval: Uint8Array; clear: Uint8Array }> => {
  const res = await fetch("/api/contracts/compile");
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to fetch compiled programs");
  }
  const data = await res.json();
  return {
    approval: b64ToArray(data.approval),
    clear: b64ToArray(data.clear),
  };
};

/**
 * Utility to encode strings/integers to bytes for app_args
 */
const encodeString = (str: string) => new TextEncoder().encode(str);
const encodeUint64 = (num: number | bigint) => algosdk.encodeUint64(BigInt(num));

/**
 * 1. Deploy the Escrow Contract
 * @param userSender User's wallet address
 * @param issueUrl GitHub issue URL
 * @param deadline Timestamp when bounty expires
 * @param registryAppId The central registry app id
 * @returns ApplicationCreateTxn
 */
export const buildDeployEscrowTxn = async (
  userSender: string,
  issueUrl: string,
  deadline: number,
  registryAppId: number,
  approvalProgram: Uint8Array,
  clearProgram: Uint8Array
) => {
  const client = getAlgodClient();
  const params = await client.getTransactionParams().do();
  
  // Need extra fees for the inner txns during creation/registration
  params.fee = BigInt(2000);
  params.flatFee = true;

  return algosdk.makeApplicationCreateTxnFromObject({
    sender: userSender,
    suggestedParams: params,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram: approvalProgram,
    clearProgram: clearProgram,
    numGlobalInts: 8,
    numGlobalByteSlices: 4,
    numLocalInts: 0,
    numLocalByteSlices: 0,
    appArgs: [
      encodeUint64(BigInt(registryAppId)), // registryAppId
      encodeString(issueUrl),      // issueUrl
      encodeUint64(BigInt(deadline)),      // deadline
    ],
    foreignApps: [BigInt(registryAppId)],
  });
};

/**
 * 2. Send MBR (Minimum Balance Requirement) to Escrow
 */
export const buildFundMBRTxn = async (userSender: string, escrowAddress: string) => {
  const client = getAlgodClient();
  const params = await client.getTransactionParams().do();

  // MBR for basic escrow operations: 0.1 ALGO (basic app) + extra for boxes later if needed
  // Sending 0.3 ALGO to cover the 0.146 ALGO Box MBR requirement that the Escrow spawns in Registry
  const amount = 300000; // microAlgo
  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: userSender,
    receiver: escrowAddress,
    amount: BigInt(amount),
    suggestedParams: params,
  });
};

/**
 * 3. Register the Escrow with the Registry (call 'registerWithRegistry' on Escrow)
 */
export const buildRegisterEscrowTxn = async (
  userSender: string,
  escrowAppId: number,
  registryAppId: number
) => {
  const client = getAlgodClient();
  const params = await client.getTransactionParams().do();
  // Cost: this txn + 1 inner txn to registry
  params.fee = BigInt(2000);
  params.flatFee = true;

  const nextBountyId = (await readGlobalState(registryAppId, "totalBounties") ?? 0) + 1;
  console.log(`[buildRegisterEscrowTxn] nextBountyId=${nextBountyId}`);

  return algosdk.makeApplicationCallTxnFromObject({
    sender: userSender,
    appIndex: BigInt(escrowAppId),
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [encodeString("registerWithRegistry")],
    foreignApps: [BigInt(registryAppId)],
    boxes: [{
      appIndex: BigInt(registryAppId),
      name: algosdk.encodeUint64(nextBountyId)
    }],
    suggestedParams: params,
  });
};

/**
 * 4. Deposit Reward (Atomic Group: App Call 'depositReward' + Pay Txn)
 */
export const buildDepositRewardGroup = async (
  userSender: string,
  escrowAppId: number,
  escrowAddress: string,
  registryAppId: number,
  rewardMicroAlgo: number,
  bountyId: number
) => {
  const client = getAlgodClient();
  const params = await client.getTransactionParams().do();
  // App Call fee: covers 1 inner transaction
  const callParams = { ...params, fee: BigInt(2000), flatFee: true };

  const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
    sender: userSender,
    appIndex: BigInt(escrowAppId),
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [encodeString("depositReward")],
    foreignApps: [BigInt(registryAppId)],
    boxes: [{
      appIndex: BigInt(registryAppId),
      name: algosdk.encodeUint64(bountyId)
    }],
    suggestedParams: callParams,
  });

  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: userSender,
    receiver: escrowAddress,
    amount: BigInt(rewardMicroAlgo),
    suggestedParams: params,
  });

  const group = algosdk.assignGroupID([appCallTxn, payTxn]);
  return group;
};

/**
 * Claim Bounty ('claimBounty')
 */
export const buildClaimBountyTxn = async (
  userSender: string,
  escrowAppId: number,
  registryAppId: number,
  bountyId: number
) => {
  const client = getAlgodClient();
  const params = await client.getTransactionParams().do();
  params.fee = BigInt(2000);
  params.flatFee = true;

  return algosdk.makeApplicationCallTxnFromObject({
    sender: userSender,
    appIndex: BigInt(escrowAppId),
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [encodeString("claimBounty")],
    foreignApps: [BigInt(registryAppId)],
    boxes: [{
      appIndex: BigInt(registryAppId),
      name: algosdk.encodeUint64(bountyId)
    }],
    suggestedParams: params,
  });
};

/**
 * Submit Work ('submitWork')
 */
export const buildSubmitWorkTxn = async (
  userSender: string,
  escrowAppId: number,
  registryAppId: number,
  prUrl: string
) => {
  const client = getAlgodClient();
  const params = await client.getTransactionParams().do();
  params.fee = BigInt(2000);
  params.flatFee = true;

  return algosdk.makeApplicationCallTxnFromObject({
    sender: userSender,
    appIndex: BigInt(escrowAppId),
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [encodeString("submitWork"), encodeString(prUrl)],
    foreignApps: [BigInt(registryAppId)],
    suggestedParams: params,
  });
};

/**
 * Settle Bounty ('settleBounty')
 */
export const buildSettleBountyTxn = async (
  userSender: string,
  escrowAppId: number,
  registryAppId: number,
  contributorAddress: string,
  maintainerAddress: string,
  bountyId: number
) => {
  const client = getAlgodClient();
  const params = await client.getTransactionParams().do();
  // 1 this txn + 2 inner payments + 1 inner app call + 1 inner payment for close = 5 txns
  params.fee = BigInt(5000); 
  params.flatFee = true;

  return algosdk.makeApplicationCallTxnFromObject({
    sender: userSender,
    appIndex: BigInt(escrowAppId),
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [encodeString("settleBounty")],
    foreignApps: [BigInt(registryAppId)],
    accounts: [contributorAddress, maintainerAddress],
    boxes: [{
      appIndex: BigInt(registryAppId),
      name: algosdk.encodeUint64(bountyId)
    }],
    suggestedParams: params,
  });
};

// Helper: read a global state uint
export const readGlobalState = async (appId: number, key: string): Promise<number | undefined> => {
  const client = getAlgodClient();
  const appInfo = await client.getApplicationByID(BigInt(appId)).do();
  const globalState = appInfo.params.globalState;
  if (!globalState) return undefined;

  // In algosdk v3, globalState keys are parsed as Uint8Array
  const keyBytes = new TextEncoder().encode(key);
  const entry = globalState.find((kv: any) => {
    if (!kv.key || kv.key.length !== keyBytes.length) return false;
    return kv.key.every((b: number, i: number) => b === keyBytes[i]);
  });
  if (!entry) return undefined;

  return Number(entry.value.uint);
};

// Helper: read a global state bytes string or address
export const readGlobalStateBytes = async (appId: number, key: string, isAddress = false): Promise<string | undefined> => {
  const client = getAlgodClient();
  const appInfo = await client.getApplicationByID(BigInt(appId)).do();
  const globalState = appInfo.params.globalState;
  if (!globalState) return undefined;

  const keyBytes = new TextEncoder().encode(key);
  const entry = globalState.find((kv: any) => {
    if (!kv.key || kv.key.length !== keyBytes.length) return false;
    return kv.key.every((b: number, i: number) => b === keyBytes[i]);
  });
  if (!entry || !entry.value.bytes) return undefined;

  const uint8arrayBytes: Uint8Array = entry.value.bytes;
  if (isAddress) {
    return algosdk.encodeAddress(uint8arrayBytes);
  }
  return new TextDecoder().decode(uint8arrayBytes);
};

/**
 * Check if user has sufficient balance for a transaction
 */
export const checkUserBalance = async (
  userAddress: string,
  requiredMicroAlgo: number
): Promise<{ sufficient: boolean; current: number; required: number }> => {
  const client = getAlgodClient();
  const accountInfo = (await client.accountInformation(userAddress).do()) as any;
  
  // Try both camelCase and kebab-case for broader compatibility
  const balance = Number(accountInfo.amount ?? 0);
  const minBalance = Number(accountInfo.minBalance ?? accountInfo['min-balance'] ?? 100000);
  const freeBalance = balance - minBalance;
  
  console.log(`[checkUserBalance] Address: ${userAddress}`);
  console.log(`[checkUserBalance] Total: ${balance}, MinReq: ${minBalance}, Free: ${freeBalance}, RequiredForBounty: ${requiredMicroAlgo}`);
  
  return {
    sufficient: freeBalance >= requiredMicroAlgo,
    current: freeBalance,
    required: requiredMicroAlgo
  };
};
