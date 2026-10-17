# qlkh — Go Shop OS (bản viết lại frontend của /admin)

Backend giữ nguyên: cùng Google Sheets (đọc qua gviz) và cùng các Apps Script Web App.

## Sửa ở đâu
- Giao diện: `src/shell.html` (khung, đăng nhập, menu), `src/modules/*.html` (mỗi trang 1 file), `src/modals/*.html`
- Logic: `js/modules/*.js` — mỗi file `QLKH.define('tên', {...})`, tất cả được gộp thành 1 component Alpine
- Dữ liệu nào module nào cần: `MODULE_DATA` trong `js/modules/data.js`
- Trang sản phẩm (`netflix/chatgpt/googleone/spotify.html`) sửa trực tiếp

Sau khi sửa: `python3 qlkh/build.py` (sinh `index.html` + build CSS Tailwind tĩnh vào `css/`).
Đừng sửa `index.html` bằng tay — sẽ bị ghi đè.

## Đăng nhập
Tài khoản lấy từ tab `Login` của sheet DATA (cột A tài khoản, cột B mật khẩu).
Tên có chữ `admin` ⇒ quyền admin; còn lại ⇒ nhân viên. Không còn tài khoản viết cứng trong code.
