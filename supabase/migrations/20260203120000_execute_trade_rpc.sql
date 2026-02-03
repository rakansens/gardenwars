-- ================================================
-- Trade RPC (server-authoritative)
-- ================================================
-- Trade history table
CREATE TABLE IF NOT EXISTS trade_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_a_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  player_b_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  offer_a_units JSONB DEFAULT '{}'::jsonb,
  offer_a_coins INTEGER DEFAULT 0,
  offer_b_units JSONB DEFAULT '{}'::jsonb,
  offer_b_coins INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_history_player_a ON trade_history(player_a_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_player_b ON trade_history(player_b_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_created_at ON trade_history(created_at DESC);

ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous select on trade_history"
  ON trade_history FOR SELECT TO anon USING (true);

CREATE OR REPLACE FUNCTION execute_trade(
  p_player_a_id UUID,
  p_player_b_id UUID,
  p_offer_a JSONB,
  p_offer_b JSONB
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_a_coins INT;
  v_b_coins INT;
  v_a_inventory JSONB;
  v_b_inventory JSONB;
  v_offer_a_units JSONB := COALESCE(p_offer_a->'units', '{}'::jsonb);
  v_offer_b_units JSONB := COALESCE(p_offer_b->'units', '{}'::jsonb);
  v_offer_a_coins INT := COALESCE((p_offer_a->>'coins')::INT, 0);
  v_offer_b_coins INT := COALESCE((p_offer_b->>'coins')::INT, 0);
  v_unit_id TEXT;
  v_needed INT;
  v_owned INT;
  v_new_count INT;
  v_first_id UUID;
  v_second_id UUID;
  v_first_coins INT;
  v_second_coins INT;
  v_first_inventory JSONB;
  v_second_inventory JSONB;
BEGIN
  IF p_player_a_id IS NULL OR p_player_b_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'player_id_missing');
  END IF;

  IF p_player_a_id = p_player_b_id THEN
    RETURN json_build_object('success', false, 'error', 'invalid_player_pair');
  END IF;

  v_offer_a_coins := GREATEST(0, v_offer_a_coins);
  v_offer_b_coins := GREATEST(0, v_offer_b_coins);

  -- Lock in deterministic order to avoid deadlocks
  v_first_id := LEAST(p_player_a_id, p_player_b_id);
  v_second_id := GREATEST(p_player_a_id, p_player_b_id);

  SELECT coins, unit_inventory
  INTO v_first_coins, v_first_inventory
  FROM player_data
  WHERE player_id = v_first_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'player_not_found');
  END IF;

  SELECT coins, unit_inventory
  INTO v_second_coins, v_second_inventory
  FROM player_data
  WHERE player_id = v_second_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'player_not_found');
  END IF;

  IF v_first_id = p_player_a_id THEN
    v_a_coins := v_first_coins;
    v_a_inventory := v_first_inventory;
    v_b_coins := v_second_coins;
    v_b_inventory := v_second_inventory;
  ELSE
    v_a_coins := v_second_coins;
    v_a_inventory := v_second_inventory;
    v_b_coins := v_first_coins;
    v_b_inventory := v_first_inventory;
  END IF;

  IF v_a_coins < v_offer_a_coins THEN
    RETURN json_build_object('success', false, 'error', 'insufficient_coins_a', 'current_coins', v_a_coins);
  END IF;

  IF v_b_coins < v_offer_b_coins THEN
    RETURN json_build_object('success', false, 'error', 'insufficient_coins_b', 'current_coins', v_b_coins);
  END IF;

  -- Validate A units
  FOR v_unit_id, v_needed IN SELECT key, value::int FROM jsonb_each_text(v_offer_a_units) LOOP
    IF v_needed < 0 THEN
      RETURN json_build_object('success', false, 'error', 'invalid_unit_count');
    END IF;
    v_owned := COALESCE((v_a_inventory->>v_unit_id)::INT, 0);
    IF v_owned < v_needed THEN
      RETURN json_build_object('success', false, 'error', 'insufficient_units_a', 'unit_id', v_unit_id);
    END IF;
  END LOOP;

  -- Validate B units
  FOR v_unit_id, v_needed IN SELECT key, value::int FROM jsonb_each_text(v_offer_b_units) LOOP
    IF v_needed < 0 THEN
      RETURN json_build_object('success', false, 'error', 'invalid_unit_count');
    END IF;
    v_owned := COALESCE((v_b_inventory->>v_unit_id)::INT, 0);
    IF v_owned < v_needed THEN
      RETURN json_build_object('success', false, 'error', 'insufficient_units_b', 'unit_id', v_unit_id);
    END IF;
  END LOOP;

  -- Transfer units A -> B
  FOR v_unit_id, v_needed IN SELECT key, value::int FROM jsonb_each_text(v_offer_a_units) LOOP
    IF v_needed <= 0 THEN CONTINUE; END IF;
    v_owned := COALESCE((v_a_inventory->>v_unit_id)::INT, 0);
    v_new_count := v_owned - v_needed;
    IF v_new_count <= 0 THEN
      v_a_inventory := v_a_inventory - v_unit_id;
    ELSE
      v_a_inventory := jsonb_set(v_a_inventory, ARRAY[v_unit_id], to_jsonb(v_new_count));
    END IF;

    v_owned := COALESCE((v_b_inventory->>v_unit_id)::INT, 0);
    v_b_inventory := jsonb_set(v_b_inventory, ARRAY[v_unit_id], to_jsonb(v_owned + v_needed));
  END LOOP;

  -- Transfer units B -> A
  FOR v_unit_id, v_needed IN SELECT key, value::int FROM jsonb_each_text(v_offer_b_units) LOOP
    IF v_needed <= 0 THEN CONTINUE; END IF;
    v_owned := COALESCE((v_b_inventory->>v_unit_id)::INT, 0);
    v_new_count := v_owned - v_needed;
    IF v_new_count <= 0 THEN
      v_b_inventory := v_b_inventory - v_unit_id;
    ELSE
      v_b_inventory := jsonb_set(v_b_inventory, ARRAY[v_unit_id], to_jsonb(v_new_count));
    END IF;

    v_owned := COALESCE((v_a_inventory->>v_unit_id)::INT, 0);
    v_a_inventory := jsonb_set(v_a_inventory, ARRAY[v_unit_id], to_jsonb(v_owned + v_needed));
  END LOOP;

  -- Transfer coins
  v_a_coins := v_a_coins - v_offer_a_coins + v_offer_b_coins;
  v_b_coins := v_b_coins - v_offer_b_coins + v_offer_a_coins;

  UPDATE player_data
  SET coins = v_a_coins,
      unit_inventory = v_a_inventory,
      updated_at = NOW()
  WHERE player_id = p_player_a_id;

  UPDATE player_data
  SET coins = v_b_coins,
      unit_inventory = v_b_inventory,
      updated_at = NOW()
  WHERE player_id = p_player_b_id;

  INSERT INTO trade_history (
    player_a_id,
    player_b_id,
    offer_a_units,
    offer_a_coins,
    offer_b_units,
    offer_b_coins
  ) VALUES (
    p_player_a_id,
    p_player_b_id,
    v_offer_a_units,
    v_offer_a_coins,
    v_offer_b_units,
    v_offer_b_coins
  );

  RETURN json_build_object(
    'success', true,
    'player_a', json_build_object('player_id', p_player_a_id, 'coins', v_a_coins, 'unit_inventory', v_a_inventory),
    'player_b', json_build_object('player_id', p_player_b_id, 'coins', v_b_coins, 'unit_inventory', v_b_inventory),
    'server_time', NOW()
  );
END;
$$;

COMMENT ON FUNCTION execute_trade(UUID, UUID, JSONB, JSONB) IS 'Server-authoritative trade between two players.';
