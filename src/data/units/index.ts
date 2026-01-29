import type { UnitDefinition } from "../types";
import alliesData from "./allies.json";
import enemiesData from "./enemies.json";
import bossesData from "./bosses.json";

// 型アサーション
export const allies = alliesData as UnitDefinition[];
export const enemies = enemiesData as UnitDefinition[];
export const bosses = bossesData as UnitDefinition[];

// 全ユニット（後方互換性のため）
const allUnits: UnitDefinition[] = [...allies, ...enemies, ...bosses];

export default allUnits;
