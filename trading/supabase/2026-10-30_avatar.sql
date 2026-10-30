-- DNC Trading OS — Ảnh đại diện (avatar)
-- Chạy 1 lần trong SQL Editor của Supabase. Chạy lại vẫn an toàn.
-- Ảnh lưu ở bucket trade-images, thư mục của chính người dùng ({user_id}/avatar_...).
-- avatar_url chỉ nhận link ảnh trong thư mục của chính tài khoản đó (không nhận link ngoài).

alter table public.profiles add column if not exists avatar_url text not null default '';
alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check check (
  avatar_url = '' or (char_length(avatar_url) <= 500
    and position('/storage/v1/object/public/trade-images/' || id::text || '/' in avatar_url) > 0));

-- Lấy avatar của nhiều người (bảng tin, bình luận) — chỉ trả id + link ảnh
create or replace function public.avatars_of(p_ids uuid[])
returns table (id uuid, avatar_url text)
language sql security definer stable set search_path = public as $$
  select p.id, p.avatar_url from public.profiles p where p.id = any(p_ids) and p.avatar_url <> '';
$$;
revoke all on function public.avatars_of(uuid[]) from public;
grant execute on function public.avatars_of(uuid[]) to anon, authenticated;
