/**
 * 全ステージの敵配置をコンセプトに合わせて再構築
 */

const fs = require('fs');
const path = require('path');

const world1Path = path.join(__dirname, '../src/data/stages/normal.json');
const world2Path = path.join(__dirname, '../src/data/stages/world2.json');
const enemiesPath = path.join(__dirname, '../src/data/units/enemies.json');

let world1 = JSON.parse(fs.readFileSync(world1Path, 'utf8'));
let world2 = JSON.parse(fs.readFileSync(world2Path, 'utf8'));
const enemies = JSON.parse(fs.readFileSync(enemiesPath, 'utf8'));

// 敵のパワーマップ
const enemyPower = {};
enemies.forEach(e => {
    const power = Math.round((e.maxHp || 0) * 0.001 + (e.attackDamage || 0) * 0.5 + (e.speed || 0) * 2);
    enemyPower[e.id] = power;
});

// ============================================
// エリアごとのコンセプトと使用敵
// ============================================

const AREA_ENEMIES = {
    // tutorial: 森の入門 - 野菜・果物・小動物
    tutorial: [
        'enemy_acorn',      // どんぐり (166)
        'enemy_sunflower',  // ひまわり (109)
        'enemy_mushroom',   // きのこ (129)
        'enemy_n_apple',    // りんご (136)
        'enemy_n_pumpkin',  // かぼちゃ (104)
        'enemy_frog',       // かえる (120)
        'enemy_corn_kid',   // とうもろこし (180)
    ],

    // easy: 森の冒険 - 自然系
    easy: [
        'enemy_n_strawberry', // いちご (149)
        'enemy_n_carrot',     // にんじん (152)
        'enemy_dog',          // 犬 (145)
        'enemy_root',         // 根っこ (98)
        'enemy_capybara',     // カピバラ (68)
        'enemy_bean',         // 豆 (75)
        'enemy_tomato',       // トマト (140)
        'enemy_dew',          // しずく (105)
        'enemy_pebble',       // 小石 (54)
    ],

    // normal: 戦いの始まり - 野菜戦士系
    normal: [
        'enemy_cat_warrior',   // 猫戦士 (165)
        'enemy_archer',        // 弓使い (140)
        'enemy_r_broccoli',    // ブロッコリー (108)
        'enemy_r_lemon',       // レモン (150)
        'enemy_r_cherry',      // さくらんぼ (176)
        'enemy_pepper',        // 唐辛子 (175)
        'enemy_watermelon',    // スイカ (151)
        'enemy_corn',          // コーン戦士 (166)
        'enemy_n_cherry_bomb', // チェリー爆弾 (225)
        'enemy_fire_chili',    // ファイアチリ (208)
    ],

    // frozen: 氷の世界 - 氷・雪系
    frozen: [
        'enemy_ice_flower',   // 氷の花 (131)
        'enemy_ice_samurai',  // 氷侍 (822)
        'enemy_penguin',      // ペンギン (365)
        'enemy_block',        // ブロック (45)
        'enemy_dew',          // しずく (105)
        'enemy_cat_tank',     // タンク (112)
        'enemy_sr_bamboo',    // 竹メカ (202)
    ],

    // hard: 闘士の試練 - 戦士・忍者系
    hard: [
        'enemy_ninja',        // 忍者 (341)
        'enemy_leaf_ninja',   // 葉忍者 (300)
        'enemy_wolf',         // 狼 (211)
        'enemy_crow',         // カラス (230)
        'enemy_sr_bamboo',    // 竹メカ (202)
        'enemy_sr_pirate',    // 海賊 (221)
        'enemy_sr_rose',      // 薔薇英雄 (251)
        'enemy_mage',         // 魔法使い (316)
    ],

    // extreme: 極限の戦場 - エリート戦士
    extreme: [
        'enemy_sr_tulip',     // チューリップ (261)
        'enemy_sr_corn_tank', // コーンタンク (198)
        'enemy_ribbon',       // リボン (534)
        'enemy_ur_archer',    // URアーチャー (1315)
        'enemy_ur_ninja',     // UR忍者 (1661)
        'enemy_ur_healer',    // URヒーラー (899)
        'enemy_ninja',        // 忍者 (341)
        'enemy_leaf_ninja',   // 葉忍者 (300)
    ],

    // nightmare: 悪夢の世界 - 悪夢・闘士系
    nightmare: [
        'enemy_nika',           // ニカ (619)
        'enemy_yumemi',         // ゆめみ (723)
        'enemy_flame_knight',   // 炎騎士 (1223)
        'enemy_ur_golem',       // ゴーレム (1256)
        'enemy_lennon',         // レノン (854)
        'enemy_ribbon',         // リボン (534)
        'enemy_sr_tulip',       // チューリップ (261)
        'enemy_mage',           // 魔法使い (316)
    ],

    // purgatory: 煉獄 - 炎・地獄系
    purgatory: [
        'enemy_ur_phoenix',       // フェニックス (1646)
        'enemy_flame_knight',     // 炎騎士 (1223)
        'enemy_shadow_assassin',  // 影暗殺者 (1628)
        'enemy_ur_dragon',        // ドラゴン (2382)
        'enemy_ur_knight',        // URナイト (1388)
        'enemy_ur_mage',          // UR魔法使い (1615)
        'enemy_lennon',           // レノン (854)
    ],

    // hellfire: 地獄炎 - 地獄系
    hellfire: [
        'enemy_ur_dragon',        // ドラゴン (2382)
        'enemy_ur_phoenix',       // フェニックス (1646)
        'enemy_ur_mage',          // UR魔法使い (1615)
        'enemy_ur_angel',         // UR天使 (1447)
        'enemy_shadow_assassin',  // 影暗殺者 (1628)
        'enemy_flame_knight',     // 炎騎士 (1223)
        'enemy_ur_knight',        // URナイト (1388)
    ],

    // abyss: 深淵 - 暗黒・深淵系
    abyss: [
        'enemy_ur_dragon',        // ドラゴン (2382)
        'enemy_ur_angel',         // UR天使 (1447)
        'enemy_shadow_assassin',  // 影暗殺者 (1628)
        'enemy_ur_tank',          // URタンク (985)
        'enemy_ur_golem',         // ゴーレム (1256)
        'enemy_ur_mage',          // UR魔法使い (1615)
        'enemy_ur_phoenix',       // フェニックス (1646)
    ],

    // inferno_boss: インフェルノボス - 最強の敵
    inferno_boss: [
        'enemy_ur_dragon',        // ドラゴン (2382)
        'enemy_ur_mage',          // UR魔法使い (1615)
        'enemy_ur_angel',         // UR天使 (1447)
        'enemy_ur_tank',          // URタンク (985)
        'enemy_ur_phoenix',       // フェニックス (1646)
        'enemy_shadow_assassin',  // 影暗殺者 (1628)
        'enemy_ur_golem',         // ゴーレム (1256)
    ],
};

// ============================================
// ウェーブ生成関数
// ============================================

function generateWaves(stage, areaEnemies) {
    const difficulty = stage.difficulty;
    const stageId = stage.id;
    const isBoss = stage.isBossStage || stageId.includes('boss');

    // 難易度別パラメータ
    const params = {
        tutorial:     { waveCount: [3, 5],  enemyCount: [15, 25],  interval: [1800, 2200], startTime: 3000 },
        easy:         { waveCount: [5, 7],  enemyCount: [30, 45],  interval: [1400, 1800], startTime: 3000 },
        normal:       { waveCount: [6, 8],  enemyCount: [40, 55],  interval: [1200, 1600], startTime: 2500 },
        frozen:       { waveCount: [6, 9],  enemyCount: [45, 65],  interval: [1100, 1500], startTime: 2500 },
        hard:         { waveCount: [7, 10], enemyCount: [60, 85],  interval: [1000, 1400], startTime: 2000 },
        extreme:      { waveCount: [8, 12], enemyCount: [80, 115], interval: [900, 1300],  startTime: 2000 },
        nightmare:    { waveCount: [8, 12], enemyCount: [120, 170], interval: [800, 1200], startTime: 2000 },
        purgatory:    { waveCount: [7, 10], enemyCount: [180, 220], interval: [700, 1100], startTime: 1500 },
        hellfire:     { waveCount: [7, 10], enemyCount: [240, 300], interval: [600, 1000], startTime: 1500 },
        abyss:        { waveCount: [7, 10], enemyCount: [320, 380], interval: [500, 900],  startTime: 1500 },
        inferno_boss: { waveCount: [8, 12], enemyCount: [420, 500], interval: [400, 800],  startTime: 1500 },
    };

    const p = params[difficulty] || params.normal;

    // ウェーブ数と総敵数を決定
    const waveCount = isBoss
        ? p.waveCount[1] + 2
        : Math.floor(Math.random() * (p.waveCount[1] - p.waveCount[0] + 1)) + p.waveCount[0];

    const totalEnemies = isBoss
        ? Math.floor((p.enemyCount[0] + p.enemyCount[1]) / 2 * 0.8)
        : Math.floor(Math.random() * (p.enemyCount[1] - p.enemyCount[0] + 1)) + p.enemyCount[0];

    const waves = [];
    let timeMs = p.startTime;
    let remainingEnemies = totalEnemies;

    // 敵をパワー順にソート
    const sortedEnemies = areaEnemies
        .filter(id => enemyPower[id] !== undefined)
        .sort((a, b) => (enemyPower[a] || 0) - (enemyPower[b] || 0));

    if (sortedEnemies.length === 0) {
        console.log('  ⚠️ ' + stageId + ': 有効な敵がありません');
        return stage.enemyWaves; // 元のまま
    }

    for (let i = 0; i < waveCount && remainingEnemies > 0; i++) {
        // 進行度に応じて敵を選択（後半ほど強い敵）
        const progress = i / waveCount;
        const enemyIndex = Math.min(
            Math.floor(progress * sortedEnemies.length * 0.9),
            sortedEnemies.length - 1
        );

        // 少しランダム性を加える
        const randomOffset = Math.floor(Math.random() * 2) - 1;
        const finalIndex = Math.max(0, Math.min(sortedEnemies.length - 1, enemyIndex + randomOffset));
        const unitId = sortedEnemies[finalIndex];

        // ウェーブごとの敵数
        const baseCount = Math.ceil(remainingEnemies / (waveCount - i));
        const variance = Math.floor(baseCount * 0.3);
        const count = Math.max(1, baseCount + Math.floor(Math.random() * variance * 2) - variance);

        // スポーン間隔
        const interval = Math.floor(
            p.interval[0] + Math.random() * (p.interval[1] - p.interval[0])
        );

        waves.push({
            timeMs: timeMs,
            unitId: unitId,
            count: Math.min(count, remainingEnemies),
            intervalMs: interval
        });

        remainingEnemies -= count;
        timeMs += count * interval + 2000 + Math.floor(Math.random() * 3000);
    }

    // ボスステージの場合、ボスを最後に追加
    if (isBoss) {
        const bossId = getBossForStage(stageId, difficulty);
        if (bossId) {
            waves.push({
                timeMs: timeMs + 5000,
                unitId: bossId,
                count: 1,
                intervalMs: 1000
            });
        }
    }

    return waves;
}

function getBossForStage(stageId, difficulty) {
    const bossMap = {
        'tutorial_boss': 'boss_tutorial',
        'easy_boss': 'boss_easy',
        'normal_boss': 'boss_normal',
        'frozen_boss': 'boss_frozen',
        'hard_boss': 'boss_hard',
        'extreme_boss': 'boss_extreme',
        'nightmare_boss': 'boss_nightmare',
        'purgatory_boss': 'boss_purgatory',
        'hellfire_boss': 'boss_hellfire',
        'abyss_boss': 'boss_abyss',
        'inferno_boss_1': 'boss_inferno_1',
        'inferno_boss_2': 'boss_inferno_2',
        'inferno_boss_3': 'boss_inferno_3',
        'inferno_boss_4': 'boss_inferno_4',
        'inferno_boss_5': 'boss_inferno_final',
    };
    return bossMap[stageId] || null;
}

// ============================================
// メイン処理
// ============================================

console.log('\n=======================================================================');
console.log('           全ステージ敵配置の再構築');
console.log('=======================================================================\n');

let updatedCount = 0;

// World 1
world1.forEach(stage => {
    const areaEnemies = AREA_ENEMIES[stage.difficulty];
    if (areaEnemies) {
        const oldWaveCount = stage.enemyWaves.length;
        stage.enemyWaves = generateWaves(stage, areaEnemies);
        const newWaveCount = stage.enemyWaves.length;
        console.log('  ✅ ' + stage.id.padEnd(18) + ' | ' + stage.difficulty.padEnd(12) + ' | ' + oldWaveCount + ' → ' + newWaveCount + ' waves');
        updatedCount++;
    }
});

// World 2
world2.forEach(stage => {
    const areaEnemies = AREA_ENEMIES[stage.difficulty];
    if (areaEnemies) {
        const oldWaveCount = stage.enemyWaves.length;
        stage.enemyWaves = generateWaves(stage, areaEnemies);
        const newWaveCount = stage.enemyWaves.length;
        console.log('  ✅ ' + stage.id.padEnd(18) + ' | ' + stage.difficulty.padEnd(12) + ' | ' + oldWaveCount + ' → ' + newWaveCount + ' waves');
        updatedCount++;
    }
});

// 保存
fs.writeFileSync(world1Path, JSON.stringify(world1, null, 2));
fs.writeFileSync(world2Path, JSON.stringify(world2, null, 2));

console.log('\n-----------------------------------------------------------------------');
console.log('再構築完了: ' + updatedCount + ' ステージを更新');
console.log('-----------------------------------------------------------------------\n');

console.log('バランス確認: node scripts/stage_strength_analyzer.js');
console.log('敵使用確認:   node scripts/analyze_enemy_usage.js');
console.log('');
