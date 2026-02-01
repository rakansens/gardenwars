import Phaser from 'phaser';
import type { SurvivalWeaponDefinition, SurvivalWeaponLevel } from '@/data/types';
import { survivalWeapons } from '@/data/survival';
import { SurvivalPlayer } from '../entities/SurvivalPlayer';
import { SurvivalEnemy } from '../entities/SurvivalEnemy';
import { Projectile } from '../entities/Projectile';

const WEAPON_IDS = {
    FORWARD_SHOT: 'forward_shot',
    FIRE_RATE: 'fire_rate',
    SPIN_BLADE: 'spin_blade',
    AOE_BURST: 'aoe_burst',
    MOVE_SPEED: 'move_speed',
    HP_REGEN: 'hp_regen',
} as const;

export class WeaponSystem {
    private scene: Phaser.Scene;
    private player: SurvivalPlayer;
    private enemies: SurvivalEnemy[];
    private projectiles: Projectile[];
    private weaponDefs: Map<string, SurvivalWeaponDefinition>;
    private weaponLevels: Map<string, number> = new Map();

    private forwardShotTimer: number = 0;
    private forwardShotCooldownMultiplier: number = 1;
    private aoeTimer: number = 0;
    private aoeDamage: number = 0;
    private aoeRadius: number = 0;
    private aoeCooldownMs: number = 0;

    private blades: { container: Phaser.GameObjects.Container; angle: number }[] = [];
    private bladeDamage: number = 0;
    private bladeRadius: number = 70;
    private bladeRotationSpeed: number = 2.2;
    private bladeHitCooldownMs: number = 220;
    private bladeHitMap: Map<string, number> = new Map();

    private regenPerSecond: number = 0;

    constructor(scene: Phaser.Scene, player: SurvivalPlayer, enemies: SurvivalEnemy[], projectiles: Projectile[]) {
        this.scene = scene;
        this.player = player;
        this.enemies = enemies;
        this.projectiles = projectiles;
        this.weaponDefs = new Map(survivalWeapons.map(w => [w.id, w]));
    }

    update(delta: number) {
        this.updateForwardShot(delta);
        this.updateSpinBlades(delta);
        this.updateAoe(delta);
        this.updateRegen(delta);
    }

    getUpgradeOptions(count: number): SurvivalWeaponDefinition[] {
        const available = survivalWeapons.filter(def => {
            const level = this.getLevel(def.id);
            return level < def.maxLevel;
        });

        if (available.length === 0) return [];
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.max(1, Math.min(count, shuffled.length)));
    }

    applyUpgrade(id: string) {
        const def = this.weaponDefs.get(id);
        if (!def) return;
        const currentLevel = this.getLevel(id);
        if (currentLevel >= def.maxLevel) return;

        const newLevel = currentLevel + 1;
        this.weaponLevels.set(id, newLevel);
        const levelData = def.levels[newLevel - 1];

        switch (id) {
            case WEAPON_IDS.FORWARD_SHOT:
                if (this.forwardShotTimer <= 0) {
                    this.forwardShotTimer = (levelData.cooldownMs ?? 700) * this.forwardShotCooldownMultiplier;
                }
                break;
            case WEAPON_IDS.FIRE_RATE: {
                const multiplier = levelData.cooldownMultiplier ?? 1;
                this.forwardShotCooldownMultiplier = Math.max(0.4, Math.min(1, multiplier));
                break;
            }
            case WEAPON_IDS.SPIN_BLADE:
                this.configureBlades(levelData);
                break;
            case WEAPON_IDS.AOE_BURST:
                this.aoeDamage = levelData.damage ?? 40;
                this.aoeRadius = levelData.radius ?? 140;
                this.aoeCooldownMs = levelData.cooldownMs ?? 3000;
                if (this.aoeTimer <= 0) {
                    this.aoeTimer = this.aoeCooldownMs;
                }
                break;
            case WEAPON_IDS.MOVE_SPEED: {
                const speedPct = levelData.moveSpeedPct ?? 0;
                this.player.setSpeedMultiplier(1 + speedPct);
                break;
            }
            case WEAPON_IDS.HP_REGEN:
                this.regenPerSecond = levelData.healPerSecond ?? 0;
                break;
        }
    }

    getLevel(id: string): number {
        return this.weaponLevels.get(id) ?? 0;
    }

    private updateForwardShot(delta: number) {
        const level = this.getLevel(WEAPON_IDS.FORWARD_SHOT);
        if (level <= 0) return;

        const def = this.weaponDefs.get(WEAPON_IDS.FORWARD_SHOT)!;
        const levelData = def.levels[level - 1];

        this.forwardShotTimer -= delta;
        if (this.forwardShotTimer > 0) return;

        const cooldown = levelData.cooldownMs ?? 700;
        this.forwardShotTimer = cooldown * this.forwardShotCooldownMultiplier;

        const target = this.getNearestEnemy();
        const baseDir = target
            ? new Phaser.Math.Vector2(target.x - this.player.x, target.y - this.player.y).normalize()
            : new Phaser.Math.Vector2(1, 0);

        const count = levelData.count ?? 1;
        const spread = (levelData.spread ?? 10) * (Math.PI / 180);
        const speed = levelData.speed ?? 420;
        const damage = levelData.damage ?? 18;

        for (let i = 0; i < count; i++) {
            const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
            const dir = baseDir.clone().rotate(offset);
            const projectile = new Projectile(this.scene, {
                x: this.player.x,
                y: this.player.y - 20,
                velocityX: dir.x * speed,
                velocityY: dir.y * speed,
                damage,
                radius: 6,
                color: 0xffcc33,
                glowColor: 0xffff99,
                lifeMs: 2000,
            });
            this.projectiles.push(projectile);
        }
    }

    private updateSpinBlades(delta: number) {
        if (this.blades.length === 0) return;
        const elapsed = (delta / 1000) * this.bladeRotationSpeed;
        const now = this.scene.time.now;

        for (const blade of this.blades) {
            blade.angle += elapsed;
            const x = this.player.x + Math.cos(blade.angle) * this.bladeRadius;
            const y = this.player.y + Math.sin(blade.angle) * this.bladeRadius;
            blade.container.x = x;
            blade.container.y = y;
            blade.container.rotation = blade.angle;
        }

        for (const enemy of this.enemies) {
            if (enemy.isDead()) continue;
            const lastHit = this.bladeHitMap.get(enemy.instanceId) ?? 0;
            if (now - lastHit < this.bladeHitCooldownMs) continue;

            for (const blade of this.blades) {
                const dx = enemy.x - blade.container.x;
                const dy = enemy.y - blade.container.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= enemy.getHitRadius() + 12) {
                    enemy.takeDamage(this.bladeDamage);
                    this.bladeHitMap.set(enemy.instanceId, now);
                    break;
                }
            }
        }
    }

    private updateAoe(delta: number) {
        const level = this.getLevel(WEAPON_IDS.AOE_BURST);
        if (level <= 0) return;
        if (this.aoeCooldownMs <= 0) return;

        this.aoeTimer -= delta;
        if (this.aoeTimer > 0) return;
        this.aoeTimer = this.aoeCooldownMs;

        const centerX = this.player.x;
        const centerY = this.player.y;
        this.createAoeEffect(centerX, centerY, this.aoeRadius);

        for (const enemy of this.enemies) {
            if (enemy.isDead()) continue;
            const dx = enemy.x - centerX;
            const dy = enemy.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= this.aoeRadius) {
                enemy.takeDamage(this.aoeDamage);
            }
        }
    }

    private updateRegen(delta: number) {
        if (this.regenPerSecond <= 0) return;
        const heal = (this.regenPerSecond * delta) / 1000;
        this.player.heal(heal);
    }

    private configureBlades(levelData: SurvivalWeaponLevel) {
        const nextDamage = levelData.damage ?? this.bladeDamage;
        this.bladeDamage = nextDamage && nextDamage > 0 ? nextDamage : 12;
        this.bladeRadius = levelData.radius ?? this.bladeRadius;
        this.bladeRotationSpeed = levelData.rotationSpeed ?? this.bladeRotationSpeed;

        const desiredCount = levelData.bladeCount ?? 1;
        while (this.blades.length < desiredCount) {
            const angle = (Math.PI * 2 * this.blades.length) / desiredCount;
            const container = this.scene.add.container(this.player.x, this.player.y);
            container.setDepth(40);

            const glow = this.scene.add.circle(-4, 0, 12, 0x66ddff, 0.25);
            const blade = this.scene.add.triangle(0, 0, -8, -5, 16, 0, -8, 5, 0x66ddff, 1);
            blade.setOrigin(0.2, 0.5);
            blade.setStrokeStyle(2, 0xffffff, 0.6);

            container.add([glow, blade]);

            this.scene.tweens.add({
                targets: [glow, blade],
                alpha: { from: 0.7, to: 1 },
                duration: 500,
                yoyo: true,
                repeat: -1,
            });

            this.blades.push({ container, angle });
        }

        while (this.blades.length > desiredCount) {
            const blade = this.blades.pop();
            blade?.container.destroy();
        }

        const count = this.blades.length;
        for (let i = 0; i < count; i++) {
            this.blades[i].angle = (Math.PI * 2 * i) / count;
        }
    }

    private getNearestEnemy(): SurvivalEnemy | null {
        let best: SurvivalEnemy | null = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const enemy of this.enemies) {
            if (enemy.isDead()) continue;
            const dx = enemy.x - this.player.x;
            const dy = enemy.y - this.player.y;
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) {
                bestDist = dist;
                best = enemy;
            }
        }
        return best;
    }

    private createAoeEffect(x: number, y: number, radius: number) {
        const wave = this.scene.add.circle(x, y, 20, 0xff4400, 0.5);
        wave.setStrokeStyle(6, 0xff0000);
        wave.setDepth(50);

        this.scene.tweens.add({
            targets: wave,
            radius,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => wave.destroy(),
        });

        const inner = this.scene.add.circle(x, y, 12, 0xffaa00, 0.4);
        inner.setDepth(51);
        this.scene.tweens.add({
            targets: inner,
            radius: radius * 0.6,
            alpha: 0,
            duration: 420,
            ease: 'Power2',
            onComplete: () => inner.destroy(),
        });

        const boom = this.scene.add.text(x, y - 30, '🔥', { fontSize: '64px' });
        boom.setOrigin(0.5, 0.5);
        boom.setDepth(52);
        this.scene.tweens.add({
            targets: boom,
            y: y - 90,
            alpha: 0,
            duration: 650,
            ease: 'Power2',
            onComplete: () => boom.destroy(),
        });
    }
}
