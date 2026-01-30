-- ================================================
-- Garden Wars - Database Baseline
-- ================================================
-- Run this SQL once on a fresh Supabase project
-- via Dashboard > SQL Editor
-- ================================================

-- ============================================
-- TABLES
-- ============================================

-- Players table: stores basic player info and PIN
CREATE TABLE players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pin CHAR(6) UNIQUE NOT NULL,
  name VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast PIN lookup
CREATE INDEX idx_players_pin ON players(pin);

-- Player data table: stores game progress
CREATE TABLE player_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  coins INTEGER DEFAULT 300,
  unit_inventory JSONB DEFAULT '{}',
  selected_team JSONB DEFAULT '[]',
  loadouts JSONB DEFAULT '[[], [], []]',
  cleared_stages JSONB DEFAULT '[]',
  garden_units JSONB DEFAULT '[]',
  shop_items JSONB DEFAULT '[]',
  active_loadout_index INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(player_id)
);

-- Index for player_id lookup
CREATE INDEX idx_player_data_player_id ON player_data(player_id);

-- Rankings table: for leaderboard feature
CREATE TABLE rankings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  max_stage INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_battles INTEGER DEFAULT 0,
  total_coins INTEGER DEFAULT 0,
  collection_count INTEGER DEFAULT 0,
  total_units INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(player_id)
);

-- Comments for documentation
COMMENT ON COLUMN rankings.total_coins IS 'Current coin balance';
COMMENT ON COLUMN rankings.collection_count IS 'Number of unique units collected';
COMMENT ON COLUMN rankings.total_units IS 'Total number of units owned (including duplicates)';

-- Index for rankings queries
CREATE INDEX idx_rankings_max_stage ON rankings(max_stage DESC);
CREATE INDEX idx_rankings_total_wins ON rankings(total_wins DESC);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating updated_at
CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_data_updated_at
  BEFORE UPDATE ON player_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rankings_updated_at
  BEFORE UPDATE ON rankings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Allow all operations (PIN-based auth handled in app)

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;

-- Players policies
CREATE POLICY "Allow anonymous select on players"
  ON players FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert on players"
  ON players FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update on players"
  ON players FOR UPDATE TO anon USING (true);

-- Player data policies
CREATE POLICY "Allow anonymous select on player_data"
  ON player_data FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert on player_data"
  ON player_data FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update on player_data"
  ON player_data FOR UPDATE TO anon USING (true);

-- Rankings policies
CREATE POLICY "Allow anonymous select on rankings"
  ON rankings FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert on rankings"
  ON rankings FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update on rankings"
  ON rankings FOR UPDATE TO anon USING (true);
