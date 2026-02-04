/**
 * 新しい敵ユニットをステージに配置するスクリプト
 */

const fs = require('fs');
const path = require('path');

const world1Path = path.join(__dirname, '../src/data/stages/normal.json');
const world2Path = path.join(__dirname, '../src/data/stages/world2.json');

let world1 = JSON.parse(fs.readFileSync(world1Path, 'utf8'));
let world2 = JSON.parse(fs.readFileSync(world2Path, 'utf8'));

// 配置計画
const placements = {
    // tutorial: 野菜系を追加
    tutorial_2: [
        { unitId: 'enemy_n_pumpkin', count: 3, timeMs: 14000, intervalMs: 1800 }
    ],
    tutorial_3: [
        { unitId: 'enemy_n_apple', count: 4, timeMs: 16000, intervalMs: 1700 }
    ],

    // easy: 果物系を追加
    stage_1: [
        { unitId: 'enemy_n_strawberry', count: 3, timeMs: 20000, intervalMs: 1600 }
    ],
    stage_2: [
        { unitId: 'enemy_n_carrot', count: 4, timeMs: 18000, intervalMs: 1500 }
    ],
    stage_3: [
        { unitId: 'enemy_n_apple', count: 3, timeMs: 22000, intervalMs: 1400 },
        { unitId: 'enemy_n_pumpkin', count: 2, timeMs: 28000, intervalMs: 1600 }
    ],

    // normal: 野菜戦士を追加
    stage_4: [
        { unitId: 'enemy_r_broccoli', count: 3, timeMs: 25000, intervalMs: 1400 }
    ],
    stage_5: [
        { unitId: 'enemy_r_lemon', count: 3, timeMs: 22000, intervalMs: 1300 }
    ],
    stage_6: [
        { unitId: 'enemy_r_cherry', count: 4, timeMs: 24000, intervalMs: 1200 }
    ],
    stage_7: [
        { unitId: 'enemy_n_cherry_bomb', count: 3, timeMs: 28000, intervalMs: 1100 }
    ],
    stage_8: [
        { unitId: 'enemy_r_broccoli', count: 4, timeMs: 26000, intervalMs: 1200 },
        { unitId: 'enemy_r_lemon', count: 3, timeMs: 32000, intervalMs: 1300 }
    ],
    stage_9: [
        { unitId: 'enemy_r_cherry', count: 4, timeMs: 30000, intervalMs: 1100 },
        { unitId: 'enemy_n_cherry_bomb', count: 3, timeMs: 36000, intervalMs: 1000 }
    ],

    // frozen: 氷の侍を追加
    stage_12: [
        { unitId: 'enemy_ice_samurai', count: 1, timeMs: 35000, intervalMs: 2000 }
    ],
    stage_14: [
        { unitId: 'enemy_ice_samurai', count: 2, timeMs: 40000, intervalMs: 3000 }
    ],
    stage_16: [
        { unitId: 'enemy_ice_samurai', count: 2, timeMs: 38000, intervalMs: 2500 }
    ],

    // hard: URヒーラーを追加
    stage_18: [
        { unitId: 'enemy_ur_healer', count: 1, timeMs: 45000, intervalMs: 3000 }
    ],
    stage_20: [
        { unitId: 'enemy_ur_healer', count: 2, timeMs: 50000, intervalMs: 4000 }
    ],

    // extreme: URアーチャー、忍者を追加
    stage_22: [
        { unitId: 'enemy_ur_archer', count: 1, timeMs: 55000, intervalMs: 3000 }
    ],
    stage_24: [
        { unitId: 'enemy_ur_ninja', count: 1, timeMs: 50000, intervalMs: 3000 },
        { unitId: 'enemy_ur_archer', count: 1, timeMs: 58000, intervalMs: 3000 }
    ],
    stage_26: [
        { unitId: 'enemy_ur_ninja', count: 2, timeMs: 55000, intervalMs: 4000 },
        { unitId: 'enemy_ur_archer', count: 2, timeMs: 65000, intervalMs: 4000 }
    ],

    // nightmare: 炎騎士、ゴーレムを追加
    stage_27: [
        { unitId: 'enemy_flame_knight', count: 1, timeMs: 50000, intervalMs: 3000 }
    ],
    stage_29: [
        { unitId: 'enemy_ur_golem', count: 1, timeMs: 55000, intervalMs: 4000 }
    ],
    stage_31: [
        { unitId: 'enemy_flame_knight', count: 2, timeMs: 52000, intervalMs: 3500 },
        { unitId: 'enemy_ur_golem', count: 1, timeMs: 62000, intervalMs: 4000 }
    ],

    // purgatory: 影暗殺者、フェニックスを追加
    purgatory_1: [
        { unitId: 'enemy_shadow_assassin', count: 1, timeMs: 45000, intervalMs: 3000 }
    ],
    purgatory_3: [
        { unitId: 'enemy_ur_phoenix', count: 1, timeMs: 50000, intervalMs: 4000 }
    ],

    // hellfire: 高レベル敵を追加
    hellfire_2: [
        { unitId: 'enemy_shadow_assassin', count: 2, timeMs: 48000, intervalMs: 3500 }
    ],
    hellfire_4: [
        { unitId: 'enemy_ur_phoenix', count: 2, timeMs: 52000, intervalMs: 4000 },
        { unitId: 'enemy_flame_knight', count: 2, timeMs: 60000, intervalMs: 3500 }
    ],

    // abyss: 最強敵を追加
    abyss_2: [
        { unitId: 'enemy_shadow_assassin', count: 2, timeMs: 50000, intervalMs: 3000 },
        { unitId: 'enemy_ur_golem', count: 1, timeMs: 58000, intervalMs: 4000 }
    ],
    abyss_4: [
        { unitId: 'enemy_ur_phoenix', count: 2, timeMs: 55000, intervalMs: 4000 },
        { unitId: 'enemy_flame_knight', count: 2, timeMs: 65000, intervalMs: 3500 },
        { unitId: 'enemy_shadow_assassin', count: 2, timeMs: 75000, intervalMs: 3000 }
    ]
};

// ステージを更新
function updateStage(stages, stageId, newWaves) {
    const stage = stages.find(s => s.id === stageId);
    if (!stage) {
        console.log('  ⚠️ ステージ未発見: ' + stageId);
        return false;
    }

    // 既存のウェーブに追加
    newWaves.forEach(wave => {
        // 重複チェック
        const exists = stage.enemyWaves.some(w => w.unitId === wave.unitId);
        if (!exists) {
            stage.enemyWaves.push(wave);
            console.log('  ✅ ' + stageId + ' に ' + wave.unitId + ' x' + wave.count + ' を追加');
        } else {
            console.log('  ⏭️ ' + stageId + ' に ' + wave.unitId + ' は既存');
        }
    });

    // 時間順でソート
    stage.enemyWaves.sort((a, b) => a.timeMs - b.timeMs);
    return true;
}

console.log('\n=======================================================================');
console.log('           新しい敵ユニットをステージに配置');
console.log('=======================================================================\n');

let addedCount = 0;

Object.entries(placements).forEach(([stageId, waves]) => {
    // World1かWorld2か判定
    const isWorld2 = stageId.startsWith('purgatory') ||
                     stageId.startsWith('hellfire') ||
                     stageId.startsWith('abyss') ||
                     stageId.startsWith('inferno');

    const stages = isWorld2 ? world2 : world1;
    if (updateStage(stages, stageId, waves)) {
        addedCount += waves.length;
    }
});

// 保存
fs.writeFileSync(world1Path, JSON.stringify(world1, null, 2));
fs.writeFileSync(world2Path, JSON.stringify(world2, null, 2));

console.log('\n-----------------------------------------------------------------------');
console.log('配置完了: ' + addedCount + ' 個のウェーブを追加');
console.log('-----------------------------------------------------------------------\n');
