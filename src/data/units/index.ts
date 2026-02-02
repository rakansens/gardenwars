import type { UnitDefinition } from "../types";
import { getSkillById } from "../skills";
import alliesData from "./allies.json";
import enemiesData from "./enemies.json";
import bossesData from "./bosses.json";

/**
 * skillIdからskillオブジェクトを解決
 */
function resolveSkills(units: UnitDefinition[]): UnitDefinition[] {
  return units.map(unit => {
    if (unit.skillId && !unit.skill) {
      const skill = getSkillById(unit.skillId);
      if (skill) {
        return { ...unit, skill };
      }
    }
    return unit;
  });
}

// 型アサーション & スキル解決
export const allies = resolveSkills(alliesData as UnitDefinition[]);
export const enemies = resolveSkills(enemiesData as UnitDefinition[]);
export const bosses = resolveSkills(bossesData as UnitDefinition[]);

// 全ユニット（後方互換性のため）
const allUnits: UnitDefinition[] = [...allies, ...enemies, ...bosses];

export default allUnits;
