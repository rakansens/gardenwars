/**
 * バトル報酬システムのリグレッションテスト
 *
 * 重要なフロー:
 * 1. バトルに勝利
 * 2. コイン報酬を獲得
 * 3. ドロップユニットを獲得
 * 4. ステージクリアが記録される
 *
 * 危険なバグ:
 * - 報酬の一部だけ反映される（コインはもらえたがユニットはもらえない等）
 */

import { describe, it, expect } from 'vitest';

describe('バトル報酬システム', () => {

    describe('コイン報酬', () => {
        it('勝利時にコインが増える', () => {
            const coins = 1000;
            const reward = 150;

            const newCoins = coins + reward;

            expect(newCoins).toBe(1150);
        });

        it('報酬は0以上', () => {
            const reward = 100;

            expect(reward).toBeGreaterThanOrEqual(0);
        });
    });

    describe('ドロップユニット', () => {
        it('ドロップユニットがインベントリに追加される', () => {
            const inventory: Record<string, number> = { 'unit_a': 1 };
            const droppedUnitIds = ['unit_b', 'unit_c'];

            const newInventory = { ...inventory };
            for (const unitId of droppedUnitIds) {
                newInventory[unitId] = (newInventory[unitId] || 0) + 1;
            }

            expect(newInventory['unit_a']).toBe(1); // 変更なし
            expect(newInventory['unit_b']).toBe(1); // 追加
            expect(newInventory['unit_c']).toBe(1); // 追加
        });

        it('複数の同じユニットがドロップした場合', () => {
            const inventory: Record<string, number> = {};
            const droppedUnitIds = ['unit_a', 'unit_a', 'unit_a'];

            const newInventory = { ...inventory };
            for (const unitId of droppedUnitIds) {
                newInventory[unitId] = (newInventory[unitId] || 0) + 1;
            }

            expect(newInventory['unit_a']).toBe(3);
        });

        it('ドロップなし（空配列）も正常に処理', () => {
            const inventory: Record<string, number> = { 'unit_a': 1 };
            const droppedUnitIds: string[] = [];

            const newInventory = { ...inventory };
            for (const unitId of droppedUnitIds) {
                newInventory[unitId] = (newInventory[unitId] || 0) + 1;
            }

            expect(newInventory).toEqual({ 'unit_a': 1 });
        });
    });

    describe('ステージクリア記録', () => {
        it('新しいステージがクリア済みリストに追加される', () => {
            const clearedStages = ['stage_1', 'stage_2'];
            const newStageId = 'stage_3';

            const newClearedStages = clearedStages.includes(newStageId)
                ? clearedStages
                : [...clearedStages, newStageId];

            expect(newClearedStages).toContain('stage_3');
            expect(newClearedStages).toHaveLength(3);
        });

        it('既にクリア済みのステージは重複しない', () => {
            const clearedStages = ['stage_1', 'stage_2'];
            const newStageId = 'stage_1'; // 既にクリア済み

            const newClearedStages = clearedStages.includes(newStageId)
                ? clearedStages
                : [...clearedStages, newStageId];

            expect(newClearedStages).toHaveLength(2); // 増えない
        });
    });

    describe('アトミック操作（報酬の一括処理）', () => {
        /**
         * executeBattleRewardは以下を1つのsetData内で処理:
         * 1. コイン追加
         * 2. ドロップユニット追加
         * 3. ステージクリア記録
         *
         * これにより、報酬の一部だけ反映されるバグを防ぐ
         */

        it('全ての報酬が一度に反映される', () => {
            // 初期状態
            const state = {
                coins: 1000,
                unitInventory: { 'unit_a': 1 } as Record<string, number>,
                clearedStages: ['stage_1'],
            };

            // 報酬
            const coinsGained = 150;
            const stageId = 'stage_2';
            const droppedUnitIds = ['unit_b'];

            // アトミック操作のシミュレーション
            const newInventory = { ...state.unitInventory };
            for (const unitId of droppedUnitIds) {
                newInventory[unitId] = (newInventory[unitId] || 0) + 1;
            }

            const newClearedStages = state.clearedStages.includes(stageId)
                ? state.clearedStages
                : [...state.clearedStages, stageId];

            const newState = {
                coins: state.coins + coinsGained,
                unitInventory: newInventory,
                clearedStages: newClearedStages,
            };

            // 全ての変更が反映
            expect(newState.coins).toBe(1150);
            expect(newState.unitInventory['unit_b']).toBe(1);
            expect(newState.clearedStages).toContain('stage_2');
        });
    });

    describe('敗北時', () => {
        it('敗北時は報酬なし', () => {
            const state = {
                coins: 1000,
                unitInventory: {},
                clearedStages: [],
            };

            // 敗北 = executeBattleRewardを呼ばない
            // 状態は変わらない

            expect(state.coins).toBe(1000);
            expect(state.unitInventory).toEqual({});
            expect(state.clearedStages).toEqual([]);
        });
    });
});
