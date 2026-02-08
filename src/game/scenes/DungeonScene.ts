import Phaser from 'phaser';
import type { UnitDefinition, DungeonStageDefinition, SurvivalDifficulty, Rarity } from '@/data/types';
import { survivalWaves } from '@/data/survival';
import { getSpritePath } from '@/lib/sprites';
import { getSkillById } from '@/data/skills';
import { SurvivalPlayer } from '../entities/SurvivalPlayer';
import { SurvivalEnemy } from '../entities/SurvivalEnemy';
import { DungeonGuard } from '../entities/DungeonGuard';
import { Projectile } from '../entities/Projectile';
import { SurvivalSpawner, SurvivalDifficultyModifiers } from '../systems/SurvivalSpawner';
import { WeaponSystem } from '../systems/WeaponSystem';
import { ExperienceSystem } from '../systems/ExperienceSystem';
import { CannonSystem, CannonTarget } from '../systems/CannonSystem';
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

type DungeonState = 'PLAYING' | 'LEVEL_UP' | 'PLACING' | 'GAME_OVER';

const DIFFICULTY_MODIFIERS: Record<SurvivalDifficulty, SurvivalDifficultyModifiers> = {
    easy: {
        spawnInterval: 1.2, minInterval: 1.15, intervalDecay: 0.85,
        extraSpawnChance: 0.7, hpScaling: 0.85, damageScaling: 0.85,
        speedScaling: 0.9, bossHp: 0.85, bossDamage: 0.85,
    },
    normal: {
        spawnInterval: 1, minInterval: 1, intervalDecay: 1,
        extraSpawnChance: 1, hpScaling: 1, damageScaling: 1,
        speedScaling: 1, bossHp: 1, bossDamage: 1,
    },
    hard: {
        spawnInterval: 0.85, minInterval: 0.85, intervalDecay: 1.2,
        extraSpawnChance: 1.3, hpScaling: 1.2, damageScaling: 1.2,
        speedScaling: 1.1, bossHp: 1.25, bossDamage: 1.25,
    },
};

export class DungeonScene extends Phaser.Scene {
    private playerDef!: UnitDefinition;
    private allUnitsData: UnitDefinition[] = [];
    private teamDefs: UnitDefinition[] = [];
    private stageData!: DungeonStageDefinition;

    private player!: SurvivalPlayer;
    private enemies: SurvivalEnemy[] = [];
    private guards: DungeonGuard[] = [];
    private projectiles: Projectile[] = [];

    private spawner!: SurvivalSpawner;
    private weaponSystem!: WeaponSystem;
    private experienceSystem!: ExperienceSystem;
    private cannonSystem!: CannonSystem;

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

    // HUD
    private timeText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    private killText!: Phaser.GameObjects.Text;
    private goldText!: Phaser.GameObjects.Text;
    private hpBarBg!: Phaser.GameObjects.Rectangle;
    private hpBarFill!: Phaser.GameObjects.Rectangle;
    private xpBarBg!: Phaser.GameObjects.Rectangle;
    private xpBarFill!: Phaser.GameObjects.Rectangle;

    // UI
    private levelUpOverlay?: Phaser.GameObjects.Container;
    private gameOverOverlay?: Phaser.GameObjects.Container;
    private unitPanel?: Phaser.GameObjects.Container;
    private placingUnit: UnitDefinition | null = null;
    private rangePreview?: Phaser.GameObjects.Graphics;
    private bgFar?: Phaser.GameObjects.TileSprite;
    private bgNear?: Phaser.GameObjects.TileSprite;

    private continueCount: number = 0;
    private maxContinues: number = 3;
    private difficulty: SurvivalDifficulty = 'normal';
    private translations: Record<string, string> = enTranslations;
    private goldTimer: number = 0;

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
        this.projectiles = [];
        this.elapsedMs = 0;
        this.killCount = 0;
        this.gold = data.stageData.startGold;
        this.gameState = 'PLAYING';
        this.gameOver = false;
        this.placingUnit = null;
        this.goldTimer = 0;
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

        // プレイヤー
        const playerSpriteId = this.playerDef.baseUnitId || this.playerDef.atlasKey || this.playerDef.id;
        this.player = new SurvivalPlayer(this, width / 2, height / 2, this.playerDef, {
            spriteKey: playerSpriteId,
            hpMultiplier: 3.2,
            baseSpeedMultiplier: 1.8,
        });
        this.player.setDepth(10);

        // システム初期化
        this.weaponSystem = new WeaponSystem(this, this.player, this.enemies, this.projectiles);
        this.weaponSystem.applyUpgrade('forward_shot');
        this.experienceSystem = new ExperienceSystem(this, () => this.triggerLevelUp(), { xpGainMultiplier: 2 });
        this.spawner = new SurvivalSpawner(this, {
            allUnits: this.allUnitsData,
            enemies: this.enemies,
            difficultyModifiers: DIFFICULTY_MODIFIERS[this.difficulty] ?? DIFFICULTY_MODIFIERS.normal,
        });

        this.cannonSystem = new CannonSystem(this);
        const bombBtn = this.cannonSystem.createUI(width - 70, height - 70, 0);
        bombBtn.on('pointerdown', () => {
            if (this.gameState !== 'PLAYING') return;
            const targets = this.enemies.filter(e => !e.isDead()) as CannonTarget[];
            this.cannonSystem.fireArea(this.player.x, this.player.y - 20, targets, 220, { damage: 180, knockback: 70 });
        });

        this.createHud();
        this.createUnitPanel();

        // ポインター操作
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
            if (this.gameState === 'GAME_OVER') return;
            if (currentlyOver && currentlyOver.length > 0) return;

            // 配置モード
            if (this.gameState === 'PLACING' && this.placingUnit) {
                this.placeGuard(this.placingUnit, pointer.worldX, pointer.worldY);
                return;
            }

            if (this.gameState !== 'PLAYING') return;
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
    }

    update(_: number, delta: number) {
        if (this.gameOver) return;
        if (this.gameState === 'GAME_OVER') return;
        if (this.gameState === 'LEVEL_UP' || this.gameState === 'PLACING') return;

        this.cannonSystem.update(delta);
        this.updateBackgroundScroll(delta);

        this.elapsedMs += delta;

        // ゴールド毎秒獲得
        this.goldTimer += delta;
        if (this.goldTimer >= 1000) {
            this.gold += this.stageData.goldPerSecond;
            this.goldTimer -= 1000;
        }

        this.updatePlayerMovement(delta);
        this.spawner.update(delta, this.player.x, this.player.y);
        this.weaponSystem.update(delta);
        this.updateProjectiles(delta);
        this.updateEnemies(delta);
        this.updateGuards(delta);
        this.experienceSystem.update(delta, this.player);
        this.updateHud();

        if (this.player.isDead()) {
            this.endGame(false);
        }
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
    // 弾丸・敵更新
    // ============================================

    private updateProjectiles(delta: number) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            const alive = projectile.update(delta);
            if (!alive) { this.projectiles.splice(i, 1); continue; }

            let hit = false;
            for (const enemy of this.enemies) {
                if (enemy.isDead()) continue;
                const dx = enemy.x - projectile.x;
                const dy = enemy.y - projectile.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= enemy.getHitRadius() + projectile.getHitRadius()) {
                    enemy.takeDamage(projectile.damage);
                    projectile.pierce -= 1;
                    hit = true;
                    if (projectile.pierce <= 0) break;
                }
            }
            if (hit && projectile.pierce <= 0) {
                projectile.destroy();
                this.projectiles.splice(i, 1);
            }
        }
    }

    private updateEnemies(delta: number) {
        for (const enemy of this.enemies) {
            enemy.update(delta, this.player);

            // 敵がガードも攻撃する（近いガードをターゲット）
            if (!enemy.isDead()) {
                for (const guard of this.guards) {
                    if (guard.isDead()) continue;
                    const dx = guard.x - enemy.x;
                    const dy = guard.y - enemy.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    // 敵がガードに近づいたらダメージ
                    if (dist < 40) {
                        guard.takeDamage(enemy.definition.attackDamage * 0.3);
                    }
                }
            }
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (!enemy.isDead()) continue;
            this.spawnExperience(enemy.x, enemy.y, enemy.isBoss);
            this.gold += this.stageData.killGold;
            enemy.destroy();
            this.enemies.splice(i, 1);
            this.killCount += 1;
        }
    }

    // ============================================
    // ガード更新
    // ============================================

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
                // スローは SurvivalEnemy に直接適用できないため、エフェクトのみ
                this.showSkillEffect(target.x, target.y, '❄️');
                break;
            }
            case 'burn': {
                this.showSkillEffect(target.x, target.y, '🔥');
                // 追加ダメージ
                const burnEffect = skill.effects?.[0];
                const burnDmg = Math.round((burnEffect?.value || 50) * 0.05);
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
                    const bonusDmg = Math.round(guard.definition.attackDamage * (critMul - 1));
                    target.takeDamage(bonusDmg);
                    this.showSkillEffect(target.x, target.y, '⚡');
                }
                break;
            }
        }
    }

    private applyChainLightning(guard: DungeonGuard, firstTarget: SurvivalEnemy) {
        const skill = getSkillById(guard.definition.skillId!);
        if (!skill) return;

        const maxChain = 3;
        const chainDamageRatio = 0.6;
        const chainRange = 120;
        const baseDamage = Math.round(guard.definition.attackDamage * chainDamageRatio);

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
            targets: graphics,
            alpha: 0,
            duration: 300,
            onComplete: () => graphics.destroy(),
        });
    }

    private showSkillEffect(x: number, y: number, emoji: string) {
        const text = this.add.text(x, y - 30, emoji, { fontSize: '16px' }).setOrigin(0.5).setDepth(60);
        this.tweens.add({
            targets: text,
            y: y - 60,
            alpha: 0,
            duration: 600,
            onComplete: () => text.destroy(),
        });
    }

    // ============================================
    // ガード配置
    // ============================================

    private createUnitPanel() {
        const { width, height } = this.scale;
        const panel = this.add.container(0, 0).setDepth(150);

        // パネル背景
        const panelBg = this.add.rectangle(width / 2, height - 32, width, 64, 0x111122, 0.85);
        panel.add(panelBg);

        const btnSize = 48;
        const gap = 10;
        const totalWidth = this.teamDefs.length * (btnSize + gap) - gap;
        const startX = width / 2 - totalWidth / 2 + btnSize / 2;

        this.teamDefs.forEach((unitDef, idx) => {
            const x = startX + idx * (btnSize + gap);
            const y = height - 32;

            // ボタン背景
            const bg = this.add.rectangle(x, y, btnSize, btnSize, 0x1a1a2e, 0.9);
            bg.setStrokeStyle(2, 0x4488ff);
            bg.setInteractive({ useHandCursor: true });
            panel.add(bg);

            // ユニットスプライト
            const spriteId = unitDef.baseUnitId || unitDef.atlasKey || unitDef.id;
            const img = this.add.image(x, y, spriteId);
            const imgScale = (btnSize - 8) / Math.max(img.width, img.height, 1);
            img.setScale(imgScale);
            panel.add(img);

            // コスト表示
            const costMap: Record<string, number> = { N: 30, R: 60, SR: 120, SSR: 200, UR: 350 };
            const cost = costMap[unitDef.rarity] || 50;
            const costText = this.add.text(x, y + btnSize / 2 - 2, `${cost}G`, {
                fontSize: '9px', color: '#ffdd00', fontFamily: 'Arial',
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5, 1);
            panel.add(costText);

            bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                pointer.event.stopPropagation();
                if (this.gameOver) return;
                if (this.gameState === 'LEVEL_UP') return;

                if (this.gold < cost) {
                    this.showFloatingText(width / 2, height / 2 - 60, 'ゴールド不足！', 0xff4444);
                    return;
                }

                // 同一ユニット上限チェック
                const sameCount = this.guards.filter(g => g.definition.id === unitDef.id).length;
                if (sameCount >= this.stageData.maxSameUnit) {
                    this.showFloatingText(width / 2, height / 2 - 60, '配置上限！', 0xff4444);
                    return;
                }

                // 全体上限チェック
                if (this.guards.length >= this.stageData.maxGuards) {
                    this.showFloatingText(width / 2, height / 2 - 60, '配置上限！', 0xff4444);
                    return;
                }

                // 配置モード開始
                this.placingUnit = unitDef;
                this.gameState = 'PLACING';
                this.pointerActive = false;

                // レンジプレビュー
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

        const range = Math.min(180, Math.max(60, this.placingUnit.attackRange));
        this.rangePreview.lineStyle(2, 0x44ff88, 0.3);
        this.rangePreview.fillStyle(0x44ff88, 0.06);
        this.rangePreview.fillCircle(worldX, worldY, range);
        this.rangePreview.strokeCircle(worldX, worldY, range);

        // 配置位置のドット
        this.rangePreview.fillStyle(0x44ff88, 0.5);
        this.rangePreview.fillCircle(worldX, worldY, 6);
    }

    private placeGuard(unitDef: UnitDefinition, x: number, y: number) {
        const costMap: Record<string, number> = { N: 30, R: 60, SR: 120, SSR: 200, UR: 350 };
        const cost = costMap[unitDef.rarity] || 50;

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

        // 配置エフェクト
        guard.setScale(0);
        this.tweens.add({
            targets: guard,
            scaleX: 1,
            scaleY: 1,
            duration: 300,
            ease: 'Back.easeOut',
        });

        this.guards.push(guard);
        this.cancelPlacement();
    }

    private cancelPlacement() {
        this.placingUnit = null;
        this.gameState = 'PLAYING';
        this.rangePreview?.destroy();
        this.rangePreview = undefined;
    }

    // ============================================
    // 経験値・レベルアップ
    // ============================================

    private spawnExperience(x: number, y: number, isBoss: boolean) {
        const base = isBoss ? 12 : 3;
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
        if (this.gameState !== 'PLAYING') return;
        this.gameState = 'LEVEL_UP';

        const options = this.weaponSystem.getUpgradeOptions(3);
        if (options.length === 0) {
            this.gameState = 'PLAYING';
            return;
        }
        this.showLevelUpOptions(options);
    }

    private showLevelUpOptions(options: any[]) {
        const { width, height } = this.scale;
        const overlay = this.add.container(0, 0).setDepth(200);

        const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);
        overlay.add(bg);

        const title = this.add.text(width / 2, height / 2 - 150, 'LEVEL UP!', {
            fontSize: '36px', color: '#ffe066', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5);
        overlay.add(title);

        const cardWidth = 260;
        const cardHeight = 120;
        const gap = 18;
        const startX = width / 2 - (options.length * cardWidth + (options.length - 1) * gap) / 2 + cardWidth / 2;
        const y = height / 2;

        options.forEach((option, idx) => {
            const x = startX + idx * (cardWidth + gap);
            const card = this.add.rectangle(x, y, cardWidth, cardHeight, 0x1f1f2f, 0.95);
            card.setStrokeStyle(3, 0xffd966);
            card.setInteractive({ useHandCursor: true });

            const level = this.weaponSystem.getLevel(option.id);
            const name = this.add.text(x, y - 24, this.t(option.name), {
                fontSize: '18px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
            }).setOrigin(0.5);

            const desc = this.add.text(x, y + 6, this.t(option.description), {
                fontSize: '14px', color: '#cbd5f5',
            }).setOrigin(0.5);

            const levelText = this.add.text(x, y + 36, `Lv ${level + 1}/${option.maxLevel}`, {
                fontSize: '12px', color: '#ffe066',
            }).setOrigin(0.5);

            card.on('pointerdown', () => {
                this.weaponSystem.applyUpgrade(option.id);
                this.closeLevelUp();
            });

            overlay.add([card, name, desc, levelText]);
        });

        this.levelUpOverlay = overlay;

        const keyboard = this.input.keyboard;
        if (keyboard) {
            const keys = keyboard.addKeys('ONE,TWO,THREE') as any;
            const handleKey = (index: number) => {
                const option = options[index];
                if (!option) return;
                this.weaponSystem.applyUpgrade(option.id);
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
        this.gameState = 'PLAYING';
    }

    // ============================================
    // HUD
    // ============================================

    private createHud() {
        const { width, height } = this.scale;

        this.timeText = this.add.text(16, 12, '⏱ 00:00', {
            fontSize: '18px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
        }).setDepth(100);

        this.levelText = this.add.text(16, 36, 'Lv 1', {
            fontSize: '16px', color: '#ffe066', stroke: '#000000', strokeThickness: 3,
        }).setDepth(100);

        this.killText = this.add.text(16, 58, '💀 0', {
            fontSize: '16px', color: '#ffb366', stroke: '#000000', strokeThickness: 3,
        }).setDepth(100);

        this.goldText = this.add.text(width - 16, 12, `💰 ${this.gold}`, {
            fontSize: '18px', color: '#ffdd00', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(1, 0).setDepth(100);

        this.hpBarBg = this.add.rectangle(16, 86, 200, 12, 0x2f2f2f).setOrigin(0, 0.5).setDepth(100);
        this.hpBarFill = this.add.rectangle(16, 86, 200, 12, 0x55ff88).setOrigin(0, 0.5).setDepth(101);

        this.xpBarBg = this.add.rectangle(width / 2 - 160, height - 68, 320, 10, 0x222222).setOrigin(0, 0.5).setDepth(100);
        this.xpBarFill = this.add.rectangle(width / 2 - 160, height - 68, 320, 10, 0x66ddff).setOrigin(0, 0.5).setDepth(101);
    }

    private updateHud() {
        const seconds = Math.floor(this.elapsedMs / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        this.timeText.setText(`⏱ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        this.levelText.setText(`Lv ${this.experienceSystem.getLevel()}`);
        this.killText.setText(`💀 ${this.killCount}`);
        this.goldText.setText(`💰 ${this.gold}`);

        const hpRatio = this.player.hp / this.player.maxHp;
        this.hpBarFill.width = 200 * hpRatio;

        const xpRatio = this.experienceSystem.getProgressRatio();
        this.xpBarFill.width = 320 * xpRatio;
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

        const titleStr = win ? 'DUNGEON CLEAR!' : 'GAME OVER';
        const titleColor = win ? '#55ff88' : '#ff5555';
        const title = this.add.text(width / 2, height / 2 - 120, titleStr, {
            fontSize: '42px', color: titleColor, stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5);
        overlay.add(title);

        const seconds = Math.floor(this.elapsedMs / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        const stats = this.add.text(width / 2, height / 2 - 30, `Time ${timeStr}\nLv ${this.experienceSystem.getLevel()}  |  Kills ${this.killCount}`, {
            fontSize: '20px', color: '#ffffff', align: 'center', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5);
        overlay.add(stats);

        // リトライ
        const retryBtn = this.add.text(width / 2, height / 2 + 60, 'Retry', {
            fontSize: '24px', color: '#ffe066', backgroundColor: '#1f1f2f',
            padding: { left: 18, right: 18, top: 10, bottom: 10 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        retryBtn.on('pointerdown', () => {
            this.scene.restart({
                player: this.playerDef,
                allUnits: this.allUnitsData,
                team: this.teamDefs,
                stageData: this.stageData,
                difficulty: this.difficulty,
            });
        });
        overlay.add(retryBtn);

        // コンティニュー
        if (!win && this.continueCount < this.maxContinues) {
            const continueBtn = this.add.text(width / 2, height / 2 + 120, `Continue (${this.maxContinues - this.continueCount})`, {
                fontSize: '22px', color: '#66ddff', backgroundColor: '#1f1f2f',
                padding: { left: 16, right: 16, top: 8, bottom: 8 },
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            continueBtn.on('pointerdown', () => this.handleContinue());
            overlay.add(continueBtn);
        }

        this.gameOverOverlay = overlay;

        // React側に通知
        const coinsGained = win ? this.stageData.reward.coins : Math.floor(this.killCount * 2);
        const event = win ? GameEvents.DUNGEON_WIN : GameEvents.DUNGEON_LOSE;
        eventBus.emit(event, coinsGained);
    }

    private handleContinue() {
        if (!this.gameOver) return;
        if (this.continueCount >= this.maxContinues) return;

        this.continueCount += 1;
        this.gameOverOverlay?.destroy();
        this.gameOverOverlay = undefined;

        this.projectiles.forEach(p => p.destroy());
        this.projectiles = [];
        this.enemies.forEach(e => e.destroy());
        this.enemies = [];

        this.player.hp = this.player.maxHp;
        this.player.x = this.scale.width / 2;
        this.player.y = this.scale.height / 2;
        this.player.grantInvincibility(2000);

        this.gameOver = false;
        this.gameState = 'PLAYING';
        this.updateHud();
    }

    // ============================================
    // ユーティリティ
    // ============================================

    private showFloatingText(x: number, y: number, message: string, color: number) {
        const text = this.add.text(x, y, message, {
            fontSize: '18px',
            color: `#${color.toString(16).padStart(6, '0')}`,
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5).setDepth(300);

        this.tweens.add({
            targets: text,
            y: y - 40,
            alpha: 0,
            duration: 800,
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
