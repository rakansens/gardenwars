import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MathBattleProgress } from '@/data/types';

// ============================================
// Math Battle Store - 算数バトル進行管理
// ============================================

interface MathBattleStore {
  // 進行状態（永続化）
  progress: MathBattleProgress;

  // Actions
  recordStageResult: (stageId: string, stars: number, time: number) => void;
  getTotalStars: () => number;
  getStageResult: (stageId: string) => { cleared: boolean; stars: number; bestTime?: number } | undefined;
  isStageCleared: (stageId: string) => boolean;
  isAreaUnlocked: (requiredStars: number) => boolean;
  resetProgress: () => void;
}

const initialProgress: MathBattleProgress = {
  stageResults: {},
  totalStars: 0,
};

export const useMathBattleStore = create<MathBattleStore>()(
  persist(
    (set, get) => ({
      progress: initialProgress,

      // ステージ結果を記録（星数が多い場合のみ更新）
      recordStageResult: (stageId, stars, time) => {
        set((state) => {
          const existing = state.progress.stageResults[stageId];

          // 既存の結果がある場合、星数が多いか、同じ星数で時間が早い場合のみ更新
          if (existing) {
            const shouldUpdate =
              stars > existing.stars ||
              (stars === existing.stars && time < (existing.bestTime ?? Infinity));

            if (!shouldUpdate) {
              return state;
            }
          }

          const newStageResults = {
            ...state.progress.stageResults,
            [stageId]: {
              cleared: true,
              stars: existing ? Math.max(existing.stars, stars) : stars,
              bestTime: existing?.bestTime
                ? Math.min(existing.bestTime, time)
                : time,
            },
          };

          // 総星数を再計算
          const totalStars = Object.values(newStageResults).reduce(
            (sum, result) => sum + result.stars,
            0
          );

          return {
            progress: {
              stageResults: newStageResults,
              totalStars,
            },
          };
        });
      },

      getTotalStars: () => get().progress.totalStars,

      getStageResult: (stageId) => get().progress.stageResults[stageId],

      isStageCleared: (stageId) => {
        const result = get().progress.stageResults[stageId];
        return result?.cleared ?? false;
      },

      isAreaUnlocked: (requiredStars) => {
        return get().progress.totalStars >= requiredStars;
      },

      resetProgress: () => set({ progress: initialProgress }),
    }),
    {
      name: 'math-battle-progress', // localStorage key
    }
  )
);
