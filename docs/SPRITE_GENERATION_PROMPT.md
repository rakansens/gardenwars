# Sprite Sheet Generation Prompt

## 基本要件
Garden Wars用のスプライトシートを生成するための指示。

---

## 🎨 AI画像生成ツール用プロンプト（日本語）

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

□ 画像サイズが正確に **1376 x 768** ピクセルか
□ 背景が **透明** か（白背景ではない）
□ 4列 x 2行のグリッドになっているか
□ キャラクターが **右向き** か
□ 各フレームでキャラクターが中央に配置されているか

---

## 🔧 背景透過処理

もし白背景で生成された場合は、以下のツールで透過処理：
- remove.bg (https://www.remove.bg/)
- Photoshop / GIMP
- `npm run remove-bg` (プロジェクト内スクリプト)

---

## 📝 ファイル命名規則

生成後、以下の名前で保存：
- `[unit_id]_sheet.png` (例: `ur_dragon_sheet.png`)

配置先：
- `public/assets/sprites/[unit_id]_sheet.png`
