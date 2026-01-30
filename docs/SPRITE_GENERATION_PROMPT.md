# Sprite Sheet Generation Prompt

## 基本要件
Garden Wars用のスプライトシートを生成するための指示。

---

## 🚀 推奨ワークフロー（Nano Banana Pro Image-to-Image）

既存のユニット画像からスプライトシートを自動生成する最も簡単な方法。

### Step 1: スプライトシート生成

```bash
node generate_sprite.js <入力画像> <出力パス>
```

**例:**
```bash
node generate_sprite.js public/assets/sprites/ur_frost_giant.png public/assets/sprites/ur_frost_giant_sheet.png
```

### Step 2: 背景除去

```bash
node remove_bg.js <スプライトシート>
```

**例:**
```bash
node remove_bg.js public/assets/sprites/ur_frost_giant_sheet.png
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

## 🎨 AI画像生成ツール用プロンプト（日本語）

手動でAIツールを使う場合のプロンプト:

```
ピクセルアート風の2Dゲームキャラクターのスプライトシートを作成してください。

【キャラクター】
[キャラクターの説明をここに入れる]

【スプライトシート仕様】
- 全体サイズ: 1376 x 768 ピクセル
- グリッド: 4列 x 2行（合計8フレーム）
- 各フレームサイズ: 344 x 384 ピクセル
- 背景: 完全に透明（透過PNG）

【フレーム配置】
1行目（左から右）:
  1. idle（待機ポーズ）
  2. walk_1（歩行フレーム1）
  3. walk_2（歩行フレーム2）
  4. walk_3（歩行フレーム3）

2行目（左から右）:
  1. attack_1（攻撃フレーム1）
  2. attack_2（攻撃フレーム2）
  3. attack_3（攻撃フレーム3）
  4. attack_4（攻撃フレーム4）

【スタイル要件】
- ピクセルアートスタイル
- キャラクターは右向き
- 各フレームでキャラクターの位置は中央揃え
- アニメーションが滑らかにつながるように
- 背景は完全に透明（白背景ではない）
```

---

## 🎨 AI Image Generation Prompt (English)

```
Create a pixel art sprite sheet for a 2D game character.

【Character】
[Insert character description here]

【Sprite Sheet Specifications】
- Total size: 1376 x 768 pixels
- Grid: 4 columns x 2 rows (8 frames total)
- Each frame size: 344 x 384 pixels
- Background: Fully transparent (transparent PNG)

【Frame Layout】
Row 1 (left to right):
  1. idle (standing pose)
  2. walk_1 (walk frame 1)
  3. walk_2 (walk frame 2)
  4. walk_3 (walk frame 3)

Row 2 (left to right):
  1. attack_1 (attack frame 1)
  2. attack_2 (attack frame 2)
  3. attack_3 (attack frame 3)
  4. attack_4 (attack frame 4)

【Style Requirements】
- Pixel art style
- Character facing RIGHT
- Character centered in each frame
- Smooth animation transitions between frames
- Background must be fully transparent (NOT white)
```

---

## 📐 Visual Reference

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

---

## ✅ 出力後のチェックリスト

- [ ] 画像サイズが正確に **1376 x 768** ピクセルか
- [ ] 背景が **透明** か（白背景ではない）
- [ ] 4列 x 2行のグリッドになっているか
- [ ] キャラクターが **右向き** か
- [ ] 各フレームでキャラクターが中央に配置されているか
- [ ] 元のキャラクターデザインが維持されているか

---

## 🔧 背景透過処理

### 方法1: プロジェクト内スクリプト（推奨）

```bash
node remove_bg.js <画像パス>
```

白背景・チェッカーボード背景を自動で透明化。

### 方法2: 外部ツール

- remove.bg (https://www.remove.bg/)
- Photoshop / GIMP

---

## 📝 ファイル命名規則

生成後、以下の名前で保存：
- `[unit_id]_sheet.png` (例: `ur_dragon_sheet.png`)

配置先：
- `public/assets/sprites/[unit_id]_sheet.png`

---

## 🔄 バッチ処理例

複数ユニットを一括処理する場合:

```bash
# 全URユニットのスプライトシート生成
for unit in ur_frost_giant ur_dragon ur_phoenix; do
  node generate_sprite.js public/assets/sprites/${unit}.png public/assets/sprites/${unit}_sheet.png
  node remove_bg.js public/assets/sprites/${unit}_sheet.png
done
```

---

## 📋 完全ワークフロー（新URユニット追加）

### Step 1: スプライトシート生成
```bash
node generate_sprite.js public/assets/sprites/ur_xxx.png public/assets/sprites/ur_xxx_sheet.png
```

### Step 2: 背景除去
```bash
node remove_bg.js public/assets/sprites/ur_xxx_sheet.png
```

### Step 3: JSONメタデータ生成
```bash
node generate_sprite_json.js
```
※ `_sheet.json`がないユニットに自動生成

### Step 4: allies.json更新
```bash
node update_units_atlas.js
```
または手動で`atlasKey`と`animKeys`を追加:
```json
{
  "atlasKey": "ur_xxx",
  "animKeys": {
    "idle": "idle",
    "walk": "walk",
    "attack": "attack",
    "die": "die"
  }
}
```

### Step 5: BattleScene.ts更新
1. `preload()`に静止画とアトラスのロードを追加
2. `createAnimations()`の`urUnits`配列にIDを追加

### Step 6: UnitAnimationPreview.tsx更新
1. `ANIMATED_UNITS`配列にIDを追加
2. `smallSpriteUnits`配列にIDを追加（スケール調整用）

---

## ⚠️ トラブルシューティング

### 背景除去がうまくいかない場合

**症状**: チェッカーボード模様が残る

**解決策**:
1. まず`remove_bg.js`を複数回実行してみる
2. それでも残る場合は、スプライトシートを再生成:
   ```bash
   node generate_sprite.js public/assets/sprites/ur_xxx.png public/assets/sprites/ur_xxx_sheet.png
   node remove_bg.js public/assets/sprites/ur_xxx_sheet.png
   ```

### サイズが合っていない場合

**症状**: 生成された画像が1376x768でない

**解決策**: 再生成する。AIモデルが時々サイズを間違えることがある。

### 確認コマンド
```bash
file public/assets/sprites/ur_xxx_sheet.png
# 期待: PNG image data, 1376 x 768, 8-bit/color RGBA
```

---

## 🎭 UR向け激しいアタックモーション（上級）

URユニットはより派手なアタックモーションが望ましい。

### プロンプト例（激しいアタック）
```
Using this exact character design, create a sprite sheet animation.

IMPORTANT: Keep the SAME character design, colors, and style from the input image.

Create a sprite sheet with:
- 4 columns x 2 rows (8 frames total)
- Size: 1376 x 768 pixels
- Each frame: 344 x 384 pixels
- Transparent background

Row 1: idle, walk_1, walk_2, walk_3
Row 2: POWERFUL attack sequence with dramatic effects
  - attack_1: Wind up / preparation pose
  - attack_2: Full power strike with energy/magic effects
  - attack_3: Impact moment with particles/sparks
  - attack_4: Follow through with lingering effects

Character must face RIGHT. Make the attack animation DYNAMIC and POWERFUL for an Ultra Rare unit.
```
