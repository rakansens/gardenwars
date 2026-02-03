"use client";

import Link from "next/link";
import type { MathBattleAreaDefinition } from "@/data/types";
import { useMathBattleStore } from "@/store/mathBattleStore";
import { useLanguage } from "@/contexts/LanguageContext";

interface AreaCardProps {
  area: MathBattleAreaDefinition;
}

// エリアの背景グラデーション設定
const AREA_GRADIENTS: Record<string, string> = {
  addition: "from-green-400 to-emerald-600",
  subtraction: "from-blue-400 to-cyan-600",
  multiplication: "from-orange-400 to-amber-600",
  division: "from-purple-400 to-violet-600",
  mixed: "from-rose-400 via-amber-400 to-cyan-400",
};

export default function AreaCard({ area }: AreaCardProps) {
  const { t } = useLanguage();
  const isAreaUnlocked = useMathBattleStore(state => state.isAreaUnlocked);
  const progress = useMathBattleStore(state => state.progress);

  const isUnlocked = isAreaUnlocked(area.requiredStars);
  const gradient = AREA_GRADIENTS[area.id] || AREA_GRADIENTS.addition;

  // このエリアのステージ進行状況を計算
  const clearedStages = area.stages.filter(stage =>
    progress.stageResults[stage.id]?.cleared
  ).length;
  const totalStages = area.stages.length;

  // このエリアで獲得した星の合計
  const areaStars = area.stages.reduce((sum, stage) => {
    const result = progress.stageResults[stage.id];
    return sum + (result?.stars || 0);
  }, 0);
  const maxAreaStars = totalStages * 3;

  if (!isUnlocked) {
    return (
      <div className="stage-card relative opacity-60 cursor-not-allowed">
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="text-4xl mb-2">🔒</div>
            <p className="text-amber-700/70 dark:text-slate-300/70 text-sm">
              {t('mathBattle.requireStars').replace('{stars}', String(area.requiredStars))}
            </p>
          </div>
        </div>
        <div className="blur-sm">
          <div className="text-5xl mb-3">{area.icon}</div>
          <h3 className="text-xl font-bold text-amber-900 dark:text-white">{t(area.nameKey)}</h3>
        </div>
      </div>
    );
  }

  return (
    <Link href={`/math-battle/${area.id}`}>
      <div className="stage-card relative overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-xl">
        {/* 背景グラデーション */}
        <div className={`absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-br ${gradient} opacity-20 -translate-y-8 translate-x-8`} />

        {/* 完全クリアマーク */}
        {clearedStages === totalStages && totalStages > 0 && (
          <div className="absolute -top-2 -right-2 bg-amber-400 rounded-full p-2 shadow-lg z-10">
            <span className="text-xl">🏆</span>
          </div>
        )}

        <div className="relative z-[1]">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-md bg-gradient-to-br ${gradient}`}>
              {area.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-amber-900 dark:text-white mb-1">
                {t(area.nameKey)}
              </h3>
              <p className="text-sm text-amber-700/70 dark:text-slate-300/70">
                {area.stages.length} {t('mathBattle.stages')}
              </p>
            </div>
          </div>

          {/* 進行状況 */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm text-amber-700/80 dark:text-slate-300/80">
              <span>{t('mathBattle.progress')}</span>
              <span className="font-semibold">{clearedStages}/{totalStages}</span>
            </div>
            <div className="h-2 bg-amber-200/50 dark:bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all`}
                style={{ width: `${(clearedStages / totalStages) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-end text-sm">
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                ⭐ {areaStars}/{maxAreaStars}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
