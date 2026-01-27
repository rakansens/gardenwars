import type { CostGaugeState } from '@/data/types';
import { eventBus, GameEvents } from '../utils/EventBus';

// ============================================
// CostSystem - コストゲージ管理
// ============================================

export class CostSystem {
    private current: number;
    private max: number;
    private regenRate: number;

    constructor(initial: CostGaugeState) {
        this.current = initial.current;
        this.max = initial.max;
        this.regenRate = initial.regenRate;
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
        if (this.current >= amount) {
            this.current -= amount;
            eventBus.emit(GameEvents.COST_CHANGED, this.current, this.max);
            return true;
        }
        return false;
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
