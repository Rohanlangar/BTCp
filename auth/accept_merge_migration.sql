-- ==========================================
-- 🏆 ACCEPT & MERGE FEATURE MIGRATION
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. Extend bounty_state enum with new states
ALTER TYPE bounty_state ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE bounty_state ADD VALUE IF NOT EXISTS 'AWAITING_SETTLEMENT';

-- 2. Add winner tracking columns to bounties table
ALTER TABLE bounties
  ADD COLUMN IF NOT EXISTS "winnerId" TEXT REFERENCES "user"("id"),
  ADD COLUMN IF NOT EXISTS "winnerWallet" TEXT,
  ADD COLUMN IF NOT EXISTS "winnerSubmissionId" UUID,
  ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "mergeVerifiedAt" TIMESTAMP;

-- 3. Add accepted_at to submissions (tracks when admin accepted this submission)
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMP;

-- 4. Add index for faster winner lookups
CREATE INDEX IF NOT EXISTS idx_bounties_winner ON bounties("winnerId");

-- ==========================================
-- ✅ MIGRATION COMPLETE
-- ==========================================
