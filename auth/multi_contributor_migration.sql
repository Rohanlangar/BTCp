-- ==========================================
-- 🔄 MULTI-CONTRIBUTOR BOUNTY MIGRATION
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. Add columns to submissions table for multi-contributor support
ALTER TABLE "submissions" 
ADD COLUMN IF NOT EXISTS "pr_url" TEXT,
ADD COLUMN IF NOT EXISTS "documentation" TEXT,
ADD COLUMN IF NOT EXISTS "comments" TEXT,
ADD COLUMN IF NOT EXISTS "rank" INTEGER;

-- 2. Make content_url nullable (we use pr_url now)
ALTER TABLE "submissions" ALTER COLUMN "content_url" DROP NOT NULL;

-- 3. Update the claims table — add participation tracking
ALTER TABLE "claims"
ADD COLUMN IF NOT EXISTS "participated_at" TIMESTAMP DEFAULT NOW();

-- 4. Ensure mlScores exists on bounties (from previous migration)
ALTER TABLE "bounties" 
ADD COLUMN IF NOT EXISTS "mlScores" JSONB;

-- 5. Add index for faster submission lookups
CREATE INDEX IF NOT EXISTS idx_submissions_contributor ON "submissions"("contributor_id");
CREATE INDEX IF NOT EXISTS idx_claims_contributor ON "claims"("contributor_id");
CREATE INDEX IF NOT EXISTS idx_submissions_rank ON "submissions"("bounty_id", "rank");

-- ==========================================
-- ✅ MIGRATION COMPLETE
-- ==========================================
