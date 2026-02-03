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

  // 敵のスプライト表示
  // ボスの場合: /assets/sprites/bosses/{baseUnitId}.webp
  // 通常敵の場合: getSpritePath を使用
  const enemySpritePath = enemyUnit
    ? enemyUnit.isBoss && enemyUnit.baseUnitId
      ? `/assets/sprites/bosses/${enemyUnit.baseUnitId}.webp`
      : getSpritePath(enemyUnit.baseUnitId || enemyUnit.id, enemyUnit.rarity)
    : null;

  if (isLocked) {
    return (
      <div className="stage-card relative opacity-70 cursor-not-allowed">
        {/* 鍵マーク */}
        <div className="absolute top-2 right-2 z-10">
          <div className="text-2xl">🔒</div>
        </div>

        <div className="flex items-center gap-4">
          {/* 敵ユニット画像（はっきり表示） */}
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden grayscale ${
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

          {/* テキスト部分（少しぼかす） */}
          <div className="flex-1 blur-[1px]">
            <h4 className="text-amber-900/70 dark:text-white/70 font-bold">
              {stage.isBoss ? '👑 ' : ''}
              {t(stage.nameKey)}
            </h4>
            <p className="text-amber-700/50 dark:text-slate-300/50 text-sm">
              {stage.questionCount} {t('mathBattle.questions')}
            </p>
            {/* 星（未獲得表示） */}
            <div className="flex items-center gap-0.5 mt-1">
              {[1, 2, 3].map(i => (
                <span key={i} className="text-lg text-slate-300 dark:text-slate-600">
                  ★
                </span>
              ))}
            </div>
          </div>

          {/* 報酬 */}
          <div className="text-right blur-[1px]">
            <p className="text-amber-600/50 dark:text-amber-400/50 font-bold text-sm">
              💰 {stage.reward.coins}
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
