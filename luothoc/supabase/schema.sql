-- Lướt Học — schema đa người dùng (dùng chung project gointelligence, mọi bảng có tiền tố lh_)
create table if not exists public.lh_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  level text,
  goal text,
  plan text not null default 'free',
  daily_limit int not null default 5,
  created_at timestamptz not null default now()
);

create table if not exists public.lh_videos (
  id uuid primary key default gen_random_uuid(),
  url_key text unique not null,
  url text not null,
  platform text not null,
  title text,
  level text,
  media jsonb not null,
  lines jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.lh_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.lh_videos(id) on delete cascade,
  phrases jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);
create index if not exists lh_lessons_user_created on public.lh_lessons (user_id, created_at desc);

create table if not exists public.lh_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid references public.lh_lessons(id) on delete cascade,
  en text not null,
  vi text not null,
  note text,
  wrong jsonb not null default '[]',
  line text,
  line_vi text,
  step int not null default 0,
  due timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, en)
);
create index if not exists lh_cards_user_due on public.lh_cards (user_id, due);

alter table public.lh_profiles enable row level security;
alter table public.lh_videos   enable row level security;
alter table public.lh_lessons  enable row level security;
alter table public.lh_cards    enable row level security;

-- profiles: tự tạo / đọc / sửa hồ sơ của mình; không tự sửa plan, daily_limit
drop policy if exists "lh own profile read" on public.lh_profiles;
create policy "lh own profile read" on public.lh_profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "lh own profile insert" on public.lh_profiles;
create policy "lh own profile insert" on public.lh_profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "lh own profile update" on public.lh_profiles;
create policy "lh own profile update" on public.lh_profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
revoke insert, update, delete on public.lh_profiles from anon, authenticated;
grant select on public.lh_profiles to authenticated;
grant insert (id, display_name, level, goal) on public.lh_profiles to authenticated;
grant update (display_name, level, goal) on public.lh_profiles to authenticated;

-- videos: đọc khi đăng nhập; chỉ backend ghi
drop policy if exists "lh videos read" on public.lh_videos;
create policy "lh videos read" on public.lh_videos for select to authenticated using (true);
revoke insert, update, delete on public.lh_videos from anon, authenticated;

-- lessons: đọc / xoá của mình; tạo qua backend (để đếm hạn mức)
drop policy if exists "lh own lessons read" on public.lh_lessons;
create policy "lh own lessons read" on public.lh_lessons for select to authenticated using (auth.uid() = user_id);
drop policy if exists "lh own lessons delete" on public.lh_lessons;
create policy "lh own lessons delete" on public.lh_lessons for delete to authenticated using (auth.uid() = user_id);
revoke insert, update on public.lh_lessons from anon, authenticated;

-- cards: toàn quyền trên thẻ của mình
drop policy if exists "lh own cards all" on public.lh_cards;
create policy "lh own cards all" on public.lh_cards for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.lh_profiles, public.lh_videos, public.lh_lessons, public.lh_cards from anon;
select 'lh schema ok' as result;
