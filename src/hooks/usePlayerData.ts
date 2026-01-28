"use client";

import { useState, useEffect, useCallback } from "react";
import playerDataInitial from "@/data/player.json";

const STORAGE_KEY = "gardenwars_player";

// プレイヤーデータの型
export interface PlayerData {
    coins: number;
    unitInventory: { [unitId: string]: number };
    selectedTeam: string[];
}

// 初期データ
const getInitialData = (): PlayerData => ({
    coins: 10000, // 初期10000コイン
    unitInventory: playerDataInitial.unitInventory || {},
    selectedTeam: playerDataInitial.selectedTeam || [],
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

    return {
        // データ
        coins: data.coins,
        unitInventory: data.unitInventory,
        selectedTeam: data.selectedTeam,
        isLoaded,

        // アクション
        addCoins,
        spendCoins,
        addUnit,
        addUnits,
        setTeam,
        resetData,
    };
}
