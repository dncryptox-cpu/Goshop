-- DNC Trading OS — 29/10/2026
-- Đăng ký bằng email thật (quên mật khẩu → link qua email) + giới hạn tài khoản mới chống bot.
-- Chạy 1 lần trong SQL Editor của Supabase. Chạy lại nhiều lần vẫn an toàn.

-- ───────── 1. GIỚI HẠN ĐĂNG KÝ ─────────
-- Đổi 2 con số này nếu cần: tối đa 20 tài khoản mới / giờ, 100 / ngày (toàn hệ thống).
create or replace function public.signup_is_busy() returns boolean
language sql security definer stable set search_path = public as $$
  select (select count(*) from auth.users where created_at > now() - interval '1 hour') >= 20
      or (select count(*) from auth.users where created_at > now() - interval '1 day')  >= 100;
$$;

-- Trang gọi trước khi đăng ký để báo lỗi rõ ràng: 'ok' | 'taken' | 'busy'
create or replace function public.signup_check(p_username text) returns text
language sql security definer stable set search_path = public as $$
  select case
    when exists (select 1 from public.profiles where lower(username) = lower(trim(coalesce(p_username, '')))) then 'taken'
    when public.signup_is_busy() then 'busy'
    else 'ok' end;
$$;

-- Chốt chặn thật ở DB (bot gọi thẳng API đăng ký cũng bị chặn)
create or replace function public.limit_signups() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.signup_is_busy() then
    raise exception 'Đăng ký đang tạm khoá do quá nhiều tài khoản mới';
  end if;
  return new;
end $$;
drop trigger if exists limit_signups on auth.users;
create trigger limit_signups before insert on auth.users
  for each row execute function public.limit_signups();

-- ───────── 2. GỢI Ý ĐĂNG NHẬP ─────────
-- Tài khoản cũ đăng nhập bằng username. Sau khi gắn email thật, họ đăng nhập bằng email.
-- Khi gõ username mà sai, trang hỏi hàm này để nhắc "hãy đăng nhập bằng email".
-- Chỉ trả về loại tài khoản, không bao giờ trả email: 'username' | 'email' | 'none'
create or replace function public.login_hint(p_username text) returns text
language sql security definer stable set search_path = public as $$
  select coalesce((
    select case when u.email like '%@users.dnctrading.xyz' then 'username' else 'email' end
      from public.profiles p join auth.users u on u.id = p.id
     where lower(p.username) = lower(trim(coalesce(p_username, '')))
     limit 1), 'none');
$$;

-- ───────── QUYỀN GỌI HÀM ─────────
revoke all on function public.signup_is_busy()       from public, anon, authenticated;
revoke all on function public.limit_signups()        from public, anon, authenticated;
revoke all on function public.signup_check(text)     from public;
revoke all on function public.login_hint(text)       from public;
grant execute on function public.signup_check(text)  to anon, authenticated;
grant execute on function public.login_hint(text)    to anon, authenticated;
