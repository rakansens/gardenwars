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
    INITIAL_COINS,
} from "@/lib/supabase";
import type {
    FrontendPlayerData,
    ShopItem,
    GachaHistoryEntry,
} from "@/lib/supabase";

const STORAGE_KEY = "gardenwars_player";
const CLEARED_STAGES_KEY = "clearedStages";
const GARDEN_SELECTION_KEY = "garden_selection";

// Re-export types for backward compatibility
export type { ShopItem, GachaHistoryEntry };

// Alias for backward compatibility
export type PlayerData = FrontendPlayerData;

// Nレアリティのユニット一覧（味方のみ）
const allUnits = unitsData as UnitDefinition[];
const nRarityUnits = allUnits.filter(u =>
    u.rarity === "N" && !u.id.startsWith("enemy_") && !u.id.startsWith("boss_")
);

// 初期データ（Nユニットをランダムに3体付与）
const getInitialData = (): FrontendPlayerData => {
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
        gardenUnits: [],
    };
};

// ローカルストレージから読み込み（複数キーから統合）
const loadFromStorage = (): FrontendPlayerData => {
    if (typeof window === "undefined") return getInitialData();

    const initial = getInitialData();

    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);

            const loadouts: [string[], string[], string[]] = parsed.loadouts ?? [
                parsed.selectedTeam ?? initial.selectedTeam,
                [],
                []
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
                gardenUnits: parsed.gardenUnits ?? [],
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
        const clearedStagesRaw = localStorage.getItem(CLEARED_STAGES_KEY);
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
        const gardenRaw = localStorage.getItem(GARDEN_SELECTION_KEY);
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
const saveToStorage = (data: FrontendPlayerData) => {
    if (typeof window === "undefined") return;

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

    trySetItem(STORAGE_KEY, JSON.stringify(data));
    // 後方互換性のため別キーにも保存
    trySetItem(CLEARED_STAGES_KEY, JSON.stringify(data.clearedStages));
    trySetItem(GARDEN_SELECTION_KEY, JSON.stringify(data.gardenUnits));
};

/**
 * プレイヤーデータ管理フック
 * - 認証済み: Supabase + localStorage (ローカルキャッシュ)
 * - 未認証: localStorage のみ
 */
export function usePlayerData() {
    const { status, playerId, player } = useAuth();
    const [data, setData] = useState<PlayerData>(getInitialData);
    const [isLoaded, setIsLoaded] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const dataRef = useRef<PlayerData>(data); // Ref to capture latest data for debounced save
    const isAuthenticated = status === "authenticated" && playerId;

    // Keep dataRef in sync with data
    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    // 初回読み込み
    useEffect(() => {
        const loadData = async () => {
            // まずローカルから読み込み
            const localData = loadFromStorage();

            if (isAuthenticated && player) {
                // 認証済みの場合、Supabaseからデータを取得
                try {
                    const remoteData = await getFromSupabase(playerId);
                    if (remoteData) {
                        // リモートデータをローカル形式に変換（型安全な変換関数を使用）
                        const mergedData = toFrontendPlayerData(
                            remoteData,
                            localData.gachaHistory // ガチャ履歴はローカルのみ
                        );

                        // unitInventoryをマージ（ローカルとリモートの最大値を取る）
                        // これにより、Supabase保存前のローカル購入が失われない
                        const mergedInventory: Record<string, number> = { ...mergedData.unitInventory };
                        for (const [unitId, count] of Object.entries(localData.unitInventory)) {
                            mergedInventory[unitId] = Math.max(mergedInventory[unitId] || 0, count);
                        }
                        mergedData.unitInventory = mergedInventory;

                        // coinsもローカルが少ない場合はローカルを使用（購入後の状態を保持）
                        if (localData.coins < mergedData.coins) {
                            mergedData.coins = localData.coins;
                        }

                        // shopItemsをマージ（soldOut状態はローカルを優先）
                        if (mergedData.shopItems.length === 0 && localData.shopItems.length > 0) {
                            mergedData.shopItems = localData.shopItems;
                        } else if (mergedData.shopItems.length > 0 && localData.shopItems.length > 0) {
                            // 同じUIDのアイテムはローカルのsoldOut状態を優先
                            // O(n) Map-based lookup instead of O(n²) find inside map
                            const localItemMap = new Map(localData.shopItems.map(item => [item.uid, item]));
                            mergedData.shopItems = mergedData.shopItems.map(remoteItem => {
                                const localItem = localItemMap.get(remoteItem.uid);
                                if (localItem && localItem.soldOut) {
                                    return { ...remoteItem, soldOut: true };
                                }
                                return remoteItem;
                            });
                        }

                        // clearedStagesをマージ（和集合 - クリア履歴は追加のみ）
                        const mergedStages = new Set([...mergedData.clearedStages, ...localData.clearedStages]);
                        mergedData.clearedStages = Array.from(mergedStages);

                        // loadoutsをマージ（ローカルがより充実していれば保持）
                        const remoteLoadoutCount = mergedData.loadouts.filter(l => l.length > 0).length;
                        const localLoadoutCount = localData.loadouts.filter(l => l.length > 0).length;
                        if (localLoadoutCount > remoteLoadoutCount) {
                            mergedData.loadouts = localData.loadouts;
                            mergedData.activeLoadoutIndex = localData.activeLoadoutIndex;
                        }

                        // gardenUnitsをマージ（和集合 - 両方のユニットを保持）
                        const mergedGardenUnits = new Set([...mergedData.gardenUnits, ...localData.gardenUnits]);
                        mergedData.gardenUnits = Array.from(mergedGardenUnits);

                        // selectedTeam を activeLoadoutIndex から設定
                        mergedData.selectedTeam = mergedData.loadouts[mergedData.activeLoadoutIndex] || [];

                        setData(mergedData);
                        saveToStorage(mergedData);
                    } else {
                        // リモートにデータがない場合はローカルデータを使用
                        setData(localData);
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
        saveToStorage(data);

        // Supabaseへは遅延保存（デバウンス）
        if (isAuthenticated && playerId) {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            saveTimeoutRef.current = setTimeout(async () => {
                const maxRetries = 3;
                let lastError: unknown = null;

                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        // dataRefから最新のデータを取得（stale closure回避）
                        const latestData = dataRef.current;
                        // 型安全な変換関数を使用してSupabase形式に変換
                        const saveData = toSupabaseSaveData(latestData);
                        await saveToSupabase(playerId, saveData);

                        // ランキング統計も同期（コイン数、コレクション数）
                        await syncRankingStats(playerId, latestData.coins, latestData.unitInventory);
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
                console.error("Failed to save to Supabase after all retries:", lastError);
            }, 1000); // 1秒後に保存
        }

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [data, isLoaded, isAuthenticated, playerId]);

    // 即座にSupabaseに保存（ガチャなど重要な操作用）
    const flushToSupabase = useCallback(async (): Promise<boolean> => {
        if (!isAuthenticated || !playerId) return false;

        // 既存のデバウンスタイマーをキャンセル
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }

        try {
            const saveData = toSupabaseSaveData(data);
            await saveToSupabase(playerId, saveData);
            await syncRankingStats(playerId, data.coins, data.unitInventory);
            return true;
        } catch (err) {
            console.error("Failed to flush to Supabase:", err);
            return false;
        }
    }, [data, isAuthenticated, playerId]);

    // コインを増やす
    const addCoins = useCallback((amount: number) => {
        setData((prev) => ({
            ...prev,
            coins: prev.coins + amount,
        }));
    }, []);

    // コインを減らす（消費）
    // React 18対応: コールバック内でsuccessを設定するとバッチングで遅延するため、先にチェック
    const spendCoins = useCallback((amount: number): boolean => {
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
    }, [data.coins]);

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
        if (index < 0 || index > 2) return;
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
        saveToStorage(initial);
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
    // React 18対応: 先に購入可能かチェックしてから状態更新
    const buyShopItem = useCallback((index: number): boolean => {
        // 先に購入可能かチェック
        const currentItem = data.shopItems[index];
        if (!currentItem || currentItem.soldOut || data.coins < currentItem.price) {
            return false; // 購入失敗
        }

        // 購入可能なので、状態を更新
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
    }, [data.shopItems, data.coins]);

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

    // ガーデンユニットを更新
    const setGardenUnits = useCallback((unitIds: string[]) => {
        setData((prev) => ({
            ...prev,
            gardenUnits: unitIds,
        }));
    }, []);

    // ガチャ用アトミック操作（コイン消費 + ユニット追加を1つのsetData内で実行）
    // これにより、ブラウザが閉じられてもデータ損失を防ぐ
    // 注意: React 18ではsetDataコールバックが遅延実行されるため、
    // 事前にコイン残高をチェックしてから実行する
    const executeGacha = useCallback((cost: number, unitIds: string[]): boolean => {
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
    }, [data.coins]);

    // フュージョン用アトミック操作（素材消費 + 結果追加を1つのsetData内で実行）
    // これにより、素材だけ消費されて結果が得られないケースを防ぐ
    // React 18対応: 先に素材チェックを行い、その結果を返す
    const executeFusion = useCallback((materialIds: string[], resultUnitId: string): boolean => {
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
    }, [data.unitInventory]);

    // バトル報酬用アトミック操作（コイン + ステージクリア + ドロップユニットを1つのsetData内で実行）
    // これにより、報酬の一部だけ反映されるケースを防ぐ
    const executeBattleReward = useCallback((
        coinsGained: number,
        stageId: string,
        droppedUnitIds: string[]
    ): void => {
        setData((prev) => {
            const newInventory = { ...prev.unitInventory };
            for (const unitId of droppedUnitIds) {
                newInventory[unitId] = (newInventory[unitId] || 0) + 1;
            }

            const newClearedStages = prev.clearedStages.includes(stageId)
                ? prev.clearedStages
                : [...prev.clearedStages, stageId];

            return {
                ...prev,
                coins: prev.coins + coinsGained,
                unitInventory: newInventory,
                clearedStages: newClearedStages,
            };
        });
    }, []);

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
        gardenUnits: data.gardenUnits,
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
        setGardenUnits,
        executeGacha,
        executeFusion,
        executeBattleReward,
        flushToSupabase,
    };
}
