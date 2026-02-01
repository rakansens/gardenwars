#!/usr/bin/env node
/**
 * ロール再バランススクリプト
 * 各レアリティごとにロールを均等に分配し、ステータスに基づいて最適化
 */

const fs = require('fs');
const path = require('path');

const alliesPath = path.join(__dirname, '../src/data/units/allies.json');
const allies = JSON.parse(fs.readFileSync(alliesPath, 'utf8'));

const ROLES = ['tank', 'attacker', 'ranger', 'speedster', 'flying', 'balanced'];
const RARITIES = ['UR', 'SSR', 'SR', 'R', 'N'];

/**
 * ユニットの各ロールに対するスコアを計算
 */
function calculateRoleScores(unit, rarityUnits) {
  // 正しいフィールド名: attackCooldownMs (attackSpeedではない)
  const maxHp = Math.max(...rarityUnits.map(u => u.maxHp));
  const minHp = Math.min(...rarityUnits.map(u => u.maxHp));
  const maxSpeed = Math.max(...rarityUnits.map(u => u.speed));
  const minSpeed = Math.min(...rarityUnits.map(u => u.speed));
  const maxRange = Math.max(...rarityUnits.map(u => u.attackRange));
  const minRange = Math.min(...rarityUnits.map(u => u.attackRange));
  const maxDamage = Math.max(...rarityUnits.map(u => u.attackDamage));
  const minDamage = Math.min(...rarityUnits.map(u => u.attackDamage));
  const maxCooldown = Math.max(...rarityUnits.map(u => u.attackCooldownMs));
  const minCooldown = Math.min(...rarityUnits.map(u => u.attackCooldownMs));

  const normalize = (val, min, max) => max === min ? 0.5 : (val - min) / (max - min);

  const hpNorm = normalize(unit.maxHp, minHp, maxHp);
  const speedNorm = normalize(unit.speed, minSpeed, maxSpeed);
  const rangeNorm = normalize(unit.attackRange, minRange, maxRange);
  const damageNorm = normalize(unit.attackDamage, minDamage, maxDamage);
  // 攻撃クールダウンは低いほど良い (= 攻撃速度が速い)
  const attackSpeedNorm = 1 - normalize(unit.attackCooldownMs, minCooldown, maxCooldown);

  // DPS計算
  const dps = unit.attackDamage / (unit.attackCooldownMs / 1000);
  const allDps = rarityUnits.map(u => u.attackDamage / (u.attackCooldownMs / 1000));
  const maxDps = Math.max(...allDps);
  const minDps = Math.min(...allDps);
  const dpsNorm = normalize(dps, minDps, maxDps);

  return {
    // Tank: 高HP、低速度、低DPS
    tank: (hpNorm * 0.6) + ((1 - dpsNorm) * 0.25) + ((1 - speedNorm) * 0.15),

    // Attacker: 高DPS、高ダメージ、近距離
    attacker: (dpsNorm * 0.45) + (damageNorm * 0.35) + ((1 - rangeNorm) * 0.2),

    // Ranger: 長射程、中DPS
    ranger: (rangeNorm * 0.6) + (dpsNorm * 0.25) + ((1 - hpNorm) * 0.15),

    // Speedster: 高速度、速い攻撃
    speedster: (speedNorm * 0.5) + (attackSpeedNorm * 0.3) + (dpsNorm * 0.2),

    // Flying: isFlying属性優先
    flying: unit.isFlying ? 10.0 : 0,  // isFlying属性がないとflyingにはならない

    // Balanced: 中間的なステータス
    balanced: (
      (1 - Math.abs(hpNorm - 0.5) * 2) * 0.25 +
      (1 - Math.abs(speedNorm - 0.5) * 2) * 0.25 +
      (1 - Math.abs(dpsNorm - 0.5) * 2) * 0.25 +
      (1 - Math.abs(rangeNorm - 0.5) * 2) * 0.25
    )
  };
}

/**
 * レアリティごとにロールを均等に割り当て
 */
function assignRolesForRarity(units) {
  const totalUnits = units.length;

  // isFlying属性を持つユニット数を確認
  const flyingUnits = units.filter(u => u.isFlying);
  const nonFlyingRoles = ['tank', 'attacker', 'ranger', 'speedster', 'balanced'];

  // Flying以外のロールの目標数を計算
  const nonFlyingCount = totalUnits - flyingUnits.length;
  const targetPerNonFlyingRole = Math.floor(nonFlyingCount / nonFlyingRoles.length);
  const remainder = nonFlyingCount % nonFlyingRoles.length;

  const roleTargets = {
    flying: flyingUnits.length,
    tank: targetPerNonFlyingRole + (0 < remainder ? 1 : 0),
    attacker: targetPerNonFlyingRole + (1 < remainder ? 1 : 0),
    ranger: targetPerNonFlyingRole + (2 < remainder ? 1 : 0),
    speedster: targetPerNonFlyingRole + (3 < remainder ? 1 : 0),
    balanced: targetPerNonFlyingRole + (4 < remainder ? 1 : 0),
  };

  // 全ユニットのスコアを計算
  const unitScores = units.map(unit => ({
    unit,
    scores: calculateRoleScores(unit, units),
    assigned: false
  }));

  const roleCounts = { tank: 0, attacker: 0, ranger: 0, speedster: 0, flying: 0, balanced: 0 };
  const assignments = [];

  // Step 1: isFlying属性を持つユニットをflyingに割り当て
  unitScores.forEach(item => {
    if (item.unit.isFlying) {
      item.unit.role = 'flying';
      roleCounts.flying++;
      item.assigned = true;
      assignments.push({ unit: item.unit, role: 'flying', reason: 'isFlying属性' });
    }
  });

  // Step 2: 各ロール（flying以外）について、最もスコアが高いユニットを順次割り当て
  for (const role of nonFlyingRoles) {
    const targetCount = roleTargets[role];

    while (roleCounts[role] < targetCount) {
      // 未割り当てユニットから、このロールに最も適したユニットを探す
      let bestItem = null;
      let bestScore = -1;

      for (const item of unitScores) {
        if (item.assigned) continue;
        if (item.scores[role] > bestScore) {
          bestScore = item.scores[role];
          bestItem = item;
        }
      }

      if (bestItem) {
        bestItem.unit.role = role;
        bestItem.assigned = true;
        roleCounts[role]++;
        assignments.push({
          unit: bestItem.unit,
          role: role,
          score: bestScore.toFixed(3)
        });
      } else {
        break;
      }
    }
  }

  // Step 3: 残りのユニットをbalancedに割り当て
  unitScores.forEach(item => {
    if (!item.assigned) {
      item.unit.role = 'balanced';
      roleCounts.balanced++;
      item.assigned = true;
      assignments.push({ unit: item.unit, role: 'balanced', reason: '残り' });
    }
  });

  return { roleTargets, roleCounts, assignments };
}

// メイン処理
console.log('🔄 ロール再バランス処理を開始...\n');

// 元の分布を保存
const originalDist = {};
RARITIES.forEach(rarity => {
  originalDist[rarity] = {};
  const units = allies.filter(u => u.rarity === rarity);
  ROLES.forEach(role => {
    originalDist[rarity][role] = units.filter(u => u.role === role).length;
  });
});

// レアリティごとに処理
const results = {};
RARITIES.forEach(rarity => {
  const units = allies.filter(u => u.rarity === rarity);
  results[rarity] = assignRolesForRarity(units);
});

// 結果を表示
console.log('='.repeat(60));
console.log('📊 ロール分布の変化');
console.log('='.repeat(60));

RARITIES.forEach(rarity => {
  const units = allies.filter(u => u.rarity === rarity);
  const flyingCount = units.filter(u => u.isFlying).length;
  console.log(`\n【${rarity}】 ${units.length}体 (Flying属性: ${flyingCount}体)`);
  console.log('-'.repeat(50));

  ROLES.forEach(role => {
    const before = originalDist[rarity][role];
    const after = results[rarity].roleCounts[role];
    const target = results[rarity].roleTargets[role];
    const diff = after - before;
    const diffStr = diff > 0 ? `+${diff}` : diff === 0 ? '±0' : `${diff}`;
    const check = after === target ? '✅' : '⚠️';
    console.log(`  ${role.padEnd(10)}: ${String(before).padStart(2)} → ${String(after).padStart(2)} (${diffStr.padStart(3)}) 目標:${target} ${check}`);
  });
});

// 全体の変化
console.log('\n' + '='.repeat(60));
console.log('📈 全体の変化');
console.log('='.repeat(60));

ROLES.forEach(role => {
  const beforeTotal = Object.values(originalDist).reduce((sum, r) => sum + r[role], 0);
  const after = allies.filter(u => u.role === role).length;
  const diff = after - beforeTotal;
  const diffStr = diff > 0 ? `+${diff}` : diff === 0 ? '±0' : `${diff}`;
  console.log(`  ${role.padEnd(10)}: ${String(beforeTotal).padStart(2)} → ${String(after).padStart(2)} (${diffStr})`);
});

// ファイル保存
fs.writeFileSync(alliesPath, JSON.stringify(allies, null, 2) + '\n', 'utf8');

console.log('\n' + '='.repeat(60));
console.log('✅ allies.json を更新しました！');
console.log('='.repeat(60));

// 割り当て詳細（ロールごと）
console.log('\n📋 割り当て詳細:');
RARITIES.forEach(rarity => {
  console.log(`\n【${rarity}】`);
  const grouped = {};
  ROLES.forEach(r => grouped[r] = []);

  results[rarity].assignments.forEach(a => {
    grouped[a.role].push(a);
  });

  ROLES.forEach(role => {
    if (grouped[role].length === 0) return;
    const names = grouped[role].slice(0, 4).map(a => a.unit.name).join(', ');
    const more = grouped[role].length > 4 ? ` +${grouped[role].length - 4}体` : '';
    console.log(`  ${role.padEnd(10)}: ${names}${more}`);
  });
});
