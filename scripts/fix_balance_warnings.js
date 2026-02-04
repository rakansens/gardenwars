/**
 * バランス警告を修正するスクリプト
 * - normal → frozen: 1.23x → 1.35x以上に
 * - nightmare → purgatory: 2.65x → 2.0x以下に
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

console.log('\n=======================================================================');
console.log('           バランス警告の修正');
console.log('=======================================================================\n');

// ============================================
// 修正1: frozen エリアの強化（1.23x → 1.35x以上）
// ============================================

console.log('【修正1】frozen エリアの強化');
console.log('  現在: normal → frozen = 1.23x');
console.log('  目標: 1.35x以上\n');

// frozen ステージを特定
const frozenStages = world1.filter(s => s.difficulty === 'frozen');

// 強い敵を追加: ice_samurai (822), penguin (365)
frozenStages.forEach(stage => {
    // 氷侍を追加（まだなければ）
    const hasIceSamurai = stage.enemyWaves.some(w => w.unitId === 'enemy_ice_samurai');
    if (!hasIceSamurai) {
        const lastWave = stage.enemyWaves[stage.enemyWaves.length - 1];
        const newTime = (lastWave ? lastWave.timeMs : 30000) + 5000;
        stage.enemyWaves.push({
            timeMs: newTime,
            unitId: 'enemy_ice_samurai',
            count: 2,
            intervalMs: 2500
        });
        console.log('  ✅ ' + stage.id + ': enemy_ice_samurai x2 を追加');
    }

    // ペンギンの数を増やす
    stage.enemyWaves.forEach(wave => {
        if (wave.unitId === 'enemy_penguin') {
            const oldCount = wave.count;
            wave.count = Math.ceil(wave.count * 1.3);
            if (wave.count !== oldCount) {
                console.log('  ✅ ' + stage.id + ': enemy_penguin ' + oldCount + ' → ' + wave.count);
            }
        }
    });

    // 敵の総数を10%増加
    stage.enemyWaves.forEach(wave => {
        if (wave.unitId !== 'enemy_ice_samurai') {
            const oldCount = wave.count;
            wave.count = Math.ceil(wave.count * 1.1);
        }
    });
});

// ============================================
// 修正2: purgatory エリアの調整（2.65x → 2.0x以下）
// ============================================

console.log('\n【修正2】nightmare → purgatory バランス調整');
console.log('  現在: nightmare → purgatory = 2.65x');
console.log('  目標: 2.0x以下\n');

// nightmareを強化するアプローチ（purgatoryを弱くするより自然）
const nightmareStages = world1.filter(s => s.difficulty === 'nightmare');

nightmareStages.forEach(stage => {
    // 敵の数を30%増加
    stage.enemyWaves.forEach(wave => {
        const oldCount = wave.count;
        wave.count = Math.ceil(wave.count * 1.3);
    });

    // 強い敵を追加
    const hasFlameKnight = stage.enemyWaves.some(w => w.unitId === 'enemy_flame_knight');
    if (!hasFlameKnight) {
        const lastWave = stage.enemyWaves[stage.enemyWaves.length - 1];
        const newTime = (lastWave ? lastWave.timeMs : 50000) + 5000;
        stage.enemyWaves.push({
            timeMs: newTime,
            unitId: 'enemy_flame_knight',
            count: 2,
            intervalMs: 3000
        });
        console.log('  ✅ ' + stage.id + ': enemy_flame_knight x2 を追加');
    }

    // ゴーレムを追加
    const hasGolem = stage.enemyWaves.some(w => w.unitId === 'enemy_ur_golem');
    if (!hasGolem && !stage.isBossStage) {
        const lastWave = stage.enemyWaves[stage.enemyWaves.length - 1];
        const newTime = (lastWave ? lastWave.timeMs : 55000) + 5000;
        stage.enemyWaves.push({
            timeMs: newTime,
            unitId: 'enemy_ur_golem',
            count: 1,
            intervalMs: 4000
        });
        console.log('  ✅ ' + stage.id + ': enemy_ur_golem x1 を追加');
    }
});

// purgatoryの敵数を少し減らす
const purgatoryStages = world2.filter(s => s.difficulty === 'purgatory');

purgatoryStages.forEach(stage => {
    // 敵の数を15%減少
    stage.enemyWaves.forEach(wave => {
        const oldCount = wave.count;
        wave.count = Math.max(1, Math.floor(wave.count * 0.85));
    });
    console.log('  ✅ ' + stage.id + ': 敵数を15%減少');
});

// ============================================
// 保存
// ============================================

fs.writeFileSync(world1Path, JSON.stringify(world1, null, 2));
fs.writeFileSync(world2Path, JSON.stringify(world2, null, 2));

console.log('\n-----------------------------------------------------------------------');
console.log('バランス修正完了');
console.log('-----------------------------------------------------------------------\n');

console.log('確認: node scripts/stage_strength_analyzer.js');
console.log('');
