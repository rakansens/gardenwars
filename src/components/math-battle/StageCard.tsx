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

// ステージ番号から背景画像を取得
function getStageImage(stageNumber: number, isBoss: boolean): string {
  if (isBoss) {
    // ボスステージ用画像 (2-5の範囲でサイクル)
    const bossIndex = ((stageNumber - 1) % 4) + 2;
    return `/assets/stages/boss_stage_${bossIndex}.webp`;
  }
  // 通常ステージ用画像 (1-20の範囲でサイクル)
  const stageIndex = ((stageNumber - 1) % 20) + 1;
  return `/assets/stages/stage_${stageIndex}.webp`;
}

export default function StageCard({ stage, areaId, enemyUnit, isLocked = false }: StageCardProps) {
  const { t } = useLanguage();
  const getStageResult = useMathBattleStore(state => state.getStageResult);

  const result = getStageResult(stage.id);
  const stars = result?.stars || 0;
  const stageImage = getStageImage(stage.stageNumber, stage.isBoss);

  // 敵のスプライト表示
  const enemySpritePath = enemyUnit
    ? enemyUnit.isBoss && enemyUnit.baseUnitId
      ? `/assets/sprites/bosses/${enemyUnit.baseUnitId}.webp`
      : getSpritePath(enemyUnit.baseUnitId || enemyUnit.id, enemyUnit.rarity)
    : null;

  if (isLocked) {
    return (
      <div className="relative overflow-hidden rounded-xl cursor-not-allowed">
        {/* 背景画像 */}
        <div className="relative h-24">
          <Image
            src={stageImage}
            alt={t(stage.nameKey)}
            fill
            className="object-cover grayscale opacity-50"
          />
          <div className="absolute inset-0 bg-black/40" />

          {/* 鍵マーク */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-4xl">🔒</div>
          </div>

          {/* コンテンツ */}
          <div className="absolute inset-0 flex items-center p-4">
            {/* 敵ユニット画像 */}
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden shrink-0 grayscale ${
              stage.isBoss
                ? 'bg-gradient-to-br from-red-200/80 to-purple-200/80'
                : 'bg-white/30'
            }`}>
              {enemySpritePath ? (
                <Image
                  src={enemySpritePath}
                  alt={enemyUnit?.name || 'Enemy'}
                  width={48}
                  height={48}
                  className="object-contain"
                  style={{ transform: enemyUnit?.flipSprite ? 'scaleX(-1)' : undefined }}
                />
              ) : (
                <div className="text-2xl">👾</div>
              )}
            </div>

            {/* テキスト */}
            <div className="flex-1 ml-3 blur-[1px]">
              <h4 className="text-white/70 font-bold text-sm drop-shadow-lg">
                {stage.isBoss ? '👑 ' : ''}
                {t(stage.nameKey)}
              </h4>
              <p className="text-white/50 text-xs">
                {stage.questionCount} {t('mathBattle.questions')}
              </p>
              <div className="flex items-center gap-0.5 mt-1">
                {[1, 2, 3].map(i => (
                  <span key={i} className="text-sm text-white/30">★</span>
                ))}
              </div>
            </div>

            {/* 報酬 */}
            <div className="text-right blur-[1px]">
              <p className="text-white/50 font-bold text-sm drop-shadow-lg">
                💰 {stage.reward.coins}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link href={`/math-battle/${areaId}/${stage.id}`}>
      <div className={`relative overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group ${
        stage.isBoss ? 'ring-2 ring-red-400' : ''
      }`}>
        {/* 背景画像 */}
        <div className="relative h-24">
          <Image
            src={stageImage}
            alt={t(stage.nameKey)}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

          {/* ボスマーク */}
          {stage.isBoss && (
            <div className="absolute top-2 right-2 bg-red-500 rounded-full px-2 py-0.5 text-xs font-bold text-white shadow-lg z-10">
              BOSS
            </div>
          )}

          {/* クリアマーク */}
          {result?.cleared && (
            <div className="absolute top-2 left-2 bg-green-500 rounded-full px-2 py-0.5 text-xs font-bold text-white shadow-lg z-10 flex items-center gap-1">
              ✓ CLEAR
            </div>
          )}

          {/* コンテンツ */}
          <div className="absolute inset-0 flex items-center p-4">
            {/* 敵ユニット画像 */}
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-lg ${
              stage.isBoss
                ? 'bg-gradient-to-br from-red-200 to-purple-200 ring-2 ring-red-400'
                : 'bg-white/90'
            }`}>
              {enemySpritePath ? (
                <Image
                  src={enemySpritePath}
                  alt={enemyUnit?.name || 'Enemy'}
                  width={48}
                  height={48}
                  className="object-contain"
                  style={{ transform: enemyUnit?.flipSprite ? 'scaleX(-1)' : undefined }}
                />
              ) : (
                <div className="text-2xl">👾</div>
              )}
            </div>

            {/* テキスト */}
            <div className="flex-1 ml-3">
              <h4 className="text-white font-bold text-sm drop-shadow-lg">
                {stage.isBoss ? '👑 ' : ''}
                {t(stage.nameKey)}
              </h4>
              <p className="text-white/80 text-xs drop-shadow">
                {stage.questionCount} {t('mathBattle.questions')} • {Math.floor(stage.timeLimitMs / 1000)}s
              </p>
              {/* 星評価 */}
              <div className="flex items-center gap-0.5 mt-1">
                {[1, 2, 3].map(i => (
                  <span key={i} className={`text-sm drop-shadow-lg ${i <= stars ? 'text-amber-400' : 'text-white/40'}`}>
                    ★
                  </span>
                ))}
              </div>
            </div>

            {/* 報酬 */}
            <div className="text-right">
              <p className="text-amber-300 font-bold text-sm drop-shadow-lg">
                💰 {stage.reward.coins}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
