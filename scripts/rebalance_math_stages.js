/**
 * 算数バトルのステージを4-8歳向けに再バランス
 */

const fs = require('fs');
const path = require('path');

const stagesPath = path.join(__dirname, '../src/data/math-battle/stages.json');
const stages = JSON.parse(fs.readFileSync(stagesPath, 'utf8'));

console.log('\n=======================================================================');
console.log('           算数バトル 4-8歳向けリバランス');
console.log('=======================================================================\n');

// 敵キャラリスト（弱い順）
const enemies = {
    veryEasy: ['enemy_acorn', 'enemy_sunflower', 'enemy_mushroom', 'enemy_n_apple'],
    easy: ['enemy_frog', 'enemy_bean', 'enemy_capybara', 'enemy_pebble', 'enemy_dew'],
    normal: ['enemy_dog', 'enemy_tomato', 'enemy_root', 'enemy_cat_warrior'],
    hard: ['enemy_pepper', 'enemy_fire_chili', 'enemy_corn_kid', 'enemy_watermelon'],
    veryHard: ['enemy_ninja', 'enemy_mage', 'enemy_sr_rose', 'enemy_sr_bamboo']
};

// ============================================
// 足し算エリアの再設計（25ステージ）
// ============================================

const newAdditionStages = [
    // 4-5歳向け: 1-5の足し算（8ステージ）
    { id: 'add_1', stageNumber: 1, questionCount: 3, timeLimitMs: 90000, difficulty: { minNum1: 1, maxNum1: 3, minNum2: 1, maxNum2: 2 }, enemyId: enemies.veryEasy[0], reward: { coins: 30 } },
    { id: 'add_2', stageNumber: 2, questionCount: 3, timeLimitMs: 90000, difficulty: { minNum1: 1, maxNum1: 3, minNum2: 1, maxNum2: 3 }, enemyId: enemies.veryEasy[1], reward: { coins: 35 } },
    { id: 'add_3', stageNumber: 3, questionCount: 4, timeLimitMs: 80000, difficulty: { minNum1: 1, maxNum1: 4, minNum2: 1, maxNum2: 3 }, enemyId: enemies.veryEasy[2], reward: { coins: 40 } },
    { id: 'add_4', stageNumber: 4, questionCount: 4, timeLimitMs: 80000, difficulty: { minNum1: 1, maxNum1: 4, minNum2: 1, maxNum2: 4 }, enemyId: enemies.veryEasy[3], reward: { coins: 45 } },
    { id: 'add_5', stageNumber: 5, questionCount: 4, timeLimitMs: 75000, difficulty: { minNum1: 1, maxNum1: 5, minNum2: 1, maxNum2: 4 }, enemyId: enemies.easy[0], reward: { coins: 50 } },
    { id: 'add_6', stageNumber: 6, questionCount: 4, timeLimitMs: 75000, difficulty: { minNum1: 1, maxNum1: 5, minNum2: 1, maxNum2: 5 }, enemyId: enemies.easy[1], reward: { coins: 55 } },
    { id: 'add_7', stageNumber: 7, questionCount: 5, timeLimitMs: 75000, difficulty: { minNum1: 2, maxNum1: 5, minNum2: 2, maxNum2: 5 }, enemyId: enemies.easy[2], reward: { coins: 60 } },
    { id: 'add_8', stageNumber: 8, questionCount: 5, timeLimitMs: 70000, difficulty: { minNum1: 3, maxNum1: 5, minNum2: 3, maxNum2: 5 }, enemyId: enemies.easy[3], reward: { coins: 65 } },

    // 5-6歳向け: 1-10の足し算（6ステージ）
    { id: 'add_9', stageNumber: 9, questionCount: 5, timeLimitMs: 70000, difficulty: { minNum1: 1, maxNum1: 6, minNum2: 1, maxNum2: 6 }, enemyId: enemies.easy[4], reward: { coins: 70 } },
    { id: 'add_10', stageNumber: 10, questionCount: 5, timeLimitMs: 65000, difficulty: { minNum1: 1, maxNum1: 7, minNum2: 1, maxNum2: 7 }, enemyId: enemies.normal[0], reward: { coins: 75 } },
    { id: 'add_11', stageNumber: 11, questionCount: 5, timeLimitMs: 65000, difficulty: { minNum1: 1, maxNum1: 8, minNum2: 1, maxNum2: 8 }, enemyId: enemies.normal[1], reward: { coins: 80 } },
    { id: 'add_12', stageNumber: 12, questionCount: 5, timeLimitMs: 60000, difficulty: { minNum1: 1, maxNum1: 9, minNum2: 1, maxNum2: 9 }, enemyId: enemies.normal[2], reward: { coins: 85 } },
    { id: 'add_13', stageNumber: 13, questionCount: 6, timeLimitMs: 60000, difficulty: { minNum1: 2, maxNum1: 9, minNum2: 2, maxNum2: 9 }, enemyId: enemies.normal[3], reward: { coins: 90 } },
    { id: 'add_14', stageNumber: 14, questionCount: 6, timeLimitMs: 60000, difficulty: { minNum1: 1, maxNum1: 10, minNum2: 1, maxNum2: 10 }, enemyId: enemies.hard[0], reward: { coins: 95 } },

    // 6-7歳向け: 繰り上がり、11-20（5ステージ）
    { id: 'add_15', stageNumber: 15, questionCount: 6, timeLimitMs: 55000, difficulty: { minNum1: 5, maxNum1: 12, minNum2: 3, maxNum2: 10 }, enemyId: enemies.hard[1], reward: { coins: 100 } },
    { id: 'add_16', stageNumber: 16, questionCount: 6, timeLimitMs: 55000, difficulty: { minNum1: 8, maxNum1: 15, minNum2: 5, maxNum2: 12 }, enemyId: enemies.hard[2], reward: { coins: 105 } },
    { id: 'add_17', stageNumber: 17, questionCount: 6, timeLimitMs: 55000, difficulty: { minNum1: 10, maxNum1: 18, minNum2: 5, maxNum2: 15 }, enemyId: enemies.hard[3], reward: { coins: 110 } },
    { id: 'add_18', stageNumber: 18, questionCount: 6, timeLimitMs: 50000, difficulty: { minNum1: 10, maxNum1: 20, minNum2: 5, maxNum2: 15 }, enemyId: enemies.veryHard[0], reward: { coins: 115 } },
    { id: 'add_19', stageNumber: 19, questionCount: 7, timeLimitMs: 50000, difficulty: { minNum1: 10, maxNum1: 20, minNum2: 10, maxNum2: 20 }, enemyId: enemies.veryHard[1], reward: { coins: 120 } },

    // 7-8歳向け: 2桁の足し算（5ステージ）
    { id: 'add_20', stageNumber: 20, questionCount: 7, timeLimitMs: 50000, difficulty: { minNum1: 15, maxNum1: 30, minNum2: 10, maxNum2: 25 }, enemyId: enemies.veryHard[2], reward: { coins: 130 } },
    { id: 'add_21', stageNumber: 21, questionCount: 7, timeLimitMs: 50000, difficulty: { minNum1: 20, maxNum1: 40, minNum2: 15, maxNum2: 35 }, enemyId: enemies.veryHard[3], reward: { coins: 140 } },
    { id: 'add_22', stageNumber: 22, questionCount: 7, timeLimitMs: 45000, difficulty: { minNum1: 25, maxNum1: 50, minNum2: 20, maxNum2: 45 }, enemyId: 'enemy_sr_pirate', reward: { coins: 150 } },
    { id: 'add_23', stageNumber: 23, questionCount: 8, timeLimitMs: 45000, difficulty: { minNum1: 30, maxNum1: 60, minNum2: 25, maxNum2: 55 }, enemyId: 'enemy_sr_tulip', reward: { coins: 160 } },
    { id: 'add_24', stageNumber: 24, questionCount: 8, timeLimitMs: 45000, difficulty: { minNum1: 40, maxNum1: 80, minNum2: 30, maxNum2: 70 }, enemyId: 'enemy_ribbon', reward: { coins: 170 } },

    // ボス
    { id: 'add_boss', stageNumber: 25, isBoss: true, questionCount: 8, timeLimitMs: 120000, difficulty: { minNum1: 50, maxNum1: 99, minNum2: 30, maxNum2: 80 }, enemyId: 'boss_tutorial', reward: { coins: 300 } }
];

// ============================================
// 引き算エリアの再設計（25ステージ）
// ============================================

const newSubtractionStages = [
    // 5-6歳向け: 10以下の引き算（8ステージ）
    { id: 'sub_1', stageNumber: 1, questionCount: 3, timeLimitMs: 90000, difficulty: { minNum1: 3, maxNum1: 5, minNum2: 1, maxNum2: 2 }, enemyId: enemies.veryEasy[0], reward: { coins: 40 } },
    { id: 'sub_2', stageNumber: 2, questionCount: 3, timeLimitMs: 90000, difficulty: { minNum1: 4, maxNum1: 6, minNum2: 1, maxNum2: 3 }, enemyId: enemies.veryEasy[1], reward: { coins: 45 } },
    { id: 'sub_3', stageNumber: 3, questionCount: 4, timeLimitMs: 80000, difficulty: { minNum1: 5, maxNum1: 7, minNum2: 1, maxNum2: 4 }, enemyId: enemies.veryEasy[2], reward: { coins: 50 } },
    { id: 'sub_4', stageNumber: 4, questionCount: 4, timeLimitMs: 80000, difficulty: { minNum1: 5, maxNum1: 8, minNum2: 1, maxNum2: 5 }, enemyId: enemies.veryEasy[3], reward: { coins: 55 } },
    { id: 'sub_5', stageNumber: 5, questionCount: 4, timeLimitMs: 75000, difficulty: { minNum1: 6, maxNum1: 9, minNum2: 1, maxNum2: 5 }, enemyId: enemies.easy[0], reward: { coins: 60 } },
    { id: 'sub_6', stageNumber: 6, questionCount: 5, timeLimitMs: 75000, difficulty: { minNum1: 6, maxNum1: 10, minNum2: 1, maxNum2: 6 }, enemyId: enemies.easy[1], reward: { coins: 65 } },
    { id: 'sub_7', stageNumber: 7, questionCount: 5, timeLimitMs: 70000, difficulty: { minNum1: 7, maxNum1: 10, minNum2: 2, maxNum2: 7 }, enemyId: enemies.easy[2], reward: { coins: 70 } },
    { id: 'sub_8', stageNumber: 8, questionCount: 5, timeLimitMs: 70000, difficulty: { minNum1: 8, maxNum1: 10, minNum2: 2, maxNum2: 8 }, enemyId: enemies.easy[3], reward: { coins: 75 } },

    // 6-7歳向け: 繰り下がり、11-20（8ステージ）
    { id: 'sub_9', stageNumber: 9, questionCount: 5, timeLimitMs: 65000, difficulty: { minNum1: 10, maxNum1: 12, minNum2: 1, maxNum2: 5 }, enemyId: enemies.easy[4], reward: { coins: 80 } },
    { id: 'sub_10', stageNumber: 10, questionCount: 5, timeLimitMs: 65000, difficulty: { minNum1: 10, maxNum1: 14, minNum2: 2, maxNum2: 7 }, enemyId: enemies.normal[0], reward: { coins: 85 } },
    { id: 'sub_11', stageNumber: 11, questionCount: 5, timeLimitMs: 60000, difficulty: { minNum1: 11, maxNum1: 15, minNum2: 3, maxNum2: 8 }, enemyId: enemies.normal[1], reward: { coins: 90 } },
    { id: 'sub_12', stageNumber: 12, questionCount: 6, timeLimitMs: 60000, difficulty: { minNum1: 12, maxNum1: 16, minNum2: 4, maxNum2: 9 }, enemyId: enemies.normal[2], reward: { coins: 95 } },
    { id: 'sub_13', stageNumber: 13, questionCount: 6, timeLimitMs: 60000, difficulty: { minNum1: 13, maxNum1: 18, minNum2: 5, maxNum2: 10 }, enemyId: enemies.normal[3], reward: { coins: 100 } },
    { id: 'sub_14', stageNumber: 14, questionCount: 6, timeLimitMs: 55000, difficulty: { minNum1: 14, maxNum1: 18, minNum2: 5, maxNum2: 12 }, enemyId: enemies.hard[0], reward: { coins: 105 } },
    { id: 'sub_15', stageNumber: 15, questionCount: 6, timeLimitMs: 55000, difficulty: { minNum1: 15, maxNum1: 20, minNum2: 6, maxNum2: 13 }, enemyId: enemies.hard[1], reward: { coins: 110 } },
    { id: 'sub_16', stageNumber: 16, questionCount: 6, timeLimitMs: 55000, difficulty: { minNum1: 15, maxNum1: 20, minNum2: 8, maxNum2: 15 }, enemyId: enemies.hard[2], reward: { coins: 115 } },

    // 7-8歳向け: 2桁の引き算（8ステージ）
    { id: 'sub_17', stageNumber: 17, questionCount: 6, timeLimitMs: 50000, difficulty: { minNum1: 20, maxNum1: 30, minNum2: 5, maxNum2: 15 }, enemyId: enemies.hard[3], reward: { coins: 120 } },
    { id: 'sub_18', stageNumber: 18, questionCount: 6, timeLimitMs: 50000, difficulty: { minNum1: 25, maxNum1: 40, minNum2: 10, maxNum2: 20 }, enemyId: enemies.veryHard[0], reward: { coins: 130 } },
    { id: 'sub_19', stageNumber: 19, questionCount: 7, timeLimitMs: 50000, difficulty: { minNum1: 30, maxNum1: 50, minNum2: 10, maxNum2: 25 }, enemyId: enemies.veryHard[1], reward: { coins: 140 } },
    { id: 'sub_20', stageNumber: 20, questionCount: 7, timeLimitMs: 50000, difficulty: { minNum1: 35, maxNum1: 60, minNum2: 15, maxNum2: 35 }, enemyId: enemies.veryHard[2], reward: { coins: 150 } },
    { id: 'sub_21', stageNumber: 21, questionCount: 7, timeLimitMs: 45000, difficulty: { minNum1: 40, maxNum1: 70, minNum2: 15, maxNum2: 40 }, enemyId: enemies.veryHard[3], reward: { coins: 160 } },
    { id: 'sub_22', stageNumber: 22, questionCount: 7, timeLimitMs: 45000, difficulty: { minNum1: 50, maxNum1: 80, minNum2: 20, maxNum2: 50 }, enemyId: 'enemy_sr_pirate', reward: { coins: 170 } },
    { id: 'sub_23', stageNumber: 23, questionCount: 8, timeLimitMs: 45000, difficulty: { minNum1: 60, maxNum1: 90, minNum2: 25, maxNum2: 60 }, enemyId: 'enemy_sr_tulip', reward: { coins: 180 } },
    { id: 'sub_24', stageNumber: 24, questionCount: 8, timeLimitMs: 45000, difficulty: { minNum1: 70, maxNum1: 99, minNum2: 30, maxNum2: 70 }, enemyId: 'enemy_ribbon', reward: { coins: 190 } },

    // ボス
    { id: 'sub_boss', stageNumber: 25, isBoss: true, questionCount: 8, timeLimitMs: 120000, difficulty: { minNum1: 80, maxNum1: 99, minNum2: 30, maxNum2: 75 }, enemyId: 'boss_easy', reward: { coins: 350 } }
];

// ============================================
// 掛け算エリアの再設計（25ステージ）
// ============================================

const newMultiplicationStages = [
    // 6-7歳向け: 2,3,4,5の段（10ステージ）
    { id: 'mul_1', stageNumber: 1, questionCount: 4, timeLimitMs: 80000, difficulty: { minNum1: 1, maxNum1: 2, minNum2: 1, maxNum2: 5 }, enemyId: enemies.easy[0], reward: { coins: 50 } },
    { id: 'mul_2', stageNumber: 2, questionCount: 4, timeLimitMs: 80000, difficulty: { minNum1: 1, maxNum1: 2, minNum2: 1, maxNum2: 9 }, enemyId: enemies.easy[1], reward: { coins: 55 } },
    { id: 'mul_3', stageNumber: 3, questionCount: 4, timeLimitMs: 75000, difficulty: { minNum1: 1, maxNum1: 3, minNum2: 1, maxNum2: 5 }, enemyId: enemies.easy[2], reward: { coins: 60 } },
    { id: 'mul_4', stageNumber: 4, questionCount: 5, timeLimitMs: 75000, difficulty: { minNum1: 1, maxNum1: 3, minNum2: 1, maxNum2: 9 }, enemyId: enemies.easy[3], reward: { coins: 65 } },
    { id: 'mul_5', stageNumber: 5, questionCount: 5, timeLimitMs: 70000, difficulty: { minNum1: 1, maxNum1: 4, minNum2: 1, maxNum2: 5 }, enemyId: enemies.easy[4], reward: { coins: 70 } },
    { id: 'mul_6', stageNumber: 6, questionCount: 5, timeLimitMs: 70000, difficulty: { minNum1: 1, maxNum1: 4, minNum2: 1, maxNum2: 9 }, enemyId: enemies.normal[0], reward: { coins: 75 } },
    { id: 'mul_7', stageNumber: 7, questionCount: 5, timeLimitMs: 65000, difficulty: { minNum1: 1, maxNum1: 5, minNum2: 1, maxNum2: 5 }, enemyId: enemies.normal[1], reward: { coins: 80 } },
    { id: 'mul_8', stageNumber: 8, questionCount: 5, timeLimitMs: 65000, difficulty: { minNum1: 1, maxNum1: 5, minNum2: 1, maxNum2: 9 }, enemyId: enemies.normal[2], reward: { coins: 85 } },
    { id: 'mul_9', stageNumber: 9, questionCount: 6, timeLimitMs: 65000, difficulty: { minNum1: 2, maxNum1: 5, minNum2: 2, maxNum2: 5 }, enemyId: enemies.normal[3], reward: { coins: 90 } },
    { id: 'mul_10', stageNumber: 10, questionCount: 6, timeLimitMs: 60000, difficulty: { minNum1: 2, maxNum1: 5, minNum2: 2, maxNum2: 9 }, enemyId: enemies.hard[0], reward: { coins: 95 } },

    // 7-8歳向け: 6,7,8,9の段（10ステージ）
    { id: 'mul_11', stageNumber: 11, questionCount: 6, timeLimitMs: 60000, difficulty: { minNum1: 1, maxNum1: 6, minNum2: 1, maxNum2: 9 }, enemyId: enemies.hard[1], reward: { coins: 100 } },
    { id: 'mul_12', stageNumber: 12, questionCount: 6, timeLimitMs: 55000, difficulty: { minNum1: 1, maxNum1: 7, minNum2: 1, maxNum2: 9 }, enemyId: enemies.hard[2], reward: { coins: 105 } },
    { id: 'mul_13', stageNumber: 13, questionCount: 6, timeLimitMs: 55000, difficulty: { minNum1: 1, maxNum1: 8, minNum2: 1, maxNum2: 9 }, enemyId: enemies.hard[3], reward: { coins: 110 } },
    { id: 'mul_14', stageNumber: 14, questionCount: 6, timeLimitMs: 55000, difficulty: { minNum1: 1, maxNum1: 9, minNum2: 1, maxNum2: 9 }, enemyId: enemies.veryHard[0], reward: { coins: 115 } },
    { id: 'mul_15', stageNumber: 15, questionCount: 7, timeLimitMs: 55000, difficulty: { minNum1: 2, maxNum1: 9, minNum2: 2, maxNum2: 9 }, enemyId: enemies.veryHard[1], reward: { coins: 120 } },
    { id: 'mul_16', stageNumber: 16, questionCount: 7, timeLimitMs: 50000, difficulty: { minNum1: 3, maxNum1: 9, minNum2: 3, maxNum2: 9 }, enemyId: enemies.veryHard[2], reward: { coins: 125 } },
    { id: 'mul_17', stageNumber: 17, questionCount: 7, timeLimitMs: 50000, difficulty: { minNum1: 4, maxNum1: 9, minNum2: 4, maxNum2: 9 }, enemyId: enemies.veryHard[3], reward: { coins: 130 } },
    { id: 'mul_18', stageNumber: 18, questionCount: 7, timeLimitMs: 50000, difficulty: { minNum1: 5, maxNum1: 9, minNum2: 5, maxNum2: 9 }, enemyId: 'enemy_sr_pirate', reward: { coins: 135 } },
    { id: 'mul_19', stageNumber: 19, questionCount: 7, timeLimitMs: 50000, difficulty: { minNum1: 6, maxNum1: 9, minNum2: 6, maxNum2: 9 }, enemyId: 'enemy_sr_tulip', reward: { coins: 140 } },
    { id: 'mul_20', stageNumber: 20, questionCount: 8, timeLimitMs: 50000, difficulty: { minNum1: 7, maxNum1: 9, minNum2: 7, maxNum2: 9 }, enemyId: 'enemy_ribbon', reward: { coins: 145 } },

    // チャレンジ（4ステージ）
    { id: 'mul_21', stageNumber: 21, questionCount: 8, timeLimitMs: 50000, difficulty: { minNum1: 1, maxNum1: 9, minNum2: 1, maxNum2: 9 }, enemyId: 'enemy_yumemi', reward: { coins: 150 } },
    { id: 'mul_22', stageNumber: 22, questionCount: 8, timeLimitMs: 45000, difficulty: { minNum1: 2, maxNum1: 9, minNum2: 2, maxNum2: 9 }, enemyId: 'enemy_nika', reward: { coins: 160 } },
    { id: 'mul_23', stageNumber: 23, questionCount: 8, timeLimitMs: 45000, difficulty: { minNum1: 3, maxNum1: 9, minNum2: 3, maxNum2: 9 }, enemyId: 'enemy_lennon', reward: { coins: 170 } },
    { id: 'mul_24', stageNumber: 24, questionCount: 8, timeLimitMs: 45000, difficulty: { minNum1: 5, maxNum1: 9, minNum2: 5, maxNum2: 9 }, enemyId: 'enemy_penguin', reward: { coins: 180 } },

    // ボス
    { id: 'mul_boss', stageNumber: 25, isBoss: true, questionCount: 10, timeLimitMs: 120000, difficulty: { minNum1: 1, maxNum1: 9, minNum2: 1, maxNum2: 9 }, enemyId: 'boss_normal', reward: { coins: 400 } }
];

// ============================================
// 割り算エリアの再設計（25ステージ）
// ============================================

const newDivisionStages = [
    // 7-8歳向け: 2,3,4,5で割る（12ステージ）
    { id: 'div_1', stageNumber: 1, questionCount: 4, timeLimitMs: 80000, difficulty: { minNum1: 1, maxNum1: 2, minNum2: 1, maxNum2: 5 }, enemyId: enemies.easy[0], reward: { coins: 60 } },
    { id: 'div_2', stageNumber: 2, questionCount: 4, timeLimitMs: 80000, difficulty: { minNum1: 1, maxNum1: 2, minNum2: 1, maxNum2: 9 }, enemyId: enemies.easy[1], reward: { coins: 65 } },
    { id: 'div_3', stageNumber: 3, questionCount: 4, timeLimitMs: 75000, difficulty: { minNum1: 1, maxNum1: 3, minNum2: 1, maxNum2: 5 }, enemyId: enemies.easy[2], reward: { coins: 70 } },
    { id: 'div_4', stageNumber: 4, questionCount: 5, timeLimitMs: 75000, difficulty: { minNum1: 1, maxNum1: 3, minNum2: 1, maxNum2: 9 }, enemyId: enemies.easy[3], reward: { coins: 75 } },
    { id: 'div_5', stageNumber: 5, questionCount: 5, timeLimitMs: 70000, difficulty: { minNum1: 1, maxNum1: 4, minNum2: 1, maxNum2: 5 }, enemyId: enemies.easy[4], reward: { coins: 80 } },
    { id: 'div_6', stageNumber: 6, questionCount: 5, timeLimitMs: 70000, difficulty: { minNum1: 1, maxNum1: 4, minNum2: 1, maxNum2: 9 }, enemyId: enemies.normal[0], reward: { coins: 85 } },
    { id: 'div_7', stageNumber: 7, questionCount: 5, timeLimitMs: 65000, difficulty: { minNum1: 1, maxNum1: 5, minNum2: 1, maxNum2: 5 }, enemyId: enemies.normal[1], reward: { coins: 90 } },
    { id: 'div_8', stageNumber: 8, questionCount: 5, timeLimitMs: 65000, difficulty: { minNum1: 1, maxNum1: 5, minNum2: 1, maxNum2: 9 }, enemyId: enemies.normal[2], reward: { coins: 95 } },
    { id: 'div_9', stageNumber: 9, questionCount: 6, timeLimitMs: 65000, difficulty: { minNum1: 2, maxNum1: 5, minNum2: 2, maxNum2: 5 }, enemyId: enemies.normal[3], reward: { coins: 100 } },
    { id: 'div_10', stageNumber: 10, questionCount: 6, timeLimitMs: 60000, difficulty: { minNum1: 2, maxNum1: 5, minNum2: 2, maxNum2: 9 }, enemyId: enemies.hard[0], reward: { coins: 105 } },
    { id: 'div_11', stageNumber: 11, questionCount: 6, timeLimitMs: 60000, difficulty: { minNum1: 2, maxNum1: 6, minNum2: 2, maxNum2: 9 }, enemyId: enemies.hard[1], reward: { coins: 110 } },
    { id: 'div_12', stageNumber: 12, questionCount: 6, timeLimitMs: 55000, difficulty: { minNum1: 2, maxNum1: 7, minNum2: 2, maxNum2: 9 }, enemyId: enemies.hard[2], reward: { coins: 115 } },

    // 7-8歳向け: 6,7,8,9で割る（8ステージ）
    { id: 'div_13', stageNumber: 13, questionCount: 6, timeLimitMs: 55000, difficulty: { minNum1: 1, maxNum1: 8, minNum2: 1, maxNum2: 9 }, enemyId: enemies.hard[3], reward: { coins: 120 } },
    { id: 'div_14', stageNumber: 14, questionCount: 6, timeLimitMs: 55000, difficulty: { minNum1: 1, maxNum1: 9, minNum2: 1, maxNum2: 9 }, enemyId: enemies.veryHard[0], reward: { coins: 125 } },
    { id: 'div_15', stageNumber: 15, questionCount: 7, timeLimitMs: 55000, difficulty: { minNum1: 2, maxNum1: 9, minNum2: 2, maxNum2: 9 }, enemyId: enemies.veryHard[1], reward: { coins: 130 } },
    { id: 'div_16', stageNumber: 16, questionCount: 7, timeLimitMs: 50000, difficulty: { minNum1: 3, maxNum1: 9, minNum2: 3, maxNum2: 9 }, enemyId: enemies.veryHard[2], reward: { coins: 135 } },
    { id: 'div_17', stageNumber: 17, questionCount: 7, timeLimitMs: 50000, difficulty: { minNum1: 4, maxNum1: 9, minNum2: 4, maxNum2: 9 }, enemyId: enemies.veryHard[3], reward: { coins: 140 } },
    { id: 'div_18', stageNumber: 18, questionCount: 7, timeLimitMs: 50000, difficulty: { minNum1: 5, maxNum1: 9, minNum2: 5, maxNum2: 9 }, enemyId: 'enemy_sr_pirate', reward: { coins: 145 } },
    { id: 'div_19', stageNumber: 19, questionCount: 7, timeLimitMs: 50000, difficulty: { minNum1: 6, maxNum1: 9, minNum2: 6, maxNum2: 9 }, enemyId: 'enemy_sr_tulip', reward: { coins: 150 } },
    { id: 'div_20', stageNumber: 20, questionCount: 8, timeLimitMs: 50000, difficulty: { minNum1: 7, maxNum1: 9, minNum2: 7, maxNum2: 9 }, enemyId: 'enemy_ribbon', reward: { coins: 155 } },

    // チャレンジ（4ステージ）
    { id: 'div_21', stageNumber: 21, questionCount: 8, timeLimitMs: 50000, difficulty: { minNum1: 1, maxNum1: 9, minNum2: 1, maxNum2: 9 }, enemyId: 'enemy_yumemi', reward: { coins: 160 } },
    { id: 'div_22', stageNumber: 22, questionCount: 8, timeLimitMs: 45000, difficulty: { minNum1: 2, maxNum1: 9, minNum2: 2, maxNum2: 9 }, enemyId: 'enemy_nika', reward: { coins: 170 } },
    { id: 'div_23', stageNumber: 23, questionCount: 8, timeLimitMs: 45000, difficulty: { minNum1: 3, maxNum1: 9, minNum2: 3, maxNum2: 9 }, enemyId: 'enemy_lennon', reward: { coins: 180 } },
    { id: 'div_24', stageNumber: 24, questionCount: 8, timeLimitMs: 45000, difficulty: { minNum1: 5, maxNum1: 9, minNum2: 5, maxNum2: 9 }, enemyId: 'enemy_penguin', reward: { coins: 190 } },

    // ボス
    { id: 'div_boss', stageNumber: 25, isBoss: true, questionCount: 10, timeLimitMs: 120000, difficulty: { minNum1: 1, maxNum1: 9, minNum2: 1, maxNum2: 9 }, enemyId: 'boss_hard', reward: { coins: 450 } }
];

// ============================================
// ミックスエリアの再設計（25ステージ）
// ============================================

const newMixedStages = [
    // 易しい四則混合（10ステージ）
    { id: 'mix_1', stageNumber: 1, questionCount: 5, timeLimitMs: 80000, difficulty: { minNum1: 1, maxNum1: 5, minNum2: 1, maxNum2: 5 }, enemyId: enemies.normal[0], reward: { coins: 80 } },
    { id: 'mix_2', stageNumber: 2, questionCount: 5, timeLimitMs: 80000, difficulty: { minNum1: 1, maxNum1: 6, minNum2: 1, maxNum2: 6 }, enemyId: enemies.normal[1], reward: { coins: 90 } },
    { id: 'mix_3', stageNumber: 3, questionCount: 5, timeLimitMs: 75000, difficulty: { minNum1: 1, maxNum1: 7, minNum2: 1, maxNum2: 7 }, enemyId: enemies.normal[2], reward: { coins: 100 } },
    { id: 'mix_4', stageNumber: 4, questionCount: 6, timeLimitMs: 75000, difficulty: { minNum1: 1, maxNum1: 8, minNum2: 1, maxNum2: 8 }, enemyId: enemies.normal[3], reward: { coins: 110 } },
    { id: 'mix_5', stageNumber: 5, questionCount: 6, timeLimitMs: 70000, difficulty: { minNum1: 1, maxNum1: 9, minNum2: 1, maxNum2: 9 }, enemyId: enemies.hard[0], reward: { coins: 120 } },
    { id: 'mix_6', stageNumber: 6, questionCount: 6, timeLimitMs: 70000, difficulty: { minNum1: 2, maxNum1: 9, minNum2: 2, maxNum2: 9 }, enemyId: enemies.hard[1], reward: { coins: 130 } },
    { id: 'mix_7', stageNumber: 7, questionCount: 6, timeLimitMs: 65000, difficulty: { minNum1: 3, maxNum1: 9, minNum2: 3, maxNum2: 9 }, enemyId: enemies.hard[2], reward: { coins: 140 } },
    { id: 'mix_8', stageNumber: 8, questionCount: 7, timeLimitMs: 65000, difficulty: { minNum1: 4, maxNum1: 9, minNum2: 4, maxNum2: 9 }, enemyId: enemies.hard[3], reward: { coins: 150 } },
    { id: 'mix_9', stageNumber: 9, questionCount: 7, timeLimitMs: 60000, difficulty: { minNum1: 5, maxNum1: 9, minNum2: 5, maxNum2: 9 }, enemyId: enemies.veryHard[0], reward: { coins: 160 } },
    { id: 'mix_10', stageNumber: 10, questionCount: 7, timeLimitMs: 60000, difficulty: { minNum1: 6, maxNum1: 9, minNum2: 6, maxNum2: 9 }, enemyId: enemies.veryHard[1], reward: { coins: 170 } },

    // 標準四則混合（10ステージ）
    { id: 'mix_11', stageNumber: 11, questionCount: 7, timeLimitMs: 60000, difficulty: { minNum1: 1, maxNum1: 9, minNum2: 1, maxNum2: 9 }, enemyId: enemies.veryHard[2], reward: { coins: 180 } },
    { id: 'mix_12', stageNumber: 12, questionCount: 7, timeLimitMs: 55000, difficulty: { minNum1: 2, maxNum1: 9, minNum2: 2, maxNum2: 9 }, enemyId: enemies.veryHard[3], reward: { coins: 190 } },
    { id: 'mix_13', stageNumber: 13, questionCount: 8, timeLimitMs: 55000, difficulty: { minNum1: 5, maxNum1: 15, minNum2: 2, maxNum2: 9 }, enemyId: 'enemy_sr_pirate', reward: { coins: 200 } },
    { id: 'mix_14', stageNumber: 14, questionCount: 8, timeLimitMs: 55000, difficulty: { minNum1: 5, maxNum1: 20, minNum2: 2, maxNum2: 9 }, enemyId: 'enemy_sr_tulip', reward: { coins: 210 } },
    { id: 'mix_15', stageNumber: 15, questionCount: 8, timeLimitMs: 50000, difficulty: { minNum1: 10, maxNum1: 25, minNum2: 2, maxNum2: 9 }, enemyId: 'enemy_ribbon', reward: { coins: 220 } },
    { id: 'mix_16', stageNumber: 16, questionCount: 8, timeLimitMs: 50000, difficulty: { minNum1: 10, maxNum1: 30, minNum2: 2, maxNum2: 9 }, enemyId: 'enemy_yumemi', reward: { coins: 230 } },
    { id: 'mix_17', stageNumber: 17, questionCount: 8, timeLimitMs: 50000, difficulty: { minNum1: 15, maxNum1: 40, minNum2: 2, maxNum2: 9 }, enemyId: 'enemy_nika', reward: { coins: 240 } },
    { id: 'mix_18', stageNumber: 18, questionCount: 8, timeLimitMs: 50000, difficulty: { minNum1: 20, maxNum1: 50, minNum2: 2, maxNum2: 9 }, enemyId: 'enemy_lennon', reward: { coins: 250 } },
    { id: 'mix_19', stageNumber: 19, questionCount: 9, timeLimitMs: 50000, difficulty: { minNum1: 25, maxNum1: 60, minNum2: 3, maxNum2: 9 }, enemyId: 'enemy_penguin', reward: { coins: 260 } },
    { id: 'mix_20', stageNumber: 20, questionCount: 9, timeLimitMs: 50000, difficulty: { minNum1: 30, maxNum1: 70, minNum2: 3, maxNum2: 9 }, enemyId: 'enemy_ur_knight', reward: { coins: 270 } },

    // チャレンジ（4ステージ）
    { id: 'mix_21', stageNumber: 21, questionCount: 9, timeLimitMs: 50000, difficulty: { minNum1: 35, maxNum1: 80, minNum2: 4, maxNum2: 9 }, enemyId: 'enemy_ur_mage', reward: { coins: 280 } },
    { id: 'mix_22', stageNumber: 22, questionCount: 10, timeLimitMs: 50000, difficulty: { minNum1: 40, maxNum1: 90, minNum2: 5, maxNum2: 9 }, enemyId: 'enemy_ur_tank', reward: { coins: 290 } },
    { id: 'mix_23', stageNumber: 23, questionCount: 10, timeLimitMs: 50000, difficulty: { minNum1: 45, maxNum1: 99, minNum2: 5, maxNum2: 9 }, enemyId: 'boss_giant_king', reward: { coins: 300 } },
    { id: 'mix_24', stageNumber: 24, questionCount: 10, timeLimitMs: 50000, difficulty: { minNum1: 50, maxNum1: 99, minNum2: 6, maxNum2: 9 }, enemyId: 'boss_dragon', reward: { coins: 320 } },

    // ボス
    { id: 'mix_boss', stageNumber: 25, isBoss: true, questionCount: 12, timeLimitMs: 180000, difficulty: { minNum1: 50, maxNum1: 99, minNum2: 5, maxNum2: 9 }, enemyId: 'boss_mona', reward: { coins: 600 } }
];

// 共通のnameKeyとareaIdを追加
function addCommonProps(stages, areaId, nameKeyPrefix) {
    return stages.map(s => ({
        ...s,
        nameKey: s.isBoss ? 'mathBattle.stages.boss' : `mathBattle.stages.${nameKeyPrefix}${s.stageNumber}`,
        areaId: areaId,
        isBoss: s.isBoss || false
    }));
}

// ステージを更新
stages.areas[0].stages = addCommonProps(newAdditionStages, 'addition', 'add');
stages.areas[1].stages = addCommonProps(newSubtractionStages, 'subtraction', 'sub');
stages.areas[2].stages = addCommonProps(newMultiplicationStages, 'multiplication', 'mul');
stages.areas[3].stages = addCommonProps(newDivisionStages, 'division', 'div');
stages.areas[4].stages = addCommonProps(newMixedStages, 'mixed', 'mix');

// 必要スターを調整
stages.areas[0].requiredStars = 0;   // 足し算: 最初から
stages.areas[1].requiredStars = 20;  // 引き算: 20スター
stages.areas[2].requiredStars = 45;  // 掛け算: 45スター
stages.areas[3].requiredStars = 75;  // 割り算: 75スター
stages.areas[4].requiredStars = 120; // ミックス: 120スター

// 保存
fs.writeFileSync(stagesPath, JSON.stringify(stages, null, 2));

console.log('【更新内容】');
console.log('');
console.log('足し算エリア: 20ステージ → 25ステージ');
console.log('  - 4-5歳向け (1-5の足し算): 8ステージ');
console.log('  - 5-6歳向け (1-10の足し算): 6ステージ');
console.log('  - 6-7歳向け (繰り上がり): 5ステージ');
console.log('  - 7-8歳向け (2桁の足し算): 5ステージ + ボス');
console.log('');
console.log('引き算エリア: 20ステージ → 25ステージ');
console.log('  - 5-6歳向け (10以下): 8ステージ');
console.log('  - 6-7歳向け (繰り下がり): 8ステージ');
console.log('  - 7-8歳向け (2桁): 8ステージ + ボス');
console.log('');
console.log('掛け算エリア: 20ステージ → 25ステージ');
console.log('  - 6-7歳向け (2-5の段): 10ステージ');
console.log('  - 7-8歳向け (6-9の段): 10ステージ');
console.log('  - チャレンジ: 4ステージ + ボス');
console.log('');
console.log('割り算エリア: 20ステージ → 25ステージ');
console.log('  - 7-8歳向け (2-5で割る): 12ステージ');
console.log('  - 7-8歳向け (6-9で割る): 8ステージ');
console.log('  - チャレンジ: 4ステージ + ボス');
console.log('');
console.log('ミックスエリア: 20ステージ → 25ステージ');
console.log('  - 易しい四則混合: 10ステージ');
console.log('  - 標準四則混合: 10ステージ');
console.log('  - チャレンジ: 4ステージ + ボス');
console.log('');
console.log('必要スター:');
console.log('  - 足し算: 0 (最初から)');
console.log('  - 引き算: 20 (←30から緩和)');
console.log('  - 掛け算: 45 (←60から緩和)');
console.log('  - 割り算: 75 (←100から緩和)');
console.log('  - ミックス: 120 (←150から緩和)');
console.log('');
console.log('制限時間と問題数:');
console.log('  - 4-5歳: 3-4問, 1問20-30秒');
console.log('  - 5-6歳: 4-5問, 1問12-15秒');
console.log('  - 6-7歳: 5-6問, 1問10-12秒');
console.log('  - 7-8歳: 6-8問, 1問6-10秒');
console.log('');
console.log('=======================================================================');
console.log('リバランス完了! 合計125ステージ（各エリア25ステージ）');
console.log('=======================================================================\n');
console.log('確認: node scripts/analyze_math_difficulty.js');
