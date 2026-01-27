import Phaser from 'phaser';
import { Unit } from '../entities/Unit';
import { Castle } from '../entities/Castle';
import { CombatSystem } from '../systems/CombatSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { CostSystem } from '../systems/CostSystem';
import { eventBus, GameEvents } from '../utils/EventBus';
import type { StageDefinition, UnitDefinition, GameState } from '@/data/types';

// ============================================
// BattleScene - メインバトルシーン
// ============================================

export interface BattleSceneData {
    stage: StageDefinition;
    team: UnitDefinition[];
    allUnits: UnitDefinition[];
}

export class BattleScene extends Phaser.Scene {
    // ゲームデータ
    private stageData!: StageDefinition;
    private teamData: UnitDefinition[] = [];
    private allUnitsData: UnitDefinition[] = [];

    // エンティティ
    private allyUnits: Unit[] = [];
    private enemyUnits: Unit[] = [];
    private allyCastle!: Castle;
    private enemyCastle!: Castle;

    // システム
    private combatSystem!: CombatSystem;
    private waveSystem!: WaveSystem;
    private costSystem!: CostSystem;

    // ゲーム状態
    private gameState: GameState = 'LOADING';
    private groundY: number = 0;

    // UI
    private costText!: Phaser.GameObjects.Text;
    private stateText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'BattleScene' });
    }

    init(data: BattleSceneData) {
        this.stageData = data.stage;
        this.teamData = data.team;
        this.allUnitsData = data.allUnits;
    }

    create() {
        const { width, height } = this.scale;
        this.groundY = height - 80;

        // 背景
        this.createBackground();

        // 地面
        this.add.rectangle(width / 2, height - 40, width, 80, 0x3d2817);

        // 城を配置
        this.allyCastle = new Castle(this, 50, this.groundY, 'ally', this.stageData.baseCastleHp);
        this.enemyCastle = new Castle(this, this.stageData.length, this.groundY, 'enemy', this.stageData.enemyCastleHp);

        // カメラ設定
        this.cameras.main.setBounds(0, 0, this.stageData.length + 100, height);
        this.cameras.main.scrollX = 0;

        // システム初期化
        this.combatSystem = new CombatSystem(this);
        this.waveSystem = new WaveSystem(this, this.stageData, this.allUnitsData);
        this.costSystem = new CostSystem({
            current: 200,
            max: 1000,
            regenRate: 50,
        });

        // UI作成
        this.createUI();

        // イベントリスナー
        this.setupEventListeners();

        // ゲーム開始
        this.startBattle();
    }

    private createBackground() {
        const { width, height } = this.scale;

        // 空のグラデーション
        const sky = this.add.rectangle(width / 2, height / 2, width * 2, height, 0x87ceeb);
        sky.setScrollFactor(0);

        // 雲（装飾）
        for (let i = 0; i < 5; i++) {
            const cloud = this.add.ellipse(
                Math.random() * width * 2,
                50 + Math.random() * 100,
                80 + Math.random() * 60,
                40 + Math.random() * 20,
                0xffffff,
                0.8
            );
            cloud.setScrollFactor(0.1);
        }
    }

    private createUI() {
        const { width, height } = this.scale;

        // コストゲージ表示
        this.costText = this.add.text(20, 20, 'Cost: 0 / 1000', {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: '#00000088',
            padding: { x: 10, y: 5 },
        });
        this.costText.setScrollFactor(0);
        this.costText.setDepth(100);

        // ゲーム状態表示
        this.stateText = this.add.text(width - 20, 20, '', {
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#00000088',
            padding: { x: 10, y: 5 },
        });
        this.stateText.setOrigin(1, 0);
        this.stateText.setScrollFactor(0);
        this.stateText.setDepth(100);

        // 召喚ボタン（チーム分）
        this.createSummonButtons();

        // カメラ操作説明
        const helpText = this.add.text(width / 2, height - 20, 'ドラッグでカメラ移動', {
            fontSize: '14px',
            color: '#ffffff',
        });
        helpText.setOrigin(0.5, 0.5);
        helpText.setScrollFactor(0);
        helpText.setDepth(100);

        // カメラドラッグ
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (pointer.isDown) {
                this.cameras.main.scrollX -= pointer.velocity.x * 0.5;
                this.cameras.main.scrollX = Phaser.Math.Clamp(
                    this.cameras.main.scrollX,
                    0,
                    this.stageData.length - this.scale.width + 100
                );
            }
        });
    }

    private createSummonButtons() {
        const { height } = this.scale;
        const buttonY = height - 140;
        const buttonWidth = 100;
        const buttonHeight = 60;
        const startX = 120;
        const gap = 20;

        this.teamData.forEach((unit, index) => {
            const x = startX + index * (buttonWidth + gap);

            // ボタン背景
            const bg = this.add.rectangle(x, buttonY, buttonWidth, buttonHeight, 0x4488ff, 0.9);
            bg.setScrollFactor(0);
            bg.setDepth(100);
            bg.setInteractive({ useHandCursor: true });

            // ユニット名
            const nameText = this.add.text(x, buttonY - 10, unit.name.slice(0, 4), {
                fontSize: '14px',
                color: '#ffffff',
            });
            nameText.setOrigin(0.5, 0.5);
            nameText.setScrollFactor(0);
            nameText.setDepth(101);

            // コスト表示
            const costText = this.add.text(x, buttonY + 15, `¥${unit.cost}`, {
                fontSize: '12px',
                color: '#ffff00',
            });
            costText.setOrigin(0.5, 0.5);
            costText.setScrollFactor(0);
            costText.setDepth(101);

            // クリックで召喚
            bg.on('pointerdown', () => {
                this.summonAllyUnit(unit.id);
            });

            // ホバーエフェクト
            bg.on('pointerover', () => bg.setFillStyle(0x66aaff));
            bg.on('pointerout', () => bg.setFillStyle(0x4488ff));
        });
    }

    private setupEventListeners() {
        // 召喚イベント（外部からの呼び出し用）
        eventBus.on(GameEvents.SUMMON_UNIT, (unitId: string) => {
            this.summonAllyUnit(unitId);
        });
    }

    private startBattle() {
        this.gameState = 'PLAYING';
        this.waveSystem.start();
        eventBus.emit(GameEvents.BATTLE_STARTED);
    }

    update(time: number, delta: number) {
        if (this.gameState !== 'PLAYING') return;

        // コスト回復
        this.costSystem.update(delta);
        this.updateCostUI();

        // Wave処理（敵出現）
        this.waveSystem.update();

        // ユニット更新
        this.updateUnits(delta);

        // 戦闘判定
        this.combatSystem.update(
            this.allyUnits.filter(u => !u.isDead()),
            this.enemyUnits.filter(u => !u.isDead()),
            this.allyCastle,
            this.enemyCastle
        );

        // 城への直接攻撃チェック
        this.checkCastleAttacks();

        // 死亡ユニットの除去
        this.cleanupDeadUnits();

        // 勝敗判定
        this.checkGameEnd();

        // 状態表示更新
        this.updateStateUI();
    }

    private updateUnits(delta: number) {
        for (const unit of [...this.allyUnits, ...this.enemyUnits]) {
            if (!unit.isDead()) {
                unit.update(delta);
            }
        }
    }

    private checkCastleAttacks() {
        // 味方ユニットが敵城に攻撃
        for (const ally of this.allyUnits) {
            if (ally.isDead()) continue;
            if (!ally.target && ally.state === 'WALK') {
                const distance = Math.abs(ally.getX() - this.enemyCastle.getX());
                if (distance <= ally.definition.attackRange) {
                    // 強制的に戦闘開始（城攻撃）
                    if (ally.state === 'WALK') {
                        // 城への攻撃状態に
                        ally['setState']('ATTACK_WINDUP');
                    }
                }
            }
            // ATTACK_WINDUP完了時に城へダメージ
            if (!ally.target && ally.state === 'ATTACK_COOLDOWN') {
                const distance = Math.abs(ally.getX() - this.enemyCastle.getX());
                if (distance <= ally.definition.attackRange) {
                    // 攻撃サイクルで1回だけダメージ
                    // ステートタイマーが0に近い時（状態移行直後）
                    if (ally['stateTimer'] < 100) {
                        this.enemyCastle.takeDamage(ally.definition.attackDamage);
                    }
                }
            }
        }

        // 敵ユニットが味方城に攻撃
        for (const enemy of this.enemyUnits) {
            if (enemy.isDead()) continue;
            if (!enemy.target && enemy.state === 'WALK') {
                const distance = Math.abs(enemy.getX() - this.allyCastle.getX());
                if (distance <= enemy.definition.attackRange) {
                    enemy['setState']('ATTACK_WINDUP');
                }
            }
            if (!enemy.target && enemy.state === 'ATTACK_COOLDOWN') {
                const distance = Math.abs(enemy.getX() - this.allyCastle.getX());
                if (distance <= enemy.definition.attackRange) {
                    if (enemy['stateTimer'] < 100) {
                        this.allyCastle.takeDamage(enemy.definition.attackDamage);
                    }
                }
            }
        }
    }

    private cleanupDeadUnits() {
        this.allyUnits = this.allyUnits.filter(u => !u.isDead() || u.active);
        this.enemyUnits = this.enemyUnits.filter(u => !u.isDead() || u.active);
    }

    private checkGameEnd() {
        if (this.enemyCastle.isDestroyed()) {
            this.endBattle(true);
        } else if (this.allyCastle.isDestroyed()) {
            this.endBattle(false);
        }
    }

    private endBattle(win: boolean) {
        this.gameState = win ? 'WIN' : 'LOSE';

        // 結果を通知
        const result = {
            stageId: this.stageData.id,
            win,
            coinsGained: win ? this.stageData.reward.coins : 0,
            timestamp: Date.now(),
        };

        eventBus.emit(win ? GameEvents.BATTLE_WIN : GameEvents.BATTLE_LOSE, result);

        // 結果表示
        const { width, height } = this.scale;
        const resultText = this.add.text(width / 2, height / 2, win ? '勝利！' : '敗北...', {
            fontSize: '64px',
            color: win ? '#ffff00' : '#ff0000',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6,
        });
        resultText.setOrigin(0.5, 0.5);
        resultText.setScrollFactor(0);
        resultText.setDepth(200);

        // 報酬表示
        if (win) {
            const rewardText = this.add.text(width / 2, height / 2 + 60, `+${this.stageData.reward.coins} コイン獲得！`, {
                fontSize: '24px',
                color: '#ffffff',
            });
            rewardText.setOrigin(0.5, 0.5);
            rewardText.setScrollFactor(0);
            rewardText.setDepth(200);
        }
    }

    private updateCostUI() {
        const current = Math.floor(this.costSystem.getCurrent());
        const max = this.costSystem.getMax();
        this.costText.setText(`Cost: ${current} / ${max}`);
    }

    private updateStateUI() {
        const allyCount = this.allyUnits.filter(u => !u.isDead()).length;
        const enemyCount = this.enemyUnits.filter(u => !u.isDead()).length;
        this.stateText.setText(`味方: ${allyCount} | 敵: ${enemyCount}`);
    }

    // 味方ユニット召喚（UIから呼び出し）
    summonAllyUnit(unitId: string) {
        if (this.gameState !== 'PLAYING') return;

        const unitDef = this.allUnitsData.find(u => u.id === unitId);
        if (!unitDef) return;

        // コストチェック
        if (!this.costSystem.spend(unitDef.cost)) {
            // コスト不足
            return;
        }

        // 城の少し前からスポーン
        const spawnX = this.allyCastle.getX() + 60;
        const unit = new Unit(this, spawnX, this.groundY, unitDef, 'ally', this.stageData.length);
        this.allyUnits.push(unit);
    }

    // 敵ユニット召喚（WaveSystemから呼び出し）
    spawnEnemyUnit(unitId: string) {
        const unitDef = this.allUnitsData.find(u => u.id === unitId);
        if (!unitDef) return;

        // 敵城の少し前からスポーン
        const spawnX = this.enemyCastle.getX() - 60;
        const unit = new Unit(this, spawnX, this.groundY, unitDef, 'enemy', this.stageData.length);
        this.enemyUnits.push(unit);
    }
}
