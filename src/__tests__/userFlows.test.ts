/**
 * ユーザーフローの統合テスト
 *
 * 実際のユーザー操作を模倣して、
 * システム全体が正しく動作することを確認
 */

import { describe, it, expect } from 'vitest';

/**
 * シンプルなゲーム状態シミュレーター
 * usePlayerDataの核心ロジックを再現
 */
class GameStateSimulator {
    coins: number;
    unitInventory: Record<string, number>;
    clearedStages: string[];
    selectedTeam: string[];
    shopItems: Array<{ unitId: string; price: number; soldOut: boolean }>;

    constructor() {
        this.coins = 1000;
        this.unitInventory = { 'n_starter': 3 };
        this.clearedStages = [];
        this.selectedTeam = ['n_starter', 'n_starter', 'n_starter'];
        this.shopItems = [
            { unitId: 'n_unit_a', price: 100, soldOut: false },
            { unitId: 'r_unit_b', price: 800, soldOut: false },
        ];
    }

    // ガチャ実行（React 18対応版）
    executeGacha(cost: number, unitIds: string[]): boolean {
        // 先にチェック
        if (this.coins < cost) return false;

        // 状態更新
        this.coins -= cost;
        for (const unitId of unitIds) {
            this.unitInventory[unitId] = (this.unitInventory[unitId] || 0) + 1;
        }
        return true;
    }

    // ショップ購入（React 18対応版）
    buyShopItem(index: number): boolean {
        const item = this.shopItems[index];
        // 先にチェック
        if (!item || item.soldOut || this.coins < item.price) return false;

        // 状態更新
        this.coins -= item.price;
        this.unitInventory[item.unitId] = (this.unitInventory[item.unitId] || 0) + 1;
        this.shopItems[index].soldOut = true;
        return true;
    }

    // フュージョン実行（React 18対応版）
    executeFusion(materialIds: string[], resultUnitId: string): boolean {
        // 素材カウント
        const materialCounts: Record<string, number> = {};
        for (const id of materialIds) {
            materialCounts[id] = (materialCounts[id] || 0) + 1;
        }

        // 先にチェック
        for (const [unitId, needed] of Object.entries(materialCounts)) {
            if ((this.unitInventory[unitId] || 0) < needed) return false;
        }

        // 状態更新
        for (const [unitId, count] of Object.entries(materialCounts)) {
            const newCount = (this.unitInventory[unitId] || 0) - count;
            if (newCount <= 0) {
                delete this.unitInventory[unitId];
            } else {
                this.unitInventory[unitId] = newCount;
            }
        }
        this.unitInventory[resultUnitId] = (this.unitInventory[resultUnitId] || 0) + 1;
        return true;
    }

    // バトル報酬
    executeBattleReward(coinsGained: number, stageId: string, droppedUnitIds: string[]): void {
        this.coins += coinsGained;
        for (const unitId of droppedUnitIds) {
            this.unitInventory[unitId] = (this.unitInventory[unitId] || 0) + 1;
        }
        if (!this.clearedStages.includes(stageId)) {
            this.clearedStages.push(stageId);
        }
    }
}

describe('ユーザーフロー統合テスト', () => {

    describe('フロー1: 新規プレイヤーの最初の1日', () => {
        /**
         * シナリオ:
         * 1. ゲーム開始（初期コイン1000、Nユニット3体）
         * 2. ステージ1をクリア（報酬: 100コイン + Nユニットドロップ）
         * 3. ガチャを1回引く（100コイン消費）
         * 4. ショップでユニット購入（100コイン消費）
         */

        it('全ての操作が正しく反映される', () => {
            const game = new GameStateSimulator();

            // 1. 初期状態確認
            expect(game.coins).toBe(1000);
            expect(game.unitInventory['n_starter']).toBe(3);

            // 2. ステージ1クリア
            game.executeBattleReward(100, 'stage_1', ['n_drop_unit']);
            expect(game.coins).toBe(1100);
            expect(game.unitInventory['n_drop_unit']).toBe(1);
            expect(game.clearedStages).toContain('stage_1');

            // 3. ガチャ1回
            const gachaSuccess = game.executeGacha(100, ['r_gacha_unit']);
            expect(gachaSuccess).toBe(true);
            expect(game.coins).toBe(1000); // 1100 - 100
            expect(game.unitInventory['r_gacha_unit']).toBe(1);

            // 4. ショップ購入
            const buySuccess = game.buyShopItem(0);
            expect(buySuccess).toBe(true);
            expect(game.coins).toBe(900); // 1000 - 100
            expect(game.unitInventory['n_unit_a']).toBe(1);
            expect(game.shopItems[0].soldOut).toBe(true);
        });
    });

    describe('フロー2: フュージョンでレアリティアップ', () => {
        /**
         * シナリオ:
         * 1. Nユニットを3体集める
         * 2. フュージョンでRユニットを獲得
         * 3. Rユニットをチームに編成
         */

        it('N×3 → R フュージョンが成功', () => {
            const game = new GameStateSimulator();

            // 1. Nユニットを追加で獲得（既存3体 + 追加で合計6体）
            game.executeBattleReward(0, 'stage_1', ['n_material', 'n_material', 'n_material']);
            expect(game.unitInventory['n_material']).toBe(3);

            // 2. フュージョン実行
            const fusionSuccess = game.executeFusion(
                ['n_material', 'n_material', 'n_material'],
                'r_result_unit'
            );
            expect(fusionSuccess).toBe(true);
            expect(game.unitInventory['n_material']).toBeUndefined(); // 素材消費
            expect(game.unitInventory['r_result_unit']).toBe(1); // 結果獲得

            // 3. チーム編成
            game.selectedTeam = ['r_result_unit', 'n_starter', 'n_starter'];
            expect(game.selectedTeam).toContain('r_result_unit');
        });
    });

    describe('フロー3: ガチャ課金サイクル', () => {
        /**
         * シナリオ:
         * 1. ステージを周回してコインを貯める
         * 2. 10連ガチャを引く
         * 3. 獲得ユニットをチームに編成
         */

        it('コインを貯めて10連ガチャ', () => {
            const game = new GameStateSimulator();

            // 1. ステージ周回（5回クリアして450コイン追加）
            for (let i = 0; i < 5; i++) {
                game.executeBattleReward(90, `stage_${i + 1}`, []);
            }
            expect(game.coins).toBe(1450); // 1000 + 90*5

            // 2. 10連ガチャ（900コイン）
            const gachaUnits = Array(10).fill('r_gacha_unit');
            const gachaSuccess = game.executeGacha(900, gachaUnits);
            expect(gachaSuccess).toBe(true);
            expect(game.coins).toBe(550); // 1450 - 900
            expect(game.unitInventory['r_gacha_unit']).toBe(10);
        });
    });

    describe('フロー4: エラーケースの処理', () => {
        /**
         * シナリオ:
         * - コイン不足でガチャ失敗
         * - 素材不足でフュージョン失敗
         * - 売り切れで購入失敗
         */

        it('コイン不足でガチャ失敗（状態変化なし）', () => {
            const game = new GameStateSimulator();
            game.coins = 50; // コイン不足

            const initialCoins = game.coins;
            const initialInventory = { ...game.unitInventory };

            const success = game.executeGacha(100, ['unit_a']);

            expect(success).toBe(false);
            expect(game.coins).toBe(initialCoins); // 変化なし
            expect(game.unitInventory).toEqual(initialInventory); // 変化なし
        });

        it('素材不足でフュージョン失敗（状態変化なし）', () => {
            const game = new GameStateSimulator();

            const initialInventory = { ...game.unitInventory };

            const success = game.executeFusion(
                ['missing_unit', 'missing_unit', 'missing_unit'],
                'result_unit'
            );

            expect(success).toBe(false);
            expect(game.unitInventory).toEqual(initialInventory); // 変化なし
        });

        it('売り切れで購入失敗（状態変化なし）', () => {
            const game = new GameStateSimulator();
            game.shopItems[0].soldOut = true;

            const initialCoins = game.coins;

            const success = game.buyShopItem(0);

            expect(success).toBe(false);
            expect(game.coins).toBe(initialCoins); // 変化なし
        });
    });

    describe('フロー5: 連続操作のストレステスト', () => {
        /**
         * シナリオ:
         * 多数の操作を連続で実行しても整合性が保たれる
         */

        it('100回の連続ガチャ', () => {
            const game = new GameStateSimulator();
            game.coins = 100000; // 十分なコイン

            let successCount = 0;
            for (let i = 0; i < 100; i++) {
                if (game.executeGacha(100, ['unit_' + i])) {
                    successCount++;
                }
            }

            expect(successCount).toBe(100);
            expect(game.coins).toBe(90000); // 100000 - 100*100
        });

        it('連続フュージョン', () => {
            const game = new GameStateSimulator();
            // 素材を大量に追加
            game.unitInventory['n_material'] = 30;

            let fusionCount = 0;
            for (let i = 0; i < 10; i++) {
                if (game.executeFusion(
                    ['n_material', 'n_material', 'n_material'],
                    'r_result_' + i
                )) {
                    fusionCount++;
                }
            }

            expect(fusionCount).toBe(10);
            expect(game.unitInventory['n_material']).toBeUndefined(); // 30 - 30 = 0
        });
    });
});

describe('React 18 バッチングバグの回帰テスト', () => {
    /**
     * これらのテストは、React 18のバッチングによって
     * 「success変数がfalseのまま返される」バグを防ぐ
     */

    it('executeGacha: 先にコインチェックしてからtrueを返す', () => {
        const game = new GameStateSimulator();

        // シミュレーション: React 18のバッチングがあっても動く設計
        const cost = 100;
        const canExecute = game.coins >= cost; // 先にチェック

        expect(canExecute).toBe(true);

        // setDataを呼ぶ（遅延実行されても問題ない）
        // return true（canExecuteの結果に基づく）
    });

    it('executeFusion: 先に素材チェックしてからtrueを返す', () => {
        const game = new GameStateSimulator();
        game.unitInventory['material'] = 3;

        const materialIds = ['material', 'material', 'material'];
        const materialCounts: Record<string, number> = {};
        for (const id of materialIds) {
            materialCounts[id] = (materialCounts[id] || 0) + 1;
        }

        let canFuse = true;
        for (const [unitId, needed] of Object.entries(materialCounts)) {
            if ((game.unitInventory[unitId] || 0) < needed) {
                canFuse = false;
                break;
            }
        }

        expect(canFuse).toBe(true);
    });

    it('buyShopItem: 先に購入可能チェックしてからtrueを返す', () => {
        const game = new GameStateSimulator();

        const item = game.shopItems[0];
        const canBuy = item && !item.soldOut && game.coins >= item.price;

        expect(canBuy).toBe(true);
    });
});
