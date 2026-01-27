import Phaser from 'phaser';
import type { CastleSide } from '@/data/types';

// ============================================
// Castle Entity - 城（勝敗条件）
// ============================================

export class Castle extends Phaser.GameObjects.Container {
    public side: CastleSide;
    public hp: number;
    public maxHp: number;

    private sprite: Phaser.GameObjects.Image;
    private hpBar: Phaser.GameObjects.Rectangle;
    private hpBarBg: Phaser.GameObjects.Rectangle;
    private labelText: Phaser.GameObjects.Text;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        side: CastleSide,
        maxHp: number
    ) {
        super(scene, x, y);

        this.side = side;
        this.hp = maxHp;
        this.maxHp = maxHp;

        // 城のスプライト画像
        const textureKey = side === 'ally' ? 'castle_ally' : 'castle_enemy';
        this.sprite = scene.add.image(0, 0, textureKey);

        // スケール調整（城を大きく表示）
        const targetHeight = 250;
        const scale = targetHeight / this.sprite.height;
        this.sprite.setScale(scale);

        // 原点を下中央に設定（足元基準）
        this.sprite.setOrigin(0.5, 1);

        this.add(this.sprite);

        // HPバー背景
        const barWidth = 80;
        const barY = -this.sprite.displayHeight - 20;

        this.hpBarBg = scene.add.rectangle(0, barY, barWidth, 10, 0x333333);
        this.add(this.hpBarBg);

        // HPバー
        this.hpBar = scene.add.rectangle(0, barY, barWidth, 10, 0x00ff00);
        this.add(this.hpBar);

        // ラベル
        const label = side === 'ally' ? '味方城' : '敵城';
        this.labelText = scene.add.text(0, barY - 20, label, {
            fontSize: '14px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
        });
        this.labelText.setOrigin(0.5, 0.5);
        this.add(this.labelText);

        scene.add.existing(this);
    }

    public takeDamage(damage: number): void {
        this.hp -= damage;

        // ダメージ数値表示
        this.showDamageNumber(damage);

        // 被弾エフェクト
        this.scene.tweens.add({
            targets: this.sprite,
            scaleX: this.sprite.scaleX * 0.9,
            scaleY: this.sprite.scaleY * 0.9,
            duration: 100,
            yoyo: true,
        });

        // 赤フラッシュ
        this.sprite.setTint(0xff0000);
        this.scene.time.delayedCall(100, () => {
            this.sprite.clearTint();
        });

        if (this.hp <= 0) {
            this.hp = 0;
        }

        this.updateHpBar();
    }

    private showDamageNumber(damage: number): void {
        const text = this.scene.add.text(this.x, this.y - this.sprite.displayHeight - 50, `-${damage}`, {
            fontSize: '24px',
            color: '#ff0000',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        });
        text.setOrigin(0.5, 0.5);

        this.scene.tweens.add({
            targets: text,
            y: text.y - 40,
            alpha: 0,
            duration: 1000,
            onComplete: () => text.destroy(),
        });
    }

    private updateHpBar(): void {
        const hpRatio = this.hp / this.maxHp;
        this.hpBar.setScale(hpRatio, 1);
        this.hpBar.setX(-40 * (1 - hpRatio));

        // HP色変化
        if (hpRatio > 0.6) {
            this.hpBar.setFillStyle(0x00ff00);
        } else if (hpRatio > 0.3) {
            this.hpBar.setFillStyle(0xffff00);
        } else {
            this.hpBar.setFillStyle(0xff0000);
        }
    }

    public isDestroyed(): boolean {
        return this.hp <= 0;
    }

    public getX(): number {
        return this.x;
    }
}
