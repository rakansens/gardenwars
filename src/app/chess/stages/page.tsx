"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getChessStagesByDifficulty,
  CHESS_DIFFICULTY_ORDER,
  CHESS_DIFFICULTY_INFO,
  type ChessDifficulty,
  type ChessStageDefinition,
} from "@/data/chess-stages";
import { useChessStageUnlock } from "@/hooks/useChessStageUnlock";
import PageHeader from "@/components/layout/PageHeader";

// AI難易度に基づく表示
const getAiDifficultyDisplay = (aiLevel: string): string => {
  switch (aiLevel) {
    case 'easy': return '⭐';
    case 'normal': return '⭐⭐';
    case 'hard': return '⭐⭐⭐';
    case 'expert': return '👑';
    default: return '⭐';
  }
};

// ステージアイコン
const getStageIcon = (stageId: string): string => {
  if (stageId.includes('beginner')) return '🌱';
  if (stageId.includes('intermediate')) return '⚔️';
  if (stageId.includes('advanced')) return '🔥';
  if (stageId.includes('master')) return '👑';
  return '♟️';
};

export default function ChessStagesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [selectedDifficulty, setSelectedDifficulty] = useState<ChessDifficulty | "all">("all");
  const {
    isDifficultyUnlocked,
    isStageUnlocked,
    clearedChessStages,
    getClearCount,
  } = useChessStageUnlock();

  // 全ステージを取得（難易度フィルター）
  const getAllStages = () => {
    if (selectedDifficulty === "all") {
      return CHESS_DIFFICULTY_ORDER.flatMap(diff => getChessStagesByDifficulty(diff));
    }
    return getChessStagesByDifficulty(selectedDifficulty);
  };

  const stages = getAllStages();

  // 全体のクリア数を計算
  const getTotalClearCount = () => {
    let cleared = 0;
    let total = 0;
    CHESS_DIFFICULTY_ORDER.forEach(diff => {
      const count = getClearCount(diff);
      cleared += count.cleared;
      total += count.total;
    });
    return { cleared, total };
  };

  const handleStageSelect = (stage: ChessStageDefinition) => {
    if (!isStageUnlocked(stage)) return;
    router.push(`/chess?stageId=${stage.id}`);
  };

  return (
    <main className="min-h-screen">
      <PageHeader
        title={`♟️ ${t("chess_stages_title")}`}
        backHref="/chess"
        backLabel={t("chess_free_play")}
        rightButton={{
          href: "/chess",
          label: t("chess_free_play"),
          icon: "🎮",
        }}
      />

      {/* 難易度タブ - ビジュアルカード */}
      <div className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {/* ALL タブ */}
          <button
            onClick={() => setSelectedDifficulty("all")}
            className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
              selectedDifficulty === "all"
                ? "ring-4 ring-yellow-400 scale-105 shadow-2xl z-10"
                : "hover:scale-102 hover:shadow-lg opacity-80 hover:opacity-100"
            }`}
          >
            <div className="relative h-24 sm:h-28 bg-gradient-to-br from-gray-600 to-gray-800">
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-2">
                <div className="text-xl mb-0.5">📋</div>
                <div className="text-white font-bold text-xs sm:text-sm leading-tight drop-shadow-lg">
                  {t("difficulty_all")}
                </div>
                <div className="text-white/70 text-[10px] drop-shadow">
                  {t("chess_all_stages")}
                </div>
                <div className={`text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded-full inline-block w-fit ${
                  getTotalClearCount().cleared === getTotalClearCount().total && getTotalClearCount().total > 0
                    ? "bg-green-500/80"
                    : "bg-white/30"
                } text-white`}>
                  {getTotalClearCount().cleared}/{getTotalClearCount().total}
                </div>
              </div>
            </div>
          </button>

          {/* 難易度タブ */}
          {CHESS_DIFFICULTY_ORDER.map(diff => {
            const info = CHESS_DIFFICULTY_INFO[diff];
            const { cleared, total } = getClearCount(diff);
            const isSelected = selectedDifficulty === diff;
            const isAllCleared = cleared === total && total > 0;
            const isLocked = !isDifficultyUnlocked(diff);

            return (
              <button
                key={diff}
                onClick={() => !isLocked && setSelectedDifficulty(diff)}
                disabled={isLocked}
                className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
                  isLocked
                    ? "opacity-50 cursor-not-allowed grayscale"
                    : isSelected
                      ? "ring-4 ring-yellow-400 scale-105 shadow-2xl z-10"
                      : "hover:scale-102 hover:shadow-lg opacity-80 hover:opacity-100"
                }`}
              >
                {/* グラデーション背景 */}
                <div className={`relative h-24 sm:h-28 bg-gradient-to-br ${info.gradient}`}>
                  {/* オーバーレイ */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                  {/* ロックアイコン */}
                  {isLocked && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                      <span className="text-3xl">🔒</span>
                    </div>
                  )}

                  {/* クリア済みバッジ */}
                  {isAllCleared && !isLocked && (
                    <div className="absolute top-1 right-1 bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                      ✓
                    </div>
                  )}

                  {/* コンテンツ */}
                  <div className="absolute inset-0 flex flex-col justify-end p-2">
                    <div className="text-xl mb-0.5">{info.icon}</div>
                    <div className="text-white font-bold text-xs sm:text-sm leading-tight drop-shadow-lg">
                      {t(info.nameKey)}
                    </div>
                    <div className="text-white/70 text-[10px] drop-shadow">
                      {t(`chess_difficulty_${diff}_desc`)}
                    </div>
                    <div className={`text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded-full inline-block w-fit ${
                      isAllCleared ? "bg-green-500/80" : "bg-white/30"
                    } text-white`}>
                      {cleared}/{total}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ステージ一覧 */}
      <div className="container">
        {stages.length === 0 ? (
          <div className="text-center py-12 text-amber-700 dark:text-amber-400">
            <div className="text-4xl mb-4">♟️</div>
            <p>{t("no_stages_in_category")}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stages.map((stage, index) => {
              const isCleared = clearedChessStages.includes(stage.id);
              const isLocked = !isStageUnlocked(stage);
              const diffInfo = CHESS_DIFFICULTY_INFO[stage.difficulty];

              return (
                <div
                  key={stage.id}
                  className={`stage-card relative overflow-hidden ${
                    isLocked
                      ? 'opacity-60 cursor-not-allowed'
                      : isCleared
                        ? 'ring-2 ring-green-400 cursor-pointer'
                        : 'cursor-pointer'
                  }`}
                  onClick={() => !isLocked && handleStageSelect(stage)}
                >
                  {/* ヘッダー画像エリア */}
                  <div className={`relative h-28 -mx-4 -mt-4 mb-3 overflow-hidden bg-gradient-to-br ${diffInfo.gradient}`}>
                    {/* チェス盤パターン背景 */}
                    <div className="absolute inset-0 opacity-20">
                      <div className="grid grid-cols-8 grid-rows-4 h-full">
                        {Array.from({ length: 32 }).map((_, i) => (
                          <div
                            key={i}
                            className={`${(Math.floor(i / 8) + i) % 2 === 0 ? 'bg-white' : 'bg-black'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-amber-50 dark:from-slate-800 via-transparent to-transparent" />

                    {/* ロックオーバーレイ */}
                    {isLocked && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                        <span className="text-4xl">🔒</span>
                      </div>
                    )}

                    {/* クリアバッジ */}
                    {isCleared && !isLocked && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10">
                        ✓ CLEAR
                      </div>
                    )}

                    {/* ステージ番号とアイコン */}
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                      <span className="text-sm text-white drop-shadow-lg font-medium">
                        {stage.id.replace(/_/g, ' ')}
                      </span>
                      <span className="text-2xl drop-shadow-lg">
                        {getStageIcon(stage.id)}
                      </span>
                    </div>
                  </div>

                  {/* コンテンツ部分 */}
                  <div className={isLocked ? 'grayscale' : ''}>
                    {/* ステージ名 */}
                    <h2 className="text-xl font-bold mb-2 text-amber-950 dark:text-white">
                      {isLocked ? "???" : t(stage.nameKey)}
                    </h2>

                    {/* 説明 */}
                    <p className="text-amber-900/70 dark:text-gray-400 mb-3 text-sm">
                      {isLocked ? t("stage_locked_hint") : t(stage.descriptionKey)}
                    </p>

                    {/* AI情報 */}
                    {!isLocked && (
                      <div className="mb-3">
                        <div className="text-xs text-amber-800 dark:text-gray-400 mb-1.5">{t("chess_opponent")}:</div>
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                            <span className="text-2xl">🤖</span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-amber-900 dark:text-gray-200">
                              {t(`chess_ai_${stage.aiLevel}`)}
                            </div>
                            <div className="text-xs text-amber-700 dark:text-gray-400">
                              {getAiDifficultyDisplay(stage.aiLevel)} Depth: {stage.aiDepth}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ステージ情報 */}
                    {!isLocked && (
                      <div className="bg-amber-200/70 dark:bg-slate-700/50 rounded-lg p-2 mb-3 text-xs text-amber-900 dark:text-gray-300 font-medium">
                        <div className="flex justify-between">
                          <span>🤖 {t(`chess_ai_${stage.aiLevel}`)}</span>
                          {stage.timeLimitSeconds && (
                            <span>⏱️ {Math.floor(stage.timeLimitSeconds / 60)}{t("minutes")}</span>
                          )}
                          <span>🪙 {stage.reward.coins}</span>
                        </div>
                      </div>
                    )}

                    {/* 特殊ルール */}
                    {!isLocked && stage.specialRules?.noUndo && (
                      <div className="mb-3">
                        <span className="text-xs bg-red-500/80 text-white px-2 py-1 rounded-full">
                          ⚠️ {t("chess_no_undo")}
                        </span>
                      </div>
                    )}

                    {/* 難易度と報酬 */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-amber-700 dark:text-amber-400">
                        {diffInfo.icon} {t(diffInfo.nameKey)}
                      </span>
                      <span className="text-amber-700 dark:text-amber-400 font-bold">
                        💰 {stage.reward.coins.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ヒント */}
      <div className="container mt-6">
        <div className="card text-center text-amber-900/70 dark:text-gray-400 text-sm">
          {t("chess_stage_hint")}
        </div>
      </div>
    </main>
  );
}
