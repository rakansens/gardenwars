/**
 * ランキングシステムの信頼性テスト
 *
 * このテストは以下のシナリオをカバー:
 * 1. Rankings Entry Creation - 新規プレイヤーのランキングエントリ作成
 * 2. Battle Stats Updates - バトル統計の更新
 * 3. Gacha Count Updates - ガチャカウントの更新
 * 4. Sync Rankings Stats - ランキング統計の同期
 * 5. Error Handling - エラーハンドリング
 *
 * NOTE: 実際の実装はサーバー権威モード（RPC）を使用:
 * - incrementBattleStatsRpc (serverAuthority.ts)
 * - incrementGachaCountRpc (serverAuthority.ts)
 * - incrementGardenVisitsRpc (serverAuthority.ts)
 * このテストはビジネスロジックの検証用シミュレーター
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// ランキングシステムシミュレーター
// =============================================================================

/**
 * Supabase rankingsテーブルの動作をシミュレートするクラス
 * playerData.tsのランキング関数の動作を再現
 */
class RankingsSimulator {
    // ランキングデータストア (player_id -> RankingData)
    rankings: Map<string, RankingData>;

    // ネットワーク障害シミュレーション
    networkFailure: boolean;

    constructor() {
        this.rankings = new Map();
        this.networkFailure = false;
    }

    /**
     * ランキングエントリが存在するか確認し、なければ作成
     * ensureRankingsExist のシミュレーション
     */
    ensureRankingsExist(playerId: string): boolean {
        if (this.networkFailure) {
            console.error("Failed to check rankings existence: network error");
            return false;
        }

        if (!this.rankings.has(playerId)) {
            this.rankings.set(playerId, createDefaultRankingData(playerId));
        }

        return true;
    }

    /**
     * ランキングを更新 (upsertで行がなければ作成)
     * updateRankings のシミュレーション
     */
    updateRankings(playerId: string, data: Partial<RankingData>): boolean {
        if (this.networkFailure) {
            console.error("Failed to update rankings: network error");
            return false;
        }

        // upsert動作: 存在しなければ作成
        let current = this.rankings.get(playerId);
        if (!current) {
            current = createDefaultRankingData(playerId);
        }

        // データをマージ
        const updated = {
            ...current,
            ...data,
            updated_at: new Date().toISOString(),
        };

        this.rankings.set(playerId, updated);
        return true;
    }

    /**
     * バトル統計をインクリメント
     * incrementBattleStats のシミュレーション
     */
    incrementBattleStats(playerId: string, won: boolean, stageNum?: number): boolean {
        if (this.networkFailure) {
            return false;
        }

        const rankings = this.rankings.get(playerId);
        if (!rankings) {
            return false;
        }

        const totalBattles = rankings.total_battles ?? 0;
        const totalWins = rankings.total_wins ?? 0;
        const maxStage = rankings.max_stage ?? 0;
        const currentStreak = rankings.win_streak ?? 0;
        const maxStreak = rankings.max_win_streak ?? 0;

        const updates: Partial<RankingData> = {
            total_battles: totalBattles + 1,
        };

        if (won) {
            updates.total_wins = totalWins + 1;
            // 連勝記録を更新
            const newStreak = currentStreak + 1;
            updates.win_streak = newStreak;
            if (newStreak > maxStreak) {
                updates.max_win_streak = newStreak;
            }
            if (stageNum !== undefined && stageNum > maxStage) {
                updates.max_stage = stageNum;
            }
        } else {
            // 負けたら連勝リセット
            updates.win_streak = 0;
        }

        return this.updateRankings(playerId, updates);
    }

    /**
     * ガチャカウントをインクリメント
     * incrementGachaCount のシミュレーション
     */
    incrementGachaCount(playerId: string, count: number = 1): boolean {
        if (this.networkFailure) {
            return false;
        }

        const rankings = this.rankings.get(playerId);
        if (!rankings) {
            return false;
        }

        const currentCount = rankings.gacha_count ?? 0;
        return this.updateRankings(playerId, { gacha_count: currentCount + count });
    }

    /**
     * コレクションとコイン統計を同期
     * syncRankingStats のシミュレーション
     */
    syncRankingStats(
        playerId: string,
        coins: number,
        unitInventory: Record<string, number>,
        clearedStages?: string[]
    ): boolean {
        if (this.networkFailure) {
            return false;
        }

        const collectionCount = Object.keys(unitInventory).length;
        const totalUnits = Object.values(unitInventory).reduce((sum, count) => sum + count, 0);
        // URユニット数をカウント（IDに"ur_"を含むもの）
        const urUnitCount = Object.keys(unitInventory).filter(id =>
            id.startsWith("ur_") && unitInventory[id] > 0
        ).length;

        const updates: Partial<RankingData> = {
            total_coins: coins,
            collection_count: collectionCount,
            total_units: totalUnits,
            ur_unit_count: urUnitCount,
        };

        if (clearedStages !== undefined) {
            updates.stages_cleared = clearedStages.length;
        }

        return this.updateRankings(playerId, updates);
    }

    /**
     * ランキングデータを取得
     */
    getRankings(playerId: string): RankingData | null {
        if (this.networkFailure) {
            return null;
        }
        return this.rankings.get(playerId) || null;
    }
}

/**
 * ランキングデータの型定義
 */
interface RankingData {
    player_id: string;
    max_stage: number;
    total_wins: number;
    total_battles: number;
    total_coins: number;
    collection_count: number;
    total_units: number;
    ur_unit_count: number;
    gacha_count: number;
    garden_visits: number;
    stages_cleared: number;
    win_streak: number;
    max_win_streak: number;
    updated_at: string;
}

/**
 * デフォルトのランキングデータを作成
 */
function createDefaultRankingData(playerId: string): RankingData {
    return {
        player_id: playerId,
        max_stage: 0,
        total_wins: 0,
        total_battles: 0,
        total_coins: 0,
        collection_count: 0,
        total_units: 0,
        ur_unit_count: 0,
        gacha_count: 0,
        garden_visits: 0,
        stages_cleared: 0,
        win_streak: 0,
        max_win_streak: 0,
        updated_at: new Date().toISOString(),
    };
}

// =============================================================================
// テスト
// =============================================================================

describe('ランキングシステム', () => {

    describe('1. Rankings Entry Creation', () => {

        it('新規プレイヤーにランキングエントリが作成される', () => {
            const sim = new RankingsSimulator();
            const playerId = 'new-player-123';

            const success = sim.ensureRankingsExist(playerId);

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings).not.toBeNull();
            expect(rankings?.player_id).toBe(playerId);
            expect(rankings?.max_stage).toBe(0);
            expect(rankings?.total_wins).toBe(0);
            expect(rankings?.total_battles).toBe(0);
        });

        it('初回更新時にランキングエントリが自動作成される (upsert)', () => {
            const sim = new RankingsSimulator();
            const playerId = 'new-player-456';

            // ランキングエントリがない状態で更新を試みる
            expect(sim.getRankings(playerId)).toBeNull();

            // updateRankingsはupsertで行がなければ作成する
            const success = sim.updateRankings(playerId, { total_coins: 1000 });

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings).not.toBeNull();
            expect(rankings?.total_coins).toBe(1000);
        });

        it('既存プレイヤーのensureRankingsExistは何もしない', () => {
            const sim = new RankingsSimulator();
            const playerId = 'existing-player';

            // 最初にエントリを作成
            sim.ensureRankingsExist(playerId);
            sim.updateRankings(playerId, { total_wins: 10 });

            // 再度ensureを呼んでもデータは上書きされない
            const success = sim.ensureRankingsExist(playerId);

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings?.total_wins).toBe(10);
        });
    });

    describe('2. Battle Stats Updates', () => {

        let sim: RankingsSimulator;
        const playerId = 'battle-test-player';

        beforeEach(() => {
            sim = new RankingsSimulator();
            sim.ensureRankingsExist(playerId);
        });

        it('勝利時にtotal_winsとtotal_battlesが増加する', () => {
            const success = sim.incrementBattleStats(playerId, true);

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings?.total_wins).toBe(1);
            expect(rankings?.total_battles).toBe(1);
        });

        it('敗北時はtotal_battlesのみ増加する', () => {
            const success = sim.incrementBattleStats(playerId, false);

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings?.total_wins).toBe(0);
            expect(rankings?.total_battles).toBe(1);
        });

        it('連勝が正しく追跡される', () => {
            // 3連勝
            sim.incrementBattleStats(playerId, true);
            sim.incrementBattleStats(playerId, true);
            sim.incrementBattleStats(playerId, true);

            let rankings = sim.getRankings(playerId);
            expect(rankings?.win_streak).toBe(3);
            expect(rankings?.max_win_streak).toBe(3);

            // 敗北で連勝リセット
            sim.incrementBattleStats(playerId, false);

            rankings = sim.getRankings(playerId);
            expect(rankings?.win_streak).toBe(0);
            expect(rankings?.max_win_streak).toBe(3); // 最大連勝は保持

            // また2連勝
            sim.incrementBattleStats(playerId, true);
            sim.incrementBattleStats(playerId, true);

            rankings = sim.getRankings(playerId);
            expect(rankings?.win_streak).toBe(2);
            expect(rankings?.max_win_streak).toBe(3); // 最大連勝は更新されない
        });

        it('max_win_streakが更新される', () => {
            // 5連勝で新記録
            for (let i = 0; i < 5; i++) {
                sim.incrementBattleStats(playerId, true);
            }

            let rankings = sim.getRankings(playerId);
            expect(rankings?.win_streak).toBe(5);
            expect(rankings?.max_win_streak).toBe(5);

            // リセット後、6連勝で更新
            sim.incrementBattleStats(playerId, false);
            for (let i = 0; i < 6; i++) {
                sim.incrementBattleStats(playerId, true);
            }

            rankings = sim.getRankings(playerId);
            expect(rankings?.win_streak).toBe(6);
            expect(rankings?.max_win_streak).toBe(6);
        });

        it('より高いステージをクリアした時にmax_stageが更新される', () => {
            sim.incrementBattleStats(playerId, true, 5);

            let rankings = sim.getRankings(playerId);
            expect(rankings?.max_stage).toBe(5);

            // より高いステージ
            sim.incrementBattleStats(playerId, true, 10);

            rankings = sim.getRankings(playerId);
            expect(rankings?.max_stage).toBe(10);

            // 低いステージでは更新されない
            sim.incrementBattleStats(playerId, true, 3);

            rankings = sim.getRankings(playerId);
            expect(rankings?.max_stage).toBe(10);
        });

        it('敗北時はmax_stageが更新されない', () => {
            sim.incrementBattleStats(playerId, true, 5);
            sim.incrementBattleStats(playerId, false, 10); // 敗北

            const rankings = sim.getRankings(playerId);
            expect(rankings?.max_stage).toBe(5);
        });

        it('複数回のバトルで統計が正しく累積する', () => {
            // 10勝5敗
            for (let i = 0; i < 10; i++) {
                sim.incrementBattleStats(playerId, true);
            }
            for (let i = 0; i < 5; i++) {
                sim.incrementBattleStats(playerId, false);
            }

            const rankings = sim.getRankings(playerId);
            expect(rankings?.total_wins).toBe(10);
            expect(rankings?.total_battles).toBe(15);
        });
    });

    describe('3. Gacha Count Updates', () => {

        let sim: RankingsSimulator;
        const playerId = 'gacha-test-player';

        beforeEach(() => {
            sim = new RankingsSimulator();
            sim.ensureRankingsExist(playerId);
        });

        it('単発ガチャで1増加する', () => {
            const success = sim.incrementGachaCount(playerId, 1);

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings?.gacha_count).toBe(1);
        });

        it('10連ガチャで10増加する', () => {
            const success = sim.incrementGachaCount(playerId, 10);

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings?.gacha_count).toBe(10);
        });

        it('100連ガチャで100増加する', () => {
            const success = sim.incrementGachaCount(playerId, 100);

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings?.gacha_count).toBe(100);
        });

        it('複数回のガチャで累積する', () => {
            sim.incrementGachaCount(playerId, 1);
            sim.incrementGachaCount(playerId, 10);
            sim.incrementGachaCount(playerId, 100);

            const rankings = sim.getRankings(playerId);
            expect(rankings?.gacha_count).toBe(111);
        });

        it('デフォルトでcount=1が使用される', () => {
            sim.incrementGachaCount(playerId);
            sim.incrementGachaCount(playerId);
            sim.incrementGachaCount(playerId);

            const rankings = sim.getRankings(playerId);
            expect(rankings?.gacha_count).toBe(3);
        });
    });

    describe('4. Sync Rankings Stats', () => {

        let sim: RankingsSimulator;
        const playerId = 'sync-test-player';

        beforeEach(() => {
            sim = new RankingsSimulator();
            sim.ensureRankingsExist(playerId);
        });

        it('total_coinsが同期される', () => {
            const success = sim.syncRankingStats(playerId, 5000, {});

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings?.total_coins).toBe(5000);
        });

        it('collection_count (ユニークユニット数) が正しく計算される', () => {
            const unitInventory = {
                'n_unit_a': 3,
                'r_unit_b': 2,
                'sr_unit_c': 1,
            };

            const success = sim.syncRankingStats(playerId, 1000, unitInventory);

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings?.collection_count).toBe(3); // 3種類
        });

        it('total_units (重複含む総ユニット数) が正しく計算される', () => {
            const unitInventory = {
                'n_unit_a': 3,
                'r_unit_b': 2,
                'sr_unit_c': 1,
            };

            const success = sim.syncRankingStats(playerId, 1000, unitInventory);

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings?.total_units).toBe(6); // 3 + 2 + 1
        });

        it('ur_unit_countが正しく計算される', () => {
            const unitInventory = {
                'n_unit_a': 5,
                'r_unit_b': 3,
                'ur_dragon': 2,
                'ur_phoenix': 1,
                'ssr_tiger': 1,
            };

            const success = sim.syncRankingStats(playerId, 1000, unitInventory);

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings?.ur_unit_count).toBe(2); // ur_dragon, ur_phoenix
        });

        it('stages_clearedが正しく計算される', () => {
            const clearedStages = ['stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5'];

            const success = sim.syncRankingStats(playerId, 1000, {}, clearedStages);

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings?.stages_cleared).toBe(5);
        });

        it('空のインベントリでも正しく動作する', () => {
            const success = sim.syncRankingStats(playerId, 0, {});

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings?.total_coins).toBe(0);
            expect(rankings?.collection_count).toBe(0);
            expect(rankings?.total_units).toBe(0);
            expect(rankings?.ur_unit_count).toBe(0);
        });

        it('URユニットの所持数が0の場合はカウントされない', () => {
            const unitInventory = {
                'n_unit_a': 5,
                'ur_dragon': 0, // 所持数0
            };

            const success = sim.syncRankingStats(playerId, 1000, unitInventory);

            expect(success).toBe(true);
            const rankings = sim.getRankings(playerId);
            expect(rankings?.ur_unit_count).toBe(0);
        });

        it('複数回の同期で値が更新される', () => {
            sim.syncRankingStats(playerId, 1000, { 'n_unit': 1 });
            sim.syncRankingStats(playerId, 2000, { 'n_unit': 1, 'r_unit': 1 });
            sim.syncRankingStats(playerId, 3000, { 'n_unit': 1, 'r_unit': 1, 'ur_unit': 1 });

            const rankings = sim.getRankings(playerId);
            expect(rankings?.total_coins).toBe(3000);
            expect(rankings?.collection_count).toBe(3);
            expect(rankings?.total_units).toBe(3);
            expect(rankings?.ur_unit_count).toBe(1);
        });
    });

    describe('5. Error Handling', () => {

        it('ネットワーク障害時に更新がスローしない', () => {
            const sim = new RankingsSimulator();
            const playerId = 'error-test-player';
            sim.ensureRankingsExist(playerId);

            // ネットワーク障害を発生させる
            sim.networkFailure = true;

            // これらの操作はエラーをスローせず、falseを返す
            expect(() => {
                const result = sim.incrementBattleStats(playerId, true);
                expect(result).toBe(false);
            }).not.toThrow();

            expect(() => {
                const result = sim.incrementGachaCount(playerId, 10);
                expect(result).toBe(false);
            }).not.toThrow();

            expect(() => {
                const result = sim.syncRankingStats(playerId, 1000, {});
                expect(result).toBe(false);
            }).not.toThrow();
        });

        it('存在しないランキング行が適切に処理される', () => {
            const sim = new RankingsSimulator();
            const playerId = 'non-existent-player';

            // ランキングエントリがない状態で更新を試みる
            // incrementBattleStatsは行がなければfalseを返す
            const result = sim.incrementBattleStats(playerId, true);

            expect(result).toBe(false);
        });

        it('ネットワーク復旧後に更新が成功する', () => {
            const sim = new RankingsSimulator();
            const playerId = 'recovery-test-player';
            sim.ensureRankingsExist(playerId);

            // ネットワーク障害
            sim.networkFailure = true;
            const failResult = sim.incrementBattleStats(playerId, true);
            expect(failResult).toBe(false);

            // ネットワーク復旧
            sim.networkFailure = false;
            const successResult = sim.incrementBattleStats(playerId, true);
            expect(successResult).toBe(true);

            const rankings = sim.getRankings(playerId);
            expect(rankings?.total_wins).toBe(1);
        });

        it('ensureRankingsExistがネットワーク障害時にfalseを返す', () => {
            const sim = new RankingsSimulator();
            sim.networkFailure = true;

            const result = sim.ensureRankingsExist('new-player');

            expect(result).toBe(false);
        });

        it('getRankingsがネットワーク障害時にnullを返す', () => {
            const sim = new RankingsSimulator();
            const playerId = 'get-test-player';
            sim.ensureRankingsExist(playerId);

            sim.networkFailure = true;
            const result = sim.getRankings(playerId);

            expect(result).toBeNull();
        });
    });

    describe('6. 統合シナリオ', () => {

        it('新規プレイヤーのフルゲームセッション', () => {
            const sim = new RankingsSimulator();
            const playerId = 'new-session-player';

            // 1. ランキングエントリ作成
            const ensureResult = sim.ensureRankingsExist(playerId);
            expect(ensureResult).toBe(true);

            // 2. 初期データ同期
            sim.syncRankingStats(playerId, 1000, { 'n_starter': 3 });

            // 3. ガチャを引く
            sim.incrementGachaCount(playerId, 10);
            sim.syncRankingStats(playerId, 100, {
                'n_starter': 3,
                'r_unit': 5,
                'sr_unit': 3,
                'ssr_unit': 1,
                'ur_unit': 1,
            });

            // 4. バトルで勝利
            sim.incrementBattleStats(playerId, true, 1);
            sim.incrementBattleStats(playerId, true, 2);
            sim.incrementBattleStats(playerId, true, 3);

            // 5. 最終確認
            const rankings = sim.getRankings(playerId);
            expect(rankings?.gacha_count).toBe(10);
            expect(rankings?.total_coins).toBe(100);
            expect(rankings?.collection_count).toBe(5);
            expect(rankings?.total_units).toBe(13); // 3+5+3+1+1
            expect(rankings?.ur_unit_count).toBe(1);
            expect(rankings?.total_wins).toBe(3);
            expect(rankings?.total_battles).toBe(3);
            expect(rankings?.max_stage).toBe(3);
            expect(rankings?.win_streak).toBe(3);
            expect(rankings?.max_win_streak).toBe(3);
        });

        it('長期プレイヤーの累積データ', () => {
            const sim = new RankingsSimulator();
            const playerId = 'veteran-player';
            sim.ensureRankingsExist(playerId);

            // 大量のガチャ
            for (let i = 0; i < 100; i++) {
                sim.incrementGachaCount(playerId, 10);
            }

            // 大量のバトル (勝率80%)
            for (let i = 0; i < 100; i++) {
                const won = Math.random() < 0.8;
                sim.incrementBattleStats(playerId, won, won ? i + 1 : undefined);
            }

            const rankings = sim.getRankings(playerId);
            expect(rankings?.gacha_count).toBe(1000);
            expect(rankings?.total_battles).toBe(100);
            expect(rankings?.total_wins).toBeGreaterThan(0);
            expect(rankings?.max_stage).toBeGreaterThan(0);
        });
    });

    describe('7. エッジケース', () => {

        it('ステージ番号0でも正しく処理される', () => {
            const sim = new RankingsSimulator();
            const playerId = 'edge-case-player';
            sim.ensureRankingsExist(playerId);

            sim.incrementBattleStats(playerId, true, 0);

            const rankings = sim.getRankings(playerId);
            expect(rankings?.max_stage).toBe(0);
        });

        it('非常に大きなステージ番号でも処理される', () => {
            const sim = new RankingsSimulator();
            const playerId = 'big-stage-player';
            sim.ensureRankingsExist(playerId);

            sim.incrementBattleStats(playerId, true, 999999);

            const rankings = sim.getRankings(playerId);
            expect(rankings?.max_stage).toBe(999999);
        });

        it('大量のユニットでも正しくカウントされる', () => {
            const sim = new RankingsSimulator();
            const playerId = 'many-units-player';
            sim.ensureRankingsExist(playerId);

            const unitInventory: Record<string, number> = {};
            for (let i = 0; i < 1000; i++) {
                unitInventory[`unit_${i}`] = i + 1;
            }

            sim.syncRankingStats(playerId, 1000000, unitInventory);

            const rankings = sim.getRankings(playerId);
            expect(rankings?.collection_count).toBe(1000);
            expect(rankings?.total_units).toBe(500500); // 1+2+...+1000
        });

        it('URユニット100体でも正しくカウントされる', () => {
            const sim = new RankingsSimulator();
            const playerId = 'ur-collector-player';
            sim.ensureRankingsExist(playerId);

            const unitInventory: Record<string, number> = {};
            for (let i = 0; i < 100; i++) {
                unitInventory[`ur_unit_${i}`] = 1;
            }

            sim.syncRankingStats(playerId, 0, unitInventory);

            const rankings = sim.getRankings(playerId);
            expect(rankings?.ur_unit_count).toBe(100);
        });

        it('連勝100回でも正しく追跡される', () => {
            const sim = new RankingsSimulator();
            const playerId = 'streak-player';
            sim.ensureRankingsExist(playerId);

            for (let i = 0; i < 100; i++) {
                sim.incrementBattleStats(playerId, true);
            }

            const rankings = sim.getRankings(playerId);
            expect(rankings?.win_streak).toBe(100);
            expect(rankings?.max_win_streak).toBe(100);
        });
    });
});
