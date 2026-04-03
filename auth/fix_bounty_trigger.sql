-- ==========================================
-- 🛠️ FIX DATABASE TRIGGER FOR BOUNTIES
-- Matches the actual column name "updatedAt"
-- ==========================================

-- 1. Create a specific trigger function for the camelCase column
CREATE OR REPLACE FUNCTION update_updatedAt_camel_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop the old trigger that was using the wrong column
DROP TRIGGER IF EXISTS update_bounties_modtime ON "bounties";

-- 3. Create the correct trigger for the bounties table
CREATE TRIGGER update_bounties_modtime 
BEFORE UPDATE ON "bounties" 
FOR EACH ROW 
EXECUTE PROCEDURE update_updatedAt_camel_column();

-- ==========================================
-- ✅ TRIGGER FIX COMPLETE
-- ==========================================
