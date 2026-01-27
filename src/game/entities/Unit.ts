import Phaser from 'phaser';
import type { UnitDefinition, UnitState, UnitSide } from '@/data/types';

// ============================================
// Unit Entity - 状態機械による自動戦闘ユニット
// ============================================

export class Unit extends Phaser.GameObjects.Container {
    // 基本データ
    public instanceId: string;
    public definition: UnitDefinition;
    public side: UnitSide;

    // ステータス
    public hp: number;
    public maxHp: number;

    // 状態機械
    public state: UnitState = 'SPAWN';
    private stateTimer: number = 0;

    // ターゲット
    public target: Unit | null = null;

    // ビジュアル
    private sprite: Phaser.GameObjects.Image;
    private hpBar: Phaser.GameObjects.Rectangle;
    private hpBarBg: Phaser.GameObjects.Rectangle;

    // 移動方向
    private direction: number;

    // シーンのステージ長（敵城位置）
    private stageLength: number;

    // スプライトのベーススケール
    private baseScale: number = 1;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        definition: UnitDefinition,
        side: UnitSide,
        stageLength: number
    ) {
        super(scene, x, y);

        this.instanceId = `${side}_${definition.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.definition = definition;
        this.side = side;
        this.hp = definition.maxHp;
        this.maxHp = definition.maxHp;
        this.direction = side === 'ally' ? 1 : -1;
        this.stageLength = stageLength;

        // スプライト画像を使用
        const textureKey = definition.id;
        this.sprite = scene.add.image(0, 0, textureKey);

        // スケール調整（キャラを大きめに）
        const targetHeight = 120;
        this.baseScale = targetHeight / this.sprite.height;
        this.sprite.setScale(this.baseScale);

        // 原点を下中央に設定
        this.sprite.setOrigin(0.5, 1);

        // 敵画像は右向きなので、左（味方城方向）に向かせるために反転
        if (side === 'enemy') {
            this.sprite.setFlipX(true);
        }

        this.add(this.sprite);

        // HPバー背景
        const barY = -this.sprite.displayHeight - 10;
        this.hpBarBg = scene.add.rectangle(0, barY, 50, 6, 0x333333);
        this.add(this.hpBarBg);

        // HPバー
        this.hpBar = scene.add.rectangle(0, barY, 50, 6, 0x00ff00);
        this.add(this.hpBar);

        // ユニット名表示
        const nameText = scene.add.text(0, barY - 15, definition.name.slice(0, 4), {
            fontSize: '10px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
        });
        nameText.setOrigin(0.5, 0.5);
        this.add(nameText);

        scene.add.existing(this);

        // スポーン状態から開始
        this.setUnitState('SPAWN');
    }

    update(delta: number): void {
        if (this.state === 'DIE') return;

        this.stateTimer += delta;

        switch (this.state) {
            case 'SPAWN':
                this.handleSpawn();
                break;
            case 'WALK':
                this.handleWalk(delta);
                break;
            case 'ATTACK_WINDUP':
                this.handleAttackWindup();
                break;
            case 'ATTACK_COOLDOWN':
                this.handleAttackCooldown();
                break;
            case 'HITSTUN':
                this.handleHitstun();
                break;
        }

        this.updateHpBar();
    }

    private setUnitState(newState: UnitState): void {
        this.state = newState;
        this.stateTimer = 0;

        // ビジュアル更新（反転はsetFlipXで制御するのでスケールは常に正）
        switch (newState) {
            case 'SPAWN':
                // スポーン時のスケールアニメーション
                this.sprite.setScale(0);
                this.scene.tweens.add({
                    targets: this.sprite,
                    scaleX: this.baseScale,
                    scaleY: this.baseScale,
                    duration: 200,
                    ease: 'Back.easeOut',
                });
                break;
            case 'WALK':
                this.sprite.setAlpha(1);
                this.sprite.setScale(this.baseScale);
                break;
            case 'ATTACK_WINDUP':
                // 攻撃時に少し大きく
                this.scene.tweens.add({
                    targets: this.sprite,
                    scaleX: this.baseScale * 1.2,
                    scaleY: this.baseScale * 1.2,
                    duration: 100,
                });
                break;
            case 'ATTACK_COOLDOWN':
                this.sprite.setScale(this.baseScale);
                break;
            case 'HITSTUN':
                this.sprite.setAlpha(0.7);
                // 赤フラッシュ
                this.sprite.setTint(0xff0000);
                this.scene.time.delayedCall(100, () => {
                    this.sprite.clearTint();
                });
                break;
            case 'DIE':
                this.sprite.setAlpha(0.3);
                break;
        }
    }

    private handleSpawn(): void {
        // スポーン演出（300ms）
        if (this.stateTimer >= 300) {
            this.setUnitState('WALK');
        }
    }

    private handleWalk(delta: number): void {
        // ターゲットがいて射程内なら攻撃開始
        if (this.target && this.isInRange(this.target)) {
            this.setUnitState('ATTACK_WINDUP');
            return;
        }

        // 前進
        const speed = this.definition.speed * (delta / 1000);
        this.x += speed * this.direction;

        // 城との衝突判定（城への直接攻撃はCombatSystemで処理）
        // ここでは位置クランプのみ
        if (this.side === 'ally') {
            this.x = Math.min(this.x, this.stageLength - 30);
        } else {
            this.x = Math.max(this.x, 80);
        }
    }

    private handleAttackWindup(): void {
        // Windup完了でダメージを与える
        if (this.stateTimer >= this.definition.attackWindupMs) {
            this.dealDamage();
            this.setUnitState('ATTACK_COOLDOWN');
        }
    }

    private handleAttackCooldown(): void {
        // クールダウン完了
        if (this.stateTimer >= this.definition.attackCooldownMs) {
            // ターゲットがまだ射程内なら再度攻撃
            if (this.target && !this.target.isDead() && this.isInRange(this.target)) {
                this.setUnitState('ATTACK_WINDUP');
            } else {
                this.target = null;
                this.setUnitState('WALK');
            }
        }
    }

    private handleHitstun(): void {
        // ヒットストップ（200ms）
        if (this.stateTimer >= 200) {
            this.setUnitState('WALK');
        }
    }

    private dealDamage(): void {
        if (!this.target || this.target.isDead()) return;

        this.target.takeDamage(this.definition.attackDamage, this.definition.knockback);
    }

    public takeDamage(damage: number, knockback: number): void {
        this.hp -= damage;

        // ダメージ数値表示
        this.showDamageNumber(damage);

        if (this.hp <= 0) {
            this.hp = 0;
            this.die();
            return;
        }

        // ノックバック
        const knockbackDir = this.side === 'ally' ? -1 : 1;
        this.x += knockback * knockbackDir;

        // 位置クランプ
        if (this.side === 'ally') {
            this.x = Math.max(this.x, 80);
        } else {
            this.x = Math.min(this.x, this.stageLength - 30);
        }

        // ヒットストップ
        if (this.state !== 'DIE') {
            this.setUnitState('HITSTUN');
        }
    }

    private showDamageNumber(damage: number): void {
        const text = this.scene.add.text(this.x, this.y - this.sprite.displayHeight - 20, `-${damage}`, {
            fontSize: '16px',
            color: '#ff0000',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
        });
        text.setOrigin(0.5, 0.5);

        this.scene.tweens.add({
            targets: text,
            y: text.y - 30,
            alpha: 0,
            duration: 800,
            onComplete: () => text.destroy(),
        });
    }

    private die(): void {
        this.setUnitState('DIE');

        // 死亡アニメーション
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            y: this.y + 20,
            duration: 500,
            onComplete: () => {
                this.destroy();
            },
        });
    }

    private updateHpBar(): void {
        const hpRatio = this.hp / this.maxHp;
        this.hpBar.setScale(hpRatio, 1);
        this.hpBar.setX(-25 * (1 - hpRatio));

        // HP色変化
        if (hpRatio > 0.6) {
            this.hpBar.setFillStyle(0x00ff00);
        } else if (hpRatio > 0.3) {
            this.hpBar.setFillStyle(0xffff00);
        } else {
            this.hpBar.setFillStyle(0xff0000);
        }
    }

    public isInRange(target: Unit): boolean {
        const distance = Math.abs(this.x - target.x);
        return distance <= this.definition.attackRange;
    }

    public isDead(): boolean {
        return this.state === 'DIE' || this.hp <= 0;
    }

    public getX(): number {
        return this.x;
    }
}
