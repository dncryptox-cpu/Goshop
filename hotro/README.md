# Hỗ trợ khách (godnc.com/hotro) + Ticketbox (godnc.com/ticketbox)

- `hotro/index.html` — khách chat. Bot (Gemini) tự trả lời câu dễ, tra trạng thái fam qua API renew (giống fixytb), báo lỗi / yêu cầu mời lại. Giá, gia hạn, thanh toán, hoàn tiền, khiếu nại, hoặc bot không chắc → chuyển người + báo Telegram.
- `ticketbox/index.html` — admin (đăng nhập tài khoản admin Trading OS). Realtime, trả lời khách, Để bot lo tiếp / Đóng / Xoá (có hoàn tác), sửa Kiến thức bot.
- Dữ liệu: Supabase project của Trading OS (`pxkwjxmrlucpoehpjbja`), bảng `support_tickets`, `support_messages`, kiến thức bot ở `site_settings.support_kb`.

## Bật lần đầu

1. SQL Editor → chạy `hotro/supabase/schema.sql` (chạy lại vẫn an toàn).
2. Edge Functions → tạo function **support-bot**, dán `hotro/supabase/functions/support-bot/index.ts`, **tắt "Verify JWT"** (khách không đăng nhập).
3. Edge Functions → Secrets (DNL tự nhập):
   - `GEMINI_API_KEY` (bắt buộc)
   - `TG_BOT_TOKEN`, `TG_CHAT_ID` (tuỳ chọn — báo Telegram khi có khách cần người)
4. Mở godnc.com/hotro, chat thử 1 email thật; mở godnc.com/ticketbox xem ticket hiện ra.

## Luật bot (trong code, không sửa ở Kiến thức bot)
Luôn tra email trước khi nói về tình trạng · không báo giá / nhận tiền / hứa hoàn tiền / hứa giờ · chỉ tra email của phiên chat · che email chủ nhóm · AI lỗi thì tự chuyển người.
Giới hạn: 40 tin/giờ mỗi phiên, 6 phiên mới/ngày mỗi email, 1000 ký tự/tin.
