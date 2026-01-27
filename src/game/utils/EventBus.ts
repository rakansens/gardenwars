// ============================================
// EventBus - Phaser ⇔ React 通信
// ============================================

type EventCallback = (...args: unknown[]) => void;

class EventBus {
    private events: Map<string, EventCallback[]> = new Map();

    on(event: string, callback: EventCallback): void {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event)!.push(callback);
    }

    off(event: string, callback: EventCallback): void {
        const callbacks = this.events.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event: string, ...args: unknown[]): void {
        const callbacks = this.events.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(...args));
        }
    }

    removeAllListeners(event?: string): void {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }
}

// シングルトンインスタンス
export const eventBus = new EventBus();

// イベント名の定数
export const GameEvents = {
    // バトル状態
    BATTLE_STARTED: 'battle:started',
    BATTLE_WIN: 'battle:win',
    BATTLE_LOSE: 'battle:lose',

    // コスト
    COST_CHANGED: 'cost:changed',
    SUMMON_UNIT: 'summon:unit',

    // ダメージ
    UNIT_DAMAGED: 'unit:damaged',
    UNIT_DIED: 'unit:died',
    CASTLE_DAMAGED: 'castle:damaged',

    // UI
    SPEED_CHANGED: 'speed:changed',
} as const;
