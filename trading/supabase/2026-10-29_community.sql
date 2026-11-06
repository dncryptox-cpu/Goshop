-- DNC Trading OS — Cộng đồng: chia sẻ lệnh, thả tim, bình luận
-- Chạy 1 lần trong SQL Editor của Supabase (sau schema.sql, backtest.sql, backtest_3tf.sql). Chạy lại vẫn an toàn.
-- Chỉ người đã đăng nhập mới xem được. Bài chia sẻ là BẢN CHỤP lệnh: R, R:R, giá, ảnh, ghi chú — KHÔNG có số tiền/vốn/khối lượng.

-- 1. BÀI CHIA SẺ
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author        text not null default '',
  kind          text not null check (kind in ('TRADE', 'BT')),
  trade_id      uuid unique references public.trades(id) on delete cascade,
  bt_trade_id   uuid unique references public.bt_trades(id) on delete cascade,
  pair          text not null default '' check (char_length(pair) <= 40),
  direction     text not null default '' check (direction in ('', 'LONG', 'SHORT')),
  result        text not null default '' check (result in ('', 'RUNNING', 'WIN', 'LOSS', 'BE')),
  r             numeric,
  rr            numeric,
  entry_price   numeric,
  stop_loss     numeric,
  take_profit   numeric,
  setup         text not null default '' check (char_length(setup) <= 80),
  caption       text not null default '' check (char_length(caption) <= 2000),
  img_htf       text not null default '',
  img_mtf       text not null default '',
  img_ltf       text not null default '',
  trade_date    date,
  like_count    int not null default 0,
  comment_count int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check ((kind = 'TRADE' and trade_id is not null) or (kind = 'BT' and bt_trade_id is not null))
);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_user_idx on public.posts (user_id, created_at desc);
alter table public.posts enable row level security;
drop policy if exists "posts read"   on public.posts;
drop policy if exists "posts insert" on public.posts;
drop policy if exists "posts update" on public.posts;
drop policy if exists "posts delete" on public.posts;
create policy "posts read"   on public.posts for select to authenticated using (true);
-- chỉ được chia sẻ lệnh của chính mình
create policy "posts insert" on public.posts for insert to authenticated with check (
  auth.uid() = user_id and (
    (kind = 'TRADE' and exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid())) or
    (kind = 'BT' and exists (select 1 from public.bt_trades b where b.id = bt_trade_id and b.user_id = auth.uid()))
  ));
create policy "posts update" on public.posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "posts delete" on public.posts for delete to authenticated using (auth.uid() = user_id);

-- Tên tác giả lấy từ profiles (không cho tự đặt). Chủ bài không tự sửa được số tim/bình luận/tác giả.
create or replace function public.posts_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.author := coalesce((select username from public.profiles where id = auth.uid()), '');
    new.like_count := 0; new.comment_count := 0;
  elsif coalesce(current_setting('app.counting', true), '') <> '1' then   -- người dùng sửa bài (trigger đếm bật cờ app.counting → bỏ qua)
    new.user_id := old.user_id; new.author := old.author; new.kind := old.kind;
    new.trade_id := old.trade_id; new.bt_trade_id := old.bt_trade_id;
    new.like_count := old.like_count; new.comment_count := old.comment_count;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists posts_guard on public.posts;
create trigger posts_guard before insert or update on public.posts for each row execute function public.posts_guard();

-- 2. THẢ TIM
create table if not exists public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes (user_id);
alter table public.post_likes enable row level security;
drop policy if exists "likes read"   on public.post_likes;
drop policy if exists "likes insert" on public.post_likes;
drop policy if exists "likes delete" on public.post_likes;
create policy "likes read"   on public.post_likes for select to authenticated using (true);
create policy "likes insert" on public.post_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "likes delete" on public.post_likes for delete to authenticated using (auth.uid() = user_id);

-- 3. BÌNH LUẬN
create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author     text not null default '',
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;
drop policy if exists "comments read"   on public.post_comments;
drop policy if exists "comments insert" on public.post_comments;
drop policy if exists "comments delete" on public.post_comments;
create policy "comments read"   on public.post_comments for select to authenticated using (true);
create policy "comments insert" on public.post_comments for insert to authenticated with check (auth.uid() = user_id);
-- tự xoá bình luận của mình; chủ bài xoá được mọi bình luận trong bài của mình
create policy "comments delete" on public.post_comments for delete to authenticated using (
  auth.uid() = user_id or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));

create or replace function public.comments_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.author := coalesce((select username from public.profiles where id = auth.uid()), '');
  return new;
end $$;
drop trigger if exists comments_author on public.post_comments;
create trigger comments_author before insert on public.post_comments for each row execute function public.comments_author();

-- 4. ĐẾM TIM / BÌNH LUẬN (bật cờ app.counting trong lúc cập nhật để posts_guard cho phép đổi số đếm)
create or replace function public.posts_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_post uuid := coalesce(new.post_id, old.post_id); v_col text := case when tg_table_name = 'post_likes' then 'like_count' else 'comment_count' end;
begin
  perform set_config('app.counting', '1', true);
  if v_col = 'like_count' then
    update public.posts set like_count = (select count(*) from public.post_likes where post_id = v_post) where id = v_post;
  else
    update public.posts set comment_count = (select count(*) from public.post_comments where post_id = v_post) where id = v_post;
  end if;
  perform set_config('app.counting', '', true);
  return null;
end $$;
drop trigger if exists post_likes_count on public.post_likes;
create trigger post_likes_count after insert or delete on public.post_likes for each row execute function public.posts_count();
drop trigger if exists post_comments_count on public.post_comments;
create trigger post_comments_count after insert or delete on public.post_comments for each row execute function public.posts_count();

revoke all on public.posts, public.post_likes, public.post_comments from anon;
