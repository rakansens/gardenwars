import Phaser from 'phaser';
import type { UnitDefinition } from '@/data/types';
import { SurvivalPlayer } from './SurvivalPlayer';

interface SurvivalEnemyStats {
    maxHp: number;
    speed: number;
    attackDamage: number;
    attackRange: number;
    attackCooldownMs: number;
    isBoss?: boolean;
}

interface SurvivalEnemyConfig {
    spriteKey: string;
    flipSprite?: boolean;
    scale?: number;
    stats: SurvivalEnemyStats;
}

export class SurvivalEnemy extends Phaser.GameObjects.Container {
    public instanceId: string;
    public definition: UnitDefinition;
    public hp: number;
    public maxHp: number;
    public isBoss: boolean;

    private sprite: Phaser.GameObjects.Image;
    private attackDamage: number;
    private attackRange: number;
    private attackCooldownMs: number;
    private attackTimer: number = 0;
    private speed: number;
    private hitRadius: number;
    private hpBarBg?: Phaser.GameObjects.Rectangle;
    private hpBarFill?: Phaser.GameObjects.Rectangle;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        definition: UnitDefinition,
        config: SurvivalEnemyConfig
    ) {
        super(scene, x, y);

        this.instanceId = `sv_enemy_${definition.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        this.definition = definition;
        this.maxHp = Math.round(config.stats.maxHp);
        this.hp = this.maxHp;
        this.isBoss = !!config.stats.isBoss;
        this.attackDamage = config.stats.attackDamage;
        this.attackRange = config.stats.attackRange;
        this.attackCooldownMs = config.stats.attackCooldownMs;
        this.speed = config.stats.speed;

        this.sprite = scene.add.image(0, 0, config.spriteKey);
        const targetHeight = this.isBoss ? 90 : 45;
        const baseScale = targetHeight / this.sprite.height;
        this.sprite.setScale(baseScale * (config.scale ?? 1));
        this.sprite.setOrigin(0.5, 1);
        if (config.flipSprite) {
            this.sprite.setFlipX(true);
        }
        this.add(this.sprite);

        const barY = -this.sprite.displayHeight - (this.isBoss ? 18 : 12);
        const barWidth = this.isBoss ? 140 : 56;
        const barHeight = this.isBoss ? 10 : 6;
        const barBgColor = this.isBoss ? 0x2b2b2b : 0x1f1f1f;
        const barFillColor = this.isBoss ? 0xff4444 : 0xff7777;

        this.hpBarBg = scene.add.rectangle(0, barY, barWidth, barHeight, barBgColor);
        this.hpBarFill = scene.add.rectangle(0, barY, barWidth, barHeight, barFillColor);
        this.hpBarBg.setOrigin(0.5, 0.5);
        this.hpBarFill.setOrigin(0.5, 0.5);
        this.add(this.hpBarBg);
        this.add(this.hpBarFill);

        this.hitRadius = Math.max(16, this.sprite.displayWidth * 0.33);

        scene.add.existing(this);
        this.setDepth(8);
    }

    update(delta: number, player: SurvivalPlayer) {
        if (this.isDead()) return;

        this.attackTimer = Math.max(0, this.attackTimer - delta);

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.001) {
            const move = (this.speed * delta) / 1000;
            const nx = dx / dist;
            const ny = dy / dist;
            this.x += nx * move;
            this.y += ny * move;
            this.sprite.setFlipX(nx < 0);
        }

        if (dist <= this.attackRange && this.attackTimer <= 0) {
            player.takeDamage(this.attackDamage);
            this.attackTimer = this.attackCooldownMs;
        }
    }

    takeDamage(amount: number, _knockback?: number) {
        this.hp = Math.max(0, this.hp - amount);
        if (this.hpBarFill) {
            const ratio = this.hp / this.maxHp;
            this.hpBarFill.setScale(Math.max(0.05, ratio), 1);
        }
        if (this.hp <= 0) {
            this.scene.tweens.add({
                targets: this,
                alpha: 0,
                duration: 180,
            });
        }
    }

    isDead(): boolean {
        return this.hp <= 0;
    }

    getHitRadius(): number {
        return this.hitRadius;
    }
}
