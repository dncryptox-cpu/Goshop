// Cấu hình GO INTELLIGENCE. Chỉ chứa khoá CÔNG KHAI (publishable) của Supabase — an toàn để lộ trên web vì dữ liệu được RLS bảo vệ.
// TUYỆT ĐỐI không dán secret key / service_role key vào đây.
window.GI_CONFIG = {
  SUPABASE_URL: 'https://zmhvuudpqwvnbwzcegap.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_2rYunBCifMDQalBLzw3_Tg_uz-WCXVL',
  SUPPORT_URL: '',            // link Zalo/Messenger hỗ trợ, vd 'https://zalo.me/09xxxxxxxx'
  BRAND: 'GO INTELLIGENCE',
  // API trang renew (Apps Script) — dùng cho tab "Gói": thông tin gói YouTube + lịch sử fix theo email khách
  RENEW_API: 'https://script.google.com/macros/s/AKfycbwWQkopYjL131FKXIN1A_UU5VykUaj8YRL_rP0ZVVmqeqYo_hVyi7JdpmcCIX1eJzd1/exec'
};
