-- ==========================================
-- 🏗️ HACKATHON BOUNTY PLATFORM - SUPABASE SCHEMA
-- ==========================================

-- 1. BETTER-AUTH CORE TABLES
-- See: https://www.better-auth.com/docs/concepts/database

CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Custom fields for Bounty Platform
    "role" TEXT,
    "roleSelected" BOOLEAN DEFAULT false,
    "walletAddress" TEXT UNIQUE,
    "walletVerified" BOOLEAN DEFAULT false,
    "reputationScore" INTEGER DEFAULT 0,
    "bountiesCompleted" INTEGER DEFAULT 0,
    "githubHandle" TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT PRIMARY KEY,
    "expiresAt" TIMESTAMP NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP,
    "refreshTokenExpiresAt" TIMESTAMP,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. BOUNTY MANAGEMENT TABLES

-- Use a DO block to safely create the enum or skip if it exists
DO $$ BEGIN
    CREATE TYPE bounty_state AS ENUM (
        'DRAFT', 'OPEN', 'CLAIMED', 'IN_PROGRESS', 
        'UNDER_REVIEW', 'DISPUTED', 'COMPLETED', 
        'CANCELLED', 'EXPIRED', 'REFUNDED'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "bounties" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    
    -- Creator Info
    "admin_id" TEXT NOT NULL REFERENCES "user"("id"),
    "admin_wallet" TEXT NOT NULL,
    
    -- Value & Limits
    "amount_algo" NUMERIC NOT NULL,
    "max_contributors" INTEGER DEFAULT 1,
    
    -- Deadline Details
    "deadline" TIMESTAMP,
    
    -- State Field
    "status" bounty_state DEFAULT 'DRAFT',
    
    -- Blockchain Data
    "contract_address" TEXT,
    "transaction_id" TEXT,
    
    -- Structure
    "skill_tags" TEXT[],
    "milestone_structure" JSONB,
    
    -- External refs
    "issue_url" TEXT,
    
    -- Timestamps
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "published_at" TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "completed_at" TIMESTAMP
);

-- 3. CLAIMS TABLE
CREATE TABLE IF NOT EXISTS "claims" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "bounty_id" UUID NOT NULL REFERENCES "bounties"("id") ON DELETE CASCADE,
    
    -- Contributor Details
    "contributor_id" TEXT NOT NULL REFERENCES "user"("id"),
    "contributor_wallet" TEXT,
    "contributor_github_id" TEXT,
    
    -- Claim State
    "status" TEXT NOT NULL DEFAULT 'active', -- active, abandoned, submitted, won, lost
    
    -- Stake info
    "stake_txn_id" TEXT,
    
    -- Timestamps
    "claimed_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "deadline" TIMESTAMP, -- The time the contributor must submit by
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE("bounty_id", "contributor_id")
);

-- 4. SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS "submissions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "bounty_id" UUID NOT NULL REFERENCES "bounties"("id") ON DELETE CASCADE,
    "claim_id" UUID NOT NULL REFERENCES "claims"("id") ON DELETE CASCADE,
    
    "contributor_id" TEXT NOT NULL REFERENCES "user"("id"),
    "contributor_wallet" TEXT,
    
    "content_url" TEXT NOT NULL,
    "description" TEXT,
    
    -- ML & AI Validation
    "ai_quality_score" INTEGER,
    "ai_plagiarism_flag" BOOLEAN,
    "ai_report_json" JSONB,
    
    -- State & Admin Feedback
    "status" TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, disputed
    "admin_feedback" TEXT,
    
    -- Blockchain Details
    "submission_hash" TEXT,
    "blockchain_txn_id" TEXT,
    
    -- Timestamps
    "submitted_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "reviewed_at" TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5. ACTIVITY LOG TABLE (For live timeline)
CREATE TABLE IF NOT EXISTS "activity_log" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "bounty_id" UUID NOT NULL REFERENCES "bounties"("id") ON DELETE CASCADE,
    
    "actor_id" TEXT NOT NULL REFERENCES "user"("id"),
    "actor_wallet" TEXT,
    
    "action" TEXT NOT NULL, -- created, published, claimed, submitted, approved, rejected, disputed...
    "metadata" JSONB,       -- {"score": 87, "txnId": "ABC..."}
    
    "timestamp" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "bounty_id" UUID REFERENCES "bounties"("id"),
    
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL, -- alert, success, warning
    
    "is_read" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 7. INDEXES & PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_bounties_status ON "bounties"("status");
CREATE INDEX IF NOT EXISTS idx_claims_bounty ON "claims"("bounty_id");
CREATE INDEX IF NOT EXISTS idx_submissions_bounty ON "submissions"("bounty_id");
CREATE INDEX IF NOT EXISTS idx_activity_bounty ON "activity_log"("bounty_id");
CREATE INDEX IF NOT EXISTS idx_notifications_user ON "notifications"("user_id");

-- 8. HELPER TRIGGERS FOR UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_updatedAt_camel_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_modtime ON "user";
CREATE TRIGGER update_user_modtime BEFORE UPDATE ON "user" FOR EACH ROW EXECUTE PROCEDURE update_updatedAt_camel_column();

DROP TRIGGER IF EXISTS update_bounties_modtime ON "bounties";
CREATE TRIGGER update_bounties_modtime BEFORE UPDATE ON "bounties" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_claims_modtime ON "claims";
CREATE TRIGGER update_claims_modtime BEFORE UPDATE ON "claims" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_submissions_modtime ON "submissions";
CREATE TRIGGER update_submissions_modtime BEFORE UPDATE ON "submissions" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable Supabase Realtime for dynamic WebSockets exactly as requested
ALTER PUBLICATION supabase_realtime ADD TABLE "bounties";
ALTER PUBLICATION supabase_realtime ADD TABLE "activity_log";
ALTER PUBLICATION supabase_realtime ADD TABLE "notifications";

-- ==========================================
-- 🚀 SCHEMA EXPANDED FOR BOUNTY STATE ENGINE
-- Paste this entire file into your Supabase SQL Editor.
-- ==========================================
