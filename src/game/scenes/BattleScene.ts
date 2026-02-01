import Phaser from 'phaser';
import { Unit } from '../entities/Unit';
import { Castle } from '../entities/Castle';
import { CombatSystem } from '../systems/CombatSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { CostSystem } from '../systems/CostSystem';
import { QuizSystem } from '../systems/QuizSystem';
import { CannonSystem } from '../systems/CannonSystem';
import { AIController } from '../systems/AIController';
import { eventBus, GameEvents } from '../utils/EventBus';
import { getSpritePath, getSheetPath, ANIMATED_UNITS } from '@/lib/sprites';
import type { StageDefinition, UnitDefinition, GameState, Rarity } from '@/data/types';

// ============================================
// BattleScene - メインバトルシーン
// ============================================

// レアリティ別デフォルトクールダウン時間（ミリ秒）
// ※ キャラクター個別のspawnCooldownMsが設定されている場合はそちらを優先
const COOLDOWN_BY_RARITY: Record<Rarity, number> = {
    N: 2000,    // 2秒
    R: 4000,    // 4秒
    SR: 8000,   // 8秒
    SSR: 12000, // 12秒
    UR: 15000,  // 15秒
};

// ユニットの召喚クールダウンを取得（個別設定優先、なければレアリティ別デフォルト）
function getSpawnCooldown(unit: UnitDefinition): number {
    return unit.spawnCooldownMs ?? COOLDOWN_BY_RARITY[unit.rarity];
}

export interface BattleSceneData {
    stage: StageDefinition;
    team: UnitDefinition[];
    allUnits: UnitDefinition[];
    loadouts?: [UnitDefinition[], UnitDefinition[], UnitDefinition[]]; // 3つのデッキ
    activeLoadoutIndex?: number;
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
    private quizSystem!: QuizSystem;
    private cannonSystem!: CannonSystem;
    private aiController?: AIController;  // AI対戦モード用

    // ゲーム状態
    private gameState: GameState = 'LOADING';
    private groundY: number = 0;
    private sceneId: string = '';

    // UI
    private costText!: Phaser.GameObjects.Text;
    private stateText!: Phaser.GameObjects.Text;
    private costBarBg!: Phaser.GameObjects.Rectangle;
    private costBarFill!: Phaser.GameObjects.Rectangle;
    private costBarMaxWidth: number = 0;
    private costBarHeight: number = 0;
    private costUpBtnContainer!: Phaser.GameObjects.Container;
    private costUpBtnBg!: Phaser.GameObjects.Arc; // 円形ボタン
    private costUpBtnZone!: Phaser.GameObjects.Zone;
    private costUpBtnText!: Phaser.GameObjects.Text;
    private costUpBtnCostText!: Phaser.GameObjects.Text;
    private castleLevelText!: Phaser.GameObjects.Text;
    private currentCastleLevel: number = 1;
    private costUpPulse?: Phaser.Tweens.Tween;

    // ボスHPゲージ
    private bossHpContainer!: Phaser.GameObjects.Container;
    private bossHpBarFill!: Phaser.GameObjects.Rectangle;
    private bossHpText!: Phaser.GameObjects.Text;

    // 掛け算クイズ
    private mathModeBtn!: Phaser.GameObjects.Container;

    // ロードアウト（デッキ）切り替え
    private loadoutsData: [UnitDefinition[], UnitDefinition[], UnitDefinition[]] = [[], [], []];
    private activeLoadoutIndex: number = 0;
    private deckSwitchBtn!: Phaser.GameObjects.Container;

    // クールダウンシステム（残り時間を保存、ゲーム速度対応）
    private unitCooldowns: Map<string, number> = new Map(); // unitId -> 残りクールダウン時間(ms)

    // ゲーム速度（1x, 2x, 3x, 5x）
    private gameSpeed: number = 1;
    private speedBtn!: Phaser.GameObjects.Container;

    // ボス出現管理（城攻撃時にボス出現）
    private bossSpawned: boolean = false;
    private lastEnemyCastleHp: number = 0;

    // BGM
    private bgm?: Phaser.Sound.BaseSound;

    constructor() {
        super({ key: 'BattleScene' });
    }

    shutdown() {
        // BGMを停止
        this.bgm?.stop();

        // システムのクリーンアップ
        this.quizSystem?.destroy();
        this.cannonSystem?.destroy();

        // イベントリスナーをクリア
        eventBus.removeAllListeners(GameEvents.SUMMON_UNIT);
    }

    init(data: BattleSceneData) {
        // シーンIDを生成
        this.sceneId = Math.random().toString(36).substr(2, 6);
        console.log(`[BattleScene ${this.sceneId}] Initializing...`);

        this.stageData = data.stage;
        this.teamData = data.team;
        this.allUnitsData = data.allUnits;

        // ロードアウト初期化
        this.loadoutsData = data.loadouts || [data.team, [], []];
        this.activeLoadoutIndex = data.activeLoadoutIndex ?? 0;

        // 前のゲームの状態をリセット
        this.gameState = 'LOADING';
        this.allyUnits = [];
        this.enemyUnits = [];

        // クールダウンをリセット
        this.unitCooldowns = new Map();

        // 前のイベントリスナーをクリア
        eventBus.removeAllListeners(GameEvents.SUMMON_UNIT);
    }

    preload() {
        // BGMをロード
        this.load.audio('battle_bgm_1', '/assets/audio/bgm/battle_1.mp3');
        this.load.audio('battle_bgm_2', '/assets/audio/bgm/battle_2.mp3');
        this.load.audio('boss_bgm_1', '/assets/audio/bgm/boss_1.mp3');
        this.load.audio('boss_bgm_2', '/assets/audio/bgm/boss_2.mp3');
        this.load.audio('boss_bgm_3', '/assets/audio/bgm/boss_3.mp3');
        this.load.audio('victory_bgm', '/assets/audio/bgm/victory.mp3');
        this.load.audio('defeat_bgm', '/assets/audio/bgm/defeat.mp3');

        // 効果音をロード
        this.load.audio('sfx_unit_spawn', '/assets/audio/sfx/unit_spawn.mp3');
        this.load.audio('sfx_unit_death', '/assets/audio/sfx/unit_death.mp3');
        this.load.audio('sfx_attack_hit', '/assets/audio/sfx/attack_hit.mp3');
        this.load.audio('sfx_attack_hit_sr', '/assets/audio/sfx/attack_hit_sr.mp3');
        this.load.audio('sfx_cannon_fire', '/assets/audio/sfx/cannon_fire.mp3');
        this.load.audio('sfx_cost_upgrade', '/assets/audio/sfx/cost_upgrade.mp3');

        // 城スプライトをロード
        this.load.image('castle_ally', getSpritePath('castle_ally'));
        this.load.image('castle_enemy', getSpritePath('castle_enemy'));

        // 背景画像をロード（設定されている場合）
        if (this.stageData.background?.image) {
            this.load.image('stage_bg', this.stageData.background.image);
        }

        // 必要なユニットを収集（チーム + ステージの敵）
        // unitId -> { spriteId, rarity } のマップ（spriteIdは実際のスプライトファイル名）
        const unitsToLoad = new Map<string, { spriteId: string; rarity: Rarity }>();

        // チームのユニットを追加
        for (const unit of this.teamData) {
            const spriteId = unit.baseUnitId || unit.atlasKey || unit.id;
            unitsToLoad.set(unit.id, { spriteId, rarity: unit.rarity });
        }

        // 全ロードアウトのユニットを追加
        for (const loadout of this.loadoutsData) {
            for (const unit of loadout) {
                const spriteId = unit.baseUnitId || unit.atlasKey || unit.id;
                unitsToLoad.set(unit.id, { spriteId, rarity: unit.rarity });
            }
        }

        // ステージの敵を追加
        for (const wave of this.stageData.enemyWaves) {
            const unitDef = this.allUnitsData.find(u => u.id === wave.unitId);
            if (unitDef) {
                // baseUnitIdがあればそれを使用（敵が味方スプライトを流用する場合）
                const spriteId = unitDef.baseUnitId || unitDef.atlasKey || unitDef.id;
                // baseUnitIdがある場合、そのユニットのレアリティを取得
                let rarity = unitDef.rarity;
                if (unitDef.baseUnitId) {
                    const baseUnit = this.allUnitsData.find(u => u.id === unitDef.baseUnitId);
                    if (baseUnit) {
                        rarity = baseUnit.rarity;
                    }
                }
                unitsToLoad.set(wave.unitId, { spriteId, rarity });
            }
        }

        // 全ユニットの静止画をロード
        const loadedSprites = new Set<string>();
        for (const [unitId, { spriteId, rarity }] of unitsToLoad) {
            // 同じスプライトを重複ロードしないように
            if (!loadedSprites.has(spriteId)) {
                this.load.image(spriteId, getSpritePath(spriteId, rarity));
                loadedSprites.add(spriteId);
            }
            // unitIdとspriteIdが異なる場合（敵がbaseUnitIdを使う場合）、
            // unitIdでもロードして参照できるようにする
            if (unitId !== spriteId && !loadedSprites.has(unitId)) {
                this.load.image(unitId, getSpritePath(spriteId, rarity));
                loadedSprites.add(unitId);
            }
        }

        // アニメーションシート（アトラス）をロード（共有リストを使用）
        const loadedSheets = new Set<string>();
        for (const [unitId, { spriteId }] of unitsToLoad) {
            // spriteIdでシートを確認（baseUnitIdがある場合はそのスプライトを使用）
            if (ANIMATED_UNITS.includes(spriteId as any) && !loadedSheets.has(spriteId)) {
                const sheetPath = getSheetPath(spriteId);
                this.load.atlas(`${spriteId}_atlas`, sheetPath.image, sheetPath.json);
                loadedSheets.add(spriteId);
            }
        }
    }

    private summonUIButtons: {
        unitId: string;
        cost: number;
        rarity: Rarity;
        bg: Phaser.GameObjects.Rectangle;
        icon: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
        nameText: Phaser.GameObjects.Text;
        costTag: Phaser.GameObjects.Rectangle;
        costText: Phaser.GameObjects.Text;
        originalColor: number;
        // クールダウンUI
        cooldownOverlay: Phaser.GameObjects.Rectangle;
        cooldownText: Phaser.GameObjects.Text;
        cooldownDuration: number; // クールダウン全体の長さ（ms）
        buttonX: number;
        buttonY: number;
        buttonHeight: number;
    }[] = [];

    // テクスチャが存在するか確認し、存在しなければフォールバックを返す
    private getValidTextureKey(unitId: string): string {
        if (this.textures.exists(unitId)) {
            return unitId;
        }
        // atlasからidle frameを使用する試み
        const atlasKey = `${unitId}_atlas`;
        if (this.textures.exists(atlasKey)) {
            return atlasKey;
        }
        // フォールバック: cat_warrior（必ず存在するテクスチャ）
        console.warn(`[BattleScene] Texture not found for ${unitId}, using fallback`);
        return 'cat_warrior';
    }

    // atlasからユニットアイコンを作成（アトラスがあればフレーム使用、なければ静止画）
    private createUnitIcon(x: number, y: number, unitId: string): Phaser.GameObjects.Image | Phaser.GameObjects.Sprite {
        const atlasKey = `${unitId}_atlas`;
        const idleFrame = `${unitId}_idle.png`;

        // atlasが存在し、idleフレームがある場合はそれを使用
        if (this.textures.exists(atlasKey)) {
            const atlasTexture = this.textures.get(atlasKey);
            if (atlasTexture && atlasTexture.has(idleFrame)) {
                return this.add.image(x, y, atlasKey, idleFrame);
            }
        }

        // 静止画テクスチャを確認
        if (this.textures.exists(unitId)) {
            return this.add.image(x, y, unitId);
        }

        // フォールバック
        console.warn(`[BattleScene] No texture found for ${unitId}, using cat_warrior fallback`);
        return this.add.image(x, y, 'cat_warrior');
    }

    create() {
        const { width, height } = this.scale;
        this.groundY = height - 130; // ボタン用スペースを確保

        // シーン終了時のクリーンアップを登録
        this.events.once('shutdown', this.shutdown, this);

        // アニメーション作成
        this.createAnimations();

        // 背景
        this.createBackground();

        // BGMをランダムに選択して再生（ボスステージは専用BGM）
        let bgmKey: string;
        if (this.stageData.isBossStage) {
            const bossIndex = Math.floor(Math.random() * 3) + 1;
            bgmKey = `boss_bgm_${bossIndex}`;
        } else {
            bgmKey = Math.random() < 0.5 ? 'battle_bgm_1' : 'battle_bgm_2';
        }
        this.bgm = this.sound.add(bgmKey, { loop: true, volume: 0.3 });
        this.bgm.play();

        // 地面（床を大きく）- ステージ設定から色を取得
        const worldWidth = this.stageData.length + 100;
        const groundColorStr = this.stageData.background?.groundColor || '0x3d2817';
        const groundColor = parseInt(groundColorStr.replace('0x', ''), 16);
        this.add.rectangle(worldWidth / 2, height - 65, worldWidth, 130, groundColor);

        // 城を配置
        this.allyCastle = new Castle(this, 50, this.groundY, 'ally', this.stageData.baseCastleHp);
        this.enemyCastle = new Castle(this, this.stageData.length, this.groundY, 'enemy', this.stageData.enemyCastleHp);

        // ボス出現管理の初期化
        this.bossSpawned = false;
        this.lastEnemyCastleHp = this.stageData.enemyCastleHp;

        // カメラ設定
        this.cameras.main.setBounds(0, 0, this.stageData.length + 100, height);
        this.cameras.main.scrollX = 0;

        // システム初期化
        this.combatSystem = new CombatSystem(this);
        this.waveSystem = new WaveSystem(this, this.stageData, this.allUnitsData);

        // プレイヤーのコスト設定
        const playerCostConfig = {
            current: 200,
            max: 1000,
            regenRate: 100,
            maxLevels: [1000, 2500, 4500, 7000, 10000, 15000, 25000, 99999],
            regenRates: [100, 150, 250, 400, 600, 900, 1500, 2500],
            upgradeCosts: [500, 1200, 2500, 4500, 8000, 12000, 20000],
        };
        this.costSystem = new CostSystem(playerCostConfig);

        // AI対戦モードの場合、AIControllerを初期化（プレイヤーと完全に同じコスト設定）
        if (this.stageData.aiDeck && this.stageData.aiDeck.length > 0) {
            this.aiController = new AIController(this, this.allUnitsData, {
                deck: this.stageData.aiDeck,
                costConfig: {
                    current: 200,  // プレイヤーと同じ初期コスト
                    max: 1000,     // プレイヤーと同じ最大コスト
                    regenRate: 100, // プレイヤーと同じ回復速度
                    // アップグレードもプレイヤーと同じ設定
                    maxLevels: [1000, 2500, 4500, 7000, 10000, 15000, 25000, 99999],
                    regenRates: [100, 150, 250, 400, 600, 900, 1500, 2500],
                    upgradeCosts: [500, 1200, 2500, 4500, 8000, 12000, 20000],
                },
                spawnDelay: 2000,  // 2秒間隔で出撃判断
                strategy: this.stageData.aiStrategy ?? 'balanced',
            });
        }

        // クイズシステム
        this.quizSystem = new QuizSystem(this, {
            canStartQuiz: () => this.gameState === 'PLAYING',
            canAffordCost: (cost) => this.costSystem.canAfford(cost),
            isOnCooldown: (unitId) => {
                const remaining = this.unitCooldowns.get(unitId);
                return remaining !== undefined && remaining > 0;
            },
            onCorrectAnswer: (unitId, cost) => {
                if (this.costSystem.spend(cost)) {
                    this.spawnAllyUnitDirect(unitId);
                }
            },
            onSkipQuiz: (unitId) => {
                this.summonAllyUnit(unitId);
            },
        });

        // キャノンシステム
        this.cannonSystem = new CannonSystem(this);

        // UI作成
        this.createUI();

        // イベントリスナー
        this.setupEventListeners();

        // ゲーム開始
        this.startBattle();
    }

    private createAnimations() {
        // ネコ戦士のアニメーション
        this.anims.create({
            key: 'cat_warrior_idle',
            frames: [{ key: 'cat_warrior_atlas', frame: 'cat_warrior_idle.png' }],
            frameRate: 1,
            repeat: -1,
        });

        this.anims.create({
            key: 'cat_warrior_walk',
            frames: [
                { key: 'cat_warrior_atlas', frame: 'cat_warrior_walk_1.png' },
                { key: 'cat_warrior_atlas', frame: 'cat_warrior_walk_2.png' },
                { key: 'cat_warrior_atlas', frame: 'cat_warrior_walk_3.png' },
                { key: 'cat_warrior_atlas', frame: 'cat_warrior_walk_4.png' },
            ],
            frameRate: 8,
            repeat: -1,
        });

        this.anims.create({
            key: 'cat_warrior_attack',
            frames: [
                { key: 'cat_warrior_atlas', frame: 'cat_warrior_attack_1.png' },
                { key: 'cat_warrior_atlas', frame: 'cat_warrior_attack_2.png' },
                { key: 'cat_warrior_atlas', frame: 'cat_warrior_attack_3.png' },
            ],
            frameRate: 10,
            repeat: 0,
        });

        // コーンファイターのアニメーション
        this.anims.create({
            key: 'corn_fighter_idle',
            frames: [{ key: 'corn_fighter_atlas', frame: 'corn_fighter_idle.png' }],
            frameRate: 1,
            repeat: -1,
        });

        this.anims.create({
            key: 'corn_fighter_attack',
            frames: [
                { key: 'corn_fighter_atlas', frame: 'corn_fighter_attack_1.png' },
                { key: 'corn_fighter_atlas', frame: 'corn_fighter_attack_2.png' },
                { key: 'corn_fighter_atlas', frame: 'corn_fighter_attack_3.png' },
            ],
            frameRate: 8,
            repeat: 0,
        });

        // ペンギンボーイのアニメーション
        this.anims.create({
            key: 'penguin_boy_idle',
            frames: [{ key: 'penguin_boy_atlas', frame: 'penguin_boy_idle.png' }],
            frameRate: 1,
            repeat: -1,
        });

        this.anims.create({
            key: 'penguin_boy_attack',
            frames: [
                { key: 'penguin_boy_atlas', frame: 'penguin_boy_attack_1.png' },
                { key: 'penguin_boy_atlas', frame: 'penguin_boy_attack_2.png' },
                { key: 'penguin_boy_atlas', frame: 'penguin_boy_attack_3.png' },
            ],
            frameRate: 8,
            repeat: 0,
        });

        // Yume (cinnamon_girl) animations
        this.anims.create({
            key: 'cinnamon_girl_idle',
            frames: [{ key: 'cinnamon_girl_atlas', frame: 'cinnamon_girl_idle.png' }],
            frameRate: 1,
            repeat: -1,
        });

        this.anims.create({
            key: 'cinnamon_girl_attack',
            frames: [
                { key: 'cinnamon_girl_atlas', frame: 'cinnamon_girl_attack_1.png' },
                { key: 'cinnamon_girl_atlas', frame: 'cinnamon_girl_attack_2.png' },
            ],
            frameRate: 8,
            repeat: 0,
        });

        // Nika animations
        this.anims.create({
            key: 'nika_idle',
            frames: [{ key: 'nika_atlas', frame: 'nika_idle.png' }],
            frameRate: 1,
            repeat: -1,
        });

        this.anims.create({
            key: 'nika_attack',
            frames: [
                { key: 'nika_atlas', frame: 'nika_attack_1.png' },
                { key: 'nika_atlas', frame: 'nika_attack_2.png' },
            ],
            frameRate: 8,
            repeat: 0,
        });

        // Lennon animations
        this.anims.create({
            key: 'lennon_idle',
            frames: [{ key: 'lennon_atlas', frame: 'lennon_idle.png' }],
            frameRate: 1,
            repeat: -1,
        });

        this.anims.create({
            key: 'lennon_attack',
            frames: [
                { key: 'lennon_atlas', frame: 'lennon_attack_1.png' },
                { key: 'lennon_atlas', frame: 'lennon_attack_2.png' },
            ],
            frameRate: 8,
            repeat: 0,
        });

        // ハチのアニメーション
        this.anims.create({
            key: 'n_bee_idle',
            frames: [{ key: 'n_bee_atlas', frame: 'n_bee_idle.png' }],
            frameRate: 4,
            repeat: -1,
        });

        this.anims.create({
            key: 'n_bee_walk',
            frames: [
                { key: 'n_bee_atlas', frame: 'n_bee_walk_1.png' },
                { key: 'n_bee_atlas', frame: 'n_bee_walk_2.png' },
                { key: 'n_bee_atlas', frame: 'n_bee_walk_3.png' },
                { key: 'n_bee_atlas', frame: 'n_bee_walk_4.png' },
            ],
            frameRate: 12,
            repeat: -1,
        });

        this.anims.create({
            key: 'n_bee_attack',
            frames: [
                { key: 'n_bee_atlas', frame: 'n_bee_attack_1.png' },
                { key: 'n_bee_atlas', frame: 'n_bee_attack_2.png' },
                { key: 'n_bee_atlas', frame: 'n_bee_attack_3.png' },
            ],
            frameRate: 12,
            repeat: 0,
        });

        // SR Units animations
        const srUnits = ['sr_rose_hero', 'sr_corn_tank', 'sr_bamboo_mech', 'sr_sun_pirate', 'sr_tulip_idol', 'sr_cappuccino_assassin', 'sr_capybara_ninja', 'sr_capybara_shaman', 'sr_odindindun', 'sr_traffarella'];
        srUnits.forEach(unit => {
            this.anims.create({
                key: `${unit}_idle`,
                frames: [{ key: `${unit}_atlas`, frame: `${unit}_idle.png` }],
                frameRate: 1,
                repeat: -1,
            });
            this.anims.create({
                key: `${unit}_walk`,
                frames: [
                    { key: `${unit}_atlas`, frame: `${unit}_walk_1.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_walk_2.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_walk_3.png` },
                ],
                frameRate: 8,
                repeat: -1,
            });
            this.anims.create({
                key: `${unit}_attack`,
                frames: [
                    { key: `${unit}_atlas`, frame: `${unit}_attack_1.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_attack_2.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_attack_3.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_attack_4.png` },
                ],
                frameRate: 10,
                repeat: 0,
            });
        });

        // SSR Units animations
        const ssrUnits = ['flame_knight', 'ice_samurai', 'shadow_assassin', 'thunder_golem'];
        ssrUnits.forEach(unit => {
            this.anims.create({
                key: `${unit}_idle`,
                frames: [{ key: `${unit}_atlas`, frame: `${unit}_idle.png` }],
                frameRate: 1,
                repeat: -1,
            });
            this.anims.create({
                key: `${unit}_walk`,
                frames: [
                    { key: `${unit}_atlas`, frame: `${unit}_walk_1.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_walk_2.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_walk_3.png` },
                ],
                frameRate: 8,
                repeat: -1,
            });
            this.anims.create({
                key: `${unit}_attack`,
                frames: [
                    { key: `${unit}_atlas`, frame: `${unit}_attack_1.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_attack_2.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_attack_3.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_attack_4.png` },
                ],
                frameRate: 10,
                repeat: 0,
            });
        });

        // UR Units animations
        const urUnits = [
            'ur_knight', 'ur_mage', 'ur_archer', 'ur_tank', 'ur_ninja', 'ur_healer',
            'ur_dragon', 'ur_spirit', 'ur_phoenix', 'ur_golem', 'ur_angel', 'ur_ancient_treant',
            // New UR units
            'ur_astral_wizard', 'ur_celestial_cat', 'ur_chrono_sage', 'ur_chronos_cat',
            'ur_cosmic_dragon', 'ur_crystal_griffin', 'ur_emerald_dragon', 'ur_fire_lotus_cat',
            'ur_frost_giant', 'ur_galaxy_butterfly', 'ur_golden_lion', 'ur_inferno_demon',
            'ur_jade_dragon', 'ur_nature_spirit_cat', 'ur_nature_titan', 'ur_prismatic_cat',
            'ur_rose_capybara', 'ur_rose_queen', 'ur_rune_golem', 'ur_sea_leviathan',
            'ur_stone_golem_cat', 'ur_thunder_phoenix',
            // New UR units (2025-01)
            'ur_cosmic_tiger', 'ur_botanical_gundam', 'ur_fairy_knight', 'ur_golden_paladin', 'ur_overlord_rose'
        ];
        urUnits.forEach(unit => {
            this.anims.create({
                key: `${unit}_idle`,
                frames: [{ key: `${unit}_atlas`, frame: `${unit}_idle.png` }],
                frameRate: 1,
                repeat: -1,
            });
            this.anims.create({
                key: `${unit}_walk`,
                frames: [
                    { key: `${unit}_atlas`, frame: `${unit}_walk_1.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_walk_2.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_walk_3.png` },
                ],
                frameRate: 8,
                repeat: -1,
            });
            this.anims.create({
                key: `${unit}_attack`,
                frames: [
                    { key: `${unit}_atlas`, frame: `${unit}_attack_1.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_attack_2.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_attack_3.png` },
                    { key: `${unit}_atlas`, frame: `${unit}_attack_4.png` },
                ],
                frameRate: 10,
                repeat: 0,
            });
        });
    }

    private createBackground() {
        const { width, height } = this.scale;

        // ステージの背景設定を取得（デフォルト値も設定）
        const bg = this.stageData.background || {
            skyColor: '0x87ceeb',
            groundColor: '0x3d2817',
            cloudColor: '0xffffff'
        };

        // 背景画像がある場合は画像を表示
        if (bg.image && this.textures.exists('stage_bg')) {
            const texture = this.textures.get('stage_bg');
            const frame = texture.getSourceImage();
            const imgWidth = frame.width;
            const imgHeight = frame.height;

            // 画像を画面高さにフィットするスケールを計算
            const fitScale = height / imgHeight;
            const scaledWidth = imgWidth * fitScale;
            const scaledHeight = height;

            // ステージ全体をカバーするために必要な幅（パララックス考慮）
            const worldWidth = this.stageData.length + 100;
            const parallaxFactor = 0.5; // 背景の移動速度（カメラの50%）
            const neededWidth = width + (worldWidth - width) * parallaxFactor;

            // TileSpriteで背景を作成（繰り返し表示）
            const bgTile = this.add.tileSprite(
                0, 0,
                neededWidth / fitScale, // スケール前のサイズで指定
                imgHeight,
                'stage_bg'
            );
            bgTile.setOrigin(0, 0);
            bgTile.setScale(fitScale);
            bgTile.setDepth(-10);
            bgTile.setScrollFactor(parallaxFactor);

            // 軽いオーバーレイで統一感を出す
            const overlay = this.add.rectangle(
                worldWidth / 2,
                height / 2,
                worldWidth,
                height,
                parseInt(bg.skyColor.replace('0x', ''), 16),
                0.15
            );
            overlay.setDepth(-9);
            overlay.setScrollFactor(0);
        } else {
            // 従来の色ベース背景
            const skyColor = parseInt(bg.skyColor.replace('0x', ''), 16);
            const cloudColor = parseInt((bg.cloudColor || '0xffffff').replace('0x', ''), 16);

            // 空のグラデーション
            const sky = this.add.rectangle(width / 2, height / 2, width * 2, height, skyColor);
            sky.setScrollFactor(0);

            // 雲（装飾）
            for (let i = 0; i < 5; i++) {
                const cloud = this.add.ellipse(
                    Math.random() * width * 2,
                    50 + Math.random() * 100,
                    80 + Math.random() * 60,
                    40 + Math.random() * 20,
                    cloudColor,
                    0.8
                );
                cloud.setScrollFactor(0.1);
            }
        }
    }

    private createUI() {
        const { width, height } = this.scale;

        // コストパネル（にゃんこ風）- 上部セーフエリア考慮で下げる
        const panelX = 18;
        const panelY = 40; // 14 -> 40
        const panelW = 260;
        const panelH = 54;
        const panel = this.add.rectangle(panelX, panelY, panelW, panelH, 0xf8e7b6);
        panel.setOrigin(0, 0);
        panel.setStrokeStyle(3, 0x3b2a1a);
        panel.setScrollFactor(0);
        panel.setDepth(100);

        const costLabel = this.add.text(panelX + 12, panelY + 6, 'COST', {
            fontSize: '12px',
            color: '#4b2a10',
            fontStyle: 'bold',
        });
        costLabel.setScrollFactor(0);
        costLabel.setDepth(101);

        // 城レベル表示
        this.castleLevelText = this.add.text(panelX + 70, panelY + 6, '🏰 Lv.1', {
            fontSize: '12px',
            color: '#b8860b',
            fontStyle: 'bold',
        });
        this.castleLevelText.setScrollFactor(0);
        this.castleLevelText.setDepth(101);

        this.costBarMaxWidth = 130;
        this.costBarHeight = 14;
        this.costBarBg = this.add.rectangle(panelX + 12, panelY + 30, this.costBarMaxWidth, this.costBarHeight, 0xd7bf8a);
        this.costBarBg.setOrigin(0, 0.5);
        this.costBarBg.setStrokeStyle(2, 0x3b2a1a);
        this.costBarBg.setScrollFactor(0);
        this.costBarBg.setDepth(101);

        this.costBarFill = this.add.rectangle(panelX + 12, panelY + 30, 0, this.costBarHeight, 0xffd45a);
        this.costBarFill.setOrigin(0, 0.5);
        this.costBarFill.setScrollFactor(0);
        this.costBarFill.setDepth(102);

        this.costText = this.add.text(panelX + 150, panelY + 30, '0/1000', {
            fontSize: '14px',
            color: '#3b2a1a',
            fontStyle: 'bold',
        });
        this.costText.setOrigin(0, 0.5);
        this.costText.setScrollFactor(0);
        this.costText.setDepth(102);

        // コスト上限アップボタン（丸いアイコン、HPゲージの下に配置）
        const costUpX = panelX + 35;   // パネル左寄り
        const costUpY = panelY + 100;  // パネルのさらに下
        const costUpRadius = 28;       // 大きめのボタン

        this.costUpBtnContainer = this.add.container(costUpX, costUpY);
        this.costUpBtnContainer.setScrollFactor(0);
        this.costUpBtnContainer.setDepth(103);

        // 円形の背景
        this.costUpBtnBg = this.add.circle(0, 0, costUpRadius, 0xffe066);
        this.costUpBtnBg.setStrokeStyle(3, 0x3b2a1a);
        this.costUpBtnContainer.add(this.costUpBtnBg);

        // ⬆️ アイコン（上矢印）
        this.costUpBtnText = this.add.text(0, -4, '⬆️', {
            fontSize: '22px',
        });
        this.costUpBtnText.setOrigin(0.5, 0.5);
        this.costUpBtnContainer.add(this.costUpBtnText);

        // コスト表示（ボタン内下部に小さく表示）
        this.costUpBtnCostText = this.add.text(0, 14, '¥0', {
            fontSize: '10px',
            color: '#3b2a1a',
            fontStyle: 'bold',
        });
        this.costUpBtnCostText.setOrigin(0.5, 0.5);
        this.costUpBtnContainer.add(this.costUpBtnCostText);

        // クリック可能エリア
        this.costUpBtnZone = this.add.zone(costUpX, costUpY, costUpRadius * 2 + 10, costUpRadius * 2 + 10);
        this.costUpBtnZone.setScrollFactor(0);
        this.costUpBtnZone.setDepth(104);
        this.costUpBtnZone.setInteractive({ useHandCursor: true });
        this.costUpBtnZone.on('pointerdown', () => {
            if (this.costSystem.upgradeMax()) {
                this.sound.play('sfx_cost_upgrade', { volume: 0.5 });
            }
        });

        // ゲーム状態表示
        const statePanelW = 180;
        const statePanelH = 40;
        const statePanel = this.add.rectangle(width - 18, 40, statePanelW, statePanelH, 0xf8e7b6);
        statePanel.setOrigin(1, 0);
        statePanel.setStrokeStyle(3, 0x3b2a1a);
        statePanel.setScrollFactor(0);
        statePanel.setDepth(100);

        this.stateText = this.add.text(width - 30, 58, '', {
            fontSize: '16px',
            color: '#3b2a1a',
            fontStyle: 'bold',
        });
        this.stateText.setOrigin(1, 0);
        this.stateText.setScrollFactor(0);
        this.stateText.setDepth(100);

        // 算数モードトグルボタン（右上）
        this.createMathModeToggle();

        // 速度切り替えボタン
        this.createSpeedToggle();

        // 召喚ボタン（チーム分）
        this.createSummonButtons();

        // カメラ操作説明 (UIの上に表示)
        const helpText = this.add.text(width / 2, height - 175, 'ドラッグでカメラ移動', {
            fontSize: '14px',
            color: '#fff2cc',
            stroke: '#3b2a1a',
            strokeThickness: 3,
        });
        helpText.setOrigin(0.5, 0.5);
        helpText.setScrollFactor(0);
        helpText.setDepth(100);

        // カメラドラッグ（モバイル/タッチ対応）
        let lastPointerX = 0;
        let isDragging = false;

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            // UIボタン上でなければドラッグ開始
            if (pointer.y < this.scale.height - 120) {
                isDragging = true;
                lastPointerX = pointer.x;
            }
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (isDragging && pointer.isDown) {
                const deltaX = lastPointerX - pointer.x;
                this.cameras.main.scrollX += deltaX;
                this.cameras.main.scrollX = Phaser.Math.Clamp(
                    this.cameras.main.scrollX,
                    0,
                    this.stageData.length - this.scale.width + 100
                );
                lastPointerX = pointer.x;
            }
        });

        this.input.on('pointerup', () => {
            isDragging = false;
        });
    }

    private createMathModeToggle() {
        // === 算数モードトグルボタン（COSTパネルの右端） ===
        this.mathModeBtn = this.add.container(300, 55);
        this.mathModeBtn.setScrollFactor(0);
        this.mathModeBtn.setDepth(100);

        const isEnabled = this.quizSystem.isMathModeEnabled();

        // 背景
        const bg = this.add.rectangle(0, 0, 80, 32, isEnabled ? 0x4ade80 : 0x6b7280);
        bg.setStrokeStyle(2, 0x3b2a1a);
        bg.setScrollFactor(0);
        bg.setInteractive({ useHandCursor: true });

        // テキスト
        const text = this.add.text(0, 0, isEnabled ? '🧮 ON' : '🧮 OFF', {
            fontSize: '12px',
            color: '#ffffff',
            fontStyle: 'bold',
        });
        text.setOrigin(0.5, 0.5);
        text.setScrollFactor(0);

        this.mathModeBtn.add([bg, text]);

        // クリックでトグル
        bg.on('pointerdown', () => {
            const newEnabled = this.quizSystem.toggleMathMode();
            bg.setFillStyle(newEnabled ? 0x4ade80 : 0x6b7280);
            text.setText(newEnabled ? '🧮 ON' : '🧮 OFF');
        });

        // ホバーエフェクト
        bg.on('pointerover', () => {
            bg.setAlpha(0.8);
        });
        bg.on('pointerout', () => {
            bg.setAlpha(1);
        });
    }

    private createSpeedToggle() {
        // === 速度切り替えボタン（算数モードボタンの右） ===
        this.speedBtn = this.add.container(390, 55);
        this.speedBtn.setScrollFactor(0);
        this.speedBtn.setDepth(100);

        // 背景
        const bg = this.add.rectangle(0, 0, 60, 32, 0x3b82f6);
        bg.setStrokeStyle(2, 0x1e40af);
        bg.setScrollFactor(0);
        bg.setInteractive({ useHandCursor: true });

        // テキスト
        const text = this.add.text(0, 0, '▶ 1x', {
            fontSize: '14px',
            color: '#ffffff',
            fontStyle: 'bold',
        });
        text.setOrigin(0.5, 0.5);
        text.setScrollFactor(0);

        this.speedBtn.add([bg, text]);

        // クリックで速度切り替え（1x → 2x → 3x → 5x → 1x）
        const speeds = [1, 2, 3, 5];
        const speedTexts = ['▶ 1x', '▶▶ 2x', '▶▶▶ 3x', '⚡ 5x'];
        const colors = [0x3b82f6, 0xf59e0b, 0xef4444, 0x9333ea]; // blue, amber, red, purple
        bg.on('pointerdown', () => {
            const currentIndex = speeds.indexOf(this.gameSpeed);
            const nextIndex = (currentIndex + 1) % speeds.length;
            this.gameSpeed = speeds[nextIndex];
            text.setText(speedTexts[nextIndex]);
            bg.setFillStyle(colors[nextIndex]);
        });

        // ホバーエフェクト
        bg.on('pointerover', () => bg.setAlpha(0.8));
        bg.on('pointerout', () => bg.setAlpha(1));
    }

    // デッキ（ロードアウト）を次のものに切り替え
    private switchToNextDeck() {
        this.activeLoadoutIndex = (this.activeLoadoutIndex + 1) % 3;
        this.teamData = this.loadoutsData[this.activeLoadoutIndex] || [];

        // サモンボタンを更新
        this.updateSummonButtons();

        console.log(`[Deck Switch] Now using deck ${this.activeLoadoutIndex + 1} with ${this.teamData.length} units`);
    }

    // サモンボタンのUIを更新
    private updateSummonButtons() {
        // 現在のボタンを完全に削除
        this.summonUIButtons.forEach(btn => {
            btn.bg.destroy();
            btn.icon.destroy();
            btn.nameText.destroy();
            btn.costTag.destroy();
            btn.costText.destroy();
            btn.cooldownOverlay.destroy();
            btn.cooldownText.destroy();
        });
        this.summonUIButtons = [];

        // 新しいUIで再構築
        const buttonY = this.scale.height - 85;
        const buttonWidth = 90;
        const buttonHeight = 100;
        const startX = 225; // 城攻撃+デッキ切り替えボタン分右にずらす
        const gap = 8;

        this.teamData.forEach((unit, index) => {
            const x = startX + index * (buttonWidth + gap);

            // ボタン背景
            const bg = this.add.rectangle(x, buttonY, buttonWidth, buttonHeight, 0xf8e7b6, 1);
            bg.setScrollFactor(0);
            bg.setDepth(100);
            bg.setInteractive({ useHandCursor: true });
            bg.setStrokeStyle(3, 0x3b2a1a);

            // ユニット画像（テクスチャ存在確認とフォールバック対応）
            const unitIcon = this.createUnitIcon(x, buttonY - 22, unit.id);
            const iconHeight = unitIcon.height > 0 ? unitIcon.height : 45; // 0の場合デフォルト値
            const iconScale = 45 / iconHeight;
            unitIcon.setScale(iconScale);
            unitIcon.setScrollFactor(0);
            unitIcon.setDepth(101);

            // ユニット名
            const nameText = this.add.text(x, buttonY + 16, unit.name.slice(0, 5), {
                fontSize: '13px',
                color: '#3b2a1a',
                stroke: '#ffffff',
                strokeThickness: 1,
                fontStyle: 'bold',
            });
            nameText.setOrigin(0.5, 0.5);
            nameText.setScrollFactor(0);
            nameText.setDepth(101);

            // コスト表示
            const costTag = this.add.rectangle(x, buttonY + 38, 54, 20, 0xffd45a);
            costTag.setScrollFactor(0);
            costTag.setDepth(101);
            costTag.setStrokeStyle(2, 0x3b2a1a);

            const costText = this.add.text(x, buttonY + 38, `¥${unit.cost}`, {
                fontSize: '13px',
                color: '#3b2a1a',
                stroke: '#ffffff',
                strokeThickness: 1,
                fontStyle: 'bold',
            });
            costText.setOrigin(0.5, 0.5);
            costText.setScrollFactor(0);
            costText.setDepth(101);

            // クールダウンオーバーレイ（上から下に減っていくバー）
            const cooldownOverlay = this.add.rectangle(x, buttonY - buttonHeight / 2 + 2, buttonWidth - 4, buttonHeight - 4, 0x000000, 0.75);
            cooldownOverlay.setOrigin(0.5, 0); // 上端を基準に
            cooldownOverlay.setScrollFactor(0);
            cooldownOverlay.setDepth(105);
            cooldownOverlay.setVisible(false);

            const cooldownText = this.add.text(x, buttonY - 10, '', {
                fontSize: '20px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 4,
            });
            cooldownText.setOrigin(0.5, 0.5);
            cooldownText.setScrollFactor(0);
            cooldownText.setDepth(106);
            cooldownText.setVisible(false);

            this.summonUIButtons.push({
                unitId: unit.id,
                cost: unit.cost,
                rarity: unit.rarity,
                bg,
                icon: unitIcon,
                nameText,
                costTag,
                costText,
                originalColor: 0xf8e7b6,
                cooldownOverlay,
                cooldownText,
                cooldownDuration: getSpawnCooldown(unit),
                buttonX: x,
                buttonY: buttonY,
                buttonHeight: buttonHeight,
            });

            // クリックでクイズ開始
            bg.on('pointerdown', () => {
                this.quizSystem.startQuiz(unit.id, unit.cost);
            });

            bg.on('pointerover', () => bg.setFillStyle(0xfff3cf));
            bg.on('pointerout', () => bg.setFillStyle(0xf8e7b6));
        });
    }

    private createSummonButtons() {
        const { width, height } = this.scale;
        // iPad等の下部バーを考慮して高さを150確保、位置微調整
        const barHeight = 150;
        const barY = height - barHeight / 2; // 中心位置
        // 背景バー：高さ150で画面下部をカバー
        const bar = this.add.rectangle(width / 2, height - 75, width, 150, 0x6b4a2b, 0.95);
        bar.setScrollFactor(0);
        bar.setDepth(90);

        // ボタン配置Y座標: 画面下から85px (元は55px) -> 30px上に移動 (セーフエリア回避)
        const buttonY = height - 85;
        const buttonWidth = 90;
        const buttonHeight = 100;
        const startX = 225; // 城攻撃+デッキ切り替えボタン分右にずらす
        const gap = 8;

        // 城攻撃ボタン（左端・丸アイコン）- CannonSystemで管理
        const cannonX = 50;
        const cannonBtn = this.cannonSystem.createUI(cannonX, buttonY, buttonHeight);
        cannonBtn.on('pointerdown', () => {
            this.cannonSystem.fire(
                this.allyCastle,
                this.enemyUnits,
                this.enemyCastle,
                this.groundY,
                this.stageData.length
            );
        });

        // デッキ切り替えボタン（城攻撃の右）
        const deckBtnX = 135;
        const deckBtnBg = this.add.rectangle(deckBtnX, buttonY, 80, buttonHeight, 0xf97316);
        deckBtnBg.setScrollFactor(0);
        deckBtnBg.setDepth(100);
        deckBtnBg.setInteractive({ useHandCursor: true });
        deckBtnBg.setStrokeStyle(3, 0x3b2a1a);

        const deckLabel = this.activeLoadoutIndex === 0 ? '🅰️' : this.activeLoadoutIndex === 1 ? '🅱️' : '🅲';
        const deckSwitchIcon = this.add.text(deckBtnX, buttonY - 15, `🔄`, {
            fontSize: '24px',
            color: '#ffffff',
        });
        deckSwitchIcon.setOrigin(0.5, 0.5);
        deckSwitchIcon.setScrollFactor(0);
        deckSwitchIcon.setDepth(101);

        const deckLabelText = this.add.text(deckBtnX, buttonY + 20, deckLabel, {
            fontSize: '22px',
            color: '#ffffff',
            fontStyle: 'bold',
        });
        deckLabelText.setOrigin(0.5, 0.5);
        deckLabelText.setScrollFactor(0);
        deckLabelText.setDepth(101);

        // クリックでデッキ切り替え
        deckBtnBg.on('pointerdown', () => {
            this.switchToNextDeck();
            const newLabel = this.activeLoadoutIndex === 0 ? '🅰️' : this.activeLoadoutIndex === 1 ? '🅱️' : '🅲';
            deckLabelText.setText(newLabel);
        });

        deckBtnBg.on('pointerover', () => deckBtnBg.setAlpha(0.8));
        deckBtnBg.on('pointerout', () => deckBtnBg.setAlpha(1));

        this.teamData.forEach((unit, index) => {
            const x = startX + index * (buttonWidth + gap);

            // ボタン背景
            const bg = this.add.rectangle(x, buttonY, buttonWidth, buttonHeight, 0xf8e7b6, 1);
            bg.setScrollFactor(0);
            bg.setDepth(100);
            bg.setInteractive({ useHandCursor: true });
            bg.setStrokeStyle(3, 0x3b2a1a);

            // ユニット画像（テクスチャ存在確認とフォールバック対応）
            const unitIcon = this.createUnitIcon(x, buttonY - 22, unit.id);
            const iconHeight = unitIcon.height > 0 ? unitIcon.height : 45; // 0の場合デフォルト値
            const iconScale = 45 / iconHeight; // 45pxに収める
            unitIcon.setScale(iconScale);
            unitIcon.setScrollFactor(0);
            unitIcon.setDepth(101);

            // ユニット名
            const nameText = this.add.text(x, buttonY + 16, unit.name.slice(0, 5), {
                fontSize: '13px',
                color: '#3b2a1a',
                stroke: '#ffffff',
                strokeThickness: 1,
                fontStyle: 'bold',
            });
            nameText.setOrigin(0.5, 0.5);
            nameText.setScrollFactor(0);
            nameText.setDepth(101);

            // コスト表示
            const costTag = this.add.rectangle(x, buttonY + 38, 54, 20, 0xffd45a);
            costTag.setScrollFactor(0);
            costTag.setDepth(101);
            costTag.setStrokeStyle(2, 0x3b2a1a);

            const costText = this.add.text(x, buttonY + 38, `¥${unit.cost}`, {
                fontSize: '13px',
                color: '#3b2a1a',
                stroke: '#ffffff',
                strokeThickness: 1,
                fontStyle: 'bold',
            });
            costText.setOrigin(0.5, 0.5);
            costText.setScrollFactor(0);
            costText.setDepth(101);

            // クールダウンオーバーレイ（上から下に減っていくバー）
            const cooldownOverlay = this.add.rectangle(x, buttonY - buttonHeight / 2 + 2, buttonWidth - 4, buttonHeight - 4, 0x000000, 0.75);
            cooldownOverlay.setOrigin(0.5, 0); // 上端を基準に
            cooldownOverlay.setScrollFactor(0);
            cooldownOverlay.setDepth(105);
            cooldownOverlay.setVisible(false);

            const cooldownText = this.add.text(x, buttonY - 10, '', {
                fontSize: '20px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 4,
            });
            cooldownText.setOrigin(0.5, 0.5);
            cooldownText.setScrollFactor(0);
            cooldownText.setDepth(106);
            cooldownText.setVisible(false);

            // UI管理配列に追加
            this.summonUIButtons.push({
                unitId: unit.id,
                cost: unit.cost,
                rarity: unit.rarity,
                bg,
                icon: unitIcon,
                nameText,
                costTag,
                costText,
                originalColor: 0xf8e7b6,
                cooldownOverlay,
                cooldownText,
                cooldownDuration: getSpawnCooldown(unit),
                buttonX: x,
                buttonY: buttonY,
                buttonHeight: buttonHeight,
            });

            // クリックでクイズ開始
            bg.on('pointerdown', () => {
                this.quizSystem.startQuiz(unit.id, unit.cost);
            });

            // ホバーエフェクト
            bg.on('pointerover', () => bg.setFillStyle(0xfff3cf));
            bg.on('pointerout', () => bg.setFillStyle(0xf8e7b6));
        });

        // ボス詳細表示（画面上部）- 80 -> 110 に下げてTop UIとの衝突回避
        this.bossHpContainer = this.add.container(width / 2, 110);
        this.bossHpContainer.setScrollFactor(0);
        this.bossHpContainer.setDepth(110);
        this.bossHpContainer.setVisible(false);

        // 背景
        const bossBarW = Math.min(width - 40, 400);
        const bossBarH = 24;
        const bossBg = this.add.rectangle(0, 0, bossBarW + 4, bossBarH + 4, 0x000000, 0.7);
        bossBg.setStrokeStyle(2, 0xff0000);
        this.bossHpContainer.add(bossBg);

        const bossBarBg = this.add.rectangle(-bossBarW / 2, 0, bossBarW, bossBarH, 0x330000);
        bossBarBg.setOrigin(0, 0.5);
        this.bossHpContainer.add(bossBarBg);

        // HPバー
        this.bossHpBarFill = this.add.rectangle(-bossBarW / 2, 0, bossBarW, bossBarH, 0xff0000);
        this.bossHpBarFill.setOrigin(0, 0.5);
        this.bossHpContainer.add(this.bossHpBarFill);

        // ボス名
        this.bossHpText = this.add.text(0, -25, 'BOSS', {
            fontSize: '18px',
            color: '#ff0000',
            fontStyle: 'bold',
            stroke: '#ffffff',
            strokeThickness: 3,
        });
        this.bossHpText.setOrigin(0.5, 0.5);
        this.bossHpContainer.add(this.bossHpText);
    }

    private setupEventListeners() {
        // 召喚イベント（外部からの呼び出し用）
        eventBus.on(GameEvents.SUMMON_UNIT, (...args: unknown[]) => {
            const unitId = args[0] as string;
            if (typeof unitId === 'string') {
                this.summonAllyUnit(unitId);
            }
        });
    }

    private startBattle() {
        this.gameState = 'PLAYING';
        // AI対戦モードの場合はAIを開始、それ以外はWaveシステムを開始
        if (this.aiController) {
            this.aiController.start();
        } else {
            this.waveSystem.start();
        }
        eventBus.emit(GameEvents.BATTLE_STARTED);
    }

    update(time: number, delta: number) {
        if (this.gameState !== 'PLAYING') return;

        // ゲーム速度を適用
        const adjustedDelta = delta * this.gameSpeed;

        // コスト回復
        this.costSystem.update(adjustedDelta);

        // クールダウン更新（ゲーム速度適用）
        this.updateCooldowns(adjustedDelta);

        this.updateCostUI();

        // 敵出現処理（AI対戦モードまたはWaveシステム）
        if (this.aiController) {
            this.aiController.update(adjustedDelta);
        } else {
            this.waveSystem.update();
        }

        // ユニット更新
        this.updateUnits(adjustedDelta);

        // 城攻撃ゲージ更新
        this.cannonSystem.update(adjustedDelta);

        // 戦闘判定
        this.combatSystem.update(
            this.allyUnits.filter(u => !u.isDead()),
            this.enemyUnits.filter(u => !u.isDead()),
            this.allyCastle,
            this.enemyCastle
        );

        // ボス出現チェック（敵城が初めてダメージを受けたら）
        this.checkBossSpawn();

        // 死亡ユニットの除去
        this.cleanupDeadUnits();

        // 勝敗判定
        this.checkGameEnd();

        // 状態表示更新
        this.updateStateUI();

        // ボスHP更新
        this.updateBossUI();
    }

    private updateBossUI() {
        const boss = this.enemyUnits.find(u => u.definition.isBoss && !u.isDead());
        const { width } = this.scale;
        const bossBarW = Math.min(width - 40, 400);

        if (boss) {
            this.bossHpContainer.setVisible(true);
            this.bossHpText.setText(`☠️ ${boss.definition.name} ☠️`);

            const hpRatio = boss.hp / boss.maxHp;
            this.bossHpBarFill.width = bossBarW * hpRatio;

            // HP色変化（ピンチで点滅など）
            if (hpRatio < 0.3) {
                this.bossHpBarFill.setFillStyle(this.time.now % 200 < 100 ? 0xff0000 : 0xffaaaa);
            } else {
                this.bossHpBarFill.setFillStyle(0xff0000);
            }
        } else {
            this.bossHpContainer.setVisible(false);
        }
    }

    /**
     * ボス出現チェック - 敵城が初めてダメージを受けたらボス登場
     */
    private checkBossSpawn(): void {
        // 既にボスが出現済み、またはボスがいないステージは無視
        if (this.bossSpawned || !this.waveSystem.hasBoss()) {
            return;
        }

        // 敵城がダメージを受けたかチェック
        if (this.enemyCastle.hp < this.lastEnemyCastleHp) {
            this.bossSpawned = true;
            this.spawnBossWithKnockback();
        }
    }

    /**
     * ボス出現演出 - 全ユニットノックバック + ボス登場
     */
    private spawnBossWithKnockback(): void {
        const { width, height } = this.scale;

        // 画面を一瞬暗くする
        const overlay = this.add.rectangle(width / 2, height / 2, width * 2, height * 2, 0x000000, 0.7);
        overlay.setScrollFactor(0);
        overlay.setDepth(200);

        // 警告テキスト
        const warningText = this.add.text(width / 2, height / 2 - 50, '⚠️ BOSS INCOMING ⚠️', {
            fontSize: '48px',
            color: '#ff0000',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6,
        });
        warningText.setOrigin(0.5);
        warningText.setScrollFactor(0);
        warningText.setDepth(201);
        warningText.setScale(0);

        // 警告テキストのアニメーション
        this.tweens.add({
            targets: warningText,
            scale: 1,
            duration: 300,
            ease: 'Back.Out',
            onComplete: () => {
                // 点滅
                this.tweens.add({
                    targets: warningText,
                    alpha: 0.5,
                    duration: 100,
                    yoyo: true,
                    repeat: 3,
                });
            }
        });

        // 画面シェイク
        this.cameras.main.shake(500, 0.02);

        // 全味方ユニットを大きくノックバック
        const knockbackDistance = 300;
        for (const unit of this.allyUnits) {
            if (!unit.isDead()) {
                // 左方向にノックバック
                this.tweens.add({
                    targets: unit,
                    x: Math.max(100, unit.x - knockbackDistance),
                    duration: 400,
                    ease: 'Power2',
                });
            }
        }

        // 全敵ユニットも少しノックバック（衝撃波）
        for (const unit of this.enemyUnits) {
            if (!unit.isDead()) {
                this.tweens.add({
                    targets: unit,
                    x: unit.x + 100,
                    duration: 400,
                    ease: 'Power2',
                });
            }
        }

        // 遅延してボス出現
        this.time.delayedCall(800, () => {
            // ボスをスポーン
            this.waveSystem.spawnBoss();

            // オーバーレイをフェードアウト
            this.tweens.add({
                targets: [overlay, warningText],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    overlay.destroy();
                    warningText.destroy();
                }
            });
        });
    }

    private updateUnits(delta: number) {
        for (const unit of [...this.allyUnits, ...this.enemyUnits]) {
            if (!unit.isDead()) {
                unit.update(delta);
            }
        }
    }

    private updateCooldowns(delta: number) {
        // 各ユニットの残りクールダウンを減少
        this.unitCooldowns.forEach((remaining, unitId) => {
            const newRemaining = remaining - delta;
            if (newRemaining <= 0) {
                this.unitCooldowns.delete(unitId);
            } else {
                this.unitCooldowns.set(unitId, newRemaining);
            }
        });
    }

    private cleanupDeadUnits() {
        this.allyUnits = this.allyUnits.filter(u => !u.isDead() || u.active);
        this.enemyUnits = this.enemyUnits.filter(u => !u.isDead() || u.active);
    }

    private checkGameEnd() {
        // 既に終了している場合は処理しない
        if (this.gameState === 'WIN' || this.gameState === 'LOSE') {
            return;
        }

        // デバッグ: 城のHP確認（シーンID付き）
        console.log(`[Scene ${this.sceneId}] Ally HP: ${this.allyCastle.hp}/${this.allyCastle.maxHp}, Enemy HP: ${this.enemyCastle.hp}/${this.enemyCastle.maxHp}`);

        if (this.enemyCastle.isDestroyed()) {
            console.log('[GameEnd] Enemy castle destroyed!');
            this.endBattle(true);
        } else if (this.allyCastle.isDestroyed()) {
            console.log('[GameEnd] Ally castle destroyed!');
            this.endBattle(false);
        }
    }

    private endBattle(win: boolean) {
        // 既に終了している場合は処理しない
        if (this.gameState === 'WIN' || this.gameState === 'LOSE') {
            return;
        }

        this.gameState = win ? 'WIN' : 'LOSE';

        // BGMを停止して結果BGMを再生
        this.bgm?.stop();
        const resultBgmKey = win ? 'victory_bgm' : 'defeat_bgm';
        try {
            console.log(`[BattleScene] Playing result BGM: ${resultBgmKey}`);
            const resultBgm = this.sound.add(resultBgmKey, { volume: 0.5 });
            resultBgm.play();
        } catch (err) {
            console.error('[BattleScene] Failed to play result BGM:', err);
        }

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
        const ratio = max > 0 ? current / max : 0;
        const barWidth = Math.max(0, Math.min(1, ratio)) * this.costBarMaxWidth;
        this.costBarFill.width = barWidth;
        this.costBarFill.height = this.costBarHeight;
        this.costText.setText(`${current}/${max}`);

        // ユニット召喚ボタンの有効/無効状態を更新（クールダウン含む）
        const now = this.time.now;
        this.summonUIButtons.forEach(btn => {
            const remainingCooldown = this.unitCooldowns.get(btn.unitId);
            const isOnCooldown = remainingCooldown !== undefined && remainingCooldown > 0;
            const canAffordCost = current >= btn.cost;
            const canSummon = canAffordCost && !isOnCooldown;

            // クールダウン表示更新
            if (isOnCooldown && remainingCooldown && btn.cooldownDuration > 0) {
                const remainingMs = remainingCooldown;
                const remainingSec = Math.ceil(remainingMs / 1000);
                const progress = remainingMs / btn.cooldownDuration; // 1.0 → 0.0
                const maxHeight = btn.buttonHeight - 4;

                // オーバーレイの高さを残り時間に応じて減少
                btn.cooldownOverlay.setVisible(true);
                btn.cooldownOverlay.height = maxHeight * progress;

                // 進捗に応じて色を変更（黒 → 薄い色）
                const alpha = 0.3 + (progress * 0.45); // 0.75 → 0.3
                btn.cooldownOverlay.setAlpha(alpha);

                // テキスト表示
                btn.cooldownText.setVisible(true);
                btn.cooldownText.setText(`${remainingSec}s`);

                // 残り1秒以下でテキストを点滅
                if (remainingSec <= 1) {
                    btn.cooldownText.setAlpha(now % 200 < 100 ? 1 : 0.5);
                } else {
                    btn.cooldownText.setAlpha(1);
                }
            } else {
                btn.cooldownOverlay.setVisible(false);
                btn.cooldownText.setVisible(false);
            }

            // ボタンの見た目更新
            if (canSummon) {
                btn.bg.setFillStyle(btn.originalColor);
                btn.bg.setAlpha(1);
                btn.icon.setTint(0xffffff); // 本来の色
                btn.icon.setAlpha(1);
            } else {
                btn.bg.setFillStyle(0x888888); // グレーアウト
                btn.bg.setAlpha(0.8);
                btn.icon.setTint(0x555555); // 暗くする
                btn.icon.setAlpha(0.7);
            }
        });

        // 城レベル計算（コスト上限に基づく）
        const newLevel = this.costSystem.getLevel();
        if (newLevel !== this.currentCastleLevel) {
            this.currentCastleLevel = newLevel;
            this.castleLevelText.setText(`🏰 Lv.${newLevel}`);

            // 城レベルアップ時に城を拡大＆HP増加
            this.onCastleLevelUp(newLevel);
        }

        const upgradeCost = this.costSystem.getUpgradeCost();
        if (upgradeCost === null) {
            this.costUpBtnCostText.setText('MAX');
            this.costUpBtnBg.setFillStyle(0xd7bf8a); // グレーアウト
            this.costUpBtnZone.disableInteractive();
            if (this.costUpPulse) {
                this.costUpPulse.stop();
                this.costUpPulse = undefined;
            }
        } else {
            this.costUpBtnCostText.setText(`¥${upgradeCost}`);
            const canUpgrade = this.costSystem.getCurrent() >= upgradeCost;
            this.costUpBtnBg.setFillStyle(canUpgrade ? 0xffe066 : 0xd7bf8a);
            if (canUpgrade) {
                this.costUpBtnZone.setInteractive({ useHandCursor: true });
                if (!this.costUpPulse) {
                    this.costUpPulse = this.tweens.add({
                        targets: [this.costUpBtnContainer],
                        scaleX: 1.15,
                        scaleY: 1.15,
                        duration: 400,
                        yoyo: true,
                        repeat: -1,
                    });
                }
            } else {
                this.costUpBtnZone.disableInteractive();
                if (this.costUpPulse) {
                    this.costUpPulse.stop();
                    this.costUpPulse = undefined;
                    this.costUpBtnContainer.setScale(1);
                }
            }
        }
    }

    private onCastleLevelUp(level: number) {
        // 城のスケールを拡大（レベル1=1.0, レベル5=1.4）
        const newScale = 1.0 + (level - 1) * 0.1;

        if (this.allyCastle) {
            this.tweens.add({
                targets: this.allyCastle,
                scaleX: newScale,
                scaleY: newScale,
                duration: 500,
                ease: 'Back.easeOut',
            });

            // 城HP増加（レベルごとに20%増加）
            const hpBonus = Math.floor(this.allyCastle.maxHp * 0.2);
            this.allyCastle.maxHp += hpBonus;
            this.allyCastle.hp = Math.min(this.allyCastle.hp + hpBonus, this.allyCastle.maxHp);

            // レベルアップエフェクト
            this.showLevelUpEffect();
        }
    }

    private showLevelUpEffect() {
        const centerX = 150;
        const centerY = this.groundY - 80;

        const levelUpText = this.add.text(centerX, centerY, '🏰 LEVEL UP!', {
            fontSize: '24px',
            color: '#ffd700',
            fontStyle: 'bold',
            stroke: '#4a3000',
            strokeThickness: 4,
        });
        levelUpText.setOrigin(0.5);
        levelUpText.setDepth(200);

        this.tweens.add({
            targets: levelUpText,
            y: centerY - 50,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => levelUpText.destroy(),
        });
    }

    private drawRoundedButton(
        graphics: Phaser.GameObjects.Graphics,
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number,
        fillColor: number
    ) {
        graphics.clear();
        graphics.fillStyle(fillColor, 1);
        graphics.lineStyle(3, 0x3b2a1a, 1);
        graphics.fillRoundedRect(x, y, width, height, radius);
        graphics.strokeRoundedRect(x, y, width, height, radius);
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

        // クールダウンチェック
        const remainingCooldown = this.unitCooldowns.get(unitId);
        if (remainingCooldown && remainingCooldown > 0) {
            return; // クールダウン中
        }

        // コストチェック
        if (!this.costSystem.spend(unitDef.cost)) {
            // コスト不足
            return;
        }

        // クールダウンを設定（残り時間として保存）
        const cooldownMs = getSpawnCooldown(unitDef);
        this.unitCooldowns.set(unitId, cooldownMs);

        // 城の少し前からスポーン
        const spawnX = this.allyCastle.getX() + 60;
        const unit = new Unit(this, spawnX, this.groundY, unitDef, 'ally', this.stageData.length);
        this.allyUnits.push(unit);
    }

    // 味方ユニット直接召喚（クイズ正解時、コストは支払済み）
    private spawnAllyUnitDirect(unitId: string) {
        const unitDef = this.allUnitsData.find(u => u.id === unitId);
        if (!unitDef) return;

        // クールダウンを設定
        const cooldownMs = getSpawnCooldown(unitDef);
        this.unitCooldowns.set(unitId, cooldownMs);

        // スポーン
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
