# Animation Implementation Requirements

## Overview
Garden Warsのアニメーション実装に関する仕様書です。
既存のSSRユニット（Lennonなど）の実装パターンを基準としています。
新規キャラクターを追加する際は、本仕様に従ってください。

## 1. Asset Naming Conventions
アセットファイルは以下の命名規則に従って配置してください。

- **Sprite Sheet Image**: `public/assets/sprites/[unit_id]_sheet.png`
- **Atlas Definition**: `public/assets/sprites/[unit_id]_sheet.json`
- **Icon Image**: `public/assets/sprites/[unit_id].png` (推奨サイズ: 256x256)

**Example (`ur_knight`):**
- `ur_knight_sheet.png` (アニメーション用シート)
- `ur_knight_sheet.json` (座標定義)
- `ur_knight.png` (静止画アイコン)

## 2. Sprite Sheet Specifications
スプライトシートは以下の仕様で作成してください。

### 推奨レイアウト
- **サイズ**: 1376 x 768 px
- **グリッド**: 4列 x 2行（各フレーム 344 x 384 px）

| Row | Col 0 | Col 1 | Col 2 | Col 3 |
|-----|-------|-------|-------|-------|
| 0 | idle | walk_1 | walk_2 | walk_3 |
| 1 | attack_1 | attack_2 | attack_3 | attack_4 |

### 6列x2行レイアウト（代替）
- **サイズ**: 1376 x 768 px
- **グリッド**: 6列 x 2行（各フレーム 229 x 384 px）
- **注意**: フレームが小さくなるため、units.jsonの`scale`を大きめに設定する必要があります

## 3. Atlas JSON Structure
JSONはTexture Packer形式（HashまたはArray）をサポートします。
各フレームの `filename` は以下の命名規則を**厳守**してください。

**Format:** `[unit_id]_[motion]_[n].png` または `[unit_id]_[motion].png`
- `unit_id`: キャラクターID（例: `ur_knight`, `lennon`）
- `motion`: `idle`, `walk`, `attack`, `die`
- `n`: フレーム番号（例: `1`, `2`... 単一フレームの場合は省略可）

**Examples:**
```
thunder_golem_idle.png      // 単一フレーム（番号なし）
thunder_golem_walk_1.png    // 複数フレーム（番号付き）
thunder_golem_attack_1.png
```

### JSON Example (thunder_golem形式)
```json
{
    "frames": {
        "thunder_golem_idle.png": {
            "frame": { "x": 0, "y": 0, "w": 344, "h": 384 },
            "sourceSize": { "w": 344, "h": 384 }
        },
        "thunder_golem_walk_1.png": {
            "frame": { "x": 344, "y": 0, "w": 344, "h": 384 },
            "sourceSize": { "w": 344, "h": 384 }
        }
    },
    "meta": {
        "image": "thunder_golem_sheet.png",
        "size": { "w": 1376, "h": 768 }
    }
}
```

**重要**: `animations`セクションは不要です。フレーム名の命名規則に従っていれば自動認識されます。

## 4. ANIMATED_UNITS Registration ⚠️ REQUIRED
**これを忘れるとアニメーションが動きません！**

`src/components/ui/UnitAnimationPreview.tsx` の `ANIMATED_UNITS` 配列にユニットIDを追加する必要があります。

```typescript
export const ANIMATED_UNITS = [
    "cat_warrior",
    "corn_fighter",
    // ... 既存のユニット
    "your_new_unit_id",  // ← 追加
] as const;
```

この配列に含まれていないユニットは：
- Teamページでアニメーションアイコンが表示されない
- 詳細モーダルでアニメーションプレビューが表示されない

## 5. Animation Keys (In Code)
ゲームロジック (`Unit.ts`) は、以下のアニメーションキーを自動的に生成・参照して再生しようとします。

| State | Animation Key | Note |
|---|---|---|
| Idle | `[unit_id]_idle` | |
| Walk | `[unit_id]_walk` | 存在しない場合は再生されず、静止画(Idle)のまま移動します（エラー回避のみ） |
| Attack | `[unit_id]_attack` | |
| Die | `[unit_id]_die` | |

(例: `lennon` の場合は `lennon_idle`, `lennon_attack` が使用されます)

## 6. Implementation Checklist
新規キャラクターにアニメーションを追加する際のチェックリスト：

- [ ] スプライトシート画像を作成 (`[unit_id]_sheet.png`)
- [ ] 座標定義JSONを作成 (`[unit_id]_sheet.json`)
- [ ] フレーム名が `[unit_id]_[motion].png` 形式になっている
- [ ] **ANIMATED_UNITSに追加** ← よく忘れる！
- [ ] **smallSpriteUnitsに追加** ← これも忘れがち！（表示サイズ調整）
- [ ] units.jsonに`atlasKey`と`animKeys`を設定
- [ ] 必要に応じて`scale`を調整

## 7. smallSpriteUnits Registration ⚠️ REQUIRED
**これを忘れるとアニメーションが小さく表示されます！**

`src/components/ui/UnitAnimationPreview.tsx` の `smallSpriteUnits` 配列にユニットIDを追加してください。

```typescript
const smallSpriteUnits = [
    "thunder_golem", 
    "flame_knight", 
    // ... 既存のユニット
    "your_new_unit_id",  // ← 追加
];
```

この配列に含まれていないユニットは、Teamページのプレビューで小さく表示されます。

## 8. Troubleshooting

### Teamページでアニメーションアイコンが表示されない
→ `ANIMATED_UNITS`配列にユニットIDを追加したか確認

### アニメーションが小さく表示される
→ `smallSpriteUnits`配列にユニットIDを追加したか確認
→ フレームサイズが小さい場合、units.jsonの`scale`も大きく設定

### SSRキャラが黒く表示される / アニメーションしない
- `BattleScene.ts` でロードしているか確認
- アトラスキーが `_atlas` で終わっているか確認
- JSON内のフレーム名にプレフィックス (`[id]_`) がついているか確認

### 静止画のまま動く
- `walk` アニメーションが定義されていない場合、エラーにならず静止画のまま移動します（仕様）
