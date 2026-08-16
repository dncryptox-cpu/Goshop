# Hướng Dẫn Sử Dụng & Triển Khai — Hệ Thống Báo Lỗi Fam (godnc.com/renew)

## 📌 Tổng Quan
Hệ thống **Fam Issue Tracker** giúp quản lý và tự động hóa toàn bộ quy trình báo lỗi tài khoản subscription theo nhóm ("Fam" — ví dụ RN1, RN2...).

Hệ thống hoạt động độc lập tại đường dẫn: `http://godnc.com/renew`

### ⭐ 3 Đặc Điểm Nghiệp Vụ Cốt Lõi:
1. **Theo Nhóm 5 Người**: Khách báo lỗi → áp dụng chung cho cả 5 người dùng trong nhóm STT (RN).
2. **Tự Động Nhận Diện Lỗi Tái Phát (Recurring)**: Nếu ticket vừa Đã Xử Lý mà khách lại báo lại trong 24 giờ → Hệ thống tự set `is_recurring = TRUE`, tăng `recur_count`. Nếu `recur_count >= 2`, dashboard admin sẽ **NỔI BẬT NỀN ĐỎ NHẤP NHÁY** cảnh báo admin đổi acc hoặc fix dứt điểm.
3. **Khách Tra Cứu Dễ Dàng**: Không cần nhớ mã ticket, chỉ cần nhập Email.

---

## 🛠️ Hướng Dẫn Setup Google Sheet & Apps Script Backend

### Bước 1: Tạo Google Sheet Mới
1. Tạo 1 Google Sheet mới tên `FAM_ISSUE_TRACKER` (Tách biệt hoàn toàn khỏi Kho TK).
2. Mở Google Sheet vừa tạo, chọn **Tiện ích mở rộng > Apps Script**.

### Bước 2: Dán Mã Nguồn Backend
1. Xóa hết code mặc định trong `Mã.gs` (hoặc `Code.gs`).
2. Dán toàn bộ nội dung file `renew/Code.gs` vào.
3. Bấm **Lưu (Save / Ctrl+S)**.

### Bước 3: Khởi Tạo Cơ Sở Dữ Liệu & Khởi Chạy Lần Đầu
1. Trong màn hình Apps Script, chọn hàm `setupDatabase` ở thanh menu thả xuống và bấm **Chạy (Run)**.
   *(Cấp quyền truy cập nếu Google yêu cầu)*
2. Tiếp theo, chọn hàm `syncEmailLookupCache` và bấm **Chạy (Run)** để đồng bộ danh sách email từ Sheet Kho TK (`1Agq-0ITsQgzhwnWvQTUthAjS2e8zJfgNd8dGGkCDniA`).

### Bước 4: Triển Khai Web App (Deploy API)
1. Bấm nút **Triển khai (Deploy) > Triển khai mới (New deployment)**.
2. Chọn loại triển khai: **Ứng dụng web (Web app)**.
3. Cấu hình:
   - **Mô tả**: `Fam Issue Tracker API v1`
   - **Thực thi dưới dạng (Execute as)**: `Tôi (Me)`
   - **Ai có quyền truy cập (Who has access)**: `Bất kỳ ai (Anyone)`
4. Bấm **Triển khai**. Copy đoạn đường dẫn **URL ứng dụng web (Web app URL)** dạng:
   `https://script.google.com/macros/s/AKfycb.../exec`

### Bước 5: Cấu Hình URL Vào Trang Web
1. Mở trang web `http://godnc.com/renew` (hoặc `renew/index.html`).
2. Bấm vào icon **Bánh răng Cấu hình (Settings)** góc trên bên phải.
3. Dán URL Apps Script Web App vừa copy vào ô **Apps Script Web App Exec URL**.
4. Tắt công tắc **Chế độ Demo (Mock Data)**.
5. Bấm **Lưu & Đóng**.

### Bước 6: Cài Đặt Trigger Tự Động Đồng Bộ Cache Email
1. Tại màn hình Apps Script, chọn icon **Kích hoạt (Triggers - hình đồng hồ)** ở menu bên trái.
2. Bấm **Thêm trình kích hoạt (Add Trigger)** ở góc dưới bên phải.
3. Chọn hàm: `syncEmailLookupCache`.
4. Chọn nguồn sự kiện: **Theo thời gian (Time-driven)**.
5. Chọn loại trình kích hoạt: **Bộ đếm thời gian theo phút (Minute timer)** > **Mỗi 30 phút (Every 30 minutes)**.
6. Bấm **Lưu**.

---

## 💻 Cấu Trúc Các Tab Trên Trang Web `godnc.com/renew`

### 1. Tab Báo Lỗi Fam (`/report`)
- Khách chỉ cần nhập Email và mô tả ngắn.
- Hệ thống lập tức tra cứu STT nhóm, cập nhật hoặc tạo ticket mới và hiển thị trạng thái ngay lập tức trên màn hình.

### 2. Tab Tra Cứu Trạng Thái (`/check-status`)
- Nhập Email để xem badge trạng thái màu:
  - 🟡 **Mới**: Vừa ghi nhận
  - 🔵 **Đang xử lý**: Đội ngũ kỹ thuật đang khắc phục
  - 🟢 **Đã xử lý**: Đã khắc phục xong
- Hiển thị tổng số khách hàng trong cùng Fam đã gửi báo cáo.
- Cảnh báo lỗi tái phát nếu có.

### 3. Tab Admin Dashboard (`/admin/issues`)
- **Mật khẩu truy cập mặc định**: `godnc888` (hoặc `admin`, `dnc`).
- Lọc danh sách ticket theo trạng thái: Tất cả, Mới, Đang xử lý, Đã xử lý, Tái phát.
- Ưu tiên tự động sắp xếp ticket tái phát và ticket chưa xử lý lên đầu.
- Cảnh báo nền đỏ nhấp nháy đối với ticket có `recur_count >= 2`.
- Cho phép đổi trạng thái, điền tên nhân viên xử lý và ghi chú nội bộ.
