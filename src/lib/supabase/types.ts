/**
 * Supabase データベース型定義
 *
 * 命名規則:
 * - DB* : データベースのカラム名（snake_case）
 * - *   : フロントエンド用（camelCase）
 */

// ============================================
// 共通型（フロントエンド・DB共通）
// ============================================

/**
 * ショップアイテム
 * DB保存時もこの形式のまま（JSONBカラム）
 */
export interface ShopItem {
    uid: string;
    unitId: string;
    price: number;
    soldOut: boolean;
    isRare: boolean;
    discount?: number;
}

/**
 * ガチャ履歴エントリ
 * ローカルストレージのみ保存（DBには保存しない）
 */
export interface GachaHistoryEntry {
    timestamp: number;
    unitIds: string[];
    count: number;
}

// ============================================
// データベース型（snake_case）
// ============================================

/**
 * players テーブル
 * 注意: DB側のnullable制約を反映（生成型 database.types.ts と整合）
 */
export interface DBPlayer {
    id: string;
    pin: string;
    name: string;
    created_at: string | null;  // DEFAULT NOW()
    updated_at: string | null;  // DEFAULT NOW()
    last_login_at: string | null;  // DEFAULT NOW()
}

/**
 * player_data テーブル
 * 注意: DB側のnullable制約を反映（生成型 database.types.ts と整合）
 */
export interface DBPlayerData {
    id: string;
    player_id: string | null;  // FK、実際はnullにならないがDB定義上nullable
    coins: number | null;       // DEFAULT 10000
    unit_inventory: Record<string, number> | null;
    selected_team: string[] | null;
    loadouts: string[][] | null;
    cleared_stages: string[] | null;
    garden_units: string[] | null;
    shop_items: ShopItem[] | null;
    active_loadout_index: number | null;  // DEFAULT 0
    updated_at: string | null;
}

/**
 * rankings テーブル
 * 注意: DB側のnullable制約を反映（生成型 database.types.ts と整合）
 */
export interface DBRankings {
    id: string;
    player_id: string | null;
    max_stage: number | null;  // DEFAULT 0
    total_wins: number | null;  // DEFAULT 0
    total_battles: number | null;  // DEFAULT 0
    total_coins: number | null;  // DEFAULT 0
    collection_count: number | null;  // DEFAULT 0 (unique units)
    total_units: number | null;  // DEFAULT 0 (including duplicates)
    // 新規追加フィールド
    ur_unit_count: number | null;  // DEFAULT 0 (UR units owned)
    gacha_count: number | null;  // DEFAULT 0 (total gacha rolls)
    garden_visits: number | null;  // DEFAULT 0 (garden visit count)
    stages_cleared: number | null;  // DEFAULT 0 (number of stages cleared)
    win_streak: number | null;  // DEFAULT 0 (current win streak)
    max_win_streak: number | null;  // DEFAULT 0 (best win streak)
    updated_at: string | null;
}

/**
 * ログイン時に返すフルプレイヤーデータ
 */
export interface FullPlayerData extends DBPlayer {
    playerData: DBPlayerData;
}

// ============================================
// フロントエンド型（camelCase）
// ============================================

/**
 * フロントエンドで使用するプレイヤーデータ
 * usePlayerData フックが管理する状態
 */
export interface FrontendPlayerData {
    coins: number;
    unitInventory: Record<string, number>;
    selectedTeam: string[];
    loadouts: [string[], string[], string[]];  // 固定長3のタプル
    activeLoadoutIndex: number;
    shopItems: ShopItem[];
    gachaHistory: GachaHistoryEntry[];  // ローカルのみ
    clearedStages: string[];
    gardenUnits: string[];
}

/**
 * Supabase保存用のデータ形式
 * snake_caseに変換済み
 */
export interface SupabaseSaveData {
    coins?: number;
    unit_inventory?: Record<string, number>;
    selected_team?: string[];
    loadouts?: string[][];
    active_loadout_index?: number;
    shop_items?: ShopItem[];
    cleared_stages?: string[];
    garden_units?: string[];
}

/**
 * ローカルストレージからの移行データ
 */
export interface LocalStorageMigrationData {
    coins?: number;
    unitInventory?: Record<string, number>;
    selectedTeam?: string[];
    loadouts?: string[][];
    activeLoadoutIndex?: number;
    shopItems?: ShopItem[];
    clearedStages?: string[];
    gardenUnits?: string[];
}

// ============================================
// 型変換ユーティリティ
// ============================================

/**
 * DBPlayerData → FrontendPlayerData 変換
 */
export function toFrontendPlayerData(
    db: DBPlayerData,
    gachaHistory: GachaHistoryEntry[] = []
): FrontendPlayerData {
    // loadoutsが3要素未満の場合は空配列で埋める
    const loadouts = db.loadouts || [];
    const normalizedLoadouts: [string[], string[], string[]] = [
        loadouts[0] || [],
        loadouts[1] || [],
        loadouts[2] || [],
    ];

    return {
        coins: db.coins ?? INITIAL_COINS,  // null の場合は初期値
        unitInventory: db.unit_inventory || {},
        selectedTeam: db.selected_team || [],
        loadouts: normalizedLoadouts,
        activeLoadoutIndex: db.active_loadout_index ?? 0,
        shopItems: db.shop_items || [],
        gachaHistory,
        clearedStages: db.cleared_stages || [],
        gardenUnits: db.garden_units || [],
    };
}

/**
 * FrontendPlayerData → SupabaseSaveData 変換
 */
export function toSupabaseSaveData(frontend: FrontendPlayerData): SupabaseSaveData {
    return {
        coins: frontend.coins,
        unit_inventory: frontend.unitInventory,
        selected_team: frontend.selectedTeam,
        loadouts: frontend.loadouts,
        active_loadout_index: frontend.activeLoadoutIndex,
        shop_items: frontend.shopItems,
        cleared_stages: frontend.clearedStages,
        garden_units: frontend.gardenUnits,
    };
}

// ============================================
// 定数
// ============================================

/**
 * 初期コイン数
 * 新規プレイヤーはこの値からスタート
 */
export const INITIAL_COINS = 300;

/**
 * loadoutsの最大数
 */
export const MAX_LOADOUTS = 3;
