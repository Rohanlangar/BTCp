-- migration_ml_scores.sql
-- Add mlScores column to bounties table to store 4-layer validation reports

ALTER TABLE "bounties" 
ADD COLUMN IF NOT EXISTS "mlScores" JSONB;

-- Comment for clarity
COMMENT ON COLUMN "bounties"."mlScores" IS 'Stores the output of the 4-layer ML validation pipeline (SBERT, CodeBERT, Bandit, Gemini)';
