import type { CostGaugeState } from '@/data/types';
import { eventBus, GameEvents } from '../utils/EventBus';

// ============================================
// CostSystem - コストゲージ管理
// ============================================

export interface CostSystemOptions extends CostGaugeState {
    maxLevels?: number[];
    upgradeCosts?: number[];
    regenRates?: number[];
}

export class CostSystem {
    private current: number;
    private max: number;
    private regenRate: number;
    private maxLevels: number[];
    private upgradeCosts: number[];
    private regenRates: number[];
    private level: number;

    constructor(initial: CostSystemOptions) {
        this.current = initial.current;
        this.max = initial.max;

        this.maxLevels = initial.maxLevels ?? [initial.max];
        this.upgradeCosts = initial.upgradeCosts ?? [];
        this.regenRates = initial.regenRates ?? [initial.regenRate];
        this.level = Math.max(0, this.maxLevels.indexOf(this.max));
        this.regenRate = this.regenRates[this.level] ?? initial.regenRate;
    }

    /**
     * 毎フレーム更新（コスト回復）
     */
    update(delta: number): void {
        const regen = this.regenRate * (delta / 1000);
        this.current = Math.min(this.current + regen, this.max);

        // UIに通知
        eventBus.emit(GameEvents.COST_CHANGED, this.current, this.max);
    }

    /**
     * コストを消費
     */
    spend(amount: number): boolean {
        // Validate that amount is non-negative
        if (amount < 0) {
            console.warn('[CostSystem] Attempted to spend negative amount:', amount);
            return false;
        }
        if (this.current >= amount) {
            this.current -= amount;
            eventBus.emit(GameEvents.COST_CHANGED, this.current, this.max);
            return true;
        }
        return false;
    }

    /**
     * コストが足りるかチェック（消費しない）
     */
    canAfford(amount: number): boolean {
        return this.current >= amount;
    }

    /**
     * 現在のコストを取得
     */
    getCurrent(): number {
        return this.current;
    }

    /**
     * 最大コストを取得
     */
    getMax(): number {
        return this.max;
    }

    /**
     * コスト上限の現在レベル（1始まり）
     */
    getLevel(): number {
        return this.level + 1;
    }

    getMaxLevel(): number {
        return this.maxLevels.length;
    }

    getUpgradeCost(): number | null {
        if (!this.canUpgrade()) return null;
        return this.upgradeCosts[this.level] ?? null;
    }

    canUpgrade(): boolean {
        return this.level < this.maxLevels.length - 1;
    }

    upgradeMax(): boolean {
        if (!this.canUpgrade()) return false;
        const cost = this.getUpgradeCost();
        if (cost === null) return false;
        if (this.current < cost) return false;
        this.current -= cost;
        this.level += 1;
        this.max = this.maxLevels[this.level];
        if (this.regenRates[this.level] !== undefined) {
            this.regenRate = this.regenRates[this.level];
        }
        eventBus.emit(GameEvents.COST_CHANGED, this.current, this.max);
        return true;
    }

    /**
     * コスト状態を取得
     */
    getState(): CostGaugeState {
        return {
            current: this.current,
            max: this.max,
            regenRate: this.regenRate,
        };
    }

    /**
     * リセット
     */
    reset(initial?: Partial<CostGaugeState>): void {
        if (initial) {
            this.current = initial.current ?? 0;
            this.max = initial.max ?? this.max;
            this.regenRate = initial.regenRate ?? this.regenRate;
        } else {
            this.current = 0;
        }
    }
}
