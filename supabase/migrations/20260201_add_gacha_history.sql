-- ガチャ履歴カラムを追加
-- player_dataテーブルにガチャ履歴を保存するJSONBカラムを追加
-- 最大100件の履歴を保持（アプリ側で制限）

ALTER TABLE player_data
ADD COLUMN IF NOT EXISTS gacha_history JSONB DEFAULT '[]'::jsonb;

-- コメント追加
COMMENT ON COLUMN player_data.gacha_history IS 'ガチャ履歴（最大100件、timestamp降順）。各エントリ: {timestamp: number, unitIds: string[], count: number}';

-- インデックス（必要に応じて）
-- CREATE INDEX IF NOT EXISTS idx_player_data_gacha_history ON player_data USING GIN (gacha_history);
