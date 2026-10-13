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
Object.assign(GI_ERR, {
  USERNAME_TAKEN: 'Tên đăng nhập đã có người dùng',
  BAD_USERNAME: 'Tên đăng nhập 3–20 ký tự, chỉ gồm chữ thường không dấu, số, _ hoặc .',
  'Invalid login credentials': 'Sai tên đăng nhập hoặc mật khẩu',
  'User already registered': 'Email này đã đăng ký, hãy đăng nhập',
  'Password should be at least': 'Mật khẩu tối thiểu 6 ký tự',
  'Database error saving new user': 'Tên đăng nhập đã có người dùng hoặc không hợp lệ',
  'Unable to validate email address': 'Email không hợp lệ',
  'Email not confirmed': 'Tài khoản chưa xác nhận email',
  'New password should be different': 'Mật khẩu mới phải khác mật khẩu cũ'
});
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

// ===== Đăng nhập / Đăng ký (tên đăng nhập + mật khẩu) =====
function openAuth(mode = 'login') {
  let m = document.getElementById('authModal');
  if (!m) { m = document.createElement('div'); m.id = 'authModal'; m.className = 'scrim'; m.onclick = e => { if (e.target === m) closeAuth(); }; document.body.appendChild(m); }
  const reg = mode === 'register';
  m.innerHTML = `<form class="sheet" onsubmit="event.preventDefault();${reg ? 'doRegister()' : 'doLogin()'}" style="gap:12px">
    <h3>${reg ? 'Tạo tài khoản' : 'Đăng nhập'}</h3>
    ${reg ? `
      <label class="fl">Tên đăng nhập<input class="inp" id="au_user" autocomplete="username" placeholder="vd: dinh.nguyen" required minlength="3" maxlength="20" autocapitalize="none"></label>
      <label class="fl">Mật khẩu<input class="inp" id="au_pass" type="password" autocomplete="new-password" placeholder="Tối thiểu 6 ký tự" required minlength="6"></label>
      <label class="fl">Email<input class="inp" id="au_mail" type="email" autocomplete="email" placeholder="ban@gmail.com" required></label>
      <label class="fl">Số điện thoại / Zalo<input class="inp" id="au_phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="09xx xxx xxx" required minlength="9"></label>`
    : `
      <label class="fl">Tên đăng nhập hoặc email<input class="inp" id="au_user" autocomplete="username" required autocapitalize="none"></label>
      <label class="fl">Mật khẩu<input class="inp" id="au_pass" type="password" autocomplete="current-password" required></label>`}
    <div class="warn" id="au_err" style="display:none"></div>
    <button class="btn" id="au_btn" type="submit">${reg ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
    <button class="btn ghost" type="button" onclick="openAuth('${reg ? 'login' : 'register'}')">${reg ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký (5 giây)'}</button>
    ${reg ? '' : '<small class="note">Quên mật khẩu? Liên hệ hỗ trợ để được cấp lại.</small>'}
  </form>`;
  m.classList.add('on'); setTimeout(() => { const i = document.getElementById('au_user'); i && i.focus(); }, 50);
}
function closeAuth() { const m = document.getElementById('authModal'); if (m) m.classList.remove('on'); }
function authErr(msg) { const e = document.getElementById('au_err'); e.textContent = msg; e.style.display = ''; const b = document.getElementById('au_btn'); b.disabled = false; }
async function doLogin() {
  const b = document.getElementById('au_btn'); b.disabled = true;
  let id = document.getElementById('au_user').value.trim(); const pw = document.getElementById('au_pass').value;
  if (!id.includes('@')) {
    const { data } = await sb.rpc('login_email', { p_username: id });
    if (!data) return authErr('Không tìm thấy tên đăng nhập này');
    id = data;
  }
  const { error } = await sb.auth.signInWithPassword({ email: id, password: pw });
  if (error) return authErr(errText(error));
  closeAuth(); toast('Đã đăng nhập'); if (window.GI_onAuth) window.GI_onAuth();
}
async function doRegister() {
  const b = document.getElementById('au_btn'); b.disabled = true;
  const u = document.getElementById('au_user').value.trim().toLowerCase(), pw = document.getElementById('au_pass').value;
  const mail = document.getElementById('au_mail').value.trim().toLowerCase(), ph = document.getElementById('au_phone').value.replace(/[^0-9+]/g, '');
  if (!/^[a-z0-9_.]{3,20}$/.test(u)) return authErr(GI_ERR.BAD_USERNAME);
  if (pw.length < 6) return authErr('Mật khẩu tối thiểu 6 ký tự');
  if (ph.length < 9) return authErr('Số điện thoại không hợp lệ');
  const { data: free } = await sb.rpc('username_available', { p_username: u });
  if (free === false) return authErr(GI_ERR.USERNAME_TAKEN);
  const { data, error } = await sb.auth.signUp({ email: mail, password: pw, options: { data: { username: u, phone: ph } } });
  if (error) return authErr(errText(error));
  if (!data.session) return authErr('Đã tạo tài khoản. Vui lòng kiểm tra email để xác nhận rồi đăng nhập.');
  closeAuth(); toast('Tạo tài khoản thành công'); if (window.GI_onAuth) window.GI_onAuth();
}

// ===== Đổi mật khẩu (tài khoản tạo nhanh từ trang renew có mật khẩu mặc định) =====
const GI_isQuick = u => !!(u && u.user_metadata && u.user_metadata.quick);
function openChangePass() {
  let m = document.getElementById('authModal');
  if (!m) { m = document.createElement('div'); m.id = 'authModal'; m.className = 'scrim'; m.onclick = e => { if (e.target === m) closeAuth(); }; document.body.appendChild(m); }
  m.innerHTML = `<form class="sheet" onsubmit="event.preventDefault();doChangePass()" style="gap:12px">
    <h3>Đổi mật khẩu</h3>
    <label class="fl">Mật khẩu mới<input class="inp" id="au_pass" type="password" autocomplete="new-password" placeholder="Tối thiểu 6 ký tự" required minlength="6"></label>
    <label class="fl">Nhập lại<input class="inp" id="au_pass2" type="password" autocomplete="new-password" required minlength="6"></label>
    <div class="warn" id="au_err" style="display:none"></div>
    <button class="btn" id="au_btn" type="submit">Lưu mật khẩu</button>
    <button class="btn ghost" type="button" onclick="closeAuth()">Để sau</button>
  </form>`;
  m.classList.add('on'); setTimeout(() => { const i = document.getElementById('au_pass'); i && i.focus(); }, 50);
}
async function doChangePass() {
  const b = document.getElementById('au_btn'); b.disabled = true;
  const pw = document.getElementById('au_pass').value, pw2 = document.getElementById('au_pass2').value;
  if (pw.length < 6) return authErr('Mật khẩu tối thiểu 6 ký tự');
  if (pw !== pw2) return authErr('Hai lần nhập không khớp');
  const { error } = await sb.auth.updateUser({ password: pw, data: { quick: false } });
  if (error) return authErr(errText(error));
  closeAuth(); toast('Đã đổi mật khẩu'); if (window.GI_onAuth) window.GI_onAuth();
}
