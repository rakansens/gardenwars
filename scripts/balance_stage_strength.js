/**
 * 全ステージ強さバランス調整スクリプト
 * 分析結果に基づいて自動的にバランスを修正
 */

const fs = require('fs');
const path = require('path');

// データ読み込み
const world1Path = path.join(__dirname, '../src/data/stages/normal.json');
const world2Path = path.join(__dirname, '../src/data/stages/world2.json');
const world1Stages = JSON.parse(fs.readFileSync(world1Path, 'utf8'));
const world2Stages = JSON.parse(fs.readFileSync(world2Path, 'utf8'));
const enemies = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/units/enemies.json'), 'utf8'));
const bosses = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/units/bosses.json'), 'utf8'));

// 敵ユニットマップ
const enemyMap = {};
enemies.forEach(function(e) { enemyMap[e.id] = e; });
bosses.forEach(function(b) { enemyMap[b.id] = b; });

// 難易度順序
const DIFFICULTY_ORDER = [
    'tutorial', 'easy', 'normal', 'frozen', 'hard', 'extreme', 'nightmare', 'boss', 'special',
    'purgatory', 'hellfire', 'abyss', 'inferno_boss'
];

// 理想的な難易度間の比率
const IDEAL_RATIOS = {
    'tutorial': 1.0,
    'easy': 1.4,        // tutorial -> easy: 1.4x
    'normal': 2.0,      // easy -> normal: 1.43x (合計 2.0x)
    'frozen': 3.0,      // normal -> frozen: 1.5x (合計 3.0x)
    'hard': 5.0,        // frozen -> hard: 1.67x (合計 5.0x)
    'extreme': 9.0,     // hard -> extreme: 1.8x (合計 9.0x)
    'nightmare': 15.0,  // extreme -> nightmare: 1.67x (合計 15.0x)
    'boss': 20.0,       // nightmare -> boss相当
    'purgatory': 35.0,  // nightmare -> purgatory: 2.3x (合計 35x)
    'hellfire': 55.0,   // purgatory -> hellfire: 1.57x (合計 55x)
    'abyss': 90.0,      // hellfire -> abyss: 1.64x (合計 90x)
    'inferno_boss': 150.0 // abyss -> inferno_boss: 1.67x (合計 150x)
};

// ベース強さ（tutorialの平均）
const BASE_STRENGTH = 220;

/**
 * ユニットパワー計算
 */
function calcUnitPower(unit) {
    if (!unit) return 0;
    return (unit.maxHp || 0) * 0.001 + (unit.attackDamage || 0) * 0.5 + (unit.speed || 0) * 2;
}

/**
 * ステージの現在の強さを計算
 */
function calcCurrentStrength(stage) {
    const enemyCastleHp = stage.enemyCastleHp || 0;
    const waves = stage.enemyWaves || [];

    let totalEnemyCount = 0;
    let totalEnemyPower = 0;
    let totalSpawnTime = 0;

    waves.forEach(function(wave) {
        const count = wave.count || 0;
        const interval = wave.intervalMs || 1000;
        const unit = enemyMap[wave.unitId];

        totalEnemyCount += count;
        if (unit) {
            totalEnemyPower += calcUnitPower(unit) * count;
        }
        totalSpawnTime += count * interval;
    });

    const waveDensity = waves.length > 0 ? totalEnemyCount / (totalSpawnTime / 1000 || 1) : 0;

    const castleScore = enemyCastleHp * 0.0001;
    const countScore = totalEnemyCount * 2;
    const powerScore = totalEnemyPower * 0.05;
    const densityScore = waveDensity * 50;

    return castleScore + countScore + powerScore + densityScore;
}

/**
 * 目標強さを計算
 */
function getTargetStrength(difficulty, stageIndexInDifficulty, totalStagesInDifficulty) {
    const ratio = IDEAL_RATIOS[difficulty] || 1.0;
    const baseTarget = BASE_STRENGTH * ratio;

    // 難易度内での進行（最初のステージは80%、最後は120%）
    const progression = 0.8 + (stageIndexInDifficulty / Math.max(totalStagesInDifficulty - 1, 1)) * 0.4;

    return Math.round(baseTarget * progression);
}

/**
 * ステージの強さを調整
 */
function adjustStageStrength(stage, targetStrength) {
    const currentStrength = calcCurrentStrength(stage);
    if (currentStrength <= 0) return;

    const scaleFactor = targetStrength / currentStrength;

    // スケール係数が極端な場合は警告
    if (scaleFactor < 0.3 || scaleFactor > 3.0) {
        console.log('  [WARN] ' + stage.id + ': スケール係数が極端 (' + scaleFactor.toFixed(2) + 'x)');
    }

    // 城HPを調整（主要な調整対象）
    if (stage.enemyCastleHp) {
        stage.enemyCastleHp = Math.round(stage.enemyCastleHp * scaleFactor);
    }

    // ウェーブごとの敵数も微調整（±20%範囲）
    if (stage.enemyWaves) {
        stage.enemyWaves.forEach(function(wave) {
            // 敵数を微調整（スケール係数の平方根を使用して緩やかに）
            const countScale = Math.sqrt(scaleFactor);
            if (countScale > 1.1) {
                wave.count = Math.round(wave.count * Math.min(countScale, 1.3));
            } else if (countScale < 0.9) {
                wave.count = Math.max(1, Math.round(wave.count * Math.max(countScale, 0.7)));
            }
        });
    }

    return stage;
}

/**
 * 難易度ごとにステージをグループ化
 */
function groupByDifficulty(stages) {
    const groups = {};
    stages.forEach(function(stage) {
        const diff = stage.difficulty;
        if (!groups[diff]) groups[diff] = [];
        groups[diff].push(stage);
    });
    return groups;
}

// メイン処理
console.log('\n=======================================================================');
console.log('              ステージ強さバランス調整');
console.log('=======================================================================\n');

// World 1 調整
console.log('【World 1】');
const world1Groups = groupByDifficulty(world1Stages);

DIFFICULTY_ORDER.forEach(function(diff) {
    const stages = world1Groups[diff];
    if (!stages || stages.length === 0) return;

    console.log('\n  ' + diff + ' (' + stages.length + ' stages):');

    stages.forEach(function(stage, index) {
        const currentStrength = Math.round(calcCurrentStrength(stage));
        const targetStrength = getTargetStrength(diff, index, stages.length);
        const ratio = (targetStrength / currentStrength).toFixed(2);

        console.log('    ' + stage.id + ': ' + currentStrength + ' -> ' + targetStrength + ' (' + ratio + 'x)');

        adjustStageStrength(stage, targetStrength);
    });
});

// World 2 調整
console.log('\n\n【World 2】');
const world2Groups = groupByDifficulty(world2Stages);

DIFFICULTY_ORDER.forEach(function(diff) {
    const stages = world2Groups[diff];
    if (!stages || stages.length === 0) return;

    console.log('\n  ' + diff + ' (' + stages.length + ' stages):');

    stages.forEach(function(stage, index) {
        const currentStrength = Math.round(calcCurrentStrength(stage));
        const targetStrength = getTargetStrength(diff, index, stages.length);
        const ratio = (targetStrength / currentStrength).toFixed(2);

        console.log('    ' + stage.id + ': ' + currentStrength + ' -> ' + targetStrength + ' (' + ratio + 'x)');

        adjustStageStrength(stage, targetStrength);
    });
});

// ファイル保存
fs.writeFileSync(world1Path, JSON.stringify(world1Stages, null, 2));
fs.writeFileSync(world2Path, JSON.stringify(world2Stages, null, 2));

console.log('\n\n調整完了！ファイルを保存しました。');
console.log('  - ' + world1Path);
console.log('  - ' + world2Path);
console.log('\n再度分析スクリプトを実行して結果を確認してください:');
console.log('  node scripts/stage_strength_analyzer.js\n');
