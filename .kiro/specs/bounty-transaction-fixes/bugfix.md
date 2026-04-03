# Bugfix Requirements Document

## Introduction

This document addresses multiple critical blocking issues in the bounty creation system that prevent users from successfully creating bounties on the Algorand blockchain. The primary issue is an "invalid Box reference 0x0000000000000003" error at registry app 758195734, caused by missing box reference declarations in transaction builders. Additional issues include insufficient funds validation, poor UX with multiple wallet prompts, and lack of contract connectivity verification.

The bugs affect the core bounty creation flow: deploy escrow → fund MBR → register with registry → deposit reward. Users cannot complete this flow due to transaction failures and cryptic error messages.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `buildRegisterEscrowTxn` is called and the inner transaction to registry's `registerBounty` executes `App.box_put()` THEN the transaction fails with "invalid Box reference 0x0000000000000003" error

1.2 WHEN `buildDepositRewardGroup` is called and the inner transaction to registry's `updateRewardAmount` accesses box storage THEN the transaction fails with invalid box reference error

1.3 WHEN `buildClaimBountyTxn` is called and the inner transaction to registry's `updateStatus` accesses box storage THEN the transaction fails with invalid box reference error

1.4 WHEN `buildSettleBountyTxn` is called and the inner transaction to registry's `updateStatus` accesses box storage THEN the transaction fails with invalid box reference error

1.5 WHEN a user with 0 ALGO balance attempts to create a bounty THEN the system proceeds to transaction signing and fails with cryptic "overspend" error from the blockchain

1.6 WHEN a user with insufficient ALGO balance (less than ~0.207 ALGO for fees + MBR + reward) attempts to create a bounty THEN the system proceeds to transaction signing and fails with cryptic overspend error

1.7 WHEN the bounty creation flow executes THEN the user must sign 4 separate transactions (deploy, fund, register, deposit) resulting in 4 wallet prompts

1.8 WHEN registry app ID 758195734 does not exist or is not properly initialized THEN the system attempts transactions anyway and fails with unclear errors

1.9 WHEN the user attempts to create a bounty THEN the system does not verify that the registry contract is deployed and accessible before proceeding

1.10 WHEN `buildRegisterEscrowTxn` needs to declare a box reference for the bountyId THEN it cannot because the bountyId is assigned BY the registry during registration (chicken-and-egg problem)

1.11 WHEN a user mentions sending "tokens" in the UI THEN there is confusion because the system only supports ALGO, not ASA tokens

### Expected Behavior (Correct)

2.1 WHEN `buildRegisterEscrowTxn` is called THEN the transaction SHALL include a `boxes` field with a reference to the box that will be created by the registry's inner transaction

2.2 WHEN `buildDepositRewardGroup` is called THEN the app call transaction SHALL include a `boxes` field with a reference to the bountyId box

2.3 WHEN `buildClaimBountyTxn` is called THEN the transaction SHALL include a `boxes` field with a reference to the bountyId box

2.4 WHEN `buildSettleBountyTxn` is called THEN the transaction SHALL include a `boxes` field with a reference to the bountyId box

2.5 WHEN a user attempts to create a bounty THEN the system SHALL perform a pre-flight balance check and display a clear error message if the user has insufficient funds (minimum ~0.207 ALGO)

2.6 WHEN a user has insufficient balance THEN the system SHALL display a user-friendly message explaining the minimum required balance and its breakdown (fees + MBR + reward)

2.7 WHEN the bounty creation flow executes THEN the system SHALL batch compatible transactions into atomic groups to minimize wallet prompts where possible

2.8 WHEN the system initializes THEN it SHALL verify that the registry contract (app ID 758195734) exists and is accessible

2.9 WHEN a user attempts to create a bounty THEN the system SHALL verify contract connectivity before proceeding with transaction construction

2.10 WHEN `buildRegisterEscrowTxn` needs to declare a box reference THEN it SHALL use the predictable box key format (Itob of totalBounties + 1) to reference the box that will be created

2.11 WHEN a user views the bounty creation form THEN the UI SHALL clearly indicate that only ALGO is supported, not ASA tokens

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `buildDeployEscrowTxn` is called with valid parameters THEN the system SHALL CONTINUE TO create and deploy the escrow contract successfully

3.2 WHEN `buildFundMBRTxn` is called with valid parameters THEN the system SHALL CONTINUE TO send 0.2 ALGO MBR to the escrow address

3.3 WHEN the escrow contract's `registerWithRegistry` method executes THEN it SHALL CONTINUE TO call the registry's `registerBounty` method via inner transaction

3.4 WHEN the registry's `registerBounty` method executes THEN it SHALL CONTINUE TO assign a new bountyId (totalBounties + 1) and store the bounty data in a box

3.5 WHEN the deposit reward atomic group executes THEN it SHALL CONTINUE TO call `depositReward` on the escrow and send the payment in the same group

3.6 WHEN the escrow contract reads the bountyId from its global state THEN it SHALL CONTINUE TO return the correct bountyId assigned by the registry

3.7 WHEN a user successfully creates a bounty THEN the system SHALL CONTINUE TO sync the bounty data with the Supabase backend

3.8 WHEN transaction fees are calculated THEN the system SHALL CONTINUE TO use the correct fee amounts (2000 microALGO for transactions with inner txns)

3.9 WHEN the user signs transactions THEN the system SHALL CONTINUE TO wait for confirmation before proceeding to the next step

3.10 WHEN a bounty is successfully created THEN the system SHALL CONTINUE TO display the escrow app ID and registry bounty ID to the user
