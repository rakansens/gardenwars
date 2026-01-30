const fs = require('fs');

const alliesPath = 'src/data/units/allies.json';
const allies = JSON.parse(fs.readFileSync(alliesPath, 'utf-8'));

// URユニットでatlasKeyがないものにatlasKeyとanimKeysを追加
const urUnitsToUpdate = [
    'ur_rose_queen',
    'ur_galaxy_butterfly',
    'ur_rose_capybara',
    'ur_cosmic_dragon',
    'ur_nature_spirit_cat',
    'ur_inferno_demon',
    'ur_golden_lion',
    'ur_chrono_sage',
    'ur_jade_dragon',
    'ur_emerald_dragon',
    'ur_chronos_cat',
    'ur_ancient_treant',
    'ur_nature_titan',
    'ur_stone_golem_cat',
    'ur_fire_lotus_cat',
    'ur_astral_wizard',
    'ur_rune_golem',
    'ur_frost_giant',
    'ur_celestial_cat',
    'ur_crystal_griffin',
    'ur_prismatic_cat',
    'ur_sea_leviathan',
    'ur_thunder_phoenix'
];

let updated = 0;
for (const unit of allies) {
    if (urUnitsToUpdate.includes(unit.id) && !unit.atlasKey) {
        unit.atlasKey = unit.id;
        unit.animKeys = {
            idle: 'idle',
            walk: 'walk',
            attack: 'attack',
            die: 'die'
        };
        console.log(`Updated: ${unit.id}`);
        updated++;
    }
}

fs.writeFileSync(alliesPath, JSON.stringify(allies, null, 2));
console.log(`\nTotal updated: ${updated} units`);
