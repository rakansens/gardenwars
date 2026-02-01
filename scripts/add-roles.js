#!/usr/bin/env node
/**
 * 全キャラにロールを追加するスクリプト
 * ステータスから自動判定してroleフィールドを付与
 */

const fs = require('fs');
const path = require('path');

const alliesPath = path.join(__dirname, '../src/data/units/allies.json');
const allies = JSON.parse(fs.readFileSync(alliesPath, 'utf8'));

// レアリティ別の平均値を計算
function calcRarityAverages(units) {
  const byRarity = {};

  units.forEach(unit => {
    if (!byRarity[unit.rarity]) {
      byRarity[unit.rarity] = { hp: 0, dps: 0, count: 0 };
    }
    const dps = unit.attackDamage / (unit.attackCooldownMs / 1000);
    byRarity[unit.rarity].hp += unit.maxHp;
    byRarity[unit.rarity].dps += dps;
    byRarity[unit.rarity].count++;
  });

  Object.keys(byRarity).forEach(rarity => {
    const count = byRarity[rarity].count;
    byRarity[rarity].hp = byRarity[rarity].hp / count;
    byRarity[rarity].dps = byRarity[rarity].dps / count;
  });

  return byRarity;
}

// ステータスからロールを自動判定
function detectRole(unit, rarityAvg) {
  // 飛行判定
  if (unit.isFlying) {
    return 'flying';
  }

  const dps = unit.attackDamage / (unit.attackCooldownMs / 1000);
  const hpRatio = unit.maxHp / rarityAvg.hp;
  const dpsRatio = dps / rarityAvg.dps;

  // タンク判定：HP高い & DPS低い & 速度遅い
  if (hpRatio >= 1.4 && dpsRatio <= 0.6 && unit.speed <= 45) {
    return 'tank';
  }

  // スピードスター判定：速度速い & 攻撃間隔短い
  if (unit.speed >= 85 && unit.attackCooldownMs <= 1100) {
    return 'speedster';
  }

  // レンジャー判定：射程長い
  if (unit.attackRange >= 180) {
    return 'ranger';
  }

  // アタッカー判定：DPS高い & 射程短い
  if (dpsRatio >= 1.2 && unit.attackRange <= 100) {
    return 'attacker';
  }

  // それ以外はバランス型
  return 'balanced';
}

// メイン処理
const rarityData = calcRarityAverages(allies);
const roleCounts = {};

allies.forEach(unit => {
  const rarityAvg = rarityData[unit.rarity];
  const role = detectRole(unit, rarityAvg);
  unit.role = role;

  roleCounts[role] = (roleCounts[role] || 0) + 1;
});

// ファイル保存
fs.writeFileSync(alliesPath, JSON.stringify(allies, null, 2) + '\n', 'utf8');

console.log('✅ 全キャラにロールを追加しました！\n');
console.log('【ロール別集計】');
console.log('-'.repeat(40));

const roleNames = {
  tank: '🛡️ タンク',
  attacker: '⚔️ アタッカー',
  ranger: '🏹 レンジャー',
  speedster: '💨 スピードスター',
  flying: '🦋 フライング',
  balanced: '⚖️ バランス型'
};

Object.keys(roleNames).forEach(role => {
  const count = roleCounts[role] || 0;
  console.log(`${roleNames[role]}: ${count}体`);
});

console.log('-'.repeat(40));
console.log(`合計: ${allies.length}体`);
