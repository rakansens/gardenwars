/**
 * 全ステージ強さ指標分析スクリプト
 * 各ステージの総合的な難易度を数値化し、バランスカーブを検証
 */

const fs = require('fs');
const path = require('path');

// データ読み込み
const world1Stages = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/stages/normal.json'), 'utf8'));
const world2Stages = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/stages/world2.json'), 'utf8'));
const enemies = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/units/enemies.json'), 'utf8'));
const bosses = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/units/bosses.json'), 'utf8'));

// 敵ユニットマップ作成
const enemyMap = {};
enemies.forEach(function(e) { enemyMap[e.id] = e; });
bosses.forEach(function(b) { enemyMap[b.id] = b; });

// 難易度順序
const DIFFICULTY_ORDER = [
    'tutorial', 'easy', 'normal', 'frozen', 'hard', 'extreme', 'nightmare', 'boss', 'special',
    'purgatory', 'hellfire', 'abyss', 'inferno_boss'
];

/**
 * ユニットのパワー値を計算
 */
function calcUnitPower(unit) {
    if (!unit) return 0;
    const hp = unit.maxHp || 0;
    const atk = unit.attackDamage || 0;
    const speed = unit.speed || 0;
    return hp * 0.001 + atk * 0.5 + speed * 2;
}

/**
 * ステージの強さ指標を計算
 */
function calcStageStrength(stage) {
    const enemyCastleHp = stage.enemyCastleHp || 0;
    const waves = stage.enemyWaves || [];

    let totalEnemyCount = 0;
    let totalEnemyPower = 0;
    let totalSpawnTime = 0;
    let minInterval = Infinity;
    let maxInterval = 0;

    waves.forEach(function(wave) {
        const count = wave.count || 0;
        const unitId = wave.unitId;
        const interval = wave.intervalMs || 1000;
        const unit = enemyMap[unitId];

        totalEnemyCount += count;
        if (unit) {
            totalEnemyPower += calcUnitPower(unit) * count;
        }

        totalSpawnTime += count * interval;
        minInterval = Math.min(minInterval, interval);
        maxInterval = Math.max(maxInterval, interval);
    });

    const avgInterval = totalEnemyCount > 0 ? totalSpawnTime / totalEnemyCount : 1000;
    const waveDensity = waves.length > 0 ? totalEnemyCount / (totalSpawnTime / 1000 || 1) : 0;

    const castleScore = enemyCastleHp * 0.0001;
    const countScore = totalEnemyCount * 2;
    const powerScore = totalEnemyPower * 0.05;
    const densityScore = waveDensity * 50;
    const totalStrength = castleScore + countScore + powerScore + densityScore;

    return {
        stageId: stage.id,
        difficulty: stage.difficulty,
        worldId: stage.worldId || 'world1',
        enemyCastleHp: enemyCastleHp,
        totalEnemyCount: totalEnemyCount,
        totalEnemyPower: Math.round(totalEnemyPower),
        waveCount: waves.length,
        avgInterval: Math.round(avgInterval),
        minInterval: minInterval === Infinity ? 0 : minInterval,
        maxInterval: maxInterval,
        waveDensity: waveDensity.toFixed(2),
        castleScore: Math.round(castleScore),
        countScore: Math.round(countScore),
        powerScore: Math.round(powerScore),
        densityScore: Math.round(densityScore),
        totalStrength: Math.round(totalStrength)
    };
}

// 全ステージを分析
const allStages = world1Stages.concat(world2Stages);
const stageStrengths = allStages.map(calcStageStrength);

// 難易度でソート
stageStrengths.sort(function(a, b) {
    const diffA = DIFFICULTY_ORDER.indexOf(a.difficulty);
    const diffB = DIFFICULTY_ORDER.indexOf(b.difficulty);
    if (diffA !== diffB) return diffA - diffB;
    return a.stageId.localeCompare(b.stageId);
});

// 難易度ごとの統計
const difficultyStats = {};
DIFFICULTY_ORDER.forEach(function(diff) {
    const stages = stageStrengths.filter(function(s) { return s.difficulty === diff; });
    if (stages.length === 0) return;

    const strengths = stages.map(function(s) { return s.totalStrength; });
    const castleHps = stages.map(function(s) { return s.enemyCastleHp; });
    const enemyCounts = stages.map(function(s) { return s.totalEnemyCount; });
    const enemyPowers = stages.map(function(s) { return s.totalEnemyPower; });

    difficultyStats[diff] = {
        count: stages.length,
        avgStrength: Math.round(strengths.reduce(function(a, b) { return a + b; }, 0) / stages.length),
        minStrength: Math.min.apply(null, strengths),
        maxStrength: Math.max.apply(null, strengths),
        avgCastleHp: Math.round(castleHps.reduce(function(a, b) { return a + b; }, 0) / stages.length),
        avgEnemyCount: Math.round(enemyCounts.reduce(function(a, b) { return a + b; }, 0) / stages.length),
        avgEnemyPower: Math.round(enemyPowers.reduce(function(a, b) { return a + b; }, 0) / stages.length)
    };
});

// 結果出力
console.log('\n=======================================================================');
console.log('              全ステージ強さ指標分析レポート');
console.log('=======================================================================\n');

console.log('【計算式】');
console.log('  ユニットパワー = HP*0.001 + ATK*0.5 + Speed*2');
console.log('  総合強さ = 城HP*0.0001 + 敵数*2 + 敵パワー*0.05 + 密度*50\n');

// 難易度ごとのサマリー
console.log('-------------------------------------------------------------------');
console.log('                      難易度別サマリー');
console.log('-------------------------------------------------------------------');
console.log('難易度        | 数 | 平均強さ | 最小    | 最大     | 平均敵数 | 平均敵力');
console.log('--------------|----|---------| --------|---------| ---------|--------');

const diffKeys = Object.keys(difficultyStats);
diffKeys.forEach(function(diff) {
    const stats = difficultyStats[diff];
    console.log(
        diff.padEnd(13) + ' | ' +
        String(stats.count).padStart(2) + ' | ' +
        String(stats.avgStrength).padStart(7) + ' | ' +
        String(stats.minStrength).padStart(7) + ' | ' +
        String(stats.maxStrength).padStart(7) + ' | ' +
        String(stats.avgEnemyCount).padStart(8) + ' | ' +
        String(stats.avgEnemyPower).padStart(7)
    );
});

console.log('\n-------------------------------------------------------------------');
console.log('                   難易度間の強さ比率');
console.log('-------------------------------------------------------------------');
console.log('遷移                        | 強さ比 | 城HP比 | 敵数比 | 敵力比');
console.log('----------------------------|--------|--------|--------|-------');

for (let i = 1; i < diffKeys.length; i++) {
    const prevDiff = diffKeys[i - 1];
    const currDiff = diffKeys[i];
    const prev = difficultyStats[prevDiff];
    const curr = difficultyStats[currDiff];

    const strengthRatio = (curr.avgStrength / prev.avgStrength).toFixed(2);
    const hpRatio = (curr.avgCastleHp / prev.avgCastleHp).toFixed(2);
    const countRatio = (curr.avgEnemyCount / prev.avgEnemyCount).toFixed(2);
    const powerRatio = (curr.avgEnemyPower / prev.avgEnemyPower).toFixed(2);

    const transition = prevDiff + ' -> ' + currDiff;
    console.log(
        transition.padEnd(27) + ' | ' +
        (strengthRatio + 'x').padStart(6) + ' | ' +
        (hpRatio + 'x').padStart(6) + ' | ' +
        (countRatio + 'x').padStart(6) + ' | ' +
        (powerRatio + 'x').padStart(6)
    );
}

// 個別ステージ詳細
console.log('\n-------------------------------------------------------------------');
console.log('                      個別ステージ詳細');
console.log('-------------------------------------------------------------------');
console.log('ステージID      | 難易度      | 城HP      | 敵数  | 敵パワー | 密度/秒 | 総合強さ | 前比');
console.log('----------------|-------------|-----------|-------|----------|---------|----------|------');

let prevStrength = null;
stageStrengths.forEach(function(s) {
    const ratio = prevStrength ? (s.totalStrength / prevStrength).toFixed(2) + 'x' : '-';
    console.log(
        s.stageId.padEnd(15) + ' | ' +
        s.difficulty.padEnd(11) + ' | ' +
        String(s.enemyCastleHp).padStart(9) + ' | ' +
        String(s.totalEnemyCount).padStart(5) + ' | ' +
        String(s.totalEnemyPower).padStart(8) + ' | ' +
        s.waveDensity.padStart(7) + ' | ' +
        String(s.totalStrength).padStart(8) + ' | ' +
        ratio.padStart(5)
    );
    prevStrength = s.totalStrength;
});

// バランス問題の検出
console.log('\n-------------------------------------------------------------------');
console.log('                      バランス問題検出');
console.log('-------------------------------------------------------------------\n');

const issues = [];

// 1. 同難易度内の強さのばらつきが大きいものを検出
diffKeys.forEach(function(diff) {
    const stats = difficultyStats[diff];
    const variance = stats.maxStrength - stats.minStrength;
    const avgStrength = stats.avgStrength;
    if (variance > avgStrength * 0.5 && stats.count > 2) {
        issues.push({
            type: 'variance',
            severity: 'warning',
            message: diff + ': 強さのばらつきが大きい (' + stats.minStrength + ' - ' + stats.maxStrength + ', 差: ' + variance + ')'
        });
    }
});

// 2. 難易度逆転を検出
for (let i = 1; i < diffKeys.length; i++) {
    const prevDiff = diffKeys[i - 1];
    const currDiff = diffKeys[i];
    const prev = difficultyStats[prevDiff];
    const curr = difficultyStats[currDiff];

    if (curr.avgStrength < prev.avgStrength) {
        issues.push({
            type: 'inversion',
            severity: 'error',
            message: prevDiff + ' -> ' + currDiff + ': 強さが減少 (' + prev.avgStrength + ' -> ' + curr.avgStrength + ')'
        });
    }

    const ratio = curr.avgStrength / prev.avgStrength;
    if (ratio < 1.1 && ratio > 0) {
        issues.push({
            type: 'insufficient_increase',
            severity: 'warning',
            message: prevDiff + ' -> ' + currDiff + ': 強さの増加が小さい (' + ratio.toFixed(2) + 'x)'
        });
    }

    if (ratio > 5) {
        issues.push({
            type: 'excessive_increase',
            severity: 'warning',
            message: prevDiff + ' -> ' + currDiff + ': 強さの増加が大きすぎる (' + ratio.toFixed(2) + 'x)'
        });
    }
}

// 3. 個別ステージの異常値検出
stageStrengths.forEach(function(s) {
    const stats = difficultyStats[s.difficulty];
    if (!stats) return;

    if (s.totalStrength < stats.avgStrength * 0.5) {
        issues.push({
            type: 'weak_stage',
            severity: 'warning',
            message: s.stageId + ': 難易度平均より弱い (' + s.totalStrength + ' vs avg ' + stats.avgStrength + ')'
        });
    }
    if (s.totalStrength > stats.avgStrength * 2) {
        issues.push({
            type: 'strong_stage',
            severity: 'warning',
            message: s.stageId + ': 難易度平均より強い (' + s.totalStrength + ' vs avg ' + stats.avgStrength + ')'
        });
    }
});

if (issues.length === 0) {
    console.log('  [OK] バランス問題は検出されませんでした\n');
} else {
    issues.forEach(function(issue) {
        const icon = issue.severity === 'error' ? '[ERR]' : '[WARN]';
        console.log('  ' + icon + ' ' + issue.message);
    });
    console.log('');
}

// 推奨目標値
console.log('-------------------------------------------------------------------');
console.log('               推奨目標値（バランス調整用）');
console.log('-------------------------------------------------------------------\n');

console.log('理想的な難易度間の比率:');
console.log('  - tutorial -> easy:     1.3x - 1.5x');
console.log('  - easy -> normal:       1.5x - 2.0x');
console.log('  - normal -> frozen:     1.3x - 1.5x');
console.log('  - frozen -> hard:       1.5x - 2.0x');
console.log('  - hard -> extreme:      1.5x - 2.0x');
console.log('  - extreme -> nightmare: 1.5x - 2.0x');
console.log('  - nightmare -> boss:    1.2x - 1.5x');
console.log('  - boss -> purgatory:    1.5x - 2.5x');
console.log('  - purgatory -> hellfire: 1.3x - 1.8x');
console.log('  - hellfire -> abyss:    1.3x - 1.8x');
console.log('  - abyss -> inferno_boss: 1.2x - 1.5x\n');

// データ出力
const outputData = {
    stages: stageStrengths,
    difficultyStats: difficultyStats,
    issues: issues
};

fs.writeFileSync(
    path.join(__dirname, 'stage_strength_report.json'),
    JSON.stringify(outputData, null, 2)
);

console.log('詳細データを scripts/stage_strength_report.json に出力しました\n');
