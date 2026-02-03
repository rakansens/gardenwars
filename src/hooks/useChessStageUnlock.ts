import { useMemo } from "react";
import {
  chessStages,
  getChessStagesByDifficulty,
  CHESS_DIFFICULTY_ORDER,
  type ChessStageDefinition,
  type ChessDifficulty,
} from "@/data/chess-stages";
import { usePlayerData } from "@/hooks/usePlayerData";

export interface ChessStageUnlockInfo {
  // Check if difficulty is unlocked
  isDifficultyUnlocked: (difficulty: ChessDifficulty) => boolean;
  // Check if stage is unlocked
  isStageUnlocked: (stage: ChessStageDefinition) => boolean;
  // Get cleared stages
  clearedChessStages: string[];
  // Get clear count for difficulty
  getClearCount: (difficulty: ChessDifficulty | "all") => { cleared: number; total: number };
  // Mark stage as cleared
  clearChessStage: (stageId: string, coinsEarned: number) => void;
}

/**
 * Hook for managing chess stage unlock state
 * - Beginner: Always unlocked
 * - Intermediate: Unlocked after clearing all Beginner stages
 * - Advanced: Unlocked after clearing all Intermediate stages
 * - Master: Unlocked after clearing all Advanced stages
 */
export function useChessStageUnlock(): ChessStageUnlockInfo {
  const { clearedChessStages = [], clearChessStage: playerClearChessStage, addCoins } = usePlayerData();

  // Check if difficulty is unlocked
  const isDifficultyUnlocked = useMemo(() => {
    return (difficulty: ChessDifficulty): boolean => {
      const difficultyIndex = CHESS_DIFFICULTY_ORDER.indexOf(difficulty);

      // Beginner is always unlocked
      if (difficultyIndex === 0) return true;
      if (difficultyIndex < 0) return false;

      // Check if all stages of previous difficulty are cleared
      const prevDifficulty = CHESS_DIFFICULTY_ORDER[difficultyIndex - 1];
      const prevStages = getChessStagesByDifficulty(prevDifficulty);
      return prevStages.every(s => clearedChessStages.includes(s.id));
    };
  }, [clearedChessStages]);

  // Check if stage is unlocked
  const isStageUnlocked = useMemo(() => {
    return (stage: ChessStageDefinition): boolean => {
      // Difficulty must be unlocked
      if (!isDifficultyUnlocked(stage.difficulty)) return false;

      const stagesInDifficulty = getChessStagesByDifficulty(stage.difficulty);
      const stageIndex = stagesInDifficulty.findIndex(s => s.id === stage.id);

      // Invalid index
      if (stageIndex < 0) return false;

      // First stage of difficulty is unlocked if difficulty is unlocked
      if (stageIndex === 0) return true;

      // Previous stage must be cleared
      const prevStage = stagesInDifficulty[stageIndex - 1];
      return clearedChessStages.includes(prevStage.id);
    };
  }, [clearedChessStages, isDifficultyUnlocked]);

  // Get clear count
  const getClearCount = useMemo(() => {
    return (difficulty: ChessDifficulty | "all"): { cleared: number; total: number } => {
      const targetStages = difficulty === "all"
        ? chessStages
        : getChessStagesByDifficulty(difficulty);
      const cleared = targetStages.filter(s => clearedChessStages.includes(s.id)).length;
      return { cleared, total: targetStages.length };
    };
  }, [clearedChessStages]);

  // Clear stage and add coins
  const clearChessStage = (stageId: string, coinsEarned: number) => {
    if (!clearedChessStages.includes(stageId)) {
      playerClearChessStage(stageId);
      addCoins(coinsEarned);
    }
  };

  return {
    isDifficultyUnlocked,
    isStageUnlocked,
    clearedChessStages,
    getClearCount,
    clearChessStage,
  };
}
