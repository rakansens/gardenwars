# パフォーマンス調査レポート

## 調査日: 2026-02-01
## 対象: GardenWars 全ページ

---

## 1. エグゼクティブサマリー

### 問題ページ（LCP > 500ms）
| ページ | LCP | 主な原因 | 優先度 |
|--------|-----|----------|--------|
| `/team` | 802ms | Render Delay 784ms | 🔴 高 |
| `/gacha` | 762ms | Load Delay 285ms + Render Delay 457ms | 🔴 高 |
| `/collection` | 714ms | Render Delay 696ms | 🔴 高 |

### 良好なページ
| ページ | LCP | 評価 |
|--------|-----|------|
| `/ranking` | 88ms | ✅ 優秀 |
| `/arena` | 89ms | ✅ 優秀 |
| `/async-battle/result` | 90ms | ✅ 優秀 |
| `/result` | 101ms | ✅ 優秀 |
| `/` (ホーム) | 113ms | ✅ 優秀 |

---

## 2. 根本原因分析

### 2.1 共通の問題点

#### 問題1: 大量のユニットカードの同時レンダリング
- **影響度**: 🔴 高
- **対象ページ**: /team, /gacha, /collection
- **詳細**:
  - ユニット総数: **188体**
  - 各ページで100〜188体のユニットカードを一度にDOMにレンダリング
  - 各カードに複雑なスタイル（グラデーション、シャドウ、アニメーション）を適用

```tsx
// 現状: 全ユニットを一度にレンダリング
{sortedUnits.map((unit) => (
    <div className="...complex styles...">{/* カード内容 */}</div>
))}
```

#### 問題2: `hasAnimation()` の繰り返し呼び出し
- **影響度**: 🟡 中
- **対象**: /team, /collection
- **詳細**:
  - 各ユニットカードで `hasAnimation(unit.atlasKey || unit.id)` を呼び出し
  - 配列の線形検索（O(n)）を188回実行 = O(n²) の計算量

```tsx
// team/page.tsx:335, 496
const unitHasAnimation = hasAnimation(unit.atlasKey || unit.id);
```

#### 問題3: レンダリング中の計算処理
- **影響度**: 🟡 中
- **対象**: 全問題ページ
- **詳細**:
  - DPS計算: `unit.attackDamage * (1000 / unit.attackCooldownMs)`
  - ドロップレート計算: 複雑な重み付け計算
  - ソート処理: 毎レンダリングで実行

#### 問題4: 画像最適化の不足
- **影響度**: 🟡 中
- **対象**: /gacha
- **詳細**:
  - `/assets/ui/gacha_*.png` 画像の遅延読み込みなし
  - LCP Load Delay: 285ms（画像読み込み待ち）

---

## 3. ページ別詳細分析

### 3.1 /team ページ（LCP: 802ms）

**コード行数**: 623行

**問題点**:
1. `allyUnits`（味方ユニット全体）を一度に表示
2. 所持/未所持の2グリッドで最大376カード表示可能
3. 各カードで9種類のステータス表示（HP, ATK, DPS, Range, Speed, Move, Cost, Spawn, DropRate）
4. カードごとに複雑なボタン状態管理（選択中/他デッキ/追加可能/満員）

**LCP内訳**:
- TTFB: 18ms（サーバー応答）
- Render Delay: **784ms**（JavaScript実行・DOM構築）

### 3.2 /gacha ページ（LCP: 762ms）

**コード行数**: 792行

**問題点**:
1. URショーケース（カルーセル/グリッド切替）
2. NEWユニット一覧
3. 所持ユニット一覧
4. 未所持ユニット一覧
5. ガチャ履歴
6. 3つのガチャボタン画像

**LCP内訳**:
- TTFB: 19ms
- Load Delay: **285ms**（画像読み込み）
- Load Duration: 2ms
- Render Delay: **457ms**

### 3.3 /collection ページ（LCP: 714ms）

**コード行数**: 361行

**問題点**:
1. 全ユニット（188体）をグリッド表示
2. 進捗統計計算（レアリティ別）
3. useMemo使用もグリッドレンダリングは最適化なし

**LCP内訳**:
- TTFB: 18ms
- Render Delay: **696ms**

---

## 4. 対応策

### 4.1 即効性のある対策（推奨優先度: 高）

#### 対策A: 仮想化リストの導入
**期待効果**: LCP 50-70%削減

```bash
npm install @tanstack/react-virtual
```

```tsx
// 変更前: 全件レンダリング
<div className="grid">
    {units.map(unit => <UnitCard key={unit.id} unit={unit} />)}
</div>

// 変更後: 可視範囲のみレンダリング
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
    count: units.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // カード高さ
    overscan: 5,
});

<div ref={parentRef} style={{ height: '80vh', overflow: 'auto' }}>
    <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
            <UnitCard key={units[virtualRow.index].id} unit={units[virtualRow.index]} />
        ))}
    </div>
</div>
```

#### 対策B: hasAnimation結果のメモ化
**期待効果**: 計算時間 80%削減

```tsx
// src/lib/sprites.ts に追加
const animationCache = new Map<string, boolean>();

export function hasAnimation(unitId: string): boolean {
    if (animationCache.has(unitId)) {
        return animationCache.get(unitId)!;
    }
    const result = ANIMATED_UNITS.includes(unitId as AnimatedUnitId);
    animationCache.set(unitId, result);
    return result;
}
```

または、Setに変更:
```tsx
const ANIMATED_UNITS_SET = new Set(ANIMATED_UNITS);

export function hasAnimation(unitId: string): boolean {
    return ANIMATED_UNITS_SET.has(unitId);
}
```

#### 対策C: 計算結果のメモ化
**期待効果**: レンダリング時間 20-30%削減

```tsx
// DPS計算のメモ化
const unitDPS = useMemo(() => {
    const dpsMap = new Map<string, number>();
    allUnits.forEach(unit => {
        dpsMap.set(unit.id, unit.attackDamage * (1000 / unit.attackCooldownMs));
    });
    return dpsMap;
}, []);

// ドロップレートのメモ化
const dropRates = useMemo(() => {
    const rateMap = new Map<string, number>();
    gachaPool.forEach(unit => {
        rateMap.set(unit.id, calculateDropRate(unit));
    });
    return rateMap;
}, []);
```

### 4.2 中期的な対策

#### 対策D: ページネーション/無限スクロール
**期待効果**: 初期ロード LCP 60-80%削減

```tsx
const ITEMS_PER_PAGE = 20;
const [page, setPage] = useState(1);
const displayedUnits = units.slice(0, page * ITEMS_PER_PAGE);

// 無限スクロール用
const { ref: loadMoreRef, inView } = useInView();
useEffect(() => {
    if (inView && displayedUnits.length < units.length) {
        setPage(p => p + 1);
    }
}, [inView]);
```

#### 対策E: 画像の遅延読み込み（/gacha）
**期待効果**: Load Delay 50%削減

```tsx
// Next.js Image の priority と loading 属性を適切に設定
<Image
    src="/assets/ui/gacha_1pull.png"
    alt="1回ガチャ"
    width={96}
    height={96}
    loading="lazy"  // 画面外の画像は遅延読み込み
/>
```

#### 対策F: React.memo によるカード再レンダリング防止
**期待効果**: フィルター変更時のパフォーマンス向上

```tsx
const UnitCard = React.memo(({ unit, isSelected, onToggle }: UnitCardProps) => {
    // カード内容
}, (prevProps, nextProps) => {
    return prevProps.unit.id === nextProps.unit.id
        && prevProps.isSelected === nextProps.isSelected;
});
```

### 4.3 長期的な対策

#### 対策G: Server Components 活用
**期待効果**: JavaScript バンドルサイズ削減

```tsx
// 静的なユニットリストはServer Componentで
// app/team/UnitGrid.tsx (Server Component)
export default function UnitGrid({ units }: { units: UnitDefinition[] }) {
    return (
        <div className="grid">
            {units.map(unit => <UnitCardStatic key={unit.id} unit={unit} />)}
        </div>
    );
}

// インタラクティブな部分のみClient Component
// app/team/UnitCardInteractive.tsx
'use client';
export default function UnitCardInteractive({ unitId }: { unitId: string }) {
    const { selectedTeam, toggleUnit } = useTeam();
    // インタラクション処理
}
```

#### 対策H: Web Worker でのデータ処理
**期待効果**: メインスレッドのブロック回避

```tsx
// ソートやフィルタリングをWeb Workerに移動
const worker = new Worker('/workers/unitProcessor.js');
worker.postMessage({ type: 'SORT', units, sortBy });
worker.onmessage = (e) => setSortedUnits(e.data);
```

---

## 5. 実装優先順位

### Phase 1（即時対応 - 1週間以内）✅ 完了
1. ✅ **hasAnimation の Set 化** - 実装完了, 効果: 高
2. ✅ **計算結果のメモ化（DPS, DropRate, SpawnCooldown）** - 実装完了, 効果: 中
3. ✅ **React.memo 適用（UnitCard, RarityFrame）** - 実装完了, 効果: 中

### Phase 2（短期対応 - 2週間以内）✅ 完了
4. ✅ **仮想化リスト導入（/collection, /team）** - VirtualizedGrid コンポーネント作成・適用完了
5. ✅ **画像遅延読み込み（/gacha, RarityFrame）** - Next.js Image + loading="lazy" 適用完了

### Phase 3（中期対応 - 1ヶ月以内）
6. 📋 **ページネーション/無限スクロール** - 実装: 4時間, 効果: 高
7. 📋 **Server Components 移行検討** - 実装: 8時間, 効果: 中

---

## 6. 改善効果（実測値）

### 最終測定結果（2026-02-01）

| ページ | 改善前 | 改善後 | 削減率 | 目標達成 |
|--------|--------|--------|--------|----------|
| /team | 802ms | **329ms** | **59%** | ✅ |
| /gacha | 762ms | **712ms** | **7%** | ⚠️ 継続改善 |
| /collection | 714ms | **329ms** | **54%** | ✅ |

### 実施した最適化

1. **hasAnimation の Set 化** (`src/lib/sprites.ts`)
   - `ANIMATED_UNITS_SET = new Set(ANIMATED_UNITS)` に変更
   - O(n) → O(1) のルックアップ

2. **計算結果の事前キャッシュ** (`/team`, `/gacha`, `/collection`)
   - `unitStatsCache` Map に DPS, DropRate, SpawnCooldown, hasAnimation を事前計算
   - レンダリング時の計算を排除

3. **React.memo 適用** (`UnitCard.tsx`, `RarityFrame.tsx`)
   - カスタム比較関数で不要な再レンダリングを防止

4. **仮想化グリッド導入** (`VirtualizedGrid.tsx`)
   - @tanstack/react-virtual を使用
   - 可視範囲のみをレンダリング（188ユニット → 表示行数のみ）

5. **画像遅延読み込み** (`RarityFrame.tsx`, `/gacha`)
   - Next.js Image コンポーネントの `loading="lazy"` 属性

### /gacha ページの継続課題

LCPDiscovery インサイトによると、LCP 画像（ガチャボタン）の遅延読み込みが Load Delay を引き起こしている可能性あり。
今後の対策:
- LCP 対象画像には `priority={true}` を設定
- Above-the-fold のガチャボタン画像はプリロード検討

**目標**: 全ページ LCP < 300ms（Core Web Vitals "Good" 基準: 2500ms 以下だが、ゲームアプリとして 300ms 以下を推奨）

---

## 7. 保存されたトレースファイル

詳細分析用にトレースデータを保存しています：

- `trace.json.gz` - / (ホーム)
- `trace-garden.json.gz` - /garden
- `trace-auth.json.gz` - /auth
- `trace-arena.json.gz` - /arena
- `trace-battle.json.gz` - /battle
- `trace-result.json.gz` - /result
- `trace-fusion.json.gz` - /fusion
- `trace-team.json.gz` - /team ⚠️
- `trace-gacha.json.gz` - /gacha ⚠️
- `trace-marketplace.json.gz` - /marketplace
- `trace-async-battle.json.gz` - /async-battle
- `trace-async-battle-result.json.gz` - /async-battle/result
- `trace-stages.json.gz` - /stages
- `trace-collection.json.gz` - /collection ⚠️
- `trace-shop.json.gz` - /shop
- `trace-ranking.json.gz` - /ranking
- `trace-worldmap.json.gz` - /worldmap
- `trace-battle-realtime.json.gz` - /battle/realtime

---

## 8. 参考リンク

- [Chrome DevTools Performance Insights](https://developer.chrome.com/docs/devtools/performance-insights)
- [Optimize Largest Contentful Paint](https://web.dev/articles/optimize-lcp)
- [TanStack Virtual](https://tanstack.com/virtual/latest)
- [React.memo](https://react.dev/reference/react/memo)
- [Next.js Image Optimization](https://nextjs.org/docs/pages/building-your-application/optimizing/images)
