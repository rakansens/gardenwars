import type { StageDefinition, ArenaStageDefinition } from "../types";
import normalData from "./normal.json";
import bossData from "./boss.json";
import specialData from "./special.json";
import arenaData from "./arena.json";

// 型アサーション
export const normalStages = normalData as StageDefinition[];
export const bossStages = bossData as StageDefinition[];
export const specialStages = specialData as StageDefinition[];
export const arenaStages = arenaData as ArenaStageDefinition[];

// 全ステージ（後方互換性のため）
const allStages: StageDefinition[] = [...normalStages, ...bossStages, ...specialStages];

export default allStages;
