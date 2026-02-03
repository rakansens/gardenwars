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
import Image from "next/image";

const allUnits = unitsData as UnitDefinition[];

// 敵ユニットを取得するヘルパー
function getEnemyUnit(enemyId: string): UnitDefinition | undefined {
  return allUnits.find(u => u.id === enemyId);
}

// エリアごとのグラデーション
const AREA_GRADIENTS: Record<string, string> = {
  addition: "from-green-500 to-emerald-700",
  subtraction: "from-blue-500 to-cyan-700",
  multiplication: "from-orange-500 to-amber-700",
  division: "from-purple-500 to-violet-700",
  mixed: "from-rose-500 via-amber-500 to-cyan-500",
};

export default function AreaStagesPage({
  params,
}: {
  params: Promise<{ areaId: string }>;
}) {
  const { areaId } = use(params);
  const { t } = useLanguage();
  const isStageCleared = useMathBattleStore(state => state.isStageCleared);
  const isAreaUnlocked = useMathBattleStore(state => state.isAreaUnlocked);
  const progress = useMathBattleStore(state => state.progress);

  const area = getMathBattleArea(areaId);

  if (!area) {
    notFound();
  }

  // エリアがロックされている場合はリダイレクト
  const areaUnlocked = isAreaUnlocked(area.requiredStars);
  const gradient = AREA_GRADIENTS[areaId] || AREA_GRADIENTS.addition;

  // このエリアの進行状況
  const clearedStages = area.stages.filter(stage =>
    progress.stageResults[stage.id]?.cleared
  ).length;
  const areaStars = area.stages.reduce((sum, stage) => {
    const result = progress.stageResults[stage.id];
    return sum + (result?.stars || 0);
  }, 0);
  const maxStars = area.stages.length * 3;

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
            {/* エリアヘッダー */}
            <div className="relative overflow-hidden rounded-xl mb-6">
              <div className={`relative h-32 bg-gradient-to-r ${gradient}`}>
                {area.coverImage && (
                  <Image
                    src={area.coverImage}
                    alt={t(area.nameKey)}
                    fill
                    className="object-cover opacity-60"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* コンテンツ */}
                <div className="absolute inset-0 flex items-end p-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl bg-white/20 backdrop-blur-sm shadow-lg`}>
                      {area.icon}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                        {t(area.nameKey)}
                      </h2>
                      <p className="text-white/80 text-sm">
                        {area.stages.length} {t('mathBattle.stages')}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold text-lg drop-shadow-lg">
                        ⭐ {areaStars}/{maxStars}
                      </div>
                      <div className="text-white/80 text-sm">
                        {clearedStages}/{area.stages.length} {t('mathBattle.cleared') || 'cleared'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* プログレスバー */}
              <div className="h-1 bg-black/30">
                <div
                  className={`h-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                  style={{ width: `${(clearedStages / area.stages.length) * 100}%` }}
                />
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
