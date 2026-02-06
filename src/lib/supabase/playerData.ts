import { supabase } from "./client";
import { DBPlayerData, ShopItem, GachaHistoryEntry, SupabaseSaveData } from "./types";

// Use DBPlayerData internally but alias for function signatures
type PlayerData = DBPlayerData;

// Error result type for functions that need to return error information
export interface DataResult<T> {
    data: T;
    error: string | null;
}

// Save player data (full update)
export async function savePlayerData(
    playerId: string,
    data: Partial<Omit<PlayerData, "id" | "player_id" | "updated_at">>
): Promise<boolean> {
    const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };

    if (data.coins !== undefined) updateData.coins = data.coins;
    if (data.unit_inventory !== undefined) updateData.unit_inventory = data.unit_inventory;
    if (data.selected_team !== undefined) updateData.selected_team = data.selected_team;
    if (data.loadouts !== undefined) updateData.loadouts = data.loadouts;
    if (data.cleared_stages !== undefined) updateData.cleared_stages = data.cleared_stages;
    if (data.garden_units !== undefined) updateData.garden_units = data.garden_units;
    if (data.shop_items !== undefined) updateData.shop_items = data.shop_items;
    if (data.gacha_history !== undefined) updateData.gacha_history = data.gacha_history;
    if (data.active_loadout_index !== undefined) updateData.active_loadout_index = data.active_loadout_index;

    const { error } = await supabase
        .from("player_data")
        .update(updateData)
        .eq("player_id", playerId);

    return !error;
}

// Get player name from players table
export async function getPlayerName(playerId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from("players")
        .select("name")
        .eq("id", playerId)
        .single();

    if (error || !data) return null;
    return data.name || null;
}

// Get player data
export async function getPlayerData(playerId: string): Promise<PlayerData | null> {
    const { data, error } = await supabase
        .from("player_data")
        .select("*")
        .eq("player_id", playerId)
        .single();

    if (error || !data) return null;

    return {
        ...data,
        // JSONB フィールドを適切な型にキャスト（Json型からunknown経由で変換）
        unit_inventory: (data.unit_inventory as unknown as Record<string, number>) || {},
        selected_team: (data.selected_team as unknown as string[]) || [],
        loadouts: (data.loadouts as unknown as string[][]) || [[], [], []],
        cleared_stages: (data.cleared_stages as unknown as string[]) || [],
        garden_units: (data.garden_units as unknown as string[]) || [],
        shop_items: (data.shop_items as unknown as ShopItem[]) || [],
        gacha_history: ((data as any).gacha_history as GachaHistoryEntry[]) || [],
        current_world: ((data as any).current_world as string) || "world1",
    };
}

// Update coins
export async function updateCoins(playerId: string, coins: number): Promise<boolean> {
    return savePlayerData(playerId, { coins });
}

// Add coins
export async function addCoins(playerId: string, amount: number): Promise<boolean> {
    const playerData = await getPlayerData(playerId);
    if (!playerData) return false;

    const currentCoins = playerData.coins ?? 0;
    return savePlayerData(playerId, { coins: currentCoins + amount });
}

// Spend coins
export async function spendCoins(playerId: string, amount: number): Promise<boolean> {
    const playerData = await getPlayerData(playerId);
    const currentCoins = playerData?.coins ?? 0;
    if (!playerData || currentCoins < amount) return false;

    return savePlayerData(playerId, { coins: currentCoins - amount });
}

// Update unit inventory
export async function updateUnitInventory(
    playerId: string,
    unitInventory: Record<string, number>
): Promise<boolean> {
    return savePlayerData(playerId, { unit_inventory: unitInventory });
}

// Add unit to inventory
export async function addUnit(playerId: string, unitId: string, count: number = 1): Promise<boolean> {
    const playerData = await getPlayerData(playerId);
    if (!playerData) return false;

    const inventory = playerData.unit_inventory ?? {};
    const currentCount = inventory[unitId] || 0;
    const newInventory = {
        ...inventory,
        [unitId]: currentCount + count,
    };

    return savePlayerData(playerId, { unit_inventory: newInventory });
}

// Update selected team
export async function updateSelectedTeam(playerId: string, team: string[]): Promise<boolean> {
    return savePlayerData(playerId, { selected_team: team });
}

// Update loadouts
export async function updateLoadouts(playerId: string, loadouts: string[][]): Promise<boolean> {
    return savePlayerData(playerId, { loadouts });
}

// Update active loadout index
export async function updateActiveLoadoutIndex(playerId: string, index: number): Promise<boolean> {
    return savePlayerData(playerId, { active_loadout_index: index });
}

// Add cleared stage
export async function addClearedStage(playerId: string, stageId: string): Promise<boolean> {
    const playerData = await getPlayerData(playerId);
    if (!playerData) return false;

    const clearedStages = playerData.cleared_stages ?? [];
    if (clearedStages.includes(stageId)) return true;

    const newClearedStages = [...clearedStages, stageId];
    return savePlayerData(playerId, { cleared_stages: newClearedStages });
}

// Update garden units
export async function updateGardenUnits(playerId: string, gardenUnits: string[]): Promise<boolean> {
    return savePlayerData(playerId, { garden_units: gardenUnits });
}

// Update shop items
export async function updateShopItems(playerId: string, shopItems: ShopItem[]): Promise<boolean> {
    return savePlayerData(playerId, { shop_items: shopItems });
}

// Mark shop item as sold
export async function markShopItemSold(playerId: string, uid: string): Promise<boolean> {
    const playerData = await getPlayerData(playerId);
    if (!playerData) return false;

    const shopItems = playerData.shop_items ?? [];
    const newShopItems = shopItems.map((item) =>
        item.uid === uid ? { ...item, soldOut: true } : item
    );

    return savePlayerData(playerId, { shop_items: newShopItems });
}

// ============================================
// Rankings functions
// ============================================

export interface RankingUpdateData {
    max_stage?: number;
    total_wins?: number;
    total_battles?: number;
    total_coins?: number;
    collection_count?: number;
    total_units?: number;
    // 新規追加フィールド
    ur_unit_count?: number;
    gacha_count?: number;
    garden_visits?: number;
    stages_cleared?: number;
    win_streak?: number;
    max_win_streak?: number;
    max_cleared_stage_id?: string;  // 最高クリアステージID
}

export interface RankingEntry {
    player_id: string;
    player_name: string;
    max_stage: number;
    total_wins: number;
    total_battles: number;
    total_coins: number;
    collection_count: number;
    total_units: number;
    // 新規追加フィールド
    ur_unit_count: number;
    gacha_count: number;
    garden_visits: number;
    stages_cleared: number;
    win_streak: number;
    max_win_streak: number;
    max_cleared_stage_id: string | null;  // 最高クリアステージID
    // ロードアウト（デッキ）
    selected_team: string[];
}

// Ensure rankings row exists for a player
export async function ensureRankingsExist(playerId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from("rankings")
        .select("player_id")
        .eq("player_id", playerId)
        .single();

    if (error && error.code === 'PGRST116') {
        // Row doesn't exist, create it
        const { error: insertError } = await supabase
            .from("rankings")
            .insert({ player_id: playerId });

        if (insertError) {
            console.error("Failed to create rankings entry:", insertError);
            return false;
        }
    } else if (error) {
        console.error("Failed to check rankings existence:", error);
        return false;
    }

    return true;
}

// Update rankings using upsert to handle missing rows
export async function updateRankings(
    playerId: string,
    data: RankingUpdateData
): Promise<boolean> {
    // Use upsert to create row if it doesn't exist
    const { error } = await supabase
        .from("rankings")
        .upsert({
            player_id: playerId,
            ...data,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'player_id'
        })
        .select();

    if (error) {
        console.error("Failed to update rankings:", error);
        return false;
    }

    return true;
}

// NOTE: incrementBattleStats, incrementGachaCount, incrementGardenVisits are now
// implemented as RPCs in serverAuthority.ts for atomic operations.
// Use incrementBattleStatsRpc, incrementGachaCountRpc, incrementGardenVisitsRpc instead.

// Update collection and coin stats (called when player data changes)
export async function syncRankingStats(
    playerId: string,
    coins: number | undefined,
    unitInventory: Record<string, number>,
    clearedStages?: string[]
): Promise<boolean> {
    const collectionCount = Object.keys(unitInventory).length;
    const totalUnits = Object.values(unitInventory).reduce((sum, count) => sum + count, 0);
    // URユニット数をカウント（IDに"ur_"を含むもの）
    const urUnitCount = Object.keys(unitInventory).filter(id =>
        id.startsWith("ur_") && unitInventory[id] > 0
    ).length;

    const updates: RankingUpdateData = {
        collection_count: collectionCount,
        total_units: totalUnits,
        ur_unit_count: urUnitCount,
    };

    if (coins !== undefined) {
        updates.total_coins = coins;
    }

    if (clearedStages !== undefined) {
        updates.stages_cleared = clearedStages.length;
    }

    return updateRankings(playerId, updates);
}

// Get rankings (leaderboard)
export type RankingSortBy =
    | "max_stage"
    | "total_wins"
    | "total_battles"
    | "total_coins"
    | "collection_count"
    | "total_units"
    | "ur_unit_count"
    | "gacha_count"
    | "garden_visits"
    | "stages_cleared"
    | "max_win_streak";

export async function getRankings(
    sortBy: RankingSortBy = "max_stage",
    limit: number = 50,
    includeLoadout: boolean = false
): Promise<DataResult<RankingEntry[]>> {
    // ランキングデータを取得
    const { data, error } = await supabase
        .from("rankings")
        .select(`
            player_id,
            max_stage,
            total_wins,
            total_battles,
            total_coins,
            collection_count,
            total_units,
            ur_unit_count,
            gacha_count,
            garden_visits,
            stages_cleared,
            win_streak,
            max_win_streak,
            max_cleared_stage_id,
            players!inner(name)
        `)
        .order(sortBy, { ascending: false })
        .limit(limit);

    if (error || !data) {
        const errorMsg = error?.message || "Failed to fetch rankings";
        console.error("getRankings error:", error);
        return { data: [], error: errorMsg };
    }

    // ロードアウト取得が不要な場合は早期リターン
    if (!includeLoadout) {
        return {
            data: data.map((row) => ({
                player_id: row.player_id || "",
                player_name: (row.players as unknown as { name: string })?.name || "Unknown",
                max_stage: row.max_stage ?? 0,
                total_wins: row.total_wins ?? 0,
                total_battles: row.total_battles ?? 0,
                total_coins: row.total_coins ?? 0,
                collection_count: row.collection_count ?? 0,
                total_units: row.total_units ?? 0,
                ur_unit_count: row.ur_unit_count ?? 0,
                gacha_count: row.gacha_count ?? 0,
                garden_visits: row.garden_visits ?? 0,
                stages_cleared: row.stages_cleared ?? 0,
                win_streak: row.win_streak ?? 0,
                max_win_streak: row.max_win_streak ?? 0,
                max_cleared_stage_id: (row as any).max_cleared_stage_id || null,
                selected_team: [],
            })),
            error: null,
        };
    }

    // プレイヤーIDリストを取得
    const playerIds = data.map(row => row.player_id).filter(Boolean);

    // player_dataからselected_teamを別途取得
    const { data: playerDataList } = await supabase
        .from("player_data")
        .select("player_id, selected_team")
        .in("player_id", playerIds);

    // player_idをキーにしたマップを作成
    const playerDataMap = new Map<string, string[]>();
    if (playerDataList) {
        playerDataList.forEach(pd => {
            if (!pd.player_id) return;
            const team = (pd.selected_team as unknown as string[]) || [];
            playerDataMap.set(pd.player_id, team);
        });
    }

    return {
        data: data.map((row) => ({
            player_id: row.player_id || "",
            player_name: (row.players as unknown as { name: string })?.name || "Unknown",
            max_stage: row.max_stage ?? 0,
            total_wins: row.total_wins ?? 0,
            total_battles: row.total_battles ?? 0,
            total_coins: row.total_coins ?? 0,
            collection_count: row.collection_count ?? 0,
            total_units: row.total_units ?? 0,
            ur_unit_count: row.ur_unit_count ?? 0,
            gacha_count: row.gacha_count ?? 0,
            garden_visits: row.garden_visits ?? 0,
            stages_cleared: row.stages_cleared ?? 0,
            win_streak: row.win_streak ?? 0,
            max_win_streak: row.max_win_streak ?? 0,
            max_cleared_stage_id: (row as any).max_cleared_stage_id || null,
            selected_team: playerDataMap.get(row.player_id || "") || [],
        })),
        error: null,
    };
}

// ============================================
// Player Battle Stats
// ============================================

export interface PlayerBattleStats {
    total_battles: number;
    total_wins: number;
    win_streak: number;
    max_win_streak: number;
    stages_cleared: number;
    max_stage: number;
}

/**
 * Get a single player's battle statistics
 */
export async function getPlayerBattleStats(
    playerId: string
): Promise<DataResult<PlayerBattleStats | null>> {
    const { data, error } = await supabase
        .from("rankings")
        .select("total_battles, total_wins, win_streak, max_win_streak, stages_cleared, max_stage")
        .eq("player_id", playerId)
        .single();

    if (error) {
        // Not found is OK - player may not have stats yet
        if (error.code === "PGRST116") {
            return {
                data: {
                    total_battles: 0,
                    total_wins: 0,
                    win_streak: 0,
                    max_win_streak: 0,
                    stages_cleared: 0,
                    max_stage: 0,
                },
                error: null,
            };
        }
        console.error("getPlayerBattleStats error:", error);
        return { data: null, error: error.message };
    }

    return {
        data: {
            total_battles: data.total_battles ?? 0,
            total_wins: data.total_wins ?? 0,
            win_streak: data.win_streak ?? 0,
            max_win_streak: data.max_win_streak ?? 0,
            stages_cleared: data.stages_cleared ?? 0,
            max_stage: data.max_stage ?? 0,
        },
        error: null,
    };
}

// ============================================
// Async Battle functions
// ============================================

export type BattleType = 'async' | 'realtime';

export interface AsyncBattleResult {
    id?: string;
    attacker_id: string;
    defender_id: string;
    attacker_name?: string;
    defender_name?: string;
    attacker_deck: string[];
    defender_deck: string[];
    winner: 'attacker' | 'defender';
    attacker_castle_hp: number;
    defender_castle_hp: number;
    attacker_kills: number;
    defender_kills: number;
    battle_duration: number;
    battle_type?: BattleType;
    created_at?: string;
}

export interface AsyncOpponent {
    player_id: string;
    player_name: string;
    max_stage: number;
    selected_team: string[];
}

// Get list of potential opponents for async battle
export async function getAsyncOpponents(
    currentPlayerId: string,
    limit: number = 20
): Promise<DataResult<AsyncOpponent[]>> {
    // Get rankings with player data
    const { data, error } = await supabase
        .from("rankings")
        .select(`
            player_id,
            max_stage,
            players!inner(name)
        `)
        .neq("player_id", currentPlayerId)
        .order("max_stage", { ascending: false })
        .limit(limit);

    if (error || !data) {
        const errorMsg = error?.message || "Failed to fetch opponents";
        console.error("getAsyncOpponents error:", error);
        return { data: [], error: errorMsg };
    }

    // Get player_data for selected_team
    const playerIds = data.map(row => row.player_id).filter(Boolean);

    const { data: playerDataList } = await supabase
        .from("player_data")
        .select("player_id, selected_team")
        .in("player_id", playerIds);

    const playerDataMap = new Map<string, string[]>();
    if (playerDataList) {
        playerDataList.forEach(pd => {
            if (!pd.player_id) return;
            const team = (pd.selected_team as unknown as string[]) || [];
            playerDataMap.set(pd.player_id, team);
        });
    }

    return {
        data: data
            .map((row) => ({
                player_id: row.player_id || "",
                player_name: (row.players as unknown as { name: string })?.name || "Unknown",
                max_stage: row.max_stage ?? 0,
                selected_team: playerDataMap.get(row.player_id || "") || [],
            }))
            .filter(opponent => opponent.selected_team.length > 0), // Only show opponents with a deck
        error: null,
    };
}

// Save async battle result
// Note: async_battles table needs to be created in Supabase first
export async function saveAsyncBattleResult(
    result: Omit<AsyncBattleResult, 'id' | 'created_at' | 'attacker_name' | 'defender_name'>
): Promise<{ success: boolean; error: string | null }> {
    // Use type assertion since async_battles isn't in generated types yet
    const { error } = await (supabase as any)
        .from("async_battles")
        .insert({
            attacker_id: result.attacker_id,
            defender_id: result.defender_id,
            attacker_deck: result.attacker_deck,
            defender_deck: result.defender_deck,
            winner: result.winner,
            attacker_castle_hp: result.attacker_castle_hp,
            defender_castle_hp: result.defender_castle_hp,
            attacker_kills: result.attacker_kills,
            defender_kills: result.defender_kills,
            battle_duration: result.battle_duration,
            battle_type: result.battle_type ?? 'async',
        });

    if (error) {
        const errorMsg = error.message || "Failed to save battle result";
        console.error("saveAsyncBattleResult error:", error);
        return { success: false, error: errorMsg };
    }

    return { success: true, error: null };
}

// Get async battle history for a player
// Note: async_battles table needs to be created in Supabase first
export async function getAsyncBattleHistory(
    playerId: string,
    limit: number = 20,
    battleType?: BattleType
): Promise<DataResult<AsyncBattleResult[]>> {
    // Use type assertion since async_battles isn't in generated types yet
    let query = (supabase as any)
        .from("async_battles")
        .select("*")
        .or(`attacker_id.eq.${playerId},defender_id.eq.${playerId}`)
        .order("created_at", { ascending: false })
        .limit(limit);

    // Filter by battle type if specified
    if (battleType) {
        query = query.eq("battle_type", battleType);
    }

    const { data, error } = await query;

    if (error || !data) {
        const errorMsg = error?.message || "Failed to fetch battle history";
        console.error("getAsyncBattleHistory error:", error);
        return { data: [], error: errorMsg };
    }

    // Get player names
    const playerIds = new Set<string>();
    (data as any[]).forEach((row: any) => {
        if (row.attacker_id) playerIds.add(row.attacker_id);
        if (row.defender_id) playerIds.add(row.defender_id);
    });

    const playerNameMap = new Map<string, string>();

    if (playerIds.size > 0) {
        const playerIdsArray = Array.from(playerIds);
        console.log("[getAsyncBattleHistory] Looking up player names for IDs:", playerIdsArray);

        const { data: players, error: playersError } = await supabase
            .from("players")
            .select("id, name")
            .in("id", playerIdsArray);

        if (playersError) {
            console.error("[getAsyncBattleHistory] Error fetching player names:", playersError);
        } else {
            console.log("[getAsyncBattleHistory] Found players:", players?.length || 0);
        }

        if (players) {
            players.forEach(p => {
                if (p.id) playerNameMap.set(p.id, p.name || "Unknown");
            });
        }
    }

    return {
        data: (data as any[]).map((row: any) => ({
            id: row.id,
            attacker_id: row.attacker_id || "",
            defender_id: row.defender_id || "",
            attacker_name: playerNameMap.get(row.attacker_id || "") || "Unknown",
            defender_name: playerNameMap.get(row.defender_id || "") || "Unknown",
            attacker_deck: (row.attacker_deck as string[]) || [],
            defender_deck: (row.defender_deck as string[]) || [],
            winner: row.winner as 'attacker' | 'defender',
            attacker_castle_hp: row.attacker_castle_hp ?? 0,
            defender_castle_hp: row.defender_castle_hp ?? 0,
            attacker_kills: row.attacker_kills ?? 0,
            defender_kills: row.defender_kills ?? 0,
            battle_duration: row.battle_duration ?? 0,
            created_at: row.created_at,
        })),
        error: null,
    };
}

// Get all battle history (for ranking page)
export async function getAllBattleHistory(
    limit: number = 50,
    battleType?: BattleType
): Promise<DataResult<AsyncBattleResult[]>> {
    // Use type assertion since async_battles isn't in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
        .from("async_battles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

    // Filter by battle type if specified
    if (battleType) {
        query = query.eq("battle_type", battleType);
    }

    const { data, error } = await query;

    if (error || !data) {
        const errorMsg = error?.message || "Failed to fetch battle history";
        console.error("getAllBattleHistory error:", error);
        return { data: [], error: errorMsg };
    }

    // Get player names
    const playerIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any[]).forEach((row: any) => {
        if (row.attacker_id) playerIds.add(row.attacker_id);
        if (row.defender_id) playerIds.add(row.defender_id);
    });

    const playerNameMap = new Map<string, string>();

    if (playerIds.size > 0) {
        const playerIdsArray = Array.from(playerIds);
        console.log("[getAllBattleHistory] Looking up player names for IDs:", playerIdsArray);

        const { data: players, error: playersError } = await supabase
            .from("players")
            .select("id, name")
            .in("id", playerIdsArray);

        if (playersError) {
            console.error("[getAllBattleHistory] Error fetching player names:", playersError);
        } else {
            console.log("[getAllBattleHistory] Found players:", players?.length || 0);
        }

        if (players) {
            players.forEach(p => {
                if (p.id) playerNameMap.set(p.id, p.name || "Unknown");
            });
        }
    }

    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: (data as any[]).map((row: any) => ({
            id: row.id,
            attacker_id: row.attacker_id || "",
            defender_id: row.defender_id || "",
            attacker_name: playerNameMap.get(row.attacker_id || "") || "Unknown",
            defender_name: playerNameMap.get(row.defender_id || "") || "Unknown",
            attacker_deck: (row.attacker_deck as string[]) || [],
            defender_deck: (row.defender_deck as string[]) || [],
            winner: row.winner as 'attacker' | 'defender',
            attacker_castle_hp: row.attacker_castle_hp ?? 0,
            defender_castle_hp: row.defender_castle_hp ?? 0,
            attacker_kills: row.attacker_kills ?? 0,
            defender_kills: row.defender_kills ?? 0,
            battle_duration: row.battle_duration ?? 0,
            battle_type: (row.battle_type as BattleType) || 'async',
            created_at: row.created_at,
        })),
        error: null,
    };
}
