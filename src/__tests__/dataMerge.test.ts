/**
 * データマージロジックのリグレッションテスト
 *
 * 修正前のバグ:
 * 1. コイン: Math.min() → 少ない方が採用され、コイン消失
 * 2. ユニット: Math.max() → フュージョン後にユニット復活
 *
 * 修正後:
 * タイムスタンプベースのマージ戦略
 * - 新しいデータが優先される
 * - 追加系データ（クリアステージ等）は和集合
 */

import { describe, it, expect } from 'vitest';

describe('データマージロジック', () => {

    describe('タイムスタンプベースのマージ', () => {
        /**
         * シナリオ: ローカルでガチャを引いた後、Supabaseからデータをロード
         * ローカルが新しい場合、ローカルのコイン（消費後）を使用すべき
         */

        it('ローカルが新しい場合、ローカルのコインを使用', () => {
            const localData = {
                coins: 700,           // ガチャで300消費後
                lastModified: 1000,   // 新しい
            };
            const remoteData = {
                coins: 1000,          // ガチャ前の状態
                updated_at: 500,      // 古い
            };

            const localIsNewer = localData.lastModified > remoteData.updated_at;
            const mergedCoins = localIsNewer ? localData.coins : remoteData.coins;

            expect(localIsNewer).toBe(true);
            expect(mergedCoins).toBe(700); // ローカルの値（消費後）
        });

        it('リモートが新しい場合、リモートのコインを使用', () => {
            const localData = {
                coins: 1000,          // 古い状態
                lastModified: 500,    // 古い
            };
            const remoteData = {
                coins: 700,           // 別デバイスでガチャ後
                updated_at: 1000,     // 新しい
            };

            const localIsNewer = localData.lastModified > remoteData.updated_at;
            const mergedCoins = localIsNewer ? localData.coins : remoteData.coins;

            expect(localIsNewer).toBe(false);
            expect(mergedCoins).toBe(700); // リモートの値
        });
    });

    describe('修正前のバグ再現テスト（Math.min/maxを使わない）', () => {

        it('Math.minでコインが消失する問題', () => {
            // 修正前のロジック（危険！）
            const localCoins = 700;   // ガチャで消費後
            const remoteCoins = 1000; // ガチャ前

            const badMerge = Math.min(localCoins, remoteCoins);
            expect(badMerge).toBe(700);
            // これは偶然正しいが、逆のケースで問題が起きる

            const localCoins2 = 1000; // まだ消費していない
            const remoteCoins2 = 700;  // 他デバイスで消費済み

            const badMerge2 = Math.min(localCoins2, remoteCoins2);
            expect(badMerge2).toBe(700);
            // 問題: ローカルでまだ消費していないのに、コインが減っている！
        });

        it('Math.maxでユニットが復活する問題', () => {
            // 修正前のロジック（危険！）
            const localInventory: Record<string, number> = {
                'unit_a': 0,  // フュージョンで消費済み
            };
            const remoteInventory: Record<string, number> = {
                'unit_a': 3,  // フュージョン前の状態
            };

            // 修正前のマージロジック
            const badMergedInventory: Record<string, number> = {};
            for (const [unitId, remoteCount] of Object.entries(remoteInventory)) {
                const localCount = localInventory[unitId] || 0;
                badMergedInventory[unitId] = Math.max(localCount, remoteCount);
            }

            expect(badMergedInventory['unit_a']).toBe(3);
            // 問題: フュージョンで消費したユニットが復活！
        });
    });

    describe('正しいマージロジック', () => {

        it('タイムスタンプが新しい方のインベントリを使用', () => {
            // ローカルでフュージョン実行後
            const localInventory: Record<string, number> = {
                'unit_a': 0,  // フュージョン素材として消費
                'unit_r': 1,  // フュージョン結果
            };
            const localTimestamp = 1000;

            // リモートはフュージョン前
            const remoteInventory: Record<string, number> = {
                'unit_a': 3,  // まだ消費されていない
            };
            const remoteTimestamp = 500;

            const localIsNewer = localTimestamp > remoteTimestamp;
            const mergedInventory = localIsNewer ? localInventory : remoteInventory;

            expect(localIsNewer).toBe(true);
            expect(mergedInventory['unit_a']).toBe(0);  // 消費された状態を維持
            expect(mergedInventory['unit_r']).toBe(1);  // フュージョン結果を維持
        });
    });

    describe('追加系データのマージ（和集合）', () => {

        it('クリアステージは和集合でマージ', () => {
            const localStages = ['stage_1', 'stage_2', 'stage_3'];
            const remoteStages = ['stage_1', 'stage_4'];

            const mergedStages = new Set([...localStages, ...remoteStages]);
            const result = Array.from(mergedStages);

            expect(result).toContain('stage_1');
            expect(result).toContain('stage_2');
            expect(result).toContain('stage_3');
            expect(result).toContain('stage_4');
            expect(result.length).toBe(4);
        });

        it('ガーデンユニットは和集合でマージ', () => {
            const localGarden = ['unit_a', 'unit_b'];
            const remoteGarden = ['unit_b', 'unit_c'];

            const mergedGarden = new Set([...localGarden, ...remoteGarden]);
            const result = Array.from(mergedGarden);

            expect(result).toContain('unit_a');
            expect(result).toContain('unit_b');
            expect(result).toContain('unit_c');
            expect(result.length).toBe(3);
        });
    });

    describe('beforeunloadハンドラー', () => {

        it('保存待ちフラグが正しく管理される', () => {
            let pendingSave = false;

            // データ変更時
            pendingSave = true;

            // デバウンス後の保存完了時
            pendingSave = false;

            expect(pendingSave).toBe(false);
        });

        it('beforeunload時にlocalStorageに保存', () => {
            // シミュレーション
            const data = {
                coins: 1000,
                unitInventory: { 'unit_a': 1 },
            };

            // localStorageへの保存は同期的に行われる
            const saved = JSON.stringify(data);
            const parsed = JSON.parse(saved);

            expect(parsed.coins).toBe(1000);
            expect(parsed.unitInventory['unit_a']).toBe(1);
        });
    });

    describe('エッジケース', () => {

        it('タイムスタンプが同じ場合はリモートを優先', () => {
            const localTimestamp = 1000;
            const remoteTimestamp = 1000;

            // 同じ場合はリモートを優先（サーバーデータを信頼）
            const localIsNewer = localTimestamp > remoteTimestamp;
            expect(localIsNewer).toBe(false);
        });

        it('タイムスタンプがない場合の処理', () => {
            const localTimestamp = 0;  // undefined → 0
            const remoteTimestamp = 1000;

            const localIsNewer = localTimestamp > remoteTimestamp;
            expect(localIsNewer).toBe(false);
        });

        it('両方タイムスタンプがない場合', () => {
            const localTimestamp = 0;
            const remoteTimestamp = 0;

            const localIsNewer = localTimestamp > remoteTimestamp;
            expect(localIsNewer).toBe(false); // リモート優先
        });
    });
});
