import type { StageDefinition, WaveConfig, UnitDefinition } from '@/data/types';
import type { BattleScene } from '../scenes/BattleScene';

// ============================================
// WaveSystem - 敵出現管理
// ============================================

interface ScheduledSpawn {
    timeMs: number;
    unitId: string;
    spawned: boolean;
    isBoss: boolean;
}

export class WaveSystem {
    private scene: BattleScene;
    private scheduledSpawns: ScheduledSpawn[] = [];
    private bossSpawns: ScheduledSpawn[] = [];  // ボスは別管理
    private startTime: number = 0;
    private isStarted: boolean = false;
    private allUnits: UnitDefinition[];
    private isBossStage: boolean = false;

    constructor(scene: BattleScene, stageData: StageDefinition, units: UnitDefinition[]) {
        this.scene = scene;
        this.allUnits = units;
        this.isBossStage = stageData.isBossStage ?? false;
        this.buildSpawnSchedule(stageData.enemyWaves);
    }

    /**
     * Wave設定からスポーンスケジュールを構築
     * ボスステージの場合、ボスは別管理（城攻撃時に出現）
     */
    private buildSpawnSchedule(waves: WaveConfig[]): void {
        for (const wave of waves) {
            // ボスかどうかチェック
            const unitDef = this.allUnits.find(u => u.id === wave.unitId);
            const isBoss = unitDef?.isBoss ?? wave.unitId.startsWith('boss_');

            for (let i = 0; i < wave.count; i++) {
                const spawn: ScheduledSpawn = {
                    timeMs: wave.timeMs + (wave.intervalMs * i),
                    unitId: wave.unitId,
                    spawned: false,
                    isBoss,
                };

                // ボスステージの場合、ボスは別管理
                if (this.isBossStage && isBoss) {
                    this.bossSpawns.push(spawn);
                } else {
                    this.scheduledSpawns.push(spawn);
                }
            }
        }

        // 時間順でソート
        this.scheduledSpawns.sort((a, b) => a.timeMs - b.timeMs);
    }

    /**
     * ボスが存在するか
     */
    hasBoss(): boolean {
        return this.bossSpawns.length > 0;
    }

    /**
     * ボスをスポーン（城攻撃時に呼び出し）
     */
    spawnBoss(): void {
        for (const spawn of this.bossSpawns) {
            if (!spawn.spawned) {
                this.spawnEnemy(spawn.unitId);
                spawn.spawned = true;
            }
        }
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
