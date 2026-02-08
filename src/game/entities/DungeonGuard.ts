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
}

// レアリティ別倍率
const RARITY_MULTIPLIERS: Record<string, { damage: number; hp: number; range: number; speed: number }> = {
    N: { damage: 0.8, hp: 0.8, range: 0.85, speed: 1.0 },
    R: { damage: 1.0, hp: 1.0, range: 1.0, speed: 1.0 },
    SR: { damage: 1.3, hp: 1.3, range: 1.15, speed: 1.1 },
    SSR: { damage: 1.6, hp: 1.6, range: 1.3, speed: 1.2 },
    UR: { damage: 2.0, hp: 2.0, range: 1.5, speed: 1.3 },
};

export class DungeonGuard extends Phaser.GameObjects.Container {
    public definition: UnitDefinition;
    public hp: number;
    public maxHp: number;
    public guardId: string;

    // バフ倍率（レベルアップで変更可能）
    public damageMultiplier: number = 1;
    public speedMultiplier: number = 1;
    public rangeMultiplier: number = 1;

    private sprite: Phaser.GameObjects.Image;
    private attackTimer: number = 0;
    private baseAttackRange: number;
    private baseAttackDamage: number;
    private baseAttackCooldownMs: number;
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

        const mul = RARITY_MULTIPLIERS[definition.rarity] ?? RARITY_MULTIPLIERS.R;

        this.maxHp = Math.round(definition.maxHp * 2.5 * mul.hp);
        this.hp = this.maxHp;
        this.baseAttackRange = Math.min(250, Math.max(80, definition.attackRange * mul.range));
        this.baseAttackDamage = Math.round(definition.attackDamage * mul.damage);
        this.baseAttackCooldownMs = Math.max(300, definition.attackCooldownMs / mul.speed);

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

        // レアリティ枠色
        const rarityColors: Record<string, number> = {
            N: 0x888888, R: 0x4488ff, SR: 0xaa44ff, SSR: 0xffaa00, UR: 0xff4466,
        };
        const frameColor = rarityColors[definition.rarity] ?? 0x4488ff;
        const frame = scene.add.rectangle(0, -this.sprite.displayHeight / 2, this.sprite.displayWidth + 4, this.sprite.displayHeight + 4);
        frame.setStrokeStyle(2, frameColor, 0.5);
        frame.setFillStyle(0x000000, 0);
        frame.setOrigin(0.5, 0.5);
        this.addAt(frame, 0); // スプライトの後ろ

        scene.add.existing(this);
        this.setDepth(12);
    }

    getAttackDamage(): number {
        return Math.round(this.baseAttackDamage * this.damageMultiplier);
    }

    getAttackRange(): number {
        return this.baseAttackRange * this.rangeMultiplier;
    }

    getAttackCooldownMs(): number {
        return this.baseAttackCooldownMs / this.speedMultiplier;
    }

    update(delta: number, enemies: GuardTarget[]): GuardTarget | null {
        if (this.dead) return null;

        this.attackTimer = Math.max(0, this.attackTimer - delta);
        if (this.attackTimer > 0) return null;

        const range = this.getAttackRange();

        // 射程内の最も近い敵を探す
        let nearest: GuardTarget | null = null;
        let nearestDist = Infinity;

        for (const enemy of enemies) {
            if (enemy.isDead()) continue;
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= range && dist < nearestDist) {
                nearest = enemy;
                nearestDist = dist;
            }
        }

        if (!nearest) return null;

        // 攻撃実行
        const damage = this.getAttackDamage();
        nearest.takeDamage(damage);
        this.attackTimer = this.getAttackCooldownMs();

        // 攻撃方向にフリップ
        this.sprite.setFlipX(nearest.x < this.x);

        // 攻撃エフェクト: 弾丸ライン
        this.showAttackEffect(nearest.x, nearest.y);

        // スクイッシュ
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.12,
            scaleY: 0.92,
            duration: 60,
            yoyo: true,
            ease: 'Power2',
        });

        return nearest;
    }

    private showAttackEffect(targetX: number, targetY: number) {
        const graphics = this.scene.add.graphics();
        graphics.setDepth(11);

        // 弾丸ライン
        const rarityColors: Record<string, number> = {
            N: 0xaaaaaa, R: 0x66aaff, SR: 0xcc66ff, SSR: 0xffcc00, UR: 0xff6688,
        };
        const color = rarityColors[this.definition.rarity] ?? 0x66aaff;

        graphics.lineStyle(3, color, 0.8);
        graphics.moveTo(this.x, this.y - 20);
        graphics.lineTo(targetX, targetY);
        graphics.strokePath();

        // ヒットパーティクル
        const hitCircle = this.scene.add.circle(targetX, targetY, 8, color, 0.6).setDepth(11);

        this.scene.tweens.add({
            targets: [graphics, hitCircle],
            alpha: 0,
            duration: 150,
            onComplete: () => {
                graphics.destroy();
                hitCircle.destroy();
            },
        });
    }

    takeDamage(amount: number) {
        if (this.dead) return;
        this.hp = Math.max(0, this.hp - amount);

        // HPバー更新
        const ratio = this.hp / this.maxHp;
        this.hpBarFill.setScale(Math.max(0.05, ratio), 1);
        if (ratio < 0.3) this.hpBarFill.fillColor = 0xff4444;
        else if (ratio < 0.6) this.hpBarFill.fillColor = 0xffaa00;
        else this.hpBarFill.fillColor = 0x55ff88;

        // 被弾フラッシュ
        this.sprite.setTint(0xff5555);
        this.scene.time.delayedCall(100, () => {
            if (!this.dead) this.sprite.clearTint();
        });
    }

    healPercent(percent: number) {
        if (this.dead) return;
        const heal = Math.round(this.maxHp * percent);
        this.hp = Math.min(this.maxHp, this.hp + heal);
        const ratio = this.hp / this.maxHp;
        this.hpBarFill.setScale(Math.max(0.05, ratio), 1);
        if (ratio >= 0.6) this.hpBarFill.fillColor = 0x55ff88;
        else if (ratio >= 0.3) this.hpBarFill.fillColor = 0xffaa00;

        // 回復エフェクト
        const healText = this.scene.add.text(this.x, this.y - 40, `+${heal}`, {
            fontSize: '14px', color: '#55ff88', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(60);
        this.scene.tweens.add({
            targets: healText, y: this.y - 70, alpha: 0, duration: 600,
            onComplete: () => healText.destroy(),
        });
    }

    isDead(): boolean {
        if (this.dead) return true;
        if (this.hp <= 0) {
            this.dead = true;
            this.scene.tweens.add({
                targets: this,
                alpha: 0,
                scaleX: 0.3,
                scaleY: 0.3,
                duration: 300,
                onComplete: () => this.destroy(),
            });
            return true;
        }
        return false;
    }

    getHitRadius(): number {
        return this.hitRadius;
    }

    static getPlaceCost(rarity: string): number {
        const costMap: Record<string, number> = {
            N: 30, R: 60, SR: 120, SSR: 200, UR: 350,
        };
        return costMap[rarity] || 50;
    }
}
