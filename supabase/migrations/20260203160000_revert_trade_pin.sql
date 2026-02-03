-- ================================================
-- Revert PIN-based trade history access
-- Applied after 20260203120000_execute_trade_rpc.sql
-- ================================================

-- Re-enable anon select for trade history (client-side history view uses direct select)
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous select on trade_history" ON trade_history;
CREATE POLICY "Allow anonymous select on trade_history"
  ON trade_history FOR SELECT TO anon USING (true);

-- Remove PIN-based history RPC (no longer used)
DROP FUNCTION IF EXISTS get_trade_history(TEXT, INT);
