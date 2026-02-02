import type { StageDefinition, ArenaStageDefinition, WorldId } from "../types";
import normalData from "./normal.json";
import bossData from "./boss.json";
import specialData from "./special.json";
import arenaData from "./arena.json";
import world2Data from "./world2.json";

// 型アサーション
export const normalStages = normalData as StageDefinition[];
export const bossStages = bossData as StageDefinition[];
export const specialStages = specialData as StageDefinition[];
export const arenaStages = arenaData as ArenaStageDefinition[];
export const world2Stages = world2Data as StageDefinition[];

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
    ...world2Stages, // World 2のステージ（既にworldId設定済み）
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

/**
 * ステージIDからステージ定義を取得
 */
export function getStageById(stageId: string): StageDefinition | undefined {
    return allStages.find((stage) => stage.id === stageId);
}

/**
 * ステージIDから進捗表示用の情報を取得
 * @returns { worldId, stageIndex, difficulty, nameKey } または undefined
 */
export function getStageProgressInfo(stageId: string): {
    worldId: WorldId;
    stageIndex: number;
    difficulty: StageDefinition["difficulty"];
    nameKey: string;
} | undefined {
    const stage = getStageById(stageId);
    if (!stage) return undefined;

    const worldId = stage.worldId || "world1";

    // ステージIDから番号を抽出
    // 例: "stage_5" -> 5, "boss_stage_3" -> 3, "inferno_7" -> 7
    const numMatch = stageId.match(/(\d+)$/);
    const stageIndex = numMatch ? parseInt(numMatch[1], 10) : 1;

    return {
        worldId,
        stageIndex,
        difficulty: stage.difficulty,
        nameKey: stage.name, // ステージ名の翻訳キー
    };
}

export default allStages;
