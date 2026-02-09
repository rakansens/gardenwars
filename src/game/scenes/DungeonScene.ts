import Phaser from 'phaser';
import type { UnitDefinition, DungeonStageDefinition, SurvivalDifficulty, Rarity } from '@/data/types';
import { survivalWaves } from '@/data/survival';
import { getSpritePath } from '@/lib/sprites';
import { getSkillById } from '@/data/skills';
import { SurvivalPlayer } from '../entities/SurvivalPlayer';
import { SurvivalEnemy } from '../entities/SurvivalEnemy';
import { DungeonGuard } from '../entities/DungeonGuard';
import { ExperienceSystem } from '../systems/ExperienceSystem';
import { eventBus, GameEvents } from '../utils/EventBus';
import enTranslations from '@/data/locales/en.json';
import jaTranslations from '@/data/locales/ja.json';

export interface DungeonSceneData {
    player: UnitDefinition;
    allUnits: UnitDefinition[];
    team: UnitDefinition[];
    stageData: DungeonStageDefinition;
    difficulty?: SurvivalDifficulty;
}

type DungeonState = 'PLAYING' | 'LEVEL_UP' | 'PLACING' | 'WAVE_PAUSE' | 'GAME_OVER';

// ============================================
// ガード強化オプション（レベルアップ時）
// ============================================
interface DungeonUpgrade {
    id: string;
    name: string;
    description: string;
    icon: string;
    maxLevel: number;
}

const DUNGEON_UPGRADES: DungeonUpgrade[] = [
    { id: 'guard_damage', name: '攻撃力UP', description: '全ガードの攻撃力 +25%', icon: '⚔️', maxLevel: 5 },
    { id: 'guard_speed', name: '攻速UP', description: '全ガードの攻撃速度 +20%', icon: '⚡', maxLevel: 5 },
    { id: 'guard_hp', name: 'HP UP', description: '全ガードのHP +30%', icon: '❤️', maxLevel: 5 },
    { id: 'guard_range', name: '射程UP', description: '全ガードの射程 +15%', icon: '🎯', maxLevel: 4 },
    { id: 'gold_income', name: 'ゴールドUP', description: '毎秒ゴールド +50%', icon: '💰', maxLevel: 4 },
    { id: 'extra_slot', name: '配置枠+1', description: 'ガード上限 +1', icon: '🛡️', maxLevel: 3 },
    { id: 'guard_heal', name: '全回復', description: '全ガードHP 40%回復', icon: '💚', maxLevel: 99 },
    { id: 'kill_gold', name: 'キルゴールド', description: '敵撃破ゴールド +40%', icon: '💀', maxLevel: 4 },
];

export class DungeonScene extends Phaser.Scene {
    private playerDef!: UnitDefinition;
    private allUnitsData: UnitDefinition[] = [];
    private teamDefs: UnitDefinition[] = [];
    private stageData!: DungeonStageDefinition;

    private player!: SurvivalPlayer;
    private enemies: SurvivalEnemy[] = [];
    private guards: DungeonGuard[] = [];

    private experienceSystem!: ExperienceSystem;

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
    private pointerActive: boolean = false;
    private pointerId: number | null = null;
    private pointerTarget: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

    private gameState: DungeonState = 'PLAYING';
    private elapsedMs: number = 0;
    private killCount: number = 0;
    private gold: number = 0;
    private gameOver: boolean = false;

    // ウェーブシステム
    private currentWave: number = 0;
    private waveEnemiesRemaining: number = 0;
    private waveEnemiesSpawned: number = 0;
    private waveSpawnTimer: number = 0;
    private wavePauseTimer: number = 0;
    private waveActive: boolean = false;

    // アップグレードレベル
    private upgradeLevels: Map<string, number> = new Map();

    // HUD
    private timeText!: Phaser.GameObjects.Text;
    private waveText!: Phaser.GameObjects.Text;
    private killText!: Phaser.GameObjects.Text;
    private goldText!: Phaser.GameObjects.Text;
    private hpBarBg!: Phaser.GameObjects.Rectangle;
    private hpBarFill!: Phaser.GameObjects.Rectangle;
    private xpBarBg!: Phaser.GameObjects.Rectangle;
    private xpBarFill!: Phaser.GameObjects.Rectangle;
    private waveAnnouncerText?: Phaser.GameObjects.Text;

    // UI
    private levelUpOverlay?: Phaser.GameObjects.Container;
    private gameOverOverlay?: Phaser.GameObjects.Container;
    private unitPanel?: Phaser.GameObjects.Container;
    private placingUnit: UnitDefinition | null = null;
    private rangePreview?: Phaser.GameObjects.Graphics;
    private bgFar?: Phaser.GameObjects.TileSprite;
    private bgNear?: Phaser.GameObjects.TileSprite;

    private continueCount: number = 0;
    private maxContinues: number = 2;
    private difficulty: SurvivalDifficulty = 'normal';
    private translations: Record<string, string> = enTranslations;
    private goldTimer: number = 0;

    // バフ倍率
    private guardDamageMultiplier: number = 1;
    private guardSpeedMultiplier: number = 1;
    private guardHpMultiplier: number = 1;
    private guardRangeMultiplier: number = 1;
    private goldIncomeMultiplier: number = 1;
    private killGoldMultiplier: number = 1;
    private extraGuardSlots: number = 0;

    constructor() {
        super({ key: 'DungeonScene' });
    }

    init(data: DungeonSceneData) {
        this.playerDef = data.player;
        this.allUnitsData = data.allUnits;
        this.teamDefs = data.team;
        this.stageData = data.stageData;
        this.difficulty = data.difficulty ?? (data.stageData.difficulty as SurvivalDifficulty) ?? 'normal';
        this.enemies = [];
        this.guards = [];
        this.elapsedMs = 0;
        this.killCount = 0;
        this.gold = data.stageData.startGold;
        this.gameState = 'WAVE_PAUSE';
        this.gameOver = false;
        this.placingUnit = null;
        this.goldTimer = 0;
        this.currentWave = 0;
        this.waveEnemiesRemaining = 0;
        this.waveEnemiesSpawned = 0;
        this.waveSpawnTimer = 0;
        this.wavePauseTimer = 3000; // 開始前3秒
        this.waveActive = false;
        this.upgradeLevels = new Map();
        this.guardDamageMultiplier = 1;
        this.guardSpeedMultiplier = 1;
        this.guardHpMultiplier = 1;
        this.guardRangeMultiplier = 1;
        this.goldIncomeMultiplier = 1;
        this.killGoldMultiplier = 1;
        this.extraGuardSlots = 0;
        this.levelUpOverlay?.destroy();
        this.gameOverOverlay?.destroy();
        this.unitPanel?.destroy();
        this.continueCount = 0;
    }

    preload() {
        this.load.image('dungeon_bg', '/assets/stages/boss_stage_4.webp');

        const unitsToLoad = new Map<string, { spriteId: string; rarity?: Rarity }>();

        const addUnit = (unitDef: UnitDefinition) => {
            const spriteId = unitDef.baseUnitId || unitDef.atlasKey || unitDef.id;
            let rarity = unitDef.rarity;
            if (unitDef.baseUnitId) {
                const baseUnit = this.allUnitsData.find(u => u.id === unitDef.baseUnitId);
                if (baseUnit) rarity = baseUnit.rarity;
            }
            unitsToLoad.set(unitDef.id, { spriteId, rarity });
        };

        addUnit(this.playerDef);
        this.teamDefs.forEach(u => addUnit(u));
        survivalWaves.enemyPools.forEach(pool => {
            pool.unitIds.forEach(id => {
                const def = this.allUnitsData.find(u => u.id === id);
                if (def) addUnit(def);
            });
        });
        survivalWaves.boss.unitIds.forEach(id => {
            const def = this.allUnitsData.find(u => u.id === id);
            if (def) addUnit(def);
        });

        const loaded = new Set<string>();
        for (const [unitId, { spriteId, rarity }] of unitsToLoad) {
            if (!loaded.has(spriteId)) {
                this.load.image(spriteId, getSpritePath(spriteId, rarity));
                loaded.add(spriteId);
            }
            if (unitId !== spriteId && !loaded.has(unitId)) {
                this.load.image(unitId, getSpritePath(spriteId, rarity));
                loaded.add(unitId);
            }
        }
    }

    create() {
        const { width, height } = this.scale;
        this.translations = this.getTranslations();

        // ダンジョン風背景
        this.add.rectangle(width / 2, height / 2, width, height, 0x0d0d1a).setDepth(0);
        this.bgFar = this.add.tileSprite(width / 2, height / 2, width, height, 'dungeon_bg');
        this.bgFar.setDepth(1).setTileScale(1.05, 1.05).setAlpha(0.6);
        this.bgFar.setTint(0x4444aa);
        this.bgNear = this.add.tileSprite(width / 2, height / 2, width, height, 'dungeon_bg');
        this.bgNear.setDepth(2).setTileScale(1.25, 1.25).setAlpha(0.08);
        this.bgNear.setTint(0x6644cc);
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.2).setDepth(3);

        // 入力セットアップ
        const keyboard = this.input.keyboard;
        const emptyKey = { isDown: false } as Phaser.Input.Keyboard.Key;
        this.cursors = keyboard
            ? keyboard.createCursorKeys()
            : ({ left: emptyKey, right: emptyKey, up: emptyKey, down: emptyKey } as Phaser.Types.Input.Keyboard.CursorKeys);
        this.wasd = keyboard
            ? (keyboard.addKeys('W,A,S,D') as any)
            : ({ W: emptyKey, A: emptyKey, S: emptyKey, D: emptyKey } as any);

        // プレイヤー（攻撃なし、移動のみ）
        const playerSpriteId = this.playerDef.baseUnitId || this.playerDef.atlasKey || this.playerDef.id;
        this.player = new SurvivalPlayer(this, width / 2, height / 2, this.playerDef, {
            spriteKey: playerSpriteId,
            hpMultiplier: 4.0,
            baseSpeedMultiplier: 3.5,
        });
        this.player.setDepth(10);

        // 経験値システム（XPオーブ → ゴールドボーナス）
        this.experienceSystem = new ExperienceSystem(this, () => this.triggerLevelUp(), { xpGainMultiplier: 2.5 });

        this.createHud();
        this.createUnitPanel();

        // ポインター操作
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
            if (this.gameState === 'GAME_OVER') return;
            if (currentlyOver && currentlyOver.length > 0) return;

            if (this.gameState === 'PLACING' && this.placingUnit) {
                this.placeGuard(this.placingUnit, pointer.worldX, pointer.worldY);
                return;
            }

            if (this.gameState !== 'PLAYING' && this.gameState !== 'WAVE_PAUSE') return;
            this.pointerActive = true;
            this.pointerId = pointer.id;
            this.pointerTarget.set(pointer.worldX, pointer.worldY);
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.gameState === 'PLACING' && this.rangePreview && this.placingUnit) {
                this.updatePlacementPreview(pointer.worldX, pointer.worldY);
            }
            if (!this.pointerActive) return;
            if (this.pointerId !== null && pointer.id !== this.pointerId) return;
            this.pointerTarget.set(pointer.worldX, pointer.worldY);
        });

        const handlePointerUp = (pointer: Phaser.Input.Pointer) => {
            if (this.pointerId !== null && pointer.id !== this.pointerId) return;
            this.pointerActive = false;
            this.pointerId = null;
        };
        this.input.on('pointerup', handlePointerUp);
        this.input.on('pointerupoutside', handlePointerUp);

        // 初期ウェーブアナウンス
        this.announceWave('準備中...', 2000);
    }

    update(_: number, delta: number) {
        if (this.gameOver || this.gameState === 'GAME_OVER') return;

        this.updateBackgroundScroll(delta);
        this.elapsedMs += delta;

        // ゴールド毎秒獲得
        this.goldTimer += delta;
        if (this.goldTimer >= 1000) {
            this.gold += Math.round(this.stageData.goldPerSecond * this.goldIncomeMultiplier);
            this.goldTimer -= 1000;
        }

        // プレイヤーは常に移動可能（配置中でも）
        if (this.gameState !== 'LEVEL_UP') {
            this.updatePlayerMovement(delta);
        }

        // ウェーブ管理
        if (this.gameState === 'WAVE_PAUSE') {
            this.wavePauseTimer -= delta;
            if (this.wavePauseTimer <= 0) {
                this.startNextWave();
            }
        }

        // 敵のスポーン（ウェーブ中）
        if (this.gameState === 'PLAYING' && this.waveActive) {
            this.updateWaveSpawning(delta);
        }

        // 敵・ガード更新
        if (this.gameState === 'PLAYING' || this.gameState === 'WAVE_PAUSE') {
            this.updateEnemies(delta);
            this.updateGuards(delta);
            this.experienceSystem.update(delta, this.player);
        }

        this.updateHud();

        if (this.player.isDead()) {
            this.endGame(false);
        }
    }

    // ============================================
    // ウェーブシステム
    // ============================================

    private startNextWave() {
        this.currentWave++;
        if (this.currentWave > this.stageData.totalWaves) {
            this.endGame(true);
            return;
        }

        this.waveActive = true;
        this.gameState = 'PLAYING';

        // ウェーブ毎に敵数増加
        const baseCount = this.stageData.baseEnemiesPerWave;
        const waveScale = 1 + (this.currentWave - 1) * 0.25; // 25%ずつ増加
        this.waveEnemiesRemaining = Math.round(baseCount * waveScale);
        this.waveEnemiesSpawned = 0;
        this.waveSpawnTimer = 0;

        // ボスウェーブ（5波毎）
        if (this.currentWave % 5 === 0) {
            this.waveEnemiesRemaining += 1; // ボス追加
        }

        const isBoss = this.currentWave % 5 === 0;
        const label = isBoss ? `⚠️ WAVE ${this.currentWave}/${this.stageData.totalWaves} - BOSS!` : `WAVE ${this.currentWave}/${this.stageData.totalWaves}`;
        this.announceWave(label, 2000);
    }

    private updateWaveSpawning(delta: number) {
        if (this.waveEnemiesSpawned >= this.waveEnemiesRemaining) {
            // 全スポーン済み → 全滅チェック
            if (this.enemies.every(e => e.isDead())) {
                this.onWaveCleared();
            }
            return;
        }

        this.waveSpawnTimer += delta;
        const spawnInterval = Math.max(250, 1200 - this.currentWave * 30);

        if (this.waveSpawnTimer >= spawnInterval) {
            this.waveSpawnTimer -= spawnInterval;

            const isBoss = this.currentWave % 5 === 0 && this.waveEnemiesSpawned === this.waveEnemiesRemaining - 1;
            this.spawnEnemy(isBoss);
            this.waveEnemiesSpawned++;
        }
    }

    private onWaveCleared() {
        this.waveActive = false;

        if (this.currentWave >= this.stageData.totalWaves) {
            this.endGame(true);
            return;
        }

        // ウェーブクリアボーナスゴールド
        const bonusGold = Math.round(10 + this.currentWave * 5);
        this.gold += bonusGold;
        this.showFloatingText(this.scale.width / 2, this.scale.height / 2 - 80, `Wave Clear! +${bonusGold}G`, 0x55ff88);

        // 休憩 → ガード配置タイム
        this.gameState = 'WAVE_PAUSE';
        this.wavePauseTimer = this.stageData.wavePauseMs;
    }

    private spawnEnemy(isBoss: boolean) {
        const unitDef = this.pickEnemyDefinition(isBoss);
        if (!unitDef) return;

        const { x, y } = this.getSpawnPosition();
        const waveMultiplier = 1 + (this.currentWave - 1) * 0.12;

        // 難易度倍率
        const diffMul = this.difficulty === 'hard' ? 1.3 : this.difficulty === 'easy' ? 0.8 : 1;

        let maxHp = Math.round(unitDef.maxHp * waveMultiplier * diffMul);
        let damage = Math.round(unitDef.attackDamage * waveMultiplier * diffMul);
        let speed = unitDef.speed * (1 + (this.currentWave - 1) * 0.02);

        if (isBoss) {
            maxHp = Math.round(maxHp * 5);
            damage = Math.round(damage * 2);
            speed *= 0.7;
        }

        const spriteId = unitDef.baseUnitId || unitDef.atlasKey || unitDef.id;
        const enemy = new SurvivalEnemy(this, x, y, unitDef, {
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

    private pickEnemyDefinition(isBoss: boolean): UnitDefinition | null {
        const poolIds = isBoss
            ? survivalWaves.boss.unitIds
            : this.getCurrentEnemyPool();
        if (poolIds.length === 0) return null;
        const unitId = poolIds[Math.floor(Math.random() * poolIds.length)];
        return this.allUnitsData.find(u => u.id === unitId) ?? null;
    }

    private getCurrentEnemyPool(): string[] {
        // ウェーブ番号に基づいてプール切り替え
        const pools = [...survivalWaves.enemyPools].sort((a, b) => a.startMs - b.startMs);
        // simulatedMs: 1 wave ≈ 15秒相当でプールを切り替え
        const simulatedMs = this.currentWave * 15000;
        let active = pools[0];
        for (const pool of pools) {
            if (simulatedMs >= pool.startMs) active = pool;
        }
        return active?.unitIds ?? [];
    }

    private getSpawnPosition() {
        const { width, height } = this.scale;
        const margin = 90;
        const side = Math.floor(Math.random() * 4);

        let x = 0, y = 0;
        if (side === 0) { x = -margin; y = Phaser.Math.Between(0, height); }
        else if (side === 1) { x = width + margin; y = Phaser.Math.Between(0, height); }
        else if (side === 2) { x = Phaser.Math.Between(0, width); y = -margin; }
        else { x = Phaser.Math.Between(0, width); y = height + margin; }

        return { x, y };
    }

    // ============================================
    // プレイヤー移動
    // ============================================

    private updatePlayerMovement(delta: number) {
        if (this.pointerActive) {
            const dx = this.pointerTarget.x - this.player.x;
            const dy = this.pointerTarget.y - this.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 4) {
                const vec = new Phaser.Math.Vector2(dx, dy).normalize();
                const speed = this.player.getSpeed();
                const moveX = (vec.x * speed * delta) / 1000;
                const moveY = (vec.y * speed * delta) / 1000;
                const padding = 40;
                const { width, height } = this.scale;
                this.player.x = Phaser.Math.Clamp(this.player.x + moveX, padding, width - padding);
                this.player.y = Phaser.Math.Clamp(this.player.y + moveY, padding, height - padding);
                this.player.setFacing(vec.x);
            }
            return;
        }

        let dirX = 0, dirY = 0;
        if (this.cursors.left?.isDown || this.wasd.A.isDown) dirX -= 1;
        if (this.cursors.right?.isDown || this.wasd.D.isDown) dirX += 1;
        if (this.cursors.up?.isDown || this.wasd.W.isDown) dirY -= 1;
        if (this.cursors.down?.isDown || this.wasd.S.isDown) dirY += 1;

        if (dirX !== 0 || dirY !== 0) {
            const vec = new Phaser.Math.Vector2(dirX, dirY).normalize();
            const speed = this.player.getSpeed();
            const moveX = (vec.x * speed * delta) / 1000;
            const moveY = (vec.y * speed * delta) / 1000;
            const padding = 40;
            const { width, height } = this.scale;
            this.player.x = Phaser.Math.Clamp(this.player.x + moveX, padding, width - padding);
            this.player.y = Phaser.Math.Clamp(this.player.y + moveY, padding, height - padding);
            this.player.setFacing(vec.x);
        }
    }

    private updateBackgroundScroll(delta: number) {
        if (!this.bgFar || !this.bgNear) return;
        const drift = delta * 0.008;
        this.bgFar.tilePositionX += drift;
        this.bgFar.tilePositionY += drift * 0.3;
        this.bgNear.tilePositionX += drift * 1.5;
        this.bgNear.tilePositionY += drift * 0.5;
    }

    // ============================================
    // 敵・ガード更新
    // ============================================

    private updateEnemies(delta: number) {
        for (const enemy of this.enemies) {
            // 敵はプレイヤーに向かって移動＆攻撃
            enemy.update(delta, this.player);

            // 敵がガードにもダメージ（近接）
            if (!enemy.isDead()) {
                for (const guard of this.guards) {
                    if (guard.isDead()) continue;
                    const dx = guard.x - enemy.x;
                    const dy = guard.y - enemy.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < guard.getHitRadius() + 20) {
                        guard.takeDamage(enemy.definition.attackDamage * 0.8 * (delta / 1000));
                    }
                }
            }
        }

        // 敵同士の分離力（固まり防止）
        const separationRadius = 30;
        const separationForce = 60;
        const aliveEnemies = this.enemies.filter(e => !e.isDead());
        for (let i = 0; i < aliveEnemies.length; i++) {
            const a = aliveEnemies[i];
            for (let j = i + 1; j < aliveEnemies.length; j++) {
                const b = aliveEnemies[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < separationRadius && dist > 0.1) {
                    const overlap = (separationRadius - dist) / separationRadius;
                    const push = separationForce * overlap * (delta / 1000);
                    const nx = dx / dist;
                    const ny = dy / dist;
                    a.x += nx * push;
                    a.y += ny * push;
                    b.x -= nx * push;
                    b.y -= ny * push;
                }
            }
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (!enemy.isDead()) continue;
            this.spawnExperience(enemy.x, enemy.y, enemy.isBoss);
            this.gold += Math.round(this.stageData.killGold * this.killGoldMultiplier);
            enemy.destroy();
            this.enemies.splice(i, 1);
            this.killCount += 1;
        }
    }

    private updateGuards(delta: number) {
        for (let i = this.guards.length - 1; i >= 0; i--) {
            const guard = this.guards[i];
            if (guard.isDead()) {
                this.guards.splice(i, 1);
                continue;
            }

            const target = guard.update(delta, this.enemies as any);
            if (target) {
                this.applyGuardSkill(guard, target as SurvivalEnemy);
            }
        }
    }

    private applyGuardSkill(guard: DungeonGuard, target: SurvivalEnemy) {
        const skill = guard.definition.skillId ? getSkillById(guard.definition.skillId) : undefined;
        if (!skill) return;

        switch (skill.id) {
            case 'frost_slow': {
                this.showSkillEffect(target.x, target.y, '❄️');
                break;
            }
            case 'burn': {
                this.showSkillEffect(target.x, target.y, '🔥');
                const burnEffect = skill.effects?.[0];
                const burnDmg = Math.round((burnEffect?.value || 50) * 0.05 * guard.damageMultiplier);
                target.takeDamage(burnDmg);
                break;
            }
            case 'chain_lightning': {
                this.applyChainLightning(guard, target);
                break;
            }
            case 'critical_strike': {
                const critChance = skill.triggerChance || 0.25;
                if (Math.random() < critChance) {
                    const critEffect = skill.effects?.find(e => e.type === 'critical');
                    const critMul = critEffect?.value || 2;
                    const bonusDmg = Math.round(guard.getAttackDamage() * (critMul - 1));
                    target.takeDamage(bonusDmg);
                    this.showSkillEffect(target.x, target.y, '⚡');
                }
                break;
            }
        }
    }

    private applyChainLightning(guard: DungeonGuard, firstTarget: SurvivalEnemy) {
        const maxChain = 3;
        const chainDamageRatio = 0.6;
        const chainRange = 120;
        const baseDamage = Math.round(guard.getAttackDamage() * chainDamageRatio);

        const visited = new Set<string>([firstTarget.instanceId]);
        let current = firstTarget;
        let chainCount = 0;

        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0x66ddff, 0.8);
        graphics.setDepth(50);

        while (chainCount < maxChain) {
            let bestEnemy: SurvivalEnemy | null = null;
            let bestDist = Infinity;

            for (const enemy of this.enemies) {
                if (enemy.isDead() || visited.has(enemy.instanceId)) continue;
                const dx = enemy.x - current.x;
                const dy = enemy.y - current.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= chainRange && dist < bestDist) {
                    bestEnemy = enemy;
                    bestDist = dist;
                }
            }

            if (!bestEnemy) break;
            visited.add(bestEnemy.instanceId);
            bestEnemy.takeDamage(baseDamage);
            graphics.moveTo(current.x, current.y);
            graphics.lineTo(bestEnemy.x, bestEnemy.y);
            this.showSkillEffect(bestEnemy.x, bestEnemy.y, '⚡');
            current = bestEnemy;
            chainCount++;
        }

        graphics.strokePath();
        this.tweens.add({
            targets: graphics, alpha: 0, duration: 300,
            onComplete: () => graphics.destroy(),
        });
    }

    private showSkillEffect(x: number, y: number, emoji: string) {
        const text = this.add.text(x, y - 30, emoji, { fontSize: '16px' }).setOrigin(0.5).setDepth(60);
        this.tweens.add({
            targets: text, y: y - 60, alpha: 0, duration: 600,
            onComplete: () => text.destroy(),
        });
    }

    // ============================================
    // ガード配置
    // ============================================

    private createUnitPanel() {
        const { width, height } = this.scale;
        const panel = this.add.container(0, 0).setDepth(150);

        const panelBg = this.add.rectangle(width / 2, height - 32, width, 64, 0x111122, 0.85);
        panel.add(panelBg);

        const btnSize = 48;
        const gap = 10;
        const totalWidth = this.teamDefs.length * (btnSize + gap) - gap;
        const startX = width / 2 - totalWidth / 2 + btnSize / 2;

        this.teamDefs.forEach((unitDef, idx) => {
            const x = startX + idx * (btnSize + gap);
            const y = height - 32;

            const bg = this.add.rectangle(x, y, btnSize, btnSize, 0x1a1a2e, 0.9);
            bg.setStrokeStyle(2, 0x4488ff);
            bg.setInteractive({ useHandCursor: true });
            panel.add(bg);

            const spriteId = unitDef.baseUnitId || unitDef.atlasKey || unitDef.id;
            const img = this.add.image(x, y, spriteId);
            const imgScale = (btnSize - 8) / Math.max(img.width, img.height, 1);
            img.setScale(imgScale);
            panel.add(img);

            const cost = DungeonGuard.getPlaceCost(unitDef.rarity);
            const costText = this.add.text(x, y + btnSize / 2 - 2, `${cost}G`, {
                fontSize: '9px', color: '#ffdd00', fontFamily: 'Arial',
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5, 1);
            panel.add(costText);

            bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                pointer.event.stopPropagation();
                if (this.gameOver || this.gameState === 'LEVEL_UP') return;

                const currentCost = DungeonGuard.getPlaceCost(unitDef.rarity);
                if (this.gold < currentCost) {
                    this.showFloatingText(width / 2, height / 2 - 60, 'ゴールド不足！', 0xff4444);
                    return;
                }

                const sameCount = this.guards.filter(g => g.definition.id === unitDef.id).length;
                if (sameCount >= this.stageData.maxSameUnit) {
                    this.showFloatingText(width / 2, height / 2 - 60, '同一上限！', 0xff4444);
                    return;
                }

                const maxSlots = this.stageData.maxGuards + this.extraGuardSlots;
                if (this.guards.length >= maxSlots) {
                    this.showFloatingText(width / 2, height / 2 - 60, '配置上限！', 0xff4444);
                    return;
                }

                this.placingUnit = unitDef;
                this.gameState = 'PLACING';
                this.pointerActive = false;
                this.rangePreview?.destroy();
                this.rangePreview = this.add.graphics().setDepth(5);

                bg.setStrokeStyle(3, 0x44ff88);
                this.time.delayedCall(100, () => bg.setStrokeStyle(2, 0x4488ff));
            });
        });

        this.unitPanel = panel;
    }

    private updatePlacementPreview(worldX: number, worldY: number) {
        if (!this.rangePreview || !this.placingUnit) return;
        this.rangePreview.clear();

        const range = Math.min(250, Math.max(80, this.placingUnit.attackRange)) * this.guardRangeMultiplier;
        this.rangePreview.lineStyle(2, 0x44ff88, 0.3);
        this.rangePreview.fillStyle(0x44ff88, 0.06);
        this.rangePreview.fillCircle(worldX, worldY, range);
        this.rangePreview.strokeCircle(worldX, worldY, range);
        this.rangePreview.fillStyle(0x44ff88, 0.5);
        this.rangePreview.fillCircle(worldX, worldY, 6);
    }

    private placeGuard(unitDef: UnitDefinition, x: number, y: number) {
        const cost = DungeonGuard.getPlaceCost(unitDef.rarity);
        if (this.gold < cost) {
            this.cancelPlacement();
            return;
        }

        this.gold -= cost;

        const spriteId = unitDef.baseUnitId || unitDef.atlasKey || unitDef.id;
        const guard = new DungeonGuard(this, x, y, unitDef, {
            spriteKey: spriteId,
            scale: Math.min(unitDef.scale ?? 1, 1.6),
        });

        // グローバルバフ適用
        guard.damageMultiplier = this.guardDamageMultiplier;
        guard.speedMultiplier = this.guardSpeedMultiplier;
        guard.rangeMultiplier = this.guardRangeMultiplier;

        guard.setScale(0);
        this.tweens.add({
            targets: guard,
            scaleX: 1, scaleY: 1,
            duration: 300,
            ease: 'Back.easeOut',
        });

        this.guards.push(guard);
        this.cancelPlacement();
    }

    private cancelPlacement() {
        this.placingUnit = null;
        // ウェーブ中なら PLAYING、休憩中なら WAVE_PAUSE に戻る
        this.gameState = this.waveActive ? 'PLAYING' : 'WAVE_PAUSE';
        this.rangePreview?.destroy();
        this.rangePreview = undefined;
    }

    // ============================================
    // 経験値・レベルアップ
    // ============================================

    private spawnExperience(x: number, y: number, isBoss: boolean) {
        const base = isBoss ? 15 : 4;
        const count = isBoss ? 8 : 2;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const dist = 10 + Math.random() * 20;
            const orbX = x + Math.cos(angle) * dist;
            const orbY = y + Math.sin(angle) * dist;
            this.experienceSystem.spawnOrb(orbX, orbY, base);
        }
    }

    private triggerLevelUp() {
        if (this.gameState === 'GAME_OVER') return;
        // レベルアップスキル選択は無効 → 代わりにゴールドボーナス
        const bonus = 20 + Math.floor(this.currentWave * 5);
        this.gold += bonus;
        this.updateHud();
        this.showFloatingText(
            this.player.x, this.player.y - 40,
            `💰+${bonus}G`, 0xffd700
        );
    }

    private getUpgradeOptions(count: number): DungeonUpgrade[] {
        const available = DUNGEON_UPGRADES.filter(u => {
            const level = this.upgradeLevels.get(u.id) ?? 0;
            return level < u.maxLevel;
        });

        // シャッフル
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    private applyUpgrade(upgradeId: string) {
        const level = (this.upgradeLevels.get(upgradeId) ?? 0) + 1;
        this.upgradeLevels.set(upgradeId, level);

        switch (upgradeId) {
            case 'guard_damage':
                this.guardDamageMultiplier += 0.25;
                for (const guard of this.guards) guard.damageMultiplier = this.guardDamageMultiplier;
                break;
            case 'guard_speed':
                this.guardSpeedMultiplier += 0.2;
                for (const guard of this.guards) guard.speedMultiplier = this.guardSpeedMultiplier;
                break;
            case 'guard_hp':
                this.guardHpMultiplier += 0.3;
                // 既存ガードもHP割合維持で適用
                for (const guard of this.guards) {
                    const ratio = guard.hp / guard.maxHp;
                    guard.maxHp = Math.round(guard.definition.maxHp * 2.5 * this.guardHpMultiplier);
                    guard.hp = Math.round(guard.maxHp * ratio);
                }
                break;
            case 'guard_range':
                this.guardRangeMultiplier += 0.15;
                for (const guard of this.guards) guard.rangeMultiplier = this.guardRangeMultiplier;
                break;
            case 'gold_income':
                this.goldIncomeMultiplier += 0.5;
                break;
            case 'extra_slot':
                this.extraGuardSlots += 1;
                break;
            case 'guard_heal':
                for (const guard of this.guards) guard.healPercent(0.4);
                break;
            case 'kill_gold':
                this.killGoldMultiplier += 0.4;
                break;
        }
    }

    private showLevelUpOptions(options: DungeonUpgrade[]) {
        const { width, height } = this.scale;
        const overlay = this.add.container(0, 0).setDepth(200);

        const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);
        overlay.add(bg);

        const title = this.add.text(width / 2, height / 2 - 150, '⬆️ LEVEL UP!', {
            fontSize: '32px', color: '#ffe066', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5);
        overlay.add(title);

        const cardWidth = 230;
        const cardHeight = 130;
        const gap = 14;
        const startX = width / 2 - (options.length * cardWidth + (options.length - 1) * gap) / 2 + cardWidth / 2;
        const y = height / 2 + 10;

        options.forEach((option, idx) => {
            const x = startX + idx * (cardWidth + gap);
            const card = this.add.rectangle(x, y, cardWidth, cardHeight, 0x1f1f2f, 0.95);
            card.setStrokeStyle(3, 0xffd966);
            card.setInteractive({ useHandCursor: true });

            const level = this.upgradeLevels.get(option.id) ?? 0;

            const icon = this.add.text(x, y - 36, option.icon, { fontSize: '24px' }).setOrigin(0.5);
            const name = this.add.text(x, y - 8, option.name, {
                fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
            }).setOrigin(0.5);
            const desc = this.add.text(x, y + 16, option.description, {
                fontSize: '12px', color: '#cbd5f5',
            }).setOrigin(0.5);
            const levelText = this.add.text(x, y + 40, option.maxLevel < 99 ? `Lv ${level + 1}/${option.maxLevel}` : '', {
                fontSize: '11px', color: '#ffe066',
            }).setOrigin(0.5);

            card.on('pointerdown', () => {
                this.applyUpgrade(option.id);
                this.closeLevelUp();
            });

            overlay.add([card, icon, name, desc, levelText]);
        });

        this.levelUpOverlay = overlay;

        const keyboard = this.input.keyboard;
        if (keyboard) {
            const keys = keyboard.addKeys('ONE,TWO,THREE') as any;
            const handleKey = (index: number) => {
                if (!options[index]) return;
                this.applyUpgrade(options[index].id);
                this.closeLevelUp();
            };
            const onKey = () => {
                if (keys.ONE.isDown) handleKey(0);
                if (keys.TWO.isDown) handleKey(1);
                if (keys.THREE.isDown) handleKey(2);
            };
            keyboard.on('keydown', onKey);
            overlay.once('destroy', () => keyboard.off('keydown', onKey));
        }
    }

    private closeLevelUp() {
        this.levelUpOverlay?.destroy();
        this.levelUpOverlay = undefined;
        this.gameState = this.waveActive ? 'PLAYING' : 'WAVE_PAUSE';
    }

    // ============================================
    // HUD
    // ============================================

    private createHud() {
        const { width, height } = this.scale;

        this.timeText = this.add.text(16, 12, '⏱ 00:00', {
            fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
        }).setDepth(100);

        this.waveText = this.add.text(16, 34, 'Wave 0/0', {
            fontSize: '16px', color: '#66ddff', stroke: '#000000', strokeThickness: 3,
        }).setDepth(100);

        this.killText = this.add.text(16, 56, '💀 0', {
            fontSize: '14px', color: '#ffb366', stroke: '#000000', strokeThickness: 3,
        }).setDepth(100);

        this.goldText = this.add.text(width - 16, 12, `💰 ${this.gold}`, {
            fontSize: '18px', color: '#ffdd00', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(1, 0).setDepth(100);

        // ガード数表示
        this.add.text(width - 16, 36, '', { fontSize: '1px' }).setOrigin(1, 0);

        this.hpBarBg = this.add.rectangle(16, 78, 180, 10, 0x2f2f2f).setOrigin(0, 0.5).setDepth(100);
        this.hpBarFill = this.add.rectangle(16, 78, 180, 10, 0x55ff88).setOrigin(0, 0.5).setDepth(101);

        this.xpBarBg = this.add.rectangle(width / 2 - 140, height - 68, 280, 8, 0x222222).setOrigin(0, 0.5).setDepth(100);
        this.xpBarFill = this.add.rectangle(width / 2 - 140, height - 68, 280, 8, 0x66ddff).setOrigin(0, 0.5).setDepth(101);
    }

    private updateHud() {
        const seconds = Math.floor(this.elapsedMs / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        this.timeText.setText(`⏱ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        this.waveText.setText(`Wave ${this.currentWave}/${this.stageData.totalWaves}`);
        this.killText.setText(`💀 ${this.killCount}`);
        this.goldText.setText(`💰 ${this.gold}`);

        const hpRatio = this.player.hp / this.player.maxHp;
        this.hpBarFill.width = 180 * hpRatio;

        const xpRatio = this.experienceSystem.getProgressRatio();
        this.xpBarFill.width = 280 * xpRatio;
    }

    private announceWave(text: string, duration: number) {
        const { width, height } = this.scale;
        this.waveAnnouncerText?.destroy();

        this.waveAnnouncerText = this.add.text(width / 2, height / 2 - 40, text, {
            fontSize: '28px', color: '#66ddff', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(150).setAlpha(0);

        this.tweens.add({
            targets: this.waveAnnouncerText,
            alpha: 1,
            y: height / 2 - 60,
            duration: 400,
            ease: 'Power2',
            onComplete: () => {
                this.time.delayedCall(duration - 800, () => {
                    if (this.waveAnnouncerText) {
                        this.tweens.add({
                            targets: this.waveAnnouncerText, alpha: 0,
                            duration: 400,
                            onComplete: () => this.waveAnnouncerText?.destroy(),
                        });
                    }
                });
            },
        });
    }

    // ============================================
    // ゲーム終了
    // ============================================

    private endGame(win: boolean) {
        if (this.gameOver) return;
        this.gameOver = true;
        this.gameState = 'GAME_OVER';

        const { width, height } = this.scale;
        const overlay = this.add.container(0, 0).setDepth(220);

        const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78);
        overlay.add(bg);

        const titleStr = win ? '🏆 DUNGEON CLEAR!' : '💀 GAME OVER';
        const titleColor = win ? '#55ff88' : '#ff5555';
        const title = this.add.text(width / 2, height / 2 - 120, titleStr, {
            fontSize: '38px', color: titleColor, stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5);
        overlay.add(title);

        const seconds = Math.floor(this.elapsedMs / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        const stats = this.add.text(width / 2, height / 2 - 30,
            `Time ${timeStr}\nWave ${this.currentWave}/${this.stageData.totalWaves}  |  Kills ${this.killCount}`, {
            fontSize: '18px', color: '#ffffff', align: 'center', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5);
        overlay.add(stats);

        const coinsGained = win ? this.stageData.reward.coins : Math.floor(this.killCount * 2);

        // リトライボタン
        const retryBtn = this.add.text(width / 2 - 80, height / 2 + 60, '🔄 Retry', {
            fontSize: '22px', color: '#ffe066', backgroundColor: '#1f1f2f',
            padding: { left: 16, right: 16, top: 10, bottom: 10 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        retryBtn.on('pointerdown', () => {
            this.scene.restart({
                player: this.playerDef, allUnits: this.allUnitsData,
                team: this.teamDefs, stageData: this.stageData, difficulty: this.difficulty,
            });
        });
        overlay.add(retryBtn);

        // 結果画面へボタン（ここでのみイベント発火）
        const resultBtn = this.add.text(width / 2 + 80, height / 2 + 60, '📊 Result', {
            fontSize: '22px', color: '#66ff88', backgroundColor: '#1f1f2f',
            padding: { left: 16, right: 16, top: 10, bottom: 10 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        resultBtn.on('pointerdown', () => {
            const event = win ? GameEvents.DUNGEON_WIN : GameEvents.DUNGEON_LOSE;
            eventBus.emit(event, coinsGained);
        });
        overlay.add(resultBtn);

        if (!win && this.continueCount < this.maxContinues) {
            const continueBtn = this.add.text(width / 2, height / 2 + 120, `Continue (${this.maxContinues - this.continueCount})`, {
                fontSize: '20px', color: '#66ddff', backgroundColor: '#1f1f2f',
                padding: { left: 16, right: 16, top: 8, bottom: 8 },
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            continueBtn.on('pointerdown', () => this.handleContinue());
            overlay.add(continueBtn);
        }

        this.gameOverOverlay = overlay;
    }

    private handleContinue() {
        if (!this.gameOver || this.continueCount >= this.maxContinues) return;
        this.continueCount += 1;
        this.gameOverOverlay?.destroy();
        this.gameOverOverlay = undefined;

        this.enemies.forEach(e => e.destroy());
        this.enemies = [];

        this.player.hp = this.player.maxHp;
        this.player.x = this.scale.width / 2;
        this.player.y = this.scale.height / 2;
        this.player.grantInvincibility(2000);

        this.gameOver = false;
        // 現在のウェーブを再開
        this.waveEnemiesSpawned = 0;
        this.gameState = 'WAVE_PAUSE';
        this.wavePauseTimer = 2000;
        this.updateHud();
    }

    // ============================================
    // ユーティリティ
    // ============================================

    private showFloatingText(x: number, y: number, message: string, color: number) {
        const text = this.add.text(x, y, message, {
            fontSize: '18px',
            color: `#${color.toString(16).padStart(6, '0')}`,
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(300);

        this.tweens.add({
            targets: text, y: y - 40, alpha: 0, duration: 800,
            onComplete: () => text.destroy(),
        });
    }

    private getTranslations(): Record<string, string> {
        try {
            const stored = localStorage.getItem('gardenwars_language');
            if (stored === 'ja') return jaTranslations;
        } catch { }
        return enTranslations;
    }

    private t(key: string): string {
        return this.translations[key] || key;
    }
}
