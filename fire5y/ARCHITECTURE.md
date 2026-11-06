# KIẾN TRÚC & QUY TRÌNH PHÁT TRIỂN (AI-DRIVEN WORKFLOW)
**Dự án:** Lovely Money Finance OS (Web Template + Google Sheets Backend)
**Mô hình phát triển:** Sử dụng lực lượng AI (Antigravity) làm nòng cốt.

## 1. MỤC TIÊU DỰ ÁN
- Đóng gói ứng dụng quản lý tài chính thành các Template để bán (SaaS/Template model).
- Giao diện thân thiện, hiện đại, trải nghiệm "Bring Your Own Backend" (BYOB) - khách hàng tự kết nối Google Sheet của họ.
- Quy trình phát triển phải dễ dàng để người không rành code (nhân viên) cũng có thể sử dụng Antigravity để nâng cấp, bảo trì hoặc thêm tính năng mới mà không làm vỡ hệ thống.

## 2. KIẾN TRÚC HỆ THỐNG
- **Frontend (Giao diện):** Tách biệt hoàn toàn khỏi dữ liệu. Hiện đang dùng HTML/CSS/JS thuần nhưng hướng tới nâng cấp lên **Vite + React** hoặc **Next.js** để module hóa (chia nhỏ file) giúp AI dễ đọc và hạn chế lỗi.
- **Backend (Dữ liệu):** Google Sheets + Google Apps Script (`code.gs`).
- **Liên kết (BYOB):** Khách hàng copy file Google Sheet mẫu về máy, lấy `API_URL` cá nhân và nhập vào Frontend (qua tab Cài đặt). Web lưu API này vào `localStorage` và hoạt động hoàn toàn dựa trên dữ liệu cá nhân của khách.

## 3. QUY TRÌNH PHÁT TRIỂN CHO NHÂN VIÊN DÙNG AI
Bất cứ ai khi mở phiên làm việc mới với Antigravity đều phải tuân thủ quy trình sau:

### Bước 1: Nạp Ngữ Cảnh (Context)
- Bắt đầu đoạn chat bằng lệnh: *"Đọc file `ARCHITECTURE.md` để hiểu quy chuẩn dự án trước khi làm."*

### Bước 2: Quản lý Phiên bản (Version Control - Git)
- **Tuyệt đối không sửa trực tiếp trên nhánh `main`**.
- Yêu cầu AI: *"Tạo nhánh mới tên `feat/<tên-tính-năng>`. Viết code xong hãy tự commit và push lên nhánh đó."*
- Admin/Chủ dự án sẽ là người review nhánh và gộp (merge) vào `main` nếu thấy chạy tốt.

### Bước 3: Giao tiếp & Test bằng AI
- Cắt nhỏ yêu cầu. Thay vì *"Làm cho tôi tính năng Quản lý nợ"*, hãy nói: *"Mở file `debts.html` (hoặc `Debts.jsx`), thêm bảng danh sách nợ. Sau đó dùng công cụ giả lập trình duyệt (Browser Subagent) tự chụp màn hình kiểm tra xem có lỗi giao diện không."*
- Cung cấp JSON giả (Mock Data) cho AI khi làm giao diện, tránh đụng chạm đến API gọi Google Sheet khi chưa cần thiết.

## 4. QUY TRÌNH ĐÓNG GÓI & PHÂN PHỐI CHO KHÁCH HÀNG
1. **Google Sheet Master:** Chuẩn bị sẵn 1 file Google Sheet chứa các cấu trúc cột tiêu chuẩn và tích hợp sẵn `code.gs`.
2. **Web Hosting:** Deploy Frontend lên nền tảng tĩnh (Vercel, Netlify) với tên miền chung (vd: `app.lovelymoney.com`).
3. **Onboarding:** Khách mua hàng sẽ được hướng dẫn Copy Sheet Master -> Deploy Apps Script -> Lấy API Key dán vào Web. Xong! Toàn bộ quyền kiểm soát và bảo mật thuộc về khách.

---
*Ghi chú: File này đóng vai trò là "Bộ não dự án". Khi cần thiết kế thêm Module mới, hãy yêu cầu Antigravity dựa trên triết lý tách bạch Frontend/Backend trong file này để thực hiện.*

## 5. BÀI HỌC XƯƠNG MÁU & QUY CHUẨN KỸ THUẬT CỐT LÕI
Tất cả các tính năng mới và các phiên làm việc sau này của AI/Dev phải tuân thủ nghiêm ngặt các quy tắc đã đúc kết từ dự án DNC Operator:

### 5.1. Google Apps Script (Backend) - Chống Lỗi Hệ Thống
*   **Không tin tưởng nút Ctrl+Z (Undo) và `e.oldValue`:** Khi người dùng bấm Undo, `e.oldValue` bị trả về `undefined`. Tuyệt đối không dùng nó để tính toán cộng dồn. Bắt buộc dùng `PropertiesService` kết hợp `CacheService` với "Key" độc nhất (VD: ID Khách + Email) để làm bộ nhớ ngầm vĩnh cửu.
*   **Tránh xa ảo ảnh `getLastRow()`:** Hàm này sẽ đếm cả các ô trống bị dính định dạng ở tận đáy bảng (dòng 1000). Luôn tự viết hàm quét từ dưới lên dựa vào một Cột mỏ neo (VD: Cột Email) để tìm chính xác "Dòng cuối cùng chứa Data".
*   **Tránh lỗi Múi Giờ (Timezone Date):** Khi làm "Radar Chống Trùng Lặp", tuyệt đối không dùng hàm check Ngày (Date) vì múi giờ của Google Sheets và JS thường xuyên bị lệch. Thay vào đó, chỉ cần quét đối chiếu **Email + Sản Phẩm** trong phạm vi 20-50 dòng cuối cùng là đủ an toàn.
*   **Chống đâm xe dữ liệu (Race Condition):** Bắt buộc bọc toàn bộ code xử lý trigger `onEdit` bằng `LockService.getDocumentLock().waitLock(5000)` và nhả khóa ở `finally`. Không có Lock, user gõ quá nhanh sẽ sinh ra trùng lặp đơn hàng.

### 5.2. Frontend (Giao Diện & UI/UX)
*   **Thẩm mỹ (Aesthetics):** Bắt buộc duy trì phong cách Flat Design, Minimalist, Glassmorphism. Màu sắc hài hòa, sang trọng (không dùng các màu cơ bản xanh đỏ tím vàng chói mắt). Các nút bấm, dropdown, table phải có hiệu ứng micro-animations mượt mà để mang lại trải nghiệm "Premium".
*   **Module hóa & Format Data:** Giao diện có thể dùng HTML/Alpine.js hoặc React/Tailwind nhưng code phải chia nhỏ. Hàm xử lý tiền tệ (Currency) phải đọc được cả chữ "k", "tr". Bảng dữ liệu luôn phải có tính năng "Drill-down" (bấm để xổ ra chi tiết) và Click-to-copy cho email khách hàng.
