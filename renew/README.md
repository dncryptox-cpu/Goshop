# Hướng Dẫn Sử Dụng & Triển Khai — Hệ Thống Báo Lỗi Fam (godnc.com/renew)

## 📌 Tổng Quan
Hệ thống **Fam Issue Tracker** gồm 3 cổng làm việc tách biệt:

1. **Khách hàng tự báo lỗi & tra cứu**: `http://godnc.com/renew/` (gộp 2 tab Báo Lỗi Fam & Tra Cứu Trạng Thái trên cùng 1 trang mượt mà).
2. **Cộng tác viên (CTV) báo lỗi hàng loạt & theo dõi**: `http://godnc.com/renew/ctv/` (Báo lỗi hàng loạt bằng cách dán danh sách/đoạn chat + theo dõi đơn báo của riêng CTV).
3. **Quản trị viên (Admin) xử lý ticket**: `http://godnc.com/renew/admin/` (Ưu tiên ticket tái phát, đổi trạng thái, tự động gửi email thông báo cho khách khi xử lý xong).

---

## ⭐ Các Tính Năng Nổi Bật Mới (v4):

### 1. Cổng CTV Báo Lỗi Hàng Loạt (`/renew/ctv/`)
- Dán danh sách email hoặc đoạn tin nhắn chat lộn xộn. Hệ thống tự dùng Regex lọc ra tối đa 50 email hợp lệ.
- Ghi nhận `submitted_by = ctvName` vào tab `REPORTS`.
- Bảng hiển thị kết quả ngay tức thì: email nào tìm thấy (badge xanh/xanh dương), email nào gõ sai/chưa có trong hệ thống (badge đỏ ❌).
- **Tab "Báo cáo của tôi"**: CTV xem danh sách khách hàng mình đã gửi hộ kèm thời gian phản hồi thực tế (ví dụ: *Báo lúc 14:00 16/08 ➔ Đã xong lúc 14:05 16/08 (sau 5 phút)*).

### 2. Tự Động Gửi Email Cho Khách Khi Xử Lý Xong
- Trong Admin Dashboard, khi đổi trạng thái ticket thành **"Đã xử lý"**, backend tự động lấy danh sách email khách trong nhóm ticket đó và gửi email thông báo qua `MailApp.sendEmail()`.
- Tự động ghi mốc thời gian `notified_at` vào tab `TICKETS` để không gửi trùng lặp nếu Admin lưu lại nhiều lần.

---

## 🛠️ Cấu Trúc Các Tab Trên Google Sheet `FAM_ISSUE_TRACKER`

1. **`TICKETS`**: `ticket_id`, `stt_group`, `status`, `created_at`, `updated_at`, `resolved_at`, `resolved_by`, `is_recurring`, `recur_count`, `note`, `notified_at`
2. **`REPORTS`**: `report_id`, `ticket_id`, `customer_email`, `reported_at`, `message`, `submitted_by`
3. **`EMAIL_LOOKUP_CACHE`**: `email`, `stt_group`, `synced_at`
