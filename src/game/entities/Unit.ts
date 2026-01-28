import Phaser from 'phaser';
import type { UnitDefinition, UnitState, UnitSide } from '@/data/types';
import type { Castle } from './Castle';

// ============================================
// Unit Entity - 状態機械による自動戦闘ユニット
// ============================================

// アニメーション対応ユニットIDのリスト
const ANIMATED_UNITS = ['cat_warrior', 'corn_fighter', 'penguin_boy', 'cinnamon_girl', 'nika', 'lennon'];

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
    public castleTarget: Castle | null = null;

    // ビジュアル
    private sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
    private hpBar: Phaser.GameObjects.Rectangle;
    private hpBarBg: Phaser.GameObjects.Rectangle;

    // 移動方向
    private direction: number;

    // シーンのステージ長（敵城位置）
    private stageLength: number;

    // スプライトのベーススケール
    private baseScale: number = 1;

    // アニメーション対応フラグ
    private hasAnimation: boolean = false;

    // 蓄積ダメージ（ノックバック計算用）
    private damageAccumulated: number = 0;

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

        // スプライトに使用するユニットID（baseUnitIdがあればそれを使用）
        const spriteUnitId = definition.baseUnitId || definition.id;

        // アニメーション対応チェック
        this.hasAnimation = ANIMATED_UNITS.includes(spriteUnitId);

        if (this.hasAnimation) {
            // アニメーション対応ユニット
            this.sprite = scene.add.sprite(0, 0, `${spriteUnitId}_atlas`, `${spriteUnitId}_idle.png`);
        } else {
            // 静止画ユニット
            this.sprite = scene.add.image(0, 0, spriteUnitId);
        }

        // スケール調整（キャラを大きめに）
        const targetHeight = 120;
        const customScale = definition.scale ?? 1.0;
        this.baseScale = (targetHeight / this.sprite.height) * customScale;
        this.sprite.setScale(this.baseScale);

        // 原点を下中央に設定
        this.sprite.setOrigin(0.5, 1);

        // 敵ユニットの向き設定
        // - flipSpriteフラグがある場合は反転（味方スプライトを敵として使用）
        // - 敵は左向き（味方城方向）に向かうために反転
        if (definition.flipSprite) {
            // baseUnitIdを使用する敵ユニット: 味方スプライトを反転
            this.sprite.setFlipX(true);
        } else if (side === 'enemy') {
            // 既存の敵専用スプライト: 右向きなので反転
            this.sprite.setFlipX(true);
        }

        this.add(this.sprite);

        // HPバー (ボス以外のみ表示)
        if (!definition.isBoss) {
            const barY = -this.sprite.displayHeight - 10;
            this.hpBarBg = scene.add.rectangle(0, barY, 50, 6, 0x333333);
            this.add(this.hpBarBg);

            this.hpBar = scene.add.rectangle(0, barY, 50, 6, 0x00ff00);
            this.add(this.hpBar);
        } else {
            // ボス用のダミー（参照エラー回避）- またはnull許容にする
            // ここでは非表示のオブジェクトを作成して配置（エラー回避のため）
            this.hpBarBg = scene.add.rectangle(0, 0, 0, 0, 0x000000);
            this.hpBarBg.setVisible(false);
            this.hpBar = scene.add.rectangle(0, 0, 0, 0, 0x000000);
            this.hpBar.setVisible(false);
        }

        // ユニット名表示（ボスはUIで表示するので非表示、あるいは表示？）
        // ボスでも足元に名前あってもいいかも。一旦残すか、位置調整。
        const baseNameY = -this.sprite.displayHeight - 15;
        // ボスの場合は少し下げて表示（頭上に）
        const nameY = definition.isBoss ? -this.sprite.displayHeight : baseNameY;

        const nameText = scene.add.text(0, nameY, definition.name.slice(0, 8), {
            fontSize: definition.isBoss ? '14px' : '10px',
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

        // アニメーション再生
        if (this.hasAnimation && this.sprite instanceof Phaser.GameObjects.Sprite) {
            // スプライトに使用するユニットID
            const spriteUnitId = this.definition.baseUnitId || this.definition.id;

            switch (newState) {
                case 'SPAWN':
                case 'WALK':
                    this.sprite.play(`${spriteUnitId}_walk`, true);
                    break;
                case 'ATTACK_WINDUP':
                    this.sprite.play(`${spriteUnitId}_attack`, true);
                    break;
                case 'ATTACK_COOLDOWN':
                    // 攻撃アニメ続行
                    break;
                case 'HITSTUN':
                    // ヒット時は一時停止
                    this.sprite.anims.pause();
                    break;
                case 'DIE':
                    this.sprite.anims.stop();
                    break;
            }
        }

        // ビジュアル更新
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
                    scaleX: this.baseScale * 1.1,
                    scaleY: this.baseScale * 1.1,
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
        // 城がターゲットで射程内なら攻撃開始
        if (this.castleTarget && this.isInRangeOfCastle()) {
            this.setUnitState('ATTACK_WINDUP');
            return;
        }

        // 前進
        const speed = this.definition.speed * (delta / 1000);
        this.x += speed * this.direction;

        // 城との衝突判定
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
            } else if (this.castleTarget && this.isInRangeOfCastle()) {
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
        if (this.target && !this.target.isDead()) {
            this.target.takeDamage(this.definition.attackDamage, this.definition.knockback);
            return;
        }
        if (this.castleTarget) {
            this.castleTarget.takeDamage(this.definition.attackDamage);
        }
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

        // 蓄積ダメージ加算
        this.damageAccumulated += damage;

        // ノックバック判定
        // ボスは無効、その他は最大HPの15%を超えたら発生 (スーパーアーマー的な挙動)
        const kbThreshold = this.maxHp * 0.15;

        // ボスは完全耐性、通常ユニットは閾値を超えたらノックバック
        if (!this.definition.isBoss && this.damageAccumulated >= kbThreshold) {
            // 蓄積リセット
            this.damageAccumulated = 0;

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
        // 自身の幅を考慮（中心から端までの距離）
        const myHalfWidth = (this.sprite.displayWidth || (this.sprite.width * this.baseScale)) / 2;
        // ターゲットの幅も考慮したいが、ターゲットはUnit型で詳細不明な場合もあるため、自身の幅を主に使用
        // 「射程」＝「自身の体表からの距離」と解釈

        const distance = Math.abs(this.x - target.x);
        // 距離が (射程 + 自身の半径) 以内であれば攻撃可能
        return distance <= (this.definition.attackRange + myHalfWidth);
    }

    public isDead(): boolean {
        return this.state === 'DIE' || this.hp <= 0;
    }

    public getX(): number {
        return this.x;
    }

    private isInRangeOfCastle(): boolean {
        if (!this.castleTarget) return false;

        const myHalfWidth = (this.sprite.displayWidth || (this.sprite.width * this.baseScale)) / 2;
        const distance = Math.abs(this.x - this.castleTarget.getX());

        // 城に対しても同様に自身の半径を考慮
        return distance <= (this.definition.attackRange + myHalfWidth);
    }
}
