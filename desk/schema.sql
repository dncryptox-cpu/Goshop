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

-- ===== Inbox: mọi thứ nhắn vào bot @goshopassistantbot (chạy thêm đoạn này 1 lần) =====
create table if not exists public.desk_inbox (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  src        text not null default 'web',          -- telegram | web
  tg_chat    bigint,
  tg_msg     bigint,
  tg_group   text,                                  -- media_group_id (album ảnh gộp 1 mục)
  raw        text not null default '',              -- nguyên văn / chú thích / lời voice
  fwd        text,                                  -- chuyển tiếp từ ai
  title      text,
  kind       text not null default 'remind' check (kind in ('shop','personal','trading','crypto','remind')),
  due        date,
  status     text not null default 'inbox' check (status in ('inbox','todo','waiting','done','trash')),
  memo       text,                                  -- ghi chú xử lý
  files      jsonb not null default '[]'::jsonb,    -- [{path,name,type,size}]
  ai         jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at    timestamptz,
  unique (tg_chat, tg_msg)
);
create index if not exists desk_inbox_open on public.desk_inbox (user_id, status, due);

alter table public.desk_inbox enable row level security;
drop policy if exists "desk_inbox_own" on public.desk_inbox;
create policy "desk_inbox_own" on public.desk_inbox
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- tin mới từ bot hiện ngay trên Desk đang mở
do $$ begin
  alter publication supabase_realtime add table public.desk_inbox;
exception when duplicate_object then null; end $$;

-- file đính kèm (ảnh, voice, tài liệu): bucket riêng tư, mỗi user một thư mục
insert into storage.buckets (id, name, public) values ('desk-inbox','desk-inbox', false)
  on conflict (id) do nothing;
drop policy if exists "desk_inbox_files_read" on storage.objects;
create policy "desk_inbox_files_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'desk-inbox' and (storage.foldername(name))[1] = auth.uid()::text);

-- nhắc buổi sáng 8:05 qua bot (mỗi ngày tối đa 1 tin, chỉ gửi khi có việc)
create extension if not exists pg_net;
create extension if not exists pg_cron;
select cron.unschedule('desk-inbox-digest') where exists (select 1 from cron.job where jobname = 'desk-inbox-digest');
select cron.schedule('desk-inbox-digest', '5 1 * * *',
  $$ select net.http_get('https://pxkwjxmrlucpoehpjbja.supabase.co/functions/v1/desk-bot?digest=1') $$);
