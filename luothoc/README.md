# Lướt Học

Học tiếng Anh từ video Reels / Shorts / TikTok. Dán link → AI làm phụ đề Anh–Việt, chọn cụm theo trình độ từng người → ôn tập giãn cách.

- Giao diện: `index.html` (godnc.com/luothoc/)
- Backend: Supabase project `gointelligence`, bảng `lh_*` (xem `supabase/schema.sql`)
- Edge Function: `luothoc-api` (xem `supabase/functions/luothoc-api/index.ts`)
- Secrets cần có trên Supabase: `GEMINI_API_KEY`, `RAPIDAPI_KEY` (cho TikTok/IG/FB/Threads/X)
