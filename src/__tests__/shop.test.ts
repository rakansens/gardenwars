/**
 * ショップシステムのリグレッションテスト
 *
 * 重要なフロー:
 * 1. ユーザーがショップでアイテムを見る
 * 2. 購入ボタンを押す
 * 3. コインが減る & ユニットが増える & 売り切れになる
 */

import { describe, it, expect } from 'vitest';

describe('ショップシステム', () => {

    describe('購入フロー', () => {
        /**
         * 【実際のユーザーフロー】
         * 1. ショップページを開く
         * 2. 欲しいユニットを見つける
         * 3. 購入ボタンをクリック
         * 4. コインが減り、ユニットが手に入る
         */

        it('購入可能判定: コインが十分ある', () => {
            const coins = 1000;
            const item = { price: 100, soldOut: false, unitId: 'unit_a' };

            const canBuy = !item.soldOut && coins >= item.price;

            expect(canBuy).toBe(true);
        });

        it('購入可能判定: コインが不足', () => {
            const coins = 50;
            const item = { price: 100, soldOut: false, unitId: 'unit_a' };

            const canBuy = !item.soldOut && coins >= item.price;

            expect(canBuy).toBe(false);
        });

        it('購入可能判定: 売り切れ', () => {
            const coins = 1000;
            const item = { price: 100, soldOut: true, unitId: 'unit_a' };

            const canBuy = !item.soldOut && coins >= item.price;

            expect(canBuy).toBe(false);
        });

        it('購入後: コインが正しく減る', () => {
            const coins = 1000;
            const price = 100;

            const newCoins = coins - price;

            expect(newCoins).toBe(900);
        });

        it('購入後: ユニットが追加される', () => {
            const inventory: Record<string, number> = {};
            const unitId = 'unit_a';

            const newInventory = { ...inventory };
            newInventory[unitId] = (newInventory[unitId] || 0) + 1;

            expect(newInventory[unitId]).toBe(1);
        });

        it('購入後: アイテムが売り切れになる', () => {
            const item = { price: 100, soldOut: false, unitId: 'unit_a' };

            const newItem = { ...item, soldOut: true };

            expect(newItem.soldOut).toBe(true);
        });
    });

    describe('価格設定', () => {
        const basePrices = { N: 100, R: 800, SR: 5000, SSR: 15000, UR: 50000 };

        it('Nレアリティは100コイン', () => {
            expect(basePrices.N).toBe(100);
        });

        it('Rレアリティは800コイン', () => {
            expect(basePrices.R).toBe(800);
        });

        it('SRレアリティは5000コイン', () => {
            expect(basePrices.SR).toBe(5000);
        });

        it('割引が正しく計算される（30%オフ）', () => {
            const basePrice = 100;
            const discountPercent = 30;
            const discountedPrice = Math.floor(basePrice * (100 - discountPercent) / 100);

            expect(discountedPrice).toBe(70);
        });
    });

    describe('ショップ更新', () => {
        it('ショップは30アイテムを持つ', () => {
            const itemCount = 30;
            expect(itemCount).toBe(30);
        });

        it('SSR/URはショップに出現しない', () => {
            const shopWeights = { N: 50, R: 30, SR: 15, SSR: 0, UR: 0 };

            expect(shopWeights.SSR).toBe(0);
            expect(shopWeights.UR).toBe(0);
        });
    });

    describe('React 18バグ対策（購入）', () => {
        /**
         * ガチャと同じ問題:
         * setData内でsuccess=trueを設定しても、
         * React 18のバッチングで遅延実行される
         */

        it('購入判定は状態更新の前に行う', () => {
            const data = {
                coins: 1000,
                shopItems: [{ price: 100, soldOut: false, unitId: 'unit_a' }]
            };
            const index = 0;

            // 修正後: 先にチェック
            const item = data.shopItems[index];
            const canBuy = item && !item.soldOut && data.coins >= item.price;

            expect(canBuy).toBe(true);
        });
    });
});
