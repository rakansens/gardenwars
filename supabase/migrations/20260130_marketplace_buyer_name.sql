-- マーケットプレイス通知にbuyer_nameを追加
ALTER TABLE marketplace_notifications ADD COLUMN IF NOT EXISTS buyer_name TEXT;
