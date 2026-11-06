-- Luồng chat cố định: lưu kết quả tra cứu + trạng thái bot đang trả lời. Chạy lại vẫn an toàn.
alter table public.support_tickets add column if not exists kh       jsonb;        -- kết quả tra cứu gần nhất (trạng thái fam, hạn, CTV)
alter table public.support_tickets add column if not exists kh_at    timestamptz;
alter table public.support_tickets add column if not exists verified text;         -- ok | not_found (email có trong danh sách khách không)
alter table public.support_tickets add column if not exists busy_at  timestamptz;  -- bot đang xử lý tin (null = rảnh)
