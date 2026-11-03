-- Rage — schema đa người dùng (dùng chung project gointelligence, mọi bảng có tiền tố rage_)
create table if not exists public.rage_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  level text,
  goal text,
  plan text not null default 'free',
  daily_limit int not null default 5,
  created_at timestamptz not null default now()
);

create table if not exists public.rage_videos (
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

create table if not exists public.rage_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.rage_videos(id) on delete cascade,
  phrases jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);
create index if not exists rage_lessons_user_created on public.rage_lessons (user_id, created_at desc);

create table if not exists public.rage_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid references public.rage_lessons(id) on delete cascade,
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
create index if not exists rage_cards_user_due on public.rage_cards (user_id, due);

alter table public.rage_profiles enable row level security;
alter table public.rage_videos   enable row level security;
alter table public.rage_lessons  enable row level security;
alter table public.rage_cards    enable row level security;

-- profiles: tự tạo / đọc / sửa hồ sơ của mình; không tự sửa plan, daily_limit
drop policy if exists "rage own profile read" on public.rage_profiles;
create policy "rage own profile read" on public.rage_profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "rage own profile insert" on public.rage_profiles;
create policy "rage own profile insert" on public.rage_profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "rage own profile update" on public.rage_profiles;
create policy "rage own profile update" on public.rage_profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
revoke insert, update, delete on public.rage_profiles from anon, authenticated;
grant select on public.rage_profiles to authenticated;
grant insert (id, display_name, level, goal) on public.rage_profiles to authenticated;
grant update (display_name, level, goal) on public.rage_profiles to authenticated;

-- videos: đọc khi đăng nhập; chỉ backend ghi
drop policy if exists "rage videos read" on public.rage_videos;
create policy "rage videos read" on public.rage_videos for select to authenticated using (true);
revoke insert, update, delete on public.rage_videos from anon, authenticated;

-- lessons: đọc / xoá của mình; tạo qua backend (để đếm hạn mức)
drop policy if exists "rage own lessons read" on public.rage_lessons;
create policy "rage own lessons read" on public.rage_lessons for select to authenticated using (auth.uid() = user_id);
drop policy if exists "rage own lessons delete" on public.rage_lessons;
create policy "rage own lessons delete" on public.rage_lessons for delete to authenticated using (auth.uid() = user_id);
revoke insert, update on public.rage_lessons from anon, authenticated;

-- cards: toàn quyền trên thẻ của mình
drop policy if exists "rage own cards all" on public.rage_cards;
create policy "rage own cards all" on public.rage_cards for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.rage_profiles, public.rage_videos, public.rage_lessons, public.rage_cards from anon;
select 'lh schema ok' as result;

-- Thử thách 100 ngày
alter table public.rage_profiles add column if not exists challenge_start date;
grant update (challenge_start) on public.rage_profiles to authenticated;
create table if not exists public.rage_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  listened boolean not null default false,
  spoke boolean not null default false,
  posted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.rage_days enable row level security;
create policy "rage own days all" on public.rage_days for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 20 tình huống nói
create table if not exists public.rage_scenes (
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_id text not null,
  best int not null default 0,
  passed boolean not null default false,
  tries int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, scene_id)
);
alter table public.rage_scenes enable row level security;
create policy "rage own scenes all" on public.rage_scenes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
