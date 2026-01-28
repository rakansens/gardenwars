"use client";

import { useState, useEffect, useCallback } from "react";
import playerDataInitial from "@/data/player.json";
import unitsData from "@/data/units.json";
import type { UnitDefinition } from "@/data/types";

const STORAGE_KEY = "gardenwars_player";

export interface ShopItem {
    uid: string; // 一意なID (配列インデックスでもいいが、念のため)
    unitId: string;
    price: number;
    soldOut: boolean;
    isRare: boolean;
    discount?: number;
}

// プレイヤーデータの型
export interface PlayerData {
    coins: number;
    unitInventory: { [unitId: string]: number };
    selectedTeam: string[];
    shopItems: ShopItem[];
}

// 初期データ
const getInitialData = (): PlayerData => ({
    coins: 10000,
    unitInventory: playerDataInitial.unitInventory || {},
    selectedTeam: playerDataInitial.selectedTeam || [],
    shopItems: [], // 初期は空。初回ロード時に生成するか、空なら生成するロジックが必要
});

// ローカルストレージから読み込み
const loadFromStorage = (): PlayerData => {
    if (typeof window === "undefined") return getInitialData();

    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                coins: parsed.coins ?? 10000,
                unitInventory: parsed.unitInventory ?? getInitialData().unitInventory,
                selectedTeam: parsed.selectedTeam ?? getInitialData().selectedTeam,
                shopItems: parsed.shopItems ?? [],
            };
        }
    } catch (e) {
        console.error("Failed to load player data:", e);
    }
    return getInitialData();
};

// ローカルストレージに保存
const saveToStorage = (data: PlayerData) => {
    if (typeof window === "undefined") return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error("Failed to save player data:", e);
    }
};

/**
 * プレイヤーデータ管理フック
 */
export function usePlayerData() {
    const [data, setData] = useState<PlayerData>(getInitialData);
    const [isLoaded, setIsLoaded] = useState(false);

    // 初回読み込み
    useEffect(() => {
        const loaded = loadFromStorage();
        setData(loaded);
        setIsLoaded(true);
    }, []);

    // データ変更時に保存
    useEffect(() => {
        if (isLoaded) {
            saveToStorage(data);
        }
    }, [data, isLoaded]);

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

    // 編成を更新
    const setTeam = useCallback((team: string[]) => {
        setData((prev) => ({
            ...prev,
            selectedTeam: team,
        }));
    }, []);

    // データリセット（デバッグ用）
    const resetData = useCallback(() => {
        const initial = getInitialData();
        setData(initial);
        saveToStorage(initial);
    }, []);

    // ショップを更新
    const refreshShop = useCallback(() => {
        const allUnits = (unitsData as UnitDefinition[]).filter(u => !u.id.startsWith("enemy_"));
        const newItems: ShopItem[] = [];

        // 重み付け抽選関数
        const pickRandom = () => {
            const weights = { N: 50, R: 30, SR: 15, SSR: 4, UR: 1 };
            // ※SSR/URを少し出やすく調整 (ストアなので)

            let totalWeight = 0;
            for (const u of allUnits) totalWeight += weights[u.rarity] || 1;

            let r = Math.random() * totalWeight;
            for (const u of allUnits) {
                r -= weights[u.rarity] || 1;
                if (r <= 0) return u;
            }
            return allUnits[0];
        };

        for (let i = 0; i < 30; i++) {
            const unit = pickRandom();

            // 価格決定
            let basePrice = 20;
            switch (unit.rarity) {
                case 'N': basePrice = 20; break;
                case 'R': basePrice = 100; break;
                case 'SR': basePrice = 500; break;
                case 'SSR': basePrice = 3000; break;
                case 'UR': basePrice = 10000; break;
            }

            // フラッシュセール割引 (0% - 50%)
            const isDiscount = Math.random() < 0.3; // 30%で割引
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
        let success = false;
        setData(prev => {
            const items = [...prev.shopItems];
            const item = items[index];
            if (!item || item.soldOut || prev.coins < item.price) return prev;

            // 購入処理
            success = true;
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
        return success;
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
        shopItems: data.shopItems,
        isLoaded,

        // アクション
        addCoins,
        spendCoins,
        addUnit,
        addUnits,
        setTeam,
        resetData,
        refreshShop,
        buyShopItem,
    };
}
