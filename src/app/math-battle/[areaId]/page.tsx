"use client";

import { use } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import PageHeader from "@/components/layout/PageHeader";
import StageCard from "@/components/math-battle/StageCard";
import { getMathBattleArea } from "@/data/math-battle";
import { useMathBattleStore } from "@/store/mathBattleStore";
import unitsData from "@/data/units";
import type { UnitDefinition } from "@/data/types";
import { notFound } from "next/navigation";

const allUnits = unitsData as UnitDefinition[];

// 敵ユニットを取得するヘルパー
function getEnemyUnit(enemyId: string): UnitDefinition | undefined {
  return allUnits.find(u => u.id === enemyId);
}

export default function AreaStagesPage({
  params,
}: {
  params: Promise<{ areaId: string }>;
}) {
  const { areaId } = use(params);
  const { t } = useLanguage();
  const isStageCleared = useMathBattleStore(state => state.isStageCleared);
  const isAreaUnlocked = useMathBattleStore(state => state.isAreaUnlocked);

  const area = getMathBattleArea(areaId);

  if (!area) {
    notFound();
  }

  // エリアがロックされている場合はリダイレクト
  const areaUnlocked = isAreaUnlocked(area.requiredStars);

  return (
    <main className="min-h-screen">
      <PageHeader
        title={`${area.icon} ${t(area.nameKey)}`}
        backHref="/math-battle"
      />

      <div className="container">
        {!areaUnlocked ? (
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">🔒</div>
            <p className="text-xl font-bold text-amber-900 dark:text-white mb-2">
              {t('mathBattle.areaLocked')}
            </p>
            <p className="text-amber-700/70 dark:text-slate-300/70">
              {t('mathBattle.requireStars').replace('{stars}', String(area.requiredStars))}
            </p>
          </div>
        ) : (
          <>
            {/* エリア情報 */}
            <div className="card mb-6">
              <div className="flex items-center gap-4">
                <div className="text-5xl">{area.icon}</div>
                <div>
                  <h2 className="text-xl font-bold text-amber-900 dark:text-white">
                    {t(area.nameKey)}
                  </h2>
                  <p className="text-amber-700/70 dark:text-slate-300/70">
                    {area.stages.length} {t('mathBattle.stages')}
                  </p>
                </div>
              </div>
            </div>

            {/* ステージ一覧 */}
            <div className="space-y-3">
              {area.stages.map((stage, index) => {
                // 最初のステージは常にアンロック、それ以外は前のステージをクリアで解放
                const previousStage = area.stages[index - 1];
                const isLocked = index > 0 && previousStage && !isStageCleared(previousStage.id);
                const enemyUnit = getEnemyUnit(stage.enemyId);

                return (
                  <StageCard
                    key={stage.id}
                    stage={stage}
                    areaId={areaId}
                    enemyUnit={enemyUnit}
                    isLocked={isLocked}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
