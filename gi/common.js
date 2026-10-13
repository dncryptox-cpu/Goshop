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

// ===== Hình sản phẩm: ảnh bìa tự tạo (không dùng logo hãng) =====
// Màu lấy theo màu sản phẩm (đổi sang tông sáng/tối đều nhau), hoạ tiết theo loại sản phẩm, chữ viết tắt in to làm điểm nhấn.
const hashS = s => { let h = 2166136261; for (const c of String(s || '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function hueOf(p) {
  const m = /^#([0-9a-f]{6})$/i.exec(p.logo_color || '');
  if (m) {
    const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d > .06) { let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return Math.round((h * 60 + 360) % 360); }
  }
  return hashS(p.name) % 360;
}
const GLYPH = {
  chat: '<path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v6a2.5 2.5 0 01-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 014 12.5z"/><path d="M8.5 9.5h7M8.5 12h4"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" stroke="none"/>',
  ent: '<rect x="3" y="7" width="18" height="12" rx="3"/><path d="M8.5 3.5L12 7l3.5-3.5"/><path d="M10.5 10.5v5l4-2.5z" fill="currentColor" stroke="none"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 15.5l-5-5-10 9.5"/>',
  code: '<path d="M9 7.5L4.5 12 9 16.5M15 7.5l4.5 4.5-4.5 4.5"/>',
  learn: '<path d="M2.5 9L12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c3.2 2.4 7.8 2.4 11 0V11"/>',
  spark: '<path d="M12 3.5c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7z"/>'
};
const CAT_KIND = { 'Chat AI': 'chat', 'Video': 'video', 'Giải trí': 'ent', 'Ảnh': 'img', 'Thiết kế': 'img', 'Lập trình': 'code', 'Học tập': 'learn' };
const kindOf = p => CAT_KIND[p.category] || 'spark';
const glyphSvg = (k, size, stroke = '#fff') => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:${stroke}" aria-hidden="true">${GLYPH[k] || GLYPH.spark}</svg>`;
const hsl = (h, s, l) => `hsl(${h} ${s}% ${l}%)`;
let ART_N = 0;
// Ô nhỏ (danh sách, đơn hàng): nền màu + biểu tượng loại sản phẩm
function logo(p, cls = '') {
  const h = hueOf(p), k = kindOf(p);
  const sz = cls === 'sm' ? 16 : 24;
  return `<div class="logo ${cls}" style="background:linear-gradient(140deg,${hsl(h, 62, 46)},${hsl((h + 28) % 360, 58, 24)})">${glyphSvg(k, sz)}</div>`;
}
// Ảnh bìa (thẻ sản phẩm, trang chi tiết)
function cover(p, wide) {
  const id = 'a' + (++ART_N), h = hueOf(p), k = kindOf(p), seed = hashS(p.id || p.name);
  const W = 320, H = wide ? 150 : 200;
  const hi = hsl(h, 78, 64), lo = hsl((h + 24) % 360, 55, 14), mid = hsl(h, 55, 28);
  const gx = 60 + seed % 200, gy = 20 + (seed >> 8) % 80;
  let pat = '';
  if (k === 'chat') for (let r = 34; r < 420; r += 30) pat += `<circle cx="${W}" cy="0" r="${r}"/>`;
  else if (k === 'video') for (let x = -H; x < W + H; x += 22) pat += `<path d="M${x} ${H}L${x + H} 0"/>`;
  else if (k === 'ent') for (let y = 10; y < H; y += 12) pat += `<path d="M0 ${y}H${W}"/>`;
  else if (k === 'code') { for (let x = 0; x <= W; x += 24) pat += `<path d="M${x} 0V${H}"/>`; for (let y = 0; y <= H; y += 24) pat += `<path d="M0 ${y}H${W}"/>`; }
  else if (k === 'img' || k === 'learn') for (let x = 12; x < W; x += 18) for (let y = 12; y < H; y += 18) pat += `<circle cx="${x}" cy="${y}" r="1.4" fill="${hi}" stroke="none"/>`;
  else for (let r = 30; r < 360; r += 26) pat += `<circle cx="${gx}" cy="${H + 40}" r="${r}"/>`;
  const word = String(p.logo_text || p.name || '?').trim().split(/\s+/)[0].slice(0, 4).toUpperCase();
  const fs = word.length <= 2 ? 150 : word.length === 3 ? 118 : 92;
  return `<div class="cover${wide ? ' wide' : ''}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
    <radialGradient id="${id}r" cx="${gx / W}" cy="${gy / H}" r=".75"><stop offset="0" stop-color="${hi}" stop-opacity=".55"/><stop offset="1" stop-color="${hi}" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#${id}g)"/><rect width="${W}" height="${H}" fill="url(#${id}r)"/>
    <g fill="none" stroke="${hi}" stroke-opacity=".16" stroke-width="1">${pat}</g>
    <text x="-4" y="${H - 14}" font-family="Be Vietnam Pro,system-ui,sans-serif" font-weight="800" font-size="${fs}" letter-spacing="-6" fill="${hsl(h, 85, 86)}" fill-opacity=".92">${esc(word)}</text>
    <g transform="translate(${W - 50} 14)"><rect width="36" height="36" rx="11" fill="#fff" fill-opacity=".14"/><g transform="translate(7 7) scale(.9167)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" color="#fff">${GLYPH[k] || GLYPH.spark}</g></g>
  </svg></div>`;
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
      <div class="authnote"><b>Đã mua YouTube Premium ở shop?</b> Bạn có sẵn tài khoản, không cần đăng ký.<br>
        Nhập <b>email đang dùng YouTube</b>. Lần đầu, mật khẩu là <b>phần trước @</b> của email.<br>
        <span class="ex">Ví dụ: email <b>tenban123@gmail.com</b> → mật khẩu <b>tenban123</b></span></div>
      <label class="fl">Email (hoặc tên đăng nhập)<input class="inp" id="au_user" type="text" inputmode="email" autocomplete="username" required autocapitalize="none" placeholder="email-cua-ban@gmail.com"></label>
      <label class="fl">Mật khẩu<input class="inp" id="au_pass" type="password" autocomplete="current-password" required placeholder="Lần đầu: phần trước @ của email"></label>`}
    <div class="warn" id="au_err" style="display:none"></div>
    <button class="btn" id="au_btn" type="submit">${reg ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
    <button class="btn ghost" type="button" onclick="openAuth('${reg ? 'login' : 'register'}')">${reg ? 'Đã mua YouTube ở shop / đã có tài khoản? Đăng nhập' : 'Khách mới, chưa mua gì? Đăng ký'}</button>
    ${reg ? '' : '<small class="note">Đã đổi mật khẩu rồi quên? Nhắn Zalo 0398.057.191 để shop cấp lại.</small>'}
  </form>`;
  m.classList.add('on'); setTimeout(() => { const i = document.getElementById('au_user'); i && i.focus(); }, 50);
}
function closeAuth() { const m = document.getElementById('authModal'); if (m) m.classList.remove('on'); }
function authErr(msg) { const e = document.getElementById('au_err'); e.textContent = msg; e.style.display = ''; const b = document.getElementById('au_btn'); b.disabled = false; }
async function doLogin() {
  const b = document.getElementById('au_btn'); b.disabled = true;
  let id = document.getElementById('au_user').value.trim(); const pw = document.getElementById('au_pass').value;
  const typedEmail = id.includes('@');
  if (!id.includes('@')) {
    const { data } = await sb.rpc('login_email', { p_username: id });
    if (!data) return authErr('Không tìm thấy tên đăng nhập này');
    id = data;
  }
  id = id.toLowerCase();
  const { error } = await sb.auth.signInWithPassword({ email: id, password: pw });
  if (error) {
    // Khách YouTube chưa từng vào app: tài khoản chưa được tạo → tạo luôn với mật khẩu khách vừa nhập
    if (typedEmail && /Invalid login/i.test(error.message || '') && await GI_isYtCustomer(id)) {
      const pass = pw.length >= 6 ? pw : GI_defaultPass(id);
      const r = await sb.auth.signUp({ email: id, password: pass, options: { data: { quick: pass === GI_defaultPass(id) } } });
      if (!r.error && r.data && r.data.session) {
        closeAuth(); toast(pass === pw ? 'Đã vào. Mật khẩu của bạn là mật khẩu vừa nhập.' : 'Đã vào. Mật khẩu tạm: ' + pass + ' (đổi ở tab Đơn)');
        if (window.GI_onAuth) window.GI_onAuth(); return;
      }
      if (r.error && /already registered/i.test(r.error.message || '')) return authErr('Sai mật khẩu. Lần đầu, mật khẩu là phần trước @ của email (' + GI_defaultPass(id) + '). Đã đổi mà quên thì nhắn Zalo shop.');
    }
    return authErr(/Invalid login/i.test(error.message || '') && typedEmail
      ? 'Email này chưa có trong danh sách khách YouTube của shop, hoặc sai mật khẩu. Kiểm tra lại email, hoặc bấm Đăng ký.'
      : errText(error));
  }
  closeAuth(); toast('Đã đăng nhập'); if (window.GI_onAuth) window.GI_onAuth();
}
// Mật khẩu mặc định = phần trước @ (thiếu 6 ký tự thì thêm 1234…), giống quick.js
const GI_defaultPass = e => { const l = String(e || '').trim().toLowerCase().split('@')[0]; return l.length >= 6 ? l : (l + '123456').slice(0, 6); };
async function GI_isYtCustomer(email) {
  if (!GI_CONFIG.RENEW_API || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  try {
    const r = await fetch(GI_CONFIG.RENEW_API + '?action=checkStatus', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ email }) });
    const d = JSON.parse(await r.text()); return !!(d && d.success);
  } catch (e) { return false; }
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
