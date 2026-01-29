import type { StageDefinition } from "../types";
import normalData from "./normal.json";
import bossData from "./boss.json";
import specialData from "./special.json";

// 型アサーション
export const normalStages = normalData as StageDefinition[];
export const bossStages = bossData as StageDefinition[];
export const specialStages = specialData as StageDefinition[];

// 全ステージ（後方互換性のため）
const allStages: StageDefinition[] = [...normalStages, ...bossStages, ...specialStages];

export default allStages;
