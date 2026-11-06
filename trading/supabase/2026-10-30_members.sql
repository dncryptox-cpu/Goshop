-- DNC Trading OS — Hội viên + Tài nguyên
-- Chạy 1 lần trong SQL Editor của Supabase (sau 2026-10-30_profile_fix.sql). Chạy lại vẫn an toàn.
--   • profiles.is_member: hội viên (trọn đời). Chỉ admin (Dnc) bật/tắt được, qua hàm admin_set_member.
--   • Bài có thêm chế độ 'vip' = chỉ hội viên đọc. Chỉ admin đăng được bài 'vip'.
--   • Bảng resources: tài nguyên Dnc đăng (link + mô tả, theo mục). Mục có vip = true chỉ hội viên thấy.

-- 1. HỘI VIÊN
alter table public.profiles add column if not exists is_member boolean not null default false;
alter table public.profiles add column if not exists member_since timestamptz;

-- Người dùng không tự bật admin / hội viên. Hàm của admin (security definer) vẫn đổi được.
create or replace function public.lock_admin_flag() returns trigger language plpgsql as $$
begin
  if (new.is_admin is distinct from old.is_admin or new.is_member is distinct from old.is_member)
     and auth.uid() is not null and coalesce(current_setting('app.admin_op', true), '') <> '1' then
    raise exception 'Không được đổi quyền admin / hội viên';
  end if;
  return new;
end $$;
drop trigger if exists profiles_lock_admin on public.profiles;
create trigger profiles_lock_admin before update on public.profiles for each row execute function public.lock_admin_flag();

create or replace function public.is_member() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select is_member or is_admin from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.is_member() from public;
grant execute on function public.is_member() to anon, authenticated;

-- Admin xem danh sách người dùng
create or replace function public.admin_list_users()
returns table (id uuid, username text, is_member boolean, is_admin boolean, member_since timestamptz, created_at timestamptz, trades bigint, posts bigint)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Chỉ admin'; end if;
  return query
    select p.id, p.username, p.is_member, p.is_admin, p.member_since, u.created_at,
           (select count(*) from public.trades t where t.user_id = p.id),
           (select count(*) from public.posts  x where x.user_id = p.id)
    from public.profiles p join auth.users u on u.id = p.id
    order by u.created_at desc;
end $$;
revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

-- Admin cấp / thu hồi hội viên
create or replace function public.admin_set_member(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Chỉ admin'; end if;
  perform set_config('app.admin_op', '1', true);
  update public.profiles set is_member = p_on, member_since = case when p_on then coalesce(member_since, now()) else null end
  where id = p_user;
  perform set_config('app.admin_op', '', true);
end $$;
revoke all on function public.admin_set_member(uuid, boolean) from public;
grant execute on function public.admin_set_member(uuid, boolean) to authenticated;

-- 2. BÀI 'vip' (chỉ hội viên)
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check check (visibility in ('public', 'members', 'vip'));

drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select to authenticated using (
  visibility <> 'vip' or user_id = auth.uid() or public.is_member());

-- chỉ admin đăng / đổi sang 'vip'
create or replace function public.posts_vip_guard() returns trigger language plpgsql as $$
begin
  if new.visibility = 'vip' and (tg_op = 'INSERT' or old.visibility is distinct from 'vip') and not public.is_admin() then
    raise exception 'Chỉ admin đăng bài cho hội viên';
  end if;
  return new;
end $$;
drop trigger if exists posts_vip_guard on public.posts;
create trigger posts_vip_guard before insert or update on public.posts for each row execute function public.posts_vip_guard();

-- bình luận của bài 'vip' cũng chỉ hội viên đọc
drop policy if exists "comments read" on public.post_comments;
create policy "comments read" on public.post_comments for select to authenticated using (
  exists (select 1 from public.posts p where p.id = post_id));

-- 3. TÀI NGUYÊN
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'Khác' check (char_length(category) between 1 and 40),
  title       text not null check (char_length(title) between 1 and 120),
  url         text not null default '' check (char_length(url) <= 500),
  description text not null default '' check (char_length(description) <= 600),
  vip         boolean not null default false,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists resources_sort_idx on public.resources (category, sort, created_at desc);
alter table public.resources enable row level security;
grant select on public.resources to anon, authenticated;
grant insert, update, delete on public.resources to authenticated;
drop policy if exists "resources read"  on public.resources;
drop policy if exists "resources admin" on public.resources;
create policy "resources read"  on public.resources for select to anon, authenticated using (not vip or public.is_member());
create policy "resources admin" on public.resources for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Đếm tài nguyên đang khoá (để báo người chưa là hội viên)
create or replace function public.resources_locked() returns int
language sql security definer stable set search_path = public as $$
  select case when public.is_member() then 0 else (select count(*)::int from public.resources where vip) end;
$$;
grant execute on function public.resources_locked() to anon, authenticated;

-- 4. Admin cũng là hội viên
update public.profiles set is_member = true, member_since = coalesce(member_since, now()) where is_admin;
select username, is_admin, is_member from public.profiles where is_admin or is_member;
