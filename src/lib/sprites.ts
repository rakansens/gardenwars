import type { Rarity } from '@/data/types';

/**
 * アニメーションシートが存在するユニットのリスト
 * 全シーン（BattleScene, ArenaScene, GardenScene）で共有
 */
export const ANIMATED_UNITS = [
    // 基本ユニット
    'cat_warrior', 'corn_fighter', 'penguin_boy', 'cinnamon_girl', 'nika', 'lennon',
    // N ユニット
    'n_bee',
    // R ユニット batch 1
    'r_apple_scholar', 'r_bamboo_samurai_cat', 'r_berry_basket_cat', 'r_broccoli', 'r_cactus_cowboy',
    'r_cactus_guardian', 'r_capybara_gardener', 'r_capybara_spa', 'r_chainsaw_gardener', 'r_cherry',
    // R ユニット batch 2
    'r_cherry_blossom_cat', 'r_cloud_gardener_cat', 'r_croc_pilot', 'r_dandelion_cat', 'r_diesel_farmer',
    'r_eggplant', 'r_fire_chili', 'r_garden_hero', 'r_garden_lady_cat', 'r_grape_gladiator',
    // R ユニット batch 3
    'r_harvest_viking', 'r_herb_alchemist', 'r_herbal_tea_cat', 'r_hydrangea_cat', 'r_ivy_ninja_cat',
    'r_jellyfish_flower_cat', 'r_jungle_explorer', 'r_ladybug_rider_cat', 'r_latte_ballerina', 'r_leaf_ninja',
    // SR ユニット
    'sr_rose_hero', 'sr_corn_tank', 'sr_bamboo_mech', 'sr_sun_pirate', 'sr_tulip_idol',
    'sr_cappuccino_assassin', 'sr_capybara_ninja', 'sr_capybara_shaman', 'sr_odindindun', 'sr_traffarella',
    // New SR units (2026-02) batch 1
    'sr_amber_fossil_cat', 'sr_angelic_garden', 'sr_bamboo_blaster', 'sr_bamboo_ninja', 'sr_banchou_brawler',
    'sr_bonsai_cat', 'sr_bonsai_samurai', 'sr_butterfly_fairy_cat', 'sr_celtic_warrior', 'sr_cloud_angel_cat',
    // New SR units (2026-02) batch 2
    'sr_coffee_ninja', 'sr_crystal_lotus_cat', 'sr_crystal_rose_knight', 'sr_cyber_swordsman', 'sr_demon_mage',
    'sr_elder_botanist', 'sr_flora_captain', 'sr_flora_hero', 'sr_frost_rose_queen', 'sr_garden_guardian',
    // New SR units (2026-02) batch 3
    'sr_green_cyborg', 'sr_jade_emperor', 'sr_lucky_clover_cat', 'sr_mecha_gunner', 'sr_music_box_ballerina_cat',
    'sr_oni_bonsai', 'sr_rose_paladin', 'sr_sakura_spirit_cat', 'sr_scout_corps', 'sr_shadow_ninja',
    // New SR units (2026-02) batch 4
    'sr_snow_globe_gardener_cat', 'sr_thorn_beast_cat', 'sr_thorn_reaper_cat', 'sr_unicorn_flower_cat',
    'sr_vine_evangelion', 'sr_vine_ninja_cat', 'sr_vine_warlock', 'sr_wasteland_merc',
    // SSR ユニット
    'flame_knight', 'ice_samurai', 'shadow_assassin', 'thunder_golem',
    // New SSR units (2025-01)
    'ssr_frost_empress', 'ssr_galaxy_slime', 'ssr_carnivore_mask', 'ssr_higanbana_mage',
    'ssr_poinsettia_wild', 'ssr_psychedelic_bloom', 'ssr_rainbow_storm', 'ssr_sakura_samurai',
    'ssr_rose_gunslinger', 'ssr_phantom_masquerade', 'ssr_cyber_rose',
    // New SSR units (2026-02)
    'ssr_neon_flower_cat', 'ssr_glitch_sakura_cat', 'ssr_psychedelic_mandala_cat',
    'ssr_coral_mermaid_cat', 'ssr_fairy_queen_cat',
    // UR ユニット
    'ur_knight', 'ur_mage', 'ur_archer', 'ur_tank', 'ur_ninja', 'ur_healer',
    'ur_dragon', 'ur_spirit', 'ur_phoenix', 'ur_golem', 'ur_angel', 'ur_ancient_treant',
    'ur_astral_wizard', 'ur_celestial_cat', 'ur_chrono_sage', 'ur_chronos_cat',
    'ur_cosmic_dragon', 'ur_crystal_griffin', 'ur_emerald_dragon', 'ur_fire_lotus_cat',
    'ur_frost_giant', 'ur_galaxy_butterfly', 'ur_golden_lion', 'ur_inferno_demon',
    'ur_jade_dragon', 'ur_nature_spirit_cat', 'ur_nature_titan', 'ur_prismatic_cat',
    'ur_rose_capybara', 'ur_rose_queen', 'ur_rune_golem', 'ur_sea_leviathan',
    'ur_stone_golem_cat', 'ur_thunder_phoenix',
    // New UR units (2025-01)
    'ur_cosmic_tiger', 'ur_botanical_gundam', 'ur_fairy_knight', 'ur_golden_paladin', 'ur_overlord_rose',
    // New UR units (2026-02)
    'ur_aurora_mage_cat', 'ur_stained_glass_lotus_cat', 'ur_phoenix_flame_cat', 'ur_rose_crystal_princess_cat',
] as const;

export type AnimatedUnitId = (typeof ANIMATED_UNITS)[number];

/**
 * アニメーション対応ユニットのSet（O(1)検索用）
 */
const ANIMATED_UNITS_SET = new Set<string>(ANIMATED_UNITS);

/**
 * ユニットがアニメーション対応かどうかをチェック
 * Set を使用して O(1) で検索
 */
export function hasAnimation(unitId: string): boolean {
    return ANIMATED_UNITS_SET.has(unitId);
}

/**
 * ユニットIDとレアリティからスプライトパスを取得
 * 新しいフォルダ構造:
 * - /assets/sprites/allies/{rarity}/{id}.webp - 味方ユニット
 * - /assets/sprites/enemies/{id}.webp - 敵ユニット
 * - /assets/sprites/bosses/{id}.webp - ボス
 * - /assets/sprites/common/{id}.webp - 城など共通アセット
 * - /assets/sprites/sheets/{id}_sheet.webp - スプライトシート
 */
export function getSpritePath(id: string, rarity?: Rarity): string {
    if (id.startsWith('enemy_')) {
        return `/assets/sprites/enemies/${id}.webp`;
    }
    if (id.startsWith('boss_')) {
        return `/assets/sprites/bosses/${id}.webp`;
    }
    if (id.startsWith('castle_')) {
        return `/assets/sprites/common/${id}.webp`;
    }
    // 味方ユニットはレアリティ別フォルダ
    if (rarity) {
        return `/assets/sprites/allies/${rarity}/${id}.webp`;
    }
    // レアリティ不明の場合はフォールバック
    return `/assets/sprites/sheets/${id}`;
}

/**
 * スプライトシートのパスを取得
 */
export function getSheetPath(id: string): { image: string; json: string } {
    return {
        image: `/assets/sprites/sheets/${id}_sheet.webp`,
        json: `/assets/sprites/sheets/${id}_sheet.json`
    };
}
