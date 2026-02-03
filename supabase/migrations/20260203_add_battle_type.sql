-- ============================================
-- Add battle_type column to async_battles
-- 非同期バトルとリアルタイムバトルを区別
-- ============================================

-- battle_type カラム追加（デフォルトは 'async'）
ALTER TABLE async_battles
ADD COLUMN IF NOT EXISTS battle_type text DEFAULT 'async' CHECK (battle_type IN ('async', 'realtime'));

-- 既存データに 'async' を設定（念のため）
UPDATE async_battles SET battle_type = 'async' WHERE battle_type IS NULL;

-- インデックス作成（battle_typeでフィルタ高速化）
CREATE INDEX IF NOT EXISTS idx_async_battles_type ON async_battles(battle_type);

-- コメント追加
COMMENT ON COLUMN async_battles.battle_type IS 'バトルタイプ（async: 非同期バトル, realtime: リアルタイムバトル）';
