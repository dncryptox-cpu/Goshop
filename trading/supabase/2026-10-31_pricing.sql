-- DNC Trading OS — Giá hội viên + khuyến mãi (admin tự chỉnh trong app)
-- Chạy 1 lần trong SQL Editor của Supabase. Chạy lại vẫn an toàn.

create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
drop policy if exists "settings read"  on public.site_settings;
drop policy if exists "settings admin" on public.site_settings;
-- ai cũng đọc được giá (trang Hội viên công khai); chỉ admin sửa
create policy "settings read"  on public.site_settings for select to anon, authenticated using (key in ('membership'));
create policy "settings admin" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Giá mặc định: giá gốc $200, đang miễn phí, chưa có khuyến mãi
insert into public.site_settings (key, value) values ('membership', jsonb_build_object(
  'currency', 'USD', 'list_price', 200, 'price', 0,
  'promo_on', false, 'promo_price', 0, 'promo_label', '', 'promo_start', null, 'promo_end', null))
on conflict (key) do nothing;
