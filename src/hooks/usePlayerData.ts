"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

            let loadouts: [string[], string[], string[]] = parsed.loadouts ?? [
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

    // 別キーからも読み込み（後方互換性）
    try {
        const clearedStagesRaw = localStorage.getItem(CLEARED_STAGES_KEY);
        if (clearedStagesRaw && initial.clearedStages.length === 0) {
            const parsed = JSON.parse(clearedStagesRaw);
            if (Array.isArray(parsed)) {
                initial.clearedStages = parsed;
            }
        }
    } catch {}

    try {
        const gardenRaw = localStorage.getItem(GARDEN_SELECTION_KEY);
        if (gardenRaw && initial.gardenUnits.length === 0) {
            const parsed = JSON.parse(gardenRaw);
            if (Array.isArray(parsed)) {
                initial.gardenUnits = parsed;
            }
        }
    } catch {}

    return initial;
};

// ローカルストレージに保存（統合キーに保存 + 後方互換用に別キーにも保存）
const saveToStorage = (data: FrontendPlayerData) => {
    if (typeof window === "undefined") return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        // 後方互換性のため別キーにも保存
        localStorage.setItem(CLEARED_STAGES_KEY, JSON.stringify(data.clearedStages));
        localStorage.setItem(GARDEN_SELECTION_KEY, JSON.stringify(data.gardenUnits));
    } catch (e) {
        console.error("Failed to save player data:", e);
    }
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
    const isAuthenticated = status === "authenticated" && playerId;

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
                            mergedData.shopItems = mergedData.shopItems.map(remoteItem => {
                                const localItem = localData.shopItems.find(l => l.uid === remoteItem.uid);
                                if (localItem && localItem.soldOut) {
                                    return { ...remoteItem, soldOut: true };
                                }
                                return remoteItem;
                            });
                        }

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
                try {
                    // 型安全な変換関数を使用してSupabase形式に変換
                    const saveData = toSupabaseSaveData(data);
                    await saveToSupabase(playerId, saveData);

                    // ランキング統計も同期（コイン数、コレクション数）
                    await syncRankingStats(playerId, data.coins, data.unitInventory);
                } catch (err) {
                    console.error("Failed to save to Supabase:", err);
                }
            }, 1000); // 1秒後に保存
        }

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [data, isLoaded, isAuthenticated, playerId]);

    // コインを増やす
    const addCoins = useCallback((amount: number) => {
        setData((prev) => ({
            ...prev,
            coins: prev.coins + amount,
        }));
    }, []);

    // コインを減らす（消費）
    const spendCoins = useCallback((amount: number): boolean => {
        let success = false;
        setData((prev) => {
            if (prev.coins >= amount) {
                success = true;
                return { ...prev, coins: prev.coins - amount };
            }
            return prev;
        });
        return success;
    }, []);

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

            let totalWeight = 0;
            for (const u of allUnits) totalWeight += weights[u.rarity] || 0;

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

    // アイテム購入
    const buyShopItem = useCallback((index: number): boolean => {
        // 事前チェック（同期的に結果を返すため）
        const item = data.shopItems[index];
        if (!item || item.soldOut || data.coins < item.price) {
            return false;
        }

        // 状態更新（競合対策で再チェック）
        setData(prev => {
            const items = [...prev.shopItems];
            const currentItem = items[index];
            if (!currentItem || currentItem.soldOut || prev.coins < currentItem.price) {
                return prev;
            }

            items[index] = { ...currentItem, soldOut: true };

            const newInventory = { ...prev.unitInventory };
            newInventory[currentItem.unitId] = (newInventory[currentItem.unitId] || 0) + 1;

            return {
                ...prev,
                coins: prev.coins - currentItem.price,
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
    };
}
