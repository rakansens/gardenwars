# スキルシステム設計書

## 1. 概要

### 1.1 目的
- ゲーム性の向上（戦略的深みを追加）
- URユニットの差別化（高レアリティの価値向上）
- バトルの多様性（スキルによる逆転要素）

### 1.2 設計原則
- **後方互換性**: スキルなしユニットは従来通り動作
- **低侵襲性**: 既存コードへの変更を最小化
- **拡張性**: 新スキル追加が容易な構造
- **パフォーマンス**: 60FPS維持（20ユニット時）

---

## 2. アーキテクチャ

### 2.1 システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                      BattleScene                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ CombatSystem│  │ WaveSystem  │  │    SkillSystem     │ │
│  │ (既存)      │  │ (既存)      │  │    (新規追加)       │ │
│  └──────┬──────┘  └─────────────┘  └──────────┬──────────┘ │
│         │                                      │            │
│         ▼                                      ▼            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                      Unit                            │   │
│  │  ┌───────────┐  ┌────────────┐  ┌────────────────┐  │   │
│  │  │ 状態機械   │  │ SkillState │  │ StatusEffects  │  │   │
│  │  │ (既存)    │  │ (新規)     │  │ (新規)         │  │   │
│  │  └───────────┘  └────────────┘  └────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 ファイル構成

```
src/
├── data/
│   ├── types.ts              # 型定義に UnitSkill を追加
│   └── skills.ts             # スキル定義マスターデータ（新規）
├── game/
│   ├── entities/
│   │   └── Unit.ts           # スキル実行ロジック追加
│   └── systems/
│       └── SkillSystem.ts    # スキル管理システム（新規）
└── lib/
    └── skillEffects.ts       # エフェクト関数群（新規）
```

---

## 3. 型定義

### 3.1 スキル関連の型（types.ts に追加）

```typescript
// ============================================
// スキルシステム型定義
// ============================================

/**
 * スキル発動トリガー
 */
export type SkillTrigger =
  | 'on_spawn'        // 召喚時に1回発動
  | 'on_attack'       // 攻撃時に発動（確率判定あり）
  | 'on_hit'          // 被弾時に発動
  | 'on_kill'         // 敵撃破時に発動
  | 'hp_threshold'    // HP閾値到達時（1回のみ）
  | 'interval'        // 一定間隔で自動発動
  | 'passive';        // 常時発動（バフ系）

/**
 * スキル効果タイプ
 */
export type SkillEffectType =
  // 時間操作系
  | 'time_stop'       // 時間停止（対象の state を強制的に固定）
  | 'time_slow'       // スロー（speed を減少）
  | 'haste'           // 加速（attackCooldownMs を短縮）

  // ダメージ系
  | 'damage_modifier' // ダメージ倍率
  | 'critical'        // クリティカル（確率で倍ダメージ）
  | 'dot'             // 継続ダメージ（Damage over Time）
  | 'chain'           // 連鎖ダメージ（周囲に飛び火）

  // 防御系
  | 'shield'          // シールド（一定ダメージ吸収）
  | 'damage_reduction'// ダメージ軽減（%）
  | 'invincible'      // 無敵（ダメージ無効）
  | 'last_stand'      // 致死ダメージを1回だけ耐える

  // 回復系
  | 'heal'            // HP回復（即時）
  | 'regen'           // HP継続回復

  // 状態異常系
  | 'stun'            // スタン（行動不能）
  | 'freeze'          // 凍結（スタン + スロー解除後）
  | 'burn'            // 炎上（DoT + 被ダメ増加）

  // 召喚系
  | 'summon';         // ユニット召喚

/**
 * スキル効果対象
 */
export type SkillTarget =
  | 'self'            // 自分のみ
  | 'single_enemy'    // 単体敵（攻撃対象）
  | 'all_enemies'     // 全敵
  | 'area_enemies'    // 範囲内敵
  | 'single_ally'     // 単体味方
  | 'all_allies'      // 全味方
  | 'area_allies';    // 範囲内味方

/**
 * スキル効果定義
 */
export interface SkillEffect {
  type: SkillEffectType;
  target: SkillTarget;
  value: number;               // 効果値（倍率、ダメージ量、%等）
  durationMs?: number;         // 効果持続時間
  range?: number;              // 効果範囲（area_* の場合）
  // 追加パラメータ
  chainCount?: number;         // chain: 連鎖回数
  summonUnitId?: string;       // summon: 召喚するユニットID
  summonCount?: number;        // summon: 召喚数
}

/**
 * スキル定義
 */
export interface UnitSkill {
  id: string;
  name: string;
  nameJa: string;              // 日本語名
  description: string;
  descriptionJa: string;       // 日本語説明

  // 発動条件
  trigger: SkillTrigger;
  triggerChance?: number;      // 発動確率 (0.0-1.0)、省略時は1.0
  triggerThreshold?: number;   // HP閾値 (0.0-1.0)、hp_threshold用
  triggerIntervalMs?: number;  // 発動間隔、interval用

  // クールダウン
  cooldownMs: number;          // スキル使用後のクールダウン

  // 効果
  effects: SkillEffect[];

  // ビジュアル
  icon?: string;               // アイコン絵文字
  effectColor?: number;        // エフェクト色（0xRRGGBB）
}

/**
 * ランタイムスキル状態
 */
export interface SkillRuntimeState {
  skillId: string;
  cooldownRemaining: number;   // 残りクールダウン
  triggered: boolean;          // hp_threshold等の1回限りトリガー用
}

/**
 * ステータス効果（バフ/デバフ）
 */
export interface StatusEffect {
  id: string;
  type: SkillEffectType;
  value: number;
  remainingMs: number;
  sourceUnitId: string;        // 効果の発生源
}
```

### 3.2 UnitDefinition への追加

```typescript
export interface UnitDefinition {
  // ... 既存フィールド（変更なし）

  // スキル（オプション）- 追加
  skill?: UnitSkill;
}
```

---

## 4. 実装詳細

### 4.1 Unit.ts への追加

```typescript
// Unit クラスに追加するプロパティ
export class Unit extends Phaser.GameObjects.Container {
    // ... 既存プロパティ

    // === スキルシステム追加 ===
    private skillState: SkillRuntimeState | null = null;
    private statusEffects: StatusEffect[] = [];
    private isFrozen: boolean = false;      // 時間停止/凍結中
    private speedModifier: number = 1.0;    // 速度倍率
    private damageModifier: number = 1.0;   // ダメージ倍率
    private damageReduction: number = 0;    // ダメージ軽減%
    private hasLastStand: boolean = false;  // ラストスタンド発動済み
    private shieldAmount: number = 0;       // シールド残量
```

### 4.2 状態遷移への統合

```
現在の状態遷移:
SPAWN (300ms) → WALK → ATTACK_WINDUP → ATTACK_COOLDOWN → WALK/ATTACK

スキル統合後:
SPAWN (300ms)
  ↓ [on_spawn スキルチェック]
WALK
  ↓ [interval スキルチェック] [時間停止チェック]
ATTACK_WINDUP
  ↓ [on_attack スキルチェック] [ダメージ計算にスキル効果適用]
ATTACK_COOLDOWN
  ↓ [hasteで短縮]
WALK/ATTACK

※ 被ダメージ時:
takeDamage()
  → [シールド処理]
  → [ダメージ軽減処理]
  → [on_hit スキルチェック]
  → [hp_threshold チェック]
  → [last_stand チェック]
```

### 4.3 主要メソッド

```typescript
// Unit.ts に追加するメソッド

/**
 * スキル初期化（constructor で呼び出し）
 */
private initializeSkill(): void {
    if (this.definition.skill) {
        this.skillState = {
            skillId: this.definition.skill.id,
            cooldownRemaining: 0,
            triggered: false
        };

        // passive スキルは即座に効果適用
        if (this.definition.skill.trigger === 'passive') {
            this.applyPassiveSkill();
        }
    }
}

/**
 * スキルクールダウン更新（update で呼び出し）
 */
private updateSkillCooldown(delta: number): void {
    if (this.skillState && this.skillState.cooldownRemaining > 0) {
        this.skillState.cooldownRemaining -= delta;
    }

    // ステータス効果の時間経過
    this.statusEffects = this.statusEffects.filter(effect => {
        effect.remainingMs -= delta;
        return effect.remainingMs > 0;
    });

    // interval トリガーチェック
    if (this.definition.skill?.trigger === 'interval') {
        this.checkIntervalSkill();
    }
}

/**
 * 攻撃時スキルチェック（dealDamage 内で呼び出し）
 */
private checkOnAttackSkill(): number {
    const skill = this.definition.skill;
    if (!skill || skill.trigger !== 'on_attack') return 1.0;
    if (!this.canUseSkill()) return 1.0;

    const chance = skill.triggerChance ?? 1.0;
    if (Math.random() > chance) return 1.0;

    // スキル発動
    this.executeSkill();
    return this.calculateSkillDamageModifier();
}

/**
 * スキル実行
 */
private executeSkill(): void {
    const skill = this.definition.skill!;

    // クールダウン開始
    this.skillState!.cooldownRemaining = skill.cooldownMs;

    // エフェクト表示
    this.showSkillEffect(skill);

    // 各効果を適用
    for (const effect of skill.effects) {
        this.applySkillEffect(effect);
    }
}

/**
 * スキル効果適用
 */
private applySkillEffect(effect: SkillEffect): void {
    const targets = this.getSkillTargets(effect.target, effect.range);

    switch (effect.type) {
        case 'time_stop':
            targets.forEach(t => t.applyFreeze(effect.durationMs!));
            break;
        case 'time_slow':
            targets.forEach(t => t.applySpeedModifier(effect.value, effect.durationMs!));
            break;
        case 'critical':
            // dealDamage 内で処理
            break;
        case 'chain':
            this.applyChainDamage(targets, effect.value, effect.chainCount!);
            break;
        case 'heal':
            targets.forEach(t => t.heal(effect.value));
            break;
        case 'shield':
            targets.forEach(t => t.addShield(effect.value));
            break;
        // ... 他の効果
    }
}

/**
 * 時間停止適用
 */
public applyFreeze(durationMs: number): void {
    this.isFrozen = true;
    this.scene.time.delayedCall(durationMs, () => {
        this.isFrozen = false;
    });

    // アニメーション停止
    if (this.sprite instanceof Phaser.GameObjects.Sprite) {
        this.sprite.anims.pause();
    }

    // 凍結エフェクト
    this.showFreezeEffect();
}
```

### 4.4 ダメージ計算フロー

```
dealDamage() {
    // 1. 基本ダメージ取得
    let damage = this.definition.attackDamage;

    // 2. on_attack スキルチェック
    const skillModifier = this.checkOnAttackSkill();
    damage *= skillModifier;

    // 3. バフ/デバフ適用
    damage *= this.damageModifier;

    // 4. ターゲットにダメージ
    target.takeDamage(damage, knockback, this);
}

takeDamage(damage, knockback, attacker) {
    // 1. シールド処理
    if (this.shieldAmount > 0) {
        const absorbed = Math.min(this.shieldAmount, damage);
        this.shieldAmount -= absorbed;
        damage -= absorbed;
        if (damage <= 0) return;
    }

    // 2. ダメージ軽減
    damage *= (1 - this.damageReduction);

    // 3. 無敵チェック
    if (this.isInvincible) return;

    // 4. HP減少
    this.hp -= damage;

    // 5. on_hit スキルチェック
    this.checkOnHitSkill(attacker);

    // 6. hp_threshold チェック
    this.checkHpThresholdSkill();

    // 7. last_stand チェック
    if (this.hp <= 0 && this.hasLastStand && !this.lastStandUsed) {
        this.hp = 1;
        this.lastStandUsed = true;
        this.showLastStandEffect();
        return;
    }

    // 8. 死亡判定
    if (this.hp <= 0) {
        this.die();
    }
}
```

---

## 5. スキル定義データ

### 5.1 skills.ts（新規ファイル）

```typescript
import type { UnitSkill } from './types';

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
        triggerIntervalMs: 15000,
        cooldownMs: 20000,
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

    // ============================================
    // 攻撃系
    // ============================================
    critical_strike: {
        id: 'critical_strike',
        name: 'Critical Strike',
        nameJa: 'クリティカルストライク',
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
        description: 'Attacks chain to 3 nearby enemies',
        descriptionJa: '攻撃が最大3体の敵に連鎖',
        trigger: 'on_attack',
        triggerChance: 1.0,
        cooldownMs: 3000,
        effects: [{
            type: 'chain',
            target: 'area_enemies',
            value: 0.6,  // 60% of original damage
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
            type: 'dot',
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
        cooldownMs: 0,  // 1回限り
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
        nameJa: 'リジェネレーション',
        description: 'Regenerates 3% HP per second',
        descriptionJa: '毎秒3%のHPを回復',
        trigger: 'passive',
        cooldownMs: 0,
        effects: [{
            type: 'regen',
            target: 'self',
            value: 0.03  // 3%
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
    }
};
```

### 5.2 ユニット別スキル割り当て

```typescript
// allies.ts での使用例

import { SKILL_DEFINITIONS } from './skills';

export const UR_UNITS: UnitDefinition[] = [
    {
        id: 'ur_chrono_sage',
        name: 'Chrono Sage',
        // ... 他の既存プロパティ
        skill: SKILL_DEFINITIONS.time_stop
    },
    {
        id: 'ur_frost_giant',
        name: 'Frost Giant',
        // ...
        skill: SKILL_DEFINITIONS.frost_slow
    },
    {
        id: 'ur_ninja',
        name: 'Shadow Ninja',
        // ...
        skill: SKILL_DEFINITIONS.critical_strike
    },
    {
        id: 'ur_thunder_phoenix',
        name: 'Thunder Phoenix',
        // ...
        skill: SKILL_DEFINITIONS.chain_lightning
    },
    {
        id: 'ur_inferno_demon',
        name: 'Inferno Demon',
        // ...
        skill: SKILL_DEFINITIONS.burn
    },
    {
        id: 'ur_golden_paladin',
        name: 'Golden Paladin',
        // ...
        skill: SKILL_DEFINITIONS.divine_shield
    },
    {
        id: 'flame_knight',
        name: 'Flame Knight',
        // ...
        skill: SKILL_DEFINITIONS.last_stand
    },
    {
        id: 'ur_ancient_treant',
        name: 'Ancient Treant',
        // ...
        skill: SKILL_DEFINITIONS.regeneration
    },
    {
        id: 'ur_angel',
        name: 'Holy Angel',
        // ...
        skill: SKILL_DEFINITIONS.haste_aura
    }
];
```

---

## 6. ビジュアルエフェクト

### 6.1 エフェクト一覧

| スキル | エフェクト | 実装方法 |
|--------|----------|----------|
| time_stop | 青い時計マーク + 波紋 | Circle + Tween |
| frost_slow | 氷の結晶 + 青色Tint | Particles + setTint |
| critical | 赤い斬撃 + CRITICAL!テキスト | Graphics + Text |
| chain_lightning | 黄色い稲妻線 | Graphics.lineTo |
| burn | 炎パーティクル | Particles |
| divine_shield | 金色のオーラ | Circle + Alpha pulse |
| last_stand | 赤い爆発 + テキスト | Circle + Text |
| regeneration | 緑のハート浮遊 | Text + Tween |
| war_cry | 範囲オーラ + バフアイコン | Circle + Sprite |
| haste | 青い風のライン | Graphics + Tween |

### 6.2 エフェクト実装例

```typescript
// skillEffects.ts

export function showTimeStopEffect(scene: Phaser.Scene, x: number, y: number, range: number): void {
    // 中心のアイコン
    const icon = scene.add.text(x, y - 60, '⏱️', { fontSize: '48px' });
    icon.setOrigin(0.5);
    icon.setDepth(100);

    // 範囲波紋
    const wave = scene.add.circle(x, y, 20, 0x00ffff, 0.5);
    wave.setStrokeStyle(3, 0x00ffff);
    wave.setDepth(99);

    scene.tweens.add({
        targets: wave,
        radius: range,
        alpha: 0,
        duration: 500,
        onComplete: () => wave.destroy()
    });

    scene.tweens.add({
        targets: icon,
        y: y - 100,
        alpha: 0,
        duration: 1000,
        onComplete: () => icon.destroy()
    });
}

export function showChainLightningEffect(
    scene: Phaser.Scene,
    source: { x: number; y: number },
    targets: { x: number; y: number }[]
): void {
    const graphics = scene.add.graphics();
    graphics.setDepth(100);

    let prev = source;
    for (const target of targets) {
        // 稲妻を描画（ジグザグ線）
        graphics.lineStyle(3, 0xffff00);
        graphics.beginPath();
        graphics.moveTo(prev.x, prev.y - 40);

        const midX = (prev.x + target.x) / 2;
        const midY = (prev.y + target.y) / 2 - 40;
        const offset = (Math.random() - 0.5) * 30;

        graphics.lineTo(midX + offset, midY - 20 + offset);
        graphics.lineTo(target.x, target.y - 40);
        graphics.strokePath();

        prev = target;
    }

    scene.tweens.add({
        targets: graphics,
        alpha: 0,
        duration: 300,
        onComplete: () => graphics.destroy()
    });
}
```

---

## 7. パフォーマンス考慮

### 7.1 最適化ポイント

| 項目 | 対策 | 目標 |
|------|------|------|
| スキルチェック | フラグで早期リターン | <0.1ms/unit |
| 効果検索 | Set使用でO(1) | <0.05ms |
| エフェクト | オブジェクトプール | GC削減 |
| 状態同期 | 差分更新のみ | <1ms/frame |

### 7.2 メモリ使用量

```
SkillRuntimeState: ~32 bytes/unit
StatusEffect: ~48 bytes/effect
最大想定: 20 units × 3 effects = ~3KB
```

---

## 8. 実装フェーズ

### Phase 1: 基盤構築（3-4時間）
- [ ] types.ts にスキル型定義追加
- [ ] skills.ts 作成（スキル定義）
- [ ] Unit.ts にスキル状態管理追加
- [ ] 基本的なスキル発動フロー実装

### Phase 2: 時間操作系（3-4時間）
- [ ] time_stop 実装
- [ ] frost_slow 実装
- [ ] haste 実装
- [ ] エフェクト作成

### Phase 3: 攻撃系（3-4時間）
- [ ] critical_strike 実装
- [ ] chain_lightning 実装
- [ ] burn (DoT) 実装
- [ ] エフェクト作成

### Phase 4: 防御/回復系（2-3時間）
- [ ] divine_shield 実装
- [ ] last_stand 実装
- [ ] regeneration 実装
- [ ] エフェクト作成

### Phase 5: UI/演出（3-4時間）
- [ ] スキルアイコン表示
- [ ] バフ/デバフアイコン
- [ ] スキル発動テキスト
- [ ] 効果音追加

### Phase 6: テスト/調整（2-3時間）
- [ ] 各スキルの動作確認
- [ ] バランス調整
- [ ] パフォーマンステスト
- [ ] エッジケース対応

**総工数: 16-21時間**

---

## 9. ユニット割り当て案（最終）

| ユニット | スキル | 効果 | 優先度 |
|---------|--------|------|--------|
| ur_chrono_sage | time_stop | 範囲内敵を3秒停止 | ⭐⭐⭐ |
| ur_frost_giant | frost_slow | 攻撃で2秒50%スロー | ⭐⭐⭐ |
| ur_ninja | critical_strike | 25%で2.5倍ダメージ | ⭐⭐⭐ |
| ur_thunder_phoenix | chain_lightning | 3体に連鎖ダメージ | ⭐⭐⭐ |
| ur_inferno_demon | burn | 3秒間DoT | ⭐⭐ |
| ur_golden_paladin | divine_shield | HP30%で5秒無敵 | ⭐⭐⭐ |
| flame_knight | last_stand | 致死ダメージを1回耐える | ⭐⭐ |
| ur_ancient_treant | regeneration | 毎秒3%HP回復 | ⭐⭐ |
| ur_angel | haste_aura | 登場時、味方攻撃速度+25% | ⭐⭐ |
| ur_cosmic_dragon | cosmic_breath | 攻撃で1秒スタン | ⭐ |

---

## 10. 拡張性

### 10.1 将来追加予定スキル
- **summon_clone**: 分身召喚
- **teleport**: 瞬間移動
- **reflect**: ダメージ反射
- **lifesteal**: HP吸収
- **aoe_heal**: 範囲回復

### 10.2 SSR/SR への展開
Phase 1完了後、下位レアリティにも簡易スキルを追加可能:
- SSR: 確率低め/効果弱めのスキル
- SR: パッシブのみ
