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

## 2. Atlas JSON Structure
JSONはTexture Packer形式（HashまたはArray）をサポートします。
各フレームの `filename` は以下の命名規則を**厳守**してください。

**Format:** `[unit_id]_[motion]_[n].png`
- `unit_id`: キャラクターID（例: `ur_knight`, `lennon`）
- `motion`: `idle`, `walk`, `attack`, `die`
- `n`: フレーム番号（例: `1`, `2`... 省略可だが複数フレーム時は必須）

**Examples:**
- `ur_knight_idle_1.png`
- `lennon_idle.png`
- `lennon_attack_1.png`

**Checking:**
JSONを開き、`filename`（キー）が `idle.png` のようになっていないか確認してください。必ず `ur_knight_idle.png` のようにプレフィックスが必要です。

## 3. Animation Keys (In Code)
ゲームロジック (`Unit.ts`) は、以下のアニメーションキーを自動的に生成・参照して再生しようとします。

| State | Animation Key | Note |
|---|---|---|
| Idle | `[unit_id]_idle` | |
| Walk | `[unit_id]_walk` | 存在しない場合は再生されず、静止画(Idle)のまま移動します（エラー回避のみ） |
| Attack | `[unit_id]_attack` | |
| Die | `[unit_id]_die` | |

(例: `lennon` の場合は `lennon_idle`, `lennon_attack` が使用されます)

## 4. Implementation Steps (For Developers)

新規キャラクターを実装する場合、以下の手順が必要です。自動読み込みではないため、手動登録が必要です。

### A. Code Registration (`src/game/scenes/BattleScene.ts`)

1.  **Preload**:
    `preload()` メソッド内でアトラスをロードします。キー名は必ず `[unit_id]_atlas` にしてください。
    ```typescript
    // Example
    this.load.atlas(
        'ur_knight_atlas', // Must contain "_atlas" suffix
        '/assets/sprites/ur_knight_sheet.png',
        '/assets/sprites/ur_knight_sheet.json'
    );
    ```

2.  **Create Animation**:
    `create()` メソッド内でアニメーションを定義します。
    
    ```typescript
    // Example: Idle
    this.anims.create({
        key: 'ur_knight_idle', // Must match naming convention
        frames: this.anims.generateFrameNames('ur_knight_atlas', {
            prefix: 'ur_knight_idle_', // Must match JSON filenames
            suffix: '.png',
            start: 1, end: 4 // Adjust based on frame count
        }),
        frameRate: 6,
        repeat: -1
    });
    ```
    
    *Hash形式（連番でない場合）は `frames: [...]` で直接指定も可能です。*

### B. Unit Logic (`src/game/entities/Unit.ts`)

*   `Unit.ts` は `definition.baseUnitId` または `definition.id` を使って、自動的に `[id]_atlas` の存在チェックを行います。
*   アトラスが存在すれば `hasAnimation = true` となり、ステート変更時に `[id]_walk` などを再生しようとします。
*   **注意:** `src/data/units.json` の `animKeys` 設定は、現在の実装では無視されています（ハードコードされた命名規則が優先されます）。しかし、将来的な改修のために `animKeys` も記述しておくことを推奨します。

## 5. Troubleshooting

- **SSRキャラが黒く表示される / アニメーションしない:**
    - `BattleScene.ts` でロードしているか確認。
    - アトラスキーが `_atlas` で終わっているか確認。
    - JSON内のフレーム名にプレフィックス (`[id]_`) がついているか確認。
    - `BattleScene` で定義した `key` と、Unitが再生しようとする `[id]_[motion]` が一致しているか確認。

- **静止画のまま動く:**
    - `walk` アニメーションが定義されていない場合、エラーにならず静止画（または直前のIdle）のまま移動します（仕様）。
