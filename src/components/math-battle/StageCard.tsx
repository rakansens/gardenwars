"use client";

import Link from "next/link";
import type { MathBattleStageDefinition, UnitDefinition } from "@/data/types";
import { useMathBattleStore } from "@/store/mathBattleStore";
import { useLanguage } from "@/contexts/LanguageContext";
import { getSpritePath } from "@/lib/sprites";
import Image from "next/image";

interface StageCardProps {
  stage: MathBattleStageDefinition;
  areaId: string;
  enemyUnit?: UnitDefinition;
  isLocked?: boolean;
}

export default function StageCard({ stage, areaId, enemyUnit, isLocked = false }: StageCardProps) {
  const { t } = useLanguage();
  const getStageResult = useMathBattleStore(state => state.getStageResult);

  const result = getStageResult(stage.id);
  const stars = result?.stars || 0;

  // 敵のスプライト表示（baseUnitIdがある場合はレアリティも渡す）
  const enemySpritePath = enemyUnit
    ? getSpritePath(enemyUnit.baseUnitId || enemyUnit.id, enemyUnit.rarity)
    : null;

  if (isLocked) {
    return (
      <div className="stage-card relative opacity-60 cursor-not-allowed">
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-3xl">🔒</div>
        </div>
        <div className="blur-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-amber-200/50 dark:bg-slate-700/50 flex items-center justify-center">
            <span className="text-2xl">👾</span>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-900 dark:text-white">
              Stage {stage.stageNumber}
            </div>
            <p className="text-amber-700/70 dark:text-slate-300/70 text-sm">
              {t(stage.nameKey)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link href={`/math-battle/${areaId}/${stage.id}`}>
      <div className={`stage-card relative transition-all duration-200 hover:scale-[1.01] hover:shadow-lg ${
        stage.isBoss ? 'ring-2 ring-red-400 dark:ring-red-500' : ''
      }`}>
        {/* ボスマーク */}
        {stage.isBoss && (
          <div className="absolute -top-2 -right-2 bg-red-500 rounded-full px-2 py-1 text-xs font-bold text-white shadow-lg z-10">
            BOSS
          </div>
        )}

        {/* クリアマーク */}
        {result?.cleared && (
          <div className="absolute -top-2 -left-2 bg-green-500 rounded-full w-6 h-6 flex items-center justify-center shadow-lg z-10">
            <span className="text-white text-sm">✓</span>
          </div>
        )}

        <div className="flex items-center gap-4">
          {/* 敵ユニット画像 */}
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden ${
            stage.isBoss
              ? 'bg-gradient-to-br from-red-200 to-purple-200 dark:from-red-900/50 dark:to-purple-900/50'
              : 'bg-amber-200/50 dark:bg-slate-700/50'
          }`}>
            {enemySpritePath ? (
              <Image
                src={enemySpritePath}
                alt={enemyUnit?.name || 'Enemy'}
                width={56}
                height={56}
                className={`object-contain ${stage.isBoss ? 'scale-90' : ''}`}
                style={{ transform: enemyUnit?.flipSprite ? 'scaleX(-1)' : undefined }}
              />
            ) : (
              <div className="text-3xl">👾</div>
            )}
          </div>

          <div className="flex-1">
            <h4 className="text-amber-900 dark:text-white font-bold">
              {stage.isBoss ? '👑 ' : ''}
              {t(stage.nameKey)}
            </h4>
            <p className="text-amber-700/70 dark:text-slate-300/70 text-sm">
              {stage.questionCount} {t('mathBattle.questions')}
            </p>

            {/* 星評価 */}
            <div className="flex items-center gap-0.5 mt-1">
              {[1, 2, 3].map(i => (
                <span key={i} className={`text-lg ${i <= stars ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}>
                  ★
                </span>
              ))}
            </div>
          </div>

          {/* 報酬 */}
          <div className="text-right">
            <p className="text-amber-600 dark:text-amber-400 font-bold text-sm">
              💰 {stage.reward.coins}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
