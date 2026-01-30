import type { UnitDefinition, CostGaugeState } from '@/data/types';
import type { BattleScene } from '../scenes/BattleScene';
import { CostSystem, CostSystemOptions } from './CostSystem';

// ============================================
// AIController - AI敵管理（コストベース）
// ============================================

export interface AIControllerOptions {
    deck: string[];           // AIのデッキ（ユニットID配列）
    costConfig: CostSystemOptions;  // コスト設定（プレイヤーと同じフル設定）
    spawnDelay?: number;      // 出撃判断の間隔（ms）
    strategy?: 'aggressive' | 'balanced' | 'defensive';
}

export class AIController {
    private scene: BattleScene;
    private deck: string[];
    private units: UnitDefinition[];
    private costSystem: CostSystem;
    private isStarted: boolean = false;
    private lastDecisionTime: number = 0;
    private spawnDelay: number;
    private strategy: 'aggressive' | 'balanced' | 'defensive';
    private unitCooldowns: Map<string, number> = new Map();

    constructor(
        scene: BattleScene,
        allUnits: UnitDefinition[],
        options: AIControllerOptions
    ) {
        this.scene = scene;
        this.deck = options.deck;
        this.spawnDelay = options.spawnDelay ?? 1500; // デフォルト1.5秒間隔
        this.strategy = options.strategy ?? 'balanced';

        // デッキからユニット定義を取得
        this.units = options.deck
            .map(id => allUnits.find(u => u.id === id))
            .filter((u): u is UnitDefinition => u !== undefined);

        // AIのコストシステム（プレイヤーと同じフル設定）
        this.costSystem = new CostSystem(options.costConfig);

        // 各ユニットのクールダウンを初期化
        this.units.forEach(unit => {
            this.unitCooldowns.set(unit.id, 0);
        });
    }

    /**
     * AI開始
     */
    start(): void {
        this.isStarted = true;
        this.lastDecisionTime = Date.now();
    }

    /**
     * 毎フレーム更新
     */
    update(delta: number): void {
        if (!this.isStarted) return;

        // コスト回復
        this.costSystem.update(delta);

        // クールダウン更新
        this.unitCooldowns.forEach((cooldown, unitId) => {
            if (cooldown > 0) {
                this.unitCooldowns.set(unitId, Math.max(0, cooldown - delta));
            }
        });

        // 一定間隔で出撃判断
        const now = Date.now();
        if (now - this.lastDecisionTime >= this.spawnDelay) {
            this.makeDecision();
            this.lastDecisionTime = now;
        }
    }

    /**
     * 出撃判断（アップグレードも含む）
     */
    private makeDecision(): void {
        const currentCost = this.costSystem.getCurrent();

        // 出撃可能なユニットを取得
        const affordableUnits = this.units.filter(unit => {
            const cooldown = this.unitCooldowns.get(unit.id) ?? 0;
            return unit.cost <= currentCost && cooldown <= 0;
        });

        // デッキ内の最高コストユニット
        const maxUnitCost = Math.max(...this.units.map(u => u.cost));

        // アップグレード判断
        // 条件：
        // 1. アップグレード可能
        // 2. アップグレードコストを払える
        // 3. 以下のいずれか:
        //    - 出撃可能なユニットがない（コストを貯めている状態）
        //    - 現在のコスト上限が最高コストユニットより低い
        //    - コストがほぼ満タン（90%以上）でアップグレードした方が効率的
        const upgradeCost = this.costSystem.getUpgradeCost();
        const canUpgrade = this.costSystem.canUpgrade();
        const maxCost = this.costSystem.getMax();
        const costRatio = currentCost / maxCost;

        if (canUpgrade && upgradeCost !== null && currentCost >= upgradeCost) {
            const shouldUpgrade =
                affordableUnits.length === 0 ||  // 出せるユニットがない
                maxCost < maxUnitCost ||          // 上限が最高コストユニットより低い
                costRatio >= 0.9;                 // コストがほぼ満タン

            if (shouldUpgrade) {
                this.costSystem.upgradeMax();
                return; // アップグレードしたらこのターンは終了
            }
        }

        // ユニット出撃判断
        if (affordableUnits.length === 0) return;

        // 戦略に基づいてユニットを選択
        const selectedUnit = this.selectUnit(affordableUnits, currentCost);
        if (!selectedUnit) return;

        // コストを消費して出撃
        if (this.costSystem.spend(selectedUnit.cost)) {
            this.scene.spawnEnemyUnit(selectedUnit.id);
            // クールダウン設定（ユニットの召喚間隔）
            const cooldown = selectedUnit.spawnCooldownMs ?? 3000;
            this.unitCooldowns.set(selectedUnit.id, cooldown);
        }
    }

    /**
     * 戦略に基づいてユニットを選択
     */
    private selectUnit(affordableUnits: UnitDefinition[], currentCost: number): UnitDefinition | null {
        if (affordableUnits.length === 0) return null;

        switch (this.strategy) {
            case 'aggressive':
                // 最も攻撃力が高いユニットを優先
                return affordableUnits.reduce((best, unit) =>
                    unit.attackDamage > best.attackDamage ? unit : best
                );

            case 'defensive':
                // 最もHPが高いユニットを優先
                return affordableUnits.reduce((best, unit) =>
                    unit.maxHp > best.maxHp ? unit : best
                );

            case 'balanced':
            default:
                // コスト効率の良いユニットをランダムに選択
                // 低コストユニットを多めに出す傾向
                const weights = affordableUnits.map(unit => {
                    // 低コストほど重み高め、ただしランダム要素も追加
                    return Math.max(1, 10 - unit.cost) + Math.random() * 3;
                });
                const totalWeight = weights.reduce((sum, w) => sum + w, 0);
                let random = Math.random() * totalWeight;

                for (let i = 0; i < affordableUnits.length; i++) {
                    random -= weights[i];
                    if (random <= 0) {
                        return affordableUnits[i];
                    }
                }
                return affordableUnits[0];
        }
    }

    /**
     * 現在のコストを取得（デバッグ用）
     */
    getCost(): number {
        return this.costSystem.getCurrent();
    }

    /**
     * 現在のコストレベルを取得（デバッグ用）
     */
    getCostLevel(): number {
        return this.costSystem.getLevel();
    }

    /**
     * リセット
     */
    reset(): void {
        this.isStarted = false;
        this.costSystem.reset({ current: 0 });
        this.unitCooldowns.forEach((_, key) => {
            this.unitCooldowns.set(key, 0);
        });
    }
}
