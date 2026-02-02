import Phaser from 'phaser';
import { Unit } from '../entities/Unit';
import { Castle } from '../entities/Castle';

export interface CannonTarget {
    x: number;
    y: number;
    takeDamage: (damage: number, knockback?: number) => void;
}

export class CannonSystem {
    private scene: Phaser.Scene;

    // ゲージ
    private charge: number = 0;
    private chargeMax: number = 20000;

    // UI要素
    private btnBg!: Phaser.GameObjects.Arc;
    private btnText!: Phaser.GameObjects.Text;
    private barBg!: Phaser.GameObjects.Rectangle;
    private barFill!: Phaser.GameObjects.Rectangle;
    private pulse?: Phaser.Tweens.Tween;

    // 設定
    private damage: number = 200;
    private knockback: number = 60;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    createUI(x: number, y: number, buttonHeight: number) {
        const cannonRadius = 38;

        // 丸ボタン
        this.btnBg = this.scene.add.circle(x, y, cannonRadius, 0xf8e7b6);
        this.btnBg.setScrollFactor(0);
        this.btnBg.setDepth(100);
        this.btnBg.setStrokeStyle(4, 0x3b2a1a);
        this.btnBg.setInteractive({ useHandCursor: true });

        // アイコン
        this.btnText = this.scene.add.text(x, y - 5, '💥', {
            fontSize: '32px',
        });
        this.btnText.setOrigin(0.5, 0.5);
        this.btnText.setScrollFactor(0);
        this.btnText.setDepth(101);

        // ゲージバー
        this.barBg = this.scene.add.rectangle(x, y + 28, 50, 6, 0xd7bf8a);
        this.barBg.setScrollFactor(0);
        this.barBg.setDepth(101);
        this.barBg.setStrokeStyle(1, 0x3b2a1a);

        this.barFill = this.scene.add.rectangle(x - 25, y + 28, 0, 6, 0xffd45a);
        this.barFill.setOrigin(0, 0.5);
        this.barFill.setScrollFactor(0);
        this.barFill.setDepth(102);

        return this.btnBg;
    }

    update(delta: number) {
        this.charge = Math.min(this.charge + delta, this.chargeMax);
        const ratio = this.chargeMax > 0 ? this.charge / this.chargeMax : 0;
        const barWidth = Math.max(0, Math.min(1, ratio)) * 50;
        this.barFill.width = barWidth;
        this.barFill.height = 6;

        if (this.charge >= this.chargeMax) {
            this.btnBg.setFillStyle(0xffe066);
            // パルスアニメーション開始
            if (!this.pulse || !this.pulse.isPlaying()) {
                this.pulse = this.scene.tweens.add({
                    targets: [this.btnBg, this.btnText],
                    scale: { from: 1, to: 1.15 },
                    duration: 400,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
            }
        } else {
            this.btnBg.setFillStyle(0xf8e7b6);
            // パルスアニメーション停止
            if (this.pulse) {
                this.pulse.stop();
                this.btnBg.setScale(1);
                this.btnText.setScale(1);
            }
        }
    }

    isReady(): boolean {
        return this.charge >= this.chargeMax;
    }

    fire(
        allyCastle: Castle,
        enemyUnits: Unit[],
        enemyCastle: Castle,
        groundY: number,
        stageLength: number
    ): boolean {
        if (this.charge < this.chargeMax) return false;

        // 攻撃範囲: フィールドの半分
        const attackRange = stageLength / 2;
        const rangeEndX = allyCastle.x + attackRange;

        // 範囲内の敵のみ対象
        const livingEnemies = enemyUnits.filter(u => !u.isDead());
        const enemiesInRange = livingEnemies.filter(e => e.x <= rangeEndX);

        // 画面シェイク
        this.scene.cameras.main.shake(400, 0.015);

        // キャノン発射SE
        this.scene.sound.play('sfx_cannon_fire', { volume: 0.6 });

        // 衝撃波
        this.createShockwave(allyCastle.x, groundY, attackRange);

        if (enemiesInRange.length > 0) {
            enemiesInRange.forEach((enemy, index) => {
                this.scene.time.delayedCall(150 + index * 80, () => {
                    this.createExplosion(enemy.x, enemy.y);
                    enemy.takeDamage(this.damage, this.knockback);
                });
            });
        } else {
            this.scene.time.delayedCall(300, () => {
                this.createExplosion(rangeEndX, groundY);
            });
        }

        this.charge = 0;
        return true;
    }

    fireArea(
        centerX: number,
        centerY: number,
        targets: CannonTarget[],
        radius: number,
        options?: { damage?: number; knockback?: number }
    ): boolean {
        if (this.charge < this.chargeMax) return false;

        const damage = options?.damage ?? this.damage;
        const knockback = options?.knockback ?? this.knockback;

        // 画面シェイク
        this.scene.cameras.main.shake(350, 0.012);

        // キャノン発射SE（存在する場合のみ）
        if (this.scene.cache.audio.exists('sfx_cannon_fire')) {
            this.scene.sound.play('sfx_cannon_fire', { volume: 0.5 });
        }

        // 衝撃波
        this.createRadialShockwave(centerX, centerY, radius);

        const livingTargets = targets.filter(t => t && typeof t.x === 'number' && typeof t.y === 'number');
        const targetsInRange = livingTargets.filter(t => {
            const dx = t.x - centerX;
            const dy = t.y - centerY;
            return Math.sqrt(dx * dx + dy * dy) <= radius;
        });

        if (targetsInRange.length > 0) {
            targetsInRange.forEach((target, index) => {
                this.scene.time.delayedCall(120 + index * 60, () => {
                    this.createExplosion(target.x, target.y);
                    target.takeDamage(damage, knockback);
                });
            });
        } else {
            this.scene.time.delayedCall(200, () => {
                this.createExplosion(centerX, centerY);
            });
        }

        this.charge = 0;
        return true;
    }

    private createShockwave(x: number, y: number, range: number) {
        const wave = this.scene.add.circle(x, y, 20, 0xffff00, 0.7);
        wave.setStrokeStyle(6, 0xff6600);
        wave.setDepth(50);

        this.scene.tweens.add({
            targets: wave,
            radius: range,
            alpha: 0,
            duration: 600,
            ease: 'Power2',
            onComplete: () => wave.destroy(),
        });

        // 範囲終端のライン
        const rangeLine = this.scene.add.rectangle(x + range, y - 100, 8, 200, 0xff4444, 0.8);
        rangeLine.setDepth(49);
        this.scene.tweens.add({
            targets: rangeLine,
            alpha: 0,
            duration: 800,
            ease: 'Power1',
            onComplete: () => rangeLine.destroy(),
        });

        // 範囲テキスト
        const rangeText = this.scene.add.text(x + range, y - 220, '⚡範囲⚡', {
            fontSize: '20px',
            color: '#ff4444',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        });
        rangeText.setOrigin(0.5, 0.5);
        rangeText.setDepth(49);
        this.scene.tweens.add({
            targets: rangeText,
            alpha: 0,
            y: y - 250,
            duration: 1000,
            ease: 'Power1',
            onComplete: () => rangeText.destroy(),
        });
    }

    private createRadialShockwave(x: number, y: number, radius: number) {
        const wave = this.scene.add.circle(x, y, 20, 0xffff00, 0.6);
        wave.setStrokeStyle(6, 0xff6600);
        wave.setDepth(50);

        this.scene.tweens.add({
            targets: wave,
            radius,
            alpha: 0,
            duration: 550,
            ease: 'Power2',
            onComplete: () => wave.destroy(),
        });

        const inner = this.scene.add.circle(x, y, 12, 0xffdd66, 0.5);
        inner.setDepth(51);
        this.scene.tweens.add({
            targets: inner,
            radius: radius * 0.6,
            alpha: 0,
            duration: 450,
            ease: 'Power2',
            onComplete: () => inner.destroy(),
        });

        const boom = this.scene.add.text(x, y - 30, '💥', { fontSize: '64px' });
        boom.setOrigin(0.5, 0.5);
        boom.setDepth(52);
        this.scene.tweens.add({
            targets: boom,
            y: y - 90,
            alpha: 0,
            duration: 600,
            ease: 'Power2',
            onComplete: () => boom.destroy(),
        });
    }

    destroy() {
        // パルスアニメーションを停止
        if (this.pulse) {
            this.pulse.stop();
            this.pulse = undefined;
        }
        // UI要素を破棄
        this.btnBg?.destroy();
        this.btnText?.destroy();
        this.barBg?.destroy();
        this.barFill?.destroy();
    }

    private createExplosion(x: number, y: number) {
        // 中心フラッシュ
        const flash = this.scene.add.circle(x, y, 50, 0xffffff, 1);
        flash.setDepth(60);
        this.scene.tweens.add({
            targets: flash,
            scale: 3,
            alpha: 0,
            duration: 200,
            onComplete: () => flash.destroy(),
        });

        // 炎パーティクル
        const colors = [0xff4400, 0xff8800, 0xffcc00, 0xff0000, 0xffff00];
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const dist = 40 + Math.random() * 60;
            const size = 15 + Math.random() * 25;
            const color = colors[Math.floor(Math.random() * colors.length)];

            const particle = this.scene.add.circle(x, y, size, color, 0.9);
            particle.setDepth(55);

            this.scene.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist - 30,
                scale: 0.1,
                alpha: 0,
                duration: 400 + Math.random() * 300,
                ease: 'Power2',
                onComplete: () => particle.destroy(),
            });
        }

        // 爆発絵文字
        const boom = this.scene.add.text(x, y - 40, '💥', { fontSize: '72px' });
        boom.setOrigin(0.5, 0.5);
        boom.setDepth(61);
        this.scene.tweens.add({
            targets: boom,
            y: y - 120,
            scale: 2,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => boom.destroy(),
        });

        // 火花
        for (let i = 0; i < 6; i++) {
            const spark = this.scene.add.text(x, y, '✨', { fontSize: '24px' });
            spark.setOrigin(0.5, 0.5);
            spark.setDepth(62);
            const angle = Math.random() * Math.PI * 2;
            const dist = 60 + Math.random() * 80;
            this.scene.tweens.add({
                targets: spark,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist - 50,
                alpha: 0,
                duration: 600,
                ease: 'Power2',
                onComplete: () => spark.destroy(),
            });
        }
    }
}
