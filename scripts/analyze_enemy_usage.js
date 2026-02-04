/**
 * ステージ別・エリア別の敵ユニット使用数分析
 */

const fs = require('fs');
const path = require('path');

const world1 = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/stages/normal.json'), 'utf8'));
const world2 = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/stages/world2.json'), 'utf8'));
const enemies = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/units/enemies.json'), 'utf8'));
const allStages = world1.concat(world2);

const DIFF_ORDER = ['tutorial', 'easy', 'normal', 'frozen', 'hard', 'extreme', 'nightmare', 'purgatory', 'hellfire', 'abyss', 'inferno_boss'];

// 敵マップ
const enemyMap = {};
enemies.forEach(function(e) { enemyMap[e.id] = e; });

console.log('\n=======================================================================');
console.log('           ステージ別・エリア別 敵ユニット使用数分析');
console.log('=======================================================================\n');

// ステージをソート
allStages.sort(function(a, b) {
    const diffA = DIFF_ORDER.indexOf(a.difficulty);
    const diffB = DIFF_ORDER.indexOf(b.difficulty);
    if (diffA !== diffB) return diffA - diffB;
    return a.id.localeCompare(b.id);
});

const diffStats = {};

// 個別ステージ
console.log('【個別ステージ詳細】');
console.log('ステージID        | 難易度      | Wave数 | ユニーク敵 | 使用ユニット');
console.log('------------------|-------------|--------|------------|---------------------------');

allStages.forEach(function(stage) {
    const waves = stage.enemyWaves || [];
    const enemyIds = waves.map(function(w) { return w.unitId; });
    const uniqueEnemies = [];
    enemyIds.forEach(function(id) {
        if (uniqueEnemies.indexOf(id) === -1) uniqueEnemies.push(id);
    });

    // 難易度統計
    if (!diffStats[stage.difficulty]) {
        diffStats[stage.difficulty] = {
            stages: 0,
            totalUnique: 0,
            allEnemies: [],
            minUnique: 999,
            maxUnique: 0
        };
    }
    const stats = diffStats[stage.difficulty];
    stats.stages++;
    stats.totalUnique += uniqueEnemies.length;
    stats.minUnique = Math.min(stats.minUnique, uniqueEnemies.length);
    stats.maxUnique = Math.max(stats.maxUnique, uniqueEnemies.length);
    uniqueEnemies.forEach(function(e) {
        if (stats.allEnemies.indexOf(e) === -1) stats.allEnemies.push(e);
    });

    // 短縮名
    const shortNames = uniqueEnemies.slice(0, 5).map(function(e) {
        return e.replace('enemy_', '').substring(0, 12);
    });
    const more = uniqueEnemies.length > 5 ? ' +' + (uniqueEnemies.length - 5) : '';

    console.log(
        stage.id.padEnd(17) + ' | ' +
        stage.difficulty.padEnd(11) + ' | ' +
        String(waves.length).padStart(6) + ' | ' +
        String(uniqueEnemies.length).padStart(10) + ' | ' +
        shortNames.join(', ') + more
    );
});

// 難易度別サマリー
console.log('\n=======================================================================');
console.log('                    難易度（エリア）別サマリー');
console.log('=======================================================================');
console.log('難易度        | ステージ数 | 平均 | 最小 | 最大 | エリア全体ユニーク');
console.log('--------------|------------|------|------|------|-------------------');

DIFF_ORDER.forEach(function(diff) {
    const stats = diffStats[diff];
    if (!stats) return;
    const avg = (stats.totalUnique / stats.stages).toFixed(1);
    console.log(
        diff.padEnd(13) + ' | ' +
        String(stats.stages).padStart(10) + ' | ' +
        String(avg).padStart(4) + ' | ' +
        String(stats.minUnique).padStart(4) + ' | ' +
        String(stats.maxUnique).padStart(4) + ' | ' +
        String(stats.allEnemies.length).padStart(17)
    );
});

// 全体統計
console.log('\n=======================================================================');
console.log('                         全体統計');
console.log('=======================================================================\n');

const allEnemiesUsed = [];
let totalWaves = 0;
let totalEnemyCount = 0;

allStages.forEach(function(stage) {
    (stage.enemyWaves || []).forEach(function(w) {
        if (allEnemiesUsed.indexOf(w.unitId) === -1) {
            allEnemiesUsed.push(w.unitId);
        }
        totalWaves++;
        totalEnemyCount += w.count || 0;
    });
});

console.log('総ステージ数: ' + allStages.length);
console.log('総ウェーブ数: ' + totalWaves);
console.log('総敵出現数: ' + totalEnemyCount + '体');
console.log('使用されている敵ユニット: ' + allEnemiesUsed.length + '種類 / ' + enemies.length + '種類中');
console.log('使用率: ' + (allEnemiesUsed.length / enemies.length * 100).toFixed(1) + '%');

// 未使用敵
const unusedEnemies = enemies.filter(function(e) {
    return allEnemiesUsed.indexOf(e.id) === -1;
});

console.log('\n【使用中の敵ユニット (' + allEnemiesUsed.length + '種類)】');
allEnemiesUsed.sort().forEach(function(id) {
    const enemy = enemyMap[id];
    const rarity = enemy ? enemy.rarity : '?';
    console.log('  [' + rarity.padEnd(3) + '] ' + id);
});

console.log('\n【未使用の敵ユニット (' + unusedEnemies.length + '種類)】');
unusedEnemies.sort(function(a, b) {
    return a.id.localeCompare(b.id);
}).forEach(function(enemy) {
    console.log('  [' + enemy.rarity.padEnd(3) + '] ' + enemy.id);
});

// 各エリアで使用されている敵の詳細
console.log('\n=======================================================================');
console.log('               エリア別 使用敵ユニット詳細');
console.log('=======================================================================');

DIFF_ORDER.forEach(function(diff) {
    const stats = diffStats[diff];
    if (!stats) return;

    console.log('\n【' + diff + '】 ' + stats.allEnemies.length + '種類');
    stats.allEnemies.sort().forEach(function(id) {
        const enemy = enemyMap[id];
        const rarity = enemy ? enemy.rarity : '?';
        console.log('  [' + rarity.padEnd(3) + '] ' + id.replace('enemy_', ''));
    });
});

console.log('\n');
