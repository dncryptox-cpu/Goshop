-- DNC Trading OS — Tài nguyên thành trang bài viết (giới thiệu + danh sách mục, mỗi mục có link, ngày cập nhật, mô tả, chi tiết)
-- Chạy 1 lần trong SQL Editor của Supabase. Chạy lại vẫn an toàn.

alter table public.resources add column if not exists body       text        not null default '';
alter table public.resources add column if not exists items      jsonb       not null default '[]'::jsonb;
alter table public.resources add column if not exists updated_at timestamptz not null default now();

alter table public.resources drop constraint if exists resources_body_len;
alter table public.resources add constraint resources_body_len check (char_length(body) <= 40000 and jsonb_typeof(items) = 'array');
