# Cẩm nang Sinh tồn với Google Apps Script (GAS)

Tài liệu này ghi chú lại những "cú lừa" kinh điển của hệ thống Google Sheets và Google Apps Script (GAS) mà chúng ta đã phải đổ máu để tìm ra. Bất cứ khi nào làm một dự án mới có liên quan đến trigger tự động (`onEdit`), hãy lấy bảng nội quy này ra soi chiếu để code không bị "ngu đột xuất".

## 1. Nút Ctrl+Z (Undo) làm mất trí nhớ `e.oldValue`
*   **Vấn đề:** Khi người dùng nhập sai và bấm `Ctrl+Z`, trigger `onEdit(e)` vẫn chạy. Tuy nhiên, Google Sheets thường xuyên bị lỗi không truyền giá trị cũ (`e.oldValue` trả về `undefined`). Điều này khiến các logic tính toán (VD: `số mới - số cũ`) bị sai lệch hoàn toàn, vì code sẽ tưởng ô đó ban đầu là ô trống (số cũ = 0).
*   **Giải pháp:** 
    *   KHÔNG BAO GIỜ tin tưởng tuyệt đối vào `e.oldValue` cho các logic quan trọng (như cộng dồn tiền/tháng).
    *   Hãy dùng bộ nhớ lưu trữ ngoài (như `PropertiesService`) kết hợp với một "Chìa khóa" độc nhất (VD: ID Khách hàng + Email) để chủ động ghi nhớ số liệu thực tế của ô đó.

## 2. Ảo ảnh của hàm `getLastRow()`
*   **Vấn đề:** Hàm `sheet.getLastRow()` không trả về dòng cuối cùng có chữ, mà nó trả về dòng cuối cùng có **BẤT KỲ DẤU VẾT NÀO** (kể cả một ô trống bị tô màu nền, đóng khung viền ở tận dòng 1000). Nếu dùng `getLastRow()` để xác định phạm vi quét dữ liệu (như Radar chống trùng lặp), code sẽ quét nhầm vào các dòng trắng tinh ở đáy bảng và bỏ qua dữ liệu thật.
*   **Giải pháp:**
    *   Tự viết hàm dò tìm dòng cuối bằng cách bám vào một Cột mỏ neo (Cột bắt buộc phải có dữ liệu, VD: Cột Email).
    *   Đọc mảng dữ liệu của cột đó từ trên xuống dưới, hoặc loop ngược từ dưới lên để tìm vị trí dòng cuối cùng chứa `string` không rỗng.

## 3. Lệch Múi Giờ Ẩn (Timezone Date Mismatch)
*   **Vấn đề:** Khi đọc dữ liệu Ngày Tháng từ Google Sheets lên Javascript, nó sẽ bị biến thành Object `Date`. Google Sheets và Apps Script thường hay bị lệch múi giờ ngầm. Một ngày `24/06/2026` trên Sheet khi đưa vào JS có thể biến thành `23:00 ngày 23/06/2026`. Việc so sánh bằng `===` giữa 2 ngày sẽ thất bại thảm hại.
*   **Giải pháp:**
    *   Hạn chế tối đa việc dùng Date để làm điều kiện so sánh tuyệt đối (Double Check).
    *   Nếu làm Radar chống trùng lặp: Đừng check Ngày. Hãy check **Email + Gói Sản Phẩm** nằm trong phạm vi hẹp (VD: Quét 20 dòng gần nhất là đủ để kết luận vừa có đơn này chưa).

## 4. Độ trễ của Đám mây (PropertiesService Eventual Consistency)
*   **Vấn đề:** `PropertiesService` dùng để lưu trữ vĩnh viễn rất tốt, nhưng nó ghi dữ liệu vào Datastore của Google nên mất khoảng vài phần mười giây để đồng bộ. Nếu người dùng gõ số rồi bấm `Ctrl+Z` với tốc độ ánh sáng, lệnh đọc của lần chạy thứ 2 sẽ trả về `null` vì lệnh ghi của lần chạy 1 chưa lên kịp Đám mây.
*   **Giải pháp:**
    *   Luôn luôn kẹp chả: Dùng `CacheService` (Bộ nhớ đệm siêu tốc - RAM) đi đôi với `PropertiesService` (Bộ nhớ vĩnh cửu - Ổ cứng).
    *   Ghi thì ghi vào cả 2. Đọc thì ưu tiên đọc `Cache` trước, nếu không có mới tìm trong `Properties`.

## 5. Đánh nhau vì thao tác quá nhanh (Race Condition)
*   **Vấn đề:** Một người dùng gõ dữ liệu, copy/paste, hoặc ấn Ctrl+Z liên tục sẽ kích hoạt hàng loạt con Bot `onEdit` chạy song song cùng 1 phần nghìn giây. Tụi nó sẽ dẫm đạp lên nhau, cùng ghi dữ liệu vào file Tài chính, gây ra duplicate (trùng đơn) hoặc ghi đè mất dữ liệu.
*   **Giải pháp:**
    *   Dùng **Lệnh Khóa Tôn Ngộ Không**: Kẹp toàn bộ code xử lý vào giữa `LockService.getDocumentLock()`.
    *   Cho thời gian chờ `waitLock(5000)` (Đợi 5 giây). Con Bot nào chạy trước sẽ đóng cửa khóa lại, xử lý xong mới mở cửa cho con tiếp theo vào. Kẹp thêm `try...finally` để đảm bảo luôn nhả khóa (releaseLock) dù code có bị lỗi giữa chừng.

---
**Tóm tắt Kiến trúc Bot Vững chắc:**
```javascript
function onEdit(e) {
  // 1. Lọc rác (chặn copy nhiều ô)
  // 2. LockService (Khóa cửa chống đâm xe)
  try {
     // 3. CacheService + PropertiesService (Nhớ dai chống Ctrl+Z)
     // 4. Custom getLastRow (Dò dòng cuối chuẩn xác)
     // 5. Radar Double Check (Quét 20 dòng cuối không dùng Date)
     // 6. Thực thi Ghi dữ liệu
  } finally {
     // 7. Nhả Khóa
     lock.releaseLock();
  }
}
```
