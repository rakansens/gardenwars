"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import playerDataInitial from "@/data/player.json";
import unitsData from "@/data/units";
import type { UnitDefinition } from "@/data/types";
import { useAuth } from "@/contexts/AuthContext";
import {
    savePlayerData as saveToSupabase,
    getPlayerData as getFromSupabase,
    toFrontendPlayerData,
    toSupabaseSaveData,
    syncRankingStats,
    ensureRankingsExist,
    INITIAL_COINS,
    // サーバー権威モード用RPC
    executeGachaRpc,
    executeFusionRpc,
    executeBattleRewardRpc,
    executeShopRefreshRpc,
    executeShopPurchaseRpc,
    executeArenaRewardRpc,
    executeGardenRewardRpc,
    // Types
    SupabaseSaveData,
} from "@/lib/supabase";
import type {
    FrontendPlayerData,
    ShopItem,
    GachaHistoryEntry,
} from "@/lib/supabase";

const getStorageKey = (playerId: string | null) => playerId ? `gardenwars_player_${playerId}` : "gardenwars_player";
const getClearedStagesKey = (playerId: string | null) => playerId ? `clearedStages_${playerId}` : "clearedStages";
const getGardenSelectionKey = (playerId: string | null) => playerId ? `garden_selection_${playerId}` : "garden_selection";

// Re-export types for backward compatibility
export type { ShopItem, GachaHistoryEntry };

// Alias for backward compatibility
export type PlayerData = FrontendPlayerData;

// データの最終更新タイムスタンプを追跡
interface PlayerDataWithTimestamp extends FrontendPlayerData {
    lastModified?: number;
}

// Nレアリティのユニット一覧（味方のみ）
const allUnits = unitsData as UnitDefinition[];
const nRarityUnits = allUnits.filter(u =>
    u.rarity === "N" && !u.id.startsWith("enemy_") && !u.id.startsWith("boss_")
);

// 初期データ（Nユニットをランダムに3体付与）
const getInitialData = (): PlayerDataWithTimestamp => {
    // ランダムに3体選ぶ
    const shuffled = [...nRarityUnits].sort(() => Math.random() - 0.5);
    const starterUnits = shuffled.slice(0, 3);

    const unitInventory: Record<string, number> = {};
    const selectedTeam: string[] = [];

    starterUnits.forEach(unit => {
        unitInventory[unit.id] = 1;
        selectedTeam.push(unit.id);
    });

    return {
        coins: INITIAL_COINS,
        unitInventory,
        selectedTeam,
        loadouts: [selectedTeam, [], []],
        activeLoadoutIndex: 0,
        shopItems: [],
        gachaHistory: [],
        clearedStages: [],
        clearedChessStages: [],
        gardenUnits: [],
        currentWorld: "world1",
        lastModified: 0, // 初期データは「古い」としてマーク（リモートデータを優先させるため）
    };
};

// ローカルストレージから読み込み（複数キーから統合）
const loadFromStorage = (playerId: string | null): PlayerDataWithTimestamp => {
    if (typeof window === "undefined") return getInitialData();

    const initial = getInitialData();
    const storageKey = getStorageKey(playerId);
    const clearedStagesKey = getClearedStagesKey(playerId);
    const gardenSelectionKey = getGardenSelectionKey(playerId);

    try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            const parsed = JSON.parse(saved);

            // Ensure loadouts is always exactly 3 arrays (normalize corrupted data)
            let rawLoadouts = parsed.loadouts;
            if (!Array.isArray(rawLoadouts) || rawLoadouts.length !== 3) {
                console.warn("Invalid loadouts structure, normalizing to 3 arrays");
                rawLoadouts = [
                    parsed.selectedTeam ?? initial.selectedTeam,
                    [],
                    []
                ];
            }
            // Validate each deck is an array
            const loadouts: [string[], string[], string[]] = [
                Array.isArray(rawLoadouts[0]) ? rawLoadouts[0] : [],
                Array.isArray(rawLoadouts[1]) ? rawLoadouts[1] : [],
                Array.isArray(rawLoadouts[2]) ? rawLoadouts[2] : [],
            ];

            const activeLoadoutIndex = parsed.activeLoadoutIndex ?? 0;

            // メインデータを読み込み
            Object.assign(initial, {
                coins: parsed.coins ?? INITIAL_COINS,
                unitInventory: parsed.unitInventory ?? initial.unitInventory,
                selectedTeam: loadouts[activeLoadoutIndex] ?? [],
                loadouts: loadouts,
                activeLoadoutIndex: activeLoadoutIndex,
                shopItems: parsed.shopItems ?? [],
                gachaHistory: parsed.gachaHistory ?? [],
                clearedStages: parsed.clearedStages ?? [],
                clearedChessStages: parsed.clearedChessStages ?? [],
                gardenUnits: parsed.gardenUnits ?? [],
                currentWorld: parsed.currentWorld ?? "world1",
                // lastModifiedが無い場合は0（古い）としてリモートデータを優先
                lastModified: parsed.lastModified ?? 0,
            });
        }
    } catch (e) {
        console.error("Failed to load player data:", e);
    }

    // Validate and sanitize critical fields from parsed data
    // Security: Validate coins is a non-negative number within reasonable range
    const MAX_COINS = 999999999; // 1 billion max
    if (typeof initial.coins !== 'number' || isNaN(initial.coins) || initial.coins < 0) {
        console.warn("Invalid coins value, resetting to initial");
        initial.coins = INITIAL_COINS;
    } else {
        // Clamp to reasonable range
        initial.coins = Math.min(Math.max(0, Math.floor(initial.coins)), MAX_COINS);
    }

    // Security: Validate unitInventory structure and values
    const MAX_UNIT_COUNT = 9999; // Max copies of a single unit
    if (typeof initial.unitInventory !== "object" || initial.unitInventory === null || Array.isArray(initial.unitInventory)) {
        console.warn("Invalid unitInventory structure, resetting to empty object");
        initial.unitInventory = {};
    } else {
        // Validate each entry: key must be string, value must be non-negative integer
        const validatedInventory: Record<string, number> = {};
        for (const [unitId, count] of Object.entries(initial.unitInventory)) {
            // Skip invalid keys (must be non-empty string)
            if (typeof unitId !== 'string' || unitId.length === 0 || unitId.length > 100) {
                console.warn(`Invalid unit ID in inventory: ${unitId}`);
                continue;
            }
            // Validate count is a positive integer within range
            if (typeof count !== 'number' || isNaN(count) || count < 0) {
                console.warn(`Invalid count for unit ${unitId}: ${count}`);
                continue;
            }
            // Clamp to reasonable range and ensure integer
            const validCount = Math.min(Math.max(0, Math.floor(count)), MAX_UNIT_COUNT);
            if (validCount > 0) {
                validatedInventory[unitId] = validCount;
            }
        }
        initial.unitInventory = validatedInventory;
    }

    if (!Array.isArray(initial.clearedStages)) {
        console.warn("Invalid clearedStages structure, resetting to empty array");
        initial.clearedStages = [];
    }
    if (!Array.isArray(initial.clearedChessStages)) {
        console.warn("Invalid clearedChessStages structure, resetting to empty array");
        initial.clearedChessStages = [];
    }
    if (!Array.isArray(initial.gardenUnits)) {
        console.warn("Invalid gardenUnits structure, resetting to empty array");
        initial.gardenUnits = [];
    }
    if (!Array.isArray(initial.selectedTeam)) {
        console.warn("Invalid selectedTeam structure, resetting to empty array");
        initial.selectedTeam = [];
    }

    // Validate activeLoadoutIndex
    if (typeof initial.activeLoadoutIndex !== 'number' || initial.activeLoadoutIndex < 0 || initial.activeLoadoutIndex > 2) {
        initial.activeLoadoutIndex = 0;
    }

    // 別キーからも読み込み（後方互換性）
    try {
        const clearedStagesRaw = localStorage.getItem(clearedStagesKey);
        if (clearedStagesRaw && initial.clearedStages.length === 0) {
            const parsed = JSON.parse(clearedStagesRaw);
            if (Array.isArray(parsed) && parsed.every(item => typeof item === "string")) {
                initial.clearedStages = parsed;
            } else {
                console.warn("clearedStages data has invalid structure, skipping migration");
            }
        }
    } catch (e) {
        console.warn("Failed to parse clearedStages from localStorage:", e);
    }

    try {
        const gardenRaw = localStorage.getItem(gardenSelectionKey);
        if (gardenRaw && initial.gardenUnits.length === 0) {
            const parsed = JSON.parse(gardenRaw);
            if (Array.isArray(parsed) && parsed.every(item => typeof item === "string")) {
                initial.gardenUnits = parsed;
            } else {
                console.warn("gardenUnits data has invalid structure, skipping migration");
            }
        }
    } catch (e) {
        console.warn("Failed to parse gardenUnits from localStorage:", e);
    }

    return initial;
};

// ローカルストレージに保存（統合キーに保存 + 後方互換用に別キーにも保存）
const saveToStorage = (data: PlayerDataWithTimestamp, playerId: string | null) => {
    if (typeof window === "undefined") return;

    const storageKey = getStorageKey(playerId);
    const clearedStagesKey = getClearedStagesKey(playerId);
    const gardenSelectionKey = getGardenSelectionKey(playerId);

    const trySetItem = (key: string, value: string) => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22)) {
                console.warn(`Storage quota exceeded when saving to ${key}. Consider clearing old data.`);
            } else {
                console.error(`Failed to save to ${key}:`, e);
            }
        }
    };

    // タイムスタンプを更新して保存
    const dataWithTimestamp = { ...data, lastModified: Date.now() };
    trySetItem(storageKey, JSON.stringify(dataWithTimestamp));
    // 後方互換性のため別キーにも保存
    trySetItem(clearedStagesKey, JSON.stringify(data.clearedStages));
    trySetItem(gardenSelectionKey, JSON.stringify(data.gardenUnits));
};

/**
 * プレイヤーデータ管理フック
 * - 認証済み: Supabase + localStorage (ローカルキャッシュ)
 * - 未認証: localStorage のみ
 */
export function usePlayerData() {
    const { status, playerId, player } = useAuth();
    const [data, setData] = useState<PlayerDataWithTimestamp>(getInitialData);
    const [isLoaded, setIsLoaded] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const dataRef = useRef<PlayerDataWithTimestamp>(data); // Ref to capture latest data for debounced save
    const lastSavedDataRef = useRef<PlayerDataWithTimestamp | null>(null); // Track last saved FULL data for differential updates
    const pendingSaveRef = useRef<boolean>(false); // 保存待ちフラグ
    const pendingShopPurchaseRef = useRef<Set<string>>(new Set()); // 購入中のショップアイテム（重複購入防止）
    const isAuthenticated = status === "authenticated" && !!playerId;

    // Keep dataRef in sync with data
    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    // 初回読み込み
    useEffect(() => {
        const loadData = async () => {
            // まずローカルから読み込み
            // Note: If playerId changes (e.g. login), we load that user's specific data
            const localData = loadFromStorage(playerId);

            if (isAuthenticated && player) {
                // 認証済みの場合、Supabaseからデータを取得
                try {
                    const remoteData = await getFromSupabase(playerId);
                    if (remoteData) {
                        // リモートデータをローカル形式に変換（型安全な変換関数を使用）
                        const remoteConverted = toFrontendPlayerData(
                            remoteData,
                            localData.gachaHistory // ガチャ履歴はローカルのみ
                        );


                        // タイムスタンプベースのマージ戦略 + コンテンツベースの競合解決
                        // ローカルが新しい場合はローカルのコインとインベントリを優先
                        const localTimestamp = localData.lastModified || 0;
                        const remoteTimestamp = remoteData.updated_at
                            ? new Date(remoteData.updated_at).getTime()
                            : 0;

                        // Clock Skew Protection:
                        // Client clocks can be wrong. If timestamps are close (within 5 minutes), assume "Newer" based on content.
                        // Or simplistic check: if logic says remote is newer, but local has MORE stuff, trust local?
                        // Let's stick to timestamp but give local a slight advantage or trust "significant progress" in local.
                        // For now, standard timestamp comparison but logged.
                        // TODO: robust vector clocks or monotonic counters if this persists.

                        // Fix: If local is "technically" older but very close, trust local to prevent dataloss on slight skew?
                        // Actually, if local > remote, localIsNewer = true.
                        // Skew risk: Client is 1 hour behind. local(10:00) vs remote(10:30). localIsNewer=false.
                        // Result: Remote overwrites local. Offline progress lost.
                        // Fix: If localData.lastModified is updated NOW, it uses Date.now().
                        // We can't fix user's clock easily. Best effort: 
                        // If local coins != remote coins, and local timestamp is "close enough" or just ignore timestamp if local seems "played"?
                        // Let's just rely on the comparison for now, but ensure we don't blindly overwrite if we have pending data.

                        let localIsNewer = localTimestamp > remoteTimestamp;

                        // Clock Skew Safety / Progress Protection:
                        // 端末の時計が遅れている場合、タイムスタンプだけで判断するとオフライン進行分（コイン、ユニットなど）が
                        // 古いサーバーデータで上書きされてしまう。
                        // 「クリアしたステージ数」は単調増加する指標なので、これが増えていれば「ローカルが進んでいる」とみなす。
                        if (!localIsNewer) {
                            const localCount = localData.clearedStages.length;
                            const remoteCount = remoteConverted.clearedStages.length;

                            // Check 1: Stage Progression
                            if (localCount > remoteCount) {
                                console.warn(`[Merge] Clock skew detected! Local timestamp is older, but has more cleared stages (${localCount} vs ${remoteCount}). Trusting Local.`);
                                localIsNewer = true;
                            }
                            // Check 2: Farming Progression (Total Unit Count)
                            // オフライン周回でユニットが増加している場合もローカルを優先
                            else {
                                const localUnits = Object.values(localData.unitInventory ?? {}).reduce((a, b) => a + b, 0);
                                const remoteUnits = Object.values(remoteConverted.unitInventory ?? {}).reduce((a, b) => a + b, 0);
                                if (localUnits > remoteUnits) {
                                    console.warn(`[Merge] Clock skew detected! Local timestamp is older, but has more units (${localUnits} vs ${remoteUnits}). Trusting Local.`);
                                    localIsNewer = true;
                                }
                            }
                        }

                        console.log(`[Merge] Local: ${new Date(localTimestamp).toISOString()}, Remote: ${new Date(remoteTimestamp).toISOString()}, LocalIsNewer: ${localIsNewer}`);

                        // タイムスタンプベースのマージ戦略 (Last Write Wins)
                        // Heuristicなマージ(Math.maxやlength check)は「削除」や「消費」を無効化してしまうため廃止。
                        // 新しい方のスナップショットを正とする。
                        const mergedInventory = localIsNewer ? localData.unitInventory : remoteConverted.unitInventory;

                        // Loadoutsも同様に、新しい方を採用（空のデッキを保存できるようにする）
                        const mergedLoadouts = localIsNewer ? localData.loadouts : remoteConverted.loadouts;
                        const mergedActiveLoadoutIndex = localIsNewer ? localData.activeLoadoutIndex : remoteConverted.activeLoadoutIndex;
                        const mergedSelectedTeam = localIsNewer ? localData.selectedTeam : remoteConverted.selectedTeam;

                        // クリア履歴などの「追加のみ」行われるデータは、安全のため和集合を取る（デバイス間の同期ズレ補完）
                        const mergedStages = new Set([...remoteConverted.clearedStages, ...localData.clearedStages]);
                        const mergedChessStages = new Set([...remoteConverted.clearedChessStages, ...localData.clearedChessStages]);

                        // Gardenは配置変更があるのでスナップショット優先
                        const mergedGardenUnits = localIsNewer ? localData.gardenUnits : remoteConverted.gardenUnits;

                        const finalMergedData: PlayerDataWithTimestamp = {
                            ...remoteConverted,
                            coins: localIsNewer ? localData.coins : remoteConverted.coins,
                            unitInventory: mergedInventory,
                            loadouts: mergedLoadouts,
                            activeLoadoutIndex: mergedActiveLoadoutIndex,
                            selectedTeam: mergedSelectedTeam,
                            clearedStages: Array.from(mergedStages),
                            clearedChessStages: Array.from(mergedChessStages),
                            gardenUnits: mergedGardenUnits,
                            lastModified: Math.max(localTimestamp, remoteTimestamp),
                        };

                        // shopItemsをマージ（soldOut状態は新しい方を優先）
                        if (finalMergedData.shopItems.length === 0 && localData.shopItems.length > 0) {
                            finalMergedData.shopItems = localData.shopItems;
                        } else if (finalMergedData.shopItems.length > 0 && localData.shopItems.length > 0) {
                            if (localIsNewer) {
                                const localItemMap = new Map(localData.shopItems.map(item => [item.uid, item]));
                                finalMergedData.shopItems = finalMergedData.shopItems.map(remoteItem => {
                                    const localItem = localItemMap.get(remoteItem.uid);
                                    if (localItem) {
                                        return { ...remoteItem, soldOut: localItem.soldOut };
                                    }
                                    return remoteItem;
                                });
                            }
                        }

                        setData(finalMergedData);
                        saveToStorage(finalMergedData, playerId);

                        // Initialize tracker with MERGED value (so we know what we started with)
                        // If we used the REMOTE value blindly, we might miss local offline progress that was just merged in.
                        // Actually, if we just merged, 'finalMergedData' IS what we consider 'Saved'.
                        // Wait, if we merged local changes, they are NOT on server yet.
                        // So we should initialize lastSavedDataRef to the REMOTE value (before merge) 
                        // so that the diff logic sees the local changes and saves them in the next auto-save tick.
                        // HOWEVER, toFrontendPlayerData returns a normalized object. 
                        // Let's assume 'remoteConverted' is the baseline. 
                        // BUT, if we use 'remoteConverted', the auto-save will trigger immediately to save the merge result.
                        // This is DESIRED behavior (sync offline progress).

                        // Construct baseline from remote data for diffing:
                        // We need a full FrontendPlayerData object. remoteConverted is exactly that.
                        lastSavedDataRef.current = { ...remoteConverted, lastModified: remoteTimestamp };
                    } else {
                        // リモートにデータがない場合はローカルデータを使用
                        setData(localData);
                        // No baseline, so next save will be full save
                        lastSavedDataRef.current = null;
                    }

                    // Ensure rankings entry exists for authenticated users
                    if (isAuthenticated && playerId) {
                        ensureRankingsExist(playerId).catch(err => {
                            console.error("Failed to ensure rankings exist:", err);
                        });
                    }
                } catch (err) {
                    console.error("Failed to load from Supabase:", err);
                    setData(localData);
                }
            } else {
                setData(localData);
            }

            setIsLoaded(true);
        };

        loadData();
    }, [isAuthenticated, playerId, player]);

    // データ変更時に保存（デバウンス付き）
    useEffect(() => {
        if (!isLoaded) return;

        // ローカルに即座に保存
        saveToStorage(data, playerId);

        // Supabaseへは遅延保存（デバウンス）
        if (isAuthenticated && playerId) {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            pendingSaveRef.current = true; // 保存待ち状態をマーク

            saveTimeoutRef.current = setTimeout(async () => {
                const maxRetries = 3;
                let lastError: unknown = null;

                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        // dataRefから最新のデータを取得（stale closure回避）
                        const latestData = dataRef.current;

                        // Convert to Supabase format for comparison
                        const latestSupabaseData = toSupabaseSaveData(latestData);

                        // Calculate Diff vs Last Saved
                        const saveData: Partial<SupabaseSaveData> = {};
                        let hasChanges = false;

                        if (lastSavedDataRef.current) {
                            const lastSupabaseData = toSupabaseSaveData(lastSavedDataRef.current);
                            (Object.keys(latestSupabaseData) as Array<keyof SupabaseSaveData>).forEach(key => {
                                // Deep comparison using JSON.stringify for objects/arrays
                                // Note: This handles primitives (coins) and objects (inventory) correctly
                                if (JSON.stringify(latestSupabaseData[key]) !== JSON.stringify(lastSupabaseData[key])) {
                                    // @ts-ignore - TS has trouble with partial mapping here but it's safe
                                    saveData[key] = latestSupabaseData[key];
                                    hasChanges = true;
                                }
                            });
                        } else {
                            // No baseline (first save), save everything
                            Object.assign(saveData, latestSupabaseData);
                            hasChanges = true;
                        }

                        if (!hasChanges) {
                            // No changes detected, skip save
                            pendingSaveRef.current = false;
                            return;
                        }

                        console.log("[AutoSave] Saving diff:", Object.keys(saveData));

                        await saveToSupabase(playerId, saveData);

                        // Update tracking ref on success
                        // We update it to match 'latestData' because that is what is now on the server
                        lastSavedDataRef.current = { ...latestData };

                        // ランキング統計も同期
                        // Pass undefined for coins if we didn't save them
                        await syncRankingStats(
                            playerId,
                            saveData.coins, // Will be undefined if not in diff
                            latestData.unitInventory
                        );
                        pendingSaveRef.current = false; // 保存完了
                        return; // Success, exit retry loop
                    } catch (err) {
                        lastError = err;
                        console.warn(`Supabase save attempt ${attempt}/${maxRetries} failed:`, err);
                        if (attempt < maxRetries) {
                            // Wait before retry with exponential backoff
                            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                        }
                    }
                }
                pendingSaveRef.current = false; // リトライ失敗でも解除
                console.error("Failed to save to Supabase after all retries:", lastError);
            }, 1000); // 1秒後に保存
        }

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [data, isLoaded, isAuthenticated, playerId]);

    // ブラウザを閉じる前に保存を完了（データ消失防止）
    useEffect(() => {
        if (!isAuthenticated || !playerId) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            // 保存待ちがある場合は同期的に保存を試みる
            if (pendingSaveRef.current && saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;

                // ローカルストレージに確実に保存（同期的）
                // Note: Supabase APIはBeaconと互換性がないため、
                // localStorageへの保存を優先し、次回ロード時にSupabaseと同期
                try {
                    const latestData = dataRef.current;
                    saveToStorage(latestData, playerId);
                    console.log("[beforeunload] Data saved to localStorage, will sync on next load");
                } catch (err) {
                    console.error("[beforeunload] Failed to save:", err);
                }
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [isAuthenticated, playerId]);

    // 即座にSupabaseに保存（ガチャなど重要な操作用）
    const flushToSupabase = useCallback(async (): Promise<boolean> => {
        if (!isAuthenticated || !playerId) return false;

        // 既存のデバウンスタイマーをキャンセル
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }

        try {
            // 最新のデータを取得
            // 最新のデータを取得
            const latestData = dataRef.current;
            const latestSupabaseData = toSupabaseSaveData(latestData);

            // Calculate Diff
            const saveData: Partial<SupabaseSaveData> = {};
            let hasChanges = false;

            if (lastSavedDataRef.current) {
                const lastSupabaseData = toSupabaseSaveData(lastSavedDataRef.current);
                (Object.keys(latestSupabaseData) as Array<keyof SupabaseSaveData>).forEach(key => {
                    if (JSON.stringify(latestSupabaseData[key]) !== JSON.stringify(lastSupabaseData[key])) {
                        // @ts-ignore
                        saveData[key] = latestSupabaseData[key];
                        hasChanges = true;
                    }
                });
            } else {
                Object.assign(saveData, latestSupabaseData);
                hasChanges = true;
            }

            if (!hasChanges) {
                pendingSaveRef.current = false;
                return true;
            }

            await saveToSupabase(playerId, saveData);
            lastSavedDataRef.current = { ...latestData }; // Update tracker

            await syncRankingStats(playerId, saveData.coins, latestData.unitInventory);
            pendingSaveRef.current = false; // 保存完了
            return true;
        } catch (err) {
            console.error("Failed to flush to Supabase:", err);
            return false;
        }
    }, [isAuthenticated, playerId]);

    // コインを増やす（汎用 - 未認証ユーザー用）
    const addCoins = useCallback((amount: number) => {
        setData((prev) => ({
            ...prev,
            coins: prev.coins + amount,
        }));
    }, []);

    // アリーナ報酬用（サーバー権威モード）
    // - サーバー側でコイン追加を原子的に実行
    const executeArenaReward = useCallback(async (coinsGained: number): Promise<boolean> => {
        // 認証済みユーザーはサーバー権威モードを使用
        if (isAuthenticated && playerId) {
            console.log("[executeArenaReward] Using server authority mode");
            const result = await executeArenaRewardRpc(playerId, coinsGained);

            if (!result.success) {
                console.error("[executeArenaReward] Server rejected:", result.error);
                return false;
            }

            // サーバーからの結果でローカル状態を更新
            setData((prev) => {
                const newData = {
                    ...prev,
                    coins: result.coins ?? prev.coins,
                };
                // Update baseline so we don't re-save this change
                if (lastSavedDataRef.current) {
                    lastSavedDataRef.current = { ...lastSavedDataRef.current, coins: newData.coins };
                }
                return newData;
            });
            return true;
        }

        // 未認証ユーザーはローカルで処理
        setData((prev) => ({
            ...prev,
            coins: prev.coins + coinsGained,
        }));
        return true;
    }, [isAuthenticated, playerId]);

    // ガーデン報酬を処理（コイン追加）
    // サーバー権威モード（認証済みユーザー）:
    // - サーバー側でコイン追加を原子的に実行
    const executeGardenReward = useCallback(async (coinsGained: number): Promise<boolean> => {
        // 認証済みユーザーはサーバー権威モードを使用
        if (isAuthenticated && playerId) {
            console.log("[executeGardenReward] Using server authority mode");
            const result = await executeGardenRewardRpc(playerId, coinsGained);

            if (!result.success) {
                console.error("[executeGardenReward] Server rejected:", result.error);
                return false;
            }

            // サーバーからの結果でローカル状態を更新
            setData((prev) => {
                const newData = {
                    ...prev,
                    coins: result.coins ?? prev.coins,
                };
                // Update baseline so we don't re-save this change
                if (lastSavedDataRef.current) {
                    lastSavedDataRef.current = { ...lastSavedDataRef.current, coins: newData.coins };
                }
                return newData;
            });
            return true;
        }

        // 未認証ユーザーはローカルで処理
        setData((prev) => ({
            ...prev,
            coins: prev.coins + coinsGained,
        }));
        return true;
    }, [isAuthenticated, playerId]);

    // コインを減らす（消費）- ショップリフレッシュ用
    // サーバー権威モード（認証済みユーザー）:
    // - サーバー側でコイン残高確認→消費を原子的に実行
    const spendCoins = useCallback(async (amount: number): Promise<boolean> => {
        // 認証済みユーザーはサーバー権威モードを使用
        if (isAuthenticated && playerId) {
            console.log("[spendCoins] Using server authority mode");
            const result = await executeShopRefreshRpc(playerId, amount);

            if (!result.success) {
                console.error("[spendCoins] Server rejected:", result.error);
                return false;
            }

            // サーバーからの結果でローカル状態を更新
            setData((prev) => {
                const newData = {
                    ...prev,
                    coins: result.coins ?? prev.coins,
                };
                // Update baseline so we don't re-save this change
                if (lastSavedDataRef.current) {
                    lastSavedDataRef.current = { ...lastSavedDataRef.current, coins: newData.coins };
                }
                return newData;
            });
            return true;
        }

        // 未認証ユーザーはローカルで処理
        if (data.coins < amount) {
            return false;
        }
        setData((prev) => {
            if (prev.coins < amount) {
                return prev; // 二重チェック
            }
            return { ...prev, coins: prev.coins - amount };
        });
        return true;
    }, [data.coins, isAuthenticated, playerId]);

    // ユニットを追加（単体）
    const addUnit = useCallback((unitId: string, count: number = 1) => {
        setData((prev) => ({
            ...prev,
            unitInventory: {
                ...prev.unitInventory,
                [unitId]: (prev.unitInventory[unitId] || 0) + count,
            },
        }));
    }, []);

    // ユニットを削除（単体）
    const removeUnit = useCallback((unitId: string, count: number = 1) => {
        setData((prev) => {
            const currentCount = prev.unitInventory[unitId] || 0;
            const newCount = Math.max(0, currentCount - count);
            const newInventory = { ...prev.unitInventory };
            if (newCount <= 0) {
                delete newInventory[unitId];
            } else {
                newInventory[unitId] = newCount;
            }
            return {
                ...prev,
                unitInventory: newInventory,
            };
        });
    }, []);

    // 複数ユニットをまとめて追加（ガチャ用）
    const addUnits = useCallback((unitIds: string[]) => {
        setData((prev) => {
            const newInventory = { ...prev.unitInventory };
            for (const unitId of unitIds) {
                newInventory[unitId] = (newInventory[unitId] || 0) + 1;
            }
            return {
                ...prev,
                unitInventory: newInventory,
            };
        });
    }, []);

    // 編成を更新（現在のロードアウトに保存）
    const setTeam = useCallback((team: string[]) => {
        setData((prev) => {
            const newLoadouts = [...prev.loadouts] as [string[], string[], string[]];
            newLoadouts[prev.activeLoadoutIndex] = team;
            return {
                ...prev,
                selectedTeam: team,
                loadouts: newLoadouts,
            };
        });
    }, []);

    // ロードアウトを切り替え
    const switchLoadout = useCallback((index: number) => {
        // Validate bounds with logging
        if (index < 0 || index > 2) {
            console.warn(`[switchLoadout] Index out of bounds: ${index}, clamping to valid range 0-2`);
            index = Math.max(0, Math.min(2, index));
        }
        setData((prev) => ({
            ...prev,
            activeLoadoutIndex: index,
            selectedTeam: prev.loadouts[index] ?? [],
        }));
    }, []);

    // 次のロードアウトに切り替え
    const nextLoadout = useCallback(() => {
        setData((prev) => {
            const nextIndex = (prev.activeLoadoutIndex + 1) % 3;
            return {
                ...prev,
                activeLoadoutIndex: nextIndex,
                selectedTeam: prev.loadouts[nextIndex] ?? [],
            };
        });
    }, []);

    // データリセット（デバッグ用）
    const resetData = useCallback(() => {
        const initial = getInitialData();
        setData(initial);
        saveToStorage(initial, playerId);
    }, []);

    // ショップを更新
    const refreshShop = useCallback(() => {
        const allUnits = (unitsData as UnitDefinition[]).filter(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);
        const newItems: ShopItem[] = [];

        const pickRandom = () => {
            // SSR/URはショップに出現しない
            const weights = { N: 50, R: 30, SR: 15, SSR: 0, UR: 0 };

            if (allUnits.length === 0) {
                throw new Error("No units available for shop");
            }

            let totalWeight = 0;
            for (const u of allUnits) totalWeight += weights[u.rarity] || 0;

            if (totalWeight === 0) {
                return allUnits[0];
            }

            let r = Math.random() * totalWeight;
            for (const u of allUnits) {
                r -= weights[u.rarity] || 0;
                if (r <= 0) return u;
            }
            return allUnits[0];
        };

        for (let i = 0; i < 30; i++) {
            const unit = pickRandom();

            // 価格設定（全体的に高め）
            let basePrice = 100;
            switch (unit.rarity) {
                case 'N': basePrice = 100; break;
                case 'R': basePrice = 800; break;
                case 'SR': basePrice = 5000; break;
                case 'SSR': basePrice = 15000; break;  // 出現しないが念のため
                case 'UR': basePrice = 50000; break;   // 出現しないが念のため
            }

            const isDiscount = Math.random() < 0.3;
            const discount = isDiscount ? Math.floor(Math.random() * 5 + 1) * 10 : 0;
            const price = Math.floor(basePrice * (100 - discount) / 100);

            newItems.push({
                uid: `${Date.now()}-${i}-${Math.random()}`,
                unitId: unit.id,
                price: price,
                soldOut: false,
                isRare: unit.rarity === 'SSR' || unit.rarity === 'UR',
                discount: discount > 0 ? discount : undefined
            });
        }

        setData(prev => ({ ...prev, shopItems: newItems }));
    }, []);

    // アイテム購入（アトミック操作）
    // サーバー権威モード（認証済みユーザー）:
    // - サーバー側でコイン確認→消費→ユニット追加を原子的に実行
    const buyShopItem = useCallback(async (index: number): Promise<boolean> => {
        // 先に購入可能かチェック
        const currentItem = data.shopItems[index];
        if (!currentItem || currentItem.soldOut || data.coins < currentItem.price) {
            return false; // 購入失敗
        }

        // 認証済みユーザーはサーバー権威モードを使用
        if (isAuthenticated && playerId) {
            if (pendingShopPurchaseRef.current.has(currentItem.uid)) {
                console.warn("[buyShopItem] Duplicate purchase blocked:", currentItem.uid);
                return false;
            }

            pendingShopPurchaseRef.current.add(currentItem.uid);
            console.log("[buyShopItem] Using server authority mode");
            try {
                // Pass item UID for strict server-side validation (prevents infinite purchase)
                const result = await executeShopPurchaseRpc(playerId, currentItem.price, currentItem.unitId, currentItem.uid);

                if (!result.success) {
                    console.error("[buyShopItem] Server rejected:", result.error);
                    return false;
                }

                // サーバーからの結果でローカル状態を更新
                setData(prev => {
                    // サーバーからshopItemsが返ってきた場合はそれを採用（確実）
                    // 返ってこない場合（古いRPCなど）はローカル更新
                    let newShopItems = [...prev.shopItems];
                    if (result.shopItems && Array.isArray(result.shopItems)) {
                        newShopItems = result.shopItems as ShopItem[];
                    } else {
                        // Fallback: Local Update (should not happen with new RPC)
                        newShopItems[index] = { ...newShopItems[index], soldOut: true };
                    }

                    const newData = {
                        ...prev,
                        coins: result.coins ?? prev.coins,
                        unitInventory: result.unitInventory ?? prev.unitInventory,
                        shopItems: newShopItems,
                    };

                    // Update baseline so we don't re-save this change
                    if (lastSavedDataRef.current) {
                        lastSavedDataRef.current = {
                            ...lastSavedDataRef.current,
                            coins: newData.coins,
                            unitInventory: newData.unitInventory,
                            shopItems: newData.shopItems
                        };
                    }
                    return newData;
                });
                return true;
            } finally {
                pendingShopPurchaseRef.current.delete(currentItem.uid);
            }
        }


        // 未認証ユーザーはローカルで処理
        setData(prev => {
            const items = [...prev.shopItems];
            const item = items[index];
            // 二重チェック
            if (!item || item.soldOut || prev.coins < item.price) {
                return prev;
            }

            items[index] = { ...item, soldOut: true };

            const newInventory = { ...prev.unitInventory };
            newInventory[item.unitId] = (newInventory[item.unitId] || 0) + 1;

            return {
                ...prev,
                coins: prev.coins - item.price,
                shopItems: items,
                unitInventory: newInventory
            };
        });
        return true;
    }, [data.shopItems, data.coins, isAuthenticated, playerId]);

    // ガチャ履歴を追加
    const addGachaHistory = useCallback((unitIds: string[]) => {
        setData((prev) => {
            const entry: GachaHistoryEntry = {
                timestamp: Date.now(),
                unitIds: unitIds,
                count: unitIds.length,
            };
            const newHistory = [entry, ...prev.gachaHistory].slice(0, 100);
            return {
                ...prev,
                gachaHistory: newHistory,
            };
        });
    }, []);

    // ガチャ履歴をクリア
    const clearGachaHistory = useCallback(() => {
        setData((prev) => ({
            ...prev,
            gachaHistory: [],
        }));
    }, []);

    // ステージクリアを追加
    const addClearedStage = useCallback((stageId: string) => {
        setData((prev) => {
            if (prev.clearedStages.includes(stageId)) {
                return prev; // 既にクリア済み
            }
            return {
                ...prev,
                clearedStages: [...prev.clearedStages, stageId],
            };
        });
    }, []);

    // チェスステージクリアを追加
    const clearChessStage = useCallback((stageId: string) => {
        setData((prev) => {
            if (prev.clearedChessStages.includes(stageId)) {
                return prev; // 既にクリア済み
            }
            return {
                ...prev,
                clearedChessStages: [...prev.clearedChessStages, stageId],
            };
        });
    }, []);

    // ガーデンユニットを更新
    const setGardenUnits = useCallback((unitIds: string[]) => {
        setData((prev) => ({
            ...prev,
            gardenUnits: unitIds,
        }));
    }, []);

    // 現在のワールドを更新
    const setCurrentWorld = useCallback((worldId: string) => {
        setData((prev) => ({
            ...prev,
            currentWorld: worldId,
        }));
    }, []);

    // ガチャ用アトミック操作（コイン消費 + ユニット追加を1つのsetData内で実行）
    // これにより、ブラウザが閉じられてもデータ損失を防ぐ
    // 注意: React 18ではsetDataコールバックが遅延実行されるため、
    // 事前にコイン残高をチェックしてから実行する
    //
    // サーバー権威モード（認証済みユーザー）:
    // - サーバー側でコイン確認→消費→ユニット追加を原子的に実行
    // - 成功したらローカル状態を更新
    // - 失敗したらfalseを返す
    const executeGacha = useCallback(async (cost: number, unitIds: string[]): Promise<boolean> => {
        // 認証済みユーザーはサーバー権威モードを使用
        if (isAuthenticated && playerId) {
            console.log("[executeGacha] Using server authority mode");
            const result = await executeGachaRpc(playerId, cost, unitIds);

            if (!result.success) {
                console.error("[executeGacha] Server rejected:", result.error);
                return false;
            }

            // サーバーからの結果でローカル状態を更新
            setData((prev) => {
                let newGachaHistory = prev.gachaHistory;
                if (result.gachaHistory && Array.isArray(result.gachaHistory)) {
                    newGachaHistory = result.gachaHistory as GachaHistoryEntry[];
                } else {
                    // Fallback local update (server didn't return history, but we should record it)
                    // Note: Ideally we shouldn't drift, but for robustness:
                    const entry: GachaHistoryEntry = {
                        timestamp: Date.now(),
                        unitIds: unitIds,
                        count: unitIds.length,
                    };
                    newGachaHistory = [entry, ...prev.gachaHistory].slice(0, 100);
                }

                const newData = {
                    ...prev,
                    coins: result.coins ?? prev.coins,
                    unitInventory: result.unitInventory ?? prev.unitInventory,
                    gachaHistory: newGachaHistory
                };
                // Update baseline so we don't re-save
                if (lastSavedDataRef.current) {
                    lastSavedDataRef.current = {
                        ...lastSavedDataRef.current,
                        coins: newData.coins,
                        unitInventory: newData.unitInventory,
                        gachaHistory: newData.gachaHistory
                    };
                }
                return newData;
            });

            return true;
        }

        // 未認証ユーザーはローカルで処理（従来の動作）
        // 先にコイン残高をチェック（data.coinsは現在の状態）
        if (data.coins < cost) {
            console.log("[executeGacha] Not enough coins:", data.coins, "<", cost);
            return false;
        }

        // コインは十分あるので、状態を更新
        setData((prev) => {
            // 二重チェック（念のため）
            if (prev.coins < cost) {
                return prev;
            }
            const newInventory = { ...prev.unitInventory };
            for (const unitId of unitIds) {
                newInventory[unitId] = (newInventory[unitId] || 0) + 1;
            }
            return {
                ...prev,
                coins: prev.coins - cost,
                unitInventory: newInventory,
            };
        });

        return true;
    }, [data.coins, isAuthenticated, playerId]);

    // フュージョン用アトミック操作（素材消費 + 結果追加を1つのsetData内で実行）
    // これにより、素材だけ消費されて結果が得られないケースを防ぐ
    // React 18対応: 先に素材チェックを行い、その結果を返す
    //
    // サーバー権威モード（認証済みユーザー）:
    // - サーバー側で素材確認→消費→結果追加を原子的に実行
    // - 成功したらローカル状態を更新
    // - 失敗したらfalseを返す
    const executeFusion = useCallback(async (materialIds: string[], resultUnitId: string): Promise<boolean> => {
        // 認証済みユーザーはサーバー権威モードを使用
        if (isAuthenticated && playerId) {
            console.log("[executeFusion] Using server authority mode");
            const result = await executeFusionRpc(playerId, materialIds, resultUnitId);

            if (!result.success) {
                console.error("[executeFusion] Server rejected:", result.error);
                return false;
            }

            // サーバーからの結果でローカル状態を更新
            setData((prev) => {
                const newData = {
                    ...prev,
                    unitInventory: result.unitInventory ?? prev.unitInventory,
                };
                // Update baseline so we don't re-save
                if (lastSavedDataRef.current) {
                    lastSavedDataRef.current = {
                        ...lastSavedDataRef.current,
                        unitInventory: newData.unitInventory
                    };
                }
                return newData;
            });

            return true;
        }

        // 未認証ユーザーはローカルで処理（従来の動作）
        // 先に素材が全て揃っているか確認
        const materialCounts: Record<string, number> = {};
        for (const id of materialIds) {
            materialCounts[id] = (materialCounts[id] || 0) + 1;
        }
        for (const [unitId, needed] of Object.entries(materialCounts)) {
            if ((data.unitInventory[unitId] || 0) < needed) {
                return false; // 素材不足
            }
        }

        // 素材が揃っているので、状態を更新
        setData((prev) => {
            // 二重チェック
            for (const [unitId, needed] of Object.entries(materialCounts)) {
                if ((prev.unitInventory[unitId] || 0) < needed) {
                    return prev;
                }
            }

            const newInventory = { ...prev.unitInventory };

            // 素材を消費
            for (const [unitId, count] of Object.entries(materialCounts)) {
                const newCount = (newInventory[unitId] || 0) - count;
                if (newCount <= 0) {
                    delete newInventory[unitId];
                } else {
                    newInventory[unitId] = newCount;
                }
            }

            // 結果ユニットを追加
            newInventory[resultUnitId] = (newInventory[resultUnitId] || 0) + 1;

            return {
                ...prev,
                unitInventory: newInventory,
            };
        });
        return true;
    }, [data.unitInventory, isAuthenticated, playerId]);

    // バトル報酬用アトミック操作（コイン + ステージクリア + ドロップユニットを1つのsetData内で実行）
    // これにより、報酬の一部だけ反映されるケースを防ぐ
    //
    // サーバー権威モード（認証済みユーザー）:
    // - サーバー側でコイン追加→ステージクリア→ユニット追加を原子的に実行
    // - 成功したらローカル状態を更新
    // - 失敗した場合はローカル処理しない（二重報酬防止）
    const executeBattleReward = useCallback(async (
        coinsGained: number,
        stageId: string,
        droppedUnitIds: string[]
    ): Promise<void> => {
        // 認証済みユーザーはサーバー権威モードを使用
        if (isAuthenticated && playerId) {
            console.log("[executeBattleReward] Using server authority mode");
            const result = await executeBattleRewardRpc(playerId, coinsGained, stageId, droppedUnitIds);

            if (!result.success) {
                // サーバーエラー時はローカル処理しない（二重報酬防止）
                // サーバーで既に処理されている可能性があるため
                console.error("[executeBattleReward] Server error - not falling back to local:", result.error);
                return;
            }

            // CRITICAL FIX: Update ref IMMEDIATELY to prevent race condition with flushToSupabase
            // If flushToSupabase is called before the next render, it must see the updated data
            dataRef.current = {
                ...dataRef.current,
                coins: result.coins ?? dataRef.current.coins,
                unitInventory: result.unitInventory ?? dataRef.current.unitInventory,
                clearedStages: result.clearedStages ?? dataRef.current.clearedStages,
            };

            // サーバーからの結果でローカル状態を更新
            setData((prev) => {
                const newData = {
                    ...prev,
                    coins: result.coins ?? prev.coins,
                    unitInventory: result.unitInventory ?? prev.unitInventory,
                    clearedStages: result.clearedStages ?? prev.clearedStages,
                };
                // Update baseline so we don't re-save
                if (lastSavedDataRef.current) {
                    lastSavedDataRef.current = {
                        ...lastSavedDataRef.current,
                        coins: newData.coins,
                        unitInventory: newData.unitInventory,
                        clearedStages: newData.clearedStages
                    };
                }
                return newData;
            });
            return;
        }

        // 未認証ユーザーのみローカルで処理
        // CRITICAL FIX: Update dataRef immediately to handle race conditions
        const prevData = dataRef.current;

        const newInventory = { ...prevData.unitInventory };
        for (const unitId of droppedUnitIds) {
            newInventory[unitId] = (newInventory[unitId] || 0) + 1;
        }

        const newClearedStages = prevData.clearedStages.includes(stageId)
            ? prevData.clearedStages
            : [...prevData.clearedStages, stageId];

        const newData = {
            ...prevData,
            coins: prevData.coins + coinsGained,
            unitInventory: newInventory,
            clearedStages: newClearedStages,
            lastModified: Date.now(),
        };

        // Update Ref immediately
        dataRef.current = newData;

        // Update State
        setData(newData);
    }, [isAuthenticated, playerId]);

    // 初期ロード時にショップが空なら更新
    useEffect(() => {
        if (isLoaded && data.shopItems.length === 0) {
            refreshShop();
        }
    }, [isLoaded, data.shopItems.length, refreshShop]);

    return {
        // データ
        coins: data.coins,
        unitInventory: data.unitInventory,
        selectedTeam: data.selectedTeam,
        loadouts: data.loadouts,
        activeLoadoutIndex: data.activeLoadoutIndex,
        shopItems: data.shopItems,
        gachaHistory: data.gachaHistory,
        clearedStages: data.clearedStages,
        clearedChessStages: data.clearedChessStages,
        gardenUnits: data.gardenUnits,
        currentWorld: data.currentWorld,
        isLoaded,

        // アクション
        addCoins,
        spendCoins,
        addUnit,
        removeUnit,
        addUnits,
        setTeam,
        switchLoadout,
        nextLoadout,
        resetData,
        refreshShop,
        buyShopItem,
        addGachaHistory,
        clearGachaHistory,
        addClearedStage,
        clearChessStage,
        setGardenUnits,
        setCurrentWorld,
        executeGacha,
        executeFusion,
        executeBattleReward,
        executeArenaReward,
        executeGardenReward,
        flushToSupabase,
    };
}
