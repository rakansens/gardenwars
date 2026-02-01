#!/usr/bin/env node
/**
 * ユニットバランスチェックスクリプト
 * 各レアリティの基準値からの逸脱を検出
 */

const fs = require('fs');
const path = require('path');

// allies.jsonを読み込み
const alliesPath = path.join(__dirname, '../src/data/units/allies.json');
const allies = JSON.parse(fs.readFileSync(alliesPath, 'utf8'));

// レアリティ別に分類
const byRarity = {
  UR: [],
  SSR: [],
  SR: [],
  R: [],
  N: []
};

allies.forEach(unit => {
  if (byRarity[unit.rarity]) {
    // DPS計算
    const dps = Math.round(unit.attackDamage / (unit.attackCooldownMs / 1000));
    byRarity[unit.rarity].push({
      ...unit,
      dps
    });
  }
});

// 統計計算
function calcStats(units) {
  if (units.length === 0) return null;

  const stats = {
    count: units.length,
    cost: { min: Infinity, max: -Infinity, avg: 0 },
    hp: { min: Infinity, max: -Infinity, avg: 0 },
    atk: { min: Infinity, max: -Infinity, avg: 0 },
    dps: { min: Infinity, max: -Infinity, avg: 0 },
    spawnCD: { min: Infinity, max: -Infinity, avg: 0 }
  };

  units.forEach(u => {
    stats.cost.min = Math.min(stats.cost.min, u.cost);
    stats.cost.max = Math.max(stats.cost.max, u.cost);
    stats.cost.avg += u.cost;

    stats.hp.min = Math.min(stats.hp.min, u.maxHp);
    stats.hp.max = Math.max(stats.hp.max, u.maxHp);
    stats.hp.avg += u.maxHp;

    stats.atk.min = Math.min(stats.atk.min, u.attackDamage);
    stats.atk.max = Math.max(stats.atk.max, u.attackDamage);
    stats.atk.avg += u.attackDamage;

    stats.dps.min = Math.min(stats.dps.min, u.dps);
    stats.dps.max = Math.max(stats.dps.max, u.dps);
    stats.dps.avg += u.dps;

    if (u.spawnCooldownMs) {
      stats.spawnCD.min = Math.min(stats.spawnCD.min, u.spawnCooldownMs);
      stats.spawnCD.max = Math.max(stats.spawnCD.max, u.spawnCooldownMs);
      stats.spawnCD.avg += u.spawnCooldownMs;
    }
  });

  stats.cost.avg = Math.round(stats.cost.avg / units.length);
  stats.hp.avg = Math.round(stats.hp.avg / units.length);
  stats.atk.avg = Math.round(stats.atk.avg / units.length);
  stats.dps.avg = Math.round(stats.dps.avg / units.length);

  const withSpawnCD = units.filter(u => u.spawnCooldownMs);
  if (withSpawnCD.length > 0) {
    stats.spawnCD.avg = Math.round(stats.spawnCD.avg / withSpawnCD.length);
  } else {
    stats.spawnCD = null;
  }

  return stats;
}

// 基準値（レアリティ別の期待範囲）
const expectations = {
  UR: {
    cost: { min: 3000, max: 7000 },
    hp: { min: 4000, max: 30000 },
    atk: { min: 1500, max: 5000 },
    dps: { min: 700, max: 3500 },
    spawnCD: { min: 15000, max: 35000 }
  },
  SSR: {
    cost: { min: 1200, max: 4500 },
    hp: { min: 2500, max: 10000 },
    atk: { min: 500, max: 2000 },
    dps: { min: 200, max: 1200 },
    spawnCD: { min: 10000, max: 15000 }
  },
  SR: {
    cost: { min: 350, max: 700 },
    hp: { min: 400, max: 1500 },
    atk: { min: 50, max: 350 },
    dps: { min: 30, max: 250 },
    spawnCD: { min: 5000, max: 11000 }
  },
  R: {
    cost: { min: 50, max: 400 },
    hp: { min: 200, max: 1500 },
    atk: { min: 40, max: 150 },
    dps: { min: 25, max: 150 },
    spawnCD: null
  },
  N: {
    cost: { min: 20, max: 120 },
    hp: { min: 100, max: 1600 },
    atk: { min: 15, max: 80 },
    dps: { min: 10, max: 100 },
    spawnCD: null
  }
};

// 異常検出
function findAnomalies(units, rarity) {
  const exp = expectations[rarity];
  const anomalies = [];

  units.forEach(u => {
    const issues = [];

    // コスト
    if (u.cost < exp.cost.min) issues.push(`コスト低すぎ: ${u.cost} (基準: ${exp.cost.min}+)`);
    if (u.cost > exp.cost.max) issues.push(`コスト高すぎ: ${u.cost} (基準: ~${exp.cost.max})`);

    // HP
    if (u.maxHp < exp.hp.min) issues.push(`HP低すぎ: ${u.maxHp} (基準: ${exp.hp.min}+)`);
    if (u.maxHp > exp.hp.max) issues.push(`HP高すぎ: ${u.maxHp} (基準: ~${exp.hp.max})`);

    // ATK
    if (u.attackDamage < exp.atk.min) issues.push(`ATK低すぎ: ${u.attackDamage} (基準: ${exp.atk.min}+)`);
    if (u.attackDamage > exp.atk.max) issues.push(`ATK高すぎ: ${u.attackDamage} (基準: ~${exp.atk.max})`);

    // DPS
    if (u.dps < exp.dps.min) issues.push(`DPS低すぎ: ${u.dps} (基準: ${exp.dps.min}+)`);
    if (u.dps > exp.dps.max) issues.push(`DPS高すぎ: ${u.dps} (基準: ~${exp.dps.max})`);

    // SpawnCD
    if (exp.spawnCD && u.spawnCooldownMs) {
      if (u.spawnCooldownMs < exp.spawnCD.min) issues.push(`SpawnCD短すぎ: ${u.spawnCooldownMs/1000}秒 (基準: ${exp.spawnCD.min/1000}秒+)`);
      if (u.spawnCooldownMs > exp.spawnCD.max) issues.push(`SpawnCD長すぎ: ${u.spawnCooldownMs/1000}秒 (基準: ~${exp.spawnCD.max/1000}秒)`);
    }

    if (issues.length > 0) {
      anomalies.push({
        id: u.id,
        name: u.name,
        issues
      });
    }
  });

  return anomalies;
}

// レポート出力
console.log('='.repeat(70));
console.log(' ユニットバランスチェックレポート');
console.log('='.repeat(70));
console.log('');

// 各レアリティの統計
console.log('【レアリティ別統計】');
console.log('-'.repeat(70));

Object.keys(byRarity).forEach(rarity => {
  const units = byRarity[rarity];
  const stats = calcStats(units);
  if (!stats) return;

  console.log(`\n■ ${rarity} (${stats.count}体)`);
  console.log(`  Cost  : ${stats.cost.min} ~ ${stats.cost.max} (平均: ${stats.cost.avg})`);
  console.log(`  HP    : ${stats.hp.min} ~ ${stats.hp.max} (平均: ${stats.hp.avg})`);
  console.log(`  ATK   : ${stats.atk.min} ~ ${stats.atk.max} (平均: ${stats.atk.avg})`);
  console.log(`  DPS   : ${stats.dps.min} ~ ${stats.dps.max} (平均: ${stats.dps.avg})`);
  if (stats.spawnCD) {
    console.log(`  Spawn : ${stats.spawnCD.min/1000}秒 ~ ${stats.spawnCD.max/1000}秒 (平均: ${stats.spawnCD.avg/1000}秒)`);
  }
});

console.log('\n');
console.log('='.repeat(70));
console.log(' 異常検出レポート');
console.log('='.repeat(70));

let totalAnomalies = 0;

Object.keys(byRarity).forEach(rarity => {
  const anomalies = findAnomalies(byRarity[rarity], rarity);

  if (anomalies.length > 0) {
    console.log(`\n■ ${rarity} - ${anomalies.length}件の問題`);
    console.log('-'.repeat(50));

    anomalies.forEach(a => {
      console.log(`\n  【${a.name}】(${a.id})`);
      a.issues.forEach(issue => {
        console.log(`    ⚠️  ${issue}`);
      });
    });

    totalAnomalies += anomalies.length;
  } else {
    console.log(`\n■ ${rarity} - 問題なし ✅`);
  }
});

console.log('\n');
console.log('='.repeat(70));
console.log(` 合計: ${totalAnomalies}件の問題を検出`);
console.log('='.repeat(70));

// 終了コード
process.exit(totalAnomalies > 0 ? 1 : 0);
