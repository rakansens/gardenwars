import { supabase } from "./client";
import { DBPlayerData, ShopItem, SupabaseSaveData } from "./types";

// Use DBPlayerData internally but alias for function signatures
type PlayerData = DBPlayerData;

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
    if (data.active_loadout_index !== undefined) updateData.active_loadout_index = data.active_loadout_index;

    const { error } = await supabase
        .from("player_data")
        .update(updateData)
        .eq("player_id", playerId);

    return !error;
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
}

// Update rankings
export async function updateRankings(
    playerId: string,
    data: RankingUpdateData
): Promise<boolean> {
    const { error } = await supabase
        .from("rankings")
        .update({
            ...data,
            updated_at: new Date().toISOString(),
        })
        .eq("player_id", playerId);

    return !error;
}

// Increment battle stats (called after each battle)
export async function incrementBattleStats(
    playerId: string,
    won: boolean,
    stageNum?: number
): Promise<boolean> {
    const { data: rankings, error: fetchError } = await supabase
        .from("rankings")
        .select("*")
        .eq("player_id", playerId)
        .single();

    if (fetchError || !rankings) return false;

    const totalBattles = rankings.total_battles ?? 0;
    const totalWins = rankings.total_wins ?? 0;
    const maxStage = rankings.max_stage ?? 0;
    const currentStreak = rankings.win_streak ?? 0;
    const maxStreak = rankings.max_win_streak ?? 0;

    const updates: RankingUpdateData = {
        total_battles: totalBattles + 1,
    };

    if (won) {
        updates.total_wins = totalWins + 1;
        // 連勝記録を更新
        const newStreak = currentStreak + 1;
        updates.win_streak = newStreak;
        if (newStreak > maxStreak) {
            updates.max_win_streak = newStreak;
        }
        if (stageNum !== undefined && stageNum > maxStage) {
            updates.max_stage = stageNum;
        }
    } else {
        // 負けたら連勝リセット
        updates.win_streak = 0;
    }

    return updateRankings(playerId, updates);
}

// Increment gacha count (called after gacha pull)
export async function incrementGachaCount(
    playerId: string,
    count: number = 1
): Promise<boolean> {
    const { data: rankings, error: fetchError } = await supabase
        .from("rankings")
        .select("gacha_count")
        .eq("player_id", playerId)
        .single();

    if (fetchError || !rankings) return false;

    const currentCount = rankings.gacha_count ?? 0;
    return updateRankings(playerId, { gacha_count: currentCount + count });
}

// Increment garden visits (called when opening garden)
export async function incrementGardenVisits(
    playerId: string
): Promise<boolean> {
    const { data: rankings, error: fetchError } = await supabase
        .from("rankings")
        .select("garden_visits")
        .eq("player_id", playerId)
        .single();

    if (fetchError || !rankings) return false;

    const currentVisits = rankings.garden_visits ?? 0;
    return updateRankings(playerId, { garden_visits: currentVisits + 1 });
}

// Update collection and coin stats (called when player data changes)
export async function syncRankingStats(
    playerId: string,
    coins: number,
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
        total_coins: coins,
        collection_count: collectionCount,
        total_units: totalUnits,
        ur_unit_count: urUnitCount,
    };

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
    limit: number = 50
): Promise<RankingEntry[]> {
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
            players!inner(name)
        `)
        .order(sortBy, { ascending: false })
        .limit(limit);

    if (error || !data) return [];

    return data.map((row) => ({
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
    }));
}
