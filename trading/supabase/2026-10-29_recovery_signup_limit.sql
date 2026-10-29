-- DNC Trading OS — 29/10/2026
-- 1) Mã khôi phục: tự đặt lại mật khẩu khi quên (không cần email thật)
-- 2) Giới hạn số tài khoản tạo mới / giờ và / ngày (chống bot spam đăng ký)
-- Chạy 1 lần trong SQL Editor của Supabase. Chạy lại nhiều lần vẫn an toàn.

create extension if not exists pgcrypto with schema extensions;

-- ───────── 1. MÃ KHÔI PHỤC ─────────
-- Bảng kín: bật RLS, không có policy → không ai đọc được qua API, chỉ các hàm bên dưới dùng.
create table if not exists public.recovery_codes (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  code_hash       text not null,
  failed_attempts int  not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.recovery_codes enable row level security;
revoke all on public.recovery_codes from anon, authenticated;

-- Tạo (hoặc thay) mã cho user đang đăng nhập. Trả về mã gốc đúng 1 lần, DB chỉ giữ bản băm.
-- Mã 16 ký tự (bỏ chữ dễ nhầm 0/O/1/I/L), dạng XXXX-XXXX-XXXX-XXXX ≈ 80 bit, không đoán được.
create or replace function public.create_recovery_code() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid   uuid := auth.uid();
  v_abc   text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := gen_random_bytes(16);
  v_raw   text := '';
  i int;
begin
  if v_uid is null then raise exception 'Chưa đăng nhập'; end if;
  for i in 0..15 loop
    v_raw := v_raw || substr(v_abc, (get_byte(v_bytes, i) % length(v_abc)) + 1, 1);
  end loop;
  insert into public.recovery_codes (user_id, code_hash)
  values (v_uid, crypt(v_raw, gen_salt('bf')))
  on conflict (user_id) do update
    set code_hash = excluded.code_hash, failed_attempts = 0, locked_until = null, created_at = now();
  return substr(v_raw,1,4)||'-'||substr(v_raw,5,4)||'-'||substr(v_raw,9,4)||'-'||substr(v_raw,13,4);
end $$;

create or replace function public.has_recovery_code() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.recovery_codes where user_id = auth.uid());
$$;

-- Đặt lại mật khẩu bằng username + mã khôi phục. Gọi được khi chưa đăng nhập.
-- p_new_password là mật khẩu đã qua toAuthPw ('dnc_' + mật khẩu người dùng gõ).
-- Sai 5 lần → khoá 15 phút. Thành công → xoá mã (dùng 1 lần) + đăng xuất mọi thiết bị.
-- Trả về: 'ok' | 'invalid' | 'locked' | 'weak'
create or replace function public.reset_password_with_code(p_username text, p_code text, p_new_password text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid  uuid;
  v_rc   public.recovery_codes%rowtype;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if char_length(coalesce(p_new_password, '')) < 10 then return 'weak'; end if;

  select id into v_uid from public.profiles where lower(username) = lower(trim(coalesce(p_username, ''))) limit 1;
  if v_uid is null then return 'invalid'; end if;

  select * into v_rc from public.recovery_codes where user_id = v_uid for update;
  if not found then return 'invalid'; end if;
  if v_rc.locked_until is not null and v_rc.locked_until > now() then return 'locked'; end if;

  if v_rc.code_hash <> crypt(v_code, v_rc.code_hash) then
    update public.recovery_codes
       set failed_attempts = failed_attempts + 1,
           locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
     where user_id = v_uid;
    return 'invalid';
  end if;

  update auth.users
     set encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
   where id = v_uid;
  delete from auth.sessions where user_id = v_uid;
  delete from public.recovery_codes where user_id = v_uid;
  return 'ok';
end $$;

-- ───────── 2. GIỚI HẠN ĐĂNG KÝ ─────────
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

-- ───────── QUYỀN GỌI HÀM ─────────
revoke all on function public.create_recovery_code()                       from public, anon;
revoke all on function public.has_recovery_code()                          from public, anon;
revoke all on function public.reset_password_with_code(text, text, text)   from public;
revoke all on function public.signup_check(text)                           from public;
revoke all on function public.signup_is_busy()                             from public, anon, authenticated;
revoke all on function public.limit_signups()                              from public, anon, authenticated;
grant execute on function public.create_recovery_code()                     to authenticated;
grant execute on function public.has_recovery_code()                        to authenticated;
grant execute on function public.reset_password_with_code(text, text, text) to anon, authenticated;
grant execute on function public.signup_check(text)                         to anon, authenticated;
