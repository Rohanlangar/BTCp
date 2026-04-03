# Bounty Transaction Fixes Bugfix Design

## Overview

This bugfix addresses critical transaction failures in the bounty creation system caused by missing box references in Algorand transactions. When the escrow contract calls the registry contract via inner transactions, the registry performs box operations (App.box_put, App.box_get) but the outer transaction lacks the required box reference declarations, causing "invalid Box reference" errors. Additionally, the system lacks pre-flight balance validation, contract connectivity verification, and has poor UX with multiple wallet prompts.

The fix strategy involves:
1. Adding box reference declarations to all transaction builders that trigger inner transactions with box operations
2. Implementing predictable box key calculation (Itob of totalBounties + 1) to handle the chicken-and-egg problem
3. Adding pre-flight balance checks before transaction submission
4. Verifying registry contract deployment and connectivity
5. Batching compatible transactions to reduce wallet prompts
6. Improving error messages and UI clarity

## Glossary

- **Bug_Condition (C)**: The condition that triggers transaction failures - when transaction builders call registry methods that perform box operations without declaring box references
- **Property (P)**: The desired behavior - transactions successfully execute with proper box references declared
- **Preservation**: Existing transaction logic, fee calculations, and contract behavior that must remain unchanged
- **Box Reference**: Algorand transaction field that declares which boxes will be accessed during execution (required for box operations)
- **Inner Transaction**: A transaction created and submitted by a smart contract during execution
- **Registry App**: The central bounty registry contract (app ID 758195734) that stores bounty data in boxes
- **Escrow App**: Individual bounty escrow contracts that manage bounty lifecycle and call the registry
- **bountyId**: The unique identifier assigned by the registry (totalBounties + 1) used as the box key
- **MBR**: Minimum Balance Requirement - ALGO locked to maintain account/contract state on-chain
- **totalBounties**: Global state variable in registry tracking the count of registered bounties

## Bug Details

### Bug Condition

The bug manifests when transaction builders (`buildRegisterEscrowTxn`, `buildDepositRewardGroup`, `buildClaimBountyTxn`, `buildSettleBountyTxn`) create transactions that trigger inner transactions to the registry contract. These inner transactions perform box operations (App.box_put, App.box_get) but the outer transaction does not declare the box references in its `boxes` field, causing the Algorand runtime to reject the transaction with "invalid Box reference" errors.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type TransactionBuilder
  OUTPUT: boolean
  
  RETURN input.functionName IN ['buildRegisterEscrowTxn', 'buildDepositRewardGroup', 
                                 'buildClaimBountyTxn', 'buildSettleBountyTxn']
         AND input.triggersInnerTransaction = true
         AND input.innerTransactionPerformsBoxOperation = true
         AND input.boxes = undefined OR input.boxes.length = 0
END FUNCTION
```

### Examples

- **registerEscrow**: User calls `buildRegisterEscrowTxn` → escrow calls registry's `registerBounty` → registry executes `App.box_put(Itob(bountyId), ...)` → transaction fails with "invalid Box reference 0x0000000000000003" (where 0x03 is bountyId 3 in hex)

- **depositReward**: User calls `buildDepositRewardGroup` → escrow calls registry's `updateRewardAmount` → registry executes `App.box_get(Itob(bountyId))` and `App.box_put(...)` → transaction fails with invalid box reference error

- **claimBounty**: User calls `buildClaimBountyTxn` → escrow calls registry's `updateStatus` → registry executes `App.box_get(Itob(bountyId))` and `App.box_put(...)` → transaction fails with invalid box reference error

- **settleBounty**: User calls `buildSettleBountyTxn` → escrow calls registry's `updateStatus` → registry executes `App.box_get(Itob(bountyId))` and `App.box_put(...)` → transaction fails with invalid box reference error

- **Insufficient Balance**: User with 0.05 ALGO attempts to create a bounty with 1 ALGO reward → system proceeds to wallet signing → blockchain rejects with "overspend" error → user sees cryptic error message

- **Contract Not Deployed**: Registry app ID 758195734 does not exist on testnet → system attempts transactions → fails with unclear "application does not exist" error

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Escrow contract deployment logic must continue to work with the same parameters (registryAppId, issueUrl, deadline)
- MBR funding of 0.2 ALGO to escrow address must remain unchanged
- Inner transaction fee calculations must remain correct (2000 microALGO for transactions with 1 inner txn, 5000 for settleBounty with multiple inner txns)
- Registry contract's box storage format (344 bytes: escrow 32 + creator 32 + reward 8 + status 8 + createdAt 8 + issueUrl 256) must remain unchanged
- Registry's bountyId assignment logic (totalBounties + 1) must remain unchanged
- Atomic group structure for depositReward (app call + payment) must remain unchanged
- Transaction confirmation waiting and error handling must remain unchanged
- Supabase backend sync after successful bounty creation must remain unchanged

**Scope:**
All transaction logic that does NOT involve box reference declarations should be completely unaffected by this fix. This includes:
- Transaction parameter fetching (suggestedParams)
- Fee calculations and flatFee settings
- Application argument encoding (encodeString, encodeUint64)
- Foreign app declarations
- Account declarations
- Transaction signing and submission flow
- Confirmation waiting logic

## Hypothesized Root Cause

Based on the bug description and contract analysis, the root causes are:

1. **Missing Box References in Transaction Builders**: The transaction builder functions in `algorand.ts` do not include the `boxes` field when constructing transactions. Algorand requires that any box accessed during transaction execution (including by inner transactions) must be declared in the outer transaction's `boxes` array.

2. **Chicken-and-Egg Problem for registerEscrow**: The `buildRegisterEscrowTxn` function needs to declare a box reference for the bountyId that will be created, but the bountyId is assigned BY the registry during the registration call. However, the box key is predictable: it's `Itob(totalBounties + 1)`, so we can read `totalBounties` from the registry's global state before building the transaction.

3. **No Pre-Flight Balance Validation**: The `createBounty` function in `useBountyContracts.ts` does not check the user's ALGO balance before attempting transactions. The minimum required balance is approximately:
   - Deploy fee: 0.002 ALGO
   - Fund MBR: 0.2 ALGO
   - Register fee: 0.002 ALGO
   - Deposit fee: 0.001 ALGO
   - Reward amount: user-specified (e.g., 1 ALGO)
   - Total: ~0.207 ALGO + reward amount

4. **No Contract Connectivity Verification**: The system does not verify that the registry contract exists and is accessible before attempting to create transactions. This should be checked when `getRegistryAppId()` is called or during initialization.

5. **Multiple Wallet Prompts**: The current flow requires 4 separate transaction signings (deploy, fund, register, deposit), each triggering a wallet prompt. While some transactions cannot be batched (deploy must complete first to get the app ID), the fund + register transactions could potentially be batched into an atomic group.

6. **Unclear Error Messages**: When transactions fail, the error messages from the blockchain are technical and cryptic. The UI should provide user-friendly explanations.

## Correctness Properties

Property 1: Bug Condition - Box References Enable Transaction Success

_For any_ transaction builder call where the transaction triggers an inner transaction that performs box operations (registerEscrow, depositReward, claimBounty, settleBounty), the fixed transaction builder SHALL include a `boxes` field with the correct box reference (app ID + box key), enabling the transaction to execute successfully without "invalid Box reference" errors.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.10**

Property 2: Preservation - Non-Box Transaction Logic Unchanged

_For any_ transaction builder logic that does NOT involve box reference declarations (fee calculations, parameter encoding, foreign app declarations, confirmation waiting), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing transaction construction and submission logic.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

Property 3: Balance Validation - Pre-Flight Checks Prevent Cryptic Errors

_For any_ bounty creation attempt where the user has insufficient ALGO balance (less than fees + MBR + reward), the fixed system SHALL perform a pre-flight balance check and display a clear, user-friendly error message BEFORE attempting transaction signing, preventing cryptic blockchain "overspend" errors.

**Validates: Requirements 2.5, 2.6**

Property 4: Contract Connectivity - Early Verification Prevents Unclear Failures

_For any_ bounty creation attempt where the registry contract does not exist or is not accessible, the fixed system SHALL verify contract connectivity during initialization or before transaction construction and display a clear error message, preventing unclear "application does not exist" errors during transaction execution.

**Validates: Requirements 2.8, 2.9**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `Mandem/auth/src/lib/algorand.ts`

**Function**: `buildRegisterEscrowTxn`

**Specific Changes**:
1. **Read totalBounties from Registry**: Before building the transaction, call `readGlobalState(registryAppId, "totalBounties")` to get the current count
   - Calculate the predictable bountyId: `totalBounties + 1`
   - Encode the box key: `algosdk.encodeUint64(bountyId)`

2. **Add Box Reference**: Include the `boxes` field in the transaction object:
   ```typescript
   boxes: [{
     appIndex: registryAppId,
     name: algosdk.encodeUint64(totalBounties + 1)
   }]
   ```

3. **Handle Edge Cases**: If `totalBounties` cannot be read (registry not deployed), throw a clear error message

**Function**: `buildDepositRewardGroup`

**Specific Changes**:
1. **Add bountyId Parameter**: The function needs to know the bountyId to reference the correct box. Add `bountyId: number` as a parameter.

2. **Add Box Reference to App Call**: Include the `boxes` field in the app call transaction:
   ```typescript
   boxes: [{
     appIndex: registryAppId,
     name: algosdk.encodeUint64(bountyId)
   }]
   ```

**Function**: `buildClaimBountyTxn`

**Specific Changes**:
1. **Add bountyId Parameter**: Add `bountyId: number` as a parameter.

2. **Add Box Reference**: Include the `boxes` field:
   ```typescript
   boxes: [{
     appIndex: registryAppId,
     name: algosdk.encodeUint64(bountyId)
   }]
   ```

**Function**: `buildSettleBountyTxn`

**Specific Changes**:
1. **Add bountyId Parameter**: Add `bountyId: number` as a parameter.

2. **Add Box Reference**: Include the `boxes` field:
   ```typescript
   boxes: [{
     appIndex: registryAppId,
     name: algosdk.encodeUint64(bountyId)
   }]
   ```

**Function**: `getRegistryAppId`

**Specific Changes**:
1. **Add Connectivity Verification**: After getting the app ID from env, optionally verify the contract exists by calling `client.getApplicationByID(appId)` and catching errors

2. **Return Clear Error**: If the contract doesn't exist, throw a user-friendly error: "Registry contract not deployed on testnet. Please contact support."

**New Function**: `checkUserBalance`

**Specific Changes**:
1. **Create Balance Check Helper**: Add a new exported function:
   ```typescript
   export const checkUserBalance = async (
     userAddress: string,
     requiredMicroAlgo: number
   ): Promise<{ sufficient: boolean; current: number; required: number }> => {
     const client = getAlgodClient();
     const accountInfo = await client.accountInformation(userAddress).do();
     const balance = accountInfo.amount;
     return {
       sufficient: balance >= requiredMicroAlgo,
       current: balance,
       required: requiredMicroAlgo
     };
   };
   ```

**File**: `Mandem/auth/src/hooks/useBountyContracts.ts`

**Function**: `createBounty`

**Specific Changes**:
1. **Add Pre-Flight Balance Check**: Before step 1 (compiling), calculate total required balance and check user balance:
   ```typescript
   const deployFee = 2000;
   const mbrFund = 200000;
   const registerFee = 2000;
   const depositFee = 1000;
   const rewardMicroAlgo = Math.floor(rewardAmountAlgo * 1_000_000);
   const totalRequired = deployFee + mbrFund + registerFee + depositFee + rewardMicroAlgo;
   
   const balanceCheck = await algorand.checkUserBalance(sender, totalRequired);
   if (!balanceCheck.sufficient) {
     throw new Error(
       `Insufficient balance. Required: ${totalRequired / 1_000_000} ALGO ` +
       `(${rewardAmountAlgo} reward + 0.207 fees/MBR). ` +
       `Current: ${balanceCheck.current / 1_000_000} ALGO`
     );
   }
   ```

2. **Pass bountyId to depositReward**: After step 4 (registering), read the bountyId and pass it to `buildDepositRewardGroup`:
   ```typescript
   const bountyId = await algorand.readGlobalState(escrowAppId, "bountyId") || 0;
   if (!bountyId) throw new Error("Failed to read bountyId from escrow");
   
   const depositGroup = await algorand.buildDepositRewardGroup(
     sender,
     escrowAppId,
     escrowAddress,
     registryAppId,
     rewardMicroAlgo,
     bountyId  // NEW PARAMETER
   );
   ```

3. **Add Contract Connectivity Check**: At the start of the function, verify the registry exists:
   ```typescript
   const registryAppId = algorand.getRegistryAppId();
   // This will throw if contract doesn't exist
   ```

4. **Improve Error Messages**: Wrap transaction steps in try-catch blocks with user-friendly error messages for common failures

**File**: `Mandem/auth/src/components/bounty/PostBountyForm.tsx`

**Specific Changes**:
1. **Update UI Text**: Change "Reward Amount (ALGO)" label to clarify ALGO-only support:
   ```tsx
   <label>Reward Amount (ALGO only - ASA tokens not supported)</label>
   ```

2. **Update MBR Explanation**: Update the helper text to show the complete cost breakdown:
   ```tsx
   <p className="text-xs text-gray-500 mt-2">
     Total cost: {rewardAmount} ALGO reward + ~0.207 ALGO (fees + MBR). 
     The 0.2 ALGO MBR will be returned when the bounty is settled.
   </p>
   ```

3. **Display Balance Errors Clearly**: When balance check fails, show a formatted error with breakdown

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate the bounty creation flow on UNFIXED code and observe the specific error messages. Verify that the errors match "invalid Box reference" for transaction builders and "overspend" for balance issues.

**Test Cases**:
1. **Register Escrow Without Box Reference**: Call `buildRegisterEscrowTxn` on unfixed code, submit transaction, observe "invalid Box reference 0x0000000000000003" error (will fail on unfixed code)
2. **Deposit Reward Without Box Reference**: Call `buildDepositRewardGroup` on unfixed code after successful registration, observe invalid box reference error (will fail on unfixed code)
3. **Claim Bounty Without Box Reference**: Call `buildClaimBountyTxn` on unfixed code, observe invalid box reference error (will fail on unfixed code)
4. **Settle Bounty Without Box Reference**: Call `buildSettleBountyTxn` on unfixed code, observe invalid box reference error (will fail on unfixed code)
5. **Insufficient Balance Test**: Attempt bounty creation with user balance < 0.207 ALGO + reward, observe "overspend" error from blockchain (will fail on unfixed code)
6. **Registry Not Deployed Test**: Set invalid registry app ID, attempt bounty creation, observe "application does not exist" error (will fail on unfixed code)

**Expected Counterexamples**:
- Transactions fail with "invalid Box reference 0x[bountyId in hex]" errors
- Balance errors occur during transaction submission, not before
- Contract connectivity errors occur during transaction execution, not during initialization
- Possible causes: missing `boxes` field in transaction builders, no pre-flight validation

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL transactionBuilder WHERE isBugCondition(transactionBuilder) DO
  result := transactionBuilder_fixed(params)
  ASSERT result.boxes IS NOT NULL
  ASSERT result.boxes.length > 0
  ASSERT result.boxes[0].appIndex = registryAppId
  ASSERT result.boxes[0].name = expectedBoxKey
  
  // Submit transaction and verify success
  signedTxn := signTransaction(result)
  txId := submitTransaction(signedTxn)
  confirmation := waitForConfirmation(txId)
  ASSERT confirmation.confirmedRound > 0
END FOR

FOR ALL bountyCreation WHERE userBalance < requiredBalance DO
  TRY
    createBounty_fixed(params)
    FAIL("Should have thrown balance error")
  CATCH error
    ASSERT error.message CONTAINS "Insufficient balance"
    ASSERT error.message CONTAINS breakdown of costs
  END TRY
END FOR

FOR ALL bountyCreation WHERE registryNotDeployed DO
  TRY
    createBounty_fixed(params)
    FAIL("Should have thrown connectivity error")
  CATCH error
    ASSERT error.message CONTAINS "Registry contract not deployed"
  END TRY
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL transactionLogic WHERE NOT involvesBoxReferences(transactionLogic) DO
  ASSERT feeCalculation_original() = feeCalculation_fixed()
  ASSERT parameterEncoding_original(args) = parameterEncoding_fixed(args)
  ASSERT foreignAppDeclarations_original() = foreignAppDeclarations_fixed()
  ASSERT confirmationWaiting_original(txId) = confirmationWaiting_fixed(txId)
END FOR

FOR ALL bountyCreation WHERE userBalance >= requiredBalance AND registryDeployed DO
  // Verify the flow completes successfully with same results
  result_original := createBounty_original(params)
  result_fixed := createBounty_fixed(params)
  
  ASSERT result_original.escrowAppId = result_fixed.escrowAppId
  ASSERT result_original.bountyId = result_fixed.bountyId
  ASSERT registryBoxContents_original = registryBoxContents_fixed
  ASSERT escrowGlobalState_original = escrowGlobalState_fixed
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for successful bounty creation flows (with sufficient balance, deployed registry), then write property-based tests capturing that behavior.

**Test Cases**:
1. **Fee Calculation Preservation**: Verify that fee calculations (2000 for deploy, 2000 for register, etc.) remain unchanged after fix
2. **Parameter Encoding Preservation**: Verify that encodeString and encodeUint64 produce the same results after fix
3. **Atomic Group Structure Preservation**: Verify that depositReward atomic group still has 2 transactions (app call + payment) in the same order
4. **Registry Box Format Preservation**: Verify that the box contents (344 bytes with same layout) are identical after fix
5. **Escrow Global State Preservation**: Verify that escrow global state values (bountyCreator, rewardAmount, status, etc.) are identical after fix
6. **Backend Sync Preservation**: Verify that Supabase sync still occurs with the same data after fix

### Unit Tests

- Test `buildRegisterEscrowTxn` with box reference includes correct app ID and box key (Itob of totalBounties + 1)
- Test `buildDepositRewardGroup` with box reference includes correct bountyId
- Test `buildClaimBountyTxn` with box reference includes correct bountyId
- Test `buildSettleBountyTxn` with box reference includes correct bountyId
- Test `checkUserBalance` returns correct sufficient/insufficient status
- Test `getRegistryAppId` throws clear error when contract doesn't exist
- Test balance check calculation includes all fees (deploy 2000 + MBR 200000 + register 2000 + deposit 1000 + reward)
- Test edge case: totalBounties = 0 (first bounty) calculates box key correctly
- Test edge case: totalBounties = 999 (large bountyId) encodes correctly

### Property-Based Tests

- Generate random reward amounts (0.5 to 100 ALGO) and verify balance check calculates correct total required
- Generate random user balances and verify balance check correctly identifies sufficient/insufficient
- Generate random totalBounties values (0 to 10000) and verify box key calculation is always Itob(totalBounties + 1)
- Generate random bountyId values and verify all transaction builders include correct box reference
- Test that for any successful bounty creation, the registry box contents match the expected format
- Test that for any successful bounty creation, the escrow global state matches expected values

### Integration Tests

- Test full bounty creation flow with sufficient balance and deployed registry (should succeed)
- Test full bounty creation flow with insufficient balance (should fail with clear error before signing)
- Test full bounty creation flow with non-existent registry (should fail with clear error before signing)
- Test registerEscrow transaction with box reference (should succeed without "invalid Box reference" error)
- Test depositReward transaction with box reference (should succeed and update registry box)
- Test claimBounty transaction with box reference (should succeed and update status in registry box)
- Test settleBounty transaction with box reference (should succeed and update status in registry box)
- Test that MBR is returned to creator after settlement
- Test that platform fee is paid to maintainer after settlement
- Test that backend Supabase sync occurs with correct data after successful creation
