import Phaser from 'phaser';
import type { UnitDefinition } from '@/data/types';

interface SurvivalPlayerConfig {
    spriteKey: string;
    hpMultiplier?: number;
    baseSpeedMultiplier?: number;
}

export class SurvivalPlayer extends Phaser.GameObjects.Container {
    public definition: UnitDefinition;
    public hp: number;
    public maxHp: number;

    private sprite: Phaser.GameObjects.Image;
    private baseSpeed: number;
    private speedMultiplier: number = 1;
    private hitRadius: number = 30;
    private lastHitAt: number = 0;
    private hitFlashTimer?: Phaser.Time.TimerEvent;
    private invincibleUntil: number = 0;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        definition: UnitDefinition,
        config: SurvivalPlayerConfig
    ) {
        super(scene, x, y);

        this.definition = definition;
        this.maxHp = Math.round(definition.maxHp * (config.hpMultiplier ?? 3.2));
        this.hp = this.maxHp;

        this.baseSpeed = definition.speed * (config.baseSpeedMultiplier ?? 1.4);

        this.sprite = scene.add.image(0, 0, config.spriteKey);
        const targetHeight = 60;
        const scale = targetHeight / this.sprite.height;
        const customScale = Math.min(definition.scale ?? 1, 1.6);
        this.sprite.setScale(scale * customScale);
        this.sprite.setOrigin(0.5, 1);
        this.add(this.sprite);

        this.hitRadius = Math.max(18, this.sprite.displayWidth * 0.35);

        scene.add.existing(this);
    }

    getSpeed(): number {
        return this.baseSpeed * this.speedMultiplier;
    }

    setSpeedMultiplier(multiplier: number) {
        this.speedMultiplier = Math.max(0.3, multiplier);
    }

    getHitRadius(): number {
        return this.hitRadius;
    }

    takeDamage(amount: number): boolean {
        const now = this.scene.time.now;
        if (now < this.invincibleUntil) return false;
        if (now - this.lastHitAt < 120) return false;
        this.lastHitAt = now;

        this.hp = Math.max(0, this.hp - amount);

        this.sprite.setTint(0xff5555);
        this.hitFlashTimer?.remove(false);
        this.hitFlashTimer = this.scene.time.delayedCall(120, () => {
            this.sprite.clearTint();
        });

        return true;
    }

    grantInvincibility(durationMs: number) {
        this.invincibleUntil = Math.max(this.invincibleUntil, this.scene.time.now + durationMs);
    }

    heal(amount: number) {
        if (amount <= 0) return;
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    isDead(): boolean {
        return this.hp <= 0;
    }

    setFacing(directionX: number) {
        if (directionX === 0) return;
        this.sprite.setFlipX(directionX < 0);
    }
}
