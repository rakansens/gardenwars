/**
 * データ永続化・データフローのリグレッションテスト
 *
 * このテストは以下の重要なシナリオをカバー:
 * 1. バトル報酬の永続化（コイン・クリアステージ・ドロップユニットのアトミック処理）
 * 2. ガチャの永続化（コイン消費・ユニット追加のアトミック処理）
 * 3. フュージョンの永続化（素材消費・結果追加のアトミック処理）
 * 4. ショップ購入の永続化（コイン消費・ユニット追加・売り切れマークのアトミック処理）
 * 5. マーケットプレイス操作（出品・購入・キャンセル）
 * 6. チーム/ロードアウトの永続化
 * 7. クロスセッションのデータ整合性（localStorage・Supabaseマージ）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// 1. データ永続化シミュレーター
// =============================================================================

/**
 * usePlayerDataの永続化ロジックをシミュレートするクラス
 * localStorage保存とSupabase同期の動作を再現
 */
class PersistenceSimulator {
    // プレイヤーデータ
    coins: number;
    unitInventory: Record<string, number>;
    clearedStages: string[];
    selectedTeam: string[];
    loadouts: [string[], string[], string[]];
    activeLoadoutIndex: number;
    shopItems: Array<{ uid: string; unitId: string; price: number; soldOut: boolean }>;
    gachaHistory: Array<{ timestamp: number; unitIds: string[]; count: number }>;
    gardenUnits: string[];
    currentWorld: string;
    lastModified: number;

    // 永続化ストア
    localStorage: Map<string, string>;
    supabaseData: Record<string, unknown> | null;

    // 保存フラグ
    pendingSave: boolean;

    constructor() {
        this.coins = 1000;
        this.unitInventory = { 'n_starter': 3 };
        this.clearedStages = [];
        this.selectedTeam = ['n_starter', 'n_starter', 'n_starter'];
        this.loadouts = [['n_starter', 'n_starter', 'n_starter'], [], []];
        this.activeLoadoutIndex = 0;
        this.shopItems = [
            { uid: 'shop-1', unitId: 'n_unit_a', price: 100, soldOut: false },
            { uid: 'shop-2', unitId: 'r_unit_b', price: 800, soldOut: false },
        ];
        this.gachaHistory = [];
        this.gardenUnits = [];
        this.currentWorld = 'world1';
        this.lastModified = Date.now();

        this.localStorage = new Map();
        this.supabaseData = null;
        this.pendingSave = false;
    }

    // ローカルストレージに保存
    saveToLocalStorage(): void {
        const data = {
            coins: this.coins,
            unitInventory: this.unitInventory,
            clearedStages: this.clearedStages,
            selectedTeam: this.selectedTeam,
            loadouts: this.loadouts,
            activeLoadoutIndex: this.activeLoadoutIndex,
            shopItems: this.shopItems,
            gachaHistory: this.gachaHistory,
            gardenUnits: this.gardenUnits,
            currentWorld: this.currentWorld,
            lastModified: Date.now(),
        };
        this.localStorage.set('gardenwars_player', JSON.stringify(data));
        this.lastModified = data.lastModified;
    }

    // ローカルストレージから読み込み
    loadFromLocalStorage(): boolean {
        const saved = this.localStorage.get('gardenwars_player');
        if (!saved) return false;

        try {
            const parsed = JSON.parse(saved);
            this.coins = parsed.coins ?? this.coins;
            this.unitInventory = parsed.unitInventory ?? this.unitInventory;
            this.clearedStages = parsed.clearedStages ?? this.clearedStages;
            this.selectedTeam = parsed.selectedTeam ?? this.selectedTeam;
            this.loadouts = parsed.loadouts ?? this.loadouts;
            this.activeLoadoutIndex = parsed.activeLoadoutIndex ?? this.activeLoadoutIndex;
            this.shopItems = parsed.shopItems ?? this.shopItems;
            this.gachaHistory = parsed.gachaHistory ?? this.gachaHistory;
            this.gardenUnits = parsed.gardenUnits ?? this.gardenUnits;
            this.currentWorld = parsed.currentWorld ?? this.currentWorld;
            this.lastModified = parsed.lastModified ?? this.lastModified;
            return true;
        } catch {
            return false;
        }
    }

    // Supabaseに保存
    saveToSupabase(): void {
        this.supabaseData = {
            coins: this.coins,
            unit_inventory: this.unitInventory,
            cleared_stages: this.clearedStages,
            loadouts: this.loadouts,
            active_loadout_index: this.activeLoadoutIndex,
            shop_items: this.shopItems,
            garden_units: this.gardenUnits,
            current_world: this.currentWorld,
            updated_at: new Date().toISOString(),
        };
    }

    // Supabaseからマージ読み込み
    mergeFromSupabase(remoteData: {
        coins: number;
        unit_inventory: Record<string, number>;
        cleared_stages: string[];
        loadouts: [string[], string[], string[]];
        active_loadout_index: number;
        garden_units: string[];
        updated_at: string;
    }): void {
        const localTimestamp = this.lastModified;
        const remoteTimestamp = new Date(remoteData.updated_at).getTime();
        const localIsNewer = localTimestamp > remoteTimestamp;

        // 消費系データ（コイン、インベントリ）はタイムスタンプが新しい方を使用
        if (!localIsNewer) {
            this.coins = remoteData.coins;
            this.unitInventory = remoteData.unit_inventory;
        }

        // 追加系データ（クリアステージ、ガーデンユニット）は和集合
        this.clearedStages = Array.from(new Set([...this.clearedStages, ...remoteData.cleared_stages]));
        this.gardenUnits = Array.from(new Set([...this.gardenUnits, ...remoteData.garden_units]));

        // ロードアウトはよりユニット数が多い方を使用
        for (let i = 0; i < 3; i++) {
            const localDeck = this.loadouts[i] || [];
            const remoteDeck = remoteData.loadouts[i] || [];
            if (remoteDeck.length > localDeck.length) {
                this.loadouts[i] = remoteDeck;
            }
        }

        // activeLoadoutIndexは新しい方を使用
        if (!localIsNewer) {
            this.activeLoadoutIndex = remoteData.active_loadout_index;
        }

        this.lastModified = Math.max(localTimestamp, remoteTimestamp);
    }

    // アトミック操作: バトル報酬
    executeBattleReward(coinsGained: number, stageId: string, droppedUnitIds: string[]): void {
        // 全ての変更を一度に適用（アトミック）
        const newInventory = { ...this.unitInventory };
        for (const unitId of droppedUnitIds) {
            newInventory[unitId] = (newInventory[unitId] || 0) + 1;
        }

        const newClearedStages = this.clearedStages.includes(stageId)
            ? this.clearedStages
            : [...this.clearedStages, stageId];

        // 一度に更新
        this.coins += coinsGained;
        this.unitInventory = newInventory;
        this.clearedStages = newClearedStages;

        this.saveToLocalStorage();
        this.pendingSave = true;
    }

    // アトミック操作: ガチャ
    executeGacha(cost: number, unitIds: string[]): boolean {
        // 先にチェック
        if (this.coins < cost) return false;

        // 全ての変更を一度に適用（アトミック）
        const newInventory = { ...this.unitInventory };
        for (const unitId of unitIds) {
            newInventory[unitId] = (newInventory[unitId] || 0) + 1;
        }

        // 一度に更新
        this.coins -= cost;
        this.unitInventory = newInventory;
        this.gachaHistory.unshift({
            timestamp: Date.now(),
            unitIds: unitIds,
            count: unitIds.length,
        });

        this.saveToLocalStorage();
        this.pendingSave = true;
        return true;
    }

    // アトミック操作: フュージョン
    executeFusion(materialIds: string[], resultUnitId: string): boolean {
        // 素材カウント
        const materialCounts: Record<string, number> = {};
        for (const id of materialIds) {
            materialCounts[id] = (materialCounts[id] || 0) + 1;
        }

        // 先にチェック
        for (const [unitId, needed] of Object.entries(materialCounts)) {
            if ((this.unitInventory[unitId] || 0) < needed) {
                return false;
            }
        }

        // 全ての変更を一度に適用（アトミック）
        const newInventory = { ...this.unitInventory };

        // 素材を消費
        for (const [unitId, count] of Object.entries(materialCounts)) {
            const newCount = (newInventory[unitId] || 0) - count;
            if (newCount <= 0) {
                delete newInventory[unitId];
            } else {
                newInventory[unitId] = newCount;
            }
        }

        // 結果ユニットを追加
        newInventory[resultUnitId] = (newInventory[resultUnitId] || 0) + 1;

        // 一度に更新
        this.unitInventory = newInventory;

        this.saveToLocalStorage();
        this.pendingSave = true;
        return true;
    }

    // アトミック操作: ショップ購入
    buyShopItem(index: number): boolean {
        const item = this.shopItems[index];

        // 先にチェック
        if (!item || item.soldOut || this.coins < item.price) {
            return false;
        }

        // 全ての変更を一度に適用（アトミック）
        const newShopItems = [...this.shopItems];
        newShopItems[index] = { ...item, soldOut: true };

        const newInventory = { ...this.unitInventory };
        newInventory[item.unitId] = (newInventory[item.unitId] || 0) + 1;

        // 一度に更新
        this.coins -= item.price;
        this.shopItems = newShopItems;
        this.unitInventory = newInventory;

        this.saveToLocalStorage();
        this.pendingSave = true;
        return true;
    }

    // ロードアウト切り替え
    switchLoadout(index: number): void {
        if (index < 0 || index > 2) return;
        this.activeLoadoutIndex = index;
        this.selectedTeam = this.loadouts[index] || [];
        this.saveToLocalStorage();
        this.pendingSave = true;
    }

    // チーム設定（現在のロードアウトに保存）
    setTeam(team: string[]): void {
        this.selectedTeam = team;
        this.loadouts[this.activeLoadoutIndex] = team;
        this.saveToLocalStorage();
        this.pendingSave = true;
    }
}

// =============================================================================
// 2. マーケットプレイスシミュレーター
// =============================================================================

interface MarketplaceListing {
    id: string;
    sellerId: string;
    unitId: string;
    quantity: number;
    pricePerUnit: number;
    totalPrice: number;
    status: 'active' | 'sold' | 'cancelled' | 'expired';
}

class MarketplaceSimulator {
    playerId: string;
    playerData: PersistenceSimulator;
    listings: MarketplaceListing[];
    myListings: MarketplaceListing[];

    constructor(playerId: string, playerData: PersistenceSimulator) {
        this.playerId = playerId;
        this.playerData = playerData;
        this.listings = [];
        this.myListings = [];
    }

    // 出品
    createListing(unitId: string, quantity: number, pricePerUnit: number): string | null {
        // 所持数チェック
        const ownedCount = this.playerData.unitInventory[unitId] || 0;
        if (ownedCount < quantity) {
            return null;
        }

        // ユニットをインベントリから削除
        const newInventory = { ...this.playerData.unitInventory };
        const newCount = newInventory[unitId] - quantity;
        if (newCount <= 0) {
            delete newInventory[unitId];
        } else {
            newInventory[unitId] = newCount;
        }
        this.playerData.unitInventory = newInventory;
        this.playerData.saveToLocalStorage();

        // リスティング作成
        const listingId = `listing-${Date.now()}-${Math.random()}`;
        const listing: MarketplaceListing = {
            id: listingId,
            sellerId: this.playerId,
            unitId,
            quantity,
            pricePerUnit,
            totalPrice: pricePerUnit * quantity,
            status: 'active',
        };
        this.listings.push(listing);
        this.myListings.push(listing);

        return listingId;
    }

    // 購入
    buyListing(listingId: string, buyerId: string): { success: boolean; error?: string } {
        const listing = this.listings.find(l => l.id === listingId);

        if (!listing) {
            return { success: false, error: 'not_found' };
        }

        if (listing.status !== 'active') {
            return { success: false, error: 'already_sold' };
        }

        if (listing.sellerId === buyerId) {
            return { success: false, error: 'own_listing' };
        }

        if (this.playerData.coins < listing.totalPrice) {
            return { success: false, error: 'insufficient_coins' };
        }

        // コインを減らす
        this.playerData.coins -= listing.totalPrice;

        // ユニットを追加
        const newInventory = { ...this.playerData.unitInventory };
        newInventory[listing.unitId] = (newInventory[listing.unitId] || 0) + listing.quantity;
        this.playerData.unitInventory = newInventory;

        // リスティングを売約済みに
        listing.status = 'sold';

        this.playerData.saveToLocalStorage();

        return { success: true };
    }

    // キャンセル
    cancelListing(listingId: string): boolean {
        const listing = this.listings.find(l => l.id === listingId);

        if (!listing || listing.status !== 'active' || listing.sellerId !== this.playerId) {
            return false;
        }

        // ユニットを返却
        const newInventory = { ...this.playerData.unitInventory };
        newInventory[listing.unitId] = (newInventory[listing.unitId] || 0) + listing.quantity;
        this.playerData.unitInventory = newInventory;

        // リスティングをキャンセル
        listing.status = 'cancelled';

        // myListingsから削除
        this.myListings = this.myListings.filter(l => l.id !== listingId);

        this.playerData.saveToLocalStorage();

        return true;
    }
}

// =============================================================================
// テスト
// =============================================================================

describe('データ永続化テスト', () => {

    describe('1. バトル報酬の永続化', () => {

        it('コイン・クリアステージ・ドロップユニットが全て保存される', () => {
            const sim = new PersistenceSimulator();
            const initialCoins = sim.coins;

            // バトル勝利
            sim.executeBattleReward(150, 'stage_1', ['n_drop_a', 'n_drop_b']);

            // 全てが反映されている
            expect(sim.coins).toBe(initialCoins + 150);
            expect(sim.clearedStages).toContain('stage_1');
            expect(sim.unitInventory['n_drop_a']).toBe(1);
            expect(sim.unitInventory['n_drop_b']).toBe(1);

            // localStorageにも保存されている
            const saved = JSON.parse(sim.localStorage.get('gardenwars_player') || '{}');
            expect(saved.coins).toBe(initialCoins + 150);
            expect(saved.clearedStages).toContain('stage_1');
            expect(saved.unitInventory['n_drop_a']).toBe(1);
            expect(saved.unitInventory['n_drop_b']).toBe(1);
        });

        it('同じステージを再度クリアしてもクリア済みリストに重複しない', () => {
            const sim = new PersistenceSimulator();

            sim.executeBattleReward(100, 'stage_1', []);
            sim.executeBattleReward(100, 'stage_1', []);

            expect(sim.clearedStages.filter(s => s === 'stage_1').length).toBe(1);
        });

        it('報酬処理は失敗しない（常に成功する）', () => {
            const sim = new PersistenceSimulator();

            // 異常値でも例外は発生しない
            sim.executeBattleReward(0, 'stage_1', []);
            expect(sim.clearedStages).toContain('stage_1');
        });

        it('ドロップなしでも正常に動作', () => {
            const sim = new PersistenceSimulator();
            const initialInventory = { ...sim.unitInventory };

            sim.executeBattleReward(100, 'stage_1', []);

            expect(sim.unitInventory).toEqual(initialInventory);
            expect(sim.clearedStages).toContain('stage_1');
        });
    });

    describe('2. ガチャの永続化', () => {

        it('コイン消費とユニット追加が同時に保存される', () => {
            const sim = new PersistenceSimulator();
            const initialCoins = sim.coins;

            const success = sim.executeGacha(100, ['r_unit_a', 'r_unit_b', 'r_unit_c']);

            expect(success).toBe(true);
            expect(sim.coins).toBe(initialCoins - 100);
            expect(sim.unitInventory['r_unit_a']).toBe(1);
            expect(sim.unitInventory['r_unit_b']).toBe(1);
            expect(sim.unitInventory['r_unit_c']).toBe(1);

            // localStorageにも保存されている
            const saved = JSON.parse(sim.localStorage.get('gardenwars_player') || '{}');
            expect(saved.coins).toBe(initialCoins - 100);
            expect(saved.unitInventory['r_unit_a']).toBe(1);
        });

        it('コイン不足の場合は全く変更されない（アトミック性）', () => {
            const sim = new PersistenceSimulator();
            sim.coins = 50; // 不足
            const initialInventory = { ...sim.unitInventory };

            const success = sim.executeGacha(100, ['r_unit_a']);

            expect(success).toBe(false);
            expect(sim.coins).toBe(50); // 変化なし
            expect(sim.unitInventory).toEqual(initialInventory); // 変化なし
        });

        it('ガチャ履歴が保存される', () => {
            const sim = new PersistenceSimulator();

            sim.executeGacha(100, ['r_unit_a', 'r_unit_b']);

            expect(sim.gachaHistory.length).toBe(1);
            expect(sim.gachaHistory[0].unitIds).toEqual(['r_unit_a', 'r_unit_b']);
            expect(sim.gachaHistory[0].count).toBe(2);
        });

        it('10連ガチャでも正しく保存される', () => {
            const sim = new PersistenceSimulator();
            const unitIds = Array(10).fill(null).map((_, i) => `unit_${i}`);

            const success = sim.executeGacha(900, unitIds);

            expect(success).toBe(true);
            expect(sim.coins).toBe(100); // 1000 - 900
            for (const unitId of unitIds) {
                expect(sim.unitInventory[unitId]).toBe(1);
            }
        });
    });

    describe('3. フュージョンの永続化', () => {

        it('素材消費と結果追加が同時に保存される', () => {
            const sim = new PersistenceSimulator();
            sim.unitInventory['n_material'] = 3;

            const success = sim.executeFusion(
                ['n_material', 'n_material', 'n_material'],
                'r_result'
            );

            expect(success).toBe(true);
            expect(sim.unitInventory['n_material']).toBeUndefined();
            expect(sim.unitInventory['r_result']).toBe(1);

            // localStorageにも保存されている
            const saved = JSON.parse(sim.localStorage.get('gardenwars_player') || '{}');
            expect(saved.unitInventory['n_material']).toBeUndefined();
            expect(saved.unitInventory['r_result']).toBe(1);
        });

        it('素材不足の場合は全く変更されない（アトミック性）', () => {
            const sim = new PersistenceSimulator();
            sim.unitInventory['n_material'] = 2; // 3体必要なのに2体
            const initialInventory = { ...sim.unitInventory };

            const success = sim.executeFusion(
                ['n_material', 'n_material', 'n_material'],
                'r_result'
            );

            expect(success).toBe(false);
            expect(sim.unitInventory).toEqual(initialInventory); // 変化なし
        });

        it('異なる素材の組み合わせでも正しく処理', () => {
            const sim = new PersistenceSimulator();
            sim.unitInventory['n_material_a'] = 2;
            sim.unitInventory['n_material_b'] = 1;

            const success = sim.executeFusion(
                ['n_material_a', 'n_material_a', 'n_material_b'],
                'r_result'
            );

            expect(success).toBe(true);
            expect(sim.unitInventory['n_material_a']).toBeUndefined();
            expect(sim.unitInventory['n_material_b']).toBeUndefined();
            expect(sim.unitInventory['r_result']).toBe(1);
        });

        it('素材の一部が残る場合も正しく処理', () => {
            const sim = new PersistenceSimulator();
            sim.unitInventory['n_material'] = 5;

            const success = sim.executeFusion(
                ['n_material', 'n_material', 'n_material'],
                'r_result'
            );

            expect(success).toBe(true);
            expect(sim.unitInventory['n_material']).toBe(2); // 5 - 3 = 2
            expect(sim.unitInventory['r_result']).toBe(1);
        });
    });

    describe('4. ショップ購入の永続化', () => {

        it('コイン消費・ユニット追加・売り切れマークが全て保存される', () => {
            const sim = new PersistenceSimulator();
            const initialCoins = sim.coins;
            const item = sim.shopItems[0];

            const success = sim.buyShopItem(0);

            expect(success).toBe(true);
            expect(sim.coins).toBe(initialCoins - item.price);
            expect(sim.unitInventory[item.unitId]).toBe(1);
            expect(sim.shopItems[0].soldOut).toBe(true);

            // localStorageにも保存されている
            const saved = JSON.parse(sim.localStorage.get('gardenwars_player') || '{}');
            expect(saved.coins).toBe(initialCoins - item.price);
            expect(saved.unitInventory[item.unitId]).toBe(1);
            expect(saved.shopItems[0].soldOut).toBe(true);
        });

        it('コイン不足の場合は全く変更されない（アトミック性）', () => {
            const sim = new PersistenceSimulator();
            sim.coins = 50; // Rユニットは800コインで購入不可
            const initialInventory = { ...sim.unitInventory };

            const success = sim.buyShopItem(1); // r_unit_b: 800コイン

            expect(success).toBe(false);
            expect(sim.coins).toBe(50);
            expect(sim.unitInventory).toEqual(initialInventory);
            expect(sim.shopItems[1].soldOut).toBe(false);
        });

        it('売り切れアイテムは購入できない', () => {
            const sim = new PersistenceSimulator();
            sim.shopItems[0].soldOut = true;
            const initialCoins = sim.coins;

            const success = sim.buyShopItem(0);

            expect(success).toBe(false);
            expect(sim.coins).toBe(initialCoins);
        });

        it('存在しないインデックスは購入できない', () => {
            const sim = new PersistenceSimulator();
            const initialCoins = sim.coins;

            const success = sim.buyShopItem(999);

            expect(success).toBe(false);
            expect(sim.coins).toBe(initialCoins);
        });
    });

    describe('5. マーケットプレイス操作', () => {

        it('出品するとインベントリからユニットが削除される', () => {
            const sim = new PersistenceSimulator();
            sim.unitInventory['r_unit'] = 3;
            const marketplace = new MarketplaceSimulator('player-1', sim);

            const listingId = marketplace.createListing('r_unit', 2, 500);

            expect(listingId).not.toBeNull();
            expect(sim.unitInventory['r_unit']).toBe(1); // 3 - 2 = 1

            // localStorageにも反映
            const saved = JSON.parse(sim.localStorage.get('gardenwars_player') || '{}');
            expect(saved.unitInventory['r_unit']).toBe(1);
        });

        it('所持数より多く出品できない', () => {
            const sim = new PersistenceSimulator();
            sim.unitInventory['r_unit'] = 2;
            const marketplace = new MarketplaceSimulator('player-1', sim);

            const listingId = marketplace.createListing('r_unit', 3, 500);

            expect(listingId).toBeNull();
            expect(sim.unitInventory['r_unit']).toBe(2); // 変化なし
        });

        it('購入するとコインが減りユニットが増える', () => {
            // 売り手
            const sellerData = new PersistenceSimulator();
            sellerData.unitInventory['r_unit'] = 3;
            const sellerMarketplace = new MarketplaceSimulator('seller', sellerData);

            // 出品
            const listingId = sellerMarketplace.createListing('r_unit', 1, 500);
            expect(listingId).not.toBeNull();

            // 買い手
            const buyerData = new PersistenceSimulator();
            buyerData.coins = 1000;
            const buyerMarketplace = new MarketplaceSimulator('buyer', buyerData);
            buyerMarketplace.listings = sellerMarketplace.listings; // 同じリスティングを共有

            // 購入
            const result = buyerMarketplace.buyListing(listingId!, 'buyer');

            expect(result.success).toBe(true);
            expect(buyerData.coins).toBe(500); // 1000 - 500
            expect(buyerData.unitInventory['r_unit']).toBe(1);
        });

        it('コイン不足で購入失敗', () => {
            const sellerData = new PersistenceSimulator();
            sellerData.unitInventory['r_unit'] = 3;
            const sellerMarketplace = new MarketplaceSimulator('seller', sellerData);
            const listingId = sellerMarketplace.createListing('r_unit', 1, 500);

            const buyerData = new PersistenceSimulator();
            buyerData.coins = 100; // 不足
            const buyerMarketplace = new MarketplaceSimulator('buyer', buyerData);
            buyerMarketplace.listings = sellerMarketplace.listings;

            const result = buyerMarketplace.buyListing(listingId!, 'buyer');

            expect(result.success).toBe(false);
            expect(result.error).toBe('insufficient_coins');
            expect(buyerData.coins).toBe(100); // 変化なし
        });

        it('自分の出品は購入できない', () => {
            const sim = new PersistenceSimulator();
            sim.unitInventory['r_unit'] = 3;
            const marketplace = new MarketplaceSimulator('player-1', sim);

            const listingId = marketplace.createListing('r_unit', 1, 500);
            const result = marketplace.buyListing(listingId!, 'player-1');

            expect(result.success).toBe(false);
            expect(result.error).toBe('own_listing');
        });

        it('キャンセルするとユニットがインベントリに戻る', () => {
            const sim = new PersistenceSimulator();
            sim.unitInventory['r_unit'] = 3;
            const marketplace = new MarketplaceSimulator('player-1', sim);

            const listingId = marketplace.createListing('r_unit', 2, 500);
            expect(sim.unitInventory['r_unit']).toBe(1);

            const success = marketplace.cancelListing(listingId!);

            expect(success).toBe(true);
            expect(sim.unitInventory['r_unit']).toBe(3); // 元に戻る

            // localStorageにも反映
            const saved = JSON.parse(sim.localStorage.get('gardenwars_player') || '{}');
            expect(saved.unitInventory['r_unit']).toBe(3);
        });

        it('既に売れたアイテムは購入できない', () => {
            const sellerData = new PersistenceSimulator();
            sellerData.unitInventory['r_unit'] = 3;
            const sellerMarketplace = new MarketplaceSimulator('seller', sellerData);
            const listingId = sellerMarketplace.createListing('r_unit', 1, 500);

            // 買い手1が購入
            const buyer1Data = new PersistenceSimulator();
            buyer1Data.coins = 1000;
            const buyer1Marketplace = new MarketplaceSimulator('buyer1', buyer1Data);
            buyer1Marketplace.listings = sellerMarketplace.listings;
            buyer1Marketplace.buyListing(listingId!, 'buyer1');

            // 買い手2が同じアイテムを購入しようとする
            const buyer2Data = new PersistenceSimulator();
            buyer2Data.coins = 1000;
            const buyer2Marketplace = new MarketplaceSimulator('buyer2', buyer2Data);
            buyer2Marketplace.listings = sellerMarketplace.listings;
            const result = buyer2Marketplace.buyListing(listingId!, 'buyer2');

            expect(result.success).toBe(false);
            expect(result.error).toBe('already_sold');
        });
    });

    describe('6. チーム/ロードアウトの永続化', () => {

        it('ロードアウト変更が保存される', () => {
            const sim = new PersistenceSimulator();
            sim.loadouts = [['unit_a'], ['unit_b'], ['unit_c']];

            sim.switchLoadout(1);

            expect(sim.activeLoadoutIndex).toBe(1);
            expect(sim.selectedTeam).toEqual(['unit_b']);

            // localStorageにも保存
            const saved = JSON.parse(sim.localStorage.get('gardenwars_player') || '{}');
            expect(saved.activeLoadoutIndex).toBe(1);
        });

        it('チーム変更が現在のロードアウトに保存される', () => {
            const sim = new PersistenceSimulator();
            sim.activeLoadoutIndex = 0;

            sim.setTeam(['unit_x', 'unit_y', 'unit_z']);

            expect(sim.selectedTeam).toEqual(['unit_x', 'unit_y', 'unit_z']);
            expect(sim.loadouts[0]).toEqual(['unit_x', 'unit_y', 'unit_z']);

            // localStorageにも保存
            const saved = JSON.parse(sim.localStorage.get('gardenwars_player') || '{}');
            expect(saved.loadouts[0]).toEqual(['unit_x', 'unit_y', 'unit_z']);
        });

        it('ロードアウト切り替えで他のデッキは変更されない', () => {
            const sim = new PersistenceSimulator();
            sim.loadouts = [['deck1'], ['deck2'], ['deck3']];
            sim.activeLoadoutIndex = 0;

            sim.switchLoadout(2);

            expect(sim.loadouts[0]).toEqual(['deck1']);
            expect(sim.loadouts[1]).toEqual(['deck2']);
            expect(sim.loadouts[2]).toEqual(['deck3']);
            expect(sim.selectedTeam).toEqual(['deck3']);
        });

        it('無効なインデックスは無視される', () => {
            const sim = new PersistenceSimulator();
            sim.activeLoadoutIndex = 0;

            sim.switchLoadout(-1);
            expect(sim.activeLoadoutIndex).toBe(0);

            sim.switchLoadout(5);
            expect(sim.activeLoadoutIndex).toBe(0);
        });
    });

    describe('7. クロスセッションデータ整合性', () => {

        it('localStorageからデータが復元される', () => {
            const sim = new PersistenceSimulator();
            sim.coins = 5000;
            sim.unitInventory['rare_unit'] = 10;
            sim.clearedStages = ['stage_1', 'stage_2', 'stage_3'];
            sim.saveToLocalStorage();

            // 新しいセッションをシミュレート
            const newSim = new PersistenceSimulator();
            newSim.localStorage = sim.localStorage; // 同じストレージを共有
            newSim.loadFromLocalStorage();

            expect(newSim.coins).toBe(5000);
            expect(newSim.unitInventory['rare_unit']).toBe(10);
            expect(newSim.clearedStages).toContain('stage_1');
            expect(newSim.clearedStages).toContain('stage_2');
            expect(newSim.clearedStages).toContain('stage_3');
        });

        it('Supabaseマージ: ローカルが新しい場合はローカルのコイン/インベントリを使用', () => {
            const sim = new PersistenceSimulator();
            sim.coins = 500; // ガチャ消費後
            sim.unitInventory = { 'n_starter': 3, 'r_gacha': 5 };
            sim.lastModified = 2000;

            const remoteData = {
                coins: 1000, // ガチャ前
                unit_inventory: { 'n_starter': 3 },
                cleared_stages: ['remote_stage'],
                loadouts: [[], [], []] as [string[], string[], string[]],
                active_loadout_index: 0,
                garden_units: ['remote_garden'],
                updated_at: new Date(1000).toISOString(), // ローカルより古い
            };

            sim.mergeFromSupabase(remoteData);

            // ローカルのコインとインベントリを維持
            expect(sim.coins).toBe(500);
            expect(sim.unitInventory['r_gacha']).toBe(5);
        });

        it('Supabaseマージ: リモートが新しい場合はリモートのコイン/インベントリを使用', () => {
            const sim = new PersistenceSimulator();
            sim.coins = 1000;
            sim.unitInventory = { 'n_starter': 3 };
            sim.lastModified = 1000;

            const remoteData = {
                coins: 500, // 別デバイスでガチャ後
                unit_inventory: { 'n_starter': 3, 'r_gacha': 5 },
                cleared_stages: ['remote_stage'],
                loadouts: [[], [], []] as [string[], string[], string[]],
                active_loadout_index: 0,
                garden_units: ['remote_garden'],
                updated_at: new Date(2000).toISOString(), // ローカルより新しい
            };

            sim.mergeFromSupabase(remoteData);

            // リモートのコインとインベントリを使用
            expect(sim.coins).toBe(500);
            expect(sim.unitInventory['r_gacha']).toBe(5);
        });

        it('Supabaseマージ: クリアステージは和集合', () => {
            const sim = new PersistenceSimulator();
            sim.clearedStages = ['local_1', 'local_2', 'shared'];
            sim.lastModified = 2000;

            const remoteData = {
                coins: 1000,
                unit_inventory: {},
                cleared_stages: ['remote_1', 'shared'],
                loadouts: [[], [], []] as [string[], string[], string[]],
                active_loadout_index: 0,
                garden_units: [],
                updated_at: new Date(1000).toISOString(),
            };

            sim.mergeFromSupabase(remoteData);

            expect(sim.clearedStages).toContain('local_1');
            expect(sim.clearedStages).toContain('local_2');
            expect(sim.clearedStages).toContain('remote_1');
            expect(sim.clearedStages).toContain('shared');
            expect(sim.clearedStages.filter(s => s === 'shared').length).toBe(1);
        });

        it('Supabaseマージ: ガーデンユニットは和集合', () => {
            const sim = new PersistenceSimulator();
            sim.gardenUnits = ['local_garden'];
            sim.lastModified = 2000;

            const remoteData = {
                coins: 1000,
                unit_inventory: {},
                cleared_stages: [],
                loadouts: [[], [], []] as [string[], string[], string[]],
                active_loadout_index: 0,
                garden_units: ['remote_garden'],
                updated_at: new Date(1000).toISOString(),
            };

            sim.mergeFromSupabase(remoteData);

            expect(sim.gardenUnits).toContain('local_garden');
            expect(sim.gardenUnits).toContain('remote_garden');
        });

        it('Supabaseマージ: ロードアウトはより完全な方を使用', () => {
            const sim = new PersistenceSimulator();
            sim.loadouts = [['local_unit'], ['local_1', 'local_2'], []];
            sim.lastModified = 2000;

            const remoteData = {
                coins: 1000,
                unit_inventory: {},
                cleared_stages: [],
                loadouts: [['remote_1', 'remote_2', 'remote_3'], [], ['remote_deck3']] as [string[], string[], string[]],
                active_loadout_index: 0,
                garden_units: [],
                updated_at: new Date(1000).toISOString(),
            };

            sim.mergeFromSupabase(remoteData);

            // デッキ0: リモートの方が多い
            expect(sim.loadouts[0]).toEqual(['remote_1', 'remote_2', 'remote_3']);
            // デッキ1: ローカルの方が多い
            expect(sim.loadouts[1]).toEqual(['local_1', 'local_2']);
            // デッキ2: リモートの方が多い
            expect(sim.loadouts[2]).toEqual(['remote_deck3']);
        });

        it('破損したlocalStorageデータは安全に処理される', () => {
            const sim = new PersistenceSimulator();
            sim.localStorage.set('gardenwars_player', 'invalid json {{{');

            const loaded = sim.loadFromLocalStorage();

            expect(loaded).toBe(false);
            // デフォルト値が維持される
            expect(sim.coins).toBe(1000);
        });
    });

    describe('8. アトミック性の確認', () => {

        it('ガチャ: 中間状態が存在しない', () => {
            const sim = new PersistenceSimulator();

            // 操作前後でデータの整合性が保たれる
            const beforeCoins = sim.coins;
            const beforeInventory = { ...sim.unitInventory };

            const success = sim.executeGacha(100, ['new_unit']);

            if (success) {
                // 成功時: 両方が変更されている
                expect(sim.coins).toBe(beforeCoins - 100);
                expect(sim.unitInventory['new_unit']).toBe(1);
            } else {
                // 失敗時: 両方が変更されていない
                expect(sim.coins).toBe(beforeCoins);
                expect(sim.unitInventory).toEqual(beforeInventory);
            }
        });

        it('フュージョン: 中間状態が存在しない', () => {
            const sim = new PersistenceSimulator();
            sim.unitInventory['material'] = 3;

            const beforeInventory = { ...sim.unitInventory };

            const success = sim.executeFusion(['material', 'material', 'material'], 'result');

            if (success) {
                // 成功時: 素材が消費され結果が追加されている
                expect(sim.unitInventory['material']).toBeUndefined();
                expect(sim.unitInventory['result']).toBe(1);
            } else {
                // 失敗時: 何も変更されていない
                expect(sim.unitInventory).toEqual(beforeInventory);
            }
        });

        it('ショップ購入: 中間状態が存在しない', () => {
            const sim = new PersistenceSimulator();

            const beforeCoins = sim.coins;
            const beforeInventory = { ...sim.unitInventory };
            const beforeSoldOut = sim.shopItems[0].soldOut;

            const success = sim.buyShopItem(0);

            if (success) {
                // 成功時: 全てが変更されている
                expect(sim.coins).toBeLessThan(beforeCoins);
                expect(Object.keys(sim.unitInventory).length).toBeGreaterThanOrEqual(Object.keys(beforeInventory).length);
                expect(sim.shopItems[0].soldOut).toBe(true);
            } else {
                // 失敗時: 何も変更されていない
                expect(sim.coins).toBe(beforeCoins);
                expect(sim.unitInventory).toEqual(beforeInventory);
                expect(sim.shopItems[0].soldOut).toBe(beforeSoldOut);
            }
        });

        it('バトル報酬: 常にアトミックに適用される', () => {
            const sim = new PersistenceSimulator();

            const beforeCoins = sim.coins;
            const beforeStages = [...sim.clearedStages];
            const beforeInventory = { ...sim.unitInventory };

            sim.executeBattleReward(100, 'new_stage', ['drop_unit']);

            // 全てが一度に変更されている
            expect(sim.coins).toBe(beforeCoins + 100);
            expect(sim.clearedStages.length).toBe(beforeStages.length + 1);
            expect(sim.unitInventory['drop_unit']).toBe(1);
        });
    });

    describe('9. 連続操作のストレステスト', () => {

        it('100回連続ガチャでデータ整合性が保たれる', () => {
            const sim = new PersistenceSimulator();
            sim.coins = 100000;

            for (let i = 0; i < 100; i++) {
                sim.executeGacha(100, [`unit_${i}`]);
            }

            expect(sim.coins).toBe(90000); // 100000 - 100*100
            for (let i = 0; i < 100; i++) {
                expect(sim.unitInventory[`unit_${i}`]).toBe(1);
            }
        });

        it('連続フュージョンでデータ整合性が保たれる', () => {
            const sim = new PersistenceSimulator();
            sim.unitInventory['material'] = 30;

            for (let i = 0; i < 10; i++) {
                sim.executeFusion(['material', 'material', 'material'], `result_${i}`);
            }

            expect(sim.unitInventory['material']).toBeUndefined();
            for (let i = 0; i < 10; i++) {
                expect(sim.unitInventory[`result_${i}`]).toBe(1);
            }
        });

        it('混合操作でもデータ整合性が保たれる', () => {
            const sim = new PersistenceSimulator();
            sim.coins = 10000;

            // ガチャ → バトル → ショップ購入 → フュージョン
            sim.executeGacha(100, ['gacha_unit']);
            sim.executeBattleReward(200, 'stage_1', ['drop_unit', 'drop_unit', 'drop_unit']);
            sim.buyShopItem(0);

            // フュージョン用に素材を追加
            sim.unitInventory['fusion_mat'] = 3;
            sim.executeFusion(['fusion_mat', 'fusion_mat', 'fusion_mat'], 'fusion_result');

            // 全ての操作が正しく反映されている
            expect(sim.coins).toBe(10000 - 100 + 200 - 100); // ガチャ-100, バトル+200, ショップ-100
            expect(sim.unitInventory['gacha_unit']).toBe(1);
            expect(sim.unitInventory['drop_unit']).toBe(3);
            expect(sim.unitInventory['n_unit_a']).toBe(1);
            expect(sim.unitInventory['fusion_result']).toBe(1);
            expect(sim.clearedStages).toContain('stage_1');
        });
    });

    describe('10. エッジケース', () => {

        it('コインが正確に0になる操作', () => {
            const sim = new PersistenceSimulator();
            sim.coins = 100;

            const success = sim.executeGacha(100, ['unit']);

            expect(success).toBe(true);
            expect(sim.coins).toBe(0);
        });

        it('最後の1体のユニットを使用', () => {
            const sim = new PersistenceSimulator();
            sim.unitInventory = { 'single_unit': 1 };

            // マーケットプレイスで出品
            const marketplace = new MarketplaceSimulator('player', sim);
            const listingId = marketplace.createListing('single_unit', 1, 100);

            expect(listingId).not.toBeNull();
            expect(sim.unitInventory['single_unit']).toBeUndefined();
        });

        it('空のチームを設定', () => {
            const sim = new PersistenceSimulator();

            sim.setTeam([]);

            expect(sim.selectedTeam).toEqual([]);
            expect(sim.loadouts[0]).toEqual([]);
        });

        it('大量のユニットIDを持つガチャ履歴', () => {
            const sim = new PersistenceSimulator();
            sim.coins = 100000;
            const largeUnitList = Array(100).fill(null).map((_, i) => `unit_${i}`);

            sim.executeGacha(9000, largeUnitList);

            expect(sim.gachaHistory[0].unitIds.length).toBe(100);
            expect(sim.gachaHistory[0].count).toBe(100);
        });

        it('同じステージを連続クリア', () => {
            const sim = new PersistenceSimulator();

            for (let i = 0; i < 10; i++) {
                sim.executeBattleReward(100, 'same_stage', []);
            }

            expect(sim.coins).toBe(2000); // 1000 + 100*10
            expect(sim.clearedStages.filter(s => s === 'same_stage').length).toBe(1);
        });
    });
});
