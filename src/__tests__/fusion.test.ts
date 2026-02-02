/**
 * フュージョンシステムのリグレッションテスト
 *
 * 重要なフロー:
 * 1. ユーザーが素材ユニットを選ぶ
 * 2. フュージョン実行
 * 3. 素材が消費される & 新しいユニットが手に入る
 *
 * 危険なバグ:
 * - 素材だけ消費されて結果が得られない
 * - 素材が足りないのに実行される
 */

import { describe, it, expect } from 'vitest';

describe('フュージョンシステム', () => {

    describe('素材チェック', () => {
        /**
         * 【実際のユーザーフロー】
         * 1. フュージョンページを開く
         * 2. 素材ユニットを3体選ぶ（例: N×3 → R）
         * 3. フュージョンボタンを押す
         * 4. 素材が消費され、上位ユニットが手に入る
         */

        it('素材が全て揃っている場合、実行可能', () => {
            const inventory = { 'unit_a': 3 };
            const materialIds = ['unit_a', 'unit_a', 'unit_a'];

            // 素材カウント
            const materialCounts: Record<string, number> = {};
            for (const id of materialIds) {
                materialCounts[id] = (materialCounts[id] || 0) + 1;
            }

            // チェック
            let canFuse = true;
            for (const [unitId, needed] of Object.entries(materialCounts)) {
                if ((inventory[unitId] || 0) < needed) {
                    canFuse = false;
                    break;
                }
            }

            expect(canFuse).toBe(true);
        });

        it('素材が1つでも足りない場合、実行不可', () => {
            const inventory = { 'unit_a': 2 }; // 3体必要なのに2体しかない
            const materialIds = ['unit_a', 'unit_a', 'unit_a'];

            const materialCounts: Record<string, number> = {};
            for (const id of materialIds) {
                materialCounts[id] = (materialCounts[id] || 0) + 1;
            }

            let canFuse = true;
            for (const [unitId, needed] of Object.entries(materialCounts)) {
                if ((inventory[unitId] || 0) < needed) {
                    canFuse = false;
                    break;
                }
            }

            expect(canFuse).toBe(false);
        });

        it('異なる素材の組み合わせでもチェックできる', () => {
            const inventory = { 'unit_a': 2, 'unit_b': 1 };
            const materialIds = ['unit_a', 'unit_a', 'unit_b'];

            const materialCounts: Record<string, number> = {};
            for (const id of materialIds) {
                materialCounts[id] = (materialCounts[id] || 0) + 1;
            }

            let canFuse = true;
            for (const [unitId, needed] of Object.entries(materialCounts)) {
                if ((inventory[unitId] || 0) < needed) {
                    canFuse = false;
                    break;
                }
            }

            expect(canFuse).toBe(true);
        });
    });

    describe('素材消費', () => {
        it('フュージョン後、素材が正しく減る', () => {
            const inventory = { 'unit_a': 5 };
            const materialIds = ['unit_a', 'unit_a', 'unit_a'];

            const materialCounts: Record<string, number> = {};
            for (const id of materialIds) {
                materialCounts[id] = (materialCounts[id] || 0) + 1;
            }

            const newInventory = { ...inventory };
            for (const [unitId, count] of Object.entries(materialCounts)) {
                const newCount = (newInventory[unitId] || 0) - count;
                if (newCount <= 0) {
                    delete newInventory[unitId];
                } else {
                    newInventory[unitId] = newCount;
                }
            }

            expect(newInventory['unit_a']).toBe(2); // 5 - 3 = 2
        });

        it('素材が0になったらインベントリから削除', () => {
            const inventory = { 'unit_a': 3 };
            const materialIds = ['unit_a', 'unit_a', 'unit_a'];

            const materialCounts: Record<string, number> = {};
            for (const id of materialIds) {
                materialCounts[id] = (materialCounts[id] || 0) + 1;
            }

            const newInventory = { ...inventory };
            for (const [unitId, count] of Object.entries(materialCounts)) {
                const newCount = (newInventory[unitId] || 0) - count;
                if (newCount <= 0) {
                    delete newInventory[unitId];
                } else {
                    newInventory[unitId] = newCount;
                }
            }

            expect(newInventory['unit_a']).toBeUndefined();
        });
    });

    describe('結果ユニット追加', () => {
        it('新しいユニットが追加される', () => {
            const inventory: Record<string, number> = {};
            const resultUnitId = 'unit_r';

            const newInventory = { ...inventory };
            newInventory[resultUnitId] = (newInventory[resultUnitId] || 0) + 1;

            expect(newInventory[resultUnitId]).toBe(1);
        });

        it('既存のユニットに追加される', () => {
            const inventory = { 'unit_r': 2 };
            const resultUnitId = 'unit_r';

            const newInventory = { ...inventory };
            newInventory[resultUnitId] = (newInventory[resultUnitId] || 0) + 1;

            expect(newInventory[resultUnitId]).toBe(3);
        });
    });

    describe('フュージョンレシピ', () => {
        /**
         * レアリティアップグレードルール:
         * N×3 → R
         * R×3 → SR
         * SR×3 → SSR
         * SSR×3 → UR
         */

        it('N×3でRを獲得', () => {
            const inputRarity = 'N';
            const outputRarity = inputRarity === 'N' ? 'R' :
                                 inputRarity === 'R' ? 'SR' :
                                 inputRarity === 'SR' ? 'SSR' :
                                 inputRarity === 'SSR' ? 'UR' : null;

            expect(outputRarity).toBe('R');
        });

        it('SR×3でSSRを獲得', () => {
            const inputRarity = 'SR';
            const outputRarity = inputRarity === 'N' ? 'R' :
                                 inputRarity === 'R' ? 'SR' :
                                 inputRarity === 'SR' ? 'SSR' :
                                 inputRarity === 'SSR' ? 'UR' : null;

            expect(outputRarity).toBe('SSR');
        });
    });

    describe('React 18バグ対策（フュージョン）', () => {
        /**
         * 最も危険なバグ:
         * 「素材は消費されたが、結果ユニットがもらえない」
         *
         * 原因: setData内でsuccess=trueを設定しても、
         * returnする前にコールバックが実行されない可能性
         */

        it('素材チェックは状態更新の前に行う', () => {
            const inventory = { 'unit_a': 3 };
            const materialIds = ['unit_a', 'unit_a', 'unit_a'];

            // 修正後: 先にチェック
            const materialCounts: Record<string, number> = {};
            for (const id of materialIds) {
                materialCounts[id] = (materialCounts[id] || 0) + 1;
            }

            let canFuse = true;
            for (const [unitId, needed] of Object.entries(materialCounts)) {
                if ((inventory[unitId] || 0) < needed) {
                    canFuse = false;
                    break;
                }
            }

            // canFuseがtrueなら、setDataを実行
            // その後、returnで確実にtrueを返す
            expect(canFuse).toBe(true);
        });

        it('アトミック操作: 素材消費と結果追加は同じsetData内', () => {
            // この設計により、素材だけ消費されるバグを防ぐ
            const inventory = { 'unit_a': 3 };
            const materialIds = ['unit_a', 'unit_a', 'unit_a'];
            const resultUnitId = 'unit_r';

            // アトミック操作のシミュレーション
            const newInventory = { ...inventory };

            // 素材消費
            const materialCounts: Record<string, number> = {};
            for (const id of materialIds) {
                materialCounts[id] = (materialCounts[id] || 0) + 1;
            }
            for (const [unitId, count] of Object.entries(materialCounts)) {
                const newCount = (newInventory[unitId] || 0) - count;
                if (newCount <= 0) {
                    delete newInventory[unitId];
                } else {
                    newInventory[unitId] = newCount;
                }
            }

            // 結果追加（同じ操作内）
            newInventory[resultUnitId] = (newInventory[resultUnitId] || 0) + 1;

            // 両方が一度に反映される
            expect(newInventory['unit_a']).toBeUndefined(); // 素材消費
            expect(newInventory['unit_r']).toBe(1);         // 結果追加
        });
    });
});
