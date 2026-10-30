-- DNC Trading OS — tự tạo hồ sơ (profiles) cho tài khoản bị thiếu
-- (vd tài khoản tạo thẳng trong Supabase dashboard). Chạy lại vẫn an toàn.

-- 1. Tạo hồ sơ cho mọi tài khoản đang thiếu
insert into public.profiles (id, username)
select id, coalesce(raw_user_meta_data->>'username', split_part(email, '@', 1))
from auth.users
on conflict do nothing;

-- 2. App gọi hàm này khi đăng nhập mà không thấy hồ sơ → tự tạo
create or replace function public.ensure_my_profile() returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_name text;
begin
  if v_uid is null then raise exception 'Chưa đăng nhập'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then return; end if;
  select coalesce(raw_user_meta_data->>'username', split_part(email, '@', 1)) into v_name from auth.users where id = v_uid;
  if exists (select 1 from public.profiles where lower(username) = lower(v_name)) then
    v_name := v_name || '_' || substr(replace(v_uid::text, '-', ''), 1, 4);   -- trùng tên → thêm đuôi
  end if;
  insert into public.profiles (id, username) values (v_uid, v_name) on conflict (id) do nothing;
end $$;
revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;

select username, is_admin from public.profiles order by created_at;
