# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Box Reference Errors Block Transactions
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: For deterministic bugs, scope properties to concrete failing cases to ensure reproducibility
  - Test that `buildRegisterEscrowTxn` without box reference fails with "invalid Box reference 0x[bountyId]" error
  - Test that `buildDepositRewardGroup` without box reference fails with invalid box reference error
  - Test that `buildClaimBountyTxn` without box reference fails with invalid box reference error
  - Test that `buildSettleBountyTxn` without box reference fails with invalid box reference error
  - Test that bounty creation with insufficient balance (< 0.207 ALGO + reward) fails with "overspend" error from blockchain
  - Test that bounty creation with non-existent registry app ID fails with "application does not exist" error
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root causes
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 1.9_

- [x] 2. Write preservation property tests (BEFORE implementing fixes)
  - **Property 2: Preservation** - Non-Box Transaction Logic Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for successful bounty creation flows (sufficient balance, deployed registry)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Test that fee calculations remain unchanged (deploy 2000, register 2000, deposit 1000, settle 5000 microALGO)
  - Test that parameter encoding (encodeString, encodeUint64) produces same results
  - Test that atomic group structure for depositReward remains unchanged (2 transactions: app call + payment)
  - Test that registry box format remains unchanged (344 bytes with same layout)
  - Test that escrow global state values remain unchanged after successful creation
  - Test that Supabase backend sync still occurs with same data
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [x] 3. Fix bounty transaction box reference and validation issues

  - [x] 3.1 Add box reference to buildRegisterEscrowTxn
    - Read totalBounties from registry global state before building transaction
    - Calculate predictable bountyId: totalBounties + 1
    - Encode box key using algosdk.encodeUint64(bountyId)
    - Add boxes field to transaction: `[{ appIndex: registryAppId, name: algosdk.encodeUint64(totalBounties + 1) }]`
    - Handle edge case: if totalBounties cannot be read, throw clear error "Registry contract not accessible"
    - _Bug_Condition: isBugCondition(buildRegisterEscrowTxn) where triggersInnerTransaction = true AND innerTransactionPerformsBoxOperation = true AND boxes = undefined_
    - _Expected_Behavior: Transaction includes boxes field with correct registry app ID and box key (Itob of totalBounties + 1)_
    - _Preservation: Fee calculation (2000 microALGO), parameter encoding, foreign app declarations remain unchanged_
    - _Requirements: 1.1, 1.10, 2.1, 2.10, 3.3, 3.4_

  - [x] 3.2 Add box reference to buildDepositRewardGroup
    - Add bountyId parameter to function signature
    - Add boxes field to app call transaction: `[{ appIndex: registryAppId, name: algosdk.encodeUint64(bountyId) }]`
    - Maintain atomic group structure (app call + payment)
    - _Bug_Condition: isBugCondition(buildDepositRewardGroup) where triggersInnerTransaction = true AND innerTransactionPerformsBoxOperation = true AND boxes = undefined_
    - _Expected_Behavior: Transaction includes boxes field with correct bountyId box reference_
    - _Preservation: Atomic group structure, fee calculations, payment transaction remain unchanged_
    - _Requirements: 1.2, 2.2, 3.5, 3.8_

  - [x] 3.3 Add box reference to buildClaimBountyTxn
    - Add bountyId parameter to function signature
    - Add boxes field to transaction: `[{ appIndex: registryAppId, name: algosdk.encodeUint64(bountyId) }]`
    - _Bug_Condition: isBugCondition(buildClaimBountyTxn) where triggersInnerTransaction = true AND innerTransactionPerformsBoxOperation = true AND boxes = undefined_
    - _Expected_Behavior: Transaction includes boxes field with correct bountyId box reference_
    - _Preservation: Fee calculation, parameter encoding, foreign app declarations remain unchanged_
    - _Requirements: 1.3, 2.3, 3.8_

  - [x] 3.4 Add box reference to buildSettleBountyTxn
    - Add bountyId parameter to function signature
    - Add boxes field to transaction: `[{ appIndex: registryAppId, name: algosdk.encodeUint64(bountyId) }]`
    - _Bug_Condition: isBugCondition(buildSettleBountyTxn) where triggersInnerTransaction = true AND innerTransactionPerformsBoxOperation = true AND boxes = undefined_
    - _Expected_Behavior: Transaction includes boxes field with correct bountyId box reference_
    - _Preservation: Fee calculation (5000 microALGO for multiple inner txns), accounts array, parameter encoding remain unchanged_
    - _Requirements: 1.4, 2.4, 3.8_

  - [x] 3.5 Implement checkUserBalance helper function
    - Create new exported function in algorand.ts
    - Accept userAddress and requiredMicroAlgo parameters
    - Call client.accountInformation(userAddress) to get balance
    - Return object with sufficient boolean, current balance, and required balance
    - _Bug_Condition: User attempts bounty creation with insufficient balance_
    - _Expected_Behavior: Pre-flight check identifies insufficient balance before transaction signing_
    - _Preservation: No impact on existing transaction logic_
    - _Requirements: 1.5, 1.6, 2.5, 2.6_

  - [x] 3.6 Add contract connectivity verification to getRegistryAppId
    - After getting app ID from env, optionally verify contract exists
    - Call client.getApplicationByID(appId) and catch errors
    - If contract doesn't exist, throw user-friendly error: "Registry contract not deployed on testnet. Please contact support."
    - _Bug_Condition: Registry app ID does not exist or is not properly initialized_
    - _Expected_Behavior: System verifies contract connectivity and displays clear error before proceeding_
    - _Preservation: Existing app ID retrieval logic unchanged_
    - _Requirements: 1.8, 1.9, 2.8, 2.9_

  - [x] 3.7 Add pre-flight balance check to createBounty
    - Calculate total required balance: deployFee (2000) + mbrFund (200000) + registerFee (2000) + depositFee (1000) + rewardMicroAlgo
    - Call checkUserBalance before step 1 (compiling)
    - If insufficient, throw error with clear message: "Insufficient balance. Required: X ALGO (Y reward + 0.207 fees/MBR). Current: Z ALGO"
    - _Bug_Condition: User attempts bounty creation with insufficient balance_
    - _Expected_Behavior: Clear error message displayed before transaction signing_
    - _Preservation: Existing transaction flow unchanged when balance is sufficient_
    - _Requirements: 1.5, 1.6, 2.5, 2.6, 3.9_

  - [x] 3.8 Update createBounty to pass bountyId to buildDepositRewardGroup
    - After step 4 (registering), read bountyId from escrow global state
    - Verify bountyId is not 0, throw error if read fails
    - Pass bountyId as parameter to buildDepositRewardGroup
    - _Bug_Condition: buildDepositRewardGroup needs bountyId to reference correct box_
    - _Expected_Behavior: bountyId is read from escrow and passed to transaction builder_
    - _Preservation: Existing deposit flow logic unchanged_
    - _Requirements: 1.2, 2.2, 3.6_

  - [x] 3.9 Update PostBountyForm UI for clarity
    - Change label to "Reward Amount (ALGO only - ASA tokens not supported)"
    - Update helper text to show complete cost breakdown: "Total cost: X ALGO reward + ~0.207 ALGO (fees + MBR). The 0.2 ALGO MBR will be returned when the bounty is settled."
    - Display balance errors with formatted breakdown when balance check fails
    - _Bug_Condition: User confusion about token support and cost breakdown_
    - _Expected_Behavior: Clear UI indicating ALGO-only support and complete cost breakdown_
    - _Preservation: Existing form submission logic unchanged_
    - _Requirements: 1.11, 2.11_

  - [x] 3.10 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Box References Enable Transaction Success
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run bug condition exploration tests from step 1
    - Verify that buildRegisterEscrowTxn with box reference succeeds without "invalid Box reference" error
    - Verify that buildDepositRewardGroup with box reference succeeds
    - Verify that buildClaimBountyTxn with box reference succeeds
    - Verify that buildSettleBountyTxn with box reference succeeds
    - Verify that bounty creation with insufficient balance fails with clear error BEFORE signing
    - Verify that bounty creation with non-existent registry fails with clear error BEFORE signing
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9, 2.10_

  - [x] 3.11 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Box Transaction Logic Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - Verify fee calculations remain unchanged
    - Verify parameter encoding produces same results
    - Verify atomic group structure unchanged
    - Verify registry box format unchanged
    - Verify escrow global state unchanged
    - Verify backend sync unchanged
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fixes (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run complete test suite (bug condition + preservation tests)
  - Verify all tests pass
  - Test full bounty creation flow end-to-end on testnet
  - Verify box references are correctly declared in all transactions
  - Verify balance checks prevent transactions with insufficient funds
  - Verify contract connectivity checks prevent transactions with non-existent registry
  - Verify UI displays clear error messages and cost breakdowns
  - Ask the user if questions arise or if additional testing is needed
