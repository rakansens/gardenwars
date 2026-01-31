# Sprite Sheet Generation Prompt

## 基本要件
Garden Wars用のスプライトシートを生成するための指示。

---

## 🚀 推奨ワークフロー（クロマキー方式）

白い猫キャラクターの顔が消えないよう、**クロマキー（緑背景）方式**を採用。

### Step 1: スプライトシート生成（緑背景）

```bash
node generate_ur_sprite.js <入力画像> <出力パス> <アタックスタイル>
```

**アタックスタイル:**
- `mech` - ロボット、メカ（レーザー、爆発）
- `knight` - 剣士（剣斬撃、エネルギーアーク）
- `paladin` - 聖騎士（神聖光、聖なる力）
- `nature` - 植物系（つる、花びら、とげ）
- `beast` - 動物（爪、牙、野性の力）
- `magic` - 魔法使い（魔法、アーケインエネルギー）
- `default` - 汎用

**例:**
```bash
# 氷の魔法使い
node generate_ur_sprite.js public/assets/sprites/allies/SSR/ssr_frost_empress.webp public/assets/sprites/sheets/ssr_frost_empress_sheet.png magic

# メカ系
node generate_ur_sprite.js public/assets/sprites/allies/UR/ur_botanical_gundam.webp public/assets/sprites/sheets/ur_botanical_gundam_sheet.png mech
```

### Step 2: 背景除去（クロマキー）

⚠️ **重要**: `remove_bg.js`ではなく`remove_green.js`を使用！

```bash
node remove_green.js <スプライトシート>
```

**例:**
```bash
node remove_green.js public/assets/sprites/sheets/ssr_frost_empress_sheet.png
```

### Step 3: WebP変換

```bash
cwebp -q 90 public/assets/sprites/sheets/xxx_sheet.png -o public/assets/sprites/sheets/xxx_sheet.webp
```

### 必要な環境変数

`.env.local` に以下を設定:
```
NANOBANANAPRO_API_KEY=your_api_key_here
```

### 使用モデル

- **Nano Banana Pro** (`gemini-3-pro-image-preview`)
- Image-to-Image編集で元キャラクターのデザインを維持

---

## 📐 スプライトシート仕様

```
+----------+----------+----------+----------+
|   idle   | walk_1   | walk_2   | walk_3   |  ← Row 1
|  344x384 |  344x384 |  344x384 |  344x384 |
+----------+----------+----------+----------+
| attack_1 | attack_2 | attack_3 | attack_4 |  ← Row 2
|  344x384 |  344x384 |  344x384 |  344x384 |
+----------+----------+----------+----------+
          Total: 1376 x 768 pixels
```

- **全体サイズ**: 1376 x 768 ピクセル
- **グリッド**: 4列 x 2行（合計8フレーム）
- **各フレームサイズ**: 344 x 384 ピクセル
- **背景**: クロマキーグリーン (#00FF00) → 後で透明化

---

## 🎨 AI画像生成ツール用プロンプト（generate_ur_sprite.js内蔵）

```
Using this exact character design, create a sprite sheet animation.

IMPORTANT: Keep the SAME character design, colors, and style from the input image.

Create a sprite sheet with:
- 4 columns x 2 rows (8 frames total)
- Size: 1376 x 768 pixels
- Each frame: 344 x 384 pixels
- SOLID BRIGHT GREEN background (#00FF00) - chroma key green for easy removal

Row 1: idle, walk_1, walk_2, walk_3
Row 2: [Attack Style Description]

Character must face RIGHT. This is an ULTRA RARE unit - make the attack animation SPECTACULAR and EPIC!

CRITICAL: Do NOT add any text labels. NO "Idle", "Walk", "Attack" text. ONLY character graphics.
```

---

## ✅ 出力後のチェックリスト

- [ ] 画像サイズが正確に **1376 x 768** ピクセルか
- [ ] 背景が **緑色（#00FF00）** か
- [ ] 4列 x 2行のグリッドになっているか
- [ ] キャラクターが **右向き** か
- [ ] 各フレームでキャラクターが中央に配置されているか
- [ ] 元のキャラクターデザインが維持されているか
- [ ] **テキストラベルがない**か（Idle, Walk, Attack等）

---

## 🔧 背景透過処理

### クロマキー方式（推奨）

```bash
node remove_green.js <画像パス>
```

緑色（#00FF00付近）を検出して透明化。白いキャラクターの顔が消えない。

### ⚠️ AI背景除去（非推奨）

```bash
node remove_bg.js <画像パス>
```

AIベースの背景除去。白いキャラクターの顔が消える可能性があるため**使用しない**。

---

## 📝 ファイル命名規則

生成後、以下の名前で保存：
- `[unit_id]_sheet.png` (例: `ssr_frost_empress_sheet.png`)
- `[unit_id]_sheet.webp` (WebP変換後)
- `[unit_id]_sheet.json` (メタデータ)

配置先：
- `public/assets/sprites/sheets/`

---

## 📋 完全ワークフロー（新ユニット追加）

### Step 1: スプライトシート生成（緑背景）
```bash
node generate_ur_sprite.js public/assets/sprites/allies/SSR/ssr_xxx.webp public/assets/sprites/sheets/ssr_xxx_sheet.png [style]
```

### Step 2: 生成結果を確認
- 緑背景になっているか
- キャラデザインが保持されているか
- テキストラベルがないか

### Step 3: 背景除去（クロマキー）
```bash
node remove_green.js public/assets/sprites/sheets/ssr_xxx_sheet.png
```

### Step 4: 結果を確認
- キャラクターが消えていないか
- 背景が透明になっているか

### Step 5: WebP変換
```bash
cwebp -q 90 public/assets/sprites/sheets/ssr_xxx_sheet.png -o public/assets/sprites/sheets/ssr_xxx_sheet.webp
```

### Step 6: JSONメタデータ生成
```json
{
    "frames": {
        "ssr_xxx_idle.png": { "frame": { "x": 0, "y": 0, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } },
        "ssr_xxx_walk_1.png": { "frame": { "x": 344, "y": 0, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } },
        "ssr_xxx_walk_2.png": { "frame": { "x": 688, "y": 0, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } },
        "ssr_xxx_walk_3.png": { "frame": { "x": 1032, "y": 0, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } },
        "ssr_xxx_attack_1.png": { "frame": { "x": 0, "y": 384, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } },
        "ssr_xxx_attack_2.png": { "frame": { "x": 344, "y": 384, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } },
        "ssr_xxx_attack_3.png": { "frame": { "x": 688, "y": 384, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } },
        "ssr_xxx_attack_4.png": { "frame": { "x": 1032, "y": 384, "w": 344, "h": 384 }, "sourceSize": { "w": 344, "h": 384 } }
    },
    "meta": { "image": "ssr_xxx_sheet.webp", "size": { "w": 1376, "h": 768 } }
}
```

### Step 7: コード更新

**src/lib/sprites.ts**
- `ANIMATED_UNITS`配列にIDを追加

**src/components/ui/UnitAnimationPreview.tsx**
- `smallSpriteUnits`配列にIDを追加

**src/game/scenes/BattleScene.ts**
- `unitsWithSheets`配列にIDを追加
- `createAnimations()`の対応配列にIDを追加

---

## ⚠️ トラブルシューティング

### 背景除去でキャラクターが消える

**原因**: AI背景除去（remove_bg.js）を使用

**解決策**: `remove_green.js`を使用する

### 緑背景で生成されない

**解決策**: 再生成する。AIが指示を無視することがある。

### テキストラベルが入っている

**解決策**: 再生成する。プロンプトに禁止指示はあるが、AIが無視することがある。

### サイズが1376x768でない

**解決策**: 再生成する。確認コマンド:
```bash
file public/assets/sprites/sheets/xxx_sheet.png
# 期待: PNG image data, 1376 x 768
```

---

## 🎭 アタックスタイル詳細

### mech（メカ系）
```
DEVASTATING MECH attack sequence with explosive firepower!
- attack_1: Weapons systems activating, energy charging, targeting lock
- attack_2: MASSIVE laser beam / cannon blast with bright energy trail
- attack_3: Explosive impact with shockwaves, sparks, and debris
- attack_4: Smoke clearing, systems cooling with residual energy
```

### knight（剣士系）
```
HEROIC SWORD attack sequence with legendary power!
- attack_1: Drawing sword, battle stance, blade glowing with energy
- attack_2: POWERFUL overhead slash with energy arc trailing the blade
- attack_3: Impact explosion with light burst and energy shockwave
- attack_4: Follow through pose with lingering blade glow
```

### paladin（聖騎士系）
```
DIVINE HOLY attack sequence with radiant power!
- attack_1: Raising holy weapon, golden light gathering, halo appearing
- attack_2: BRILLIANT divine strike with holy light beams and sacred symbols
- attack_3: Purifying explosion with golden particles and angelic feathers
- attack_4: Blessed afterglow with floating light orbs
```

### nature（植物系）
```
BOTANICAL FURY attack sequence with primal plant power!
- attack_1: Vines and roses swirling, thorns extending, petals gathering
- attack_2: MASSIVE rose storm / thorn barrage with petal hurricane
- attack_3: Explosive bloom with thorns, petals, and nature energy burst
- attack_4: Flowers settling, vines retracting with floating petals
```

### beast（動物系）
```
FEROCIOUS PRIMAL attack sequence with raw power!
- attack_1: Crouching, muscles tensing, primal energy crackling
- attack_2: DEVASTATING claw strike / bite with energy trails
- attack_3: Savage impact with shockwave and primal roar effect
- attack_4: Landing pose with residual wild energy
```

### magic（魔法系）
```
SPECTACULAR ARCANE attack sequence with mystical power!
- attack_1: Raising staff, gathering magical energy, glowing runes appear
- attack_2: Full power magical blast with swirling energy and bright light
- attack_3: Explosive impact with magical particles, stars, and arcane symbols
- attack_4: Follow through with lingering magical sparkles and energy wisps
```
