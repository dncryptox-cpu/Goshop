// GO INTELLIGENCE — đăng nhập nhanh từ trang renew bằng email khách có sẵn.
// Mật khẩu mặc định = phần trước @ của email (ngắn hơn 6 ký tự thì thêm 1234… cho đủ 6). Khách đổi được sau khi đăng nhập.
function GI_quickPass(email) {
  const local = String(email || '').trim().toLowerCase().split('@')[0];
  return local.length >= 6 ? local : (local + '123456').slice(0, 6);
}
// Trả về: 'in' (đăng nhập được) · 'new' (vừa tạo tài khoản) · 'own' (khách đã tự đặt mật khẩu khác)
//         · 'other' (máy này đang đăng nhập tài khoản khác, không đụng tới) · 'err'
async function GI_quickLogin(sb, email) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'err';
  try {
    const { data: cur } = await sb.auth.getSession();
    const curMail = cur && cur.session && cur.session.user ? String(cur.session.user.email || '').toLowerCase() : '';
    if (curMail) return curMail === email ? 'in' : 'other';
    const password = GI_quickPass(email);
    const a = await sb.auth.signInWithPassword({ email, password });
    if (!a.error) return 'in';
    const b = await sb.auth.signUp({ email, password, options: { data: { quick: true } } });
    if (!b.error && b.data && b.data.session) return 'new';
    if (b.error && /already registered|already exists/i.test(b.error.message || '')) return 'own';
    if (!b.error && b.data && b.data.user && !b.data.session) return 'own';
    return 'err';
  } catch (e) { console.warn('GI quick login', e); return 'err'; }
}
