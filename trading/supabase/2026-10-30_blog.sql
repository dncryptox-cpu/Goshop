-- DNC Trading OS — Blog công khai (kiểu LVN)
-- Chạy 1 lần trong SQL Editor của Supabase (sau 2026-10-29_community.sql). Chạy lại vẫn an toàn.
--   • Bài có 2 chế độ: 'public' (ai cũng xem, không cần đăng nhập) / 'members' (chỉ người có tài khoản)
--   • Bài viết dài (kind = 'ARTICLE'): chỉ admin được viết
--   • Khách chưa đăng nhập: xem bài công khai + bình luận của bài đó; không thả tim / bình luận được
-- CUỐI FILE: đổi 'dnc' thành username của bạn để cấp quyền admin.

-- 1. ADMIN: cột is_admin, người dùng không tự bật được
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.lock_admin_flag() returns trigger language plpgsql as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.uid() is not null then
    raise exception 'Không được đổi quyền admin';
  end if;
  return new;
end $$;
drop trigger if exists profiles_lock_admin on public.profiles;
create trigger profiles_lock_admin before update on public.profiles for each row execute function public.lock_admin_flag();

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 2. BÀI: chế độ hiển thị + bài viết dài
alter table public.posts add column if not exists visibility text not null default 'members';
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check check (visibility in ('public', 'members'));
alter table public.posts add column if not exists title text not null default '';
alter table public.posts add column if not exists body  text not null default '';
alter table public.posts add column if not exists cover text not null default '';
alter table public.posts drop constraint if exists posts_title_len;
alter table public.posts add constraint posts_title_len check (char_length(title) <= 160 and char_length(body) <= 40000);

-- kind: thêm ARTICLE (không gắn với lệnh nào)
alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts add constraint posts_kind_check check (kind in ('TRADE', 'BT', 'ARTICLE'));
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.posts'::regclass and contype = 'c'
           and pg_get_constraintdef(oid) like '%trade_id IS NOT NULL%' loop
    execute format('alter table public.posts drop constraint %I', c);
  end loop;
end $$;
alter table public.posts add constraint posts_kind_ref check (
  (kind = 'TRADE' and trade_id is not null) or (kind = 'BT' and bt_trade_id is not null) or
  (kind = 'ARTICLE' and trade_id is null and bt_trade_id is null and title <> ''));
create index if not exists posts_public_idx on public.posts (created_at desc) where visibility = 'public';

-- 3. QUYỀN ĐỌC / GHI
grant select on public.posts, public.post_comments to anon;
drop policy if exists "posts read"   on public.posts;
drop policy if exists "posts public" on public.posts;
drop policy if exists "posts insert" on public.posts;
create policy "posts read"   on public.posts for select to authenticated using (true);
create policy "posts public" on public.posts for select to anon using (visibility = 'public');
create policy "posts insert" on public.posts for insert to authenticated with check (
  auth.uid() = user_id and (
    (kind = 'TRADE'   and exists (select 1 from public.trades t    where t.id = trade_id    and t.user_id = auth.uid())) or
    (kind = 'BT'      and exists (select 1 from public.bt_trades b where b.id = bt_trade_id and b.user_id = auth.uid())) or
    (kind = 'ARTICLE' and public.is_admin())
  ));

drop policy if exists "comments public" on public.post_comments;
create policy "comments public" on public.post_comments for select to anon using (
  exists (select 1 from public.posts p where p.id = post_id and p.visibility = 'public'));

-- Admin gỡ được mọi bài / bình luận (dọn spam)
drop policy if exists "posts admin delete"    on public.posts;
drop policy if exists "comments admin delete" on public.post_comments;
create policy "posts admin delete"    on public.posts         for delete to authenticated using (public.is_admin());
create policy "comments admin delete" on public.post_comments for delete to authenticated using (public.is_admin());

-- 4. CẤP QUYỀN ADMIN — đổi 'dnc' thành username đăng nhập Trading OS của bạn
update public.profiles set is_admin = true where lower(username) = lower('dnc');
select username, is_admin from public.profiles where is_admin;
