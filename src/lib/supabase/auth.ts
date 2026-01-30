import { supabase } from "./client";
import type { Database } from "./database.types";
import {
    DBPlayer,
    DBPlayerData,
    ShopItem,
    FullPlayerData,
    LocalStorageMigrationData,
    INITIAL_COINS,
} from "./types";

// Re-export types for backward compatibility
export type { DBPlayer as Player, DBPlayerData as PlayerData, ShopItem, FullPlayerData };
export type { LocalStorageMigrationData as LocalStorageData };

// Generate unique 6-digit PIN
async function generateUniquePIN(): Promise<string> {
    const maxAttempts = 10;

    for (let i = 0; i < maxAttempts; i++) {
        // Generate random 6-digit PIN
        const pin = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");

        // Check if PIN exists
        const { data } = await supabase
            .from("players")
            .select("pin")
            .eq("pin", pin)
            .single();

        if (!data) return pin; // PIN is available
    }

    throw new Error("PIN generation failed after maximum attempts");
}

// Register new player (with optional localStorage data migration)
export async function registerPlayer(
    name: string,
    localData?: LocalStorageMigrationData
): Promise<{ pin: string; player: FullPlayerData }> {
    // Generate unique PIN
    const pin = await generateUniquePIN();

    // Insert player
    const { data: player, error: playerError } = await supabase
        .from("players")
        .insert({ pin, name })
        .select()
        .single();

    if (playerError) throw new Error(`Failed to create player: ${playerError.message}`);

    // Prepare initial data (merge with localStorage data if provided)
    const initialData: Record<string, unknown> = {
        player_id: player.id,
    };

    if (localData) {
        if (localData.coins !== undefined) initialData.coins = localData.coins;
        if (localData.unitInventory) initialData.unit_inventory = localData.unitInventory;
        if (localData.selectedTeam) initialData.selected_team = localData.selectedTeam;
        if (localData.loadouts) initialData.loadouts = localData.loadouts;
        if (localData.activeLoadoutIndex !== undefined) initialData.active_loadout_index = localData.activeLoadoutIndex;
        if (localData.shopItems) initialData.shop_items = localData.shopItems;
        if (localData.clearedStages) initialData.cleared_stages = localData.clearedStages;
        if (localData.gardenUnits) initialData.garden_units = localData.gardenUnits;
    }

    // Create player_data with initial data
    const { data: playerData, error: dataError } = await supabase
        .from("player_data")
        .insert(initialData)
        .select()
        .single();

    if (dataError) throw new Error(`Failed to create player data: ${dataError.message}`);

    // Create rankings entry
    await supabase
        .from("rankings")
        .insert({ player_id: player.id });

    return {
        pin,
        player: {
            ...player,
            playerData: {
                ...playerData,
                // JSONB フィールドを適切な型にキャスト（Json型からunknown経由で変換）
                unit_inventory: (playerData.unit_inventory as unknown as Record<string, number>) || {},
                selected_team: (playerData.selected_team as unknown as string[]) || [],
                loadouts: (playerData.loadouts as unknown as string[][]) || [[], [], []],
                cleared_stages: (playerData.cleared_stages as unknown as string[]) || [],
                garden_units: (playerData.garden_units as unknown as string[]) || [],
                shop_items: (playerData.shop_items as unknown as ShopItem[]) || [],
            },
        },
    };
}

// Login with PIN
export async function loginWithPIN(pin: string): Promise<FullPlayerData | null> {
    // Find player by PIN
    const { data: player, error: playerError } = await supabase
        .from("players")
        .select("*")
        .eq("pin", pin)
        .single();

    if (playerError || !player) return null;

    // Get player_data
    const { data: playerData, error: dataError } = await supabase
        .from("player_data")
        .select("*")
        .eq("player_id", player.id)
        .single();

    if (dataError || !playerData) return null;

    // Update last_login_at
    await supabase
        .from("players")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", player.id);

    return {
        ...player,
        playerData: {
            ...playerData,
            // JSONB フィールドを適切な型にキャスト（Json型からunknown経由で変換）
            unit_inventory: (playerData.unit_inventory as unknown as Record<string, number>) || {},
            selected_team: (playerData.selected_team as unknown as string[]) || [],
            loadouts: (playerData.loadouts as unknown as string[][]) || [[], [], []],
            cleared_stages: (playerData.cleared_stages as unknown as string[]) || [],
            garden_units: (playerData.garden_units as unknown as string[]) || [],
            shop_items: (playerData.shop_items as unknown as ShopItem[]) || [],
        },
    };
}

// Verify if PIN exists and get player info (for auto-login)
export async function verifyPIN(pin: string): Promise<DBPlayer | null> {
    const { data: player, error } = await supabase
        .from("players")
        .select("*")
        .eq("pin", pin)
        .single();

    if (error || !player) return null;
    return player;
}

// Update player name
export async function updatePlayerName(
    playerId: string,
    newName: string
): Promise<boolean> {
    const trimmedName = newName.trim();
    if (!trimmedName || trimmedName.length > 20) return false;

    const { error } = await supabase
        .from("players")
        .update({
            name: trimmedName,
            updated_at: new Date().toISOString()
        })
        .eq("id", playerId);

    return !error;
}

// Migrate localStorage data to database for existing player
export async function migrateLocalData(
    pin: string,
    localData: LocalStorageMigrationData
): Promise<boolean> {
    const player = await loginWithPIN(pin);
    if (!player) return false;

    // JSONB フィールドは Json 型にキャストが必要
    const updateData = {
        coins: localData.coins ?? player.playerData.coins,
        unit_inventory: localData.unitInventory ?? player.playerData.unit_inventory,
        selected_team: localData.selectedTeam ?? player.playerData.selected_team,
        loadouts: localData.loadouts ?? player.playerData.loadouts,
        cleared_stages: localData.clearedStages ?? player.playerData.cleared_stages,
        garden_units: localData.gardenUnits ?? player.playerData.garden_units,
        shop_items: localData.shopItems ?? player.playerData.shop_items,
        active_loadout_index: localData.activeLoadoutIndex ?? player.playerData.active_loadout_index,
        updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
        .from("player_data")
        .update(updateData as unknown as Database["public"]["Tables"]["player_data"]["Update"])
        .eq("player_id", player.id);

    return !error;
}
