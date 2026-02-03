"use client";

import { use, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { getMathBattleStage, getMathBattleArea } from "@/data/math-battle";
import { useMathBattleStore } from "@/store/mathBattleStore";
import { useGameStore } from "@/store/gameStore";
import { usePlayerData } from "@/hooks/usePlayerData";
import unitsData from "@/data/units";
import type { UnitDefinition } from "@/data/types";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import RarityFrame from "@/components/ui/RarityFrame";
import Modal from "@/components/ui/Modal";

// PhaserGameはSSR不可
const PhaserGame = dynamic(() => import("@/components/game/PhaserGame"), {
  ssr: false,
  loading: () => <LoadingSpinner icon="🧮" fullScreen />,
});

const allUnits = unitsData as UnitDefinition[];
const playableUnits = allUnits.filter(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);
const MATH_BATTLE_UNIT_KEY = "gardenwars_math_battle_unit";

// 敵ユニットを取得
function getEnemyUnit(enemyId: string): UnitDefinition | undefined {
  return allUnits.find(u => u.id === enemyId);
}

export default function MathBattleStagePage({
  params,
}: {
  params: Promise<{ areaId: string; stageId: string }>;
}) {
  const { areaId, stageId } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
  const { unitInventory, isLoaded } = usePlayerData();

  const recordStageResult = useMathBattleStore(state => state.recordStageResult);
  const addCoins = useGameStore(state => state.addCoins);

  const [playerUnit, setPlayerUnit] = useState<UnitDefinition | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [result, setResult] = useState<{ win: boolean; stars: number; coins: number } | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);

  const stage = getMathBattleStage(stageId);
  const area = getMathBattleArea(areaId);

  if (!stage || !area) {
    notFound();
  }

  const enemyUnit = getEnemyUnit(stage.enemyId);

  // ユニット初期化
  useEffect(() => {
    if (!isLoaded) return;

    // 保存されたユニットを復元
    try {
      const storedId = localStorage.getItem(MATH_BATTLE_UNIT_KEY);
      if (storedId) {
        const storedUnit = playableUnits.find(u => u.id === storedId);
        if (storedUnit && (unitInventory[storedUnit.id] ?? 0) > 0) {
          setPlayerUnit(storedUnit);
          return;
        }
      }
    } catch {}

    // デフォルトユニットを選択
    const ownedIds = Object.keys(unitInventory).filter(id => unitInventory[id] > 0);
    const defaultUnit = playableUnits.find(u => u.id === 'cat_warrior' && ownedIds.includes(u.id))
      || playableUnits.find(u => ownedIds.includes(u.id))
      || playableUnits[0];

    setPlayerUnit(defaultUnit);
  }, [isLoaded, unitInventory]);

  const ownedUnits = playableUnits.filter((unit) => (unitInventory[unit.id] ?? 0) > 0);
  const selectableUnits = ownedUnits.length > 0 ? ownedUnits : playableUnits;

  const getUnitName = (unit: UnitDefinition) => {
    const translated = t(unit.id);
    return translated !== unit.id ? translated : unit.name;
  };

  // ゲーム終了ハンドラ
  const handleMathBattleEnd = useCallback((win: boolean, stars: number, coinsGained: number) => {
    setGameEnded(true);
    setResult({ win, stars, coins: coinsGained });

    if (win) {
      recordStageResult(stageId, stars, 0);
      addCoins(coinsGained);
    }
  }, [stageId, recordStageResult, addCoins]);

  // ゲーム開始
  const handleStart = useCallback(() => {
    if (playerUnit) {
      setGameStarted(true);
    }
  }, [playerUnit]);

  // リトライ
  const handleRetry = useCallback(() => {
    setGameStarted(false);
    setGameEnded(false);
    setResult(null);
  }, []);

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
      router.push(`/math-battle/${areaId}`);
    }
  }, [router, areaId, area.stages, stageId]);

  // ユニット選択
  const handleSelectUnit = (unit: UnitDefinition) => {
    setPlayerUnit(unit);
    try {
      localStorage.setItem(MATH_BATTLE_UNIT_KEY, unit.id);
    } catch {}
    setIsUnitModalOpen(false);
  };

  if (!isLoaded || !playerUnit) {
    return <LoadingSpinner icon="🧮" fullScreen />;
  }

  // ゲーム開始前の準備画面
  if (!gameStarted) {
    return (
      <main className="min-h-screen">
        <div className="container py-6">
          {/* ステージ情報 */}
          <div className="card mb-6 text-center">
            <div className="text-4xl mb-2">{area.icon}</div>
            <h1 className="text-2xl font-bold text-amber-900 dark:text-white mb-1">
              {t(stage.nameKey)}
            </h1>
            {stage.isBoss && (
              <span className="inline-block bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                BOSS
              </span>
            )}
            <p className="text-amber-700/70 dark:text-slate-300/70 mt-2">
              {stage.questionCount} {t('mathBattle.questions')} • {Math.floor(stage.timeLimitMs / 1000)}{t('mathBattle.seconds')}
            </p>
          </div>

          {/* VS表示 */}
          <div className="card mb-6">
            <div className="flex items-center justify-around">
              {/* プレイヤーユニット */}
              <div className="text-center">
                <button
                  onClick={() => setIsUnitModalOpen(true)}
                  className="relative group"
                >
                  <RarityFrame
                    unitId={playerUnit.id}
                    unitName={getUnitName(playerUnit)}
                    rarity={playerUnit.rarity}
                    size="lg"
                    baseUnitId={playerUnit.baseUnitId || playerUnit.atlasKey}
                  />
                  {/* 変更バッジ */}
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg group-hover:bg-amber-600 transition-colors">
                    ✏️
                  </div>
                </button>
                <p className="mt-2 font-bold text-amber-900 dark:text-white">
                  {getUnitName(playerUnit)}
                </p>
                <button
                  onClick={() => setIsUnitModalOpen(true)}
                  className="mt-1 btn btn-secondary text-xs py-1 px-3"
                >
                  🔄 {t('mathBattle.changeUnit')}
                </button>
              </div>

              {/* VS */}
              <div className="text-4xl font-bold text-amber-600 dark:text-amber-400">
                VS
              </div>

              {/* 敵ユニット */}
              <div className="text-center">
                {enemyUnit && (
                  <>
                    <RarityFrame
                      unitId={enemyUnit.id}
                      unitName={enemyUnit.name}
                      rarity={enemyUnit.rarity}
                      size="lg"
                      baseUnitId={enemyUnit.baseUnitId || enemyUnit.atlasKey}
                      isBoss={enemyUnit.isBoss}
                    />
                    <p className="mt-2 font-bold text-amber-900 dark:text-white">
                      {enemyUnit.name}
                    </p>
                    {stage.isBoss && (
                      <span className="inline-block mt-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        BOSS
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 報酬 */}
          <div className="card mb-6 text-center">
            <p className="text-sm text-amber-700/70 dark:text-slate-300/70 mb-1">
              {t('mathBattle.reward')}
            </p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              💰 {stage.reward.coins}
            </p>
          </div>

          {/* ボタン */}
          <div className="flex flex-col gap-3">
            <button onClick={handleStart} className="btn btn-primary w-full text-xl py-4">
              🎮 {t('mathBattle.start')}
            </button>
            <Link href={`/math-battle/${areaId}`} className="btn btn-secondary w-full">
              ← {t('back')}
            </Link>
          </div>
        </div>

        {/* ユニット選択モーダル */}
        <Modal isOpen={isUnitModalOpen} onClose={() => setIsUnitModalOpen(false)} size="lg">
          <div className="p-5">
            <h2 className="text-xl font-bold text-amber-900 dark:text-white mb-2">
              {t('mathBattle.selectUnit')}
            </h2>
            <p className="text-sm text-amber-700/70 dark:text-slate-300/70 mb-4">
              {t('mathBattle.selectUnitDesc')}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {selectableUnits.map((unit) => {
                const isSelected = playerUnit?.id === unit.id;
                return (
                  <button
                    key={unit.id}
                    onClick={() => handleSelectUnit(unit)}
                    className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all ${
                      isSelected
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-900/30"
                        : "border-transparent hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <RarityFrame
                      unitId={unit.id}
                      unitName={getUnitName(unit)}
                      rarity={unit.rarity}
                      size="sm"
                      baseUnitId={unit.baseUnitId || unit.atlasKey}
                      count={unitInventory[unit.id]}
                    />
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                      {getUnitName(unit)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Modal>
      </main>
    );
  }

  // ゲーム画面
  return (
    <main className="fixed inset-0 bg-[#1a1a2e] overflow-hidden">
      {/* ヘッダー */}
      <div className="absolute top-0 left-0 right-0 p-2 sm:p-4 z-20 flex items-center justify-between pointer-events-none">
        <button
          onClick={() => setGameStarted(false)}
          className="btn btn-secondary text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 pointer-events-auto"
        >
          ← {t('back')}
        </button>
        <div className="text-center">
          <div className="btn btn-primary pointer-events-none text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 shadow-lg border-2 border-white/20">
            {area.icon} {t(stage.nameKey)}
            {stage.isBoss && <span className="ml-1 text-red-300">BOSS</span>}
          </div>
        </div>
        <div className="w-16 sm:w-20" />
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
                  <button onClick={handleNext} className="btn btn-primary w-full">
                    {t('mathBattle.next')} →
                  </button>
                )}
                <button onClick={handleRetry} className="btn btn-secondary w-full">
                  🔄 {t('mathBattle.retry')}
                </button>
                <button onClick={handleBack} className="btn btn-secondary w-full">
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
