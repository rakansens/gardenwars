-- Add max_cleared_stage_id column to rankings table
-- This stores the actual stage ID (e.g., "stage_5", "inferno_3") for progress display

ALTER TABLE rankings
ADD COLUMN IF NOT EXISTS max_cleared_stage_id TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN rankings.max_cleared_stage_id IS 'The ID of the highest cleared stage (e.g., "inferno_5")';
