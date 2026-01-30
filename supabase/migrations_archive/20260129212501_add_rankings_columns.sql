-- Add new columns to rankings table for extended statistics

ALTER TABLE rankings
  ADD COLUMN IF NOT EXISTS total_coins INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collection_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_units INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN rankings.total_coins IS 'Current coin balance';
COMMENT ON COLUMN rankings.collection_count IS 'Number of unique units collected';
COMMENT ON COLUMN rankings.total_units IS 'Total number of units owned (including duplicates)';
