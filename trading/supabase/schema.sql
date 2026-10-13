-- DNC Trading OS — Supabase schema (thay cho Google Sheet + Apps Script)
-- Chạy 1 lần trong SQL Editor của project Supabase.

-- 1. PROFILES: 1 dòng / user (vốn, tiền tệ, % rủi ro, Gemini key riêng)
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  username       text unique not null,
  capital        numeric not null default 10000,
  currency       text    not null default 'USD' check (currency in ('USD','VND')),
  risk_percent   numeric not null default 5,
  gemini_api_key text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Tự tạo profile khi tạo user (username lấy từ user_metadata.username)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. TRADES: số thật, ngày thật — không còn lỗi định dạng vi-VN
create table if not exists public.trades (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trade_date   date not null default current_date,
  pair         text not null,
  direction    text not null check (direction in ('LONG','SHORT')),
  entry_price  numeric not null default 0,
  stop_loss    numeric not null default 0,
  take_profit  numeric not null default 0,
  lots         numeric not null default 0,
  dollar_value numeric not null default 0,
  risk_usd     numeric not null default 0,
  rr_ratio     numeric not null default 0,
  pnl          numeric not null default 0,
  r_achieved   numeric not null default 0,
  status       text not null default 'RUNNING',
  note         text not null default '',
  setup_tag    text not null default '',
  img_htf      text not null default '',
  img_mtf      text not null default '',
  img_ltf      text not null default '',
  legacy_id    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists trades_user_date_idx on public.trades (user_id, trade_date desc, created_at desc);
alter table public.trades enable row level security;
drop policy if exists "own trades" on public.trades;
create policy "own trades" on public.trades for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trades_touch on public.trades;
create trigger trades_touch before update on public.trades for each row execute function public.touch_updated_at();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();


-- Không cho user tự đổi username (username gắn với email đăng nhập)
create or replace function public.lock_username() returns trigger language plpgsql as $$
begin
  if new.username is distinct from old.username and auth.uid() is not null then
    raise exception 'Không được đổi username';
  end if;
  return new;
end $$;
drop trigger if exists profiles_lock_username on public.profiles;
create trigger profiles_lock_username before update on public.profiles for each row execute function public.lock_username();

-- 3. STORAGE: bucket ảnh chart. Đọc công khai qua link (đường dẫn chứa uuid, không đoán được),
--    chỉ chủ sở hữu được upload/xoá trong thư mục {user_id}/
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trade-images', 'trade-images', true, 5242880, array['image/webp','image/png','image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/webp','image/png','image/jpeg'];

drop policy if exists "trade images insert own" on storage.objects;
drop policy if exists "trade images update own" on storage.objects;
drop policy if exists "trade images delete own" on storage.objects;
create policy "trade images insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'trade-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "trade images update own" on storage.objects for update to authenticated
  using (bucket_id = 'trade-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "trade images delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'trade-images' and (storage.foldername(name))[1] = auth.uid()::text);
