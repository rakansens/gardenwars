import type { StageDefinition, WaveConfig, UnitDefinition } from '@/data/types';
import type { BattleScene } from '../scenes/BattleScene';

// ============================================
// WaveSystem - 敵出現管理
// ============================================

interface ScheduledSpawn {
    timeMs: number;
    unitId: string;
    spawned: boolean;
}

export class WaveSystem {
    private scene: BattleScene;
    private scheduledSpawns: ScheduledSpawn[] = [];
    private startTime: number = 0;
    private isStarted: boolean = false;

    constructor(scene: BattleScene, stageData: StageDefinition, units: UnitDefinition[]) {
        this.scene = scene;
        this.buildSpawnSchedule(stageData.enemyWaves);
    }

    /**
     * Wave設定からスポーンスケジュールを構築
     */
    private buildSpawnSchedule(waves: WaveConfig[]): void {
        for (const wave of waves) {
            for (let i = 0; i < wave.count; i++) {
                this.scheduledSpawns.push({
                    timeMs: wave.timeMs + (wave.intervalMs * i),
                    unitId: wave.unitId,
                    spawned: false,
                });
            }
        }

        // 時間順でソート
        this.scheduledSpawns.sort((a, b) => a.timeMs - b.timeMs);
    }

    /**
     * Wave開始
     */
    start(): void {
        this.startTime = Date.now();
        this.isStarted = true;
    }

    /**
     * 毎フレーム更新
     */
    update(): void {
        if (!this.isStarted) return;

        const elapsedTime = Date.now() - this.startTime;

        for (const spawn of this.scheduledSpawns) {
            if (!spawn.spawned && elapsedTime >= spawn.timeMs) {
                this.spawnEnemy(spawn.unitId);
                spawn.spawned = true;
            }
        }
    }

    /**
     * 敵ユニットをスポーン
     */
    private spawnEnemy(unitId: string): void {
        this.scene.spawnEnemyUnit(unitId);
    }

    /**
     * 全Waveが完了したかチェック
     */
    isComplete(): boolean {
        return this.scheduledSpawns.every(s => s.spawned);
    }

    /**
     * リセット
     */
    reset(): void {
        this.isStarted = false;
        for (const spawn of this.scheduledSpawns) {
            spawn.spawned = false;
        }
    }
}
