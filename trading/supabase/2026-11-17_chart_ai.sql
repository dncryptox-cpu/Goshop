-- DNC Trading OS — Kho chart AI: tìm lệnh cũ giống chart đang định vào
-- Chạy 1 lần trong SQL Editor của Supabase (sau schema.sql, 2026-10-29_backtest*.sql). Chạy lại nhiều lần vẫn an toàn.
--
-- Mỗi lệnh (nhật ký, backtest), chart nhận định 90 ngày hoặc chart mẫu trong Tài nguyên = 1 dòng:
--   features  = AI (Gemini) đọc chart: setup, cấu trúc, xu hướng... (chỉ bối cảnh lúc vào lệnh, không kết quả)
--   embedding = vector của phần mô tả đó → so độ giống bằng pgvector
--   sig       = chữ ký bộ ảnh; ảnh đổi thì đọc lại, chỉ đổi note/kết quả thì chỉ cập nhật thông tin (không tốn AI)

create extension if not exists vector with schema extensions;

create table if not exists public.chart_ai (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  src        text not null,
  src_id     text not null,
  sig        text not null default '',
  label      text not null default '',          -- 'Lệnh thật' / tên bộ backtest / '90 ngày'
  img        text not null default '',          -- ảnh đại diện (ưu tiên khung vào lệnh)
  pair       text not null default '',
  direction  text not null default '',
  result     text not null default '',          -- WIN / LOSS / BE / RUNNING / ''
  r          numeric not null default 0,
  note       text not null default '',
  at         date,
  features   jsonb not null default '{}'::jsonb,
  embedding  extensions.vector(768),
  model      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, src, src_id)
);
-- Nguồn: trade = nhật ký, bt = backtest, t90 = nhận định 90 ngày, res = chart mẫu trong Tài nguyên
alter table public.chart_ai drop constraint if exists chart_ai_src_check;
alter table public.chart_ai add constraint chart_ai_src_check check (src in ('trade','bt','t90','res'));
alter table public.chart_ai enable row level security;
drop policy if exists "own chart ai" on public.chart_ai;
create policy "own chart ai" on public.chart_ai for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists chart_ai_touch on public.chart_ai;
create trigger chart_ai_touch before update on public.chart_ai for each row execute function public.touch_updated_at();

-- Tìm k chart giống nhất của chính mình (RLS vẫn áp dụng: security invoker)
-- dir = '' → mọi hướng; 'LONG'/'SHORT' → cùng hướng (chart nhận định chưa có hướng vẫn được tính)
create or replace function public.match_charts(q extensions.vector(768), k int default 6, dir text default '')
returns table (id uuid, src text, src_id text, label text, img text, pair text, direction text,
               result text, r numeric, note text, at date, features jsonb, similarity float)
language sql stable security invoker set search_path = public, extensions as $$
  select c.id, c.src, c.src_id, c.label, c.img, c.pair, c.direction, c.result, c.r, c.note, c.at, c.features,
         1 - (c.embedding <=> q) as similarity
  from public.chart_ai c
  where c.user_id = auth.uid() and c.embedding is not null
    and (dir = '' or c.direction = dir or c.direction = '')
  order by c.embedding <=> q
  limit greatest(1, least(k, 20));
$$;
grant execute on function public.match_charts(extensions.vector, int, text) to authenticated;
