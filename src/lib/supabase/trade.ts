import { supabase } from "./client";
import type { DataResult } from "./playerData";

export interface TradeHistoryEntry {
  id: string;
  created_at: string;
  player_a_id: string;
  player_b_id: string;
  player_a_name: string;
  player_b_name: string;
  offer_a_units: Record<string, number>;
  offer_a_coins: number;
  offer_b_units: Record<string, number>;
  offer_b_coins: number;
}

export async function getTradeHistory(
  playerId: string,
  limit: number = 20
): Promise<DataResult<TradeHistoryEntry[]>> {
  // Use type assertion since trade_history isn't in generated types yet
  const { data, error } = await (supabase as any)
    .from("trade_history")
    .select(
      `id,
       created_at,
       player_a_id,
       player_b_id,
       offer_a_units,
       offer_a_coins,
       offer_b_units,
       offer_b_coins,
       player_a:players!trade_history_player_a_id_fkey(name),
       player_b:players!trade_history_player_b_id_fkey(name)`
    )
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    const errorMsg = error?.message || "Failed to fetch trade history";
    console.error("getTradeHistory error:", error);
    return { data: [], error: errorMsg };
  }

  const entries = (data as any[]).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    player_a_id: row.player_a_id,
    player_b_id: row.player_b_id,
    player_a_name: row.player_a?.name || "Unknown",
    player_b_name: row.player_b?.name || "Unknown",
    offer_a_units: row.offer_a_units || {},
    offer_a_coins: row.offer_a_coins ?? 0,
    offer_b_units: row.offer_b_units || {},
    offer_b_coins: row.offer_b_coins ?? 0,
  }));

  return { data: entries, error: null };
}
