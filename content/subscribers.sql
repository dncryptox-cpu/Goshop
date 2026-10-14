-- Chạy 1 lần trong Supabase → SQL Editor (project pxkwjxmrlucpoehpjbja).
-- Bảng nhận email đăng ký từ godnc.com. Khách chỉ được INSERT, không đọc được danh sách.
create table if not exists public.subscribers (
  id bigint generated always as identity primary key,
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source text,
  created_at timestamptz not null default now()
);
alter table public.subscribers enable row level security;
drop policy if exists "anon_insert_subscribers" on public.subscribers;
create policy "anon_insert_subscribers" on public.subscribers
  for insert to anon, authenticated with check (true);
-- Xem danh sách: Table Editor → subscribers (dùng tài khoản admin, không qua web).
