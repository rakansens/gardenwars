import Phaser from 'phaser';
import type { UnitDefinition, UnitState, UnitSide, SkillRuntimeState, StatusEffect, SkillEffect } from '@/data/types';
import type { Castle } from './Castle';
import { getSfxVolume } from '@/lib/audioHelper';

// ============================================
// Unit Entity - 状態機械による自動戦闘ユニット
// ============================================
// 注: アニメーション対応判定はランタイムでテクスチャ存在チェックを行う（hasAnimation参照は不要）

// スキルシステム用：シーン全体のユニットリスト取得関数（モジュールレベル）
let globalGetAllyUnits: (() => Unit[]) | null = null;
let globalGetEnemyUnits: (() => Unit[]) | null = null;

/**
 * スキルシステム用のユニットリスト取得関数を設定
 * BattleSceneのcreate()で呼び出す
 */
export function setUnitListGetters(
    getAlly: () => Unit[],
    getEnemy: () => Unit[]
): void {
    globalGetAllyUnits = getAlly;
    globalGetEnemyUnits = getEnemy;
}

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

    // 飛行ユニットの浮遊オフセット
    private flyingOffset: number = 0;

    // 蓄積ダメージ（ノックバック計算用）
    private damageAccumulated: number = 0;

    // アリーナモード（縦移動）
    public verticalMode: boolean = false;
    private screenHeight: number = 600;

    // ボス範囲攻撃用
    private isEnraged: boolean = false;
    private lastAoeTime: number = 0;

    // ============================================
    // スキルシステム
    // ============================================
    private skillState: SkillRuntimeState | null = null;
    private statusEffects: StatusEffect[] = [];
    private statusIcons: Map<string, Phaser.GameObjects.Container> = new Map();

    // スキル効果による修正値
    public isFrozen: boolean = false;           // 時間停止/凍結中
    public isInvincible: boolean = false;       // 無敵中
    public speedModifier: number = 1.0;         // 速度倍率
    public damageModifier: number = 1.0;        // ダメージ倍率（与える）
    public attackSpeedModifier: number = 1.0;   // 攻撃速度倍率
    public damageReduction: number = 0;         // ダメージ軽減%
    private lastStandAvailable: boolean = false; // ラストスタンド使用可能
    private lastStandUsed: boolean = false;     // ラストスタンド使用済み
    private regenTimer: number = 0;             // リジェネタイマー
    private burnTimers: Phaser.Time.TimerEvent[] = []; // 炎上タイマー（die時にクリーンアップ用）

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

        // アトラスが存在するかチェックしてモードを決定
        const atlasKey = `${spriteUnitId}_atlas`;
        this.hasAnimation = scene.textures.exists(atlasKey);

        if (this.hasAnimation) {
            // アニメーション対応ユニット
            // 初期フレームは _idle.png を想定
            // テクスチャフレームが存在するか確認したほうが安全だが、命名規則に従うと仮定
            const initialFrame = `${spriteUnitId}_idle.png`;
            this.sprite = scene.add.sprite(0, 0, atlasKey, initialFrame);
        } else {
            // 静止画ユニット
            // こちらもテクスチャが存在するか確認、なければダミーを表示してエラー回避
            if (scene.textures.exists(spriteUnitId)) {
                this.sprite = scene.add.image(0, 0, spriteUnitId);
            } else {
                console.warn(`[Unit] Missing texture for unit: ${spriteUnitId}, using cat_warrior fallback`);
                // 代替テクスチャとして cat_warrior を使用（見やすいフォールバック）
                this.sprite = scene.add.image(0, 0, 'cat_warrior');
                // 視覚的に区別するためにわずかに色を変える（完全な黒ではなく）
                this.sprite.setTint(0xaaaaaa);
            }
        }

        // スケール調整（キャラを大きめに）
        // Phaserのwidth/heightはスケール適用前の値、displayWidth/displayHeightはスケール適用後の値
        // ここではスケール前の元サイズを使用し、安全なデフォルト値でフォールバック
        const spriteHeight = this.sprite.height;
        const spriteWidth = this.sprite.width;

        // スプライトサイズが取得できているか確認（0または非常に小さい場合は安全なデフォルト値を使用）
        const safeHeight = (spriteHeight && spriteHeight > 0) ? spriteHeight : 100;
        const safeWidth = (spriteWidth && spriteWidth > 0) ? spriteWidth : 100;

        const targetHeight = 120;
        const customScale = definition.scale ?? 1.0;
        this.baseScale = (targetHeight / safeHeight) * customScale;

        // スケールが異常値にならないようにクランプ（ボスは大きいので上限を高く）
        const maxScale = definition.isBoss ? 10.0 : 5.0;
        this.baseScale = Math.max(0.1, Math.min(maxScale, this.baseScale));
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

        // ボス専用スプライト（boss_で始まるbaseUnitId）の場合、Y位置を調整
        // ボススプライトはフレーム内でキャラが上部に配置されているため下にオフセット
        if (definition.isBoss && spriteUnitId.startsWith('boss_')) {
            // スケールに応じてオフセットを調整（大きいボスほど大きなオフセット）
            const bossOffset = 80 * this.baseScale;
            this.sprite.setY(bossOffset);
        }

        // 飛行ユニットの場合、スプライトを上にずらす
        if (definition.isFlying) {
            this.flyingOffset = 40; // 40px上に浮遊
            this.sprite.setY(-this.flyingOffset);

            // 影を追加（地面に落とす）
            const shadow = scene.add.ellipse(0, 0, 40, 15, 0x000000, 0.3);
            shadow.setOrigin(0.5, 0.5);
            this.addAt(shadow, 0); // スプライトの後ろに配置
        }

        // HPバー (ボス以外のみ表示)
        if (!definition.isBoss) {
            const barY = -this.sprite.displayHeight - 10 - this.flyingOffset;
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
        const baseNameY = -this.sprite.displayHeight - 15 - this.flyingOffset;
        // ボスの場合は少し下げて表示（頭上に）
        const nameY = definition.isBoss ? -this.sprite.displayHeight - this.flyingOffset : baseNameY;

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

        // スキル初期化
        this.initializeSkill();
    }

    /**
     * ユニットリスト取得関数を設定（BattleSceneから呼び出し）
     */
    update(delta: number): void {
        if (this.state === 'DIE') return;

        // 時間停止中は更新しない
        if (this.isFrozen) {
            this.updateStatusEffectTimers(delta);
            return;
        }

        this.stateTimer += delta;

        // スキルシステム更新
        this.updateSkillSystem(delta);

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

    /**
     * ユニットの表示幅を取得（スプライトの幅 * スケール）
     * ターゲット判定で正確な「端」を計算するために使用
     */
    public getWidth(): number {
        if (this.sprite instanceof Phaser.GameObjects.Sprite || this.sprite instanceof Phaser.GameObjects.Image) {
            // displayWidthはスケール適用後の表示幅
            return this.sprite.displayWidth;
        }
        return 40; // フォールバック
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
                // 召喚SE（味方のみ）
                if (this.side === 'ally') {
                    const vol = getSfxVolume(0.3);
                    if (vol > 0) this.scene.sound.play('sfx_unit_spawn', { volume: vol });
                }
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
            // on_spawn スキルトリガー
            this.triggerSkill('on_spawn');
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

        // 前進（スロー効果を適用）
        const speed = this.definition.speed * this.speedModifier * (delta / 1000);

        if (this.verticalMode) {
            // アリーナモード: 縦移動
            this.y += speed * this.direction;

            // 画面端クランプ
            if (this.side === 'ally') {
                this.y = Math.max(this.y, 100);
            } else {
                this.y = Math.min(this.y, this.screenHeight - 80);
            }
        } else {
            // 通常モード: 横移動
            this.x += speed * this.direction;

            // 城との衝突判定
            if (this.side === 'ally') {
                this.x = Math.min(this.x, this.stageLength - 30);
            } else {
                this.x = Math.max(this.x, 80);
            }
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
        // クールダウン完了（ヘイスト効果を適用）
        const cooldown = this.definition.attackCooldownMs * this.attackSpeedModifier;
        if (this.stateTimer >= cooldown) {
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
        // ボス範囲攻撃判定（怒り状態時にランダム発動）
        if (this.isEnraged && this.definition.bossAoe?.enabled) {
            const aoe = this.definition.bossAoe;
            const now = Date.now();
            const canAoe = (now - this.lastAoeTime) >= aoe.cooldownMs;

            if (canAoe && Math.random() < aoe.probability) {
                this.performAoeAttack();
                this.lastAoeTime = now;
                return;
            }
        }

        // 攻撃ヒットSE（レアリティによって変更）
        const rarity = this.definition.rarity;
        const hitSfx = (rarity === 'SR' || rarity === 'SSR' || rarity === 'UR')
            ? 'sfx_attack_hit_sr'
            : 'sfx_attack_hit';
        const hitVol = getSfxVolume(0.25);
        if (hitVol > 0) this.scene.sound.play(hitSfx, { volume: hitVol });

        // 通常ユニットの範囲攻撃
        if (this.definition.attackType === 'area' && this.definition.areaRadius) {
            this.performUnitAreaAttack();
            return;
        }

        // 単体攻撃
        if (this.target && !this.target.isDead()) {
            // スキルによるダメージ計算
            const { damage, isCritical } = this.calculateSkillDamage(this.definition.attackDamage);

            // 遠距離ユニット（射程100以上）は弾丸エフェクト付き
            if (this.definition.attackRange >= 100) {
                this.performRangedAttackWithSkill(this.target, damage, isCritical);
            } else {
                this.applyDamageWithSkill(this.target, damage, isCritical);
            }

            // on_attack スキルトリガー（追加効果: chain, burn, slow等）
            this.triggerSkill('on_attack', this.target);
            return;
        }
        if (this.castleTarget) {
            const { damage } = this.calculateSkillDamage(this.definition.attackDamage);
            // 城への遠距離攻撃もエフェクト付き
            if (this.definition.attackRange >= 100) {
                this.performRangedAttackOnCastleWithDamage(damage);
            } else {
                this.castleTarget.takeDamage(damage);
            }
        }
    }

    /**
     * 遠距離攻撃（弾丸エフェクト付き）
     */
    private performRangedAttack(target: Unit): void {
        const startX = this.x;
        const startY = this.y - 50 - this.flyingOffset;
        const endX = target.x;
        const endY = target.y - 50;

        // スキルによるダメージ計算（ダメージバフ適用）
        const { damage, isCritical } = this.calculateSkillDamage(this.definition.attackDamage);

        // 弾丸の見た目（レアリティとロールで変える）
        const projectile = this.createProjectile(startX, startY);

        // 飛行時間（距離に応じて）
        const distance = Math.abs(endX - startX);
        const duration = Math.min(300, Math.max(100, distance * 0.8));

        // 弾道（軽い弧を描く）
        const midY = Math.min(startY, endY) - 30;

        this.scene.tweens.add({
            targets: projectile,
            x: endX,
            y: { value: endY, ease: 'Sine.easeIn' },
            duration: duration,
            onUpdate: (tween) => {
                // 軌跡パーティクル
                const progress = tween.progress;
                if (Math.random() < 0.3) {
                    this.createTrailParticle(projectile.x, projectile.y);
                }
            },
            onComplete: () => {
                projectile.destroy();
                // ヒット時にダメージ
                if (!target.isDead()) {
                    if (isCritical) {
                        this.showCriticalEffect(target, damage);
                    }
                    target.takeDamage(damage, this.definition.knockback);
                    this.createRangedHitEffect(endX, endY);
                }
            },
        });
    }

    /**
     * 城への遠距離攻撃
     */
    private performRangedAttackOnCastle(): void {
        if (!this.castleTarget) return;

        const startX = this.x;
        const startY = this.y - 50 - this.flyingOffset;
        const endX = this.castleTarget.getX();
        const endY = this.castleTarget.y - 50;

        // スキルによるダメージ計算（ダメージバフ適用）
        const { damage } = this.calculateSkillDamage(this.definition.attackDamage);

        const projectile = this.createProjectile(startX, startY);

        const distance = Math.abs(endX - startX);
        const duration = Math.min(300, Math.max(100, distance * 0.8));

        this.scene.tweens.add({
            targets: projectile,
            x: endX,
            y: endY,
            duration: duration,
            onUpdate: () => {
                if (Math.random() < 0.3) {
                    this.createTrailParticle(projectile.x, projectile.y);
                }
            },
            onComplete: () => {
                projectile.destroy();
                if (this.castleTarget) {
                    this.castleTarget.takeDamage(damage);
                    this.createRangedHitEffect(endX, endY);
                }
            },
        });
    }

    /**
     * 弾丸オブジェクト生成
     */
    private createProjectile(x: number, y: number): Phaser.GameObjects.Container {
        const container = this.scene.add.container(x, y);
        container.setDepth(60);

        const rarity = this.definition.rarity;
        const role = this.definition.role;

        // 弾丸の色とサイズ（レアリティベース）
        let color = 0xffcc00;
        let size = 8;
        let glowColor = 0xffff88;

        if (rarity === 'UR') {
            color = 0xff00ff;
            glowColor = 0xff88ff;
            size = 12;
        } else if (rarity === 'SSR') {
            color = 0xffaa00;
            glowColor = 0xffdd88;
            size = 11;
        } else if (rarity === 'SR') {
            color = 0x9933ff;
            glowColor = 0xcc88ff;
            size = 10;
        } else if (rarity === 'R') {
            color = 0x00aaff;
            glowColor = 0x88ddff;
            size = 9;
        }

        // 弾丸の形状（ロールで変える）
        if (role === 'ranger') {
            // レンジャー: 矢のような形
            const arrow = this.scene.add.triangle(0, 0, 0, -size, size * 2, 0, 0, size, color);
            arrow.setRotation(this.direction > 0 ? 0 : Math.PI);
            container.add(arrow);

            // グロー
            const glow = this.scene.add.circle(0, 0, size * 0.8, glowColor, 0.5);
            container.addAt(glow, 0);
        } else {
            // その他: 球形
            const bullet = this.scene.add.circle(0, 0, size, color, 1);
            container.add(bullet);

            // グロー
            const glow = this.scene.add.circle(0, 0, size * 1.5, glowColor, 0.3);
            container.addAt(glow, 0);
        }

        return container;
    }

    /**
     * 軌跡パーティクル
     */
    private createTrailParticle(x: number, y: number): void {
        const rarity = this.definition.rarity;
        let color = 0xffcc00;

        if (rarity === 'UR') color = 0xff00ff;
        else if (rarity === 'SSR') color = 0xffaa00;
        else if (rarity === 'SR') color = 0x9933ff;
        else if (rarity === 'R') color = 0x00aaff;

        const particle = this.scene.add.circle(x, y, 4, color, 0.6);
        particle.setDepth(59);

        this.scene.tweens.add({
            targets: particle,
            scale: 0.1,
            alpha: 0,
            duration: 150,
            onComplete: () => particle.destroy(),
        });
    }

    /**
     * 遠距離攻撃ヒットエフェクト
     */
    private createRangedHitEffect(x: number, y: number): void {
        const rarity = this.definition.rarity;
        let color = 0xffcc00;

        if (rarity === 'UR') color = 0xff00ff;
        else if (rarity === 'SSR') color = 0xffaa00;
        else if (rarity === 'SR') color = 0x9933ff;
        else if (rarity === 'R') color = 0x00aaff;

        // インパクトフラッシュ
        const flash = this.scene.add.circle(x, y, 15, 0xffffff, 0.8);
        flash.setDepth(61);

        this.scene.tweens.add({
            targets: flash,
            scale: 2,
            alpha: 0,
            duration: 100,
            onComplete: () => flash.destroy(),
        });

        // スパーク
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
            const dist = 20 + Math.random() * 15;

            const spark = this.scene.add.circle(x, y, 5, color, 0.9);
            spark.setDepth(62);

            this.scene.tweens.add({
                targets: spark,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                scale: 0.2,
                alpha: 0,
                duration: 200,
                onComplete: () => spark.destroy(),
            });
        }
    }

    /**
     * 通常ユニットの範囲攻撃
     */
    private performUnitAreaAttack(): void {
        const areaRadius = this.definition.areaRadius!;
        const damage = this.definition.attackDamage;
        const knockback = this.definition.knockback;

        // ターゲット位置を基準に範囲攻撃
        let centerX = this.x;
        let centerY = this.y;

        if (this.target && !this.target.isDead()) {
            centerX = this.target.x;
            centerY = this.target.y;
        } else if (this.castleTarget) {
            centerX = this.castleTarget.getX();
            centerY = this.castleTarget.y;
        }

        // 範囲内の敵を取得
        const targets = this.getAreaTargets(centerX, centerY, areaRadius);

        // エフェクト表示
        this.createUnitAreaEffect(centerX, centerY, areaRadius);

        // ダメージ適用
        let hitCount = 0;
        targets.forEach((target, index) => {
            // メインターゲット以外は80%ダメージ
            const isMainTarget = target === this.target;
            const actualDamage = isMainTarget ? damage : Math.floor(damage * 0.8);
            const actualKnockback = isMainTarget ? knockback : Math.floor(knockback * 0.5);

            this.scene.time.delayedCall(index * 50, () => {
                if (!target.isDead()) {
                    target.takeDamage(actualDamage, actualKnockback);
                    hitCount++;
                }
            });
        });

        // 城へのダメージ（範囲内なら）
        if (this.castleTarget) {
            const castleDistance = this.verticalMode
                ? Math.abs(centerY - this.castleTarget.y)
                : Math.abs(centerX - this.castleTarget.getX());

            if (castleDistance <= areaRadius) {
                this.castleTarget.takeDamage(Math.floor(damage * 0.5));
            }
        }
    }

    /**
     * 範囲内の敵ユニットを取得
     */
    private getAreaTargets(centerX: number, centerY: number, radius: number): Unit[] {
        const scene = this.scene as any;
        const targetUnits: Unit[] = this.side === 'ally' ? scene.enemyUnits : scene.allyUnits;

        if (!targetUnits) return [];

        return targetUnits.filter((unit: Unit) => {
            if (unit.isDead()) return false;

            const distance = this.verticalMode
                ? Math.abs(centerY - unit.y)
                : Math.abs(centerX - unit.x);

            return distance <= radius;
        });
    }

    /**
     * 通常ユニットの範囲攻撃エフェクト
     */
    private createUnitAreaEffect(centerX: number, centerY: number, radius: number): void {
        // 衝撃波（レアリティで色を変える）
        const rarity = this.definition.rarity;
        const waveColor = rarity === 'UR' ? 0xff00ff :
            rarity === 'SSR' ? 0xffaa00 :
                rarity === 'SR' ? 0x9933ff :
                    0xff6600;

        // メイン衝撃波
        const wave = this.scene.add.circle(centerX, centerY - 40, 20, waveColor, 0.5);
        wave.setStrokeStyle(3, waveColor);
        wave.setDepth(50);

        this.scene.tweens.add({
            targets: wave,
            radius: radius,
            alpha: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => wave.destroy(),
        });

        // 内側の光
        const innerGlow = this.scene.add.circle(centerX, centerY - 40, 15, 0xffffff, 0.6);
        innerGlow.setDepth(51);

        this.scene.tweens.add({
            targets: innerGlow,
            radius: radius * 0.5,
            alpha: 0,
            duration: 200,
            ease: 'Power2',
            onComplete: () => innerGlow.destroy(),
        });

        // 爆発絵文字（レアリティで変更）
        const emoji = rarity === 'UR' || rarity === 'SSR' ? '✨' :
            rarity === 'SR' ? '💫' : '💥';
        const emojiText = this.scene.add.text(centerX, centerY - 60, emoji, {
            fontSize: rarity === 'UR' || rarity === 'SSR' ? '48px' : '36px',
        });
        emojiText.setOrigin(0.5);
        emojiText.setDepth(52);

        this.scene.tweens.add({
            targets: emojiText,
            y: centerY - 100,
            scale: 1.3,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => emojiText.destroy(),
        });

        // パーティクル（小さな光）
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const dist = radius * 0.6;
            const particle = this.scene.add.circle(
                centerX,
                centerY - 40,
                6,
                waveColor,
                0.8
            );
            particle.setDepth(53);

            this.scene.tweens.add({
                targets: particle,
                x: centerX + Math.cos(angle) * dist,
                y: centerY - 40 + Math.sin(angle) * dist,
                scale: 0.2,
                alpha: 0,
                duration: 250,
                ease: 'Power2',
                onComplete: () => particle.destroy(),
            });
        }
    }

    public takeDamage(damage: number, knockback: number, attacker?: Unit): void {
        // シーンが破棄されている場合は何もしない
        if (!this.scene || !this.scene.add) {
            return;
        }

        // 無敵中はダメージ無効
        if (this.isInvincible) {
            this.showBlockedEffect();
            return;
        }

        // ダメージ軽減適用（damageReductionを[0, 1]にクランプ）
        const clampedReduction = Math.max(0, Math.min(1, this.damageReduction));
        const actualDamage = Math.floor(damage * (1 - clampedReduction));
        this.hp -= actualDamage;

        // ダメージ数値表示
        this.showDamageNumber(actualDamage);

        // on_hit スキルトリガー
        this.triggerSkill('on_hit', attacker);

        // ラストスタンドチェック
        if (this.hp <= 0 && this.lastStandAvailable && !this.lastStandUsed) {
            this.hp = 1;
            this.lastStandUsed = true;
            this.showLastStandEffect();
            return;
        }

        if (this.hp <= 0) {
            this.hp = 0;
            this.die();
            return;
        }

        // hp_threshold スキルトリガー
        this.checkHpThresholdSkill();

        // ボスの怒りモードチェック（HP閾値以下で発動）
        if (this.definition.isBoss && this.definition.bossAoe?.enabled) {
            const hpRatio = this.hp / this.maxHp;
            if (!this.isEnraged && hpRatio <= this.definition.bossAoe.hpThreshold) {
                this.isEnraged = true;
                this.onEnrage();
            }
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

            const knockbackDir = this.side === 'ally' ? 1 : -1;

            if (this.verticalMode) {
                // アリーナモード: 縦方向ノックバック
                this.y += knockback * knockbackDir;

                // 位置クランプ（移動と同じ境界を使用）
                if (this.side === 'ally') {
                    this.y = Math.max(this.y, 100);
                } else {
                    this.y = Math.min(this.y, this.screenHeight - 80);
                }
            } else {
                // 通常モード: 横方向ノックバック
                this.x += knockback * knockbackDir;

                // 位置クランプ
                if (this.side === 'ally') {
                    this.x = Math.max(this.x, 80);
                } else {
                    this.x = Math.min(this.x, this.stageLength - 30);
                }
            }

            // ヒットストップ
            if (this.state !== 'DIE') {
                this.setUnitState('HITSTUN');
            }
        }
    }

    private showDamageNumber(damage: number): void {
        // シーンが破棄されている場合は何もしない
        if (!this.scene || !this.scene.add) {
            return;
        }
        const text = this.scene.add.text(this.x, this.y - this.sprite.displayHeight - 20 - this.flyingOffset, `-${damage}`, {
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

        // 死亡SE
        const deathVol = getSfxVolume(0.3);
        if (deathVol > 0) this.scene.sound.play('sfx_unit_death', { volume: deathVol });

        // 炎上タイマーをクリーンアップ
        for (const timer of this.burnTimers) {
            timer.destroy();
        }
        this.burnTimers = [];

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
        const hpRatio = this.maxHp > 0 ? this.hp / this.maxHp : 0;
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

        const distance = this.verticalMode
            ? Math.abs(this.y - target.y)
            : Math.abs(this.x - target.x);
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
        const distance = this.verticalMode
            ? Math.abs(this.y - this.castleTarget.y)
            : Math.abs(this.x - this.castleTarget.getX());

        // 城に対しても同様に自身の半径を考慮
        return distance <= (this.definition.attackRange + myHalfWidth);
    }

    /**
     * 縦移動モード設定（アリーナ用）
     */
    public setVerticalMode(enabled: boolean, screenHeight: number = 600): void {
        this.verticalMode = enabled;
        this.screenHeight = screenHeight;
        // 縦モードでは味方が上方向(-1)、敵が下方向(1)に移動
        if (enabled) {
            this.direction = this.side === 'ally' ? -1 : 1;
        }
    }

    // ============================================
    // ボス範囲攻撃システム
    // ============================================

    /**
     * 怒りモード突入演出
     */
    private onEnrage(): void {
        // 怒りモード突入SE
        const enrageVol = getSfxVolume(0.6);
        if (enrageVol > 0) this.scene.sound.play('sfx_attack_hit_sr', { volume: enrageVol });

        // 画面シェイク
        this.scene.cameras.main.shake(400, 0.015);

        // 赤オーラ
        const aura = this.scene.add.circle(this.x, this.y - this.flyingOffset, 100, 0xff0000, 0.4);
        aura.setDepth(45);
        this.scene.tweens.add({
            targets: aura,
            scale: 2.5,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => aura.destroy(),
        });

        // 警告テキスト
        const warning = this.scene.add.text(this.x, this.y - this.sprite.displayHeight - 80 - this.flyingOffset, '⚠️ ENRAGED ⚠️', {
            fontSize: '28px',
            color: '#ff0000',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        });
        warning.setOrigin(0.5);
        warning.setDepth(100);
        this.scene.tweens.add({
            targets: warning,
            y: warning.y - 60,
            alpha: 0,
            duration: 2000,
            ease: 'Power1',
            onComplete: () => warning.destroy(),
        });

        // スプライトを赤く点滅
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 5,
            onStart: () => this.sprite.setTint(0xff4444),
            onComplete: () => this.sprite.clearTint(),
        });

        // エンレイジ直後に確定AoE攻撃（死亡前に少なくとも1回は発動を保証）
        if (this.definition.bossAoe?.enabled) {
            this.scene.time.delayedCall(500, () => {
                if (!this.isDead()) {
                    this.performAoeAttack();
                    this.lastAoeTime = Date.now();
                }
            });
        }
    }

    /**
     * 範囲攻撃実行
     */
    private performAoeAttack(): void {
        const aoe = this.definition.bossAoe!;

        // 範囲攻撃SE
        const aoeVol = getSfxVolume(0.5);
        if (aoeVol > 0) this.scene.sound.play('sfx_cannon_fire', { volume: aoeVol });

        // 画面シェイク
        this.scene.cameras.main.shake(300, 0.025);

        // 範囲内のターゲットを取得
        const targets = this.getAoeTargets(aoe.range);

        // ビジュアルエフェクト
        this.createAoeEffect(aoe.range);

        // ダメージ適用（遅延付き）
        targets.forEach((target, index) => {
            this.scene.time.delayedCall(100 + index * 80, () => {
                if (!target.isDead()) {
                    target.takeDamage(aoe.damage, aoe.knockback);
                    this.createHitEffect(target.x, target.y);
                }
            });
        });

        // ターゲットがいない場合でも前方にエフェクト
        if (targets.length === 0) {
            const effectX = this.x + (this.direction * -1) * (aoe.range / 2);
            this.scene.time.delayedCall(200, () => {
                this.createHitEffect(effectX, this.y);
            });
        }
    }

    /**
     * 範囲内のターゲットを取得
     */
    private getAoeTargets(range: number): Unit[] {
        // シーンから味方ユニットリストを取得（ボスは敵側なので味方を攻撃）
        const scene = this.scene as any;
        const targetUnits: Unit[] = this.side === 'enemy' ? scene.allyUnits : scene.enemyUnits;

        if (!targetUnits) return [];

        return targetUnits.filter((unit: Unit) => {
            if (unit.isDead()) return false;

            // 2D距離計算（ユークリッド距離）- AoEは円形なので両軸を考慮
            const dx = this.x - unit.x;
            const dy = (this.y - this.flyingOffset) - (unit.y - unit.flyingOffset);
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= range;
        });
    }

    /**
     * 範囲攻撃エフェクト
     */
    private createAoeEffect(range: number): void {
        const centerX = this.x;
        const centerY = this.y - this.flyingOffset;

        // 衝撃波（円形に広がる）
        const wave = this.scene.add.circle(centerX, centerY, 30, 0xff4400, 0.6);
        wave.setStrokeStyle(6, 0xff0000);
        wave.setDepth(50);

        this.scene.tweens.add({
            targets: wave,
            radius: range,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => wave.destroy(),
        });

        // 内側の波
        const innerWave = this.scene.add.circle(centerX, centerY, 20, 0xffaa00, 0.4);
        innerWave.setDepth(51);

        this.scene.tweens.add({
            targets: innerWave,
            radius: range * 0.7,
            alpha: 0,
            duration: 400,
            ease: 'Power2',
            onComplete: () => innerWave.destroy(),
        });

        // 爆発絵文字
        const emoji = this.scene.add.text(centerX, centerY - 30, '🔥', {
            fontSize: '72px',
        });
        emoji.setOrigin(0.5);
        emoji.setDepth(52);
        this.scene.tweens.add({
            targets: emoji,
            y: centerY - 100,
            scale: 1.5,
            alpha: 0,
            duration: 700,
            ease: 'Power2',
            onComplete: () => emoji.destroy(),
        });

        // 範囲表示ライン（左右）
        const leftLine = this.scene.add.rectangle(centerX - range, centerY - 50, 6, 150, 0xff4444, 0.7);
        const rightLine = this.scene.add.rectangle(centerX + range, centerY - 50, 6, 150, 0xff4444, 0.7);
        leftLine.setDepth(49);
        rightLine.setDepth(49);

        this.scene.tweens.add({
            targets: [leftLine, rightLine],
            alpha: 0,
            duration: 600,
            ease: 'Power1',
            onComplete: () => {
                leftLine.destroy();
                rightLine.destroy();
            },
        });

        // 警告テキスト
        const aoeText = this.scene.add.text(centerX, centerY - 150, '💥 AOE ATTACK 💥', {
            fontSize: '22px',
            color: '#ff6600',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        });
        aoeText.setOrigin(0.5);
        aoeText.setDepth(53);

        this.scene.tweens.add({
            targets: aoeText,
            y: aoeText.y - 40,
            alpha: 0,
            duration: 1200,
            ease: 'Power1',
            onComplete: () => aoeText.destroy(),
        });
    }

    /**
     * ヒットエフェクト（個別ターゲット）
     */
    private createHitEffect(x: number, y: number): void {
        // 中心フラッシュ
        const flash = this.scene.add.circle(x, y - 40, 30, 0xffffff, 0.9);
        flash.setDepth(55);
        this.scene.tweens.add({
            targets: flash,
            scale: 2,
            alpha: 0,
            duration: 150,
            onComplete: () => flash.destroy(),
        });

        // 炎パーティクル
        const colors = [0xff4400, 0xff8800, 0xffcc00];
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const dist = 30 + Math.random() * 40;
            const size = 10 + Math.random() * 15;
            const color = colors[Math.floor(Math.random() * colors.length)];

            const particle = this.scene.add.circle(x, y - 40, size, color, 0.8);
            particle.setDepth(54);

            this.scene.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * dist,
                y: y - 40 + Math.sin(angle) * dist - 20,
                scale: 0.1,
                alpha: 0,
                duration: 300 + Math.random() * 200,
                ease: 'Power2',
                onComplete: () => particle.destroy(),
            });
        }

        // ヒット絵文字
        const hit = this.scene.add.text(x, y - 60, '💥', { fontSize: '36px' });
        hit.setOrigin(0.5);
        hit.setDepth(56);
        this.scene.tweens.add({
            targets: hit,
            y: y - 100,
            alpha: 0,
            duration: 400,
            ease: 'Power2',
            onComplete: () => hit.destroy(),
        });
    }

    // ============================================
    // スキルシステム - メインメソッド
    // ============================================

    /**
     * スキル初期化
     */
    private initializeSkill(): void {
        const skill = this.definition.skill;
        if (!skill) return;

        this.skillState = {
            skillId: skill.id,
            cooldownRemaining: 0,
            intervalTimer: 0,
            triggered: false
        };

        // パッシブスキルは即座に効果適用
        if (skill.trigger === 'passive') {
            this.applyPassiveSkill(skill);
        }

        // スキルアイコン表示（URのみ）
        if (this.definition.rarity === 'UR') {
            this.showSkillIcon(skill.icon);
        }
    }

    /**
     * パッシブスキル適用
     */
    private applyPassiveSkill(skill: typeof this.definition.skill): void {
        if (!skill) return;

        for (const effect of skill.effects) {
            switch (effect.type) {
                case 'last_stand':
                    this.lastStandAvailable = true;
                    this.addStatusIcon('💪', -1);
                    break;
                case 'regen':
                    // リジェネは updateSkillSystem で処理
                    this.addStatusIcon('💚', -1);
                    break;
                case 'damage_reduction':
                    this.damageReduction = effect.value;
                    break;
            }
        }
    }

    /**
     * スキルシステム更新（毎フレーム）
     */
    private updateSkillSystem(delta: number): void {
        // クールダウン更新
        if (this.skillState && this.skillState.cooldownRemaining > 0) {
            this.skillState.cooldownRemaining -= delta;
        }

        // interval スキルチェック
        if (this.skillState && this.definition.skill?.trigger === 'interval') {
            this.skillState.intervalTimer += delta;
            const interval = this.definition.skill.triggerIntervalMs || 10000;
            if (this.skillState.intervalTimer >= interval && this.skillState.cooldownRemaining <= 0) {
                this.skillState.intervalTimer = 0;
                this.executeSkill(this.definition.skill);
            }
        }

        // リジェネ処理
        if (this.definition.skill?.effects.some(e => e.type === 'regen')) {
            this.regenTimer += delta;
            if (this.regenTimer >= 1000) {
                this.regenTimer = 0;
                const regenEffect = this.definition.skill.effects.find(e => e.type === 'regen');
                if (regenEffect) {
                    const healAmount = Math.floor(this.maxHp * regenEffect.value);
                    this.heal(healAmount);
                }
            }
        }

        // ステータス効果の時間経過
        this.updateStatusEffectTimers(delta);
    }

    /**
     * ステータス効果タイマー更新
     */
    private updateStatusEffectTimers(delta: number): void {
        const expiredEffects: StatusEffect[] = [];

        // イテレーション中の配列変更を防ぐためにコピーを使用
        for (const effect of [...this.statusEffects]) {
            effect.remainingMs -= delta;
            if (effect.remainingMs <= 0) {
                expiredEffects.push(effect);
            }
        }

        // 期限切れ効果を除去
        for (const effect of expiredEffects) {
            this.removeStatusEffect(effect);
        }
    }

    /**
     * ステータス効果除去
     */
    private removeStatusEffect(effect: StatusEffect): void {
        const index = this.statusEffects.indexOf(effect);
        if (index > -1) {
            this.statusEffects.splice(index, 1);
        }

        // 効果タイプに応じた後処理
        switch (effect.type) {
            case 'time_stop':
            case 'stun':
            case 'freeze':
                this.isFrozen = false;
                if (this.sprite instanceof Phaser.GameObjects.Sprite) {
                    this.sprite.anims.resume();
                }
                this.sprite.clearTint();
                this.showUnfreezeEffect();
                break;
            case 'time_slow':
                // 他にスロー効果がなければ速度を戻す
                if (!this.statusEffects.some(e => e.type === 'time_slow')) {
                    this.speedModifier = 1.0;
                }
                break;
            case 'haste':
                if (!this.statusEffects.some(e => e.type === 'haste')) {
                    this.attackSpeedModifier = 1.0;
                }
                break;
            case 'invincible':
                this.isInvincible = false;
                this.showShieldBreakEffect();
                break;
            case 'damage_modifier':
                if (!this.statusEffects.some(e => e.type === 'damage_modifier')) {
                    this.damageModifier = 1.0;
                }
                break;
        }

        this.removeStatusIcon(effect.icon);
    }

    /**
     * スキルトリガー
     */
    private triggerSkill(trigger: string, target?: Unit): void {
        const skill = this.definition.skill;
        if (!skill || skill.trigger !== trigger) return;
        if (!this.skillState || this.skillState.cooldownRemaining > 0) return;

        // 発動確率チェック
        const chance = skill.triggerChance ?? 1.0;
        if (Math.random() > chance) return;

        // hp_threshold の1回限りチェック
        if (trigger === 'hp_threshold' && this.skillState.triggered) return;
        if (trigger === 'hp_threshold') {
            this.skillState.triggered = true;
        }

        this.executeSkill(skill, target);
    }

    /**
     * スキル実行
     */
    private executeSkill(skill: typeof this.definition.skill, target?: Unit): void {
        if (!skill) return;

        // クールダウン開始
        if (this.skillState) {
            this.skillState.cooldownRemaining = skill.cooldownMs;
        }

        // 発動エフェクト
        this.showSkillActivationEffect(skill);

        // 各効果を適用
        for (const effect of skill.effects) {
            this.applySkillEffect(effect, skill, target);
        }
    }

    /**
     * スキルダメージ計算
     */
    private calculateSkillDamage(baseDamage: number): { damage: number; isCritical: boolean } {
        let damage = baseDamage;
        let isCritical = false;

        // ダメージ倍率バフ適用
        damage *= this.damageModifier;

        // クリティカルチェック
        const skill = this.definition.skill;
        if (skill?.trigger === 'on_attack') {
            const critEffect = skill.effects.find(e => e.type === 'critical');
            if (critEffect) {
                // critEffect.range をクリティカル確率として使用（未定義時はデフォルト0.2 = 20%）
                // critEffect.value はダメージ倍率として使用
                const critChance = critEffect.range ?? 0.2;
                if (Math.random() < critChance) {
                    damage *= critEffect.value;
                    isCritical = true;
                }
            }
        }

        return { damage: Math.floor(damage), isCritical };
    }

    /**
     * スキル付きダメージ適用
     */
    private applyDamageWithSkill(target: Unit, damage: number, isCritical: boolean): void {
        if (isCritical) {
            this.showCriticalEffect(target, damage);
        }
        target.takeDamage(damage, this.definition.knockback, this);
    }

    /**
     * スキル付き遠距離攻撃
     */
    private performRangedAttackWithSkill(target: Unit, damage: number, isCritical: boolean): void {
        const startX = this.x;
        const startY = this.y - 50 - this.flyingOffset;
        const endX = target.x;
        const endY = target.y - 50;

        const projectile = this.createProjectile(startX, startY);
        const distance = Math.abs(endX - startX);
        const duration = Math.min(300, Math.max(100, distance * 0.8));

        this.scene.tweens.add({
            targets: projectile,
            x: endX,
            y: { value: endY, ease: 'Sine.easeIn' },
            duration: duration,
            onUpdate: () => {
                if (Math.random() < 0.3) {
                    this.createTrailParticle(projectile.x, projectile.y);
                }
            },
            onComplete: () => {
                projectile.destroy();
                if (!target.isDead()) {
                    if (isCritical) {
                        this.showCriticalEffect(target, damage);
                    }
                    target.takeDamage(damage, this.definition.knockback, this);
                    this.createRangedHitEffect(endX, endY);
                }
            },
        });
    }

    /**
     * 城への遠距離攻撃（ダメージ指定）
     */
    private performRangedAttackOnCastleWithDamage(damage: number): void {
        if (!this.castleTarget) return;

        const startX = this.x;
        const startY = this.y - 50 - this.flyingOffset;
        const endX = this.castleTarget.getX();
        const endY = this.castleTarget.y - 50;

        const projectile = this.createProjectile(startX, startY);
        const distance = Math.abs(endX - startX);
        const duration = Math.min(300, Math.max(100, distance * 0.8));

        this.scene.tweens.add({
            targets: projectile,
            x: endX,
            y: endY,
            duration: duration,
            onUpdate: () => {
                if (Math.random() < 0.3) {
                    this.createTrailParticle(projectile.x, projectile.y);
                }
            },
            onComplete: () => {
                projectile.destroy();
                if (this.castleTarget) {
                    this.castleTarget.takeDamage(damage);
                    this.createRangedHitEffect(endX, endY);
                }
            },
        });
    }

    /**
     * HP閾値スキルチェック
     */
    private checkHpThresholdSkill(): void {
        const skill = this.definition.skill;
        if (!skill || skill.trigger !== 'hp_threshold') return;
        if (this.skillState?.triggered) return;

        const threshold = skill.triggerThreshold ?? 0.3;
        const hpRatio = this.hp / this.maxHp;

        if (hpRatio <= threshold) {
            this.triggerSkill('hp_threshold');
        }
    }

    /**
     * スキル効果適用
     */
    private applySkillEffect(effect: SkillEffect, skill: typeof this.definition.skill, mainTarget?: Unit): void {
        if (!skill) return;
        const targets = this.getSkillTargets(effect.target, effect.range, mainTarget);

        switch (effect.type) {
            case 'time_stop':
                targets.forEach(t => this.applyTimeStop(t, effect.durationMs!, skill.icon));
                break;
            case 'time_slow':
                targets.forEach(t => this.applySlowEffect(t, effect.value, effect.durationMs!, skill.icon));
                break;
            case 'haste':
                targets.forEach(t => this.applyHasteEffect(t, effect.value, effect.durationMs!, skill.icon));
                break;
            case 'chain':
                if (mainTarget) {
                    this.applyChainLightning(mainTarget, effect.value, effect.chainCount!, effect.range!);
                }
                break;
            case 'burn':
                if (mainTarget) {
                    this.applyBurnEffect(mainTarget, effect.value, effect.durationMs!, skill.icon);
                }
                break;
            case 'stun':
                targets.forEach(t => this.applyStunEffect(t, effect.durationMs!, skill.icon));
                break;
            case 'invincible':
                this.applyInvincibleEffect(effect.durationMs!, skill.icon);
                break;
            case 'damage_modifier':
                targets.forEach(t => this.applyDamageBuffEffect(t, effect.value, effect.durationMs!, skill.icon));
                break;
        }
    }

    /**
     * スキルターゲット取得
     */
    private getSkillTargets(targetType: string, range?: number, mainTarget?: Unit): Unit[] {
        const scene = this.scene as any;
        const allyUnits: Unit[] = globalGetAllyUnits?.() || scene.allyUnits || [];
        const enemyUnits: Unit[] = globalGetEnemyUnits?.() || scene.enemyUnits || [];

        switch (targetType) {
            case 'self':
                return [this];
            case 'single_enemy':
                return mainTarget ? [mainTarget] : [];
            case 'all_enemies':
                return this.side === 'ally' ? enemyUnits.filter(u => !u.isDead()) : allyUnits.filter(u => !u.isDead());
            case 'area_enemies':
                const enemies = this.side === 'ally' ? enemyUnits : allyUnits;
                return enemies.filter(u => !u.isDead() && this.isWithinRange(u, range || 150));
            case 'single_ally':
                return [this];
            case 'all_allies':
                return this.side === 'ally' ? allyUnits.filter(u => !u.isDead()) : enemyUnits.filter(u => !u.isDead());
            case 'area_allies':
                const allies = this.side === 'ally' ? allyUnits : enemyUnits;
                return allies.filter(u => !u.isDead() && this.isWithinRange(u, range || 150));
            default:
                return [];
        }
    }

    private isWithinRange(target: Unit, range: number): boolean {
        const distance = this.verticalMode
            ? Math.abs(this.y - target.y)
            : Math.abs(this.x - target.x);
        return distance <= range;
    }

    // ============================================
    // スキル効果適用メソッド
    // ============================================

    private applyTimeStop(target: Unit, durationMs: number, icon: string): void {
        target.isFrozen = true;
        if (target.sprite instanceof Phaser.GameObjects.Sprite) {
            target.sprite.anims.pause();
        }
        target.sprite.setTint(0x88ccff);

        target.addStatusEffect({
            id: `time_stop_${Date.now()}`,
            type: 'time_stop',
            value: 1,
            remainingMs: durationMs,
            sourceUnitId: this.instanceId,
            icon: '⏱️'
        });

        target.addStatusIcon('⏱️', durationMs);
        this.showTimeStopEffect(target);
    }

    private applySlowEffect(target: Unit, slowValue: number, durationMs: number, icon: string): void {
        // 乗算スタック: 複数のスロー効果が重なる
        target.speedModifier *= slowValue;
        // Clamp speedModifier to prevent extreme values
        target.speedModifier = Math.max(0.1, Math.min(10.0, target.speedModifier));
        target.sprite.setTint(0xaaddff);

        target.addStatusEffect({
            id: `slow_${Date.now()}`,
            type: 'time_slow',
            value: slowValue,
            remainingMs: durationMs,
            sourceUnitId: this.instanceId,
            icon: '🐢'
        });

        target.addStatusIcon('🐢', durationMs);
    }

    private applyHasteEffect(target: Unit, hasteValue: number, durationMs: number, icon: string): void {
        // 乗算スタック: 複数のヘイスト効果が重なる
        target.attackSpeedModifier *= hasteValue;
        // Clamp attackSpeedModifier to prevent extreme values
        target.attackSpeedModifier = Math.max(0.1, Math.min(10.0, target.attackSpeedModifier));

        target.addStatusEffect({
            id: `haste_${Date.now()}`,
            type: 'haste',
            value: hasteValue,
            remainingMs: durationMs,
            sourceUnitId: this.instanceId,
            icon: '⚡'
        });

        target.addStatusIcon('⚡', durationMs);
        this.showHasteEffect(target);
    }

    private applyChainLightning(mainTarget: Unit, damageRatio: number, chainCount: number, range: number): void {
        const scene = this.scene as any;
        const enemies = this.side === 'ally'
            ? (globalGetEnemyUnits?.() || scene.enemyUnits || [])
            : (globalGetAllyUnits?.() || scene.allyUnits || []);

        const chainTargets: Unit[] = [];
        let currentTarget = mainTarget;

        for (let i = 0; i < chainCount; i++) {
            const nextTarget = enemies.find((e: Unit) =>
                !e.isDead() &&
                e !== mainTarget &&
                !chainTargets.includes(e) &&
                Math.abs(currentTarget.x - e.x) <= range
            );

            if (nextTarget) {
                chainTargets.push(nextTarget);
                currentTarget = nextTarget;
            } else {
                break;
            }
        }

        // 連鎖ダメージ適用（ダメージバフを適用）
        const chainDamage = Math.floor(this.definition.attackDamage * damageRatio * this.damageModifier);
        this.showChainLightningEffect(mainTarget, chainTargets, chainDamage);
    }

    private applyBurnEffect(target: Unit, damagePerSecond: number, durationMs: number, icon: string): void {
        // 既存の炎上を上書き - 古いタイマーを破棄してから新しいものを作成
        const existingBurn = target.statusEffects.find(e => e.type === 'burn');
        if (existingBurn) {
            // Destroy old burn timers before reapplying
            for (const timer of target.burnTimers) {
                timer.destroy();
            }
            target.burnTimers = [];
            existingBurn.remainingMs = durationMs;
            existingBurn.value = damagePerSecond;
            // Start new burn damage with updated values
            this.startBurnDamage(target, damagePerSecond, durationMs);
            return;
        }

        target.addStatusEffect({
            id: `burn_${Date.now()}`,
            type: 'burn',
            value: damagePerSecond,
            remainingMs: durationMs,
            sourceUnitId: this.instanceId,
            icon: '🔥'
        });

        target.addStatusIcon('🔥', durationMs);
        this.startBurnDamage(target, damagePerSecond, durationMs);
    }

    private startBurnDamage(target: Unit, damagePerTick: number, durationMs: number): void {
        const tickInterval = 500;
        let elapsed = 0;

        const timer = this.scene.time.addEvent({
            delay: tickInterval,
            callback: () => {
                elapsed += tickInterval;
                if (target.isDead() || elapsed > durationMs) {
                    timer.destroy();
                    // タイマー配列から削除
                    const index = target.burnTimers.indexOf(timer);
                    if (index > -1) {
                        target.burnTimers.splice(index, 1);
                    }
                    return;
                }

                target.takeBurnDamage(damagePerTick / 2); // 0.5秒ごとなので半分
                this.showBurnDamageNumber(target, Math.floor(damagePerTick / 2));
            },
            loop: true
        });

        // タイマーを保存してdie()時にクリーンアップできるようにする
        target.burnTimers.push(timer);
    }

    public takeBurnDamage(damage: number): void {
        // 無敵中はダメージ無効
        if (this.isInvincible) {
            this.showBlockedEffect();
            return;
        }

        // ダメージ軽減適用（damageReductionを[0, 1]にクランプ）
        const clampedReduction = Math.max(0, Math.min(1, this.damageReduction));
        const actualDamage = Math.floor(damage * (1 - clampedReduction));
        this.hp -= actualDamage;

        // ラストスタンドチェック
        if (this.hp <= 0 && this.lastStandAvailable && !this.lastStandUsed) {
            this.hp = 1;
            this.lastStandUsed = true;
            this.showLastStandEffect();
            return;
        }

        if (this.hp <= 0) {
            this.hp = 0;
            this.die();
        }
    }

    private applyStunEffect(target: Unit, durationMs: number, icon: string): void {
        target.isFrozen = true;
        if (target.sprite instanceof Phaser.GameObjects.Sprite) {
            target.sprite.anims.pause();
        }
        target.sprite.setTint(0xffff00);

        target.addStatusEffect({
            id: `stun_${Date.now()}`,
            type: 'stun',
            value: 1,
            remainingMs: durationMs,
            sourceUnitId: this.instanceId,
            icon: '💫'
        });

        target.addStatusIcon('💫', durationMs);
    }

    private applyInvincibleEffect(durationMs: number, icon: string): void {
        this.isInvincible = true;

        this.addStatusEffect({
            id: `invincible_${Date.now()}`,
            type: 'invincible',
            value: 1,
            remainingMs: durationMs,
            sourceUnitId: this.instanceId,
            icon: '🛡️'
        });

        this.addStatusIcon('🛡️', durationMs);
        this.showDivineShieldEffect();
    }

    private applyDamageBuffEffect(target: Unit, value: number, durationMs: number, icon: string): void {
        // 乗算スタック: 複数のダメージバフ効果が重なる
        target.damageModifier *= value;
        // Clamp damageModifier to prevent extreme values
        target.damageModifier = Math.max(0.1, Math.min(10.0, target.damageModifier));

        target.addStatusEffect({
            id: `dmg_buff_${Date.now()}`,
            type: 'damage_modifier',
            value: value,
            remainingMs: durationMs,
            sourceUnitId: this.instanceId,
            icon: '⬆️'
        });

        target.addStatusIcon('⬆️', durationMs);
    }

    public addStatusEffect(effect: StatusEffect): void {
        this.statusEffects.push(effect);
    }

    // ============================================
    // ビジュアルエフェクト
    // ============================================

    private showSkillIcon(icon: string): void {
        const skillIcon = this.scene.add.text(25, -10, icon, { fontSize: '14px' });
        skillIcon.setOrigin(0.5);
        this.add(skillIcon);
    }

    private showSkillActivationEffect(skill: typeof this.definition.skill): void {
        if (!skill) return;

        const text = this.scene.add.text(this.x, this.y - this.sprite.displayHeight - 40 - this.flyingOffset,
            `${skill.icon} ${skill.nameJa}!`, {
            fontSize: '18px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        });
        text.setOrigin(0.5);
        text.setDepth(100);

        this.scene.tweens.add({
            targets: text,
            y: text.y - 40,
            alpha: 0,
            duration: 1200,
            onComplete: () => text.destroy()
        });
    }

    private showTimeStopEffect(target: Unit): void {
        const wave = this.scene.add.circle(this.x, this.y - 40, 20, 0x00ffff, 0.5);
        wave.setStrokeStyle(3, 0x00ffff);
        wave.setDepth(99);

        this.scene.tweens.add({
            targets: wave,
            radius: 200,
            alpha: 0,
            duration: 500,
            onComplete: () => wave.destroy()
        });
    }

    private showUnfreezeEffect(): void {
        // 氷砕けエフェクト
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const shard = this.scene.add.triangle(this.x, this.y - 40, 0, -8, 6, 4, -6, 4, 0x88ccff, 0.8);
            shard.setDepth(100);

            this.scene.tweens.add({
                targets: shard,
                x: this.x + Math.cos(angle) * 40,
                y: this.y - 40 + Math.sin(angle) * 40,
                alpha: 0,
                angle: 360,
                duration: 400,
                onComplete: () => shard.destroy()
            });
        }
    }

    private showHasteEffect(target: Unit): void {
        // 青い風ライン
        for (let i = 0; i < 3; i++) {
            const line = this.scene.add.rectangle(target.x - 20, target.y - 40 + i * 20, 40, 3, 0x00ffff, 0.7);
            line.setDepth(98);

            this.scene.tweens.add({
                targets: line,
                x: target.x + 30,
                alpha: 0,
                duration: 300,
                delay: i * 100,
                onComplete: () => line.destroy()
            });
        }
    }

    private showCriticalEffect(target: Unit, damage: number): void {
        // 斬撃ライン
        const graphics = this.scene.add.graphics();
        graphics.lineStyle(4, 0xff4444);
        graphics.lineBetween(target.x - 30, target.y - 80, target.x + 30, target.y - 20);
        graphics.setDepth(100);

        this.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 200,
            onComplete: () => graphics.destroy()
        });

        // CRITICAL! テキスト
        const critText = this.scene.add.text(target.x, target.y - 100, 'CRITICAL!', {
            fontSize: '24px',
            color: '#ff0000',
            stroke: '#ffff00',
            strokeThickness: 3
        });
        critText.setOrigin(0.5);
        critText.setDepth(101);

        this.scene.tweens.add({
            targets: critText,
            y: critText.y - 30,
            alpha: 0,
            duration: 800,
            onComplete: () => critText.destroy()
        });

        // 画面シェイク
        this.scene.cameras.main.shake(100, 0.01);
    }

    private showChainLightningEffect(mainTarget: Unit, chainTargets: Unit[], chainDamage: number): void {
        const graphics = this.scene.add.graphics();
        graphics.setDepth(100);

        let prev = { x: mainTarget.x, y: mainTarget.y - 40 };

        chainTargets.forEach((target, i) => {
            const end = { x: target.x, y: target.y - 40 };

            this.scene.time.delayedCall(i * 100, () => {
                // 稲妻描画
                graphics.lineStyle(3, 0xffff00);
                graphics.beginPath();
                graphics.moveTo(prev.x, prev.y);

                const midX = (prev.x + end.x) / 2 + (Math.random() - 0.5) * 40;
                const midY = (prev.y + end.y) / 2 + (Math.random() - 0.5) * 20;
                graphics.lineTo(midX, midY);
                graphics.lineTo(end.x, end.y);
                graphics.strokePath();

                // ダメージ適用
                if (!target.isDead()) {
                    target.takeDamage(chainDamage, 0, this);
                    this.showChainDamageNumber(target, chainDamage);
                }

                // 電撃パーティクル
                const spark = this.scene.add.circle(end.x, end.y, 10, 0xffff00, 0.8);
                spark.setDepth(101);
                this.scene.tweens.add({
                    targets: spark,
                    scale: 2,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => spark.destroy()
                });
            });

            prev = end;
        });

        this.scene.time.delayedCall(chainTargets.length * 100 + 300, () => {
            graphics.destroy();
        });
    }

    private showChainDamageNumber(target: Unit, damage: number): void {
        const text = this.scene.add.text(target.x, target.y - 60, `-${damage}`, {
            fontSize: '14px',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 2
        });
        text.setOrigin(0.5);
        text.setDepth(102);

        this.scene.tweens.add({
            targets: text,
            y: text.y - 25,
            alpha: 0,
            duration: 600,
            onComplete: () => text.destroy()
        });
    }

    private showBurnDamageNumber(target: Unit, damage: number): void {
        const text = this.scene.add.text(target.x + (Math.random() - 0.5) * 20, target.y - 50, `-${damage}`, {
            fontSize: '12px',
            color: '#ff6600',
            stroke: '#000000',
            strokeThickness: 2
        });
        text.setOrigin(0.5);
        text.setDepth(102);

        this.scene.tweens.add({
            targets: text,
            y: text.y - 20,
            alpha: 0,
            duration: 500,
            onComplete: () => text.destroy()
        });
    }

    private showDivineShieldEffect(): void {
        // 金色オーラ
        const aura = this.scene.add.circle(0, -40, 60, 0xffdd00, 0.3);
        this.add(aura);

        this.scene.tweens.add({
            targets: aura,
            scale: { from: 0.9, to: 1.1 },
            alpha: { from: 0.2, to: 0.4 },
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        // 発動テキスト
        const text = this.scene.add.text(this.x, this.y - this.sprite.displayHeight - 60, '🛡️ DIVINE SHIELD!', {
            fontSize: '20px',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 3
        });
        text.setOrigin(0.5);
        text.setDepth(100);

        this.scene.tweens.add({
            targets: text,
            y: text.y - 40,
            alpha: 0,
            duration: 1500,
            onComplete: () => text.destroy()
        });
    }

    private showShieldBreakEffect(): void {
        // オーラ破壊エフェクト
        const burst = this.scene.add.circle(this.x, this.y - 40, 30, 0xffdd00, 0.6);
        burst.setDepth(100);

        this.scene.tweens.add({
            targets: burst,
            scale: 3,
            alpha: 0,
            duration: 300,
            onComplete: () => burst.destroy()
        });
    }

    private showBlockedEffect(): void {
        // バリア波紋
        const ripple = this.scene.add.circle(this.x, this.y - 40, 20, 0xffdd00, 0.5);
        ripple.setDepth(100);

        this.scene.tweens.add({
            targets: ripple,
            scale: 2,
            alpha: 0,
            duration: 200,
            onComplete: () => ripple.destroy()
        });

        // "0" 表示
        const text = this.scene.add.text(this.x, this.y - 60, '0', {
            fontSize: '16px',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 2
        });
        text.setOrigin(0.5);

        this.scene.tweens.add({
            targets: text,
            y: text.y - 20,
            alpha: 0,
            duration: 500,
            onComplete: () => text.destroy()
        });
    }

    private showLastStandEffect(): void {
        // スローモーション風（実際には適用しない）
        const burst = this.scene.add.circle(this.x, this.y - 40, 30, 0xff0000, 0.8);
        burst.setDepth(100);

        this.scene.tweens.add({
            targets: burst,
            scale: 3,
            alpha: 0,
            duration: 500,
            onComplete: () => burst.destroy()
        });

        // テキスト
        const text = this.scene.add.text(this.x, this.y - 100, '💪 LAST STAND!', {
            fontSize: '24px',
            color: '#ff4444',
            stroke: '#000000',
            strokeThickness: 4
        });
        text.setOrigin(0.5);
        text.setDepth(101);

        this.scene.tweens.add({
            targets: text,
            y: text.y - 50,
            alpha: 0,
            duration: 1500,
            onComplete: () => text.destroy()
        });

        // ユニット赤点滅
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 5,
            onStart: () => this.sprite.setTint(0xff4444),
            onComplete: () => this.sprite.clearTint()
        });
    }

    /**
     * HP回復
     */
    public heal(amount: number): void {
        const actualHeal = Math.min(amount, this.maxHp - this.hp);
        if (actualHeal <= 0) return;

        this.hp += actualHeal;
        this.showHealNumber(actualHeal);
    }

    private showHealNumber(amount: number): void {
        const text = this.scene.add.text(this.x, this.y - 60, `+${amount}`, {
            fontSize: '14px',
            color: '#00ff00',
            stroke: '#004400',
            strokeThickness: 2
        });
        text.setOrigin(0.5);
        text.setDepth(102);

        this.scene.tweens.add({
            targets: text,
            y: text.y - 25,
            alpha: 0,
            duration: 800,
            onComplete: () => text.destroy()
        });

        // 回復パーティクル
        const heart = this.scene.add.text(this.x, this.y - 40, '💚', { fontSize: '16px' });
        heart.setOrigin(0.5);

        this.scene.tweens.add({
            targets: heart,
            y: heart.y - 30,
            alpha: 0,
            duration: 600,
            onComplete: () => heart.destroy()
        });
    }

    // ============================================
    // ステータスアイコン管理
    // ============================================

    public addStatusIcon(emoji: string, durationMs: number): void {
        if (this.statusIcons.has(emoji)) return;

        const container = this.scene.add.container(25 - this.statusIcons.size * 20, 5);

        // 背景
        const bg = this.scene.add.circle(0, 0, 10, 0x000000, 0.5);
        container.add(bg);

        // アイコン
        const icon = this.scene.add.text(0, 0, emoji, { fontSize: '14px' });
        icon.setOrigin(0.5);
        container.add(icon);

        this.add(container);
        this.statusIcons.set(emoji, container);
    }

    public removeStatusIcon(emoji: string): void {
        const container = this.statusIcons.get(emoji);
        if (container) {
            container.destroy();
            this.statusIcons.delete(emoji);
        }
    }
}
