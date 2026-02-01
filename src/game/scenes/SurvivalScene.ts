import Phaser from 'phaser';
import type { UnitDefinition, SurvivalWeaponDefinition, Rarity, SurvivalDifficulty } from '@/data/types';
import { survivalWaves } from '@/data/survival';
import { getSpritePath } from '@/lib/sprites';
import { SurvivalPlayer } from '../entities/SurvivalPlayer';
import { SurvivalEnemy } from '../entities/SurvivalEnemy';
import { Projectile } from '../entities/Projectile';
import { SurvivalSpawner, SurvivalDifficultyModifiers } from '../systems/SurvivalSpawner';
import { WeaponSystem } from '../systems/WeaponSystem';
import { ExperienceSystem } from '../systems/ExperienceSystem';
import { CannonSystem, CannonTarget } from '../systems/CannonSystem';

export interface SurvivalSceneData {
    player: UnitDefinition;
    allUnits: UnitDefinition[];
    difficulty?: SurvivalDifficulty;
}

type SurvivalState = 'PLAYING' | 'LEVEL_UP' | 'GAME_OVER';

const DIFFICULTY_MODIFIERS: Record<SurvivalDifficulty, SurvivalDifficultyModifiers> = {
    easy: {
        spawnInterval: 1.2,
        minInterval: 1.15,
        intervalDecay: 0.85,
        extraSpawnChance: 0.7,
        hpScaling: 0.85,
        damageScaling: 0.85,
        speedScaling: 0.9,
        bossHp: 0.85,
        bossDamage: 0.85,
    },
    normal: {
        spawnInterval: 1,
        minInterval: 1,
        intervalDecay: 1,
        extraSpawnChance: 1,
        hpScaling: 1,
        damageScaling: 1,
        speedScaling: 1,
        bossHp: 1,
        bossDamage: 1,
    },
    hard: {
        spawnInterval: 0.85,
        minInterval: 0.85,
        intervalDecay: 1.2,
        extraSpawnChance: 1.3,
        hpScaling: 1.2,
        damageScaling: 1.2,
        speedScaling: 1.1,
        bossHp: 1.25,
        bossDamage: 1.25,
    },
};

export class SurvivalScene extends Phaser.Scene {
    private playerDef!: UnitDefinition;
    private allUnitsData: UnitDefinition[] = [];

    private player!: SurvivalPlayer;
    private enemies: SurvivalEnemy[] = [];
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

    private gameState: SurvivalState = 'PLAYING';
    private elapsedMs: number = 0;
    private killCount: number = 0;

    private timeText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    private killText!: Phaser.GameObjects.Text;
    private hpBarBg!: Phaser.GameObjects.Rectangle;
    private hpBarFill!: Phaser.GameObjects.Rectangle;
    private xpBarBg!: Phaser.GameObjects.Rectangle;
    private xpBarFill!: Phaser.GameObjects.Rectangle;
    private levelUpOverlay?: Phaser.GameObjects.Container;
    private gameOverOverlay?: Phaser.GameObjects.Container;
    private bgFar?: Phaser.GameObjects.TileSprite;
    private bgNear?: Phaser.GameObjects.TileSprite;
    private continueCount: number = 0;
    private maxContinues: number = 3;
    private difficulty: SurvivalDifficulty = 'normal';

    constructor() {
        super({ key: 'SurvivalScene' });
    }

    init(data: SurvivalSceneData) {
        this.playerDef = data.player;
        this.allUnitsData = data.allUnits;
        this.difficulty = data.difficulty ?? 'normal';
        this.enemies = [];
        this.projectiles = [];
        this.elapsedMs = 0;
        this.killCount = 0;
        this.gameState = 'PLAYING';
        this.levelUpOverlay?.destroy();
        this.gameOverOverlay?.destroy();
        this.continueCount = 0;
    }

    preload() {
        this.load.image('survival_bg', '/assets/stages/boss_stage_4.webp');

        const unitsToLoad = new Map<string, { spriteId: string; rarity?: Rarity }>();

        const addUnit = (unitId: string) => {
            const unitDef = this.allUnitsData.find(u => u.id === unitId);
            if (!unitDef) return;
            const spriteId = unitDef.baseUnitId || unitDef.atlasKey || unitDef.id;
            let rarity = unitDef.rarity;
            if (unitDef.baseUnitId) {
                const baseUnit = this.allUnitsData.find(u => u.id === unitDef.baseUnitId);
                if (baseUnit) rarity = baseUnit.rarity;
            }
            unitsToLoad.set(unitId, { spriteId, rarity });
        };

        addUnit(this.playerDef.id);

        survivalWaves.enemyPools.forEach(pool => {
            pool.unitIds.forEach(id => addUnit(id));
        });
        survivalWaves.boss.unitIds.forEach(id => addUnit(id));

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

        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e).setDepth(0);
        this.bgFar = this.add.tileSprite(width / 2, height / 2, width, height, 'survival_bg');
        this.bgFar.setDepth(1);
        this.bgFar.setTileScale(1.05, 1.05);
        this.bgFar.setAlpha(0.9);
        this.bgNear = this.add.tileSprite(width / 2, height / 2, width, height, 'survival_bg');
        this.bgNear.setDepth(2);
        this.bgNear.setTileScale(1.25, 1.25);
        this.bgNear.setAlpha(0.12);
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.12).setDepth(3);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D') as any;

        const playerSpriteId = this.playerDef.baseUnitId || this.playerDef.atlasKey || this.playerDef.id;
        this.player = new SurvivalPlayer(this, width / 2, height / 2, this.playerDef, {
            spriteKey: playerSpriteId,
            hpMultiplier: 3.2,
            baseSpeedMultiplier: 1.8,
        });
        this.player.setDepth(10);

        this.weaponSystem = new WeaponSystem(this, this.player, this.enemies, this.projectiles);
        this.weaponSystem.applyUpgrade('forward_shot');
        this.experienceSystem = new ExperienceSystem(
            this,
            () => {
                this.triggerLevelUp();
            },
            { xpGainMultiplier: 2 }
        );
        this.spawner = new SurvivalSpawner(this, {
            allUnits: this.allUnitsData,
            enemies: this.enemies,
            difficultyModifiers: DIFFICULTY_MODIFIERS[this.difficulty] ?? DIFFICULTY_MODIFIERS.normal,
        });

        this.cannonSystem = new CannonSystem(this);
        const bombBtn = this.cannonSystem.createUI(width - 70, height - 70, 0);
        bombBtn.on('pointerdown', () => {
            if (this.gameState !== 'PLAYING') return;
            const targets = this.enemies.filter(enemy => !enemy.isDead()) as CannonTarget[];
            this.cannonSystem.fireArea(
                this.player.x,
                this.player.y - 20,
                targets,
                220,
                { damage: 180, knockback: 70 }
            );
        });

        this.createHud();

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
            if (this.gameState !== 'PLAYING') return;
            if (currentlyOver && currentlyOver.length > 0) return;
            this.pointerActive = true;
            this.pointerId = pointer.id;
            this.pointerTarget.set(pointer.worldX, pointer.worldY);
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
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
        if (this.gameState === 'GAME_OVER') return;
        if (this.gameState !== 'PLAYING') {
            return;
        }

        this.cannonSystem.update(delta);
        this.updateBackgroundScroll(delta);

        this.elapsedMs += delta;

        this.updatePlayerMovement(delta);
        this.spawner.update(delta, this.player.x, this.player.y);
        this.weaponSystem.update(delta);
        this.updateProjectiles(delta);
        this.updateEnemies(delta);
        this.experienceSystem.update(delta, this.player);

        this.updateHud();

        if (this.player.isDead()) {
            this.endGame();
        }
    }

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

        let dirX = 0;
        let dirY = 0;
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
        const drift = delta * 0.012;
        this.bgFar.tilePositionX += drift;
        this.bgFar.tilePositionY += drift * 0.4;
        this.bgNear.tilePositionX += drift * 1.8;
        this.bgNear.tilePositionY += drift * 0.7;
    }

    private updateProjectiles(delta: number) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            const alive = projectile.update(delta);
            if (!alive) {
                this.projectiles.splice(i, 1);
                continue;
            }

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
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (!enemy.isDead()) continue;
            this.spawnExperience(enemy.x, enemy.y, enemy.isBoss);
            enemy.destroy();
            this.enemies.splice(i, 1);
            this.killCount += 1;
        }
    }

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

    private createHud() {
        const { width, height } = this.scale;

        this.timeText = this.add.text(16, 12, '⏱ 00:00', {
            fontSize: '18px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
        }).setDepth(100);

        this.levelText = this.add.text(16, 36, 'Lv 1', {
            fontSize: '16px',
            color: '#ffe066',
            stroke: '#000000',
            strokeThickness: 3,
        }).setDepth(100);

        this.killText = this.add.text(16, 58, '💀 0', {
            fontSize: '16px',
            color: '#ffb366',
            stroke: '#000000',
            strokeThickness: 3,
        }).setDepth(100);

        this.hpBarBg = this.add.rectangle(16, 86, 200, 12, 0x2f2f2f).setOrigin(0, 0.5).setDepth(100);
        this.hpBarFill = this.add.rectangle(16, 86, 200, 12, 0x55ff88).setOrigin(0, 0.5).setDepth(101);

        this.xpBarBg = this.add.rectangle(width / 2 - 160, height - 22, 320, 10, 0x222222).setOrigin(0, 0.5).setDepth(100);
        this.xpBarFill = this.add.rectangle(width / 2 - 160, height - 22, 320, 10, 0x66ddff).setOrigin(0, 0.5).setDepth(101);
    }

    private updateHud() {
        const seconds = Math.floor(this.elapsedMs / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        this.timeText.setText(`⏱ ${timeStr}`);
        this.levelText.setText(`Lv ${this.experienceSystem.getLevel()}`);
        this.killText.setText(`💀 ${this.killCount}`);

        const hpRatio = this.player.hp / this.player.maxHp;
        this.hpBarFill.width = 200 * hpRatio;

        const xpRatio = this.experienceSystem.getProgressRatio();
        this.xpBarFill.width = 320 * xpRatio;
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

    private showLevelUpOptions(options: SurvivalWeaponDefinition[]) {
        const { width, height } = this.scale;
        const overlay = this.add.container(0, 0).setDepth(200);

        const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);
        overlay.add(bg);

        const title = this.add.text(width / 2, height / 2 - 150, 'LEVEL UP!', {
            fontSize: '36px',
            color: '#ffe066',
            stroke: '#000000',
            strokeThickness: 4,
        });
        title.setOrigin(0.5, 0.5);
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
            const name = this.add.text(x, y - 24, option.name, {
                fontSize: '18px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
            });
            name.setOrigin(0.5, 0.5);

            const desc = this.add.text(x, y + 6, option.description, {
                fontSize: '14px',
                color: '#cbd5f5',
            });
            desc.setOrigin(0.5, 0.5);

            const levelText = this.add.text(x, y + 36, `Lv ${level + 1}/${option.maxLevel}`, {
                fontSize: '12px',
                color: '#ffe066',
            });
            levelText.setOrigin(0.5, 0.5);

            card.on('pointerdown', () => {
                this.weaponSystem.applyUpgrade(option.id);
                this.closeLevelUp();
            });

            overlay.add(card);
            overlay.add(name);
            overlay.add(desc);
            overlay.add(levelText);
        });

        this.levelUpOverlay = overlay;

        const keys = this.input.keyboard.addKeys('ONE,TWO,THREE') as any;
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

        this.input.keyboard.on('keydown', onKey);
        overlay.once('destroy', () => {
            this.input.keyboard.off('keydown', onKey);
        });
    }

    private closeLevelUp() {
        this.levelUpOverlay?.destroy();
        this.levelUpOverlay = undefined;
        this.gameState = 'PLAYING';
    }

    private endGame() {
        if (this.gameState === 'GAME_OVER') return;
        this.gameState = 'GAME_OVER';

        const { width, height } = this.scale;
        const overlay = this.add.container(0, 0).setDepth(220);

        const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78);
        overlay.add(bg);

        const title = this.add.text(width / 2, height / 2 - 120, 'GAME OVER', {
            fontSize: '42px',
            color: '#ff5555',
            stroke: '#000000',
            strokeThickness: 4,
        });
        title.setOrigin(0.5, 0.5);
        overlay.add(title);

        const seconds = Math.floor(this.elapsedMs / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        const stats = this.add.text(width / 2, height / 2 - 30, `Time ${timeStr}\nLv ${this.experienceSystem.getLevel()}  |  Kills ${this.killCount}`, {
            fontSize: '20px',
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3,
        });
        stats.setOrigin(0.5, 0.5);
        overlay.add(stats);

        const retryBtn = this.add.text(width / 2, height / 2 + 60, 'Retry', {
            fontSize: '24px',
            color: '#ffe066',
            backgroundColor: '#1f1f2f',
            padding: { left: 18, right: 18, top: 10, bottom: 10 },
        });
        retryBtn.setOrigin(0.5, 0.5);
        retryBtn.setInteractive({ useHandCursor: true });
        retryBtn.on('pointerdown', () => {
            this.scene.restart({ player: this.playerDef, allUnits: this.allUnitsData, difficulty: this.difficulty });
        });
        overlay.add(retryBtn);

        if (this.continueCount < this.maxContinues) {
            const continueBtn = this.add.text(width / 2, height / 2 + 120, `Continue (${this.maxContinues - this.continueCount})`, {
                fontSize: '22px',
                color: '#66ddff',
                backgroundColor: '#1f1f2f',
                padding: { left: 16, right: 16, top: 8, bottom: 8 },
            });
            continueBtn.setOrigin(0.5, 0.5);
            continueBtn.setInteractive({ useHandCursor: true });
            continueBtn.on('pointerdown', () => {
                this.handleContinue();
            });
            overlay.add(continueBtn);
        }

        this.gameOverOverlay = overlay;
    }

    private handleContinue() {
        if (this.gameState !== 'GAME_OVER') return;
        if (this.continueCount >= this.maxContinues) return;

        this.continueCount += 1;
        this.gameOverOverlay?.destroy();
        this.gameOverOverlay = undefined;

        // Clear existing threats
        this.projectiles.forEach(projectile => projectile.destroy());
        this.projectiles = [];
        this.enemies.forEach(enemy => enemy.destroy());
        this.enemies = [];

        // Restore player
        this.player.hp = this.player.maxHp;
        this.player.x = this.scale.width / 2;
        this.player.y = this.scale.height / 2;
        this.player.grantInvincibility(2000);

        this.gameState = 'PLAYING';
        this.updateHud();
    }
}
