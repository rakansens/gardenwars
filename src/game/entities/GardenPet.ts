import Phaser from 'phaser';
import type { UnitDefinition } from '@/data/types';

export class GardenPet extends Phaser.GameObjects.Container {
    private sprite!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
    private definition: UnitDefinition;
    private baseScale: number = 1;
    private hasAnimation: boolean = false;

    // AI State (Containerのstateプロパティとの衝突回避のためaiStateとする)
    private aiState: 'IDLE' | 'WALK' = 'IDLE';
    private aiTimer: number = 0;
    private moveSpeed: number;
    private moveDirection: number = 1; // 1: Right, -1: Left
    private worldWidth: number;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        definition: UnitDefinition,
        worldWidth: number
    ) {
        super(scene, x, y);
        this.scene = scene;
        this.definition = definition;
        this.worldWidth = worldWidth;
        this.moveSpeed = definition.speed || 50;

        // スプライトID決定
        const spriteUnitId = definition.baseUnitId || definition.id;
        const atlasKey = `${spriteUnitId}_atlas`;
        this.hasAnimation = scene.textures.exists(atlasKey);

        if (this.hasAnimation) {
            // アニメーション対応
            const initialFrame = `${spriteUnitId}_idle.png`;
            const sprite = scene.add.sprite(0, 0, atlasKey, initialFrame);
            this.sprite = sprite;

            // アニメーション再生（あれば）
            if (scene.anims.exists(`${spriteUnitId}_idle`)) {
                sprite.play(`${spriteUnitId}_idle`);
            }
        } else {
            // 静止画
            if (scene.textures.exists(spriteUnitId)) {
                this.sprite = scene.add.image(0, 0, spriteUnitId);
            } else {
                // フォールバック
                this.sprite = scene.add.sprite(0, 0, 'n_mushroom');
                this.sprite.setTint(0x000000);
            }
        }

        this.add(this.sprite);

        // スケール設定
        if (this.sprite.width === 0) {
            this.sprite.width = 100;
            this.sprite.height = 100;
        }
        const targetHeight = 100; // 少し小さめでもいいかも
        const customScale = definition.scale ?? 1.0;
        this.baseScale = (targetHeight / this.sprite.height) * customScale;
        this.sprite.setScale(this.baseScale);

        // 原点
        this.sprite.setOrigin(0.5, 1);

        // インタラクション
        this.sprite.setInteractive();
        this.sprite.on('pointerdown', () => this.jump());

        // 明示的なキャストで型エラー回避
        this.scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

        // 初期状態
        this.decideNextAction();
    }

    private decideNextAction() {
        if (Math.random() < 0.6) {
            this.aiState = 'IDLE';
            this.aiTimer = 1000 + Math.random() * 2000;
            this.playAnim('idle');
        } else {
            this.aiState = 'WALK';
            this.aiTimer = 2000 + Math.random() * 3000;
            this.moveDirection = Math.random() < 0.5 ? 1 : -1;
            this.playAnim('walk');

            // 向き反転
            // Enemy用アセット(左向き)などを考慮したフリップ調整
            // ここでは簡易的に進行方向反転のみ
            if (this.moveDirection === -1) {
                this.sprite.setScale(-this.baseScale, this.baseScale); // 左向き
            } else {
                this.sprite.setScale(this.baseScale, this.baseScale); // 右向き
            }
        }
    }

    private playAnim(key: string) {
        if (!this.hasAnimation || !(this.sprite instanceof Phaser.GameObjects.Sprite)) return;
        const spriteUnitId = this.definition.baseUnitId || this.definition.id;
        const animKey = `${spriteUnitId}_${key}`;

        if (this.scene.anims.exists(animKey)) {
            this.sprite.play(animKey, true);
        }
    }

    private jump() {
        this.scene.tweens.add({
            targets: this.sprite,
            y: -50,
            duration: 300,
            yoyo: true,
            ease: 'Quad.out'
        });
        // 攻撃モーションとかあれば再生
        this.playAnim('attack');
        setTimeout(() => {
            if (this.aiState === 'IDLE') this.playAnim('idle');
            else this.playAnim('walk');
        }, 600);
    }

    update(delta: number) {
        this.aiTimer -= delta;

        if (this.aiTimer <= 0) {
            this.decideNextAction();
        }

        if (this.aiState === 'WALK') {
            this.x += this.moveDirection * this.moveSpeed * (delta / 1000);

            // Wobble for sprites without walk animation (even if they have an atlas)
            const spriteUnitId = this.definition.baseUnitId || this.definition.id;
            const walkAnimKey = `${spriteUnitId}_walk`;
            const hasWalkAnim = this.hasAnimation && this.scene.anims.exists(walkAnimKey);

            if (!hasWalkAnim && this.sprite) {
                const time = this.scene.time.now;
                // Bob up and down (jumpy walk)
                this.sprite.y = -Math.abs(Math.sin(time * 0.008)) * 8;
                // Slight tilting
                this.sprite.rotation = Math.sin(time * 0.01) * 0.05;
            }

            // 画面端判定
            if (this.x < 50) {
                this.x = 50;
                this.moveDirection = 1;
                this.sprite.setScale(this.baseScale, this.baseScale);
            } else if (this.x > this.worldWidth - 50) {
                this.x = this.worldWidth - 50;
                this.moveDirection = -1;
                this.sprite.setScale(-this.baseScale, this.baseScale);
            }
        } else if (this.aiState === 'IDLE') {
            // Reset transforms if we were wobbling (no walk anim)
            const spriteUnitId = this.definition.baseUnitId || this.definition.id;
            const walkAnimKey = `${spriteUnitId}_walk`;
            const hasWalkAnim = this.hasAnimation && this.scene.anims.exists(walkAnimKey);

            if (!hasWalkAnim && this.sprite) {
                this.sprite.y = 0;
                this.sprite.rotation = 0;
            }
        }

        // 深度ソート（手前のキャラが前に）
        this.setDepth(this.y);
    }
}
