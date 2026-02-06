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
  p_unit_id TEXT,
  p_item_uid TEXT DEFAULT NULL -- 追加: 特定の商品インスタンスID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_coins INT;
  v_inventory JSONB;
  v_shop_items JSONB;
  v_item_index INT := -1;
  v_item JSONB;
  v_current_count INT;
  
  -- イテレーション用
  v_elem JSONB;
  v_idx INT;
BEGIN
  -- プレイヤーデータを取得（行ロック）
  SELECT coins, unit_inventory, shop_items
  INTO v_current_coins, v_inventory, v_shop_items
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

  -- ショップアイテムの検証（p_item_uidが指定されている場合）
  IF p_item_uid IS NOT NULL THEN
    -- JSONB配列を走査して対象アイテムを探す
    -- note: jsonb_array_elements_text with ordinality is useful but awkward in PL/pgSQL simple loop
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_shop_items) LOOP
      IF v_elem->>'uid' = p_item_uid THEN
        -- 見つかった
        IF (v_elem->>'soldOut')::BOOLEAN = TRUE THEN
           RETURN json_build_object(
            'success', false,
            'error', 'item_already_sold_out'
          );
        END IF;
        
        -- 価格改ざんチェック（オプション：許容範囲内か、完全一致か）
        -- ここではクライアントが送ってきたp_priceとDB内の価格が一致するか確認し、
        -- 不一致ならエラーにする（セキュリティ強化）
        IF (v_elem->>'price')::INT <> p_price THEN
           RETURN json_build_object(
            'success', false,
            'error', 'price_mismatch',
            'server_price', (v_elem->>'price')::INT,
            'client_price', p_price
          );
        END IF;

        -- 更新対象としてマーク（後で置換）
        -- ここでは単純に新しいJSONBを作成して置き換えるのが安全
        -- v_item_indexはループ外で使うにはカーソルが必要だが、
        -- JSONB再構築の方が確実
        EXIT; 
      END IF;
    END LOOP;

    -- 対象アイテムの状態を更新 (soldOut: true)
    -- jsonb_setで配列内のオブジェクトを更新するのはパス指定が難しいため、
    -- SQL関数を使って再構築する
    SELECT jsonb_agg(
      CASE 
        WHEN elem->>'uid' = p_item_uid THEN jsonb_set(elem, '{soldOut}', 'true'::jsonb)
        ELSE elem
      END
    )
    INTO v_shop_items
    FROM jsonb_array_elements(v_shop_items) elem;
    
    -- 何も更新されなかった場合（アイテムが見つからなかった）
    IF v_shop_items IS NULL OR NOT (v_shop_items @> ('[{"uid": "' || p_item_uid || '"}]')::jsonb) THEN
       -- 元の配列に戻す（NULLチェック）
       -- SELECT INTOで元の行が消えることはないが、agg結果がNULLになる可能性はある（空配列の場合など）
       -- ただし空配列ならループに入らないのでここは通らないはずだが、uidが見つからないケース
       -- アイテムが存在しない
       RETURN json_build_object(
          'success', false,
          'error', 'item_not_found'
       );
    END IF;
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
    shop_items = v_shop_items, -- 更新されたショップリストを保存
    updated_at = NOW()
  WHERE player_id = p_player_id;

  -- 成功レスポンス
  RETURN json_build_object(
    'success', true,
    'coins', v_current_coins - p_price,
    'unit_inventory', v_inventory,
    'shop_items', v_shop_items,
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
