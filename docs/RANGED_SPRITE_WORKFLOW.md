# 遠距離攻撃スプライトシート ワークフロー

## 概要

遠距離攻撃キャラ用のスプライトシート生成ワークフロー。
攻撃フレームが横に広く、ビーム/ブレス/投擲などのエフェクトが画面端まで届く。

## 通常版との違い

| 項目 | 通常版 | 遠距離版 |
|------|--------|----------|
| スクリプト | `generate_ur_sprite.js` | `generate_ranged_sprite.js` |
| 出力サイズ | 1376×768 | 880×1216（可変） |
| レイアウト | 4列×2行（全フレーム同サイズ） | Row1: 4列, Row2-5: フル幅 |
| idle/walk | 344×384 | 220×200 |
| attack | 344×384 | 880×240（フル幅） |

## 対象キャラの判断基準

以下のキャラは遠距離版を推奨：
- ドラゴン（ブレス攻撃）
- メイジ/ウィザード（ビーム魔法）
- アーチャー（矢の軌道）
- ガンダム/メカ（レーザー/キャノン）
- 植物系で蔓を伸ばすキャラ

## ワークフロー手順

### Step 1: スプライトシート生成

```bash
node generate_ranged_sprite.js <入力画像> <出力PNG>
```

例:
```bash
node generate_ranged_sprite.js public/assets/sprites/allies/UR/ur_cosmic_dragon.webp public/assets/sprites/sheets/ur_cosmic_dragon_sheet.png
```

### Step 2: 背景除去

```bash
node remove_green.js public/assets/sprites/sheets/ur_xxx_sheet.png
```

### Step 3: WebP変換

```bash
cwebp -q 90 public/assets/sprites/sheets/ur_xxx_sheet.png -o public/assets/sprites/sheets/ur_xxx_sheet.webp
```

### Step 4: 画像サイズ確認

```bash
file public/assets/sprites/sheets/ur_xxx_sheet.png | grep -o '[0-9]* x [0-9]*'
```

### Step 5: JSONアトラス作成

画像サイズに応じてy座標を調整。基本テンプレート:

```json
{
  "frames": {
    "ur_xxx_idle.png": { "frame": { "x": 0, "y": 0, "w": 220, "h": 200 } },
    "ur_xxx_walk_1.png": { "frame": { "x": 220, "y": 0, "w": 220, "h": 200 } },
    "ur_xxx_walk_2.png": { "frame": { "x": 440, "y": 0, "w": 220, "h": 200 } },
    "ur_xxx_walk_3.png": { "frame": { "x": 660, "y": 0, "w": 220, "h": 200 } },
    "ur_xxx_attack_1.png": { "frame": { "x": 0, "y": 250, "w": 880, "h": 240 } },
    "ur_xxx_attack_2.png": { "frame": { "x": 0, "y": 490, "w": 880, "h": 240 } },
    "ur_xxx_attack_3.png": { "frame": { "x": 0, "y": 730, "w": 880, "h": 240 } },
    "ur_xxx_attack_4.png": { "frame": { "x": 0, "y": 970, "w": 880, "h": 246 } }
  },
  "meta": {
    "image": "ur_xxx_sheet.webp",
    "format": "RGBA8888",
    "size": { "w": 880, "h": 1216 },
    "scale": "1",
    "type": "ranged"
  }
}
```

**注意**: y座標は生成画像によって調整が必要。上のフレームが見える場合はy値を増やす。

### Step 6: テスト確認

```
http://localhost:3000/test-ranged
```

テストページでアニメーションを確認。攻撃時に上のフレームが見えないことを確認。

### Step 7: クリーンアップ

```bash
rm public/assets/sprites/sheets/ur_xxx_sheet.png
```

## 一括処理スクリプト（将来実装予定）

```bash
# TODO: 自動化スクリプト
./scripts/generate_ranged_batch.sh ur_mage ur_archer ur_cosmic_dragon
```

## トラブルシューティング

### 上のフレームが見える
→ JSONのattackフレームのy座標を増やす（+10〜30）

### サイズが想定と違う
→ AIが生成するサイズは毎回異なる可能性あり。画像サイズを確認してJSONを調整

### 攻撃エフェクトが短い
→ 再生成するか、プロンプトを調整

## 遠距離版に変換済みキャラ

- [x] ur_cosmic_dragon (コズミックドラゴン - ブレス攻撃)
- [x] ur_botanical_gundam (ボタニカルガンダム - レーザービーム)
- [x] ur_archer (黄金の天使アーチャー - 矢の軌道)
- [x] ur_phoenix (フェニックス - 炎ブレス)
- [x] ur_mage (ダークメイジ - 魔法ビーム)
- [x] ur_sea_leviathan (シーレヴィアタン - 水流攻撃)

## 変換候補キャラ

- [ ] ur_dragon (食虫植物 - 近接向きかも)
- [ ] ur_aurora_mage_cat (オーロラ魔法猫)
- [ ] ur_thunder_phoenix (雷フェニックス - ファイルなし)
