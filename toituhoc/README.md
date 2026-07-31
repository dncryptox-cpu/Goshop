# 📚 Hướng Dẫn Triển Khai WebApp "Tôi Tự Học" (Kiến Trúc Mới)

Ứng dụng **"Tôi Tự Học"** với hệ thống Đăng ký / Đăng nhập riêng (Mật khẩu hash SHA-256), Quản lý Session Token, và Mỗi người dùng tự nhập Gemini API Key cá nhân.

---

## 🛠️ Hướng Dẫn Dành Cho Admin (Thiết Lập Google Apps Script)

### Bước 1: Tạo Google Sheet Sở Hữu Bởi Admin
1. Truy cập [Google Drive](https://drive.google.com) và tạo một **Google Sheet** mới.
2. Đặt tên Sheet là `Tôi Tự Học - Private Database`.
*(Lưu ý: Bạn sở hữu Sheet này và KHÔNG cho phép public hay clone. Apps Script sẽ tự động tạo 3 Tab: `users`, `vocab`, và `review_log` khi chạy).*

---

### Bước 2: Dán Mã Nguồn Google Apps Script
1. Trên thanh menu của Google Sheet, chọn **Tiện ích mở rộng** ➔ **Apps Script** (*Extensions ➔ Apps Script*).
2. Xóa sạch toàn bộ code mặc định trong file `Code.gs`.
3. Mở file [google-apps-script.gs](file:///Users/dncnguyen/Antigravity/DNC%20Operator/toituhoc/google-apps-script.gs), copy toàn bộ mã nguồn và dán vào Apps Script Editor.

---

### Bước 3: Deploy Web App
1. Nhấp vào nút **Deploy** (Triển khai) ➔ chọn **New deployment** (Triển khai mới).
2. Click biểu tượng bánh răng ⚙️ ➔ Chọn **Web app**.
3. Cấu hình:
   - **Execute as** (*Thực thi dưới dạng*): **Me** (*Tôi*)
   - **Who has access** (*Ai có quyền truy cập*): **Anyone** (*Bất kỳ ai*)
4. Bấm **Deploy**, cấp quyền (Authorize access) bằng tài khoản Google của Admin.
5. Sao chép đoạn **Web App URL** thu được (dạng `https://script.google.com/macros/s/AKfycb.../exec`).

---

## 👤 Hướng Dẫn Dành Cho Người Dùng (User)
1. Truy cập WebApp tại `https://godnc.com/toituhoc`.
2. Dán **Web App URL** ở Bước 3 vào phần Cấu hình Backend trên trang chủ (hoặc Admin cấu hình sẵn).
3. Chọn tab **Đăng Ký Mới**:
   - Nhập **Email** và **Mật Khẩu** của bạn.
   - Nhập **Gemini API Key cá nhân** của bạn (Lấy miễn phí tại [Google AI Studio](https://aistudio.google.com/app/apikey)).
4. Bấm **Tạo Tài Khoản** và bắt đầu chụp ảnh học từ vựng!
