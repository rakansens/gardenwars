/**
 * サーバー権威モード用RPC関数
 *
 * これらの関数はSupabaseのRPC（リモートプロシージャコール）を使用して、
 * サーバー側で原子的（アトミック）に処理を実行します。
 *
 * メリット:
 * - データの整合性が保証される（コイン消費とユニット追加が同時に行われる）
 * - チート対策（クライアント側での改ざんが不可能）
 * - 競合状態（レースコンディション）の防止
 */

import { supabase } from "./client";

// ============================================
// 型定義
// ============================================

/** サーバー時刻レスポンス */
export interface ServerTimeResponse {
    success: boolean;
    serverTime: Date;
}

/** ガチャ実行結果 */
export interface GachaResult {
    success: boolean;
    error?: string;
    coins?: number;
    unitInventory?: Record<string, number>;
    serverTime?: Date;
}

/** フュージョン実行結果 */
export interface FusionResult {
    success: boolean;
    error?: string;
    unitInventory?: Record<string, number>;
    resultUnitId?: string;
    serverTime?: Date;
}

/** バトル報酬実行結果 */
export interface BattleRewardResult {
    success: boolean;
    error?: string;
    coins?: number;
    unitInventory?: Record<string, number>;
    clearedStages?: string[];
    serverTime?: Date;
}

/** プレイヤーデータ取得結果 */
export interface PlayerDataResult {
    success: boolean;
    error?: string;
    data?: {
        coins: number;
        unit_inventory: Record<string, number>;
        selected_team: string[];
        loadouts: string[][];
        active_loadout_index: number;
        cleared_stages: string[];
        garden_units: string[];
        shop_items: unknown[];
        current_world: string;
        updated_at: string;
    };
    serverTime?: Date;
}

// ============================================
// RPC関数
// ============================================

/**
 * サーバー時刻を取得
 * クライアントとサーバーの時刻差を計算するために使用
 */
export async function getServerTime(): Promise<ServerTimeResponse> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('get_server_time');

        if (error) {
            console.error('[ServerAuthority] getServerTime error:', error);
            return { success: false, serverTime: new Date() };
        }

        return {
            success: true,
            serverTime: new Date(data),
        };
    } catch (err) {
        console.error('[ServerAuthority] getServerTime exception:', err);
        return { success: false, serverTime: new Date() };
    }
}

/**
 * ガチャを実行（サーバー側で原子的に処理）
 *
 * 処理内容:
 * 1. コイン残高を確認
 * 2. コインを消費
 * 3. ユニットをインベントリに追加
 *
 * @param playerId プレイヤーID
 * @param cost ガチャのコスト
 * @param unitIds 追加するユニットIDの配列
 */
export async function executeGachaRpc(
    playerId: string,
    cost: number,
    unitIds: string[]
): Promise<GachaResult> {
    try {
        const { data, error } = await (supabase.rpc as any)('execute_gacha', {
            p_player_id: playerId,
            p_cost: cost,
            p_unit_ids: unitIds,
        });

        if (error) {
            console.error('[ServerAuthority] executeGacha error:', error);
            return { success: false, error: error.message };
        }

        const result = data as {
            success: boolean;
            error?: string;
            coins?: number;
            unit_inventory?: Record<string, number>;
            server_time?: string;
        };

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Unknown error',
            };
        }

        return {
            success: true,
            coins: result.coins,
            unitInventory: result.unit_inventory,
            serverTime: result.server_time ? new Date(result.server_time) : undefined,
        };
    } catch (err) {
        console.error('[ServerAuthority] executeGacha exception:', err);
        return { success: false, error: 'Network error' };
    }
}

/**
 * フュージョンを実行（サーバー側で原子的に処理）
 *
 * 処理内容:
 * 1. 素材ユニットが全て揃っているか確認
 * 2. 素材を消費
 * 3. 結果ユニットを追加
 *
 * @param playerId プレイヤーID
 * @param materialIds 素材ユニットIDの配列
 * @param resultUnitId 結果として得られるユニットID
 */
export async function executeFusionRpc(
    playerId: string,
    materialIds: string[],
    resultUnitId: string
): Promise<FusionResult> {
    try {
        const { data, error } = await (supabase.rpc as any)('execute_fusion', {
            p_player_id: playerId,
            p_material_ids: materialIds,
            p_result_unit_id: resultUnitId,
        });

        if (error) {
            console.error('[ServerAuthority] executeFusion error:', error);
            return { success: false, error: error.message };
        }

        const result = data as {
            success: boolean;
            error?: string;
            unit_inventory?: Record<string, number>;
            result_unit_id?: string;
            server_time?: string;
        };

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Unknown error',
            };
        }

        return {
            success: true,
            unitInventory: result.unit_inventory,
            resultUnitId: result.result_unit_id,
            serverTime: result.server_time ? new Date(result.server_time) : undefined,
        };
    } catch (err) {
        console.error('[ServerAuthority] executeFusion exception:', err);
        return { success: false, error: 'Network error' };
    }
}

/**
 * バトル報酬を処理（サーバー側で原子的に処理）
 *
 * 処理内容:
 * 1. コインを追加
 * 2. ステージクリアを記録
 * 3. ドロップユニットを追加
 *
 * @param playerId プレイヤーID
 * @param coinsGained 獲得コイン
 * @param stageId クリアしたステージID
 * @param droppedUnitIds ドロップしたユニットIDの配列
 */
export async function executeBattleRewardRpc(
    playerId: string,
    coinsGained: number,
    stageId: string,
    droppedUnitIds: string[]
): Promise<BattleRewardResult> {
    try {
        const { data, error } = await (supabase.rpc as any)('execute_battle_reward', {
            p_player_id: playerId,
            p_coins_gained: coinsGained,
            p_stage_id: stageId,
            p_dropped_unit_ids: droppedUnitIds,
        });

        if (error) {
            console.error('[ServerAuthority] executeBattleReward error:', error);
            return { success: false, error: error.message };
        }

        const result = data as {
            success: boolean;
            error?: string;
            coins?: number;
            unit_inventory?: Record<string, number>;
            cleared_stages?: string[];
            server_time?: string;
        };

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Unknown error',
            };
        }

        return {
            success: true,
            coins: result.coins,
            unitInventory: result.unit_inventory,
            clearedStages: result.cleared_stages,
            serverTime: result.server_time ? new Date(result.server_time) : undefined,
        };
    } catch (err) {
        console.error('[ServerAuthority] executeBattleReward exception:', err);
        return { success: false, error: 'Network error' };
    }
}

/**
 * プレイヤーデータをサーバーから取得（タイムスタンプ付き）
 *
 * @param playerId プレイヤーID
 */
export async function getPlayerDataWithTimestamp(
    playerId: string
): Promise<PlayerDataResult> {
    try {
        const { data, error } = await (supabase.rpc as any)('get_player_data_with_timestamp', {
            p_player_id: playerId,
        });

        if (error) {
            console.error('[ServerAuthority] getPlayerDataWithTimestamp error:', error);
            return { success: false, error: error.message };
        }

        const result = data as {
            success: boolean;
            error?: string;
            data?: Record<string, unknown>;
            server_time?: string;
        };

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Unknown error',
            };
        }

        const playerData = result.data;
        if (!playerData) {
            return { success: false, error: 'No data returned' };
        }

        return {
            success: true,
            data: {
                coins: (playerData.coins as number) ?? 0,
                unit_inventory: (playerData.unit_inventory as Record<string, number>) ?? {},
                selected_team: (playerData.selected_team as string[]) ?? [],
                loadouts: (playerData.loadouts as string[][]) ?? [[], [], []],
                active_loadout_index: (playerData.active_loadout_index as number) ?? 0,
                cleared_stages: (playerData.cleared_stages as string[]) ?? [],
                garden_units: (playerData.garden_units as string[]) ?? [],
                shop_items: (playerData.shop_items as unknown[]) ?? [],
                current_world: (playerData.current_world as string) ?? 'world1',
                updated_at: (playerData.updated_at as string) ?? new Date().toISOString(),
            },
            serverTime: result.server_time ? new Date(result.server_time) : undefined,
        };
    } catch (err) {
        console.error('[ServerAuthority] getPlayerDataWithTimestamp exception:', err);
        return { success: false, error: 'Network error' };
    }
}

// ============================================
// ショップ・アリーナ用RPC
// ============================================

/** ショップリフレッシュ結果 */
export interface ShopRefreshResult {
    success: boolean;
    error?: string;
    coins?: number;
    serverTime?: Date;
}

/** ショップ購入結果 */
export interface ShopPurchaseResult {
    success: boolean;
    error?: string;
    coins?: number;
    unitInventory?: Record<string, number>;
    serverTime?: Date;
}

/** アリーナ報酬結果 */
export interface ArenaRewardResult {
    success: boolean;
    error?: string;
    coins?: number;
    serverTime?: Date;
}

/**
 * ショップリフレッシュを実行（サーバー側で原子的に処理）
 *
 * @param playerId プレイヤーID
 * @param cost リフレッシュコスト
 */
export async function executeShopRefreshRpc(
    playerId: string,
    cost: number
): Promise<ShopRefreshResult> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('execute_shop_refresh', {
            p_player_id: playerId,
            p_cost: cost,
        });

        if (error) {
            console.error('[ServerAuthority] executeShopRefresh error:', error);
            return { success: false, error: error.message };
        }

        const result = data as {
            success: boolean;
            error?: string;
            coins?: number;
            server_time?: string;
        };

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Unknown error',
            };
        }

        return {
            success: true,
            coins: result.coins,
            serverTime: result.server_time ? new Date(result.server_time) : undefined,
        };
    } catch (err) {
        console.error('[ServerAuthority] executeShopRefresh exception:', err);
        return { success: false, error: 'Network error' };
    }
}

/**
 * ショップ購入を実行（サーバー側で原子的に処理）
 *
 * @param playerId プレイヤーID
 * @param price 購入価格
 * @param unitId 購入するユニットID
 */
export async function executeShopPurchaseRpc(
    playerId: string,
    price: number,
    unitId: string
): Promise<ShopPurchaseResult> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('execute_shop_purchase', {
            p_player_id: playerId,
            p_price: price,
            p_unit_id: unitId,
        });

        if (error) {
            console.error('[ServerAuthority] executeShopPurchase error:', error);
            return { success: false, error: error.message };
        }

        const result = data as {
            success: boolean;
            error?: string;
            coins?: number;
            unit_inventory?: Record<string, number>;
            server_time?: string;
        };

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Unknown error',
            };
        }

        return {
            success: true,
            coins: result.coins,
            unitInventory: result.unit_inventory,
            serverTime: result.server_time ? new Date(result.server_time) : undefined,
        };
    } catch (err) {
        console.error('[ServerAuthority] executeShopPurchase exception:', err);
        return { success: false, error: 'Network error' };
    }
}

/**
 * アリーナ報酬を処理（サーバー側で原子的に処理）
 *
 * @param playerId プレイヤーID
 * @param coinsGained 獲得コイン
 */
export async function executeArenaRewardRpc(
    playerId: string,
    coinsGained: number
): Promise<ArenaRewardResult> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('execute_arena_reward', {
            p_player_id: playerId,
            p_coins_gained: coinsGained,
        });

        if (error) {
            console.error('[ServerAuthority] executeArenaReward error:', error);
            return { success: false, error: error.message };
        }

        const result = data as {
            success: boolean;
            error?: string;
            coins?: number;
            server_time?: string;
        };

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Unknown error',
            };
        }

        return {
            success: true,
            coins: result.coins,
            serverTime: result.server_time ? new Date(result.server_time) : undefined,
        };
    } catch (err) {
        console.error('[ServerAuthority] executeArenaReward exception:', err);
        return { success: false, error: 'Network error' };
    }
}

// ============================================
// ランキング・ガーデン用RPC
// ============================================

/** バトル統計更新結果 */
export interface BattleStatsResult {
    success: boolean;
    error?: string;
    totalBattles?: number;
    totalWins?: number;
    winStreak?: number;
    maxWinStreak?: number;
    serverTime?: Date;
}

/** ガチャカウント更新結果 */
export interface GachaCountResult {
    success: boolean;
    error?: string;
    gachaCount?: number;
    serverTime?: Date;
}

/** ガーデン訪問更新結果 */
export interface GardenVisitsResult {
    success: boolean;
    error?: string;
    gardenVisits?: number;
    serverTime?: Date;
}

/** ガーデン報酬結果 */
export interface GardenRewardResult {
    success: boolean;
    error?: string;
    coins?: number;
    serverTime?: Date;
}

/**
 * バトル統計を更新（サーバー側で原子的に処理）
 *
 * @param playerId プレイヤーID
 * @param won 勝利したか
 * @param stageNum ステージ番号（オプション）
 * @param stageId ステージID（オプション）
 */
export async function incrementBattleStatsRpc(
    playerId: string,
    won: boolean,
    stageNum?: number,
    stageId?: string
): Promise<BattleStatsResult> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('increment_battle_stats', {
            p_player_id: playerId,
            p_won: won,
            p_stage_num: stageNum ?? null,
            p_stage_id: stageId ?? null,
        });

        if (error) {
            console.error('[ServerAuthority] incrementBattleStats error:', error);
            return { success: false, error: error.message };
        }

        const result = data as {
            success: boolean;
            error?: string;
            total_battles?: number;
            total_wins?: number;
            win_streak?: number;
            max_win_streak?: number;
            server_time?: string;
        };

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Unknown error',
            };
        }

        return {
            success: true,
            totalBattles: result.total_battles,
            totalWins: result.total_wins,
            winStreak: result.win_streak,
            maxWinStreak: result.max_win_streak,
            serverTime: result.server_time ? new Date(result.server_time) : undefined,
        };
    } catch (err) {
        console.error('[ServerAuthority] incrementBattleStats exception:', err);
        return { success: false, error: 'Network error' };
    }
}

/**
 * ガチャカウントを更新（サーバー側で原子的に処理）
 *
 * @param playerId プレイヤーID
 * @param count 追加するカウント（デフォルト1）
 */
export async function incrementGachaCountRpc(
    playerId: string,
    count: number = 1
): Promise<GachaCountResult> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('increment_gacha_count', {
            p_player_id: playerId,
            p_count: count,
        });

        if (error) {
            console.error('[ServerAuthority] incrementGachaCount error:', error);
            return { success: false, error: error.message };
        }

        const result = data as {
            success: boolean;
            error?: string;
            gacha_count?: number;
            server_time?: string;
        };

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Unknown error',
            };
        }

        return {
            success: true,
            gachaCount: result.gacha_count,
            serverTime: result.server_time ? new Date(result.server_time) : undefined,
        };
    } catch (err) {
        console.error('[ServerAuthority] incrementGachaCount exception:', err);
        return { success: false, error: 'Network error' };
    }
}

/**
 * ガーデン訪問を更新（サーバー側で原子的に処理）
 *
 * @param playerId プレイヤーID
 */
export async function incrementGardenVisitsRpc(
    playerId: string
): Promise<GardenVisitsResult> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('increment_garden_visits', {
            p_player_id: playerId,
        });

        if (error) {
            console.error('[ServerAuthority] incrementGardenVisits error:', error);
            return { success: false, error: error.message };
        }

        const result = data as {
            success: boolean;
            error?: string;
            garden_visits?: number;
            server_time?: string;
        };

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Unknown error',
            };
        }

        return {
            success: true,
            gardenVisits: result.garden_visits,
            serverTime: result.server_time ? new Date(result.server_time) : undefined,
        };
    } catch (err) {
        console.error('[ServerAuthority] incrementGardenVisits exception:', err);
        return { success: false, error: 'Network error' };
    }
}

/**
 * ガーデン報酬を処理（サーバー側で原子的に処理）
 *
 * @param playerId プレイヤーID
 * @param coinsGained 獲得コイン
 */
export async function executeGardenRewardRpc(
    playerId: string,
    coinsGained: number
): Promise<GardenRewardResult> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('execute_garden_reward', {
            p_player_id: playerId,
            p_coins_gained: coinsGained,
        });

        if (error) {
            console.error('[ServerAuthority] executeGardenReward error:', error);
            return { success: false, error: error.message };
        }

        const result = data as {
            success: boolean;
            error?: string;
            coins?: number;
            server_time?: string;
        };

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Unknown error',
            };
        }

        return {
            success: true,
            coins: result.coins,
            serverTime: result.server_time ? new Date(result.server_time) : undefined,
        };
    } catch (err) {
        console.error('[ServerAuthority] executeGardenReward exception:', err);
        return { success: false, error: 'Network error' };
    }
}
