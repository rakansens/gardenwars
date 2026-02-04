/**
 * 味方→敵ユニット自動生成スクリプト
 * 味方ユニットを元に敵バージョンを生成
 *
 * 使い方:
 *   node scripts/generate_enemy_from_ally.js <味方ID> [倍率]
 *
 * 例:
 *   node scripts/generate_enemy_from_ally.js cat_warrior        # 0.9倍で生成
 *   node scripts/generate_enemy_from_ally.js cat_mage 1.2       # 1.2倍で生成
 *   node scripts/generate_enemy_from_ally.js --all              # 未生成の全味方を変換
 *   node scripts/generate_enemy_from_ally.js --list             # 味方一覧表示
 */

const fs = require('fs');
const path = require('path');

// データ読み込み
const alliesPath = path.join(__dirname, '../src/data/units/allies.json');
const enemiesPath = path.join(__dirname, '../src/data/units/enemies.json');
const allies = JSON.parse(fs.readFileSync(alliesPath, 'utf8'));
const enemies = JSON.parse(fs.readFileSync(enemiesPath, 'utf8'));

// 既存の敵ID一覧
const existingEnemyBaseIds = new Set();
enemies.forEach(function(e) {
    if (e.baseUnitId) existingEnemyBaseIds.add(e.baseUnitId);
});

/**
 * 味方から敵ユニットを生成
 */
function generateEnemy(ally, scale) {
    scale = scale || 0.9;

    const enemy = {
        id: 'enemy_' + ally.id,
        name: 'Dark ' + ally.name,
        rarity: ally.rarity,
        cost: 0,  // 敵はコスト0
        maxHp: Math.round(ally.maxHp * scale),
        speed: Math.round(ally.speed * scale),
        attackDamage: Math.round(ally.attackDamage * scale),
        attackRange: ally.attackRange,
        attackCooldownMs: ally.attackCooldownMs,
        attackWindupMs: ally.attackWindupMs,
        knockback: ally.knockback,
        scale: ally.scale,
        baseUnitId: ally.id,
        flipSprite: true
    };

    // オプション属性をコピー
    if (ally.isFlying) enemy.isFlying = true;
    if (ally.atlasKey) enemy.atlasKey = ally.atlasKey;
    if (ally.animKeys) enemy.animKeys = ally.animKeys;

    return enemy;
}

/**
 * パワー計算
 */
function calcPower(unit) {
    return Math.round((unit.maxHp || 0) * 0.001 + (unit.attackDamage || 0) * 0.5 + (unit.speed || 0) * 2);
}

// コマンドライン引数
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help') {
    console.log('\n味方→敵ユニット自動生成スクリプト');
    console.log('=====================================\n');
    console.log('使い方:');
    console.log('  node scripts/generate_enemy_from_ally.js <味方ID> [倍率]');
    console.log('  node scripts/generate_enemy_from_ally.js --all [倍率]');
    console.log('  node scripts/generate_enemy_from_ally.js --list');
    console.log('\n例:');
    console.log('  node scripts/generate_enemy_from_ally.js cat_warrior        # 0.9倍');
    console.log('  node scripts/generate_enemy_from_ally.js cat_mage 1.2       # 1.2倍');
    console.log('  node scripts/generate_enemy_from_ally.js --all              # 未生成全部');
    console.log('\nオプション:');
    console.log('  --list    味方ユニット一覧を表示');
    console.log('  --all     まだ敵版がない味方を全て変換');
    console.log('  --dry-run 実際には保存せずプレビューのみ');
    console.log('');
    process.exit(0);
}

// 味方一覧表示
if (args[0] === '--list') {
    console.log('\n味方ユニット一覧');
    console.log('=====================================');
    console.log('ID                  | レア | HP    | ATK  | パワー | 敵版');
    console.log('--------------------|------|-------|------|--------|------');

    allies.forEach(function(ally) {
        const hasEnemy = existingEnemyBaseIds.has(ally.id);
        console.log(
            ally.id.padEnd(19) + ' | ' +
            (ally.rarity || '-').padEnd(4) + ' | ' +
            String(ally.maxHp || 0).padStart(5) + ' | ' +
            String(ally.attackDamage || 0).padStart(4) + ' | ' +
            String(calcPower(ally)).padStart(6) + ' | ' +
            (hasEnemy ? '✓' : '-')
        );
    });

    const withoutEnemy = allies.filter(function(a) { return !existingEnemyBaseIds.has(a.id); });
    console.log('\n敵版がないユニット: ' + withoutEnemy.length + '体');
    console.log('');
    process.exit(0);
}

// ドライラン判定
const dryRun = args.includes('--dry-run');
const filteredArgs = args.filter(function(a) { return a !== '--dry-run'; });

// 全味方を変換
if (filteredArgs[0] === '--all') {
    const scale = parseFloat(filteredArgs[1]) || 0.9;
    const toGenerate = allies.filter(function(a) { return !existingEnemyBaseIds.has(a.id); });

    if (toGenerate.length === 0) {
        console.log('\n全ての味方ユニットに敵版が存在します。');
        process.exit(0);
    }

    console.log('\n' + toGenerate.length + '体の敵ユニットを生成（倍率: ' + scale + 'x）');
    console.log('=====================================\n');

    const newEnemies = [];
    toGenerate.forEach(function(ally) {
        const enemy = generateEnemy(ally, scale);
        newEnemies.push(enemy);
        console.log('  生成: ' + enemy.id + ' (パワー: ' + calcPower(enemy) + ')');
    });

    if (dryRun) {
        console.log('\n[ドライラン] 保存はスキップされました');
        console.log('\nプレビュー（最初の1体）:');
        console.log(JSON.stringify(newEnemies[0], null, 2));
    } else {
        // enemies.json に追加
        const updatedEnemies = enemies.concat(newEnemies);
        fs.writeFileSync(enemiesPath, JSON.stringify(updatedEnemies, null, 2));
        console.log('\n保存完了: ' + enemiesPath);
    }
    console.log('');
    process.exit(0);
}

// 個別の味方を変換
const allyId = filteredArgs[0];
const scale = parseFloat(filteredArgs[1]) || 0.9;

// 味方を検索
const ally = allies.find(function(a) { return a.id === allyId; });

if (!ally) {
    console.error('\nエラー: 味方ユニット "' + allyId + '" が見つかりません');
    console.log('\n使用可能な味方ID:');
    allies.forEach(function(a) {
        console.log('  - ' + a.id);
    });
    process.exit(1);
}

// 既に敵版があるかチェック
if (existingEnemyBaseIds.has(allyId)) {
    console.log('\n警告: ' + allyId + ' の敵版は既に存在します');
    const existing = enemies.find(function(e) { return e.baseUnitId === allyId; });
    console.log('既存の敵: ' + existing.id);
    process.exit(1);
}

// 敵ユニットを生成
const enemy = generateEnemy(ally, scale);

console.log('\n敵ユニット生成');
console.log('=====================================\n');
console.log('元の味方: ' + ally.id + ' (パワー: ' + calcPower(ally) + ')');
console.log('生成倍率: ' + scale + 'x');
console.log('\n生成された敵:');
console.log(JSON.stringify(enemy, null, 2));
console.log('\nパワー: ' + calcPower(enemy));

if (dryRun) {
    console.log('\n[ドライラン] 保存はスキップされました');
} else {
    enemies.push(enemy);
    fs.writeFileSync(enemiesPath, JSON.stringify(enemies, null, 2));
    console.log('\n保存完了: ' + enemiesPath);
}
console.log('');
