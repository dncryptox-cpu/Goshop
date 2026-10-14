-- DNC Desk: chạy 1 lần trong Supabase SQL Editor
create table if not exists public.desk_docs (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('settings','day','note')),
  key        text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);

alter table public.desk_docs enable row level security;

drop policy if exists "desk_docs_own" on public.desk_docs;
create policy "desk_docs_own" on public.desk_docs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
