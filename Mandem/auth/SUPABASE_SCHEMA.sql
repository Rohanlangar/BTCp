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

CREATE TYPE bounty_status AS ENUM ('OPEN', 'CLAIMED', 'SUBMITTED', 'SETTLED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "bounties" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Creator Info
    "creatorId" TEXT NOT NULL REFERENCES "user"("id"),
    "creatorWallet" TEXT NOT NULL,
    
    -- GitHub Issue Info
    "issueUrl" TEXT NOT NULL,
    "issueTitle" TEXT NOT NULL,
    "issueDescription" TEXT,
    "repoOwner" TEXT,
    "repoName" TEXT,
    "issueNumber" INTEGER,
    
    -- Bounty Config
    "rewardAlgo" NUMERIC NOT NULL,
    "escrowAppId" BIGINT,
    "registryBountyId" BIGINT,
    
    -- Lifecycle
    "status" bounty_status DEFAULT 'OPEN',
    
    -- Contributor Info
    "contributorId" TEXT REFERENCES "user"("id"),
    "contributorWallet" TEXT,
    "contributorGithub" TEXT,
    
    -- Submission Info
    "prUrl" TEXT,
    "prNumber" INTEGER,
    "submissionNote" TEXT,
    
    -- ML Validation Scores (4-Layer Report)
    -- Stores: { relevance, quality, security, overall, verdict, summary }
    "mlScores" JSONB,
    
    -- Settlement Info
    "settledTxnId" TEXT,
    "settledAt" TIMESTAMP,
    
    -- Timestamps
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "claimedAt" TIMESTAMP,
    "submittedAt" TIMESTAMP
);

-- 3. INDEXES & PERFORMANCE

CREATE INDEX idx_bounties_status ON bounties(status);
CREATE INDEX idx_bounties_creator ON bounties("creatorId");
CREATE INDEX idx_bounties_contributor ON bounties("contributorId");
CREATE INDEX idx_user_wallet ON "user"("walletAddress");

-- 4. HELPER TRIGGERS FOR UPDATED_AT

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_modtime BEFORE UPDATE ON "user" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_bounties_modtime BEFORE UPDATE ON "bounties" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ==========================================
-- 🚀 SCHEMA READY
-- Paste the code above into your Supabase SQL Editor.
-- ==========================================
