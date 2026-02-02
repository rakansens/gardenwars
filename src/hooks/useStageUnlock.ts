import { useMemo } from "react";
import stagesData, { getStagesByWorld } from "@/data/stages";
import type { StageDefinition, StageDifficulty, WorldId } from "@/data/types";
import { usePlayerData } from "@/hooks/usePlayerData";

const stages = stagesData as StageDefinition[];

// 難易度の順番（アンロック順）
export const DIFFICULTY_ORDER: StageDifficulty[] = ["tutorial", "easy", "normal", "hard", "extreme", "boss", "special"];

// ステージの元の順序を保存するマップ（インデックス順序の保証用）
const stageOrderMap = new Map<string, number>();
stages.forEach((stage, index) => {
    stageOrderMap.set(stage.id, index);
});

// 特定の難易度のステージを元の順序でソートして取得
export function getStagesInDifficulty(difficulty: StageDifficulty, worldId?: WorldId): StageDefinition[] {
    const filteredStages = worldId
        ? getStagesByWorld(worldId).filter(s => s.difficulty === difficulty)
        : stages.filter(s => s.difficulty === difficulty);
    return filteredStages.sort((a, b) => (stageOrderMap.get(a.id) ?? 0) - (stageOrderMap.get(b.id) ?? 0));
}

// ステージのインデックスを元の順序で取得
export function getStageIndexInDifficulty(stage: StageDefinition): number {
    const stagesInDifficulty = getStagesInDifficulty(stage.difficulty as StageDifficulty);
    return stagesInDifficulty.findIndex(s => s.id === stage.id);
}

export interface StageUnlockInfo {
    // 難易度がアンロックされているかチェック
    isDifficultyUnlocked: (difficulty: StageDifficulty, worldId?: WorldId) => boolean;
    // ステージがアンロックされているかチェック
    isStageUnlocked: (stage: StageDefinition) => boolean;
    // クリア済みステージ
    clearedStages: string[];
    // 各難易度のクリア数
    getClearCount: (difficulty: StageDifficulty | "all", worldId?: WorldId) => { cleared: number; total: number };
}

/**
 * ステージのアンロック状態を管理する共有フック
 * stages/page.tsx と worldmap/page.tsx で共通使用
 */
export function useStageUnlock(): StageUnlockInfo {
    const { clearedStages } = usePlayerData();

    // 難易度がアンロックされているかチェック
    const isDifficultyUnlocked = useMemo(() => {
        return (difficulty: StageDifficulty, worldId?: WorldId): boolean => {
            const difficultyIndex = DIFFICULTY_ORDER.indexOf(difficulty);
            if (difficultyIndex === 0) return true; // tutorialは常にアンロック

            // 前の難易度の全ステージをクリアしているかチェック
            const prevDifficulty = DIFFICULTY_ORDER[difficultyIndex - 1];
            const prevStages = getStagesInDifficulty(prevDifficulty, worldId);
            return prevStages.every(s => clearedStages.includes(s.id));
        };
    }, [clearedStages]);

    // ステージがアンロックされているかチェック
    const isStageUnlocked = useMemo(() => {
        return (stage: StageDefinition): boolean => {
            const worldId = (stage.worldId || "world1") as WorldId;

            // 難易度がアンロックされていなければステージもロック
            if (!isDifficultyUnlocked(stage.difficulty as StageDifficulty, worldId)) return false;

            const stagesInDifficulty = getStagesInDifficulty(stage.difficulty as StageDifficulty, worldId);
            const stageIndex = stagesInDifficulty.findIndex(s => s.id === stage.id);

            // インデックスが無効な場合はロック
            if (stageIndex < 0 || stageIndex >= stagesInDifficulty.length) return false;

            // 最初のステージは常にアンロック（難易度がアンロックされていれば）
            if (stageIndex === 0) return true;

            // 前のステージがクリアされていればアンロック
            const prevStage = stagesInDifficulty[stageIndex - 1];
            if (!prevStage) return false; // 安全ガード

            return clearedStages.includes(prevStage.id);
        };
    }, [clearedStages, isDifficultyUnlocked]);

    // 各難易度のクリア数をカウント
    const getClearCount = useMemo(() => {
        return (difficulty: StageDifficulty | "all", worldId?: WorldId): { cleared: number; total: number } => {
            let targetStages: StageDefinition[];
            if (worldId) {
                const worldStages = getStagesByWorld(worldId);
                targetStages = difficulty === "all"
                    ? worldStages
                    : worldStages.filter(s => s.difficulty === difficulty);
            } else {
                targetStages = difficulty === "all"
                    ? stages
                    : stages.filter(s => s.difficulty === difficulty);
            }
            const cleared = targetStages.filter(s => clearedStages.includes(s.id)).length;
            return { cleared, total: targetStages.length };
        };
    }, [clearedStages]);

    return {
        isDifficultyUnlocked,
        isStageUnlocked,
        clearedStages,
        getClearCount,
    };
}
