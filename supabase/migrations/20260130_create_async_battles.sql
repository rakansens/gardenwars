-- ============================================
-- Async Battles Table
-- 非同期バトル（プレイヤー対戦）の結果を記録
-- ============================================

-- async_battles テーブル作成
create table if not exists async_battles (
  id uuid primary key default gen_random_uuid(),
  attacker_id text not null,
  defender_id text not null,
  attacker_deck text[] not null,
  defender_deck text[] not null,
  winner text not null check (winner in ('attacker', 'defender')),
  attacker_castle_hp int default 0,
  defender_castle_hp int default 0,
  attacker_kills int default 0,
  defender_kills int default 0,
  battle_duration int default 0,
  created_at timestamp with time zone default now()
);

-- インデックス作成（検索高速化）
create index if not exists idx_async_battles_attacker on async_battles(attacker_id);
create index if not exists idx_async_battles_defender on async_battles(defender_id);
create index if not exists idx_async_battles_created_at on async_battles(created_at desc);

-- RLS（Row Level Security）有効化
alter table async_battles enable row level security;

-- ポリシー: 全員が読み取り可能
create policy "Anyone can read async_battles"
  on async_battles for select
  using (true);

-- ポリシー: 認証済みユーザーが挿入可能
create policy "Authenticated users can insert async_battles"
  on async_battles for insert
  with check (true);

-- コメント追加
comment on table async_battles is '非同期プレイヤー対戦の結果記録';
comment on column async_battles.attacker_id is '攻撃側プレイヤーID';
comment on column async_battles.defender_id is '防衛側プレイヤーID';
comment on column async_battles.attacker_deck is '攻撃側のデッキ（ユニットID配列）';
comment on column async_battles.defender_deck is '防衛側のデッキ（ユニットID配列）';
comment on column async_battles.winner is '勝者（attacker または defender）';
comment on column async_battles.battle_duration is 'バトル時間（秒）';
