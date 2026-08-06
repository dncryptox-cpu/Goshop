# HƯỚNG DẪN TRIỂN KHAI — HLV DINH DƯỠNG ULTRA RUNNER (`godnc.com/hlvdinhduong`)

Ứng dụng web cá nhân **HLV Dinh Dưỡng** giúp tự theo dõi dinh dưỡng và tập luyện cho ultra runner với tính năng tự động điều chỉnh target theo **Loại ngày** (Rest / Thường / Vert Nặng / Peak).

---

## 🚀 Bước 1: Tạo Google Sheet Mới Cho Project

1. Truy cập [Google Sheets](https://sheets.google.com) và bấm **Tạo bảng tính mới**.
2. Đặt tên Sheet: **`HLV Dinh Dưỡng - Ultra Runner`**.
3. **Lưu ý:** Đây là file Sheet mới độc lập hoàn toàn, KHÔNG dùng chung với bất kỳ dự án nào khác.

---

## ⚡ Bước 2: Deploy Google Apps Script Web App

1. Trong file Google Sheet mới vừa tạo, vào menu **Tiện ích mở rộng** (Extensions) ➔ chọn **Apps Script**.
2. Xóa hết mã mặc định trong file `Mã.gs` (`Code.gs`).
3. Mở file mã nguồn [gas/Code.gs](gas/Code.gs) trong dự án này, copy toàn bộ nội dung và dán vào Apps Script.
4. Bấm biểu tượng **💾 Lưu** (Save).
5. Bấm nút **Deploy** (Triển khai) ➔ Chọn **New deployment** (Triển khai mới).
6. Chọn loại triển khai: **Web App** (Ứng dụng web).
   - **Mô tả:** `HLV Dinh Duong API v1`
   - **Execute as (Thực thi dưới dạng):** `Me` (Tôi)
   - **Who has access (Ai có quyền truy cập):** `Anyone` (Bất kỳ ai) hoặc `Anyone with Google Account`.
7. Bấm **Deploy**. Cấp quyền khi Google hỏi xác nhận.
8. Copy đoạn **Web App URL** (Dạng `https://script.google.com/macros/s/AKfycb.../exec`).

> **Ghi chú:** Đợt chạy đầu tiên, Google Apps Script sẽ tự động tạo đủ 3 sheet `TAP_LUYEN`, `DINH_DUONG`, và `MUC_TIEU_NGAY` với tiêu đề cột và các giá trị target mặc định.

---

## 🔑 Bước 3: Lấy Gemini API Key (Miễn phí)

1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Bấm **Create API Key**.
3. Copy đoạn Key thu được (dạng `AIzaSy...`).

---

## ⚙️ Bước 4: Cấu Hình Trên Trang Web

1. Mở trang web `godnc.com/hlvdinhduong` (hoặc mở file `index.html` trực tiếp).
2. Nhấp vào nút **⚙️ Cài đặt** ở góc trên bên phải màn hình.
3. Dán **Google Apps Script Web App URL** thu được ở Bước 2.
4. Dán **Gemini API Key** thu được ở Bước 3.
5. Nhấn **💾 Lưu Cấu Hình**.

---

## 📊 Cấu Trúc Bảng Mục Tiêu Mặc Định (`MUC_TIEU_NGAY`)

| Loại Ngày | Kcal Target | Carb Target (g) | Protein Target (g) | Fat Target (g) |
|---|---|---|---|---|
| **Rest** | 2,900 | 375 | 120 | 75 |
| **Thường** | 3,500 | 525 | 120 | 75 |
| **Vert Nặng** | 4,500 | 750 | 120 | 80 |
| **Peak** | 5,000 | 800 | 130 | 85 |
