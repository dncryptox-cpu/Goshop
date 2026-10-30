# Netflix tự xác minh — deploy Apps Script

Làm trên Google Chrome, **đăng nhập đúng Gmail chung** (nơi mail Netflix đổ về). Nếu Chrome có nhiều tài khoản Google, mở cửa sổ ẩn danh hoặc profile riêng để chắc chắn script chạy dưới Gmail chung.

1. Mở https://script.google.com → **Dự án mới**. Đặt tên `Netflix verify`.
2. Xoá hết nội dung `Code.gs`, dán toàn bộ `vnetflix/apps-script/Code.gs` → Ctrl+S.
3. Chọn hàm `setup` trên thanh công cụ → **Chạy** → cấp quyền (Gmail, Sheets).
   Màn "Google chưa xác minh ứng dụng này": **Nâng cao → Đi tới Netflix verify (không an toàn)** → Cho phép. Đây là script của chính bạn.
4. Xem **Nhật ký thực thi**: có link Sheet "Netflix xác minh – danh sách". Mở, điền tab **Tài khoản**:
   | Email Netflix | Mã khách (không bắt buộc) | Ghi chú | Bật |
   |---|---|---|---|
   | tk1@... | KH-NFLX-01 | Tên khách | TRUE |
   | tk1@... | KH-NFLX-02 | Tên khách khác | TRUE |
   Mỗi khách 1 dòng (lặp lại email). Mã không phân biệt hoa thường. Có dòng để trống "Mã khách" = email đó không cần mã. `FALSE` ở cột Bật = tạm khoá tài khoản đó. Sửa sheet có hiệu lực sau ≤ 1 phút.
5. **Triển khai → Tùy chọn triển khai mới** → bánh răng → **Ứng dụng web**.
   - Thực thi dưới dạng: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**
   → Triển khai → chép **URL ứng dụng web** (đuôi `/exec`).
6. Dán URL vào `API_URL` trong `vnetflix/index.html`.

Sửa `Code.gs` sau này: **Triển khai → Quản lý triển khai → bút chì → Phiên bản: Phiên bản mới → Triển khai**. URL giữ nguyên. (Tạo "triển khai mới" sẽ ra URL khác.)

## Kiểm tra
- Mở URL `/exec` trên trình duyệt → thấy `{"ok":true,"service":"netflix-verify"}`.
- Gửi một email thật từ TV (Tôi đang đi du lịch → Gửi email), vào godnc.com/vnetflix tra.
- Không ra kết quả dù mail đã về: trong trình soạn, sửa email trong `testLookup()` → Chạy → xem log. Nếu mail tới qua chuyển tiếp mà DKIM bị hỏng, tab **Nhật ký** vẫn ghi "tra · 0"; khi đó báo lại để kiểm tra header, đừng tắt `REQUIRE_DKIM` khi chưa xem.

## Test (máy dev)
```
node vnetflix/tests/code.test.js
python3 vnetflix/tests/ui.test.py
```
