-- DNC Trading OS — Backtest 100 lệnh (godnc.com/trading/backtest/)
-- Chạy 1 lần trong SQL Editor của Supabase (sau schema.sql). Chạy lại nhiều lần vẫn an toàn.
-- Ảnh dùng chung bucket 'trade-images' (thư mục {user_id}/bt/...), không cần cài thêm Storage.

-- 1. BỘ BACKTEST: mỗi bộ = 1 setup cần kiểm chứng qua N lệnh (mặc định 100)
create table if not exists public.bt_sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  market      text not null default '',          -- vd: BTCUSDT 15m
  rules       text not null default '',          -- luật vào lệnh, để nhìn lại mỗi lần
  default_rr  numeric not null default 2 check (default_rr > 0 and default_rr <= 50),
  target      int not null default 100 check (target between 10 and 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists bt_sets_user_idx on public.bt_sets (user_id, created_at desc);
alter table public.bt_sets enable row level security;
drop policy if exists "own bt sets" on public.bt_sets;
create policy "own bt sets" on public.bt_sets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. LỆNH BACKTEST
create table if not exists public.bt_trades (
  id          uuid primary key default gen_random_uuid(),
  set_id      uuid not null references public.bt_sets(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  result      text not null check (result in ('WIN','LOSS','BE')),
  r           numeric not null default 0 check (r between -50 and 50),
  direction   text not null default '' check (direction in ('','LONG','SHORT')),
  note        text not null default '' check (char_length(note) <= 4000),
  img         text not null check (img <> ''),   -- bắt buộc có ảnh chart
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists bt_trades_set_idx on public.bt_trades (set_id, created_at);
alter table public.bt_trades enable row level security;
drop policy if exists "own bt trades" on public.bt_trades;
create policy "own bt trades" on public.bt_trades for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.bt_sets s where s.id = set_id and s.user_id = auth.uid()));

-- updated_at tự cập nhật (hàm touch_updated_at đã có trong schema.sql)
drop trigger if exists bt_sets_touch on public.bt_sets;
create trigger bt_sets_touch before update on public.bt_sets for each row execute function public.touch_updated_at();
drop trigger if exists bt_trades_touch on public.bt_trades;
create trigger bt_trades_touch before update on public.bt_trades for each row execute function public.touch_updated_at();
