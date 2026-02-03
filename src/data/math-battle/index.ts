import { MathBattleAreaDefinition, MathBattleStageDefinition } from '../types';
import stagesData from './stages.json';

// エリア一覧
export const mathBattleAreas: MathBattleAreaDefinition[] = stagesData.areas as MathBattleAreaDefinition[];

// 全ステージをフラットに取得
export function getAllMathBattleStages(): MathBattleStageDefinition[] {
  return mathBattleAreas.flatMap(area => area.stages);
}

// エリアIDからエリアを取得
export function getMathBattleArea(areaId: string): MathBattleAreaDefinition | undefined {
  return mathBattleAreas.find(area => area.id === areaId);
}

// ステージIDからステージを取得
export function getMathBattleStage(stageId: string): MathBattleStageDefinition | undefined {
  return getAllMathBattleStages().find(stage => stage.id === stageId);
}

// エリアIDから所属するステージ一覧を取得
export function getStagesByArea(areaId: string): MathBattleStageDefinition[] {
  const area = getMathBattleArea(areaId);
  return area ? area.stages : [];
}
