-- ================================================
-- Ranking Server Authority RPCs
-- ランキング更新のサーバー権威モード用RPC関数群
-- 競合状態を防ぐためにFOR UPDATEロックを使用
-- ================================================

-- ============================================
-- 1. バトル統計更新（アトミック処理）
-- ============================================
CREATE OR REPLACE FUNCTION increment_battle_stats(
  p_player_id UUID,
  p_won BOOLEAN,
  p_stage_num INT DEFAULT NULL,
  p_stage_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_battles INT;
  v_total_wins INT;
  v_max_stage INT;
  v_win_streak INT;
  v_max_win_streak INT;
  v_new_streak INT;
BEGIN
  -- ランキング行を取得（存在しない場合は作成）
  INSERT INTO rankings (player_id)
  VALUES (p_player_id)
  ON CONFLICT (player_id) DO NOTHING;

  -- 行ロックして現在値を取得
  SELECT
    COALESCE(total_battles, 0),
    COALESCE(total_wins, 0),
    COALESCE(max_stage, 0),
    COALESCE(win_streak, 0),
    COALESCE(max_win_streak, 0)
  INTO v_total_battles, v_total_wins, v_max_stage, v_win_streak, v_max_win_streak
  FROM rankings
  WHERE player_id = p_player_id
  FOR UPDATE;

  -- バトル数を増加
  v_total_battles := v_total_battles + 1;

  IF p_won THEN
    -- 勝利時
    v_total_wins := v_total_wins + 1;
    v_new_streak := v_win_streak + 1;

    -- 最大連勝更新
    IF v_new_streak > v_max_win_streak THEN
      v_max_win_streak := v_new_streak;
    END IF;

    -- 最大ステージ更新
    IF p_stage_num IS NOT NULL AND p_stage_num > v_max_stage THEN
      v_max_stage := p_stage_num;

      -- ステージ更新
      UPDATE rankings
      SET
        total_battles = v_total_battles,
        total_wins = v_total_wins,
        win_streak = v_new_streak,
        max_win_streak = v_max_win_streak,
        max_stage = v_max_stage,
        max_cleared_stage_id = p_stage_id,
        updated_at = NOW()
      WHERE player_id = p_player_id;
    ELSE
      UPDATE rankings
      SET
        total_battles = v_total_battles,
        total_wins = v_total_wins,
        win_streak = v_new_streak,
        max_win_streak = v_max_win_streak,
        updated_at = NOW()
      WHERE player_id = p_player_id;
    END IF;
  ELSE
    -- 敗北時：連勝リセット
    UPDATE rankings
    SET
      total_battles = v_total_battles,
      win_streak = 0,
      updated_at = NOW()
    WHERE player_id = p_player_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'total_battles', v_total_battles,
    'total_wins', v_total_wins,
    'win_streak', CASE WHEN p_won THEN v_new_streak ELSE 0 END,
    'max_win_streak', v_max_win_streak,
    'server_time', NOW()
  );
END;
$$;

-- ============================================
-- 2. ガチャカウント更新（アトミック処理）
-- ============================================
CREATE OR REPLACE FUNCTION increment_gacha_count(
  p_player_id UUID,
  p_count INT DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_count INT;
BEGIN
  -- ランキング行を取得（存在しない場合は作成）
  INSERT INTO rankings (player_id)
  VALUES (p_player_id)
  ON CONFLICT (player_id) DO NOTHING;

  -- 行ロックして現在値を取得
  SELECT COALESCE(gacha_count, 0)
  INTO v_current_count
  FROM rankings
  WHERE player_id = p_player_id
  FOR UPDATE;

  -- カウント更新
  UPDATE rankings
  SET
    gacha_count = v_current_count + p_count,
    updated_at = NOW()
  WHERE player_id = p_player_id;

  RETURN json_build_object(
    'success', true,
    'gacha_count', v_current_count + p_count,
    'server_time', NOW()
  );
END;
$$;

-- ============================================
-- 3. ガーデン訪問更新（アトミック処理）
-- ============================================
CREATE OR REPLACE FUNCTION increment_garden_visits(
  p_player_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_visits INT;
BEGIN
  -- ランキング行を取得（存在しない場合は作成）
  INSERT INTO rankings (player_id)
  VALUES (p_player_id)
  ON CONFLICT (player_id) DO NOTHING;

  -- 行ロックして現在値を取得
  SELECT COALESCE(garden_visits, 0)
  INTO v_current_visits
  FROM rankings
  WHERE player_id = p_player_id
  FOR UPDATE;

  -- カウント更新
  UPDATE rankings
  SET
    garden_visits = v_current_visits + 1,
    updated_at = NOW()
  WHERE player_id = p_player_id;

  RETURN json_build_object(
    'success', true,
    'garden_visits', v_current_visits + 1,
    'server_time', NOW()
  );
END;
$$;

-- ============================================
-- 4. ガーデン報酬（コイン追加）- アトミック処理
-- ============================================
CREATE OR REPLACE FUNCTION execute_garden_reward(
  p_player_id UUID,
  p_coins_gained INT
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_coins INT;
BEGIN
  -- プレイヤーデータを取得（行ロック）
  SELECT coins
  INTO v_current_coins
  FROM player_data
  WHERE player_id = p_player_id
  FOR UPDATE;

  -- プレイヤーが見つからない場合
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'player_not_found'
    );
  END IF;

  -- コインを追加
  UPDATE player_data
  SET
    coins = v_current_coins + p_coins_gained,
    updated_at = NOW()
  WHERE player_id = p_player_id;

  -- 成功レスポンス
  RETURN json_build_object(
    'success', true,
    'coins', v_current_coins + p_coins_gained,
    'server_time', NOW()
  );
END;
$$;

-- ============================================
-- コメント
-- ============================================
COMMENT ON FUNCTION increment_battle_stats(UUID, BOOLEAN, INT, TEXT) IS 'バトル統計のアトミック更新';
COMMENT ON FUNCTION increment_gacha_count(UUID, INT) IS 'ガチャカウントのアトミック更新';
COMMENT ON FUNCTION increment_garden_visits(UUID) IS 'ガーデン訪問のアトミック更新';
COMMENT ON FUNCTION execute_garden_reward(UUID, INT) IS 'ガーデン報酬（コイン追加）のアトミック処理';
