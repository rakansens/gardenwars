import { useMemo } from "react";
import worlds from "@/data/worlds";
import type { WorldDefinition, WorldId } from "@/data/types";
import { usePlayerData } from "@/hooks/usePlayerData";
import { getStagesByWorld } from "@/data/stages";

export interface WorldUnlockInfo {
    // ワールドがアンロックされているかチェック
    isWorldUnlocked: (worldId: WorldId) => boolean;
    // ワールドの進捗を取得
    getWorldProgress: (worldId: WorldId) => { cleared: number; total: number };
    // アンロック済みワールド一覧
    unlockedWorlds: WorldDefinition[];
    // 全ワールド一覧
    allWorlds: WorldDefinition[];
}

/**
 * ワールドのアンロック状態を管理するフック
 * - World 1: 常にアンロック
 * - World 2: World 1の全Bossクリアで解放
 * - World 3: World 2の全Bossクリアで解放（将来実装）
 */
export function useWorldUnlock(): WorldUnlockInfo {
    const { clearedStages } = usePlayerData();

    // ワールドがアンロックされているかチェック
    const isWorldUnlocked = useMemo(() => {
        return (worldId: WorldId): boolean => {
            // TODO: デバッグ用 - 本番では削除
            const DEBUG_UNLOCK_ALL = true;
            if (DEBUG_UNLOCK_ALL) return true;

            const world = worlds.find((w) => w.id === worldId);
            if (!world) return false;

            // デフォルト解放のワールドは常にアンロック
            if (world.unlockedByDefault) return true;

            // 解放条件のボスステージを全てクリアしているかチェック
            if (!world.requiredBossStages || world.requiredBossStages.length === 0) {
                // 解放条件が設定されていない場合はロック（将来のコンテンツ）
                return false;
            }

            return world.requiredBossStages.every((stageId) =>
                clearedStages.includes(stageId)
            );
        };
    }, [clearedStages]);

    // ワールドの進捗を取得
    const getWorldProgress = useMemo(() => {
        return (worldId: WorldId): { cleared: number; total: number } => {
            const worldStages = getStagesByWorld(worldId);
            const clearedCount = worldStages.filter((s) =>
                clearedStages.includes(s.id)
            ).length;
            return {
                cleared: clearedCount,
                total: worldStages.length,
            };
        };
    }, [clearedStages]);

    // アンロック済みワールド一覧
    const unlockedWorlds = useMemo(() => {
        return worlds.filter((world) => isWorldUnlocked(world.id));
    }, [isWorldUnlocked]);

    return {
        isWorldUnlocked,
        getWorldProgress,
        unlockedWorlds,
        allWorlds: worlds,
    };
}
