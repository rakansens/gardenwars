/**
 * ステージ追加ウィザード
 * 難易度を指定すると、適切な敵の数・城HPを自動計算
 *
 * 使い方:
 *   node scripts/create_stage_wizard.js <難易度> <ステージ名>
 *
 * 例:
 *   node scripts/create_stage_wizard.js normal stage_99
 *   node scripts/create_stage_wizard.js hard my_custom_stage
 *   node scripts/create_stage_wizard.js --info                    # 難易度情報表示
 */

const fs = require('fs');
const path = require('path');

// データ読み込み
const world1Path = path.join(__dirname, '../src/data/stages/normal.json');
const world2Path = path.join(__dirname, '../src/data/stages/world2.json');
const enemiesPath = path.join(__dirname, '../src/data/units/enemies.json');

const world1Stages = JSON.parse(fs.readFileSync(world1Path, 'utf8'));
const world2Stages = JSON.parse(fs.readFileSync(world2Path, 'utf8'));
const enemies = JSON.parse(fs.readFileSync(enemiesPath, 'utf8'));

// 敵ユニットをパワー別にグループ化
const enemyMap = {};
enemies.forEach(function(e) { enemyMap[e.id] = e; });

function calcPower(unit) {
    return Math.round((unit.maxHp || 0) * 0.001 + (unit.attackDamage || 0) * 0.5 + (unit.speed || 0) * 2);
}

// パワーでソートした敵リスト
const sortedEnemies = enemies.slice().sort(function(a, b) {
    return calcPower(a) - calcPower(b);
});

// 難易度別の目標値
const DIFFICULTY_TARGETS = {
    tutorial: { strength: 220, castleHp: 300, enemyCount: 20, worldId: 'world1', enemies: ['N'] },
    easy: { strength: 350, castleHp: 1000, enemyCount: 35, worldId: 'world1', enemies: ['N', 'R'] },
    normal: { strength: 600, castleHp: 3500, enemyCount: 50, worldId: 'world1', enemies: ['N', 'R'] },
    frozen: { strength: 1000, castleHp: 8000, enemyCount: 65, worldId: 'world1', enemies: ['N', 'R', 'SR'] },
    hard: { strength: 1400, castleHp: 25000, enemyCount: 85, worldId: 'world1', enemies: ['R', 'SR'] },
    extreme: { strength: 2600, castleHp: 70000, enemyCount: 115, worldId: 'world1', enemies: ['R', 'SR', 'SSR'] },
    nightmare: { strength: 4200, castleHp: 200000, enemyCount: 170, worldId: 'world1', enemies: ['SR', 'SSR', 'UR'] },
    purgatory: { strength: 10000, castleHp: 500000, enemyCount: 220, worldId: 'world2', enemies: ['SSR', 'UR'] },
    hellfire: { strength: 13000, castleHp: 1000000, enemyCount: 280, worldId: 'world2', enemies: ['SSR', 'UR'] },
    abyss: { strength: 21000, castleHp: 2000000, enemyCount: 360, worldId: 'world2', enemies: ['SSR', 'UR'] },
    inferno_boss: { strength: 35000, castleHp: 5000000, enemyCount: 470, worldId: 'world2', enemies: ['UR'] }
};

const DIFFICULTY_ORDER = Object.keys(DIFFICULTY_TARGETS);

/**
 * 推奨敵ユニットを取得
 */
function getRecommendedEnemies(difficulty) {
    const target = DIFFICULTY_TARGETS[difficulty];
    if (!target) return [];

    const validRarities = target.enemies;
    return sortedEnemies.filter(function(e) {
        return validRarities.includes(e.rarity);
    });
}

/**
 * ウェーブを自動生成
 */
function generateWaves(difficulty, enemyCount) {
    const recommendedEnemies = getRecommendedEnemies(difficulty);
    if (recommendedEnemies.length === 0) {
        console.error('警告: 推奨敵が見つかりません');
        return [];
    }

    // ウェーブ数を決定（5〜10）
    const waveCount = Math.min(10, Math.max(5, Math.floor(enemyCount / 20)));
    const enemiesPerWave = Math.ceil(enemyCount / waveCount);

    const waves = [];
    let timeMs = 2000;

    for (let i = 0; i < waveCount; i++) {
        // 敵をランダムに選択（後半ほど強い敵）
        const progressRatio = i / waveCount;
        const enemyIndex = Math.floor(progressRatio * recommendedEnemies.length * 0.8);
        const enemy = recommendedEnemies[Math.min(enemyIndex, recommendedEnemies.length - 1)];

        // ウェーブごとの敵数（徐々に増加）
        const count = Math.round(enemiesPerWave * (0.8 + progressRatio * 0.4));

        // スポーン間隔（500ms〜1200ms）
        const intervalMs = Math.round(1200 - progressRatio * 500);

        waves.push({
            timeMs: timeMs,
            unitId: enemy.id,
            count: count,
            intervalMs: intervalMs
        });

        // 次のウェーブの開始時間
        timeMs += count * intervalMs + 2000;
    }

    return waves;
}

/**
 * ステージを生成
 */
function generateStage(difficulty, stageId) {
    const target = DIFFICULTY_TARGETS[difficulty];
    if (!target) {
        console.error('エラー: 不明な難易度 "' + difficulty + '"');
        return null;
    }

    const waves = generateWaves(difficulty, target.enemyCount);

    const stage = {
        id: stageId,
        name: stageId + '_name',
        description: stageId + '_desc',
        length: 1000 + Math.floor(target.enemyCount * 20),
        baseCastleHp: Math.round(target.castleHp * 0.2),
        enemyCastleHp: target.castleHp,
        enemyWaves: waves,
        reward: {
            coins: Math.round(target.castleHp * 0.5),
            drops: []
        },
        background: {
            skyColor: '0x87ceeb',
            groundColor: '0x7cb342',
            cloudColor: '0xffffff'
        },
        difficulty: difficulty
    };

    if (target.worldId === 'world2') {
        stage.worldId = 'world2';
    }

    return stage;
}

/**
 * ステージ強さを計算
 */
function calcStageStrength(stage) {
    let totalEnemyCount = 0;
    let totalEnemyPower = 0;
    let totalSpawnTime = 0;

    (stage.enemyWaves || []).forEach(function(wave) {
        const count = wave.count || 0;
        const interval = wave.intervalMs || 1000;
        const unit = enemyMap[wave.unitId];

        totalEnemyCount += count;
        if (unit) totalEnemyPower += calcPower(unit) * count;
        totalSpawnTime += count * interval;
    });

    const waveDensity = totalSpawnTime > 0 ? totalEnemyCount / (totalSpawnTime / 1000) : 0;

    return Math.round(
        (stage.enemyCastleHp || 0) * 0.0001 +
        totalEnemyCount * 2 +
        totalEnemyPower * 0.05 +
        waveDensity * 50
    );
}

// コマンドライン引数
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help') {
    console.log('\nステージ追加ウィザード');
    console.log('=====================================\n');
    console.log('使い方:');
    console.log('  node scripts/create_stage_wizard.js <難易度> <ステージID>');
    console.log('  node scripts/create_stage_wizard.js --info');
    console.log('\n例:');
    console.log('  node scripts/create_stage_wizard.js normal stage_99');
    console.log('  node scripts/create_stage_wizard.js hard my_custom_stage');
    console.log('\nオプション:');
    console.log('  --info     難易度ごとの目標値を表示');
    console.log('  --dry-run  実際には保存せずプレビューのみ');
    console.log('\n難易度一覧:');
    DIFFICULTY_ORDER.forEach(function(d) {
        console.log('  - ' + d);
    });
    console.log('');
    process.exit(0);
}

// 難易度情報表示
if (args[0] === '--info') {
    console.log('\n難易度別目標値');
    console.log('=====================================');
    console.log('難易度        | 目標強さ | 城HP      | 敵数 | 推奨レアリティ | ワールド');
    console.log('--------------|----------|-----------|------|----------------|--------');

    DIFFICULTY_ORDER.forEach(function(diff) {
        const t = DIFFICULTY_TARGETS[diff];
        console.log(
            diff.padEnd(13) + ' | ' +
            String(t.strength).padStart(8) + ' | ' +
            String(t.castleHp).padStart(9) + ' | ' +
            String(t.enemyCount).padStart(4) + ' | ' +
            t.enemies.join(', ').padEnd(14) + ' | ' +
            t.worldId
        );
    });

    // 現在のステージ数
    console.log('\n現在のステージ数:');
    const allStages = world1Stages.concat(world2Stages);
    DIFFICULTY_ORDER.forEach(function(diff) {
        const count = allStages.filter(function(s) { return s.difficulty === diff; }).length;
        if (count > 0) {
            console.log('  ' + diff + ': ' + count + '個');
        }
    });

    console.log('');
    process.exit(0);
}

// ステージ生成
const dryRun = args.includes('--dry-run');
const filteredArgs = args.filter(function(a) { return a !== '--dry-run'; });

const difficulty = filteredArgs[0];
const stageId = filteredArgs[1];

if (!stageId) {
    console.error('エラー: ステージIDを指定してください');
    console.log('使い方: node scripts/create_stage_wizard.js <難易度> <ステージID>');
    process.exit(1);
}

if (!DIFFICULTY_TARGETS[difficulty]) {
    console.error('エラー: 不明な難易度 "' + difficulty + '"');
    console.log('\n使用可能な難易度:');
    DIFFICULTY_ORDER.forEach(function(d) {
        console.log('  - ' + d);
    });
    process.exit(1);
}

// 既存ステージIDチェック
const allStages = world1Stages.concat(world2Stages);
const existingIds = allStages.map(function(s) { return s.id; });
if (existingIds.includes(stageId)) {
    console.error('エラー: ステージID "' + stageId + '" は既に存在します');
    process.exit(1);
}

// ステージ生成
const stage = generateStage(difficulty, stageId);
const strength = calcStageStrength(stage);
const target = DIFFICULTY_TARGETS[difficulty];

console.log('\nステージ生成');
console.log('=====================================\n');
console.log('難易度: ' + difficulty);
console.log('ステージID: ' + stageId);
console.log('ワールド: ' + (target.worldId || 'world1'));
console.log('\n目標強さ: ' + target.strength);
console.log('実際強さ: ' + strength + ' (' + (strength / target.strength * 100).toFixed(0) + '%)');
console.log('\n生成されたステージ:');
console.log(JSON.stringify(stage, null, 2));

if (dryRun) {
    console.log('\n[ドライラン] 保存はスキップされました');
} else {
    // 適切なファイルに保存
    if (target.worldId === 'world2') {
        world2Stages.push(stage);
        fs.writeFileSync(world2Path, JSON.stringify(world2Stages, null, 2));
        console.log('\n保存完了: ' + world2Path);
    } else {
        world1Stages.push(stage);
        fs.writeFileSync(world1Path, JSON.stringify(world1Stages, null, 2));
        console.log('\n保存完了: ' + world1Path);
    }
}

console.log('\nヒント: バランスを確認するには以下を実行:');
console.log('  node scripts/stage_strength_analyzer.js');
console.log('');
