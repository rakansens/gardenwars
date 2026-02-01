import Phaser from 'phaser';
import { SurvivalPlayer } from '../entities/SurvivalPlayer';

interface ExperienceOrb {
    sprite: Phaser.GameObjects.Arc;
    value: number;
}

export class ExperienceSystem {
    private scene: Phaser.Scene;
    private orbs: ExperienceOrb[] = [];
    private currentXp: number = 0;
    private level: number = 1;
    private xpToNext: number = 20;
    private magnetRadius: number = 220;
    private pickupRadius: number = 28;
    private magnetSpeed: number = 260;
    private onLevelUp: (level: number) => void;
    private xpGainMultiplier: number = 1;

    constructor(
        scene: Phaser.Scene,
        onLevelUp: (level: number) => void,
        options?: { xpGainMultiplier?: number }
    ) {
        this.scene = scene;
        this.onLevelUp = onLevelUp;
        this.xpGainMultiplier = options?.xpGainMultiplier ?? 1;
        this.xpToNext = this.computeXpToNext(this.level);
    }

    spawnOrb(x: number, y: number, value: number) {
        const size = value >= 5 ? 6 : 4;
        const color = value >= 5 ? 0x66ddff : 0x55ff88;
        const sprite = this.scene.add.circle(x, y, size, color, 0.9);
        sprite.setDepth(20);
        this.orbs.push({ sprite, value });
    }

    update(delta: number, player: SurvivalPlayer) {
        const px = player.x;
        const py = player.y;

        for (let i = this.orbs.length - 1; i >= 0; i--) {
            const orb = this.orbs[i];
            const dx = px - orb.sprite.x;
            const dy = py - orb.sprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= this.pickupRadius) {
                orb.sprite.destroy();
                this.orbs.splice(i, 1);
                this.addExperience(orb.value);
                continue;
            }

            if (dist <= this.magnetRadius) {
                const speed = this.magnetSpeed + (this.magnetRadius - dist) * 1.2;
                const move = (speed * delta) / 1000;
                orb.sprite.x += (dx / dist) * move;
                orb.sprite.y += (dy / dist) * move;
            }
        }
    }

    addExperience(amount: number) {
        this.currentXp += amount * this.xpGainMultiplier;
        while (this.currentXp >= this.xpToNext) {
            this.currentXp -= this.xpToNext;
            this.level += 1;
            this.xpToNext = this.computeXpToNext(this.level);
            this.onLevelUp(this.level);
        }
    }

    getLevel(): number {
        return this.level;
    }

    getXpToNext(): number {
        return this.xpToNext;
    }

    getCurrentXp(): number {
        return this.currentXp;
    }

    getProgressRatio(): number {
        return Math.min(1, this.currentXp / this.xpToNext);
    }

    private computeXpToNext(level: number): number {
        return Math.floor(18 + level * 10 + level * level * 1.6);
    }
}
