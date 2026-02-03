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
  getClearedStagesInArea: (areaId: string) => number;
  isAreaUnlocked: (areaId: string, areaIndex: number) => boolean;
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

      // エリア内のクリア済みステージ数を取得
      getClearedStagesInArea: (areaId) => {
        const results = get().progress.stageResults;
        // stageIdは "add_1", "sub_2" などの形式
        // areaIdに対応するプレフィックスを判定
        const prefixMap: Record<string, string> = {
          addition: 'add_',
          subtraction: 'sub_',
          multiplication: 'mul_',
          division: 'div_',
          mixed: 'mix_',
        };
        const prefix = prefixMap[areaId];
        if (!prefix) return 0;

        return Object.keys(results).filter(
          stageId => stageId.startsWith(prefix) && results[stageId]?.cleared
        ).length;
      },

      // エリアがアンロックされているかチェック（最初のエリアは常にアンロック、それ以外は前のエリアで5ステージクリア）
      isAreaUnlocked: (areaId, areaIndex) => {
        // 最初のエリア（addition）は常にアンロック
        if (areaIndex === 0) return true;

        // 前のエリアのIDを取得
        const areaOrder = ['addition', 'subtraction', 'multiplication', 'division', 'mixed'];
        const prevAreaId = areaOrder[areaIndex - 1];
        if (!prevAreaId) return false;

        // 前のエリアで5ステージ以上クリアしていればアンロック
        const clearedInPrevArea = get().getClearedStagesInArea(prevAreaId);
        return clearedInPrevArea >= 5;
      },

      resetProgress: () => set({ progress: initialProgress }),
    }),
    {
      name: 'math-battle-progress', // localStorage key
    }
  )
);
