-- ================================================
-- Garden Wars - Marketplace Feature Migration
-- ================================================
-- Run this SQL to add marketplace functionality
-- via Dashboard > SQL Editor
-- ================================================

-- ============================================
-- MARKETPLACE LISTINGS TABLE
-- ============================================

CREATE TABLE marketplace_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  unit_id VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_per_unit INTEGER NOT NULL CHECK (price_per_unit > 0),
  total_price INTEGER GENERATED ALWAYS AS (quantity * price_per_unit) STORED,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'expired', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  sold_at TIMESTAMP WITH TIME ZONE,
  buyer_id UUID REFERENCES players(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for marketplace queries
CREATE INDEX idx_marketplace_status ON marketplace_listings(status);
CREATE INDEX idx_marketplace_seller ON marketplace_listings(seller_id);
CREATE INDEX idx_marketplace_buyer ON marketplace_listings(buyer_id);
CREATE INDEX idx_marketplace_unit ON marketplace_listings(unit_id);
CREATE INDEX idx_marketplace_expires ON marketplace_listings(expires_at) WHERE status = 'active';
CREATE INDEX idx_marketplace_price ON marketplace_listings(price_per_unit) WHERE status = 'active';
CREATE INDEX idx_marketplace_created ON marketplace_listings(created_at DESC) WHERE status = 'active';

-- Comments for documentation
COMMENT ON TABLE marketplace_listings IS 'Player-to-player unit marketplace listings';
COMMENT ON COLUMN marketplace_listings.status IS 'active: for sale, sold: purchased, expired: past expiration, cancelled: removed by seller';
COMMENT ON COLUMN marketplace_listings.total_price IS 'Auto-calculated as quantity * price_per_unit';

-- ============================================
-- MARKETPLACE NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE marketplace_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN ('item_sold', 'listing_expired', 'listing_cancelled')),
  message TEXT,
  coins_earned INTEGER DEFAULT 0,
  unit_id VARCHAR(50),
  quantity INTEGER DEFAULT 0,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for notification queries
CREATE INDEX idx_notifications_player ON marketplace_notifications(player_id);
CREATE INDEX idx_notifications_unread ON marketplace_notifications(player_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created ON marketplace_notifications(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE marketplace_notifications IS 'Notifications for marketplace events (sales, expirations)';
COMMENT ON COLUMN marketplace_notifications.notification_type IS 'item_sold: unit was purchased, listing_expired: listing past expiration, listing_cancelled: seller cancelled';

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for marketplace_listings
CREATE TRIGGER update_marketplace_listings_updated_at
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_notifications ENABLE ROW LEVEL SECURITY;

-- Marketplace listings policies (PIN-based auth handled in app)
CREATE POLICY "Allow anonymous select on marketplace_listings"
  ON marketplace_listings FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert on marketplace_listings"
  ON marketplace_listings FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update on marketplace_listings"
  ON marketplace_listings FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anonymous delete on marketplace_listings"
  ON marketplace_listings FOR DELETE TO anon USING (true);

-- Notifications policies
CREATE POLICY "Allow anonymous select on marketplace_notifications"
  ON marketplace_notifications FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert on marketplace_notifications"
  ON marketplace_notifications FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update on marketplace_notifications"
  ON marketplace_notifications FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anonymous delete on marketplace_notifications"
  ON marketplace_notifications FOR DELETE TO anon USING (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to expire old listings (run via cron or scheduled task)
CREATE OR REPLACE FUNCTION expire_marketplace_listings()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Update expired listings
  WITH expired AS (
    UPDATE marketplace_listings
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active' AND expires_at < NOW()
    RETURNING id, seller_id, unit_id, quantity
  ),
  -- Create notifications for expired listings
  notifications AS (
    INSERT INTO marketplace_notifications (player_id, listing_id, notification_type, message, unit_id, quantity)
    SELECT
      seller_id,
      id,
      'listing_expired',
      'Your listing has expired. Units have been returned to your inventory.',
      unit_id,
      quantity
    FROM expired
    RETURNING 1
  )
  SELECT COUNT(*) INTO expired_count FROM expired;

  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_marketplace_listings IS 'Marks expired listings and creates notifications. Returns count of expired listings.';
