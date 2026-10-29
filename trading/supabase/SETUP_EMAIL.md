# Bật đăng ký bằng email + quên mật khẩu qua email (DNC Trading OS)

Làm theo đúng thứ tự. Phần nhập khoá / mật khẩu DNL tự làm.

## 1. Dịch vụ gửi mail (Resend — miễn phí 3.000 mail/tháng, 100/ngày)
Email mặc định của Supabase chỉ gửi tới email thành viên trong team Supabase, vài mail/giờ → không dùng được cho người dùng thật.

1. Đăng ký resend.com → **Domains → Add Domain** → `godnc.com`.
2. Resend hiện mấy bản ghi DNS (MX, TXT SPF, TXT DKIM). Vào nơi quản lý DNS của godnc.com, thêm đúng y như vậy. Chờ Resend báo **Verified**.
3. **API Keys → Create API Key** (quyền Sending access) → chép key.

## 2. Supabase → Authentication
- **Emails → SMTP Settings** → bật *Enable Custom SMTP*:
  - Sender email: `no-reply@godnc.com` · Sender name: `DNC Trading`
  - Host `smtp.resend.com` · Port `465` · Username `resend` · Password = API key ở bước 1.3
- **URL Configuration**:
  - *Redirect URLs* → thêm `https://godnc.com/trading/`
  - *Site URL*: nếu đang là `http://localhost:3000` thì đổi thành `https://godnc.com/trading/`. Nếu đang là trang khác đang dùng thì giữ nguyên.
- **Sign In / Providers → Email**:
  - **Secure email change → TẮT** (bắt buộc: tài khoản cũ dùng email giả, nếu bật thì link xác nhận gửi vào email giả, không bao giờ tới).
  - *Confirm email*: **chưa bật** lúc này — bật ở bước 5.
- **Emails → Templates** (tuỳ chọn, cho tiếng Việt) — xem mẫu bên dưới.

## 3. Chạy SQL
SQL Editor → dán toàn bộ `trading/supabase/2026-10-29_email_signup_limit.sql` → Run.

## 4. Báo Claude merge nhánh `trading-recovery` vào `main`

## 5. Sau khi trang mới đã lên: bật **Confirm email**
Người đăng ký mới phải bấm link trong email mới vào được → email chắc chắn đúng, quên mật khẩu là lấy lại được.

---

## Mẫu email tiếng Việt
**Confirm signup** — Subject: `Xác nhận tài khoản DNC Trading`
```html
<h2>Chào mừng tới DNC Trading OS</h2>
<p>Bấm nút dưới để xác nhận email và vào nhật ký giao dịch:</p>
<p><a href="{{ .ConfirmationURL }}">Xác nhận email</a></p>
<p>Không phải bạn đăng ký? Bỏ qua email này.</p>
```

**Reset password** — Subject: `Đặt lại mật khẩu DNC Trading`
```html
<h2>Đặt lại mật khẩu</h2>
<p>Bấm nút dưới để chọn mật khẩu mới. Link dùng 1 lần và hết hạn sau 1 giờ.</p>
<p><a href="{{ .ConfirmationURL }}">Đặt mật khẩu mới</a></p>
<p>Không phải bạn yêu cầu? Bỏ qua email này, mật khẩu cũ vẫn giữ nguyên.</p>
```

**Change email address** — Subject: `Xác nhận email mới cho DNC Trading`
```html
<h2>Xác nhận email</h2>
<p>Bấm nút dưới để gắn {{ .NewEmail }} vào tài khoản DNC Trading. Sau đó đăng nhập bằng email này.</p>
<p><a href="{{ .ConfirmationURL }}">Xác nhận email</a></p>
```
