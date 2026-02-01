#!/usr/bin/env node
/**
 * 範囲攻撃を特定キャラに追加するスクリプト
 */

const fs = require('fs');
const path = require('path');

const alliesPath = path.join(__dirname, '../src/data/units/allies.json');
const allies = JSON.parse(fs.readFileSync(alliesPath, 'utf8'));

// 範囲攻撃を付与するキャラとその設定（正しいID）
const areaAttackUnits = {
  // UR (10体)
  'ur_mage': { areaRadius: 100 },          // Shadow Demon
  'ur_ninja': { areaRadius: 80 },          // Grape Storm King
  'ur_dragon': { areaRadius: 90 },         // Void Carnivine
  'ur_phoenix': { areaRadius: 80 },        // Inferno Stump
  'ur_golem': { areaRadius: 70 },          // Thunder Lotus
  'thunder_golem': { areaRadius: 70 },     // Thunder Golem
  'flame_knight': { areaRadius: 80 },      // Flame Knight
  'ur_cosmic_dragon': { areaRadius: 100 }, // Cosmic Dragon
  'ur_jade_dragon': { areaRadius: 90 },    // Jade Emperor Dragon
  'ur_frost_giant': { areaRadius: 80 },    // Frost Giant

  // SSR (7体)
  'ur_inferno_demon': { areaRadius: 70 },   // Inferno Demon (実際はSSRだがID命名ミス)
  'ur_fire_lotus_cat': { areaRadius: 70 },  // Fire Lotus Cat
  'ur_astral_wizard': { areaRadius: 100 },  // Astral Wizard
  'ur_thunder_phoenix': { areaRadius: 80 }, // Thunder Phoenix
  'ssr_higanbana_mage': { areaRadius: 100 },
  'ssr_frost_empress': { areaRadius: 90 },
  'ssr_rainbow_storm': { areaRadius: 100 },

  // SR (4体)
  'cat_mage': { areaRadius: 80 },
  'ur_emerald_dragon': { areaRadius: 70 },  // Emerald Dragon Flower (実際はSR)
  'sr_frost_rose_queen': { areaRadius: 80 },
  'sr_demon_mage': { areaRadius: 90 },

  // R (1体)
  'r_fire_chili': { areaRadius: 50 },

  // N (3体)
  'n_apple': { areaRadius: 40 },      // Dragon Fruit
  'n_grape': { areaRadius: 40 },      // Fire Hydra
  'n_cherry_bomb': { areaRadius: 60 },
};

let addedCount = 0;
const addedUnits = [];

allies.forEach(unit => {
  if (areaAttackUnits[unit.id]) {
    unit.attackType = 'area';
    unit.areaRadius = areaAttackUnits[unit.id].areaRadius;
    addedCount++;
    addedUnits.push({
      id: unit.id,
      name: unit.name,
      rarity: unit.rarity,
      areaRadius: unit.areaRadius
    });
  }
});

// ファイル保存
fs.writeFileSync(alliesPath, JSON.stringify(allies, null, 2) + '\n', 'utf8');

console.log('✅ 範囲攻撃を追加しました！\n');
console.log(`【追加数】${addedCount}体\n`);
console.log('【追加されたキャラ】');
console.log('-'.repeat(55));

const rarityOrder = { UR: 0, SSR: 1, SR: 2, R: 3, N: 4 };
addedUnits.sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);

addedUnits.forEach(u => {
  console.log(`${u.rarity.padEnd(3)} | ${u.name.padEnd(28)} | 範囲: ${u.areaRadius}px`);
});

console.log('-'.repeat(55));
