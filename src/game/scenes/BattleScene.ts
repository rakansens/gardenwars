import Phaser from 'phaser';
import { Unit } from '../entities/Unit';
import { Castle } from '../entities/Castle';
import { CombatSystem } from '../systems/CombatSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { CostSystem } from '../systems/CostSystem';
import { eventBus, GameEvents } from '../utils/EventBus';
import type { StageDefinition, UnitDefinition, GameState, Rarity } from '@/data/types';

// ============================================
// BattleScene - メインバトルシーン
// ============================================

// レアリティ別クールダウン時間（ミリ秒）
const COOLDOWN_BY_RARITY: Record<Rarity, number> = {
    N: 2000,    // 2秒
    R: 4000,    // 4秒
    SR: 8000,   // 8秒
    SSR: 12000, // 12秒
    UR: 15000,  // 15秒
};

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
    private cannonCharge: number = 0;
    private cannonChargeMax: number = 20000;
    private cannonBtnBg!: Phaser.GameObjects.Rectangle;
    private cannonBtnText!: Phaser.GameObjects.Text;
    private cannonBarBg!: Phaser.GameObjects.Rectangle;
    private cannonBarFill!: Phaser.GameObjects.Rectangle;

    // ボスHPゲージ
    private bossHpContainer!: Phaser.GameObjects.Container;
    private bossHpBarFill!: Phaser.GameObjects.Rectangle;
    private bossHpText!: Phaser.GameObjects.Text;

    // 掛け算クイズ
    private mathModeEnabled: boolean = false;  // 算数モード（デフォルトOFF）
    private mathModeBtn!: Phaser.GameObjects.Container;
    private quizActive: boolean = false;
    private quizContainer!: Phaser.GameObjects.Container;
    private quizQuestion!: Phaser.GameObjects.Text;
    private quizButtons: Phaser.GameObjects.Container[] = [];
    private quizCorrectAnswer: number = 0;
    private pendingUnitId: string | null = null;
    private pendingUnitCost: number = 0;

    // ロードアウト（デッキ）切り替え
    private loadoutsData: [UnitDefinition[], UnitDefinition[], UnitDefinition[]] = [[], [], []];
    private activeLoadoutIndex: number = 0;
    private deckSwitchBtn!: Phaser.GameObjects.Container;

    // クールダウンシステム
    private unitCooldowns: Map<string, number> = new Map(); // unitId -> クールダウン終了時刻

    constructor() {
        super({ key: 'BattleScene' });
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
        // 城スプライトをロード
        this.load.image('castle_ally', '/assets/sprites/castle_ally.png');
        this.load.image('castle_enemy', '/assets/sprites/castle_enemy.png');

        // ユニットスプライトをロード（静止画フォールバック用）
        this.load.image('cat_warrior', '/assets/sprites/cat_warrior.png');
        this.load.image('cat_tank', '/assets/sprites/cat_tank.png');
        this.load.image('cat_archer', '/assets/sprites/cat_archer.png');
        this.load.image('cat_mage', '/assets/sprites/cat_mage.png');
        this.load.image('cat_ninja', '/assets/sprites/cat_ninja.png');
        this.load.image('ice_flower', '/assets/sprites/ice_flower.png');
        this.load.image('corn_fighter', '/assets/sprites/corn_fighter.png');
        this.load.image('block_slime', '/assets/sprites/block_slime.png');
        this.load.image('sunflower', '/assets/sprites/sunflower.png');
        this.load.image('watermelon', '/assets/sprites/watermelon.png');
        this.load.image('corn_kid', '/assets/sprites/corn_kid.png');
        this.load.image('ribbon_girl', '/assets/sprites/ribbon_girl.png');
        this.load.image('penguin_boy', '/assets/sprites/penguin_boy.png');
        this.load.image('cinnamon_girl', '/assets/sprites/cinnamon_girl.png');
        this.load.image('enemy_dog', '/assets/sprites/enemy_dog.png');
        this.load.image('enemy_wolf', '/assets/sprites/enemy_wolf.png');
        this.load.image('enemy_crow', '/assets/sprites/enemy_crow.png');

        // スプライトシート（アトラス）をロード
        this.load.atlas(
            'cat_warrior_atlas',
            '/assets/sprites/cat_warrior_sheet.png',
            '/assets/sprites/cat_warrior_sheet.json'
        );
        this.load.atlas(
            'corn_fighter_atlas',
            '/assets/sprites/corn_fighter_sheet.png',
            '/assets/sprites/corn_fighter_sheet.json'
        );
        this.load.atlas(
            'penguin_boy_atlas',
            '/assets/sprites/penguin_boy_sheet.png',
            '/assets/sprites/penguin_boy_sheet.json'
        );
        this.load.atlas(
            'cinnamon_girl_atlas',
            '/assets/sprites/cinnamon_girl_sheet.png',
            '/assets/sprites/cinnamon_girl_sheet.json'
        );
        this.load.image('nika', '/assets/sprites/nika.png');
        this.load.atlas(
            'nika_atlas',
            '/assets/sprites/nika_sheet.png',
            '/assets/sprites/nika_sheet.json'
        );
        this.load.image('lennon', '/assets/sprites/lennon.png');
        this.load.atlas(
            'lennon_atlas',
            '/assets/sprites/lennon_sheet.png',
            '/assets/sprites/lennon_sheet.json'
        );
        this.load.atlas(
            'n_bee_atlas',
            '/assets/sprites/n_bee_sheet.png',
            '/assets/sprites/n_bee_sheet.json'
        );

        // UR Units
        this.load.image('ur_knight', '/assets/sprites/ur_knight.png');
        this.load.image('ur_mage', '/assets/sprites/ur_mage.png');
        this.load.image('ur_archer', '/assets/sprites/ur_archer.png');
        this.load.image('ur_tank', '/assets/sprites/ur_tank.png');
        this.load.image('ur_ninja', '/assets/sprites/ur_ninja.png');
        this.load.image('ur_healer', '/assets/sprites/ur_healer.png');
        this.load.image('ur_dragon', '/assets/sprites/ur_dragon.png');
        this.load.image('ur_spirit', '/assets/sprites/ur_spirit.png');
        this.load.image('ur_phoenix', '/assets/sprites/ur_phoenix.png');
        this.load.image('ur_golem', '/assets/sprites/ur_golem.png');
        this.load.image('ur_angel', '/assets/sprites/ur_angel.png');

        // Normal Units
        this.load.image('n_mushroom', '/assets/sprites/n_mushroom.png');
        this.load.image('n_apple', '/assets/sprites/n_apple.png');
        this.load.image('n_carrot', '/assets/sprites/n_carrot.png');
        this.load.image('n_pumpkin', '/assets/sprites/n_pumpkin.png');
        this.load.image('n_acorn', '/assets/sprites/n_acorn.png');
        this.load.image('n_strawberry', '/assets/sprites/n_strawberry.png');
        this.load.image('n_onion', '/assets/sprites/n_onion.png');
        this.load.image('n_grape', '/assets/sprites/n_grape.png');
        this.load.image('n_aloe_beast', '/assets/sprites/n_aloe_beast.png');
        this.load.image('n_cherry_bomb', '/assets/sprites/n_cherry_bomb.png');
        this.load.image('n_dust_bunny', '/assets/sprites/n_dust_bunny.png');
        this.load.image('n_hibiscus', '/assets/sprites/n_hibiscus.png');
        this.load.image('n_leaf_sprite', '/assets/sprites/n_leaf_sprite.png');
        this.load.image('n_pebble', '/assets/sprites/n_pebble.png');
        this.load.image('n_dew', '/assets/sprites/n_dew.png');
        this.load.image('n_root', '/assets/sprites/n_root.png');
        this.load.image('n_capybara', '/assets/sprites/n_capybara.png');
        this.load.image('r_capybara_gardener', '/assets/sprites/r_capybara_gardener.png');
        this.load.image('r_capybara_spa', '/assets/sprites/r_capybara_spa.png');
        this.load.image('sr_capybara_ninja', '/assets/sprites/sr_capybara_ninja.png');
        this.load.image('sr_capybara_shaman', '/assets/sprites/sr_capybara_shaman.png');

        // New N Units
        this.load.image('n_log', '/assets/sprites/n_log.png');
        this.load.image('n_octopus', '/assets/sprites/n_octopus.png');
        this.load.image('n_dolphin', '/assets/sprites/n_dolphin.png');
        this.load.image('n_bean', '/assets/sprites/n_bean.png');
        this.load.image('n_frog', '/assets/sprites/n_frog.png');

        // New R Units
        this.load.image('r_croc_pilot', '/assets/sprites/r_croc_pilot.png');
        this.load.image('r_latte_ballerina', '/assets/sprites/r_latte_ballerina.png');
        this.load.image('r_penguin_scholar', '/assets/sprites/r_penguin_scholar.png');

        // New SR Units
        this.load.image('sr_coffee_ninja', '/assets/sprites/sr_coffee_ninja.png');
        this.load.image('sr_cappuccino_assassin', '/assets/sprites/sr_cappuccino_assassin.png');
        this.load.image('sr_odindindun', '/assets/sprites/sr_odindindun.png');
        this.load.image('sr_traffarella', '/assets/sprites/sr_traffarella.png');

        // Rare Units
        this.load.image('r_tomato', '/assets/sprites/r_tomato.png');
        this.load.image('r_pepper', '/assets/sprites/r_pepper.png');
        this.load.image('r_broccoli', '/assets/sprites/r_broccoli.png');
        this.load.image('r_eggplant', '/assets/sprites/r_eggplant.png');
        this.load.image('r_cherry', '/assets/sprites/r_cherry.png');
        this.load.image('r_lemon', '/assets/sprites/r_lemon.png');
        this.load.image('r_radish', '/assets/sprites/r_radish.png');
        this.load.image('r_pumpkin_brawler', '/assets/sprites/r_pumpkin_brawler.png');
        this.load.image('r_solar_spike', '/assets/sprites/r_solar_spike.png');
        this.load.image('r_fire_chili', '/assets/sprites/r_fire_chili.png');
        this.load.image('r_leaf_ninja', '/assets/sprites/r_leaf_ninja.png');

        // SR Units
        this.load.image('sr_rose_hero', '/assets/sprites/sr_rose_hero.png');
        this.load.image('sr_corn_tank', '/assets/sprites/sr_corn_tank.png');
        this.load.image('sr_bamboo_mech', '/assets/sprites/sr_bamboo_mech.png');
        this.load.image('sr_sun_pirate', '/assets/sprites/sr_sun_pirate.png');
        this.load.image('sr_tulip_idol', '/assets/sprites/sr_tulip_idol.png');

        // SSR Units
        this.load.image('flame_knight', '/assets/sprites/flame_knight.png');
        this.load.image('ice_samurai', '/assets/sprites/ice_samurai.png');
        this.load.image('shadow_assassin', '/assets/sprites/shadow_assassin.png');
        this.load.image('thunder_golem', '/assets/sprites/thunder_golem.png');

        // SR Unit Atlases (animations)
        this.load.atlas('sr_rose_hero_atlas', '/assets/sprites/sr_rose_hero_sheet.png', '/assets/sprites/sr_rose_hero_sheet.json');
        this.load.atlas('sr_corn_tank_atlas', '/assets/sprites/sr_corn_tank_sheet.png', '/assets/sprites/sr_corn_tank_sheet.json');
        this.load.atlas('sr_bamboo_mech_atlas', '/assets/sprites/sr_bamboo_mech_sheet.png', '/assets/sprites/sr_bamboo_mech_sheet.json');
        this.load.atlas('sr_sun_pirate_atlas', '/assets/sprites/sr_sun_pirate_sheet.png', '/assets/sprites/sr_sun_pirate_sheet.json');
        this.load.atlas('sr_tulip_idol_atlas', '/assets/sprites/sr_tulip_idol_sheet.png', '/assets/sprites/sr_tulip_idol_sheet.json');
        this.load.atlas('sr_cappuccino_assassin_atlas', '/assets/sprites/sr_cappuccino_assassin_sheet.png', '/assets/sprites/sr_cappuccino_assassin_sheet.json');
        this.load.atlas('sr_capybara_ninja_atlas', '/assets/sprites/sr_capybara_ninja_sheet.png', '/assets/sprites/sr_capybara_ninja_sheet.json');
        this.load.atlas('sr_capybara_shaman_atlas', '/assets/sprites/sr_capybara_shaman_sheet.png', '/assets/sprites/sr_capybara_shaman_sheet.json');
        this.load.atlas('sr_coffee_ninja_atlas', '/assets/sprites/sr_coffee_ninja_sheet.png', '/assets/sprites/sr_coffee_ninja_sheet.json');
        this.load.atlas('sr_odindindun_atlas', '/assets/sprites/sr_odindindun_sheet.png', '/assets/sprites/sr_odindindun_sheet.json');
        this.load.atlas('sr_traffarella_atlas', '/assets/sprites/sr_traffarella_sheet.png', '/assets/sprites/sr_traffarella_sheet.json');

        // SSR Unit Atlases (animations)
        this.load.atlas('flame_knight_atlas', '/assets/sprites/flame_knight_sheet.png', '/assets/sprites/flame_knight_sheet.json');
        this.load.atlas('ice_samurai_atlas', '/assets/sprites/ice_samurai_sheet.png', '/assets/sprites/ice_samurai_sheet.json');
        this.load.atlas('shadow_assassin_atlas', '/assets/sprites/shadow_assassin_sheet.png', '/assets/sprites/shadow_assassin_sheet.json');
        this.load.atlas('thunder_golem_atlas', '/assets/sprites/thunder_golem_sheet.png', '/assets/sprites/thunder_golem_sheet.json');

        // UR Unit Atlases (animations)
        this.load.atlas('ur_knight_atlas', '/assets/sprites/ur_knight_sheet.png', '/assets/sprites/ur_knight_sheet.json');
        this.load.atlas('ur_mage_atlas', '/assets/sprites/ur_mage_sheet.png', '/assets/sprites/ur_mage_sheet.json');
        this.load.atlas('ur_archer_atlas', '/assets/sprites/ur_archer_sheet.png', '/assets/sprites/ur_archer_sheet.json');
        this.load.atlas('ur_tank_atlas', '/assets/sprites/ur_tank_sheet.png', '/assets/sprites/ur_tank_sheet.json');
        this.load.atlas('ur_ninja_atlas', '/assets/sprites/ur_ninja_sheet.png', '/assets/sprites/ur_ninja_sheet.json');
        this.load.atlas('ur_healer_atlas', '/assets/sprites/ur_healer_sheet.png', '/assets/sprites/ur_healer_sheet.json');
        this.load.atlas('ur_dragon_atlas', '/assets/sprites/ur_dragon_sheet.png', '/assets/sprites/ur_dragon_sheet.json');
        this.load.atlas('ur_spirit_atlas', '/assets/sprites/ur_spirit_sheet.png', '/assets/sprites/ur_spirit_sheet.json');
        this.load.atlas('ur_phoenix_atlas', '/assets/sprites/ur_phoenix_sheet.png', '/assets/sprites/ur_phoenix_sheet.json');
        this.load.atlas('ur_golem_atlas', '/assets/sprites/ur_golem_sheet.png', '/assets/sprites/ur_golem_sheet.json');
        this.load.atlas('ur_angel_atlas', '/assets/sprites/ur_angel_sheet.png', '/assets/sprites/ur_angel_sheet.json');
    }

    private summonUIButtons: {
        unitId: string;
        cost: number;
        rarity: Rarity;
        bg: Phaser.GameObjects.Rectangle;
        icon: Phaser.GameObjects.Image;
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

    create() {
        const { width, height } = this.scale;
        this.groundY = height - 130; // ボタン用スペースを確保

        // アニメーション作成
        this.createAnimations();

        // 背景
        this.createBackground();

        // 地面（床を大きく）- ステージ設定から色を取得
        const worldWidth = this.stageData.length + 100;
        const groundColorStr = this.stageData.background?.groundColor || '0x3d2817';
        const groundColor = parseInt(groundColorStr.replace('0x', ''), 16);
        this.add.rectangle(worldWidth / 2, height - 65, worldWidth, 130, groundColor);

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
            regenRate: 100,
            maxLevels: [1000, 2500, 4500, 7000, 10000, 15000, 25000, 99999],
            regenRates: [100, 150, 250, 400, 600, 900, 1500, 2500],
            upgradeCosts: [500, 1200, 2500, 4500, 8000, 12000, 20000],
        });

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
        const srUnits = ['sr_rose_hero', 'sr_corn_tank', 'sr_bamboo_mech', 'sr_sun_pirate', 'sr_tulip_idol', 'sr_cappuccino_assassin', 'sr_capybara_ninja', 'sr_capybara_shaman', 'sr_coffee_ninja', 'sr_odindindun', 'sr_traffarella'];
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
        const urUnits = ['ur_knight', 'ur_mage', 'ur_archer', 'ur_tank', 'ur_ninja', 'ur_healer', 'ur_dragon', 'ur_spirit', 'ur_phoenix', 'ur_golem', 'ur_angel'];
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

        // 色文字列を数値に変換
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
            this.costSystem.upgradeMax();
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

        // 背景
        const bg = this.add.rectangle(0, 0, 80, 32, this.mathModeEnabled ? 0x4ade80 : 0x6b7280);
        bg.setStrokeStyle(2, 0x3b2a1a);
        bg.setInteractive({ useHandCursor: true });

        // テキスト
        const text = this.add.text(0, 0, this.mathModeEnabled ? '🧮 ON' : '🧮 OFF', {
            fontSize: '12px',
            color: '#ffffff',
            fontStyle: 'bold',
        });
        text.setOrigin(0.5, 0.5);

        this.mathModeBtn.add([bg, text]);

        // クリックでトグル
        bg.on('pointerdown', () => {
            this.mathModeEnabled = !this.mathModeEnabled;
            bg.setFillStyle(this.mathModeEnabled ? 0x4ade80 : 0x6b7280);
            text.setText(this.mathModeEnabled ? '🧮 ON' : '🧮 OFF');
        });

        // ホバーエフェクト
        bg.on('pointerover', () => {
            bg.setAlpha(0.8);
        });
        bg.on('pointerout', () => {
            bg.setAlpha(1);
        });
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
        const startX = 155; // デッキ切り替えボタン分右にずらす
        const gap = 8;

        this.teamData.forEach((unit, index) => {
            const x = startX + index * (buttonWidth + gap);

            // ボタン背景
            const bg = this.add.rectangle(x, buttonY, buttonWidth, buttonHeight, 0xf8e7b6, 1);
            bg.setScrollFactor(0);
            bg.setDepth(100);
            bg.setInteractive({ useHandCursor: true });
            bg.setStrokeStyle(3, 0x3b2a1a);

            // ユニット画像
            const unitIcon = this.add.image(x, buttonY - 22, unit.id);
            const iconScale = 45 / unitIcon.height;
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
                cooldownDuration: COOLDOWN_BY_RARITY[unit.rarity],
                buttonX: x,
                buttonY: buttonY,
                buttonHeight: buttonHeight,
            });

            // クリックでクイズ開始
            bg.on('pointerdown', () => {
                this.startQuiz(unit.id, unit.cost);
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
        const startX = 155; // 65 -> 155 (デッキ切り替えボタン分右にずらす)
        const gap = 8;

        // デッキ切り替えボタン（キャラカードの左端）
        const deckBtnX = 55;
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

            // ユニット画像
            const unitIcon = this.add.image(x, buttonY - 22, unit.id);
            const iconScale = 45 / unitIcon.height; // 45pxに収める
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
                cooldownDuration: COOLDOWN_BY_RARITY[unit.rarity],
                buttonX: x,
                buttonY: buttonY,
                buttonHeight: buttonHeight,
            });

            // クリックでクイズ開始
            bg.on('pointerdown', () => {
                this.startQuiz(unit.id, unit.cost);
            });

            // ホバーエフェクト
            bg.on('pointerover', () => bg.setFillStyle(0xfff3cf));
            bg.on('pointerout', () => bg.setFillStyle(0xf8e7b6));
        });

        // 城攻撃ボタン（右端）
        const cannonX = width - 80;
        const cannonY = buttonY - 5;
        this.cannonBtnBg = this.add.rectangle(cannonX, cannonY, 110, 80, 0xf8e7b6);
        this.cannonBtnBg.setScrollFactor(0);
        this.cannonBtnBg.setDepth(100);
        this.cannonBtnBg.setStrokeStyle(3, 0x3b2a1a);
        this.cannonBtnBg.setInteractive({ useHandCursor: true });

        this.cannonBtnText = this.add.text(cannonX, cannonY - 10, '城攻撃', {
            fontSize: '12px',
            color: '#3b2a1a',
            fontStyle: 'bold',
        });
        this.cannonBtnText.setOrigin(0.5, 0.5);
        this.cannonBtnText.setScrollFactor(0);
        this.cannonBtnText.setDepth(101);

        this.cannonBarBg = this.add.rectangle(cannonX - 40, cannonY + 20, 80, 10, 0xd7bf8a);
        this.cannonBarBg.setOrigin(0, 0.5);
        this.cannonBarBg.setScrollFactor(0);
        this.cannonBarBg.setDepth(101);
        this.cannonBarBg.setStrokeStyle(2, 0x3b2a1a);

        this.cannonBarFill = this.add.rectangle(cannonX - 40, cannonY + 20, 0, 10, 0xffd45a);
        this.cannonBarFill.setOrigin(0, 0.5);
        this.cannonBarFill.setScrollFactor(0);
        this.cannonBarFill.setDepth(102);

        this.cannonBtnBg.on('pointerdown', () => {
            this.fireCastleAttack();
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

        // 城攻撃ゲージ更新
        this.updateCannonGauge(delta);

        // 戦闘判定
        this.combatSystem.update(
            this.allyUnits.filter(u => !u.isDead()),
            this.enemyUnits.filter(u => !u.isDead()),
            this.allyCastle,
            this.enemyCastle
        );

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

    private updateUnits(delta: number) {
        for (const unit of [...this.allyUnits, ...this.enemyUnits]) {
            if (!unit.isDead()) {
                unit.update(delta);
            }
        }
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
            const cooldownEnd = this.unitCooldowns.get(btn.unitId);
            const isOnCooldown = cooldownEnd && now < cooldownEnd;
            const canAffordCost = current >= btn.cost;
            const canSummon = canAffordCost && !isOnCooldown;

            // クールダウン表示更新
            if (isOnCooldown && cooldownEnd && btn.cooldownDuration > 0) {
                const remainingMs = cooldownEnd - now;
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

                // クールダウン終了時のフラッシュエフェクト（既存のTweenがなければ）
                if (cooldownEnd && now >= cooldownEnd && now < cooldownEnd + 100) {
                    this.tweens.add({
                        targets: btn.bg,
                        scaleX: 1.1,
                        scaleY: 1.1,
                        duration: 100,
                        yoyo: true,
                        onComplete: () => btn.bg.setScale(1),
                    });
                }
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

    private updateCannonGauge(delta: number) {
        this.cannonCharge = Math.min(this.cannonCharge + delta, this.cannonChargeMax);
        const ratio = this.cannonCharge / this.cannonChargeMax;
        const barWidth = Math.max(0, Math.min(1, ratio)) * 80;
        this.cannonBarFill.width = barWidth;
        this.cannonBarFill.height = 10;

        if (this.cannonCharge >= this.cannonChargeMax) {
            this.cannonBtnBg.setFillStyle(0xffe066);
        } else {
            this.cannonBtnBg.setFillStyle(0xf8e7b6);
        }
    }

    private fireCastleAttack() {
        if (this.cannonCharge < this.cannonChargeMax) return;

        const damage = 200;
        const knockback = 60;
        const livingEnemies = this.enemyUnits.filter(u => !u.isDead());
        if (livingEnemies.length > 0) {
            for (const enemy of livingEnemies) {
                enemy.takeDamage(damage, knockback);
            }
        } else {
            this.enemyCastle.takeDamage(damage);
        }

        this.cannonCharge = 0;
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
        const cooldownEnd = this.unitCooldowns.get(unitId);
        if (cooldownEnd && this.time.now < cooldownEnd) {
            return; // クールダウン中
        }

        // コストチェック
        if (!this.costSystem.spend(unitDef.cost)) {
            // コスト不足
            return;
        }

        // クールダウンを設定
        const cooldownMs = COOLDOWN_BY_RARITY[unitDef.rarity];
        this.unitCooldowns.set(unitId, this.time.now + cooldownMs);

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

    // ========================================
    // クイズ機能（コスト別の難易度）
    // ========================================

    private startQuiz(unitId: string, cost: number) {
        if (this.gameState !== 'PLAYING' || this.quizActive) return;

        // クールダウンチェック
        const cooldownEnd = this.unitCooldowns.get(unitId);
        if (cooldownEnd && this.time.now < cooldownEnd) {
            return; // クールダウン中
        }

        // コストチェック
        if (!this.costSystem.canAfford(cost)) {
            return;
        }

        // 算数モードがOFFの場合、またはコスト100以下: クイズなし、即座に召喚
        if (!this.mathModeEnabled || cost <= 100) {
            this.summonAllyUnit(unitId);
            return;
        }

        // クイズ開始
        this.quizActive = true;
        this.pendingUnitId = unitId;
        this.pendingUnitCost = cost;

        let a: number, b: number, questionText: string;

        if (cost >= 1000) {
            // コスト1000以上: 2桁の掛け算または割り算
            const useDivision = Phaser.Math.Between(0, 1) === 0;
            if (useDivision) {
                // 割り算: 2桁 ÷ 1桁 = 整数の問題
                b = Phaser.Math.Between(2, 9);
                const result = Phaser.Math.Between(2, 12);
                a = b * result;
                this.quizCorrectAnswer = result;
                questionText = `${a} ÷ ${b} = ?`;
            } else {
                // 掛け算: 2桁 × 1桁
                a = Phaser.Math.Between(10, 25);
                b = Phaser.Math.Between(2, 5);
                this.quizCorrectAnswer = a * b;
                questionText = `${a} × ${b} = ?`;
            }
        } else if (cost >= 200) {
            // コスト200〜999: 掛け算（1桁×1桁）
            a = Phaser.Math.Between(2, 9);
            b = Phaser.Math.Between(2, 9);
            this.quizCorrectAnswer = a * b;
            questionText = `${a} × ${b} = ?`;
        } else {
            // コスト101〜199: 足し算（一桁＋一桁）
            a = Phaser.Math.Between(1, 9);
            b = Phaser.Math.Between(1, 9);
            this.quizCorrectAnswer = a + b;
            questionText = `${a} + ${b} = ?`;
        }

        // 選択肢を生成
        const choices = this.generateChoices(this.quizCorrectAnswer, cost >= 200);

        // クイズUIを表示
        this.showQuizUI(questionText, choices);
    }

    private generateChoices(correct: number, isMultiplication: boolean): number[] {
        const choices: Set<number> = new Set([correct]);
        const range = isMultiplication ? 15 : 5;

        while (choices.size < 4) {
            let wrong = correct + Phaser.Math.Between(-range, range);
            if (wrong <= 0) wrong = Phaser.Math.Between(1, correct + range);
            if (wrong !== correct) {
                choices.add(wrong);
            }
        }

        return Phaser.Utils.Array.Shuffle(Array.from(choices));
    }

    private showQuizUI(questionText: string, choices: number[]) {
        const { width, height } = this.scale;

        // コンテナ作成
        this.quizContainer = this.add.container(0, 0);
        this.quizContainer.setScrollFactor(0);
        this.quizContainer.setDepth(300);

        // 背景オーバーレイ
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
        this.quizContainer.add(overlay);

        // パネル背景（サイズ調整）
        const panelW = 260;
        const panelH = 220;
        const panelY = height / 2 - 80;
        const panel = this.add.rectangle(width / 2, panelY, panelW, panelH, 0xfff8e7);
        panel.setStrokeStyle(4, 0x3b2a1a);
        this.quizContainer.add(panel);

        // タイトル
        const titleY = panelY - 80;
        const title = this.add.text(width / 2, titleY, '🧮 Quiz!', {
            fontSize: '20px',
            color: '#3b2a1a',
            fontStyle: 'bold',
        });
        title.setOrigin(0.5, 0.5);
        this.quizContainer.add(title);

        // 問題
        const questionY = panelY - 50;
        this.quizQuestion = this.add.text(width / 2, questionY, questionText, {
            fontSize: '28px',
            color: '#2d6a4f',
            fontStyle: 'bold',
        });
        this.quizQuestion.setOrigin(0.5, 0.5);
        this.quizContainer.add(this.quizQuestion);

        // 選択肢ボタン（2x2）
        this.quizButtons = [];
        const btnSize = 50;
        const btnGap = 10;
        const startX = width / 2 - btnSize - btnGap / 2;
        const startY = panelY - 10;

        choices.forEach((choice, index) => {
            const row = Math.floor(index / 2);
            const col = index % 2;
            const bx = startX + col * (btnSize + btnGap) + btnSize / 2;
            const by = startY + row * (btnSize + btnGap) + btnSize / 2;

            const btnContainer = this.add.container(bx, by);

            const btnBg = this.add.rectangle(0, 0, btnSize, btnSize, 0xffe066);
            btnBg.setStrokeStyle(3, 0x3b2a1a);
            btnBg.setInteractive({ useHandCursor: true });
            btnContainer.add(btnBg);

            const btnText = this.add.text(0, 0, `${choice}`, {
                fontSize: '20px',
                color: '#3b2a1a',
                fontStyle: 'bold',
            });
            btnText.setOrigin(0.5, 0.5);
            btnContainer.add(btnText);

            btnBg.on('pointerdown', () => {
                this.answerQuiz(choice);
            });

            btnBg.on('pointerover', () => btnBg.setFillStyle(0xfff3cf));
            btnBg.on('pointerout', () => btnBg.setFillStyle(0xffe066));

            this.quizContainer.add(btnContainer);
            this.quizButtons.push(btnContainer);
        });
    }

    private answerQuiz(answer: number) {
        const correct = answer === this.quizCorrectAnswer;
        const { width, height } = this.scale;
        const panelY = height / 2 - 80;

        if (correct) {
            const successText = this.add.text(width / 2, panelY + 85, '✅ OK!', {
                fontSize: '24px',
                color: '#2d6a4f',
                fontStyle: 'bold',
            });
            successText.setOrigin(0.5, 0.5);
            successText.setScrollFactor(0);
            successText.setDepth(301);
            this.quizContainer.add(successText);

            // 召喚実行
            if (this.pendingUnitId && this.costSystem.spend(this.pendingUnitCost)) {
                const spawnX = this.allyCastle.getX() + 60;
                const unitDef = this.allUnitsData.find(u => u.id === this.pendingUnitId);
                if (unitDef) {
                    // クールダウンを設定
                    const cooldownMs = COOLDOWN_BY_RARITY[unitDef.rarity];
                    this.unitCooldowns.set(unitDef.id, this.time.now + cooldownMs);

                    const unit = new Unit(this, spawnX, this.groundY, unitDef, 'ally', this.stageData.length);
                    this.allyUnits.push(unit);
                }
            }
        } else {
            const failText = this.add.text(width / 2, panelY + 85, `❌ ${this.quizCorrectAnswer}`, {
                fontSize: '24px',
                color: '#c1121f',
                fontStyle: 'bold',
            });
            failText.setOrigin(0.5, 0.5);
            failText.setScrollFactor(0);
            failText.setDepth(301);
            this.quizContainer.add(failText);
        }

        this.time.delayedCall(correct ? 400 : 800, () => {
            this.closeQuiz();
        });
    }

    private closeQuiz() {
        if (this.quizContainer) {
            this.quizContainer.destroy();
        }
        this.quizActive = false;
        this.pendingUnitId = null;
        this.pendingUnitCost = 0;
        this.quizButtons = [];
    }
}
