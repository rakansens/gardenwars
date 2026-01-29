import { create } from 'zustand';
import type { PlayerState, BattleResult, StageDefinition, UnitDefinition, CostGaugeState, GameState } from '@/data/types';
import playerData from '@/data/player.json';
import unitsData from '@/data/units';
import stagesData from '@/data/stages';

// ============================================
// Game Store - Zustand
// ============================================

interface GameStore {
    // プレイヤー状態
    player: PlayerState;

    // マスターデータ
    units: UnitDefinition[];
    stages: StageDefinition[];

    // 現在のステージ
    currentStageId: string | null;

    // バトル状態
    gameState: GameState;
    costGauge: CostGaugeState;

    // 最新のバトル結果
    lastBattleResult: BattleResult | null;

    // Actions: プレイヤー
    setSelectedTeam: (unitIds: string[]) => void;
    addCoins: (amount: number) => void;

    // Actions: ステージ
    selectStage: (stageId: string) => void;

    // Actions: バトル
    setGameState: (state: GameState) => void;
    setCostGauge: (gauge: Partial<CostGaugeState>) => void;
    spendCost: (amount: number) => boolean;
    setBattleResult: (result: BattleResult) => void;

    // Helpers
    getUnitDef: (unitId: string) => UnitDefinition | undefined;
    getStageDef: (stageId: string) => StageDefinition | undefined;
    getSelectedTeamDefs: () => UnitDefinition[];
}

export const useGameStore = create<GameStore>((set, get) => ({
    // 初期状態
    player: playerData as PlayerState,
    units: unitsData as UnitDefinition[],
    stages: stagesData as StageDefinition[],
    currentStageId: null,
    gameState: 'LOADING',
    costGauge: {
        current: 0,
        max: 1000,
        regenRate: 50, // per second
    },
    lastBattleResult: null,

    // Actions
    setSelectedTeam: (unitIds) => set((state) => ({
        player: { ...state.player, selectedTeam: unitIds.slice(0, 5) }
    })),

    addCoins: (amount) => set((state) => ({
        player: { ...state.player, coins: state.player.coins + amount }
    })),

    selectStage: (stageId) => set({ currentStageId: stageId }),

    setGameState: (gameState) => set({ gameState }),

    setCostGauge: (gauge) => set((state) => ({
        costGauge: { ...state.costGauge, ...gauge }
    })),

    spendCost: (amount) => {
        const { costGauge } = get();
        if (costGauge.current >= amount) {
            set({ costGauge: { ...costGauge, current: costGauge.current - amount } });
            return true;
        }
        return false;
    },

    setBattleResult: (result) => set((state) => ({
        lastBattleResult: result,
        player: {
            ...state.player,
            coins: state.player.coins + result.coinsGained
        }
    })),

    // Helpers
    getUnitDef: (unitId) => get().units.find(u => u.id === unitId),

    getStageDef: (stageId) => get().stages.find(s => s.id === stageId),

    getSelectedTeamDefs: () => {
        const { player, units } = get();
        return player.selectedTeam
            .map(id => units.find(u => u.id === id))
            .filter((u): u is UnitDefinition => u !== undefined);
    },
}));
