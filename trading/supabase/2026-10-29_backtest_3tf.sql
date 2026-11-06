-- DNC Trading OS — Backtest: 3 ảnh mỗi lệnh (HTF / MTF / LTF)
-- Chạy sau 2026-10-29_backtest.sql. Chạy lại nhiều lần vẫn an toàn. Không mất dữ liệu cũ:
-- ảnh đang có (cột img) được giữ nguyên và tính là ảnh LTF (khung vào lệnh).

alter table public.bt_trades add column if not exists img_htf text not null default '';
alter table public.bt_trades add column if not exists img_mtf text not null default '';
alter table public.bt_trades alter column img set default '';

-- Trước: bắt buộc cột img. Giờ: bắt buộc có ít nhất 1 trong 3 ảnh.
alter table public.bt_trades drop constraint if exists bt_trades_img_check;
alter table public.bt_trades drop constraint if exists bt_trades_has_img;
alter table public.bt_trades add constraint bt_trades_has_img check (img <> '' or img_mtf <> '' or img_htf <> '');
