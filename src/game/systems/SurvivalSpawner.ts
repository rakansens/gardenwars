import Phaser from 'phaser';
import type { UnitDefinition, SurvivalWavesConfig } from '@/data/types';
import { survivalWaves } from '@/data/survival';
import { SurvivalEnemy } from '../entities/SurvivalEnemy';

interface SurvivalSpawnerConfig {
    allUnits: UnitDefinition[];
    enemies: SurvivalEnemy[];
    maxEnemies?: number;
    difficultyModifiers?: SurvivalDifficultyModifiers;
}

export interface SurvivalDifficultyModifiers {
    spawnInterval: number;
    minInterval: number;
    intervalDecay: number;
    extraSpawnChance: number;
    hpScaling: number;
    damageScaling: number;
    speedScaling: number;
    bossHp: number;
    bossDamage: number;
}

const DEFAULT_MODIFIERS: SurvivalDifficultyModifiers = {
    spawnInterval: 1,
    minInterval: 1,
    intervalDecay: 1,
    extraSpawnChance: 1,
    hpScaling: 1,
    damageScaling: 1,
    speedScaling: 1,
    bossHp: 1,
    bossDamage: 1,
};

export class SurvivalSpawner {
    private scene: Phaser.Scene;
    private config: SurvivalWavesConfig;
    private allUnits: UnitDefinition[];
    private enemies: SurvivalEnemy[];
    private elapsedMs: number = 0;
    private spawnTimer: number = 0;
    private nextBossAt: number = 0;
    private maxEnemies: number;
    private modifiers: SurvivalDifficultyModifiers;

    constructor(scene: Phaser.Scene, config: SurvivalSpawnerConfig) {
        this.scene = scene;
        this.config = survivalWaves;
        this.allUnits = config.allUnits;
        this.enemies = config.enemies;
        this.nextBossAt = this.config.boss.intervalMs;
        this.maxEnemies = config.maxEnemies ?? 120;
        this.modifiers = config.difficultyModifiers ?? DEFAULT_MODIFIERS;
    }

    update(delta: number, playerX: number, playerY: number) {
        this.elapsedMs += delta;
        this.spawnTimer += delta;

        if (this.enemies.length < this.maxEnemies) {
            const interval = this.getSpawnInterval();
            while (this.spawnTimer >= interval) {
                this.spawnTimer -= interval;
                this.spawnEnemy(false, playerX, playerY);

                const extraChance = Math.min(
                    0.6,
                    (this.elapsedMs / 60000) * this.config.spawn.extraSpawnChancePerMinute * this.modifiers.extraSpawnChance
                );
                if (Math.random() < extraChance && this.enemies.length < this.maxEnemies) {
                    this.spawnEnemy(false, playerX, playerY);
                }
            }
        }

        if (this.elapsedMs >= this.nextBossAt) {
            this.nextBossAt += this.config.boss.intervalMs;
            const hasBossAlive = this.enemies.some(enemy => enemy.isBoss && !enemy.isDead());
            if (!hasBossAlive) {
                this.spawnEnemy(true, playerX, playerY);
            }
        }
    }

    getElapsedMs(): number {
        return this.elapsedMs;
    }

    private getSpawnInterval(): number {
        const minutes = this.elapsedMs / 60000;
        const baseInterval = this.config.spawn.baseIntervalMs * this.modifiers.spawnInterval;
        const minInterval = this.config.spawn.minIntervalMs * this.modifiers.minInterval;
        const decayRate = this.config.spawn.intervalDecayPerMinute * this.modifiers.intervalDecay;
        const decay = Math.pow(1 - decayRate, minutes);
        return Math.max(minInterval, baseInterval * decay);
    }

    private spawnEnemy(isBoss: boolean, playerX: number, playerY: number) {
        const unitDef = this.pickUnitDefinition(isBoss);
        if (!unitDef) return;

        const { x, y } = this.getSpawnPosition(playerX, playerY);
        const minutes = this.elapsedMs / 60000;

        const scaling = this.config.scaling;
        let maxHp = unitDef.maxHp * (1 + scaling.hpPerMinute * minutes) * this.modifiers.hpScaling;
        let damage = unitDef.attackDamage * (1 + scaling.damagePerMinute * minutes) * this.modifiers.damageScaling;
        let speed = unitDef.speed * (1 + scaling.speedPerMinute * minutes) * this.modifiers.speedScaling;

        if (isBoss) {
            maxHp = unitDef.maxHp * this.config.boss.baseHpFactor * (1 + this.config.boss.hpPerMinute * minutes) * this.modifiers.bossHp;
            damage = unitDef.attackDamage * this.config.boss.baseDamageFactor * (1 + this.config.boss.damagePerMinute * minutes) * this.modifiers.bossDamage;
            speed = unitDef.speed * this.config.boss.baseSpeedFactor * this.modifiers.speedScaling;
        }

        const spriteId = unitDef.baseUnitId || unitDef.atlasKey || unitDef.id;
        const enemy = new SurvivalEnemy(this.scene, x, y, unitDef, {
            spriteKey: spriteId,
            flipSprite: unitDef.flipSprite,
            scale: Math.min(unitDef.scale ?? 1, isBoss ? 2.2 : 1.8),
            stats: {
                maxHp,
                speed,
                attackDamage: damage,
                attackRange: Math.min(90, Math.max(30, unitDef.attackRange)),
                attackCooldownMs: Math.max(400, unitDef.attackCooldownMs),
                isBoss,
            },
        });

        this.enemies.push(enemy);
    }

    private pickUnitDefinition(isBoss: boolean): UnitDefinition | null {
        const poolIds = isBoss
            ? this.config.boss.unitIds
            : this.getCurrentEnemyPool();
        if (poolIds.length === 0) return null;

        const unitId = poolIds[Math.floor(Math.random() * poolIds.length)];
        return this.allUnits.find(u => u.id === unitId) ?? null;
    }

    private getCurrentEnemyPool(): string[] {
        const pools = [...this.config.enemyPools].sort((a, b) => a.startMs - b.startMs);
        let active = pools[0];
        for (const pool of pools) {
            if (this.elapsedMs >= pool.startMs) {
                active = pool;
            }
        }
        return active?.unitIds ?? [];
    }

    private getSpawnPosition(playerX: number, playerY: number) {
        const { width, height } = this.scene.scale;
        const margin = 90;
        const side = Math.floor(Math.random() * 4);

        let x = 0;
        let y = 0;
        if (side === 0) {
            x = -margin;
            y = Phaser.Math.Between(0, height);
        } else if (side === 1) {
            x = width + margin;
            y = Phaser.Math.Between(0, height);
        } else if (side === 2) {
            x = Phaser.Math.Between(0, width);
            y = -margin;
        } else {
            x = Phaser.Math.Between(0, width);
            y = height + margin;
        }

        const dx = x - playerX;
        const dy = y - playerY;
        if (dx * dx + dy * dy < 180 * 180) {
            if (x < playerX) x -= margin;
            else x += margin;
            if (y < playerY) y -= margin;
            else y += margin;
        }

        return { x, y };
    }
}
