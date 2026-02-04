/**
 * バランス警告を修正するスクリプト（追加修正）
 * - extreme → nightmare: 2.57x → 2.0x以下に
 */

const fs = require('fs');
const path = require('path');

const world1Path = path.join(__dirname, '../src/data/stages/normal.json');

let world1 = JSON.parse(fs.readFileSync(world1Path, 'utf8'));

console.log('\n=======================================================================');
console.log('           バランス警告の追加修正');
console.log('=======================================================================\n');

// ============================================
// extreme エリアの強化（extreme → nightmare = 2.57x → 2.0x以下）
// ============================================

console.log('【修正】extreme エリアの強化');
console.log('  現在: extreme → nightmare = 2.57x');
console.log('  目標: 2.0x以下\n');

const extremeStages = world1.filter(s => s.difficulty === 'extreme');

extremeStages.forEach(stage => {
    // 敵の数を25%増加
    stage.enemyWaves.forEach(wave => {
        const oldCount = wave.count;
        wave.count = Math.ceil(wave.count * 1.25);
    });

    // UR忍者を追加
    const hasUrNinja = stage.enemyWaves.some(w => w.unitId === 'enemy_ur_ninja');
    if (!hasUrNinja) {
        const lastWave = stage.enemyWaves[stage.enemyWaves.length - 1];
        const newTime = (lastWave ? lastWave.timeMs : 45000) + 5000;
        stage.enemyWaves.push({
            timeMs: newTime,
            unitId: 'enemy_ur_ninja',
            count: 2,
            intervalMs: 3000
        });
        console.log('  ✅ ' + stage.id + ': enemy_ur_ninja x2 を追加');
    }

    // URアーチャーを追加
    const hasUrArcher = stage.enemyWaves.some(w => w.unitId === 'enemy_ur_archer');
    if (!hasUrArcher && !stage.isBossStage) {
        const lastWave = stage.enemyWaves[stage.enemyWaves.length - 1];
        const newTime = (lastWave ? lastWave.timeMs : 50000) + 5000;
        stage.enemyWaves.push({
            timeMs: newTime,
            unitId: 'enemy_ur_archer',
            count: 2,
            intervalMs: 3500
        });
        console.log('  ✅ ' + stage.id + ': enemy_ur_archer x2 を追加');
    }
});

// ============================================
// 保存
// ============================================

fs.writeFileSync(world1Path, JSON.stringify(world1, null, 2));

console.log('\n-----------------------------------------------------------------------');
console.log('バランス追加修正完了');
console.log('-----------------------------------------------------------------------\n');

console.log('確認: node scripts/stage_strength_analyzer.js');
console.log('');
