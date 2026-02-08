import Phaser from 'phaser';
import type { UnitDefinition } from '@/data/types';
import { getSkillById } from '@/data/skills';

interface DungeonGuardConfig {
    spriteKey: string;
    scale?: number;
}

interface GuardTarget {
    x: number;
    y: number;
    takeDamage: (amount: number, knockback?: number) => void;
    isDead: () => boolean;
    getHitRadius: () => number;
    // スロー用
    slowFactor?: number;
    slowTimer?: number;
    // バーン用
    burnDps?: number;
    burnTimer?: number;
}

export class DungeonGuard extends Phaser.GameObjects.Container {
    public definition: UnitDefinition;
    public hp: number;
    public maxHp: number;
    public guardId: string;

    private sprite: Phaser.GameObjects.Image;
    private attackTimer: number = 0;
    private attackRange: number;
    private attackDamage: number;
    private attackCooldownMs: number;
    private hpBarBg: Phaser.GameObjects.Rectangle;
    private hpBarFill: Phaser.GameObjects.Rectangle;
    private hitRadius: number;
    private dead: boolean = false;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        definition: UnitDefinition,
        config: DungeonGuardConfig
    ) {
        super(scene, x, y);

        this.guardId = `guard_${definition.id}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        this.definition = definition;
        this.maxHp = Math.round(definition.maxHp * 2.5); // ガードはHP高め
        this.hp = this.maxHp;
        this.attackRange = Math.min(180, Math.max(60, definition.attackRange));
        this.attackDamage = definition.attackDamage;
        this.attackCooldownMs = Math.max(400, definition.attackCooldownMs);

        // スプライト
        this.sprite = scene.add.image(0, 0, config.spriteKey);
        const targetHeight = 50;
        const spriteHeight = this.sprite.height > 0 ? this.sprite.height : 1;
        const baseScale = targetHeight / spriteHeight;
        this.sprite.setScale(baseScale * (config.scale ?? 1));
        this.sprite.setOrigin(0.5, 1);
        this.add(this.sprite);

        // HPバー
        const barY = -this.sprite.displayHeight - 10;
        const barWidth = 40;
        const barHeight = 5;
        this.hpBarBg = scene.add.rectangle(0, barY, barWidth, barHeight, 0x1f1f1f);
        this.hpBarFill = scene.add.rectangle(0, barY, barWidth, barHeight, 0x55ff88);
        this.hpBarBg.setOrigin(0.5, 0.5);
        this.hpBarFill.setOrigin(0.5, 0.5);
        this.add(this.hpBarBg);
        this.add(this.hpBarFill);

        this.hitRadius = Math.max(16, this.sprite.displayWidth * 0.35);

        // スキルアイコン表示
        const skill = definition.skillId ? getSkillById(definition.skillId) : undefined;
        if (skill?.icon) {
            const icon = scene.add.text(16, -this.sprite.displayHeight - 8, skill.icon, {
                fontSize: '10px',
            }).setOrigin(0.5);
            this.add(icon);
        }

        scene.add.existing(this);
        this.setDepth(12);
    }

    update(delta: number, enemies: GuardTarget[]): GuardTarget | null {
        if (this.dead) return null;

        this.attackTimer = Math.max(0, this.attackTimer - delta);

        if (this.attackTimer > 0) return null;

        // 射程内の最も近い敵を探す
        let nearest: GuardTarget | null = null;
        let nearestDist = Infinity;

        for (const enemy of enemies) {
            if (enemy.isDead()) continue;
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= this.attackRange && dist < nearestDist) {
                nearest = enemy;
                nearestDist = dist;
            }
        }

        if (!nearest) return null;

        // 攻撃実行
        nearest.takeDamage(this.attackDamage);
        this.attackTimer = this.attackCooldownMs;

        // 攻撃方向にフリップ
        if (nearest.x < this.x) {
            this.sprite.setFlipX(true);
        } else {
            this.sprite.setFlipX(false);
        }

        // 攻撃エフェクト
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.15,
            scaleY: 0.9,
            duration: 80,
            yoyo: true,
            ease: 'Power2',
        });

        return nearest; // スキル処理用に返す
    }

    takeDamage(amount: number) {
        if (this.dead) return;
        this.hp = Math.max(0, this.hp - amount);

        // HPバー更新
        const ratio = this.hp / this.maxHp;
        this.hpBarFill.setScale(Math.max(0.05, ratio), 1);
        if (ratio < 0.3) this.hpBarFill.fillColor = 0xff4444;
        else if (ratio < 0.6) this.hpBarFill.fillColor = 0xffaa00;

        // 被弾フラッシュ
        this.sprite.setTint(0xff5555);
        this.scene.time.delayedCall(100, () => {
            if (!this.dead) this.sprite.clearTint();
        });
    }

    isDead(): boolean {
        if (this.dead) return true;
        if (this.hp <= 0) {
            this.dead = true;
            // 死亡エフェクト
            this.scene.tweens.add({
                targets: this,
                alpha: 0,
                scaleX: 0.3,
                scaleY: 0.3,
                duration: 300,
                onComplete: () => {
                    this.destroy();
                },
            });
            return true;
        }
        return false;
    }

    getHitRadius(): number {
        return this.hitRadius;
    }

    getAttackRange(): number {
        return this.attackRange;
    }

    getPlaceCost(): number {
        const costMap: Record<string, number> = {
            N: 30, R: 60, SR: 120, SSR: 200, UR: 350,
        };
        return costMap[this.definition.rarity] || 50;
    }
}
