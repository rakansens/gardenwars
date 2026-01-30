import Phaser from 'phaser';
import { Unit } from '../entities/Unit';
import { Castle } from '../entities/Castle';
import { CostSystem } from '../systems/CostSystem';
import { eventBus, GameEvents } from '../utils/EventBus';
import type { ArenaStageDefinition, UnitDefinition, GameState, Rarity, LaneIndex, ArenaWaveConfig } from '@/data/types';

// ============================================
// ArenaScene - 5レーン制タワーディフェンス
// ============================================

const LANE_COUNT = 5;

// レアリティ別デフォルトクールダウン時間（ミリ秒）
const COOLDOWN_BY_RARITY: Record<Rarity, number> = {
    N: 2000,
    R: 4000,
    SR: 8000,
    SSR: 12000,
    UR: 15000,
};

function getSpawnCooldown(unit: UnitDefinition): number {
    return unit.spawnCooldownMs ?? COOLDOWN_BY_RARITY[unit.rarity];
}

export interface ArenaSceneData {
    stage: ArenaStageDefinition;
    team: UnitDefinition[];
    allUnits: UnitDefinition[];
}

export class ArenaScene extends Phaser.Scene {
    // ゲームデータ
    private stageData!: ArenaStageDefinition;
    private teamData: UnitDefinition[] = [];
    private allUnitsData: UnitDefinition[] = [];

    // レーン設定
    private laneWidth: number = 0;
    private lanePositions: number[] = [];

    // エンティティ
    private allyUnits: Unit[] = [];
    private enemyUnits: Unit[] = [];
    private allyCastle!: Castle;
    private enemyCastle!: Castle;

    // ユニットのレーン情報
    private unitLanes: Map<string, LaneIndex> = new Map();

    // システム
    private costSystem!: CostSystem;

    // Wave管理
    private waveSchedule: { time: number; config: ArenaWaveConfig; spawned: number }[] = [];
    private elapsedTime: number = 0;

    // ゲーム状態
    private gameState: GameState = 'LOADING';
    private gameSpeed: number = 1;

    // UI要素
    private costText!: Phaser.GameObjects.Text;
    private stateText!: Phaser.GameObjects.Text;
    private costBarBg!: Phaser.GameObjects.Rectangle;
    private costBarFill!: Phaser.GameObjects.Rectangle;
    private laneIndicators: Phaser.GameObjects.Rectangle[] = [];
    private laneButtons: Phaser.GameObjects.Container[] = [];
    private unitButtons: Phaser.GameObjects.Container[] = [];
    private unitCooldowns: Map<string, number> = new Map();
    private selectedLane: LaneIndex | null = null;

    // 配置エリア
    private placementZone!: Phaser.GameObjects.Rectangle;
    private placementY: number = 0;

    constructor() {
        super({ key: 'ArenaScene' });
    }

    shutdown() {
        eventBus.removeAllListeners(GameEvents.SUMMON_UNIT);
    }

    init(data: ArenaSceneData) {
        this.stageData = data.stage;
        this.teamData = data.team;
        this.allUnitsData = data.allUnits;

        this.gameState = 'LOADING';
        this.allyUnits = [];
        this.enemyUnits = [];
        this.unitLanes = new Map();
        this.unitCooldowns = new Map();
        this.elapsedTime = 0;
        this.selectedLane = null;
        this.laneButtons = [];

        // Wave スケジュール初期化
        this.waveSchedule = this.stageData.enemyWaves.map(wave => ({
            time: wave.timeMs,
            config: wave,
            spawned: 0
        }));

        eventBus.removeAllListeners(GameEvents.SUMMON_UNIT);
    }

    preload() {
        // 城スプライトをロード
        this.load.image('castle_ally', '/assets/sprites/castle_ally.webp');
        this.load.image('castle_enemy', '/assets/sprites/castle_enemy.webp');

        // 基本ユニットスプライトをロード
        const unitSprites = [
            'cat_warrior', 'cat_tank', 'cat_archer', 'cat_mage', 'cat_ninja',
            'ice_flower', 'corn_fighter', 'block_slime', 'sunflower', 'watermelon',
            'corn_kid', 'ribbon_girl', 'penguin_boy', 'cinnamon_girl',
            'enemy_dog', 'enemy_wolf', 'enemy_crow', 'nika', 'lennon'
        ];

        for (const sprite of unitSprites) {
            this.load.image(sprite, `/assets/sprites/${sprite}.webp`);
        }

        // アニメーションアトラス
        const animatedUnits = ['cat_warrior', 'corn_fighter', 'penguin_boy', 'cinnamon_girl', 'nika', 'lennon'];
        for (const unit of animatedUnits) {
            this.load.atlas(
                `${unit}_atlas`,
                `/assets/sprites/${unit}_sheet.webp`,
                `/assets/sprites/${unit}_sheet.json`
            );
        }
    }

    create() {
        const { width, height } = this.scale;

        // レーン計算
        this.laneWidth = width / LANE_COUNT;
        this.lanePositions = [];
        for (let i = 0; i < LANE_COUNT; i++) {
            this.lanePositions.push(this.laneWidth * i + this.laneWidth / 2);
        }

        // 配置エリア（下から30%の位置）
        this.placementY = height * 0.75;

        // 背景描画
        this.createBackground(width, height);

        // レーン表示
        this.createLanes(width, height);

        // 城を作成
        this.createCastles(width, height);

        // コストシステム初期化
        this.costSystem = new CostSystem({
            current: 500,
            max: 2000,
            regenRate: 50,
            maxLevels: [2000, 4000, 6000, 8000, 10000],
            upgradeCosts: [1000, 2000, 4000, 8000],
            regenRates: [50, 60, 70, 80, 100],
        });

        // UI作成
        this.createUI(width, height);

        this.gameState = 'PLAYING';
    }

    private createBackground(width: number, height: number) {
        // 背景色
        const bgColor = this.stageData.background?.color
            ? parseInt(this.stageData.background.color.replace('0x', ''), 16)
            : 0x2d5a27;
        this.add.rectangle(width / 2, height / 2, width, height, bgColor);

        // 敵エリア（上部 - 赤っぽい）
        this.add.rectangle(width / 2, height * 0.15, width, height * 0.3, 0x4a1a1a, 0.3);

        // 配置可能エリア（下部 - 青っぽい）
        this.placementZone = this.add.rectangle(
            width / 2,
            height * 0.8,
            width,
            height * 0.35,
            0x1a1a4a,
            0.3
        );
    }

    private createLanes(width: number, height: number) {
        // レーン区切り線
        for (let i = 1; i < LANE_COUNT; i++) {
            const x = this.laneWidth * i;
            const line = this.add.rectangle(x, height / 2, 2, height, 0xffffff, 0.2);
            this.laneIndicators.push(line);
        }

        // レーン選択ボタン（配置エリアの上部）
        const buttonY = height - 175;
        const buttonHeight = 50;

        for (let i = 0; i < LANE_COUNT; i++) {
            const x = this.lanePositions[i];
            const container = this.add.container(x, buttonY);

            // ボタン背景
            const bg = this.add.rectangle(0, 0, this.laneWidth - 10, buttonHeight, 0x333366, 0.8);
            bg.setStrokeStyle(3, 0x6666aa);
            container.add(bg);

            // レーン番号
            const text = this.add.text(0, 0, `${i + 1}`, {
                fontSize: '28px',
                color: '#ffffff',
                fontStyle: 'bold',
            }).setOrigin(0.5);
            container.add(text);

            // インタラクティブ設定
            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerdown', () => this.selectLane(i as LaneIndex));

            container.setData('laneIndex', i);
            container.setData('bg', bg);
            container.setDepth(50);

            this.laneButtons.push(container);
        }
    }

    private selectLane(lane: LaneIndex) {
        this.selectedLane = lane;

        // ボタンのハイライト更新
        this.laneButtons.forEach((btn, index) => {
            const bg = btn.getData('bg') as Phaser.GameObjects.Rectangle;
            if (index === lane) {
                bg.setStrokeStyle(4, 0x00ff00);
                bg.setFillStyle(0x336633, 0.9);
            } else {
                bg.setStrokeStyle(3, 0x6666aa);
                bg.setFillStyle(0x333366, 0.8);
            }
        });
    }

    private createCastles(width: number, height: number) {
        // 敵城（上部中央）
        this.enemyCastle = new Castle(
            this,
            width / 2,
            80,
            'enemy',
            this.stageData.enemyCastleHp
        );
        this.add.existing(this.enemyCastle);

        // 味方城（下部中央）
        this.allyCastle = new Castle(
            this,
            width / 2,
            height - 60,
            'ally',
            this.stageData.baseCastleHp
        );
        this.add.existing(this.allyCastle);
    }

    private createUI(width: number, height: number) {
        // コストバー（上部に移動）
        const barWidth = width - 40;
        const barHeight = 20;
        const barY = height - 215;

        this.costBarBg = this.add.rectangle(width / 2, barY, barWidth, barHeight, 0x333333);
        this.costBarFill = this.add.rectangle(
            20 + barWidth / 2,
            barY,
            barWidth,
            barHeight,
            0xffcc00
        );
        this.costBarFill.setOrigin(0.5, 0.5);

        this.costText = this.add.text(width / 2, barY, '', {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(100);

        // 操作説明テキスト
        this.add.text(width / 2, height - 125, '① レーンを選択 → ② ユニットをタップ', {
            fontSize: '14px',
            color: '#aaaaff',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(100);

        // ユニット選択ボタン
        this.createUnitButtons(width, height);

        // 状態テキスト（勝敗表示用）
        this.stateText = this.add.text(width / 2, height / 2, '', {
            fontSize: '48px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(200).setVisible(false);

        // ゲーム速度ボタン
        this.createSpeedButton(width);
    }

    private createUnitButtons(width: number, height: number) {
        const buttonSize = 70;
        const spacing = 10;
        const startX = (width - (this.teamData.length * (buttonSize + spacing) - spacing)) / 2;
        const buttonY = height - 70;

        this.teamData.forEach((unit, index) => {
            const x = startX + index * (buttonSize + spacing) + buttonSize / 2;

            const container = this.add.container(x, buttonY);

            // ボタン背景
            const bg = this.add.rectangle(0, 0, buttonSize, buttonSize, 0x444444, 0.9);
            bg.setStrokeStyle(2, 0x888888);
            container.add(bg);

            // ユニットアイコン
            const spriteKey = unit.baseUnitId || unit.id;
            if (this.textures.exists(spriteKey)) {
                const icon = this.add.image(0, -5, spriteKey);
                const scale = (buttonSize - 20) / Math.max(icon.width, icon.height);
                icon.setScale(scale);
                container.add(icon);
            }

            // コスト表示
            const costLabel = this.add.text(0, buttonSize / 2 - 12, `${unit.cost}`, {
                fontSize: '14px',
                color: '#ffcc00',
                fontStyle: 'bold',
            }).setOrigin(0.5);
            container.add(costLabel);

            // クールダウンオーバーレイ
            const cooldownOverlay = this.add.rectangle(0, 0, buttonSize, buttonSize, 0x000000, 0.7);
            cooldownOverlay.setVisible(false);
            container.add(cooldownOverlay);

            // クールダウンテキスト
            const cooldownText = this.add.text(0, 0, '', {
                fontSize: '20px',
                color: '#ffffff',
                fontStyle: 'bold',
            }).setOrigin(0.5);
            container.add(cooldownText);

            // インタラクティブ設定 - レーン選択済みならそのレーンに配置
            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerdown', () => {
                if (this.selectedLane !== null) {
                    this.trySpawnUnit(unit.id, this.selectedLane);
                }
            });

            container.setData('unitId', unit.id);
            container.setData('bg', bg);
            container.setData('cooldownOverlay', cooldownOverlay);
            container.setData('cooldownText', cooldownText);
            container.setDepth(50);

            this.unitButtons.push(container);
        });
    }

    private createSpeedButton(width: number) {
        const btn = this.add.container(width - 50, 50);

        const bg = this.add.circle(0, 0, 25, 0x333333, 0.8);
        bg.setStrokeStyle(2, 0x666666);
        btn.add(bg);

        const text = this.add.text(0, 0, '1x', {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        btn.add(text);

        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
            const speeds = [1, 2, 3, 5];
            const currentIndex = speeds.indexOf(this.gameSpeed);
            this.gameSpeed = speeds[(currentIndex + 1) % speeds.length];
            text.setText(`${this.gameSpeed}x`);
        });
    }

    private trySpawnUnit(unitId: string, lane: LaneIndex) {
        const unitDef = this.teamData.find(u => u.id === unitId);
        if (!unitDef) return;

        // クールダウンチェック
        const cooldown = this.unitCooldowns.get(unitId) ?? 0;
        if (cooldown > 0) return;

        // コストチェック
        if (!this.costSystem.canAfford(unitDef.cost)) return;

        // コスト消費
        this.costSystem.spend(unitDef.cost);

        // クールダウン設定
        this.unitCooldowns.set(unitId, getSpawnCooldown(unitDef));

        // ユニット生成
        this.spawnAllyUnit(unitDef, lane);
    }

    private spawnAllyUnit(unitDef: UnitDefinition, lane: LaneIndex) {
        const { height } = this.scale;
        const x = this.lanePositions[lane];
        const y = height * 0.85;

        const unit = new Unit(
            this,
            x,
            y,
            unitDef,
            'ally',
            this.stageData.arenaHeight
        );

        // 縦移動モードを有効化
        unit.setVerticalMode(true, height);

        this.add.existing(unit);
        this.allyUnits.push(unit);
        this.unitLanes.set(unit.instanceId, lane);
    }

    private spawnEnemyUnit(unitId: string, lane: LaneIndex) {
        const unitDef = this.allUnitsData.find(u => u.id === unitId);
        if (!unitDef) {
            console.warn(`[ArenaScene] Enemy unit not found: ${unitId}`);
            return;
        }

        const { height } = this.scale;
        const x = this.lanePositions[lane];
        const y = 120;

        const unit = new Unit(
            this,
            x,
            y,
            unitDef,
            'enemy',
            this.stageData.arenaHeight
        );

        // 縦移動モードを有効化
        unit.setVerticalMode(true, height);

        this.add.existing(unit);
        this.enemyUnits.push(unit);
        this.unitLanes.set(unit.instanceId, lane);
    }

    update(time: number, delta: number) {
        if (this.gameState !== 'PLAYING') return;

        const adjustedDelta = delta * this.gameSpeed;
        this.elapsedTime += adjustedDelta;

        // Wave処理
        this.updateWaves(adjustedDelta);

        // コスト更新
        this.costSystem.update(adjustedDelta);

        // ユニット更新（縦移動）
        this.updateUnits(adjustedDelta);

        // 戦闘処理
        this.updateCombat();

        // 勝敗判定
        this.checkWinCondition();

        // UI更新
        this.updateUI(adjustedDelta);

        // 死亡ユニット削除
        this.cleanupDeadUnits();
    }

    private updateWaves(delta: number) {
        for (const wave of this.waveSchedule) {
            if (this.elapsedTime >= wave.time && wave.spawned < wave.config.count) {
                const timeSinceWaveStart = this.elapsedTime - wave.time;
                const expectedSpawns = Math.floor(timeSinceWaveStart / wave.config.intervalMs) + 1;

                while (wave.spawned < Math.min(expectedSpawns, wave.config.count)) {
                    let lane: LaneIndex;
                    if (wave.config.lane === 'random') {
                        lane = Math.floor(Math.random() * LANE_COUNT) as LaneIndex;
                    } else {
                        lane = wave.config.lane;
                    }
                    this.spawnEnemyUnit(wave.config.unitId, lane);
                    wave.spawned++;
                }
            }
        }
    }

    private updateUnits(delta: number) {
        const { height } = this.scale;

        // 味方ユニット（上方向に移動）
        for (const unit of this.allyUnits) {
            if (unit.isDead()) continue;
            this.updateArenaUnit(unit, -1, delta, height);
        }

        // 敵ユニット（下方向に移動）
        for (const unit of this.enemyUnits) {
            if (unit.isDead()) continue;
            this.updateArenaUnit(unit, 1, delta, height);
        }
    }

    private updateArenaUnit(unit: Unit, _direction: number, delta: number, _height: number) {
        // ユニットのupdate呼び出し（状態機械処理 + 縦移動）
        unit.update(delta);
    }

    private updateCombat() {
        // 味方ユニットのターゲット割り当て
        for (const ally of this.allyUnits) {
            if (ally.isDead()) continue;

            const allyLane = this.unitLanes.get(ally.instanceId);

            // 既存ターゲットが有効ならスキップ
            if (ally.target && !ally.target.isDead() && ally.isInRange(ally.target)) {
                ally.castleTarget = null;
                continue;
            }

            // 同じレーンの敵を探す
            ally.target = this.findTargetInLane(ally, this.enemyUnits, allyLane);

            // 敵がいなければ城を攻撃
            if (!ally.target && this.isInRangeOfCastle(ally, this.enemyCastle)) {
                ally.castleTarget = this.enemyCastle;
            } else {
                ally.castleTarget = null;
            }
        }

        // 敵ユニットのターゲット割り当て
        for (const enemy of this.enemyUnits) {
            if (enemy.isDead()) continue;

            const enemyLane = this.unitLanes.get(enemy.instanceId);

            if (enemy.target && !enemy.target.isDead() && enemy.isInRange(enemy.target)) {
                enemy.castleTarget = null;
                continue;
            }

            enemy.target = this.findTargetInLane(enemy, this.allyUnits, enemyLane);

            if (!enemy.target && this.isInRangeOfCastle(enemy, this.allyCastle)) {
                enemy.castleTarget = this.allyCastle;
            } else {
                enemy.castleTarget = null;
            }
        }
    }

    private findTargetInLane(attacker: Unit, enemies: Unit[], attackerLane?: LaneIndex): Unit | null {
        let closest: Unit | null = null;
        let minDistance = Infinity;

        for (const enemy of enemies) {
            if (enemy.isDead()) continue;

            const enemyLane = this.unitLanes.get(enemy.instanceId);

            // 同じレーンまたは隣接レーンの敵のみ
            if (attackerLane !== undefined && enemyLane !== undefined) {
                if (Math.abs(attackerLane - enemyLane) > 1) continue;
            }

            // 縦方向の距離でチェック
            const distance = Math.abs(attacker.y - enemy.y);
            if (distance > attacker.definition.attackRange + 50) continue;

            if (distance < minDistance) {
                minDistance = distance;
                closest = enemy;
            }
        }

        return closest;
    }

    private isInRangeOfCastle(unit: Unit, castle: Castle): boolean {
        const distance = Math.abs(unit.y - castle.y);
        return distance <= unit.definition.attackRange + 30;
    }

    private checkWinCondition() {
        if (this.enemyCastle.isDead()) {
            this.gameState = 'WIN';
            this.showResult('VICTORY!', 0x00ff00);
        } else if (this.allyCastle.isDead()) {
            this.gameState = 'LOSE';
            this.showResult('DEFEAT', 0xff0000);
        }
    }

    private showResult(text: string, color: number) {
        this.stateText.setText(text);
        this.stateText.setColor(`#${color.toString(16).padStart(6, '0')}`);
        this.stateText.setVisible(true);

        // 3秒後にメニューに戻る
        const win = this.gameState === 'WIN';
        const result = {
            win,
            stageId: this.stageData.id,
            reward: win ? this.stageData.reward : null,
        };
        this.time.delayedCall(3000, () => {
            eventBus.emit(win ? GameEvents.BATTLE_WIN : GameEvents.BATTLE_LOSE, result);
        });
    }

    private updateUI(delta: number) {
        // コストバー更新
        const current = this.costSystem.getCurrent();
        const max = this.costSystem.getMax();
        const ratio = current / max;

        const barWidth = this.scale.width - 40;
        this.costBarFill.setScale(ratio, 1);
        this.costText.setText(`${Math.floor(current)} / ${max}`);

        // クールダウン更新
        for (const [unitId, cooldown] of this.unitCooldowns.entries()) {
            if (cooldown > 0) {
                this.unitCooldowns.set(unitId, Math.max(0, cooldown - delta));
            }
        }

        // ボタン状態更新
        const noLaneSelected = this.selectedLane === null;

        this.unitButtons.forEach(btn => {
            const unitId = btn.getData('unitId') as string;
            const bg = btn.getData('bg') as Phaser.GameObjects.Rectangle;
            const overlay = btn.getData('cooldownOverlay') as Phaser.GameObjects.Rectangle;
            const cdText = btn.getData('cooldownText') as Phaser.GameObjects.Text;

            const cooldown = this.unitCooldowns.get(unitId) ?? 0;
            const unitDef = this.teamData.find(u => u.id === unitId);

            if (cooldown > 0) {
                overlay.setVisible(true);
                cdText.setText((cooldown / 1000).toFixed(1));
                bg.setStrokeStyle(2, 0x888888);
            } else if (unitDef && !this.costSystem.canAfford(unitDef.cost)) {
                overlay.setVisible(true);
                cdText.setText('$');
                bg.setStrokeStyle(2, 0x888888);
            } else if (noLaneSelected) {
                // レーン未選択時は薄暗くして「レーンを先に選んで」と示す
                overlay.setVisible(true);
                overlay.setAlpha(0.5);
                cdText.setText('?');
                bg.setStrokeStyle(2, 0x666666);
            } else {
                overlay.setVisible(false);
                cdText.setText('');
                bg.setStrokeStyle(2, 0x00ff00); // 配置可能なら緑枠
            }
        });
    }

    private cleanupDeadUnits() {
        this.allyUnits = this.allyUnits.filter(unit => {
            if (unit.isDead() && unit.state === 'DIE') {
                this.unitLanes.delete(unit.instanceId);
                unit.destroy();
                return false;
            }
            return true;
        });

        this.enemyUnits = this.enemyUnits.filter(unit => {
            if (unit.isDead() && unit.state === 'DIE') {
                this.unitLanes.delete(unit.instanceId);
                unit.destroy();
                return false;
            }
            return true;
        });
    }
}
