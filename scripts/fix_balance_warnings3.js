/**
 * バランス警告を修正するスクリプト（追加修正3）
 * - hard → extreme: 2.82x → 2.0x以下に
 */

const fs = require('fs');
const path = require('path');

const world1Path = path.join(__dirname, '../src/data/stages/normal.json');

let world1 = JSON.parse(fs.readFileSync(world1Path, 'utf8'));

console.log('\n=======================================================================');
console.log('           バランス警告の追加修正3');
console.log('=======================================================================\n');

// ============================================
// hard エリアの強化（hard → extreme = 2.82x → 2.0x以下）
// ============================================

console.log('【修正】hard エリアの強化');
console.log('  現在: hard → extreme = 2.82x');
console.log('  目標: 2.0x以下\n');

const hardStages = world1.filter(s => s.difficulty === 'hard');

hardStages.forEach(stage => {
    // 敵の数を35%増加
    stage.enemyWaves.forEach(wave => {
        const oldCount = wave.count;
        wave.count = Math.ceil(wave.count * 1.35);
    });

    // 魔法使いを追加
    const hasMage = stage.enemyWaves.some(w => w.unitId === 'enemy_mage');
    if (!hasMage) {
        const lastWave = stage.enemyWaves[stage.enemyWaves.length - 1];
        const newTime = (lastWave ? lastWave.timeMs : 40000) + 5000;
        stage.enemyWaves.push({
            timeMs: newTime,
            unitId: 'enemy_mage',
            count: 3,
            intervalMs: 2500
        });
        console.log('  ✅ ' + stage.id + ': enemy_mage x3 を追加');
    }

    // 忍者を追加
    const hasNinja = stage.enemyWaves.some(w => w.unitId === 'enemy_ninja');
    if (!hasNinja && !stage.isBossStage) {
        const lastWave = stage.enemyWaves[stage.enemyWaves.length - 1];
        const newTime = (lastWave ? lastWave.timeMs : 45000) + 5000;
        stage.enemyWaves.push({
            timeMs: newTime,
            unitId: 'enemy_ninja',
            count: 3,
            intervalMs: 2500
        });
        console.log('  ✅ ' + stage.id + ': enemy_ninja x3 を追加');
    }
});

// ============================================
// 保存
// ============================================

fs.writeFileSync(world1Path, JSON.stringify(world1, null, 2));

console.log('\n-----------------------------------------------------------------------');
console.log('バランス追加修正3完了');
console.log('-----------------------------------------------------------------------\n');

console.log('確認: node scripts/stage_strength_analyzer.js');
console.log('');
