# Rage

Học tiếng Anh từ video Reels / Shorts / TikTok. Dán link → AI làm phụ đề Anh–Việt, chọn cụm theo trình độ từng người → ôn tập giãn cách.

- Giao diện: `index.html` (godnc.com/rage/)
- Backend: Supabase project `gointelligence`, bảng `rage_*` (xem `supabase/schema.sql`)
- Edge Function: `rage-api` (xem `supabase/functions/rage-api/index.ts`)
- Secrets cần có trên Supabase: `GEMINI_API_KEY`, `RAPIDAPI_KEY` (cho TikTok/IG/FB/Threads/X)
