import Phaser from 'phaser';
import type { UnitDefinition } from '@/data/types';
import { GardenScene } from '../scenes/GardenScene';

export class GardenPet extends Phaser.GameObjects.Container {
    private sprite!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
    private definition: UnitDefinition;
    private baseScale: number = 1;
    private hasAnimation: boolean = false;

    // AI State
    private aiState: 'IDLE' | 'WALK' | 'WALK_TO_FOOD' = 'IDLE';
    private aiTimer: number = 0;
    private moveSpeed: number;
    private moveDirection: number = 1; // 1: Right, -1: Left
    private worldWidth: number;

    private targetFood: Phaser.GameObjects.Text | null = null;

    // Forced motion mode
    private forcedMotionMode: 'normal' | 'attack' = 'normal';

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
        const gardenScene = this.scene as GardenScene;
        const foods = gardenScene.foodGroup?.getChildren() as Phaser.GameObjects.Text[];

        // Check for food (50% chance if food exists)
        if (foods && foods.length > 0 && Math.random() < 0.5) {
            // Find nearest
            let nearest: Phaser.GameObjects.Text | null = null;
            let minDist = 9999;
            foods.forEach(f => {
                if (!f.active) return;
                const d = Phaser.Math.Distance.Between(this.x, this.y, f.x, f.y);
                if (d < minDist) {
                    minDist = d;
                    nearest = f;
                }
            });

            if (nearest && minDist < 600) { // Only if reasonably close
                this.targetFood = nearest;
                this.aiState = 'WALK_TO_FOOD';
                this.aiTimer = 8000;
                this.playAnim('walk');
                return;
            }
        }

        if (Math.random() < 0.6) {
            this.aiState = 'IDLE';
            this.aiTimer = 1000 + Math.random() * 2000;
            this.playAnim('idle');
        } else {
            this.aiState = 'WALK';
            this.aiTimer = 2000 + Math.random() * 3000;
            this.moveDirection = Math.random() < 0.5 ? 1 : -1;
            this.playAnim('walk');
            this.updateDirectionScale();
        }
    }

    private updateDirectionScale() {
        // Wobbling logic resets rotation, so we need to be careful.
        // But scale handles facing direction.
        if (this.moveDirection === -1) {
            this.sprite.setScale(-this.baseScale, this.baseScale);
        } else {
            this.sprite.setScale(this.baseScale, this.baseScale);
        }
    }

    private eatFood() {
        if (this.targetFood && this.targetFood.active) {
            this.targetFood.destroy();
        }
        this.targetFood = null;

        // Emote
        const heart = this.scene.add.text(0, -this.sprite.height * this.baseScale - 20, '❤️', { fontSize: '24px' }).setOrigin(0.5);
        this.add(heart);

        this.scene.tweens.add({
            targets: heart,
            y: heart.y - 30,
            alpha: 0,
            duration: 1500,
            onComplete: () => heart.destroy()
        });

        // 30% chance to poop after delays
        if (Math.random() < 0.3) {
            this.scene.time.delayedCall(2000, () => {
                (this.scene as GardenScene).spawnPoop(this.x, this.y);
            });
        }

        // Return to IDLE
        this.aiState = 'IDLE';
        this.aiTimer = 2000;
        this.playAnim('idle');
    }

    private playAnim(key: string) {
        if (!this.hasAnimation || !(this.sprite instanceof Phaser.GameObjects.Sprite)) return;
        // シーンが破棄されている場合は何もしない
        if (!this.scene || !this.scene.anims) return;

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

        // Safety check for coordinates
        if (isNaN(this.x) || isNaN(this.y)) {
            console.warn('GardenPet: Coordinates NaN, resetting', this.definition.id);
            this.x = 100;
            this.y = this.scene.scale.height - 100;
        }

        // Depth sort
        this.setDepth(this.y);

        if (this.aiState === 'WALK_TO_FOOD') {
            if (!this.targetFood || !this.targetFood.active) {
                // Food gone
                this.decideNextAction();
                return;
            }

            const dx = this.targetFood.x - this.x;
            if (Math.abs(dx) > 10) {
                this.moveDirection = Math.sign(dx);
                this.x += this.moveDirection * this.moveSpeed * 1.5 * (delta / 1000); // 1.5x speed for food
                this.updateDirectionScale();

                // Anim wobble logic (reused)
                this.applyWobble(delta);
            } else {
                // Reached
                this.eatFood();
            }

            if (this.aiTimer <= 0) this.decideNextAction(); // Timeout
            return;
        }

        if (this.aiTimer <= 0) {
            this.decideNextAction();
        }

        if (this.aiState === 'WALK') {
            this.x += this.moveDirection * this.moveSpeed * (delta / 1000);
            this.updateDirectionScale();
            this.applyWobble(delta);

            // 画面端判定
            if (this.x < 50) {
                this.x = 50;
                this.moveDirection = 1;
                this.updateDirectionScale();
            } else if (this.x > this.worldWidth - 50) {
                this.x = this.worldWidth - 50;
                this.moveDirection = -1;
                this.updateDirectionScale();
            }
        } else if (this.aiState === 'IDLE') {
            const hasWalkAnim = this.checkWalkAnim();
            if (!hasWalkAnim) {
                this.sprite.y = 0;
                this.sprite.rotation = 0;
            }
        }
    }

    private checkWalkAnim(): boolean {
        const spriteUnitId = this.definition.baseUnitId || this.definition.id;
        const walkAnimKey = `${spriteUnitId}_walk`;
        return this.hasAnimation && this.scene.anims.exists(walkAnimKey);
    }

    private applyWobble(delta: number) {
        if (this.checkWalkAnim()) return;

        const time = this.scene.time.now;
        this.sprite.y = -Math.abs(Math.sin(time * 0.008)) * 8;
        this.sprite.rotation = Math.sin(time * 0.01) * 0.05;
    }

    /**
     * Set forced motion mode (called from GardenScene)
     */
    public setMotionMode(mode: 'normal' | 'attack') {
        // シーンが破棄されている場合は何もしない
        if (!this.scene || !this.scene.anims) return;

        this.forcedMotionMode = mode;

        if (mode === 'attack') {
            // Play attack animation with looping
            this.playAttackLoop();
        } else {
            // Return to normal idle/walk based on AI state
            if (this.aiState === 'IDLE') {
                this.playAnim('idle');
            } else {
                this.playAnim('walk');
            }
        }
    }

    private playAttackLoop() {
        if (!this.hasAnimation || !(this.sprite instanceof Phaser.GameObjects.Sprite)) return;
        // シーンが破棄されている場合は何もしない
        if (!this.scene || !this.scene.time) return;

        this.playAnim('attack');

        // Remove any previous listeners to avoid duplicates
        this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);

        // Loop attack animation
        this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            if (this.forcedMotionMode === 'attack' && this.hasAnimation && this.scene && this.scene.time) {
                // Small delay before next attack for visual effect
                this.scene.time.delayedCall(200, () => {
                    if (this.forcedMotionMode === 'attack') {
                        this.playAnim('attack');
                    }
                });
            }
        });
    }

    /**
     * Check if this pet has animation support
     */
    public getHasAnimation(): boolean {
        return this.hasAnimation;
    }
}
