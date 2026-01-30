# Cloud Save 実装計画

## 概要

6桁PINによるシンプルなクラウドセーブシステム。子供向けに設計。

## 技術スタック

- **Backend**: Supabase (Local → Production)
- **Auth**: 6桁PIN（独自実装、Supabase Authは使わない）
- **Storage**: Supabase PostgreSQL
- **Frontend**: Next.js + React

---

## データベース設計

### players テーブル

```sql
CREATE TABLE players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pin CHAR(6) UNIQUE NOT NULL,
  name VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PIN検索用インデックス
CREATE INDEX idx_players_pin ON players(pin);
```

### player_data テーブル

```sql
CREATE TABLE player_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  coins INTEGER DEFAULT 5000,
  unit_inventory JSONB DEFAULT '{}',
  selected_team JSONB DEFAULT '[]',
  loadouts JSONB DEFAULT '[[], [], []]',
  cleared_stages JSONB DEFAULT '[]',
  garden_units JSONB DEFAULT '[]',
  shop_items JSONB DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(player_id)
);
```

### 将来用: rankings テーブル

```sql
CREATE TABLE rankings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  max_stage INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_battles INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(player_id)
);
```

---

## ユーザーフロー

### 1. 初回起動

```
[アプリ起動]
     ↓
localStorage に PIN がある？
     ↓
  NO → 選択画面表示
     ↓
┌──────────────────────────────┐
│     🐱 Garden Wars 🐱         │
│                              │
│   [ 👋 はじめて ]             │
│   [ 🔑 つづきから ]           │
└──────────────────────────────┘
```

### 2. 新規登録フロー

```
[はじめて] をタップ
     ↓
┌──────────────────────────────┐
│   なまえを いれてね           │
│   ┌────────────────────┐     │
│   │                    │     │
│   └────────────────────┘     │
│                              │
│      [ つぎへ ]              │
└──────────────────────────────┘
     ↓
[Supabase] 空いている6桁PINを生成
     ↓
┌──────────────────────────────┐
│   あなたの ばんごうは...      │
│                              │
│   ✨ 2 8 4 7 5 3 ✨          │
│                              │
│   📸 スクショ してね！        │
│   べつの たんまつで あそぶとき │
│   このばんごうが ひつようだよ  │
│                              │
│      [ はじめる！ ]          │
└──────────────────────────────┘
     ↓
[Supabase] players + player_data 作成
[localStorage] PIN を保存
     ↓
ホーム画面へ
```

### 3. ログインフロー（別端末）

```
[つづきから] をタップ
     ↓
┌──────────────────────────────┐
│   ばんごうを いれてね         │
│                              │
│   ┌─┬─┬─┬─┬─┬─┐             │
│   │ │ │ │ │ │ │             │
│   └─┴─┴─┴─┴─┴─┘             │
│                              │
│   [1][2][3][4][5]            │
│   [6][7][8][9][0]            │
│   [     ← 　    ]            │
│                              │
│      [ ログイン ]            │
└──────────────────────────────┘
     ↓
[Supabase] PIN で players 検索
     ↓
見つかった → player_data 取得 → localStorage に PIN 保存 → ホームへ
見つからない → エラー表示「ばんごうが ちがうよ」
```

### 4. 自動ログイン（同じ端末）

```
[アプリ起動]
     ↓
localStorage に PIN がある
     ↓
[Supabase] PIN で player_data 取得
     ↓
┌──────────────────────────────┐
│   おかえり、ひろと！          │
│                              │
│   [ 🎮 つづける ]            │
│   [ 🔄 べつの ひと ]          │
└──────────────────────────────┘
```

---

## API設計

### Supabase Functions (または直接クエリ)

#### 1. 新規登録
```typescript
async function registerPlayer(name: string): Promise<{ pin: string }> {
  // 1. ユニークな6桁PIN生成
  const pin = await generateUniquePIN();

  // 2. players テーブルに挿入
  const { data: player } = await supabase
    .from('players')
    .insert({ pin, name })
    .select()
    .single();

  // 3. player_data 初期データ作成
  await supabase
    .from('player_data')
    .insert({ player_id: player.id });

  return { pin };
}
```

#### 2. ログイン
```typescript
async function loginWithPIN(pin: string): Promise<PlayerData | null> {
  // 1. PIN で player 検索
  const { data: player } = await supabase
    .from('players')
    .select('id, name')
    .eq('pin', pin)
    .single();

  if (!player) return null;

  // 2. player_data 取得
  const { data: playerData } = await supabase
    .from('player_data')
    .select('*')
    .eq('player_id', player.id)
    .single();

  // 3. last_login_at 更新
  await supabase
    .from('players')
    .update({ last_login_at: new Date() })
    .eq('id', player.id);

  return { ...player, ...playerData };
}
```

#### 3. データ保存
```typescript
async function savePlayerData(pin: string, data: Partial<PlayerData>): Promise<void> {
  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('pin', pin)
    .single();

  await supabase
    .from('player_data')
    .update({ ...data, updated_at: new Date() })
    .eq('player_id', player.id);
}
```

#### 4. ユニークPIN生成
```typescript
async function generateUniquePIN(): Promise<string> {
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    // ランダム6桁生成
    const pin = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');

    // 存在チェック
    const { data } = await supabase
      .from('players')
      .select('pin')
      .eq('pin', pin)
      .single();

    if (!data) return pin; // 空いていれば採用
  }

  throw new Error('PIN generation failed');
}
```

---

## 実装フェーズ

### Phase 1: ローカル環境セットアップ ✅
- [x] Supabase Local (Docker) 起動
- [x] データベーススキーマ作成
- [x] マイグレーションファイル作成

### Phase 2: 認証UI実装 ✅
- [x] 初回起動判定ロジック (`src/contexts/AuthContext.tsx`)
- [x] 選択画面 (はじめて / つづきから) (`src/components/auth/WelcomeScreen.tsx`)
- [x] 新規登録画面 (名前入力 → PIN表示) (`src/components/auth/RegisterScreen.tsx`)
- [x] ログイン画面 (PIN入力パッド) (`src/components/auth/LoginScreen.tsx`, `PinPad.tsx`)
- [x] 自動ログイン画面 (おかえり) (`src/components/auth/WelcomeBackScreen.tsx`)
- [x] 認証ページ (`src/app/auth/page.tsx`)

### Phase 3: データ同期 ✅
- [x] Supabase Client セットアップ (`src/lib/supabase/client.ts`)
- [x] 登録API実装 (`src/lib/supabase/auth.ts`)
- [x] ログインAPI実装 (`src/lib/supabase/auth.ts`)
- [x] データ保存API実装 (`src/lib/supabase/playerData.ts`)
- [x] usePlayerData フック改修 (Supabase連携 + デバウンス保存)

### Phase 4: 既存データ移行 ✅
- [x] localStorage → Supabase 移行ロジック (`migrateLocalData` in auth.ts)
- [x] 初回ログイン時に既存データをアップロード (usePlayerData内で自動処理)

### Phase 5: 将来機能の準備 ✅
- [x] rankings テーブル作成
- [x] ランキング更新API (`updateRankings`, `incrementBattleStats`)
- [ ] ランキング取得API
- [ ] ランキング画面UI

---

## ファイル構成

```
src/
├── lib/
│   └── supabase/
│       ├── client.ts          # ✅ Supabase クライアント
│       ├── auth.ts            # ✅ PIN認証ロジック
│       ├── playerData.ts      # ✅ データ操作
│       └── index.ts           # ✅ エクスポート
├── contexts/
│   └── AuthContext.tsx        # ✅ 認証状態管理
├── hooks/
│   ├── usePlayerData.ts       # ✅ プレイヤーデータ管理（Supabase連携済み）
│   └── useAuth.ts             # ✅ 認証フック
├── app/
│   ├── providers.tsx          # ✅ AuthProvider追加
│   └── auth/
│       └── page.tsx           # ✅ 認証画面
├── components/
│   └── auth/
│       ├── index.ts           # ✅ エクスポート
│       ├── WelcomeScreen.tsx  # ✅ 選択画面
│       ├── RegisterScreen.tsx # ✅ 新規登録
│       ├── LoginScreen.tsx    # ✅ PIN入力
│       ├── PinPad.tsx         # ✅ 数字パッド
│       └── WelcomeBackScreen.tsx # ✅ おかえり画面
supabase/
├── config.toml                # ✅ Supabase Local 設定
└── migrations/
    └── 20260129133002_create_players_tables.sql  # ✅ DBスキーマ
.env.local                     # ✅ 環境変数（ローカル用）
```

---

## セキュリティ考慮事項

### 許容するリスク（子供向けゲームのため）
- 6桁PIN = 100万通り、総当たり攻撃は現実的に困難
- 課金機能なし = 金銭的被害なし
- 個人情報は名前のみ = 漏洩リスク低

### 対策
- レート制限: 同一IPから1分間に5回までログイン試行
- PIN再発行: 将来的に親向け管理画面で対応
- RLS (Row Level Security): Supabaseで適切に設定

---

## Supabase Local セットアップ

```bash
# Supabase CLI インストール（未インストールの場合）
brew install supabase/tap/supabase

# プロジェクト初期化
supabase init

# ローカル起動
supabase start

# マイグレーション作成
supabase migration new create_players_table

# マイグレーション適用
supabase db push
```

### 環境変数

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...（supabase start で表示される）
```

---

## 参考: 現在の localStorage 構造

```typescript
// 現在の usePlayerData で使用
interface PlayerData {
  coins: number;
  unitInventory: { [unitId: string]: number };
  selectedTeam: string[];
  loadouts: string[][];
  clearedStages: string[];
  gardenUnits: string[];
  shopItems: ShopItem[];
}
```

この構造を `player_data.data` JSONB カラムにそのまま保存する方針。
