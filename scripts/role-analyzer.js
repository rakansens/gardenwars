#!/usr/bin/env node
/**
 * ロール分析・バランスチェックスクリプト
 * キャラのステータスからロールを自動判定し、ロール別の基準でチェック
 */

const fs = require('fs');
const path = require('path');

const alliesPath = path.join(__dirname, '../src/data/units/allies.json');
const allies = JSON.parse(fs.readFileSync(alliesPath, 'utf8'));

// ロール定義と判定基準
const ROLES = {
  tank: {
    name: 'タンク（壁役）',
    description: 'HPが高く、敵の攻撃を受け止める',
    icon: '🛡️'
  },
  attacker: {
    name: 'アタッカー（近接火力）',
    description: 'DPSが高く、近距離で戦う',
    icon: '⚔️'
  },
  ranger: {
    name: 'レンジャー（遠距離）',
    description: '射程が長く、後方から攻撃',
    icon: '🏹'
  },
  speedster: {
    name: 'スピードスター（速攻）',
    description: '移動と攻撃が速い',
    icon: '💨'
  },
  flying: {
    name: 'フライング（飛行）',
    description: '空を飛び、地上攻撃を回避',
    icon: '🦋'
  },
  balanced: {
    name: 'バランス型',
    description: '全体的に平均的な性能',
    icon: '⚖️'
  }
};

// ロール別の期待値（レアリティ別に調整）
const ROLE_EXPECTATIONS = {
  tank: {
    hpMultiplier: 1.5,      // 平均の1.5倍以上のHP
    dpsMultiplier: 0.5,     // 平均の0.5倍以下のDPS OK
    speedMax: 45,           // 速度は遅め
    rangeMax: 80            // 射程は短め
  },
  attacker: {
    dpsMultiplier: 1.3,     // 平均の1.3倍以上のDPS
    rangeMax: 100,          // 射程は短め
    speedMin: 50            // ある程度の速度
  },
  ranger: {
    rangeMin: 150,          // 射程150以上
    hpMultiplier: 0.8       // HPは低めでOK
  },
  speedster: {
    speedMin: 80,           // 速度80以上
    cooldownMax: 1200       // 攻撃間隔1.2秒以下
  },
  flying: {
    // isFlying: true であること
  },
  balanced: {
    // 特に極端な値がない
  }
};

// ステータスからロールを自動判定
function detectRole(unit, rarityAvg) {
  // 飛行判定
  if (unit.isFlying) {
    return 'flying';
  }

  const hpRatio = unit.maxHp / rarityAvg.hp;
  const dpsRatio = unit.dps / rarityAvg.dps;

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

// レアリティ別の平均値を計算
function calcRarityAverages(units) {
  const byRarity = {};

  units.forEach(unit => {
    if (!byRarity[unit.rarity]) {
      byRarity[unit.rarity] = { units: [], hp: 0, dps: 0, speed: 0, range: 0 };
    }
    const dps = unit.attackDamage / (unit.attackCooldownMs / 1000);
    byRarity[unit.rarity].units.push({ ...unit, dps });
    byRarity[unit.rarity].hp += unit.maxHp;
    byRarity[unit.rarity].dps += dps;
    byRarity[unit.rarity].speed += unit.speed;
    byRarity[unit.rarity].range += unit.attackRange;
  });

  Object.keys(byRarity).forEach(rarity => {
    const count = byRarity[rarity].units.length;
    byRarity[rarity].hp = Math.round(byRarity[rarity].hp / count);
    byRarity[rarity].dps = Math.round(byRarity[rarity].dps / count);
    byRarity[rarity].speed = Math.round(byRarity[rarity].speed / count);
    byRarity[rarity].range = Math.round(byRarity[rarity].range / count);
  });

  return byRarity;
}

// ロール別の問題をチェック
function checkRoleBalance(unit, role, rarityAvg) {
  const issues = [];
  const exp = ROLE_EXPECTATIONS[role];

  switch (role) {
    case 'tank':
      if (unit.maxHp < rarityAvg.hp * 1.3) {
        issues.push(`タンクなのにHP低め: ${unit.maxHp} (期待: ${Math.round(rarityAvg.hp * 1.3)}+)`);
      }
      if (unit.speed > 50) {
        issues.push(`タンクなのに速すぎ: ${unit.speed} (期待: ~50)`);
      }
      break;

    case 'attacker':
      if (unit.dps < rarityAvg.dps * 1.1) {
        issues.push(`アタッカーなのにDPS低め: ${unit.dps} (期待: ${Math.round(rarityAvg.dps * 1.1)}+)`);
      }
      if (unit.attackRange > 120) {
        issues.push(`アタッカーなのに射程長すぎ: ${unit.attackRange} (期待: ~120)`);
      }
      break;

    case 'ranger':
      if (unit.attackRange < 150) {
        issues.push(`レンジャーなのに射程短い: ${unit.attackRange} (期待: 150+)`);
      }
      break;

    case 'speedster':
      if (unit.speed < 80) {
        issues.push(`スピードスターなのに遅い: ${unit.speed} (期待: 80+)`);
      }
      if (unit.attackCooldownMs > 1200) {
        issues.push(`スピードスターなのに攻撃遅い: ${unit.attackCooldownMs}ms (期待: ~1200ms)`);
      }
      break;

    case 'flying':
      if (!unit.isFlying) {
        issues.push(`フライングなのにisFlying=false`);
      }
      break;
  }

  return issues;
}

// メイン処理
const rarityData = calcRarityAverages(allies);

// 全ユニットにロールを割り当て
const unitsWithRoles = [];
allies.forEach(unit => {
  const dps = Math.round(unit.attackDamage / (unit.attackCooldownMs / 1000));
  const rarityAvg = rarityData[unit.rarity];
  const role = detectRole({ ...unit, dps }, rarityAvg);
  const issues = checkRoleBalance({ ...unit, dps }, role, rarityAvg);

  unitsWithRoles.push({
    id: unit.id,
    name: unit.name,
    rarity: unit.rarity,
    role,
    hp: unit.maxHp,
    atk: unit.attackDamage,
    dps,
    speed: unit.speed,
    range: unit.attackRange,
    isFlying: unit.isFlying || false,
    issues
  });
});

// レポート出力
console.log('='.repeat(70));
console.log(' ロール分析レポート');
console.log('='.repeat(70));

// ロール別の集計
const roleCount = {};
Object.keys(ROLES).forEach(r => roleCount[r] = { UR: 0, SSR: 0, SR: 0, R: 0, N: 0, total: 0 });

unitsWithRoles.forEach(u => {
  roleCount[u.role][u.rarity]++;
  roleCount[u.role].total++;
});

console.log('\n【ロール分布】');
console.log('-'.repeat(70));
console.log('ロール'.padEnd(25) + 'UR   SSR   SR    R    N   合計');
console.log('-'.repeat(70));

Object.keys(ROLES).forEach(role => {
  const r = roleCount[role];
  const icon = ROLES[role].icon;
  const name = ROLES[role].name;
  console.log(
    `${icon} ${name}`.padEnd(25) +
    `${String(r.UR).padStart(3)}  ${String(r.SSR).padStart(3)}  ${String(r.SR).padStart(3)}  ${String(r.R).padStart(3)}  ${String(r.N).padStart(3)}   ${String(r.total).padStart(3)}`
  );
});

// レアリティ別のロール分布を表示
console.log('\n');
console.log('='.repeat(70));
console.log(' レアリティ別キャラ一覧（ロール付き）');
console.log('='.repeat(70));

['UR', 'SSR', 'SR', 'R', 'N'].forEach(rarity => {
  const units = unitsWithRoles.filter(u => u.rarity === rarity);
  console.log(`\n■ ${rarity} (${units.length}体)`);
  console.log('-'.repeat(60));

  // ロール別にグループ化
  const byRole = {};
  units.forEach(u => {
    if (!byRole[u.role]) byRole[u.role] = [];
    byRole[u.role].push(u);
  });

  Object.keys(byRole).forEach(role => {
    const icon = ROLES[role].icon;
    console.log(`\n  ${icon} ${ROLES[role].name}:`);
    byRole[role].forEach(u => {
      const stats = `HP:${u.hp} ATK:${u.atk} DPS:${u.dps} SPD:${u.speed} RNG:${u.range}`;
      console.log(`    - ${u.name.padEnd(22)} ${stats}`);
    });
  });
});

// 問題のあるユニット
const problemUnits = unitsWithRoles.filter(u => u.issues.length > 0);

console.log('\n');
console.log('='.repeat(70));
console.log(' ロール不整合レポート');
console.log('='.repeat(70));

if (problemUnits.length === 0) {
  console.log('\n✅ ロール別の不整合はありません！');
} else {
  console.log(`\n⚠️ ${problemUnits.length}件の不整合を検出\n`);

  problemUnits.forEach(u => {
    const icon = ROLES[u.role].icon;
    console.log(`${icon} 【${u.name}】(${u.rarity}) - ${ROLES[u.role].name}`);
    u.issues.forEach(issue => {
      console.log(`   ⚠️  ${issue}`);
    });
    console.log('');
  });
}

console.log('='.repeat(70));
