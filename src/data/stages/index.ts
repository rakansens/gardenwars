import type { StageDefinition, ArenaStageDefinition, WorldId } from "../types";
import normalData from "./normal.json";
import bossData from "./boss.json";
import specialData from "./special.json";
import arenaData from "./arena.json";

// 型アサーション
export const normalStages = normalData as StageDefinition[];
export const bossStages = bossData as StageDefinition[];
export const specialStages = specialData as StageDefinition[];
export const arenaStages = arenaData as ArenaStageDefinition[];

// 全ステージにデフォルトのworldIdを付与（後方互換性のため）
const addDefaultWorldId = (stages: StageDefinition[]): StageDefinition[] => {
    return stages.map((stage) => ({
        ...stage,
        worldId: stage.worldId || "world1",
    }));
};

// 全ステージ（後方互換性のため、worldId付与済み）
const allStages: StageDefinition[] = [
    ...addDefaultWorldId(normalStages),
    ...addDefaultWorldId(bossStages),
    ...addDefaultWorldId(specialStages),
];

/**
 * 指定ワールドのステージを取得
 */
export function getStagesByWorld(worldId: WorldId): StageDefinition[] {
    return allStages.filter((stage) => (stage.worldId || "world1") === worldId);
}

/**
 * 指定ワールドの指定難易度のステージを取得
 */
export function getStagesByWorldAndDifficulty(
    worldId: WorldId,
    difficulty: StageDefinition["difficulty"]
): StageDefinition[] {
    return allStages.filter(
        (stage) =>
            (stage.worldId || "world1") === worldId && stage.difficulty === difficulty
    );
}

export default allStages;
