# 📚 Hướng Dẫn Cài Đặt và Triển Khai WebApp "Tôi Tự Học"

Ứng dụng **"Tôi Tự Học"** học tiếng Anh hằng ngày qua ảnh chụp thực tế bằng Gemini AI và thuật toán Spaced Repetition (SM-2).

---

## 🛠️ Hướng Dẫn Thiết Lập Google Apps Script Backend (Serverless)

### Bước 1: Tạo Google Sheet Mới
1. Truy cập [Google Drive](https://drive.google.com) và tạo một **Google Sheet** mới.
2. Đổi tên Sheet thành `Tôi Tự Học - Database`.
*(Hệ thống sẽ tự động tạo 2 Tab là `vocab` và `review_log` kèm theo đúng tiêu đề các cột khi chạy).*

---

### Bước 2: Dán Code Google Apps Script
1. Trên thanh menu của Google Sheet, chọn **Tiện ích mở rộng** ➔ **Apps Script** (*Extensions ➔ Apps Script*).
2. Xóa sạch toàn bộ code mặc định trong file `Code.gs`.
3. Mở file [google-apps-script.gs](file:///Users/dncnguyen/Antigravity/DNC%20Operator/toituhoc/google-apps-script.gs) trong thư mục dự án này, sao chép toàn bộ mã nguồn và dán vào Apps Script Editor.

---

### Bước 3: Cấu Hình Gemini API Key
1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey) để lấy một API Key Gemini miễn phí.
2. Trong giao diện Apps Script Editor:
   - Nhấp vào biểu tượng ⚙️ **Project Settings** (Cài đặt dự án) ở góc dưới menu bên trái.
   - Cuộn xuống phần **Script Properties** (Các thuộc tính của kịch bản).
   - Nhấp vào **Add script property** (Thêm thuộc tính kịch bản):
     - **Property**: `GEMINI_API_KEY`
     - **Value**: *(Dán Gemini API Key của bạn vào đây)*
   - Bấm **Save script properties**.

---

### Bước 4: Deploy Web App
1. Nhấp vào nút **Deploy** (Triển khai) góc trên bên phải ➔ chọn **New deployment** (Triển khai mới).
2. Click biểu tượng bánh răng ⚙️ bên cạnh "Select type" ➔ Chọn **Web app**.
3. Điền thông tin cấu hình:
   - **Description**: `Backend API v1`
   - **Execute as** (*Thực thi dưới dạng*): **Me** (*Tôi*)
   - **Who has access** (*Ai có quyền truy cập*): **Anyone** (*Bất kỳ ai*)
4. Bấm **Deploy**.
5. Nhấp nút **Authorize access** (Cấp quyền truy cập) và đăng nhập tài khoản Google của bạn (nếu có cảnh báo bảo mật, chọn *Advanced ➔ Go to Untrusted project* để tiếp tục).
6. Sao chép đoạn **Web App URL** (có dạng `https://script.google.com/macros/s/AKfycb.../exec`).

---

### Bước 5: Cấu Hình URL ở Frontend
1. Mở trang web `https://godnc.com/toituhoc` trên trình duyệt.
2. Nhập Email Google của bạn để bắt đầu.
3. Tại phần **⚙️ Google Apps Script Web App URL Backend** ở Trang chủ (Dashboard), dán đoạn URL bạn vừa sao chép ở Bước 4 vào và chọn **Lưu Cấu Hình Backend**.

---

## 🎯 Luồng Nghiệp Vụ Sử Dụng
1. **Chụp / Upload Ảnh**: Chọn ảnh biển hiệu, sách, menu... chứa tiếng Anh.
2. **AI Phân Tích**: Gemini Vision sẽ đọc ảnh, trích ra 3-8 từ vựng/cụm từ hay nhất kèm nghĩa tiếng Việt, câu ví dụ và lưu link ảnh lên Google Drive.
3. **Ôn Tập Flashcards**:
   - Thẻ hiển thị các từ đến ngày ôn (`next_review_date <= hôm nay`).
   - Chạm vào thẻ để lật xem nghĩa và nghe phát âm bằng **Web Speech API**.
   - Đánh giá từ theo 4 mức độ: `Quên` (1 ngày), `Khó` (+2 ngày), `Bình thường` (+6 ngày), `Dễ` (+8 ngày) để thuật toán **SM-2** tự động cập nhật lịch ôn bài tiếp theo.
