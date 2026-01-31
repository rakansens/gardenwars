# UR/SSR Unit Sprite Animation Workflow

This document outlines the workflow for converting unit static images into animated sprite sheets.

## Overview
UR/SSR units are being upgraded from static images to full sprite sheet animations (Idle, Walk, Attack).
The process involves AI-based sprite sheet generation with chroma key background, color-based background removal, and code integration.

## Tools
- **generate_ur_sprite.js**: AI-based sprite sheet generation with character-specific attack styles
- **remove_green.js**: Chroma key (green screen) background removal using sharp

## ⚠️ 重要: クロマキー方式について

白い猫キャラクターの顔がAI背景除去で消えてしまう問題を解決するため、**クロマキー方式**を採用しています。

1. スプライトシート生成時に**緑背景（#00FF00）**を指定
2. 色ベースの背景除去で緑色のみを透明化
3. 白いキャラクターの顔が保持される

## Workflow Steps

### 1. Sprite Sheet Generation (Chroma Key Green Background)

キャラタイプに合わせたアタックスタイルを指定して生成:

```bash
node generate_ur_sprite.js <入力画像> <出力パス> <アタックスタイル>
```

**アタックスタイル一覧:**
| Style | 用途 | 効果 |
|-------|------|------|
| `mech` | ロボット、メカ、ガンダム | レーザー、キャノン、爆発 |
| `knight` | 剣士、騎士 | 剣斬撃、エネルギーアーク |
| `paladin` | 聖騎士、天使 | 神聖光、聖なる力 |
| `nature` | 植物、花系 | つる、花びら、とげ |
| `beast` | 動物、モンスター | 爪、牙、野性の力 |
| `magic` | 魔法使い、メイジ | 魔法、アーケインエネルギー |
| `default` | その他 | 汎用パワフル攻撃 |

**例:**
```bash
# 氷の魔法使い → magic
node generate_ur_sprite.js public/assets/sprites/allies/SSR/ssr_frost_empress.webp public/assets/sprites/sheets/ssr_frost_empress_sheet.png magic

# メカ系 → mech
node generate_ur_sprite.js public/assets/sprites/allies/UR/ur_botanical_gundam.webp public/assets/sprites/sheets/ur_botanical_gundam_sheet.png mech

# 侍 → knight
node generate_ur_sprite.js public/assets/sprites/allies/SSR/ssr_sakura_samurai.webp public/assets/sprites/sheets/ssr_sakura_samurai_sheet.png knight
```

### 2. Background Removal (Chroma Key Green)

緑背景を透明化:

```bash
node remove_green.js <スプライトシート>
```

**例:**
```bash
node remove_green.js public/assets/sprites/sheets/ssr_frost_empress_sheet.png
```

⚠️ **注意**: `remove_bg.js`（AI背景除去）は使わないでください。白いキャラクターの顔が消える可能性があります。

### 3. WebP変換

```bash
cwebp -q 90 <PNG画像> -o <出力WebP>
```

**例:**
```bash
cwebp -q 90 public/assets/sprites/sheets/ssr_frost_empress_sheet.png -o public/assets/sprites/sheets/ssr_frost_empress_sheet.webp
```

### 4. JSON Atlas Definition

JSONファイルを作成（`public/assets/sprites/sheets/[unit_id]_sheet.json`）:

```json
{
    "frames": {
        "[unit_id]_idle.png": { "frame": { "x": 0, "y": 0, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } },
        "[unit_id]_walk_1.png": { "frame": { "x": 344, "y": 0, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } },
        "[unit_id]_walk_2.png": { "frame": { "x": 688, "y": 0, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } },
        "[unit_id]_walk_3.png": { "frame": { "x": 1032, "y": 0, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } },
        "[unit_id]_attack_1.png": { "frame": { "x": 0, "y": 384, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } },
        "[unit_id]_attack_2.png": { "frame": { "x": 344, "y": 384, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } },
        "[unit_id]_attack_3.png": { "frame": { "x": 688, "y": 384, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } },
        "[unit_id]_attack_4.png": { "frame": { "x": 1032, "y": 384, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } }
    },
    "meta": { "image": "[unit_id]_sheet.webp", "size": { "w": 1376, "h": 768 } }
}
```

### 5. Code Integration

**src/lib/sprites.ts**
- `ANIMATED_UNITS`配列にIDを追加

**src/components/ui/UnitAnimationPreview.tsx**
- `smallSpriteUnits`配列にIDを追加（スケール調整用）

**src/game/scenes/BattleScene.ts**
- `unitsWithSheets`配列にIDを追加
- `createAnimations()`の対応配列（urUnits/srUnitsなど）にIDを追加

## 完全ワークフロー例（1体ずつ確認しながら）

```bash
# Step 1: 元画像を確認してアタックスタイルを決定
# (例: ssr_frost_empress は氷魔法使い → magic)

# Step 2: スプライトシート生成（緑背景）
node generate_ur_sprite.js public/assets/sprites/allies/SSR/ssr_frost_empress.webp public/assets/sprites/sheets/ssr_frost_empress_sheet.png magic

# Step 3: 生成結果を確認（緑背景になっているか）

# Step 4: 背景除去
node remove_green.js public/assets/sprites/sheets/ssr_frost_empress_sheet.png

# Step 5: 結果を確認（キャラクターが保持されているか）

# Step 6: WebP変換
cwebp -q 90 public/assets/sprites/sheets/ssr_frost_empress_sheet.png -o public/assets/sprites/sheets/ssr_frost_empress_sheet.webp

# Step 7: JSONメタデータ作成

# Step 8: コード更新
```

## ⚠️ トラブルシューティング

### 背景除去でキャラクターが消える場合

**原因**: AI背景除去（remove_bg.js）を使用している

**解決策**:
1. `remove_green.js`を使用する
2. スプライトシートが緑背景で生成されていることを確認

### 緑背景で生成されない場合

**解決策**: 再生成する。AIモデルが時々指示を無視することがある。

### サイズが1376x768でない場合

**解決策**: 再生成する。確認コマンド:
```bash
file public/assets/sprites/sheets/xxx_sheet.png
# 期待: PNG image data, 1376 x 768
```

### テキストラベル（Idle, Walk等）が入っている場合

**解決策**: 再生成する。プロンプトにはテキスト禁止の指示が入っているが、AIが無視することがある。

## Note on Naming

Ensure consistency in naming to avoid "missing asset" errors.
- Image: `[unit_id]_sheet.png` / `[unit_id]_sheet.webp`
- JSON: `[unit_id]_sheet.json`
- 配置先: `public/assets/sprites/sheets/`
