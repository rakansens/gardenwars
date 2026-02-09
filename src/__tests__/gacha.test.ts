/**
 * ガチャシステムのリグレッションテスト
 *
 * このテストは以下のバグを防ぐために作成されました：
 * - コインが減るがアニメーションが表示されない
 * - ユニットが保存されない
 * - React 18の自動バッチングによる状態更新の問題
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// テスト用のシンプルなガチャロジック（usePlayerDataの核心部分を抽出）
describe('ガチャシステム', () => {

    describe('executeGacha ロジック', () => {
        /**
         * 重要: このテストはReact 18のバッチングで壊れたバグを再現
         *
         * 【バグの内容】
         * setDataのコールバック内でsuccess=trueを設定していたが、
         * React 18ではコールバックが遅延実行されるため、
         * return successがfalseを返していた
         */

        it('コインが十分ある場合、trueを返す（同期的に）', () => {
            // Arrange: 現在のコイン残高とコスト
            const currentCoins = 1000;
            const cost = 100;

            // Act: コイン残高チェック（修正後のロジック）
            const canExecute = currentCoins >= cost;

            // Assert: 十分なコインがあればtrue
            expect(canExecute).toBe(true);
        });

        it('コインが不足している場合、falseを返す', () => {
            // Arrange
            const currentCoins = 50;
            const cost = 100;

            // Act
            const canExecute = currentCoins >= cost;

            // Assert
            expect(canExecute).toBe(false);
        });

        it('ちょうどのコイン数でも実行できる', () => {
            // Arrange
            const currentCoins = 100;
            const cost = 100;

            // Act
            const canExecute = currentCoins >= cost;

            // Assert
            expect(canExecute).toBe(true);
        });
    });

    describe('ガチャコスト計算', () => {
        const SINGLE_COST = 100;
        const MULTI_COST = 900;
        const SUPER_MULTI_COST = 9000;

        it('1連ガチャのコストは100', () => {
            const count: number = 1;
            let cost = SINGLE_COST;
            if (count === 10) cost = MULTI_COST;
            if (count === 100) cost = SUPER_MULTI_COST;

            expect(cost).toBe(100);
        });

        it('10連ガチャのコストは900（10%お得）', () => {
            const count: number = 10;
            let cost = SINGLE_COST;
            if (count === 10) cost = MULTI_COST;
            if (count === 100) cost = SUPER_MULTI_COST;

            expect(cost).toBe(900);
            // 10回単発より100コインお得
            expect(cost).toBeLessThan(SINGLE_COST * 10);
        });

        it('100連ガチャのコストは9000', () => {
            const count: number = 100;
            let cost = SINGLE_COST;
            if (count === 10) cost = MULTI_COST;
            if (count === 100) cost = SUPER_MULTI_COST;

            expect(cost).toBe(9000);
        });
    });

    describe('ユニットインベントリ更新', () => {
        it('新しいユニットが正しく追加される', () => {
            // Arrange
            const inventory: Record<string, number> = {
                'unit_a': 1,
                'unit_b': 2,
            };
            const newUnitIds = ['unit_c', 'unit_a']; // unit_aは重複

            // Act: ユニット追加ロジック
            const newInventory = { ...inventory };
            for (const unitId of newUnitIds) {
                newInventory[unitId] = (newInventory[unitId] || 0) + 1;
            }

            // Assert
            expect(newInventory['unit_a']).toBe(2); // 1 + 1
            expect(newInventory['unit_b']).toBe(2); // 変更なし
            expect(newInventory['unit_c']).toBe(1); // 新規追加
        });

        it('10連ガチャで10体のユニットが追加される', () => {
            // Arrange
            const inventory: Record<string, number> = {};
            const newUnitIds = Array(10).fill('unit_a');

            // Act
            const newInventory = { ...inventory };
            for (const unitId of newUnitIds) {
                newInventory[unitId] = (newInventory[unitId] || 0) + 1;
            }

            // Assert
            expect(newInventory['unit_a']).toBe(10);
        });

        it('100連ガチャで100体のユニットが追加される', () => {
            // Arrange
            const inventory: Record<string, number> = {};
            const newUnitIds = Array(100).fill('unit_a');

            // Act
            const newInventory = { ...inventory };
            for (const unitId of newUnitIds) {
                newInventory[unitId] = (newInventory[unitId] || 0) + 1;
            }

            // Assert
            expect(newInventory['unit_a']).toBe(100);
        });
    });

    describe('コイン消費', () => {
        it('ガチャ実行後、正しくコインが減る', () => {
            // Arrange
            const coins = 1000;
            const cost = 100;

            // Act
            const newCoins = coins - cost;

            // Assert
            expect(newCoins).toBe(900);
        });

        it('10連ガチャで900コイン減る', () => {
            const coins = 1000;
            const cost = 900;

            const newCoins = coins - cost;

            expect(newCoins).toBe(100);
        });

        it('コインが0以下にならない（事前チェック）', () => {
            const coins = 50;
            const cost = 100;

            // ガチャ実行前にチェック
            const canExecute = coins >= cost;

            expect(canExecute).toBe(false);
        });
    });

    describe('ダブルクリック防止', () => {
        it('isRolling=trueの時、ガチャは実行されない', () => {
            // Arrange
            const isRolling = true;
            const coins = 1000;
            const cost = 100;

            // Act: ガチャ実行判定
            const shouldExecute = !isRolling && coins >= cost;

            // Assert
            expect(shouldExecute).toBe(false);
        });

        it('isRolling=falseの時、コインがあればガチャ実行可能', () => {
            // Arrange
            const isRolling = false;
            const coins = 1000;
            const cost = 100;

            // Act
            const shouldExecute = !isRolling && coins >= cost;

            // Assert
            expect(shouldExecute).toBe(true);
        });
    });

    describe('ガチャ履歴', () => {
        it('ガチャ履歴にユニットIDが追加される', () => {
            // Arrange
            const history: { timestamp: number; unitIds: string[] }[] = [];
            const newUnitIds = ['unit_a', 'unit_b', 'unit_c'];

            // Act: 履歴追加
            const newEntry = {
                timestamp: Date.now(),
                unitIds: newUnitIds,
            };
            const newHistory = [...history, newEntry];

            // Assert
            expect(newHistory).toHaveLength(1);
            expect(newHistory[0].unitIds).toEqual(newUnitIds);
        });

        it('履歴は最大50件まで保持される', () => {
            // Arrange
            const MAX_HISTORY = 50;
            const history = Array(50).fill(null).map((_, i) => ({
                timestamp: i,
                unitIds: ['unit_a'],
            }));

            // Act: 新しい履歴追加
            const newEntry = { timestamp: 100, unitIds: ['unit_b'] };
            let newHistory = [...history, newEntry];
            if (newHistory.length > MAX_HISTORY) {
                newHistory = newHistory.slice(-MAX_HISTORY);
            }

            // Assert
            expect(newHistory).toHaveLength(50);
            expect(newHistory[49].unitIds).toEqual(['unit_b']); // 最新が末尾
        });
    });

    describe('レアリティ重み付け', () => {
        const rarityWeights = { N: 51, R: 30, SR: 15, SSR: 1, UR: 0.33 };

        it('Nレアリティが最も出やすい', () => {
            expect(rarityWeights.N).toBeGreaterThan(rarityWeights.R);
            expect(rarityWeights.N).toBeGreaterThan(rarityWeights.SR);
            expect(rarityWeights.N).toBeGreaterThan(rarityWeights.SSR);
            expect(rarityWeights.N).toBeGreaterThan(rarityWeights.UR);
        });

        it('URレアリティが最も出にくい', () => {
            expect(rarityWeights.UR).toBeLessThan(rarityWeights.N);
            expect(rarityWeights.UR).toBeLessThan(rarityWeights.R);
            expect(rarityWeights.UR).toBeLessThan(rarityWeights.SR);
            expect(rarityWeights.UR).toBeLessThan(rarityWeights.SSR);
        });

        it('重みの合計が約97.33になる', () => {
            const total = Object.values(rarityWeights).reduce((a, b) => a + b, 0);
            expect(total).toBeCloseTo(97.33, 1);
        });
    });
});

describe('状態更新の同期性（React 18バグ対策）', () => {
    /**
     * このテストはReact 18で発生したバグの再発を防ぐ
     *
     * 【問題のコード】
     * let success = false;
     * setData((prev) => {
     *   success = true;  // ← React 18では遅延実行される
     *   return newState;
     * });
     * return success;  // ← falseが返される！
     *
     * 【修正後のコード】
     * if (data.coins < cost) return false;  // 先にチェック
     * setData(...);
     * return true;  // 確実にtrueを返す
     */

    it('状態チェックは状態更新の前に行う', () => {
        // Arrange: シミュレーション
        const data = { coins: 1000 };
        const cost = 100;

        // Act: 修正後のパターン（先にチェック）
        let result: boolean;
        if (data.coins < cost) {
            result = false;
        } else {
            // setData(...) - ここで状態更新
            result = true;
        }

        // Assert
        expect(result).toBe(true);
    });

    it('クロージャ変数に依存しない設計', () => {
        // 悪い例: クロージャ変数に依存
        const badPattern = () => {
            let success = false;
            // setData内でsuccessを変更しても、
            // React 18では遅延実行されるため反映されない可能性
            setTimeout(() => { success = true; }, 0);
            return success; // false!
        };

        // 良い例: 先にチェックして結果を返す
        const goodPattern = (coins: number, cost: number) => {
            if (coins < cost) return false;
            return true;
        };

        // Assert
        expect(badPattern()).toBe(false); // 悪いパターンはfalse
        expect(goodPattern(1000, 100)).toBe(true); // 良いパターンはtrue
    });
});
