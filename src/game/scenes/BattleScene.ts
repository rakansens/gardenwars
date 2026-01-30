import Phaser from 'phaser';
import { Unit } from '../entities/Unit';
import { Castle } from '../entities/Castle';
import { CombatSystem } from '../systems/CombatSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { CostSystem } from '../systems/CostSystem';
import { QuizSystem } from '../systems/QuizSystem';
import { CannonSystem } from '../systems/CannonSystem';
import { eventBus, GameEvents } from '../utils/EventBus';
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

    constructor() {
        super({ key: 'BattleScene' });
    }

    shutdown() {
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
        // 城スプライトをロード
        this.load.image('castle_ally', '/assets/sprites/castle_ally.webp');
        this.load.image('castle_enemy', '/assets/sprites/castle_enemy.webp');

        // 背景画像をロード（設定されている場合）
        if (this.stageData.background?.image) {
            this.load.image('stage_bg', this.stageData.background.image);
        }

        // ユニットスプライトをロード（静止画フォールバック用）
        this.load.image('cat_warrior', '/assets/sprites/cat_warrior.webp');
        this.load.image('cat_tank', '/assets/sprites/cat_tank.webp');
        this.load.image('cat_archer', '/assets/sprites/cat_archer.webp');
        this.load.image('cat_mage', '/assets/sprites/cat_mage.webp');
        this.load.image('cat_ninja', '/assets/sprites/cat_ninja.webp');
        this.load.image('ice_flower', '/assets/sprites/ice_flower.webp');
        this.load.image('corn_fighter', '/assets/sprites/corn_fighter.webp');
        this.load.image('block_slime', '/assets/sprites/block_slime.webp');
        this.load.image('sunflower', '/assets/sprites/sunflower.webp');
        this.load.image('watermelon', '/assets/sprites/watermelon.webp');
        this.load.image('corn_kid', '/assets/sprites/corn_kid.webp');
        this.load.image('ribbon_girl', '/assets/sprites/ribbon_girl.webp');
        this.load.image('penguin_boy', '/assets/sprites/penguin_boy.webp');
        this.load.image('cinnamon_girl', '/assets/sprites/cinnamon_girl.webp');
        this.load.image('enemy_dog', '/assets/sprites/enemy_dog.webp');
        this.load.image('enemy_wolf', '/assets/sprites/enemy_wolf.webp');
        this.load.image('enemy_crow', '/assets/sprites/enemy_crow.webp');

        // スプライトシート（アトラス）をロード
        this.load.atlas(
            'cat_warrior_atlas',
            '/assets/sprites/cat_warrior_sheet.webp',
            '/assets/sprites/cat_warrior_sheet.json'
        );
        this.load.atlas(
            'corn_fighter_atlas',
            '/assets/sprites/corn_fighter_sheet.webp',
            '/assets/sprites/corn_fighter_sheet.json'
        );
        this.load.atlas(
            'penguin_boy_atlas',
            '/assets/sprites/penguin_boy_sheet.webp',
            '/assets/sprites/penguin_boy_sheet.json'
        );
        this.load.atlas(
            'cinnamon_girl_atlas',
            '/assets/sprites/cinnamon_girl_sheet.webp',
            '/assets/sprites/cinnamon_girl_sheet.json'
        );
        this.load.image('nika', '/assets/sprites/nika.webp');
        this.load.atlas(
            'nika_atlas',
            '/assets/sprites/nika_sheet.webp',
            '/assets/sprites/nika_sheet.json'
        );
        this.load.image('lennon', '/assets/sprites/lennon.webp');
        this.load.atlas(
            'lennon_atlas',
            '/assets/sprites/lennon_sheet.webp',
            '/assets/sprites/lennon_sheet.json'
        );
        this.load.atlas(
            'n_bee_atlas',
            '/assets/sprites/n_bee_sheet.webp',
            '/assets/sprites/n_bee_sheet.json'
        );

        // UR Units
        this.load.image('ur_knight', '/assets/sprites/ur_knight.webp');
        this.load.image('ur_mage', '/assets/sprites/ur_mage.webp');
        this.load.image('ur_archer', '/assets/sprites/ur_archer.webp');
        this.load.image('ur_tank', '/assets/sprites/ur_tank.webp');
        this.load.image('ur_ninja', '/assets/sprites/ur_ninja.webp');
        this.load.image('ur_healer', '/assets/sprites/ur_healer.webp');
        this.load.image('ur_dragon', '/assets/sprites/ur_dragon.webp');
        this.load.image('ur_spirit', '/assets/sprites/ur_spirit.webp');
        this.load.image('ur_phoenix', '/assets/sprites/ur_phoenix.webp');
        this.load.image('ur_golem', '/assets/sprites/ur_golem.webp');
        this.load.image('ur_angel', '/assets/sprites/ur_angel.webp');

        // New UR Units
        this.load.image('ur_rose_queen', '/assets/sprites/ur_rose_queen.webp');
        this.load.image('ur_galaxy_butterfly', '/assets/sprites/ur_galaxy_butterfly.webp');
        this.load.image('ur_rose_capybara', '/assets/sprites/ur_rose_capybara.webp');
        this.load.image('ur_cosmic_dragon', '/assets/sprites/ur_cosmic_dragon.webp');
        this.load.image('ur_nature_spirit_cat', '/assets/sprites/ur_nature_spirit_cat.webp');
        this.load.image('ur_inferno_demon', '/assets/sprites/ur_inferno_demon.webp');
        this.load.image('ur_golden_lion', '/assets/sprites/ur_golden_lion.webp');
        this.load.image('ur_chrono_sage', '/assets/sprites/ur_chrono_sage.webp');
        this.load.image('ur_jade_dragon', '/assets/sprites/ur_jade_dragon.webp');
        this.load.image('ur_emerald_dragon', '/assets/sprites/ur_emerald_dragon.webp');
        this.load.image('ur_chronos_cat', '/assets/sprites/ur_chronos_cat.webp');
        this.load.image('ur_ancient_treant', '/assets/sprites/ur_ancient_treant.webp');
        this.load.image('ur_nature_titan', '/assets/sprites/ur_nature_titan.webp');
        this.load.image('ur_stone_golem_cat', '/assets/sprites/ur_stone_golem_cat.webp');
        this.load.image('ur_fire_lotus_cat', '/assets/sprites/ur_fire_lotus_cat.webp');
        this.load.image('ur_astral_wizard', '/assets/sprites/ur_astral_wizard.webp');
        this.load.image('ur_rune_golem', '/assets/sprites/ur_rune_golem.webp');
        this.load.image('ur_frost_giant', '/assets/sprites/ur_frost_giant.webp');
        this.load.image('ur_celestial_cat', '/assets/sprites/ur_celestial_cat.webp');
        this.load.image('ur_crystal_griffin', '/assets/sprites/ur_crystal_griffin.webp');
        this.load.image('ur_prismatic_cat', '/assets/sprites/ur_prismatic_cat.webp');
        this.load.image('ur_sea_leviathan', '/assets/sprites/ur_sea_leviathan.webp');
        this.load.image('ur_thunder_phoenix', '/assets/sprites/ur_thunder_phoenix.webp');

        // Normal Units
        this.load.image('n_mushroom', '/assets/sprites/n_mushroom.webp');
        this.load.image('n_apple', '/assets/sprites/n_apple.webp');
        this.load.image('n_carrot', '/assets/sprites/n_carrot.webp');
        this.load.image('n_pumpkin', '/assets/sprites/n_pumpkin.webp');
        this.load.image('n_acorn', '/assets/sprites/n_acorn.webp');
        this.load.image('n_strawberry', '/assets/sprites/n_strawberry.webp');
        this.load.image('n_onion', '/assets/sprites/n_onion.webp');
        this.load.image('n_grape', '/assets/sprites/n_grape.webp');
        this.load.image('n_aloe_beast', '/assets/sprites/n_aloe_beast.webp');
        this.load.image('n_cherry_bomb', '/assets/sprites/n_cherry_bomb.webp');
        this.load.image('n_dust_bunny', '/assets/sprites/n_dust_bunny.webp');
        this.load.image('n_hibiscus', '/assets/sprites/n_hibiscus.webp');
        this.load.image('n_leaf_sprite', '/assets/sprites/n_leaf_sprite.webp');
        this.load.image('n_pebble', '/assets/sprites/n_pebble.webp');
        this.load.image('n_dew', '/assets/sprites/n_dew.webp');
        this.load.image('n_root', '/assets/sprites/n_root.webp');
        this.load.image('n_capybara', '/assets/sprites/n_capybara.webp');
        this.load.image('r_capybara_gardener', '/assets/sprites/r_capybara_gardener.webp');
        this.load.image('r_capybara_spa', '/assets/sprites/r_capybara_spa.webp');
        this.load.image('sr_capybara_ninja', '/assets/sprites/sr_capybara_ninja.webp');
        this.load.image('sr_capybara_shaman', '/assets/sprites/sr_capybara_shaman.webp');

        // New N Units
        this.load.image('n_log', '/assets/sprites/n_log.webp');
        this.load.image('n_octopus', '/assets/sprites/n_octopus.webp');
        this.load.image('n_dolphin', '/assets/sprites/n_dolphin.webp');
        this.load.image('n_bean', '/assets/sprites/n_bean.webp');
        this.load.image('n_frog', '/assets/sprites/n_frog.webp');

        // New R Units
        this.load.image('r_croc_pilot', '/assets/sprites/r_croc_pilot.webp');
        this.load.image('r_latte_ballerina', '/assets/sprites/r_latte_ballerina.webp');
        this.load.image('r_penguin_scholar', '/assets/sprites/r_penguin_scholar.webp');

        // New SR Units
        this.load.image('sr_coffee_ninja', '/assets/sprites/sr_coffee_ninja.webp');
        this.load.image('sr_cappuccino_assassin', '/assets/sprites/sr_cappuccino_assassin.webp');
        this.load.image('sr_odindindun', '/assets/sprites/sr_odindindun.webp');
        this.load.image('sr_traffarella', '/assets/sprites/sr_traffarella.webp');

        // Rare Units
        this.load.image('r_tomato', '/assets/sprites/r_tomato.webp');
        this.load.image('r_pepper', '/assets/sprites/r_pepper.webp');
        this.load.image('r_broccoli', '/assets/sprites/r_broccoli.webp');
        this.load.image('r_eggplant', '/assets/sprites/r_eggplant.webp');
        this.load.image('r_cherry', '/assets/sprites/r_cherry.webp');
        this.load.image('r_lemon', '/assets/sprites/r_lemon.webp');
        this.load.image('r_radish', '/assets/sprites/r_radish.webp');
        this.load.image('r_pumpkin_brawler', '/assets/sprites/r_pumpkin_brawler.webp');
        this.load.image('r_solar_spike', '/assets/sprites/r_solar_spike.webp');
        this.load.image('r_fire_chili', '/assets/sprites/r_fire_chili.webp');
        this.load.image('r_leaf_ninja', '/assets/sprites/r_leaf_ninja.webp');

        // SR Units
        this.load.image('sr_rose_hero', '/assets/sprites/sr_rose_hero.webp');
        this.load.image('sr_corn_tank', '/assets/sprites/sr_corn_tank.webp');
        this.load.image('sr_bamboo_mech', '/assets/sprites/sr_bamboo_mech.webp');
        this.load.image('sr_sun_pirate', '/assets/sprites/sr_sun_pirate.webp');
        this.load.image('sr_tulip_idol', '/assets/sprites/sr_tulip_idol.webp');
        this.load.image('sr_crystal_lotus_cat', '/assets/sprites/sr_crystal_lotus_cat.webp');
        this.load.image('sr_bonsai_cat', '/assets/sprites/sr_bonsai_cat.webp');

        // New N Units
        this.load.image('n_ladybug_cat', '/assets/sprites/n_ladybug_cat.webp');
        this.load.image('n_autumn_leaf_cat', '/assets/sprites/n_autumn_leaf_cat.webp');
        this.load.image('n_frog_cat', '/assets/sprites/n_frog_cat.webp');
        this.load.image('n_succulent_cat', '/assets/sprites/n_succulent_cat.webp');
        this.load.image('n_farmer_cat', '/assets/sprites/n_farmer_cat.webp');
        this.load.image('n_cinnamon_cat', '/assets/sprites/n_cinnamon_cat.webp');
        this.load.image('n_potted_plant_cat', '/assets/sprites/n_potted_plant_cat.webp');
        this.load.image('n_ivy_harvest_cat', '/assets/sprites/n_ivy_harvest_cat.webp');
        this.load.image('n_sunflower_cat', '/assets/sprites/n_sunflower_cat.webp');
        this.load.image('n_sprout_cat', '/assets/sprites/n_sprout_cat.webp');

        // New R Units
        this.load.image('r_cactus_guardian', '/assets/sprites/r_cactus_guardian.webp');
        this.load.image('r_dandelion_cat', '/assets/sprites/r_dandelion_cat.webp');
        this.load.image('r_ivy_ninja_cat', '/assets/sprites/r_ivy_ninja_cat.webp');
        this.load.image('r_cherry_blossom_cat', '/assets/sprites/r_cherry_blossom_cat.webp');
        this.load.image('r_rose_bunny_cat', '/assets/sprites/r_rose_bunny_cat.webp');
        this.load.image('r_bamboo_samurai_cat', '/assets/sprites/r_bamboo_samurai_cat.webp');
        this.load.image('r_hydrangea_cat', '/assets/sprites/r_hydrangea_cat.webp');

        // New SR Units
        this.load.image('sr_cloud_angel_cat', '/assets/sprites/sr_cloud_angel_cat.webp');
        this.load.image('sr_thorn_beast_cat', '/assets/sprites/sr_thorn_beast_cat.webp');
        this.load.image('sr_thorn_reaper_cat', '/assets/sprites/sr_thorn_reaper_cat.webp');
        this.load.image('sr_lucky_clover_cat', '/assets/sprites/sr_lucky_clover_cat.webp');

        // SSR Units
        this.load.image('flame_knight', '/assets/sprites/flame_knight.webp');
        this.load.image('ice_samurai', '/assets/sprites/ice_samurai.webp');
        this.load.image('shadow_assassin', '/assets/sprites/shadow_assassin.webp');
        this.load.image('thunder_golem', '/assets/sprites/thunder_golem.webp');

        // SR Unit Atlases (animations)
        this.load.atlas('sr_rose_hero_atlas', '/assets/sprites/sr_rose_hero_sheet.webp', '/assets/sprites/sr_rose_hero_sheet.json');
        this.load.atlas('sr_corn_tank_atlas', '/assets/sprites/sr_corn_tank_sheet.webp', '/assets/sprites/sr_corn_tank_sheet.json');
        this.load.atlas('sr_bamboo_mech_atlas', '/assets/sprites/sr_bamboo_mech_sheet.webp', '/assets/sprites/sr_bamboo_mech_sheet.json');
        this.load.atlas('sr_sun_pirate_atlas', '/assets/sprites/sr_sun_pirate_sheet.webp', '/assets/sprites/sr_sun_pirate_sheet.json');
        this.load.atlas('sr_tulip_idol_atlas', '/assets/sprites/sr_tulip_idol_sheet.webp', '/assets/sprites/sr_tulip_idol_sheet.json');
        this.load.atlas('sr_cappuccino_assassin_atlas', '/assets/sprites/sr_cappuccino_assassin_sheet.webp', '/assets/sprites/sr_cappuccino_assassin_sheet.json');
        this.load.atlas('sr_capybara_ninja_atlas', '/assets/sprites/sr_capybara_ninja_sheet.webp', '/assets/sprites/sr_capybara_ninja_sheet.json');
        this.load.atlas('sr_capybara_shaman_atlas', '/assets/sprites/sr_capybara_shaman_sheet.webp', '/assets/sprites/sr_capybara_shaman_sheet.json');
        // sr_coffee_ninja uses static image (no sprite sheet)
        this.load.atlas('sr_odindindun_atlas', '/assets/sprites/sr_odindindun_sheet.webp', '/assets/sprites/sr_odindindun_sheet.json');
        this.load.atlas('sr_traffarella_atlas', '/assets/sprites/sr_traffarella_sheet.webp', '/assets/sprites/sr_traffarella_sheet.json');

        // SSR Unit Atlases (animations)
        this.load.atlas('flame_knight_atlas', '/assets/sprites/flame_knight_sheet.webp', '/assets/sprites/flame_knight_sheet.json');
        this.load.atlas('ice_samurai_atlas', '/assets/sprites/ice_samurai_sheet.webp', '/assets/sprites/ice_samurai_sheet.json');
        this.load.atlas('shadow_assassin_atlas', '/assets/sprites/shadow_assassin_sheet.webp', '/assets/sprites/shadow_assassin_sheet.json');
        this.load.atlas('thunder_golem_atlas', '/assets/sprites/thunder_golem_sheet.webp', '/assets/sprites/thunder_golem_sheet.json');

        // UR Unit Atlases (animations)
        this.load.atlas('ur_knight_atlas', '/assets/sprites/ur_knight_sheet.webp', '/assets/sprites/ur_knight_sheet.json');
        this.load.atlas('ur_mage_atlas', '/assets/sprites/ur_mage_sheet.webp', '/assets/sprites/ur_mage_sheet.json');
        this.load.atlas('ur_archer_atlas', '/assets/sprites/ur_archer_sheet.webp', '/assets/sprites/ur_archer_sheet.json');
        this.load.atlas('ur_tank_atlas', '/assets/sprites/ur_tank_sheet.webp', '/assets/sprites/ur_tank_sheet.json');
        this.load.atlas('ur_ninja_atlas', '/assets/sprites/ur_ninja_sheet.webp', '/assets/sprites/ur_ninja_sheet.json');
        this.load.atlas('ur_healer_atlas', '/assets/sprites/ur_healer_sheet.webp', '/assets/sprites/ur_healer_sheet.json');
        this.load.atlas('ur_dragon_atlas', '/assets/sprites/ur_dragon_sheet.webp', '/assets/sprites/ur_dragon_sheet.json');
        this.load.atlas('ur_spirit_atlas', '/assets/sprites/ur_spirit_sheet.webp', '/assets/sprites/ur_spirit_sheet.json');
        this.load.atlas('ur_phoenix_atlas', '/assets/sprites/ur_phoenix_sheet.webp', '/assets/sprites/ur_phoenix_sheet.json');
        this.load.atlas('ur_golem_atlas', '/assets/sprites/ur_golem_sheet.webp', '/assets/sprites/ur_golem_sheet.json');
        this.load.atlas('ur_angel_atlas', '/assets/sprites/ur_angel_sheet.webp', '/assets/sprites/ur_angel_sheet.json');
        this.load.atlas('ur_ancient_treant_atlas', '/assets/sprites/ur_ancient_treant_sheet.webp', '/assets/sprites/ur_ancient_treant_sheet.json');

        // New UR Unit Atlases
        this.load.atlas('ur_astral_wizard_atlas', '/assets/sprites/ur_astral_wizard_sheet.webp', '/assets/sprites/ur_astral_wizard_sheet.json');
        this.load.atlas('ur_celestial_cat_atlas', '/assets/sprites/ur_celestial_cat_sheet.webp', '/assets/sprites/ur_celestial_cat_sheet.json');
        this.load.atlas('ur_chrono_sage_atlas', '/assets/sprites/ur_chrono_sage_sheet.webp', '/assets/sprites/ur_chrono_sage_sheet.json');
        this.load.atlas('ur_chronos_cat_atlas', '/assets/sprites/ur_chronos_cat_sheet.webp', '/assets/sprites/ur_chronos_cat_sheet.json');
        this.load.atlas('ur_cosmic_dragon_atlas', '/assets/sprites/ur_cosmic_dragon_sheet.webp', '/assets/sprites/ur_cosmic_dragon_sheet.json');
        this.load.atlas('ur_crystal_griffin_atlas', '/assets/sprites/ur_crystal_griffin_sheet.webp', '/assets/sprites/ur_crystal_griffin_sheet.json');
        this.load.atlas('ur_emerald_dragon_atlas', '/assets/sprites/ur_emerald_dragon_sheet.webp', '/assets/sprites/ur_emerald_dragon_sheet.json');
        this.load.atlas('ur_fire_lotus_cat_atlas', '/assets/sprites/ur_fire_lotus_cat_sheet.webp', '/assets/sprites/ur_fire_lotus_cat_sheet.json');
        this.load.atlas('ur_frost_giant_atlas', '/assets/sprites/ur_frost_giant_sheet.webp', '/assets/sprites/ur_frost_giant_sheet.json');
        this.load.atlas('ur_galaxy_butterfly_atlas', '/assets/sprites/ur_galaxy_butterfly_sheet.webp', '/assets/sprites/ur_galaxy_butterfly_sheet.json');
        this.load.atlas('ur_golden_lion_atlas', '/assets/sprites/ur_golden_lion_sheet.webp', '/assets/sprites/ur_golden_lion_sheet.json');
        this.load.atlas('ur_inferno_demon_atlas', '/assets/sprites/ur_inferno_demon_sheet.webp', '/assets/sprites/ur_inferno_demon_sheet.json');
        this.load.atlas('ur_jade_dragon_atlas', '/assets/sprites/ur_jade_dragon_sheet.webp', '/assets/sprites/ur_jade_dragon_sheet.json');
        this.load.atlas('ur_nature_spirit_cat_atlas', '/assets/sprites/ur_nature_spirit_cat_sheet.webp', '/assets/sprites/ur_nature_spirit_cat_sheet.json');
        this.load.atlas('ur_nature_titan_atlas', '/assets/sprites/ur_nature_titan_sheet.webp', '/assets/sprites/ur_nature_titan_sheet.json');
        this.load.atlas('ur_prismatic_cat_atlas', '/assets/sprites/ur_prismatic_cat_sheet.webp', '/assets/sprites/ur_prismatic_cat_sheet.json');
        this.load.atlas('ur_rose_capybara_atlas', '/assets/sprites/ur_rose_capybara_sheet.webp', '/assets/sprites/ur_rose_capybara_sheet.json');
        this.load.atlas('ur_rose_queen_atlas', '/assets/sprites/ur_rose_queen_sheet.webp', '/assets/sprites/ur_rose_queen_sheet.json');
        this.load.atlas('ur_rune_golem_atlas', '/assets/sprites/ur_rune_golem_sheet.webp', '/assets/sprites/ur_rune_golem_sheet.json');
        this.load.atlas('ur_sea_leviathan_atlas', '/assets/sprites/ur_sea_leviathan_sheet.webp', '/assets/sprites/ur_sea_leviathan_sheet.json');
        this.load.atlas('ur_stone_golem_cat_atlas', '/assets/sprites/ur_stone_golem_cat_sheet.webp', '/assets/sprites/ur_stone_golem_cat_sheet.json');
        this.load.atlas('ur_thunder_phoenix_atlas', '/assets/sprites/ur_thunder_phoenix_sheet.webp', '/assets/sprites/ur_thunder_phoenix_sheet.json');
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
            'ur_stone_golem_cat', 'ur_thunder_phoenix'
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
        bg.setInteractive({ useHandCursor: true });

        // テキスト
        const text = this.add.text(0, 0, isEnabled ? '🧮 ON' : '🧮 OFF', {
            fontSize: '12px',
            color: '#ffffff',
            fontStyle: 'bold',
        });
        text.setOrigin(0.5, 0.5);

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
        bg.setInteractive({ useHandCursor: true });

        // テキスト
        const text = this.add.text(0, 0, '▶ 1x', {
            fontSize: '14px',
            color: '#ffffff',
            fontStyle: 'bold',
        });
        text.setOrigin(0.5, 0.5);

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
        this.waveSystem.start();
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

        // Wave処理（敵出現）
        this.waveSystem.update();

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
