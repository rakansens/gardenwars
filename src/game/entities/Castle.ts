import Phaser from 'phaser';
import type { CastleSide } from '@/data/types';

// ============================================
// Castle Entity - 城（勝敗条件）
// ============================================

export class Castle extends Phaser.GameObjects.Container {
    public side: CastleSide;
    public hp: number;
    public maxHp: number;

    private sprite: Phaser.GameObjects.Rectangle;
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

        // 城のビジュアル
        const color = side === 'ally' ? 0x2266aa : 0xaa2222;
        const width = 60;
        const height = 100;

        this.sprite = scene.add.rectangle(0, -height / 2, width, height, color);
        this.sprite.setStrokeStyle(3, 0xffffff);
        this.add(this.sprite);

        // 城の屋根（三角形で表現）
        const roof = scene.add.triangle(0, -height - 10, 0, 30, 40, 0, -40, 0, color);
        this.add(roof);

        // HPバー背景
        this.hpBarBg = scene.add.rectangle(0, -height - 40, 80, 10, 0x333333);
        this.add(this.hpBarBg);

        // HPバー
        this.hpBar = scene.add.rectangle(0, -height - 40, 80, 10, 0x00ff00);
        this.add(this.hpBar);

        // ラベル
        const label = side === 'ally' ? '味方城' : '敵城';
        this.labelText = scene.add.text(0, -height - 60, label, {
            fontSize: '14px',
            color: '#ffffff',
            fontStyle: 'bold',
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
            scaleX: 0.9,
            scaleY: 0.9,
            duration: 100,
            yoyo: true,
        });

        if (this.hp <= 0) {
            this.hp = 0;
        }

        this.updateHpBar();
    }

    private showDamageNumber(damage: number): void {
        const text = this.scene.add.text(this.x, this.y - 120, `-${damage}`, {
            fontSize: '20px',
            color: '#ff0000',
            fontStyle: 'bold',
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
