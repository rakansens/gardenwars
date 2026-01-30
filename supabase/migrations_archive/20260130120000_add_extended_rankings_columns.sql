-- Add new columns to rankings table for extended statistics
-- UR unit count, gacha count, garden visits, stages cleared, win streak

ALTER TABLE rankings
  ADD COLUMN IF NOT EXISTS ur_unit_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gacha_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS garden_visits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stages_cleared INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS win_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_win_streak INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN rankings.ur_unit_count IS 'Number of UR rarity units owned';
COMMENT ON COLUMN rankings.gacha_count IS 'Total number of gacha pulls';
COMMENT ON COLUMN rankings.garden_visits IS 'Number of times visited the garden';
COMMENT ON COLUMN rankings.stages_cleared IS 'Number of unique stages cleared';
COMMENT ON COLUMN rankings.win_streak IS 'Current consecutive wins';
COMMENT ON COLUMN rankings.max_win_streak IS 'Maximum consecutive wins achieved';
