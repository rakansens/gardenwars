// Supabase client and utilities
export { supabase } from "./client";
export type { DbPlayer, DbPlayerData, DbRankings, DbPlayerInsert, DbPlayerDataInsert, DbPlayerDataUpdate } from "./client";

// Generated database types (run `npm run db:types` to update)
export type { Database, Tables, TablesInsert, TablesUpdate } from "./database.types";

// Types (centralized)
export type {
    DBPlayer,
    DBPlayerData,
    DBRankings,
    ShopItem,
    GachaHistoryEntry,
    FullPlayerData,
    FrontendPlayerData,
    SupabaseSaveData,
    LocalStorageMigrationData,
} from "./types";
export { toFrontendPlayerData, toSupabaseSaveData, INITIAL_COINS, MAX_LOADOUTS } from "./types";

// Backward compatibility aliases
export type { DBPlayer as Player, DBPlayerData as PlayerData, LocalStorageMigrationData as LocalStorageData } from "./types";

// Authentication
export {
    registerPlayer,
    loginWithPIN,
    verifyPIN,
    migrateLocalData,
    updatePlayerName,
} from "./auth";

// Player data operations
export {
    savePlayerData,
    getPlayerData,
    getPlayerName,
    updateCoins,
    addCoins,
    spendCoins,
    updateUnitInventory,
    addUnit,
    updateSelectedTeam,
    updateLoadouts,
    updateActiveLoadoutIndex,
    addClearedStage,
    updateGardenUnits,
    updateShopItems,
    markShopItemSold,
    updateRankings,
    incrementBattleStats,
    incrementGachaCount,
    incrementGardenVisits,
    syncRankingStats,
    getRankings,
    // Async battle
    getAsyncOpponents,
    saveAsyncBattleResult,
    getAsyncBattleHistory,
} from "./playerData";
export type { RankingEntry, RankingSortBy, RankingUpdateData, AsyncBattleResult, AsyncOpponent, DataResult } from "./playerData";
