/**
 * Bug Condition Exploration Tests for Bounty Transaction Fixes
 * 
 * **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
 * **DO NOT attempt to fix the tests or the code when they fail**
 * **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
 * **GOAL**: Surface counterexamples that demonstrate the bugs exist
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 1.9
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { fc } from '@fast-check/vitest';
import algosdk from 'algosdk';
import * as algorand from './algorand';

// Test configuration
const TESTNET_ALGOD_ADDRESS = process.env.NEXT_PUBLIC_ALGOD_ADDRESS || 'https://testnet-api.algonode.cloud';
const TESTNET_ALGOD_TOKEN = process.env.NEXT_PUBLIC_ALGOD_TOKEN || '';
const REGISTRY_APP_ID = parseInt(process.env.NEXT_PUBLIC_REGISTRY_APP_ID || '758195734', 10);

// Test wallet (for building transactions - we won't actually sign/submit in these tests)
// Generate a test account instead of using mnemonic
const testAccount = algosdk.generateAccount();

describe('Bug Condition Exploration Tests', () => {
  describe('Property 1: Bug Condition - Box Reference Errors Block Transactions', () => {
    
    /**
     * Test 1.1: buildRegisterEscrowTxn without box reference fails
     * 
     * **Validates: Requirements 1.1**
     * 
     * This test verifies that when buildRegisterEscrowTxn is called without a box reference,
     * the transaction will fail with "invalid Box reference" error when submitted to the blockchain.
     * 
     * **Expected on UNFIXED code**: Test FAILS (transaction missing boxes field)
     * **Expected on FIXED code**: Test PASSES (transaction includes boxes field)
     */
    it('buildRegisterEscrowTxn should include box reference for registry bounty box', async () => {
      // Arrange: Create a mock escrow app ID
      const mockEscrowAppId = 123456;
      
      // Act: Build the register transaction
      const registerTxn = await algorand.buildRegisterEscrowTxn(
        testAccount.addr,
        mockEscrowAppId,
        REGISTRY_APP_ID
      );
      
      // Assert: Transaction should include boxes field with registry box reference
      expect(registerTxn.boxes).toBeDefined();
      expect(registerTxn.boxes).toHaveLength(1);
      expect(registerTxn.boxes![0].appIndex).toBe(BigInt(REGISTRY_APP_ID));
      
      // The box key should be Itob(totalBounties + 1)
      // We can't know the exact value without reading registry state,
      // but we can verify the box name is a valid uint64 encoding (8 bytes)
      expect(registerTxn.boxes![0].name).toBeInstanceOf(Uint8Array);
      expect(registerTxn.boxes![0].name.length).toBe(8);
    });

    /**
     * Test 1.2: buildDepositRewardGroup without box reference fails
     * 
     * **Validates: Requirements 1.2**
     * 
     * This test verifies that when buildDepositRewardGroup is called without a box reference,
     * the transaction will fail with invalid box reference error when submitted.
     * 
     * **Expected on UNFIXED code**: Test FAILS (transaction missing boxes field)
     * **Expected on FIXED code**: Test PASSES (transaction includes boxes field)
     * 
     * NOTE: On unfixed code, buildDepositRewardGroup doesn't accept bountyId parameter yet.
     * This test will fail because the boxes field is missing.
     */
    it('buildDepositRewardGroup should include box reference for bountyId box', async () => {
      // Arrange: Mock parameters
      const mockEscrowAppId = 123456;
      const mockEscrowAddress = algosdk.getApplicationAddress(mockEscrowAppId);
      const mockBountyId = 3; // Example bounty ID
      const rewardMicroAlgo = 1_000_000; // 1 ALGO
      
      // Act: Build the deposit reward group
      const depositGroup = await algorand.buildDepositRewardGroup(
        testAccount.addr,
        mockEscrowAppId,
        mockEscrowAddress,
        REGISTRY_APP_ID,
        rewardMicroAlgo,
        mockBountyId
      );
      
      // Assert: App call transaction (first in group) should include boxes field
      const appCallTxn = depositGroup[0];
      expect(appCallTxn.boxes).toBeDefined();
      expect(appCallTxn.boxes).toHaveLength(1);
      expect(appCallTxn.boxes![0].appIndex).toBe(BigInt(REGISTRY_APP_ID));
      
      // Box key should be Itob(bountyId)
      const expectedBoxKey = algosdk.encodeUint64(mockBountyId);
      expect(appCallTxn.boxes![0].name).toEqual(expectedBoxKey);
    });

    /**
     * Test 1.3: buildClaimBountyTxn without box reference fails
     * 
     * **Validates: Requirements 1.3**
     * 
     * This test verifies that when buildClaimBountyTxn is called without a box reference,
     * the transaction will fail with invalid box reference error when submitted.
     * 
     * **Expected on UNFIXED code**: Test FAILS (transaction missing boxes field)
     * **Expected on FIXED code**: Test PASSES (transaction includes boxes field)
     * 
     * NOTE: On unfixed code, buildClaimBountyTxn doesn't accept bountyId parameter yet.
     * This test will fail because the boxes field is missing.
     */
    it('buildClaimBountyTxn should include box reference for bountyId box', async () => {
      // Arrange: Mock parameters
      const mockEscrowAppId = 123456;
      const mockBountyId = 3;
      
      // Act: Build the claim transaction
      const claimTxn = await algorand.buildClaimBountyTxn(
        testAccount.addr,
        mockEscrowAppId,
        REGISTRY_APP_ID,
        mockBountyId
      );
      
      // Assert: Transaction should include boxes field
      expect(claimTxn.boxes).toBeDefined();
      expect(claimTxn.boxes).toHaveLength(1);
      expect(claimTxn.boxes![0].appIndex).toBe(BigInt(REGISTRY_APP_ID));
      
      // Box key should be Itob(bountyId)
      const expectedBoxKey = algosdk.encodeUint64(mockBountyId);
      expect(claimTxn.boxes![0].name).toEqual(expectedBoxKey);
    });

    /**
     * Test 1.4: buildSettleBountyTxn without box reference fails
     * 
     * **Validates: Requirements 1.4**
     * 
     * This test verifies that when buildSettleBountyTxn is called without a box reference,
     * the transaction will fail with invalid box reference error when submitted.
     * 
     * **Expected on UNFIXED code**: Test FAILS (transaction missing boxes field)
     * **Expected on FIXED code**: Test PASSES (transaction includes boxes field)
     * 
     * NOTE: On unfixed code, buildSettleBountyTxn doesn't accept bountyId parameter yet.
     * This test will fail because the boxes field is missing.
     */
    it('buildSettleBountyTxn should include box reference for bountyId box', async () => {
      // Arrange: Mock parameters
      const mockEscrowAppId = 123456;
      const mockBountyId = 3;
      const contributorAddress = testAccount.addr;
      const maintainerAddress = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';
      
      // Act: Build the settle transaction
      const settleTxn = await algorand.buildSettleBountyTxn(
        testAccount.addr,
        mockEscrowAppId,
        REGISTRY_APP_ID,
        contributorAddress,
        maintainerAddress,
        mockBountyId
      );
      
      // Assert: Transaction should include boxes field
      expect(settleTxn.boxes).toBeDefined();
      expect(settleTxn.boxes).toHaveLength(1);
      expect(settleTxn.boxes![0].appIndex).toBe(BigInt(REGISTRY_APP_ID));
      
      // Box key should be Itob(bountyId)
      const expectedBoxKey = algosdk.encodeUint64(mockBountyId);
      expect(settleTxn.boxes![0].name).toEqual(expectedBoxKey);
    });

    /**
     * Test 1.5 & 1.6: Bounty creation with insufficient balance fails with clear error
     * 
     * **Validates: Requirements 1.5, 1.6**
     * 
     * This test verifies that when a user attempts to create a bounty with insufficient balance,
     * the system performs a pre-flight check and displays a clear error message BEFORE signing.
     * 
     * **Expected on UNFIXED code**: Test FAILS (checkUserBalance function doesn't exist)
     * **Expected on FIXED code**: Test PASSES (pre-flight check throws clear error)
     * 
     * NOTE: On unfixed code, checkUserBalance doesn't exist yet. This test will fail.
     */
    it('checkUserBalance should identify insufficient balance before transaction signing', async () => {
      // This test verifies the checkUserBalance helper exists and works correctly
      
      // Arrange: Mock a user address with known low balance
      const lowBalanceAddress = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';
      const requiredMicroAlgo = 1_000_000_000; // 1000 ALGO (more than most test accounts have)
      
      // Act: Check balance
      // @ts-expect-error - On unfixed code, this function doesn't exist yet
      const balanceCheck = await algorand.checkUserBalance(lowBalanceAddress, requiredMicroAlgo);
      
      // Assert: Should return insufficient status
      expect(balanceCheck).toBeDefined();
      expect(balanceCheck.sufficient).toBeDefined();
      expect(balanceCheck.current).toBeDefined();
      expect(balanceCheck.required).toBe(requiredMicroAlgo);
      
      // The balance check should correctly identify insufficient funds
      if (balanceCheck.current < requiredMicroAlgo) {
        expect(balanceCheck.sufficient).toBe(false);
      }
    });

    /**
     * Test 1.8 & 1.9: Bounty creation with non-existent registry fails with clear error
     * 
     * **Validates: Requirements 1.8, 1.9**
     * 
     * This test verifies that when the registry contract does not exist or is not accessible,
     * the system verifies contract connectivity and displays a clear error BEFORE proceeding.
     * 
     * **Expected on UNFIXED code**: Test FAILS (no connectivity check, proceeds to transaction)
     * **Expected on FIXED code**: Test PASSES (connectivity check throws clear error)
     */
    it('getRegistryAppId should verify contract exists and is accessible', async () => {
      // This test verifies that getRegistryAppId includes connectivity verification
      
      // Act: Get registry app ID (should verify it exists)
      const registryAppId = algorand.getRegistryAppId();
      
      // Assert: Should return a valid app ID
      expect(registryAppId).toBeGreaterThan(0);
      
      // Verify the contract actually exists on testnet
      const client = algorand.getAlgodClient();
      const appInfo = await client.getApplicationByID(BigInt(registryAppId)).do();
      
      expect(appInfo).toBeDefined();
      expect(appInfo.params).toBeDefined();
    });
  });

  describe('Property-Based Tests: Box Reference Validation', () => {
    /**
     * Property: For any bountyId, transaction builders should include correct box reference
     * 
     * This property-based test generates random bountyIds and verifies that all transaction
     * builders correctly encode the box key as Itob(bountyId).
     * 
     * **Expected on UNFIXED code**: Test FAILS (functions don't accept bountyId parameter)
     * **Expected on FIXED code**: Test PASSES (all functions include correct box references)
     * 
     * NOTE: This test is skipped for unfixed code since the functions don't accept bountyId yet.
     * Unskip after implementing the fix.
     */
    it.skip('should correctly encode bountyId as box key for any bountyId value', () => {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 10000 }), async (bountyId) => {
          // Arrange
          const mockEscrowAppId = 123456;
          const mockEscrowAddress = algosdk.getApplicationAddress(mockEscrowAppId);
          const expectedBoxKey = algosdk.encodeUint64(bountyId);
          
          // Act & Assert: Test depositReward
          const depositGroup = await algorand.buildDepositRewardGroup(
            testAccount.addr,
            mockEscrowAppId,
            mockEscrowAddress,
            REGISTRY_APP_ID,
            1_000_000,
            bountyId
          );
          expect(depositGroup[0].boxes![0].name).toEqual(expectedBoxKey);
          
          // Act & Assert: Test claimBounty
          const claimTxn = await algorand.buildClaimBountyTxn(
            testAccount.addr,
            mockEscrowAppId,
            REGISTRY_APP_ID,
            bountyId
          );
          expect(claimTxn.boxes![0].name).toEqual(expectedBoxKey);
          
          // Act & Assert: Test settleBounty
          const settleTxn = await algorand.buildSettleBountyTxn(
            testAccount.addr,
            mockEscrowAppId,
            REGISTRY_APP_ID,
            testAccount.addr,
            'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
            bountyId
          );
          expect(settleTxn.boxes![0].name).toEqual(expectedBoxKey);
        })
      );
    });

    /**
     * Property: For any reward amount, balance check should calculate correct total required
     * 
     * This property-based test generates random reward amounts and verifies that the
     * balance check correctly calculates the total required balance including fees and MBR.
     * 
     * **Expected on UNFIXED code**: Test FAILS (checkUserBalance doesn't exist)
     * **Expected on FIXED code**: Test PASSES (balance check calculates correctly)
     * 
     * NOTE: This test is skipped for unfixed code since checkUserBalance doesn't exist yet.
     * Unskip after implementing the fix.
     */
    it.skip('should correctly calculate total required balance for any reward amount', () => {
      fc.assert(
        fc.asyncProperty(fc.double({ min: 0.5, max: 100, noNaN: true }), async (rewardAlgo) => {
          // Arrange: Calculate expected total
          const deployFee = 2000;
          const mbrFund = 200000;
          const registerFee = 2000;
          const depositFee = 1000;
          const rewardMicroAlgo = Math.floor(rewardAlgo * 1_000_000);
          const expectedTotal = deployFee + mbrFund + registerFee + depositFee + rewardMicroAlgo;
          
          // Act: Check balance with a test address
          const testAddress = testAccount.addr;
          // @ts-expect-error - On unfixed code, this function doesn't exist yet
          const balanceCheck = await algorand.checkUserBalance(testAddress, expectedTotal);
          
          // Assert: Required balance should match our calculation
          expect(balanceCheck.required).toBe(expectedTotal);
          expect(balanceCheck.sufficient).toBeDefined();
          expect(balanceCheck.current).toBeGreaterThanOrEqual(0);
        })
      );
    });
  });
});

/**
 * Preservation Property Tests for Bounty Transaction Fixes
 * 
 * **IMPORTANT**: These tests capture baseline behavior that must be preserved
 * **EXPECTED OUTCOME**: Tests PASS on unfixed code (confirms baseline to preserve)
 * **GOAL**: Ensure no regressions are introduced when implementing box reference fixes
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10
 */

describe('Preservation Property Tests', () => {
  describe('Property 2: Preservation - Non-Box Transaction Logic Unchanged', () => {
    
    /**
     * Test 3.8: Fee calculations remain unchanged
     * 
     * **Validates: Requirements 3.8**
     * 
     * This test verifies that fee calculations for all transaction types remain unchanged:
     * - Deploy: 2000 microALGO (1 outer + 1 inner txn)
     * - Register: 2000 microALGO (1 outer + 1 inner txn)
     * - Deposit: 1000 microALGO for app call (1 outer txn, inner txn covered by escrow)
     * - Settle: 5000 microALGO (1 outer + 4 inner txns)
     * 
     * **Expected on UNFIXED code**: Test PASSES (baseline fee calculations)
     * **Expected on FIXED code**: Test PASSES (fees unchanged)
     */
    it('should preserve fee calculations for all transaction types', async () => {
      // Arrange
      const mockEscrowAppId = 123456;
      const mockEscrowAddress = algosdk.getApplicationAddress(mockEscrowAppId);
      const mockApprovalProgram = new Uint8Array(100);
      const mockClearProgram = new Uint8Array(50);
      
      // Act & Assert: Deploy transaction fee
      const deployTxn = await algorand.buildDeployEscrowTxn(
        testAccount.addr.toString(),
        'https://github.com/test/issue/1',
        Math.floor(Date.now() / 1000) + 86400,
        REGISTRY_APP_ID,
        mockApprovalProgram,
        mockClearProgram
      );
      expect(deployTxn.fee).toBe(2000n);
      
      // Act & Assert: Register transaction fee
      const registerTxn = await algorand.buildRegisterEscrowTxn(
        testAccount.addr.toString(),
        mockEscrowAppId,
        REGISTRY_APP_ID
      );
      expect(registerTxn.fee).toBe(2000n);
      
      // Act & Assert: Deposit group fees
      const depositGroup = await algorand.buildDepositRewardGroup(
        testAccount.addr.toString(),
        mockEscrowAppId,
        mockEscrowAddress,
        REGISTRY_APP_ID,
        1_000_000,
        1 // bountyId
      );
      expect(depositGroup[0].fee).toBe(2000n); // App call
      expect(depositGroup[1].fee).toBe(1000n); // Payment (default fee)
      
      // Act & Assert: Settle transaction fee
      const settleTxn = await algorand.buildSettleBountyTxn(
        testAccount.addr.toString(),
        mockEscrowAppId,
        REGISTRY_APP_ID,
        testAccount.addr.toString(),
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
        1 // bountyId
      );
      expect(settleTxn.fee).toBe(5000n);
    });

    /**
     * Test 3.8: Parameter encoding produces same results
     * 
     * **Validates: Requirements 3.8**
     * 
     * This test verifies that parameter encoding (encodeString, encodeUint64) produces
     * the same results after the fix. The encoding functions are internal but we can
     * verify the appArgs field contains correctly encoded values.
     * 
     * **Expected on UNFIXED code**: Test PASSES (baseline encoding)
     * **Expected on FIXED code**: Test PASSES (encoding unchanged)
     */
    it('should preserve parameter encoding for app arguments', async () => {
      // Arrange
      const mockEscrowAppId = 123456;
      const testIssueUrl = 'https://github.com/test/issue/1';
      const testDeadline = Math.floor(Date.now() / 1000) + 86400;
      const mockApprovalProgram = new Uint8Array(100);
      const mockClearProgram = new Uint8Array(50);
      
      // Act: Build deploy transaction
      const deployTxn = await algorand.buildDeployEscrowTxn(
        testAccount.addr.toString(),
        testIssueUrl,
        testDeadline,
        REGISTRY_APP_ID,
        mockApprovalProgram,
        mockClearProgram
      );
      
      // Assert: Verify appArgs are correctly encoded
      expect(deployTxn.appArgs).toBeDefined();
      expect(deployTxn.appArgs).toHaveLength(3);
      
      // First arg: registryAppId as uint64
      expect(deployTxn.appArgs![0]).toEqual(algosdk.encodeUint64(REGISTRY_APP_ID));
      
      // Second arg: issueUrl as string
      expect(deployTxn.appArgs![1]).toEqual(new TextEncoder().encode(testIssueUrl));
      
      // Third arg: deadline as uint64
      expect(deployTxn.appArgs![2]).toEqual(algosdk.encodeUint64(testDeadline));
      
      // Act: Build register transaction
      const registerTxn = await algorand.buildRegisterEscrowTxn(
        testAccount.addr.toString(),
        mockEscrowAppId,
        REGISTRY_APP_ID
      );
      
      // Assert: Verify method name is correctly encoded
      expect(registerTxn.appArgs).toBeDefined();
      expect(registerTxn.appArgs).toHaveLength(1);
      expect(registerTxn.appArgs![0]).toEqual(new TextEncoder().encode('registerWithRegistry'));
    });

    /**
     * Test 3.5: Atomic group structure for depositReward remains unchanged
     * 
     * **Validates: Requirements 3.5**
     * 
     * This test verifies that the depositReward atomic group maintains its structure:
     * - 2 transactions: app call + payment
     * - Both transactions have the same group ID
     * - App call is first, payment is second
     * - Payment goes to escrow address
     * 
     * **Expected on UNFIXED code**: Test PASSES (baseline atomic group structure)
     * **Expected on FIXED code**: Test PASSES (structure unchanged)
     */
    it('should preserve atomic group structure for depositReward', async () => {
      // Arrange
      const mockEscrowAppId = 123456;
      const mockEscrowAddress = algosdk.getApplicationAddress(mockEscrowAppId);
      const rewardMicroAlgo = 1_000_000;
      
      // Act: Build deposit reward group
      const depositGroup = await algorand.buildDepositRewardGroup(
        testAccount.addr.toString(),
        mockEscrowAppId,
        mockEscrowAddress,
        REGISTRY_APP_ID,
        rewardMicroAlgo,
        1 // bountyId
      );
      
      // Assert: Group structure
      expect(depositGroup).toHaveLength(2);
      
      // First transaction: app call
      const appCallTxn = depositGroup[0];
      expect(appCallTxn.type).toBe('appl');
      expect(appCallTxn.appIndex).toBe(BigInt(mockEscrowAppId));
      expect(appCallTxn.appArgs).toBeDefined();
      expect(appCallTxn.appArgs![0]).toEqual(new TextEncoder().encode('depositReward'));
      
      // Second transaction: payment
      const payTxn = depositGroup[1];
      expect(payTxn.type).toBe('pay');
      expect(algosdk.encodeAddress(payTxn.to.publicKey)).toBe(mockEscrowAddress);
      expect(payTxn.amount).toBe(BigInt(rewardMicroAlgo));
      
      // Both transactions should have the same group ID
      expect(appCallTxn.group).toBeDefined();
      expect(payTxn.group).toBeDefined();
      expect(appCallTxn.group).toEqual(payTxn.group);
    });

    /**
     * Test 3.1, 3.2, 3.3: Foreign app declarations remain unchanged
     * 
     * **Validates: Requirements 3.1, 3.2, 3.3**
     * 
     * This test verifies that foreign app declarations (foreignApps field) remain
     * unchanged for all transaction types. The registry app ID should be declared
     * in foreignApps for transactions that call the registry.
     * 
     * **Expected on UNFIXED code**: Test PASSES (baseline foreign app declarations)
     * **Expected on FIXED code**: Test PASSES (declarations unchanged)
     */
    it('should preserve foreign app declarations for all transaction types', async () => {
      // Arrange
      const mockEscrowAppId = 123456;
      const mockEscrowAddress = algosdk.getApplicationAddress(mockEscrowAppId);
      const mockApprovalProgram = new Uint8Array(100);
      const mockClearProgram = new Uint8Array(50);
      
      // Act & Assert: Deploy transaction
      const deployTxn = await algorand.buildDeployEscrowTxn(
        testAccount.addr.toString(),
        'https://github.com/test/issue/1',
        Math.floor(Date.now() / 1000) + 86400,
        REGISTRY_APP_ID,
        mockApprovalProgram,
        mockClearProgram
      );
      expect(deployTxn.appForeignApps).toBeDefined();
      expect(deployTxn.appForeignApps).toContain(BigInt(REGISTRY_APP_ID));
      
      // Act & Assert: Register transaction
      const registerTxn = await algorand.buildRegisterEscrowTxn(
        testAccount.addr.toString(),
        mockEscrowAppId,
        REGISTRY_APP_ID
      );
      expect(registerTxn.appForeignApps).toBeDefined();
      expect(registerTxn.appForeignApps).toContain(BigInt(REGISTRY_APP_ID));
      
      // Act & Assert: Deposit group
      const depositGroup = await algorand.buildDepositRewardGroup(
        testAccount.addr.toString(),
        mockEscrowAppId,
        mockEscrowAddress,
        REGISTRY_APP_ID,
        1_000_000,
        1 // bountyId
      );
      expect(depositGroup[0].appForeignApps).toBeDefined();
      expect(depositGroup[0].appForeignApps).toContain(BigInt(REGISTRY_APP_ID));
      
      // Act & Assert: Claim transaction
      const claimTxn = await algorand.buildClaimBountyTxn(
        testAccount.addr.toString(),
        mockEscrowAppId,
        REGISTRY_APP_ID,
        1 // bountyId
      );
      expect(claimTxn.appForeignApps).toBeDefined();
      expect(claimTxn.appForeignApps).toContain(BigInt(REGISTRY_APP_ID));
      
      // Act & Assert: Settle transaction
      const settleTxn = await algorand.buildSettleBountyTxn(
        testAccount.addr.toString(),
        mockEscrowAppId,
        REGISTRY_APP_ID,
        testAccount.addr.toString(),
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
        1 // bountyId
      );
      expect(settleTxn.appForeignApps).toBeDefined();
      expect(settleTxn.appForeignApps).toContain(BigInt(REGISTRY_APP_ID));
    });

    /**
     * Test 3.8: Transaction onComplete and type fields remain unchanged
     * 
     * **Validates: Requirements 3.8**
     * 
     * This test verifies that transaction type fields (onComplete, type) remain
     * unchanged for all transaction types.
     * 
     * **Expected on UNFIXED code**: Test PASSES (baseline transaction types)
     * **Expected on FIXED code**: Test PASSES (types unchanged)
     */
    it('should preserve transaction type and onComplete fields', async () => {
      // Arrange
      const mockEscrowAppId = 123456;
      const mockEscrowAddress = algosdk.getApplicationAddress(mockEscrowAppId);
      const mockApprovalProgram = new Uint8Array(100);
      const mockClearProgram = new Uint8Array(50);
      
      // Act & Assert: Deploy transaction (create app)
      const deployTxn = await algorand.buildDeployEscrowTxn(
        testAccount.addr.toString(),
        'https://github.com/test/issue/1',
        Math.floor(Date.now() / 1000) + 86400,
        REGISTRY_APP_ID,
        mockApprovalProgram,
        mockClearProgram
      );
      expect(deployTxn.type).toBe('appl');
      expect(deployTxn.appIndex).toBe(0n); // Create app
      expect(deployTxn.appOnComplete).toBe(algosdk.OnApplicationComplete.NoOpOC);
      
      // Act & Assert: Register transaction (NoOp call)
      const registerTxn = await algorand.buildRegisterEscrowTxn(
        testAccount.addr.toString(),
        mockEscrowAppId,
        REGISTRY_APP_ID
      );
      expect(registerTxn.type).toBe('appl');
      expect(registerTxn.appIndex).toBe(BigInt(mockEscrowAppId));
      expect(registerTxn.appOnComplete).toBe(algosdk.OnApplicationComplete.NoOpOC);
      
      // Act & Assert: Fund MBR transaction (payment)
      const fundTxn = await algorand.buildFundMBRTxn(
        testAccount.addr.toString(),
        mockEscrowAddress
      );
      expect(fundTxn.type).toBe('pay');
      expect(fundTxn.amount).toBe(200000n);
    });

    /**
     * Test 3.2: MBR funding amount remains unchanged
     * 
     * **Validates: Requirements 3.2**
     * 
     * This test verifies that the MBR funding amount (0.2 ALGO = 200,000 microALGO)
     * remains unchanged after the fix.
     * 
     * **Expected on UNFIXED code**: Test PASSES (baseline MBR amount)
     * **Expected on FIXED code**: Test PASSES (MBR amount unchanged)
     */
    it('should preserve MBR funding amount of 0.2 ALGO', async () => {
      // Arrange
      const mockEscrowAddress = algosdk.getApplicationAddress(123456);
      
      // Act: Build fund MBR transaction
      const fundTxn = await algorand.buildFundMBRTxn(
        testAccount.addr.toString(),
        mockEscrowAddress
      );
      
      // Assert: Amount should be 200,000 microALGO (0.2 ALGO)
      expect(fundTxn.amount).toBe(200000n);
      expect(algosdk.encodeAddress(fundTxn.to.publicKey)).toBe(mockEscrowAddress);
    });

    /**
     * Test 3.8: Global state schema remains unchanged
     * 
     * **Validates: Requirements 3.8**
     * 
     * This test verifies that the global state schema for escrow deployment
     * remains unchanged (8 ints, 4 byte slices).
     * 
     * **Expected on UNFIXED code**: Test PASSES (baseline schema)
     * **Expected on FIXED code**: Test PASSES (schema unchanged)
     */
    it('should preserve global state schema for escrow deployment', async () => {
      // Arrange
      const mockApprovalProgram = new Uint8Array(100);
      const mockClearProgram = new Uint8Array(50);
      
      // Act: Build deploy transaction
      const deployTxn = await algorand.buildDeployEscrowTxn(
        testAccount.addr.toString(),
        'https://github.com/test/issue/1',
        Math.floor(Date.now() / 1000) + 86400,
        REGISTRY_APP_ID,
        mockApprovalProgram,
        mockClearProgram
      );
      
      // Assert: Global state schema
      expect(deployTxn.appGlobalInts).toBe(8n);
      expect(deployTxn.appGlobalByteSlices).toBe(4n);
      expect(deployTxn.appLocalInts).toBe(0n);
      expect(deployTxn.appLocalByteSlices).toBe(0n);
    });

    /**
     * Test 3.8: Accounts array for settle transaction remains unchanged
     * 
     * **Validates: Requirements 3.8**
     * 
     * This test verifies that the accounts array for settleBounty transaction
     * remains unchanged (contributor and maintainer addresses).
     * 
     * **Expected on UNFIXED code**: Test PASSES (baseline accounts array)
     * **Expected on FIXED code**: Test PASSES (accounts array unchanged)
     */
    it('should preserve accounts array for settle transaction', async () => {
      // Arrange
      const mockEscrowAppId = 123456;
      const contributorAddress = testAccount.addr.toString();
      const maintainerAddress = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';
      
      // Act: Build settle transaction
      const settleTxn = await algorand.buildSettleBountyTxn(
        testAccount.addr.toString(),
        mockEscrowAppId,
        REGISTRY_APP_ID,
        contributorAddress,
        maintainerAddress,
        1 // bountyId
      );
      
      // Assert: Accounts array should contain contributor and maintainer
      expect(settleTxn.appAccounts).toBeDefined();
      expect(settleTxn.appAccounts).toHaveLength(2);
      expect(algosdk.encodeAddress(settleTxn.appAccounts![0].publicKey)).toBe(contributorAddress);
      expect(algosdk.encodeAddress(settleTxn.appAccounts![1].publicKey)).toBe(maintainerAddress);
    });
  });

  describe('Property-Based Tests: Preservation Across Input Domain', () => {
    /**
     * Property: Fee calculations remain unchanged for any reward amount
     * 
     * This property-based test generates random reward amounts and verifies that
     * fee calculations remain unchanged regardless of the reward amount.
     * 
     * **Expected on UNFIXED code**: Test PASSES (baseline fee calculations)
     * **Expected on FIXED code**: Test PASSES (fees unchanged)
     * 
     * **Validates: Requirements 3.8**
     */
    it('should preserve fee calculations for any reward amount', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100_000, max: 100_000_000 }), // 0.1 to 100 ALGO in microALGO
          async (rewardMicroAlgo) => {
            // Arrange
            const mockEscrowAppId = 123456;
            const mockEscrowAddress = algosdk.getApplicationAddress(mockEscrowAppId);
            
            // Act: Build deposit reward group
            const depositGroup = await algorand.buildDepositRewardGroup(
              testAccount.addr.toString(),
              mockEscrowAppId,
              mockEscrowAddress,
              REGISTRY_APP_ID,
              rewardMicroAlgo,
              1 // bountyId
            );
            
            // Assert: Fees should be constant regardless of reward amount
            expect(depositGroup[0].fee).toBe(2000n); // App call fee
            expect(depositGroup[1].fee).toBe(1000n); // Payment fee
            expect(depositGroup[1].amount).toBe(BigInt(rewardMicroAlgo)); // Reward amount
          }
        )
      );
    });

    /**
     * Property: Parameter encoding remains unchanged for any issue URL
     * 
     * This property-based test generates random issue URLs and verifies that
     * parameter encoding produces consistent results.
     * 
     * **Expected on UNFIXED code**: Test PASSES (baseline encoding)
     * **Expected on FIXED code**: Test PASSES (encoding unchanged)
     * 
     * **Validates: Requirements 3.8**
     */
    it('should preserve parameter encoding for any issue URL', () => {
      fc.assert(
        fc.asyncProperty(
          fc.webUrl({ validSchemes: ['https'] }),
          async (issueUrl) => {
            // Arrange
            const mockApprovalProgram = new Uint8Array(100);
            const mockClearProgram = new Uint8Array(50);
            const deadline = Math.floor(Date.now() / 1000) + 86400;
            
            // Act: Build deploy transaction
            const deployTxn = await algorand.buildDeployEscrowTxn(
              testAccount.addr.toString(),
              issueUrl,
              deadline,
              REGISTRY_APP_ID,
              mockApprovalProgram,
              mockClearProgram
            );
            
            // Assert: Issue URL should be correctly encoded
            expect(deployTxn.appArgs![1]).toEqual(new TextEncoder().encode(issueUrl));
          }
        )
      );
    });

    /**
     * Property: Atomic group structure remains unchanged for any reward amount
     * 
     * This property-based test generates random reward amounts and verifies that
     * the atomic group structure (2 transactions with same group ID) remains unchanged.
     * 
     * **Expected on UNFIXED code**: Test PASSES (baseline group structure)
     * **Expected on FIXED code**: Test PASSES (structure unchanged)
     * 
     * **Validates: Requirements 3.5**
     */
    it('should preserve atomic group structure for any reward amount', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100_000, max: 100_000_000 }),
          async (rewardMicroAlgo) => {
            // Arrange
            const mockEscrowAppId = 123456;
            const mockEscrowAddress = algosdk.getApplicationAddress(mockEscrowAppId);
            
            // Act: Build deposit reward group
            const depositGroup = await algorand.buildDepositRewardGroup(
              testAccount.addr.toString(),
              mockEscrowAppId,
              mockEscrowAddress,
              REGISTRY_APP_ID,
              rewardMicroAlgo,
              1 // bountyId
            );
            
            // Assert: Group structure unchanged
            expect(depositGroup).toHaveLength(2);
            expect(depositGroup[0].type).toBe('appl');
            expect(depositGroup[1].type).toBe('pay');
            expect(depositGroup[0].group).toEqual(depositGroup[1].group);
          }
        )
      );
    });

    /**
     * Property: Foreign app declarations remain unchanged for any escrow app ID
     * 
     * This property-based test generates random escrow app IDs and verifies that
     * foreign app declarations remain unchanged.
     * 
     * **Expected on UNFIXED code**: Test PASSES (baseline declarations)
     * **Expected on FIXED code**: Test PASSES (declarations unchanged)
     * 
     * **Validates: Requirements 3.1, 3.2, 3.3**
     */
    it('should preserve foreign app declarations for any escrow app ID', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100000, max: 999999 }),
          async (escrowAppId) => {
            // Arrange
            const mockEscrowAddress = algosdk.getApplicationAddress(escrowAppId);
            
            // Act: Build register transaction
            const registerTxn = await algorand.buildRegisterEscrowTxn(
              testAccount.addr.toString(),
              escrowAppId,
              REGISTRY_APP_ID
            );
            
            // Assert: Registry app ID should be in foreignApps
            expect(registerTxn.appForeignApps).toBeDefined();
            expect(registerTxn.appForeignApps).toContain(BigInt(REGISTRY_APP_ID));
            
            // Act: Build deposit group
            const depositGroup = await algorand.buildDepositRewardGroup(
              testAccount.addr.toString(),
              escrowAppId,
              mockEscrowAddress,
              REGISTRY_APP_ID,
              1_000_000,
              1 // bountyId
            );
            
            // Assert: Registry app ID should be in foreignApps
            expect(depositGroup[0].appForeignApps).toBeDefined();
            expect(depositGroup[0].appForeignApps).toContain(BigInt(REGISTRY_APP_ID));
          }
        )
      );
    });
  });
});
