-- Existing totals are retained; physical stock is initialized on the first locked farm load.
ALTER TABLE "farm_inventory" ADD COLUMN IF NOT EXISTS "locations" jsonb;
