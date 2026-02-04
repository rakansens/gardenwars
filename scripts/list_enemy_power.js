/**
 * 敵ユニット一覧＆パワー表示スクリプト
 * 全敵ユニットの強さを一覧で表示
 */

const fs = require('fs');
const path = require('path');

// データ読み込み
const enemies = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/units/enemies.json'), 'utf8'));
const bosses = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/units/bosses.json'), 'utf8'));
const allies = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/units/allies.json'), 'utf8'));

// 味方ユニットマップ
const allyMap = {};
allies.forEach(function(a) { allyMap[a.id] = a; });

/**
 * ユニットパワー計算
 */
function calcPower(unit) {
    const hp = unit.maxHp || 0;
    const atk = unit.attackDamage || 0;
    const speed = unit.speed || 0;
    return Math.round(hp * 0.001 + atk * 0.5 + speed * 2);
}

/**
 * DPS計算（1秒あたりのダメージ）
 */
function calcDPS(unit) {
    const atk = unit.attackDamage || 0;
    const cooldown = unit.attackCooldownMs || 1000;
    return Math.round(atk / (cooldown / 1000));
}

/**
 * レアリティでソート用の順序
 */
const RARITY_ORDER = { 'N': 1, 'R': 2, 'SR': 3, 'SSR': 4, 'UR': 5 };

console.log('\n=======================================================================');
console.log('              敵ユニット一覧＆パワー表示');
console.log('=======================================================================\n');

console.log('【計算式】');
console.log('  パワー = HP×0.001 + ATK×0.5 + Speed×2');
console.log('  DPS = ATK ÷ (クールダウン秒)\n');

// 雑魚敵一覧
console.log('-------------------------------------------------------------------');
console.log('                      雑魚敵ユニット');
console.log('-------------------------------------------------------------------');
console.log('ID                    | レア | HP     | ATK   | SPD | パワー | DPS  | ベース');
console.log('----------------------|------|--------|-------|-----|--------|------|--------');

// レアリティでソート
const sortedEnemies = enemies.slice().sort(function(a, b) {
    const rarityA = RARITY_ORDER[a.rarity] || 0;
    const rarityB = RARITY_ORDER[b.rarity] || 0;
    if (rarityA !== rarityB) return rarityA - rarityB;
    return calcPower(a) - calcPower(b);
});

sortedEnemies.forEach(function(enemy) {
    const power = calcPower(enemy);
    const dps = calcDPS(enemy);
    const baseUnit = enemy.baseUnitId || '-';

    console.log(
        enemy.id.padEnd(21) + ' | ' +
        (enemy.rarity || '-').padEnd(4) + ' | ' +
        String(enemy.maxHp || 0).padStart(6) + ' | ' +
        String(enemy.attackDamage || 0).padStart(5) + ' | ' +
        String(enemy.speed || 0).padStart(3) + ' | ' +
        String(power).padStart(6) + ' | ' +
        String(dps).padStart(4) + ' | ' +
        baseUnit
    );
});

// ボス一覧
console.log('\n-------------------------------------------------------------------');
console.log('                      ボスユニット');
console.log('-------------------------------------------------------------------');
console.log('ID                    | レア | HP       | ATK    | SPD | パワー  | DPS');
console.log('----------------------|------|----------|--------|-----|---------|------');

const sortedBosses = bosses.slice().sort(function(a, b) {
    return calcPower(a) - calcPower(b);
});

sortedBosses.forEach(function(boss) {
    const power = calcPower(boss);
    const dps = calcDPS(boss);

    console.log(
        boss.id.padEnd(21) + ' | ' +
        (boss.rarity || 'BOSS').padEnd(4) + ' | ' +
        String(boss.maxHp || 0).padStart(8) + ' | ' +
        String(boss.attackDamage || 0).padStart(6) + ' | ' +
        String(boss.speed || 0).padStart(3) + ' | ' +
        String(power).padStart(7) + ' | ' +
        String(dps).padStart(5)
    );
});

// 統計
console.log('\n-------------------------------------------------------------------');
console.log('                      統計サマリー');
console.log('-------------------------------------------------------------------\n');

const enemyPowers = enemies.map(calcPower);
const bossPowers = bosses.map(calcPower);

console.log('【雑魚敵】');
console.log('  総数: ' + enemies.length + ' 体');
console.log('  パワー範囲: ' + Math.min.apply(null, enemyPowers) + ' ～ ' + Math.max.apply(null, enemyPowers));
console.log('  平均パワー: ' + Math.round(enemyPowers.reduce(function(a, b) { return a + b; }, 0) / enemyPowers.length));

console.log('\n【ボス】');
console.log('  総数: ' + bosses.length + ' 体');
console.log('  パワー範囲: ' + Math.min.apply(null, bossPowers) + ' ～ ' + Math.max.apply(null, bossPowers));
console.log('  平均パワー: ' + Math.round(bossPowers.reduce(function(a, b) { return a + b; }, 0) / bossPowers.length));

// レアリティ別統計
console.log('\n【レアリティ別パワー平均】');
const rarityStats = {};
enemies.forEach(function(e) {
    const rarity = e.rarity || 'N';
    if (!rarityStats[rarity]) rarityStats[rarity] = [];
    rarityStats[rarity].push(calcPower(e));
});

Object.keys(rarityStats).sort(function(a, b) {
    return (RARITY_ORDER[a] || 0) - (RARITY_ORDER[b] || 0);
}).forEach(function(rarity) {
    const powers = rarityStats[rarity];
    const avg = Math.round(powers.reduce(function(a, b) { return a + b; }, 0) / powers.length);
    console.log('  ' + rarity.padEnd(3) + ': 平均 ' + avg + ' （' + powers.length + '体）');
});

// 味方との比較
console.log('\n-------------------------------------------------------------------');
console.log('                 味方版との比較（baseUnitId持ち）');
console.log('-------------------------------------------------------------------');
console.log('敵ID                  | 敵パワー | 味方パワー | 差分');
console.log('----------------------|----------|------------|------');

enemies.filter(function(e) { return e.baseUnitId; }).forEach(function(enemy) {
    const ally = allyMap[enemy.baseUnitId];
    if (!ally) return;

    const enemyPower = calcPower(enemy);
    const allyPower = calcPower(ally);
    const diff = enemyPower - allyPower;
    const diffStr = diff >= 0 ? '+' + diff : String(diff);

    console.log(
        enemy.id.padEnd(21) + ' | ' +
        String(enemyPower).padStart(8) + ' | ' +
        String(allyPower).padStart(10) + ' | ' +
        diffStr.padStart(5)
    );
});

console.log('\n');
