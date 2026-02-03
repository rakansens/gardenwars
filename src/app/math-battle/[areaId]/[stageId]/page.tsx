"use client";

import { use, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { getMathBattleStage, getMathBattleArea } from "@/data/math-battle";
import { useMathBattleStore } from "@/store/mathBattleStore";
import { useGameStore } from "@/store/gameStore";
import unitsData from "@/data/units";
import type { UnitDefinition } from "@/data/types";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

// PhaserGameはSSR不可
const PhaserGame = dynamic(() => import("@/components/game/PhaserGame"), {
  ssr: false,
  loading: () => <LoadingSpinner icon="🧮" fullScreen />,
});

const allUnits = unitsData as UnitDefinition[];

// 敵ユニットを取得
function getEnemyUnit(enemyId: string): UnitDefinition | undefined {
  return allUnits.find(u => u.id === enemyId);
}

// デフォルトのプレイヤーユニットを取得
function getDefaultPlayerUnit(): UnitDefinition {
  // cat_warriorを優先、なければ最初の味方ユニット
  return allUnits.find(u => u.id === 'cat_warrior')
    || allUnits.find(u => !u.id.startsWith('enemy_') && !u.id.startsWith('boss_') && !u.isBoss)
    || allUnits[0];
}

export default function MathBattleStagePage({
  params,
}: {
  params: Promise<{ areaId: string; stageId: string }>;
}) {
  const { areaId, stageId } = use(params);
  const router = useRouter();
  const { t } = useLanguage();

  const recordStageResult = useMathBattleStore(state => state.recordStageResult);
  const addCoins = useGameStore(state => state.addCoins);

  const [gameEnded, setGameEnded] = useState(false);
  const [result, setResult] = useState<{ win: boolean; stars: number; coins: number } | null>(null);

  const stage = getMathBattleStage(stageId);
  const area = getMathBattleArea(areaId);

  if (!stage || !area) {
    notFound();
  }

  const enemyUnit = getEnemyUnit(stage.enemyId);
  const playerUnit = getDefaultPlayerUnit();

  // ゲーム終了ハンドラ
  const handleMathBattleEnd = useCallback((win: boolean, stars: number, coinsGained: number) => {
    setGameEnded(true);
    setResult({ win, stars, coins: coinsGained });

    if (win) {
      // 結果を保存
      recordStageResult(stageId, stars, 0); // 時間は後で取得できるようにする
      addCoins(coinsGained);
    }
  }, [stageId, recordStageResult, addCoins]);

  // リトライ
  const handleRetry = useCallback(() => {
    setGameEnded(false);
    setResult(null);
    // ページをリロードしてPhaserを再初期化
    router.refresh();
  }, [router]);

  // エリアに戻る
  const handleBack = useCallback(() => {
    router.push(`/math-battle/${areaId}`);
  }, [router, areaId]);

  // 次のステージへ
  const handleNext = useCallback(() => {
    const currentIndex = area.stages.findIndex(s => s.id === stageId);
    const nextStage = area.stages[currentIndex + 1];
    if (nextStage) {
      router.push(`/math-battle/${areaId}/${nextStage.id}`);
    } else {
      // エリア完了、エリア選択に戻る
      router.push(`/math-battle/${areaId}`);
    }
  }, [router, areaId, area.stages, stageId]);

  return (
    <main className="fixed inset-0 bg-[#1a1a2e] overflow-hidden">
      {/* ヘッダー */}
      <div className="absolute top-0 left-0 right-0 p-2 sm:p-4 z-20 flex items-center justify-between pointer-events-none">
        <Link
          href={`/math-battle/${areaId}`}
          className="btn btn-secondary text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 pointer-events-auto"
        >
          ← {t('back')}
        </Link>
        <div className="text-center">
          <div className="btn btn-primary pointer-events-none text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 shadow-lg border-2 border-white/20">
            {area.icon} {t(stage.nameKey)}
            {stage.isBoss && <span className="ml-1 text-red-300">BOSS</span>}
          </div>
        </div>
        <div className="w-16 sm:w-20" /> {/* スペーサー */}
      </div>

      {/* ゲームエリア */}
      <div className="w-full h-full flex items-center justify-center">
        {!gameEnded && enemyUnit && (
          <PhaserGame
            mode="math-battle"
            mathBattleStage={stage}
            mathBattlePlayerUnit={playerUnit}
            mathBattleEnemyUnit={enemyUnit}
            mathBattleOperationType={area.operationType}
            onMathBattleEnd={handleMathBattleEnd}
          />
        )}

        {/* 結果オーバーレイ */}
        {gameEnded && result && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="card max-w-md w-full mx-4 text-center">
              <div className="text-6xl mb-4">
                {result.win ? '🎉' : '😢'}
              </div>
              <h2 className={`text-3xl font-bold mb-4 ${result.win ? 'text-amber-500' : 'text-red-400'}`}>
                {result.win ? t('mathBattle.victory') : t('mathBattle.defeat')}
              </h2>

              {result.win && (
                <>
                  <div className="text-4xl mb-4 text-amber-400">
                    {'★'.repeat(result.stars)}
                    <span className="text-slate-400">{'★'.repeat(3 - result.stars)}</span>
                  </div>
                  <p className="text-amber-600 dark:text-amber-400 text-xl font-bold mb-6">
                    +{result.coins} {t('coins')}
                  </p>
                </>
              )}

              <div className="flex flex-col gap-3">
                {result.win && (
                  <button
                    onClick={handleNext}
                    className="btn btn-primary w-full"
                  >
                    {t('mathBattle.next')} →
                  </button>
                )}
                <button
                  onClick={handleRetry}
                  className="btn btn-secondary w-full"
                >
                  🔄 {t('mathBattle.retry')}
                </button>
                <button
                  onClick={handleBack}
                  className="btn btn-secondary w-full"
                >
                  ← {t('mathBattle.backToArea')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
