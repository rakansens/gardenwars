-- ================================================
-- Shop & Arena Server Authority RPCs
-- ショップとアリーナのサーバー権威モード用RPC関数群
-- ================================================

-- ============================================
-- 1. ショップリフレッシュ（コイン消費のみ）
-- ============================================
CREATE OR REPLACE FUNCTION execute_shop_refresh(
  p_player_id UUID,
  p_cost INT
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

  -- コイン不足チェック
  IF v_current_coins < p_cost THEN
    RETURN json_build_object(
      'success', false,
      'error', 'insufficient_coins',
      'current_coins', v_current_coins,
      'required', p_cost
    );
  END IF;

  -- コインを消費
  UPDATE player_data
  SET
    coins = v_current_coins - p_cost,
    updated_at = NOW()
  WHERE player_id = p_player_id;

  -- 成功レスポンス
  RETURN json_build_object(
    'success', true,
    'coins', v_current_coins - p_cost,
    'server_time', NOW()
  );
END;
$$;

-- ============================================
-- 2. ショップ購入（コイン消費 + ユニット追加）
-- ============================================
CREATE OR REPLACE FUNCTION execute_shop_purchase(
  p_player_id UUID,
  p_price INT,
  p_unit_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_coins INT;
  v_inventory JSONB;
  v_current_count INT;
BEGIN
  -- プレイヤーデータを取得（行ロック）
  SELECT coins, unit_inventory
  INTO v_current_coins, v_inventory
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

  -- コイン不足チェック
  IF v_current_coins < p_price THEN
    RETURN json_build_object(
      'success', false,
      'error', 'insufficient_coins',
      'current_coins', v_current_coins,
      'required', p_price
    );
  END IF;

  -- ユニットをインベントリに追加
  v_current_count := COALESCE((v_inventory->>p_unit_id)::INT, 0);
  v_inventory := jsonb_set(
    v_inventory,
    ARRAY[p_unit_id],
    to_jsonb(v_current_count + 1)
  );

  -- データベース更新
  UPDATE player_data
  SET
    coins = v_current_coins - p_price,
    unit_inventory = v_inventory,
    updated_at = NOW()
  WHERE player_id = p_player_id;

  -- 成功レスポンス
  RETURN json_build_object(
    'success', true,
    'coins', v_current_coins - p_price,
    'unit_inventory', v_inventory,
    'server_time', NOW()
  );
END;
$$;

-- ============================================
-- 3. アリーナ報酬（コイン追加のみ）
-- ============================================
CREATE OR REPLACE FUNCTION execute_arena_reward(
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
COMMENT ON FUNCTION execute_shop_refresh(UUID, INT) IS 'ショップリフレッシュ（コイン消費）';
COMMENT ON FUNCTION execute_shop_purchase(UUID, INT, TEXT) IS 'ショップ購入（コイン消費＋ユニット追加）';
COMMENT ON FUNCTION execute_arena_reward(UUID, INT) IS 'アリーナ報酬（コイン追加）';
