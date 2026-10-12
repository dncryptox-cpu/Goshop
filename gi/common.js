// Tiện ích dùng chung cho index.html và admin.html
const GI_ERR = {
  LOGIN_REQUIRED: 'Vui lòng đăng nhập',
  EMAIL_REQUIRED: 'Nhập email cần nâng cấp / mời vào',
  INSUFFICIENT_BALANCE: 'Số dư ví không đủ',
  VARIANT_NOT_AVAILABLE: 'Gói này tạm ngừng bán',
  BAD_PAY_METHOD: 'Cách thanh toán không hợp lệ',
  ADMIN_ONLY: 'Bạn không có quyền admin',
  ORDER_NOT_PROCESSING: 'Đơn không còn ở trạng thái chờ giao',
  LOGIN_PASSWORD_REQUIRED: 'Nhập tài khoản và mật khẩu',
  EXPIRES_REQUIRED: 'Nhập HSD của tài khoản',
  ORDER_ALREADY_PAID: 'Đơn đã được thanh toán',
  CANNOT_CANCEL: 'Không huỷ được đơn này',
  VARIANT_NOT_STOCKABLE: 'Gói "Shop xử lý" không nhập kho',
  NOTE_REQUIRED: 'Cần ghi chú lý do',
  USER_NOT_FOUND: 'Không tìm thấy khách',
  BAD_AMOUNT: 'Số tiền không hợp lệ (tối thiểu 10.000đ)',
  TOO_MANY_PENDING: 'Bạn đang có 3 yêu cầu nạp chờ duyệt, vui lòng đợi shop xác nhận',
  TOPUP_NOT_PENDING: 'Yêu cầu nạp này đã được xử lý'
};
const errText = e => { const m = (e && (e.message || e.error_description)) || String(e); const k = Object.keys(GI_ERR).find(k => m.includes(k)); return k ? GI_ERR[k] : m; };

let sb = null, GI_INIT_ERROR = null;
try {
  const C = window.GI_CONFIG || {};
  if (!window.supabase || !window.supabase.createClient) throw new Error('Không tải được thư viện. Kiểm tra mạng rồi tải lại trang.');
  if (!C.SUPABASE_URL || /YOUR_PROJECT/.test(C.SUPABASE_URL)) throw new Error('Chưa cấu hình config.js');
  sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
} catch (e) { GI_INIT_ERROR = e; }

const DAY = 864e5;
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const toDate = s => s ? (s instanceof Date ? s : new Date(String(s).length === 10 ? s + 'T00:00:00' : s)) : null;
const daysLeft = s => s ? Math.round((toDate(s).getTime() - today0()) / DAY) : null;
const p2 = n => String(n).padStart(2, '0');
const fds = s => { const d = toDate(s); return d ? `${p2(d.getDate())}/${p2(d.getMonth() + 1)}` : ''; };
const fd = s => { const d = toDate(s); return d ? `${fds(d)}/${d.getFullYear()}` : ''; };
const ftime = s => { const d = toDate(s); return d ? `${fds(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}` : ''; };
const addDays = n => new Date(today0() + n * DAY);
const r1k = n => Math.round(n / 1000) * 1000;
const vnd = n => Math.round(Number(n) || 0).toLocaleString('vi-VN') + 'đ';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = s => document.querySelector(s);

const KIND = {
  auto:   { t: 'Giao ngay', short: 'Giao ngay', d: 'Lấy từ kho, giao ngay. HSD tính từ lúc khách mua.' },
  fixed:  { t: 'Giao ngay · HSD cố định', short: 'HSD cố định', d: 'Lấy từ kho, giao ngay. HSD theo từng tài khoản, giá tự giảm khi gần hết hạn.' },
  manual: { t: 'Shop xử lý', short: 'Xử lý tay', d: 'Tạo đơn chờ, admin xử lý rồi bấm giao. Dùng cho nâng chính chủ / mời family / nhập khi có đơn.' }
};

const lum = h => { const n = parseInt(h, 16); return (.299 * (n >> 16) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255; };
function logo(p, cls = '') {
  const bg = /^#[0-9a-f]{6}$/i.test(p.logo_color || '') ? p.logo_color : '#374151';
  const ic = p.icon_key && window.GI_ICONS && window.GI_ICONS[p.icon_key];
  if (ic) {
    const fill = lum(bg.slice(1)) > .6 ? '#111' : (lum(ic.hex) < .25 ? '#fff' : '#' + ic.hex);
    return `<div class="logo ${cls}" style="background:${bg}"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${fill}" d="${ic.path}"/></svg></div>`;
  }
  const t = (p.logo_text || p.name || '?').slice(0, 3).toUpperCase();
  return `<div class="logo mono ${cls}" style="background:${bg}">${esc(t)}</div>`;
}

function toast(t) { const e = $('#toast'); if (!e) return; e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 2600); }
function fatal(msg) {
  document.body.innerHTML = `<div style="max-width:420px;margin:80px auto;padding:24px;text-align:center;font-family:system-ui;color:#F2F2F0">
    <div style="font-size:40px">⚠️</div><h2>Trang tạm thời gặp sự cố</h2><p style="color:#A9AEB8">${esc(msg)}</p>
    <button onclick="location.reload()" style="padding:12px 18px;border-radius:12px;border:0;background:#2DD4BF;font-weight:700">Tải lại</button></div>`;
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Đã copy'); } catch { toast(t); } }

// Bộ hẹn giờ đọc lại dữ liệu (dừng tự động sau maxMs)
const POLLS = {};
function startPoll(name, fn, every, maxMs) {
  stopPoll(name); const until = Date.now() + maxMs;
  POLLS[name] = setInterval(async () => { if (Date.now() > until) return stopPoll(name); try { await fn(); } catch (e) { console.warn(e); } }, every);
}
function stopPoll(name) { if (POLLS[name]) { clearInterval(POLLS[name]); delete POLLS[name]; } }
