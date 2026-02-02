// ============================================
// Garden Wars - Skill Definitions
// ============================================

import type { UnitSkill } from './types';

/**
 * スキル定義マスターデータ
 */
export const SKILL_DEFINITIONS: Record<string, UnitSkill> = {
    // ============================================
    // 時間操作系
    // ============================================
    time_stop: {
        id: 'time_stop',
        name: 'Time Stop',
        nameJa: '時間停止',
        description: 'Freezes all enemies in range for 3 seconds',
        descriptionJa: '範囲内の敵を3秒間停止させる',
        trigger: 'interval',
        triggerIntervalMs: 12000,
        cooldownMs: 15000,
        effects: [{
            type: 'time_stop',
            target: 'area_enemies',
            value: 1,
            durationMs: 3000,
            range: 200
        }],
        icon: '⏱️',
        effectColor: 0x00ffff
    },

    frost_slow: {
        id: 'frost_slow',
        name: 'Frost Slow',
        nameJa: 'フロストスロー',
        description: 'Attacks slow enemies by 50% for 2s',
        descriptionJa: '攻撃した敵を2秒間50%スローにする',
        trigger: 'on_attack',
        triggerChance: 1.0,
        cooldownMs: 0,
        effects: [{
            type: 'time_slow',
            target: 'single_enemy',
            value: 0.5,
            durationMs: 2000
        }],
        icon: '❄️',
        effectColor: 0x88ccff
    },

    haste_aura: {
        id: 'haste_aura',
        name: 'Haste Aura',
        nameJa: 'ヘイストオーラ',
        description: 'On spawn, boosts all allies attack speed by 25% for 5s',
        descriptionJa: '登場時、味方全体の攻撃速度を5秒間25%上昇',
        trigger: 'on_spawn',
        cooldownMs: 0,
        effects: [{
            type: 'haste',
            target: 'all_allies',
            value: 0.75,  // 25% faster = 0.75x cooldown
            durationMs: 5000
        }],
        icon: '⚡',
        effectColor: 0x00ffff
    },

    // ============================================
    // 攻撃系
    // ============================================
    critical_strike: {
        id: 'critical_strike',
        name: 'Critical Strike',
        nameJa: 'クリティカル',
        description: '25% chance to deal 2.5x damage',
        descriptionJa: '25%の確率で2.5倍のダメージ',
        trigger: 'on_attack',
        triggerChance: 0.25,
        cooldownMs: 0,
        effects: [{
            type: 'critical',
            target: 'single_enemy',
            value: 2.5
        }],
        icon: '⚔️',
        effectColor: 0xff4444
    },

    chain_lightning: {
        id: 'chain_lightning',
        name: 'Chain Lightning',
        nameJa: 'チェインライトニング',
        description: 'Attacks chain to 3 nearby enemies at 60% damage',
        descriptionJa: '攻撃が最大3体の敵に60%ダメージで連鎖',
        trigger: 'on_attack',
        triggerChance: 1.0,
        cooldownMs: 4000,
        effects: [{
            type: 'chain',
            target: 'area_enemies',
            value: 0.6,
            range: 150,
            chainCount: 3
        }],
        icon: '⚡',
        effectColor: 0xffff00
    },

    burn: {
        id: 'burn',
        name: 'Burn',
        nameJa: '炎上',
        description: 'Attacks inflict burn (50 damage/s for 3s)',
        descriptionJa: '攻撃対象を炎上させる（3秒間50ダメージ/秒）',
        trigger: 'on_attack',
        triggerChance: 1.0,
        cooldownMs: 0,
        effects: [{
            type: 'burn',
            target: 'single_enemy',
            value: 50,
            durationMs: 3000
        }],
        icon: '🔥',
        effectColor: 0xff6600
    },

    // ============================================
    // 防御系
    // ============================================
    divine_shield: {
        id: 'divine_shield',
        name: 'Divine Shield',
        nameJa: '神聖シールド',
        description: 'Becomes invincible for 5s when HP drops below 30%',
        descriptionJa: 'HP30%以下で5秒間無敵',
        trigger: 'hp_threshold',
        triggerThreshold: 0.3,
        cooldownMs: 0,
        effects: [{
            type: 'invincible',
            target: 'self',
            value: 1,
            durationMs: 5000
        }],
        icon: '🛡️',
        effectColor: 0xffdd00
    },

    last_stand: {
        id: 'last_stand',
        name: 'Last Stand',
        nameJa: 'ラストスタンド',
        description: 'Survives lethal damage once with 1 HP',
        descriptionJa: '致死ダメージを1回だけ耐える',
        trigger: 'passive',
        cooldownMs: 0,
        effects: [{
            type: 'last_stand',
            target: 'self',
            value: 1
        }],
        icon: '💪',
        effectColor: 0xff0000
    },

    regeneration: {
        id: 'regeneration',
        name: 'Regeneration',
        nameJa: 'リジェネ',
        description: 'Regenerates 3% HP per second',
        descriptionJa: '毎秒3%のHPを回復',
        trigger: 'passive',
        cooldownMs: 0,
        effects: [{
            type: 'regen',
            target: 'self',
            value: 0.03
        }],
        icon: '💚',
        effectColor: 0x00ff00
    },

    // ============================================
    // 支援系
    // ============================================
    war_cry: {
        id: 'war_cry',
        name: 'War Cry',
        nameJa: '鬨の声',
        description: 'On spawn, boosts all allies attack by 20% for 5s',
        descriptionJa: '登場時、味方全体の攻撃力を5秒間20%上昇',
        trigger: 'on_spawn',
        cooldownMs: 0,
        effects: [{
            type: 'damage_modifier',
            target: 'all_allies',
            value: 1.2,
            durationMs: 5000
        }],
        icon: '📯',
        effectColor: 0xff8800
    },

    // ============================================
    // 複合/特殊系
    // ============================================
    cosmic_breath: {
        id: 'cosmic_breath',
        name: 'Cosmic Breath',
        nameJa: 'コズミックブレス',
        description: 'Attacks stun enemies for 1 second',
        descriptionJa: '攻撃した敵を1秒間スタンさせる',
        trigger: 'on_attack',
        triggerChance: 0.3,
        cooldownMs: 5000,
        effects: [{
            type: 'stun',
            target: 'single_enemy',
            value: 1,
            durationMs: 1000
        }],
        icon: '🌌',
        effectColor: 0x9933ff
    }
};

/**
 * スキルIDからスキル定義を取得
 */
export function getSkillById(skillId: string): UnitSkill | undefined {
    return SKILL_DEFINITIONS[skillId];
}
