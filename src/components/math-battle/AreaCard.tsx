"use client";

import Link from "next/link";
import Image from "next/image";
import type { MathBattleAreaDefinition } from "@/data/types";
import { useMathBattleStore } from "@/store/mathBattleStore";
import { useLanguage } from "@/contexts/LanguageContext";

interface AreaCardProps {
  area: MathBattleAreaDefinition;
  areaIndex: number;
}

// エリアの背景グラデーション設定
const AREA_GRADIENTS: Record<string, string> = {
  addition: "from-green-400 to-emerald-600",
  subtraction: "from-blue-400 to-cyan-600",
  multiplication: "from-orange-400 to-amber-600",
  division: "from-purple-400 to-violet-600",
  mixed: "from-rose-400 via-amber-400 to-cyan-400",
};

export default function AreaCard({ area, areaIndex }: AreaCardProps) {
  const { t } = useLanguage();
  const isAreaUnlocked = useMathBattleStore(state => state.isAreaUnlocked);
  const getClearedStagesInArea = useMathBattleStore(state => state.getClearedStagesInArea);
  const progress = useMathBattleStore(state => state.progress);

  const isUnlocked = isAreaUnlocked(area.id, areaIndex);
  // 次のエリア解放に必要なクリア数を表示用に取得
  const clearedInThisArea = getClearedStagesInArea(area.id);
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

  const isAllCleared = clearedStages === totalStages && totalStages > 0;

  if (!isUnlocked) {
    return (
      <div className="relative overflow-hidden rounded-xl cursor-not-allowed">
        {/* カバー画像 */}
        <div className={`relative h-40 bg-gradient-to-br ${gradient}`}>
          {area.coverImage && (
            <Image
              src={area.coverImage}
              alt={t(area.nameKey)}
              fill
              className="object-cover grayscale opacity-60"
            />
          )}
          {/* 暗いオーバーレイ */}
          <div className="absolute inset-0 bg-black/50" />

          {/* ロックアイコン */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="text-5xl mb-2">🔒</div>
              <p className="text-white/90 text-sm font-medium">
                {t('mathBattle.requireClear')}
              </p>
            </div>
          </div>

          {/* コンテンツ */}
          <div className="absolute inset-0 flex flex-col justify-end p-4">
            <div className="text-3xl mb-1">{area.icon}</div>
            <h3 className="text-xl font-bold text-white/70 drop-shadow-lg">{t(area.nameKey)}</h3>
            <p className="text-white/50 text-sm">{totalStages} {t('mathBattle.stages')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link href={`/math-battle/${area.id}`}>
      <div className="relative overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl group">
        {/* カバー画像 */}
        <div className={`relative h-40 bg-gradient-to-br ${gradient}`}>
          {area.coverImage && (
            <Image
              src={area.coverImage}
              alt={t(area.nameKey)}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          )}
          {/* グラデーションオーバーレイ */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* 完全クリアバッジ */}
          {isAllCleared && (
            <div className="absolute top-2 right-2 bg-amber-400 rounded-full px-2 py-1 shadow-lg z-10 flex items-center gap-1">
              <span className="text-lg">🏆</span>
              <span className="text-xs font-bold text-amber-900">CLEAR</span>
            </div>
          )}

          {/* コンテンツ */}
          <div className="absolute inset-0 flex flex-col justify-end p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl mb-1">{area.icon}</div>
                <h3 className="text-xl font-bold text-white drop-shadow-lg">{t(area.nameKey)}</h3>
                <p className="text-white/80 text-sm">{totalStages} {t('mathBattle.stages')}</p>
              </div>
              <div className="text-right">
                <div className="text-white font-bold text-lg drop-shadow-lg">
                  ⭐ {areaStars}/{maxAreaStars}
                </div>
                <div className={`text-xs px-2 py-0.5 rounded-full ${
                  isAllCleared ? 'bg-green-500/80' : 'bg-white/30'
                } text-white font-medium`}>
                  {clearedStages}/{totalStages}
                </div>
              </div>
            </div>

            {/* プログレスバー */}
            <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-500`}
                style={{ width: `${(clearedStages / totalStages) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
