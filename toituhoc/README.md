# 📚 Hướng Dẫn Triển Khai WebApp "Tôi Tự Học"

Ứng dụng **"Tôi Tự Học"** tích hợp Chụp Ảnh OCR, Ghi Chú Học Tiếng Anh qua AI Gemini 3.6 Flash, tự động lưu 100% dữ liệu vào Google Sheet và Ôn Tập Spaced Repetition (SM-2).

---

## 🛠️ Hướng Dẫn Dành Cho Admin (Thiết Lập Google Sheet & Apps Script)

### Bước 1: Mở Google Sheet Sở Hữu Bởi Admin
1. Mở **Google Sheet**: [`https://docs.google.com/spreadsheets/d/1jIj2Zs_JKbnb2pJPFgXvoqlQ0jQk6HaR1Kp58IkGK1w/edit`](https://docs.google.com/spreadsheets/d/1jIj2Zs_JKbnb2pJPFgXvoqlQ0jQk6HaR1Kp58IkGK1w/edit).
2. Mã script đã tự động trỏ ID: `1jIj2Zs_JKbnb2pJPFgXvoqlQ0jQk6HaR1Kp58IkGK1w`.

---

### Bước 2: Cập Nhật Code & Khởi Tạo Database 4 Tab
1. Mở **Tiện ích mở rộng** ➔ **Apps Script** (*Extensions ➔ Apps Script*).
2. Copy mã mới nhất từ [google-apps-script.gs](file:///Users/dncnguyen/Antigravity/DNC%20Operator/toituhoc/google-apps-script.gs) dán đè vào `Code.gs` và bấm **Save (Ctrl + S)**.
3. Tại thanh công cụ trên cùng của Apps Script Editor, nhấp vào danh sách chọn hàm ➔ Chọn hàm **`setupDatabase`** ➔ Bấm **▶️ Chạy (Run)**.
   *(Apps Script sẽ tự động tạo đủ 4 Tab: `users`, `vocab`, `review_log`, và `notes`)*.

---

### Bước 3: Deploy Version Mới
1. Nhấp vào nút **Deploy (Triển khai)** ➔ chọn **Manage deployments (Quản lý các bản triển khai)**.
2. Bấm nút **Cái bút ✏️ (Chỉnh sửa)** ➔ Chọn **Version: New version (Phiên bản mới)** ➔ Bấm **Deploy**.

---

## 📝 Cấu Trúc Các Tab Trên Google Sheet
1. **Tab `users`**: `id` | `email` | `password_hash` | `api_key_gemini` | `ngày_đăng_ký` | `role` | `current_token`
2. **Tab `vocab`**: `id` | `user_email` | `ngày_thêm` | `link_ảnh` | `từ/cụm` | `loại_từ` | `nghĩa` | `câu_ví_dụ` | `ghi_chú_ngữ_pháp` | `ease_factor` | `interval` | `next_review_date`
3. **Tab `review_log`**: `id` | `user_email` | `vocab_id` | `ngày_ôn` | `kết_quả`
4. **Tab `notes` (Mới)**: `id` | `user_email` | `ngày` | `nội_dung_tiếng_việt` | `bản_dịch_tiếng_anh` | `giải_thích_cách_dùng` | `cách_nói_khác` | `từ_vựng_liên_quan`
