-- ================================================
-- Server Authority RPCs
-- サーバー権威モードのためのRPC関数群
-- ================================================

-- ============================================
-- 1. サーバー時刻取得
-- ============================================
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT NOW();
$$;

-- ============================================
-- 2. ガチャ実行（原子的操作）
-- コイン確認 → 消費 → ユニット追加 を一括処理
-- ============================================
CREATE OR REPLACE FUNCTION execute_gacha(
  p_player_id UUID,
  p_cost INT,
  p_unit_ids TEXT[]
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_coins INT;
  v_inventory JSONB;
  v_gacha_history JSONB; /* History array */
  v_unit_id TEXT;
  v_current_count INT;
  v_timestamp BIGINT;
  v_new_history_entry JSONB;
BEGIN
  -- プレイヤーデータを取得（行ロック）
  SELECT coins, unit_inventory, COALESCE(gacha_history, '[]'::jsonb)
  INTO v_current_coins, v_inventory, v_gacha_history
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

  -- ユニットをインベントリに追加
  FOREACH v_unit_id IN ARRAY p_unit_ids LOOP
    v_current_count := COALESCE((v_inventory->>v_unit_id)::INT, 0);
    v_inventory := jsonb_set(
      v_inventory,
      ARRAY[v_unit_id],
      to_jsonb(v_current_count + 1)
    );
  END LOOP;

  -- ガチャ履歴を追加
  -- JSのDate.now()相当を取得（ミリ秒）
  v_timestamp := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  v_new_history_entry := jsonb_build_object(
    'timestamp', v_timestamp,
    'unitIds', p_unit_ids,
    'count', array_length(p_unit_ids, 1)
  );
  
  -- 先頭に追加して最大100件に制限 (jsonb_path_query_array or slice approach)
  -- シンプルに: 新しいエントリ + 既存の配列、その後スライス
  v_gacha_history := (v_new_history_entry || v_gacha_history);
  
  -- 100件制限の簡易実装（パフォーマンス考慮で厳密なスライスはアプリ側に任せるか、ここでやるならjsonb_path_query_arrayを使う）
  -- ここでは単純に追加のみ行う（データサイズが大きくなりすぎないよう、定期的なクリーンアップか、アプリ側での上書き保存に任せる手もあるが、RPC完結させるならここで制限すべき）
  -- JSONBの下位互換性のため、一旦全追加で返す。アプリ側がDifferential Saveで上書き補正してくれるはずだが、
  -- サーバー権威としてはここで制限するのが正しい。
  IF jsonb_array_length(v_gacha_history) > 100 THEN
    -- 0番目から99番目までを取得（100個）
    -- Postgres 12+ function jsonb_path_query_array cannot be easily used for slicing without complex query.
    -- Alternative: Use subquery to slice.
    SELECT jsonb_agg(elem) INTO v_gacha_history
    FROM (
      SELECT elem FROM jsonb_array_elements(v_gacha_history) elem LIMIT 100
    ) sub;
  END IF;

  -- データベース更新
  UPDATE player_data
  SET
    coins = v_current_coins - p_cost,
    unit_inventory = v_inventory,
    gacha_history = v_gacha_history,
    updated_at = NOW()
  WHERE player_id = p_player_id;

  -- 成功レスポンス
  RETURN json_build_object(
    'success', true,
    'coins', v_current_coins - p_cost,
    'unit_inventory', v_inventory,
    'gacha_history', v_gacha_history,
    'server_time', NOW()
  );
END;
$$;

-- ============================================
-- 3. フュージョン実行（原子的操作）
-- 素材確認 → 消費 → 結果ユニット追加 を一括処理
-- ============================================
CREATE OR REPLACE FUNCTION execute_fusion(
  p_player_id UUID,
  p_material_ids TEXT[],
  p_result_unit_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_inventory JSONB;
  v_material_counts JSONB := '{}';
  v_unit_id TEXT;
  v_needed INT;
  v_owned INT;
  v_new_count INT;
BEGIN
  -- プレイヤーデータを取得（行ロック）
  SELECT unit_inventory
  INTO v_inventory
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

  -- 素材の必要数をカウント
  FOREACH v_unit_id IN ARRAY p_material_ids LOOP
    v_needed := COALESCE((v_material_counts->>v_unit_id)::INT, 0) + 1;
    v_material_counts := jsonb_set(v_material_counts, ARRAY[v_unit_id], to_jsonb(v_needed));
  END LOOP;

  -- 素材が足りているかチェック
  FOR v_unit_id, v_needed IN SELECT * FROM jsonb_each_text(v_material_counts) LOOP
    v_owned := COALESCE((v_inventory->>v_unit_id)::INT, 0);
    IF v_owned < v_needed::INT THEN
      RETURN json_build_object(
        'success', false,
        'error', 'insufficient_materials',
        'unit_id', v_unit_id,
        'owned', v_owned,
        'needed', v_needed::INT
      );
    END IF;
  END LOOP;

  -- 素材を消費
  FOR v_unit_id, v_needed IN SELECT * FROM jsonb_each_text(v_material_counts) LOOP
    v_owned := COALESCE((v_inventory->>v_unit_id)::INT, 0);
    v_new_count := v_owned - v_needed::INT;

    IF v_new_count <= 0 THEN
      -- 0以下なら削除
      v_inventory := v_inventory - v_unit_id;
    ELSE
      v_inventory := jsonb_set(v_inventory, ARRAY[v_unit_id], to_jsonb(v_new_count));
    END IF;
  END LOOP;

  -- 結果ユニットを追加
  v_owned := COALESCE((v_inventory->>p_result_unit_id)::INT, 0);
  v_inventory := jsonb_set(v_inventory, ARRAY[p_result_unit_id], to_jsonb(v_owned + 1));

  -- データベース更新
  UPDATE player_data
  SET
    unit_inventory = v_inventory,
    updated_at = NOW()
  WHERE player_id = p_player_id;

  -- 成功レスポンス
  RETURN json_build_object(
    'success', true,
    'unit_inventory', v_inventory,
    'result_unit_id', p_result_unit_id,
    'server_time', NOW()
  );
END;
$$;

-- ============================================
-- 4. バトル報酬処理（原子的操作）
-- コイン追加 → ステージクリア → ドロップユニット追加 を一括処理
-- ============================================
CREATE OR REPLACE FUNCTION execute_battle_reward(
  p_player_id UUID,
  p_coins_gained INT,
  p_stage_id TEXT,
  p_dropped_unit_ids TEXT[]
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_coins INT;
  v_inventory JSONB;
  v_cleared_stages JSONB;
  v_unit_id TEXT;
  v_current_count INT;
BEGIN
  -- プレイヤーデータを取得（行ロック）
  SELECT coins, unit_inventory, cleared_stages
  INTO v_current_coins, v_inventory, v_cleared_stages
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
  v_current_coins := v_current_coins + p_coins_gained;

  -- ステージクリアを追加（まだクリアしていない場合のみ）
  IF NOT v_cleared_stages ? p_stage_id THEN
    v_cleared_stages := v_cleared_stages || to_jsonb(ARRAY[p_stage_id]);
  END IF;

  -- ドロップユニットを追加
  IF p_dropped_unit_ids IS NOT NULL AND array_length(p_dropped_unit_ids, 1) > 0 THEN
    FOREACH v_unit_id IN ARRAY p_dropped_unit_ids LOOP
      v_current_count := COALESCE((v_inventory->>v_unit_id)::INT, 0);
      v_inventory := jsonb_set(
        v_inventory,
        ARRAY[v_unit_id],
        to_jsonb(v_current_count + 1)
      );
    END LOOP;
  END IF;

  -- データベース更新
  UPDATE player_data
  SET
    coins = v_current_coins,
    unit_inventory = v_inventory,
    cleared_stages = v_cleared_stages,
    updated_at = NOW()
  WHERE player_id = p_player_id;

  -- 成功レスポンス
  RETURN json_build_object(
    'success', true,
    'coins', v_current_coins,
    'unit_inventory', v_inventory,
    'cleared_stages', v_cleared_stages,
    'server_time', NOW()
  );
END;
$$;

-- ============================================
-- 5. プレイヤーデータ取得（キャッシュ用）
-- 最新のサーバーデータを取得
-- ============================================
CREATE OR REPLACE FUNCTION get_player_data_with_timestamp(
  p_player_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_data RECORD;
BEGIN
  SELECT *
  INTO v_data
  FROM player_data
  WHERE player_id = p_player_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'player_not_found'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'data', row_to_json(v_data),
    'server_time', NOW()
  );
END;
$$;

-- ============================================
-- RLSポリシー（anonユーザーがRPCを実行可能に）
-- ============================================
-- RPC関数はデフォルトでanonユーザーが実行可能
-- 必要に応じてSECURITY DEFINERを追加

COMMENT ON FUNCTION get_server_time() IS 'サーバーの現在時刻を取得';
COMMENT ON FUNCTION execute_gacha(UUID, INT, TEXT[]) IS 'ガチャを原子的に実行（コイン消費＋ユニット追加）';
COMMENT ON FUNCTION execute_fusion(UUID, TEXT[], TEXT) IS 'フュージョンを原子的に実行（素材消費＋結果追加）';
COMMENT ON FUNCTION execute_battle_reward(UUID, INT, TEXT, TEXT[]) IS 'バトル報酬を原子的に処理';
COMMENT ON FUNCTION get_player_data_with_timestamp(UUID) IS 'サーバー時刻付きでプレイヤーデータを取得';
