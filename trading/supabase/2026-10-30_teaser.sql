-- DNC Trading OS — Hộp khoá "dành cho hội viên" (tạo tò mò)
-- Chạy 1 lần trong SQL Editor của Supabase (sau 2026-10-30_members.sql). Chạy lại vẫn an toàn.
-- Trả về PHẦN VỎ (tiêu đề, mục, tác giả, ngày) của bài / tài nguyên người xem chưa được đọc,
-- để app hiện thành hộp khoá. Không trả nội dung, link, mô tả, giá vào lệnh.

create or replace function public.posts_teaser()
returns table (id uuid, kind text, visibility text, title text, pair text, direction text, cover text, author text, created_at timestamptz)
language sql security definer stable set search_path = public as $$
  select p.id, p.kind, p.visibility, p.title, p.pair, p.direction, p.cover, p.author, p.created_at
  from public.posts p
  where (p.visibility = 'vip' and not public.is_member() and p.user_id is distinct from auth.uid())
     or (p.visibility = 'members' and auth.uid() is null)
  order by p.created_at desc
  limit 40;
$$;
revoke all on function public.posts_teaser() from public;
grant execute on function public.posts_teaser() to anon, authenticated;

create or replace function public.resources_teaser()
returns table (id uuid, category text, title text, sort int, created_at timestamptz)
language sql security definer stable set search_path = public as $$
  select r.id, r.category, r.title, r.sort, r.created_at
  from public.resources r
  where r.vip and not public.is_member()
  order by r.category, r.sort, r.created_at desc;
$$;
revoke all on function public.resources_teaser() from public;
grant execute on function public.resources_teaser() to anon, authenticated;
