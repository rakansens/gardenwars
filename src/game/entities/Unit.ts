import Phaser from 'phaser';
import type { UnitDefinition, UnitState, UnitSide } from '@/data/types';
import type { Castle } from './Castle';

// ============================================
// Unit Entity - 状態機械による自動戦闘ユニット
// ============================================
// 注: アニメーション対応判定はランタイムでテクスチャ存在チェックを行う（hasAnimation参照は不要）

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
        // スプライトサイズが取得できているか確認
        if (this.sprite.width === 0) {
            // まだロードされていない場合などの安全策（通常は起こらないはず）
            this.sprite.width = 100;
            this.sprite.height = 100;
        }

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
                // 召喚SE（味方のみ）
                if (this.side === 'ally') {
                    this.scene.sound.play('sfx_unit_spawn', { volume: 0.3 });
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
        this.scene.sound.play(hitSfx, { volume: 0.25 });

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

            const knockbackDir = this.side === 'ally' ? -1 : 1;

            if (this.verticalMode) {
                // アリーナモード: 縦方向ノックバック
                this.y += knockback * knockbackDir;

                // 位置クランプ
                if (this.side === 'ally') {
                    this.y = Math.min(this.y, this.screenHeight - 80);
                } else {
                    this.y = Math.max(this.y, 100);
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
        this.scene.sound.play('sfx_unit_death', { volume: 0.3 });

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
        this.scene.sound.play('sfx_attack_hit_sr', { volume: 0.6 });

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
    }

    /**
     * 範囲攻撃実行
     */
    private performAoeAttack(): void {
        const aoe = this.definition.bossAoe!;

        // 範囲攻撃SE
        this.scene.sound.play('sfx_cannon_fire', { volume: 0.5 });

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

            if (this.verticalMode) {
                const distance = Math.abs(this.y - unit.y);
                return distance <= range;
            } else {
                const distance = Math.abs(this.x - unit.x);
                return distance <= range;
            }
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
}
