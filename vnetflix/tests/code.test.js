// Chạy: node netflix/tests/code.test.js  — giả lập GmailApp/Sheet/Cache rồi chạy Code.gs thật.
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');

function makeEnv({ accounts = [], mails = [], gpt = { success: true, data: [] }, props = {} } = {}) {
  const store = new Map(), logs = [];
  const rows = [['Email', 'Mã', 'Ghi chú', 'Bật'], ...accounts];
  const memSheet = data => ({ data,
    getDataRange: () => ({ getValues: () => data.map(r => r.slice()) }),
    appendRow: r => data.push(r.slice()),
    getRange: (row, col, nr = 1, nc = 1) => (typeof row === 'string' ? { setFontWeight() {}, setNumberFormat() {} } : {
      setValues: v => v.forEach((vr, i) => vr.forEach((x, j) => { (data[row - 1 + i] ||= [])[col - 1 + j] = x; })),
      setValue: x => { (data[row - 1] ||= [])[col - 1] = x; } }),
    setFrozenRows() {} });
  const sheets = { 'Tài khoản': memSheet(rows), 'Nhật ký': memSheet(logs) };
  const ctx = {
    console,
    CacheService: { getScriptCache: () => ({ get: k => store.has(k) ? store.get(k) : null, put: (k, v) => store.set(k, v), remove: k => store.delete(k) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => k === 'SHEET_ID' ? 'SHEET' : (props[k] ?? null), setProperty(k, v) { props[k] = v; }, deleteProperty(k) { delete props[k]; }, getProperties: () => ({ ...props }) }) },
    UrlFetchApp: { fetch: () => { ctx.fetchCount = (ctx.fetchCount || 0) + 1; return { getContentText: () => JSON.stringify(gpt) }; } },
    SpreadsheetApp: { openById: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = memSheet([])) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    GmailApp: { search: (q) => { ctx.lastQuery = q; return [{ getMessages: () => mails.map(mkMsg) }]; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType: () => ({ body: s }) }) },
    Utilities: { MacAlgorithm: { HMAC_SHA_1: 1 }, computeHmacSignature: (_, msg, key) => [...crypto.createHmac('sha1', Buffer.from(key.map(b => (b + 256) % 256))).update(Buffer.from(msg.map(b => (b + 256) % 256))).digest()].map(b => b > 127 ? b - 256 : b),
      DigestAlgorithm: { SHA_256: 1 }, computeDigest: (_, s) => [...crypto.createHash('sha256').update(s).digest()].map(b => b > 127 ? b - 256 : b) },
    Logger: { log() {} },
  };
  vm.createContext(ctx); vm.runInContext(SRC, ctx);
  ctx._logs = logs; ctx._sheets = sheets;
  return ctx;
}
const DKIM = 'mx.google.com; dkim=pass header.i=@netflix.com header.s=x; spf=pass';
function mkMsg(o) {
  const h = { 'Authentication-Results': o.auth ?? DKIM, ...(o.headers || {}) };
  return { getFrom: () => o.from ?? 'Netflix <info@account.netflix.com>', getTo: () => o.to, getCc: () => '', getHeader: k => h[k] || '',
    getDate: () => new Date(Date.now() - (o.ageMin ?? 1) * 60000), getSubject: () => o.subject, getBody: () => o.html || '', getPlainBody: () => o.text || '', getId: () => o.id || Math.random().toString() };
}
const TEMP = { subject: 'Mã truy cập tạm thời Netflix của bạn', html: '<a href="https://www.netflix.com/account/travel/verify?nftoken=AAA&amp;x=1">Nhận mã</a> <a href="https://www.netflix.com/password">Không phải bạn?</a>' };
const HH = { subject: 'Cách cập nhật Hộ gia đình Netflix', html: '<a href="https://www.netflix.com/account/update-primary-location?nftoken=BBB">Có, đây là tôi</a>' };
const SIGN = { subject: 'Mã đăng nhập Netflix của bạn', text: 'Xin chào\nNhập mã này để đăng nhập\n  4821  \n© 2026 Netflix\n100 Winchester Circle' };

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('✓', name); } catch (e) { fail++; console.log('✗', name, '—', e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); }

const A = 'kh1@mail.com';
t('tách 3 loại, mới nhất trước', () => {
  const c = makeEnv({ accounts: [[A, '', '', true]], mails: [{ ...TEMP, to: A, ageMin: 2 }, { ...HH, to: A, ageMin: 5 }, { ...SIGN, to: A, ageMin: 1 }] });
  const r = c.lookup_(A, '');
  eq(r.ok, true); eq(r.items.map(i => i.type), ['SIGNIN', 'TEMP', 'HOUSEHOLD']);
  eq(r.items[1].link, 'https://www.netflix.com/account/travel/verify?nftoken=AAA&x=1');
  eq(r.items[0].code, '4821');
});
t('mã đăng nhập tiếng Anh, mã trong câu', () => {
  const c = makeEnv();
  eq(c.classify_('Your Netflix sign-in code', '', 'Enter this code to sign in: 0371. It expires in 15 minutes.').code, '0371');
});
t('mã đăng nhập tiếng Đức "Ihr Login-Code" (mail thật 30/10)', () => {
  const c = makeEnv();
  const html = '<h1>Zum Einloggen diesen Code eingeben</h1><td style="letter-spacing:6px">3660</td><p>Dieser Code ist nur 15 Minuten lang gültig.</p><a href="https://www.netflix.com/account/devices">Geräte-Aktivität</a>';
  eq(c.classify_('Netflix: Ihr Login-Code', html, 'Zum Einloggen diesen Code eingeben\n\n3660\n\nBitte geben Sie den Code ein. Dieser Code ist nur 15 Minuten lang gültig.').code, '3660');
  eq(c.classify_('Netflix: Ihr Login-Code', html, '').code, '3660');
  eq(c.classify_('Netflix : votre code de connexion', '', 'Saisissez ce code\n3 6 6 0\n').code, '3660');
});
t('chặn mail mật khẩu/thanh toán tiếng Đức, Pháp, TBN', () => {
  const c = makeEnv();
  ['Netflix: Code zum Zurücksetzen Ihres Passworts', 'Ihre Zahlung wurde abgelehnt', 'Réinitialisation du mot de passe', 'Tu código para restablecer la contraseña']
    .forEach(s => eq(c.classify_(s, '', 'Code\n1234\n'), null, s));
});
t('chặn email đặt lại mật khẩu / đổi email / thanh toán', () => {
  const c = makeEnv();
  ['Hoàn tất yêu cầu đặt lại mật khẩu', 'Reset your password', 'Email của bạn đã thay đổi', 'Your email address change', 'Cập nhật phương thức thanh toán', 'Your payment was declined']
    .forEach(s => eq(c.classify_(s, '<a href="https://www.netflix.com/account/travel/verify?x">x</a>', '1234'), null, s));
});
t('chặn email có link nguy hiểm mà không có link xác minh', () => {
  const c = makeEnv();
  eq(c.classify_('Netflix', '<a href="https://www.netflix.com/password?token=1">x</a>', ''), null);
});
t('chặn người gửi giả / không có DKIM / domain nhái', () => {
  const c = makeEnv({ accounts: [[A, '', '', true]], mails: [
    { ...TEMP, to: A, from: 'Netflix <info@netflix.com.evil.io>' },
    { ...TEMP, to: A, auth: 'mx.google.com; dkim=fail; spf=pass' },
    { ...TEMP, to: A, auth: 'dkim=pass header.i=@evil.com' },
    { ...TEMP, to: A, from: 'info@notnetflix.com' }] });
  eq(c.lookup_(A, '').items.length, 0);
});
t('link không phải netflix.com bị bỏ', () => {
  const c = makeEnv();
  eq(c.classify_('Mã truy cập tạm thời', '<a href="https://netflix.com.evil.io/account/travel/verify?x">x</a>', ''), null);
});
t('chỉ email gửi đúng tài khoản (không lẫn email gần giống)', () => {
  const c = makeEnv({ accounts: [[A, '', '', true]], mails: [{ ...TEMP, to: 'xkh1@mail.com' }, { ...HH, to: 'kh1@mail.com.vn' }] });
  eq(c.lookup_(A, '').items.length, 0);
  const c2 = makeEnv({ accounts: [[A, '', '', true]], mails: [{ ...TEMP, to: '"KH" <KH1@mail.com>' }] });
  eq(c2.lookup_('KH1@Mail.com ', '').items.length, 1);
});
t('bỏ email quá 20 phút', () => {
  const c = makeEnv({ accounts: [[A, '', '', true]], mails: [{ ...TEMP, to: A, ageMin: 21 }] });
  eq(c.lookup_(A, '').items.length, 0);
  if (!/after:\d+/.test(c.lastQuery) || !c.lastQuery.includes('to:' + A)) throw new Error('query ' + c.lastQuery);
});
t('mỗi loại chỉ giữ email mới nhất', () => {
  const c = makeEnv({ accounts: [[A, '', '', true]], mails: [{ ...TEMP, to: A, ageMin: 9, html: TEMP.html.replace('AAA', 'OLD') }, { ...TEMP, to: A, ageMin: 1 }] });
  const r = c.lookup_(A, '');
  eq(r.items.length, 1); if (!r.items[0].link.includes('AAA')) throw new Error('lấy nhầm email cũ');
});
t('email không có trong danh sách / bị tắt', () => {
  const c = makeEnv({ accounts: [[A, '', '', false]] });
  eq(c.lookup_(A, '').ok, false); eq(c.lookup_('khac@mail.com', '').ok, false);
});
t('mã khách: thiếu → needPin, sai → báo, đúng → ok', () => {
  const c = makeEnv({ accounts: [[A, '012345', '', true]], mails: [{ ...TEMP, to: A }] });
  let r = c.lookup_(A, ''); eq([r.ok, r.needPin], [false, true]);
  r = c.lookup_(A, '999999'); eq([r.ok, r.needPin], [false, true]);
  r = c.lookup_(A, '012345'); eq([r.ok, r.needPin, r.items.length], [true, true, 1]);
});
t('nhiều khách chung 1 email: mỗi khách 1 mã, không phân biệt hoa thường, tắt khách thì mã hết hiệu lực', () => {
  const c = makeEnv({ accounts: [[A, 'linhlinh06', 'Linh', true], [A, 'HoaiAnh', 'Hoài Anh', true], [A, 'KH-NFLX-02', 'Đức', 'FALSE'], ['b@mail.com', 'KH-NFLX-02', 'Vutung', true]], mails: [{ ...TEMP, to: A }] });
  eq(c.lookup_(A, '').needPin, true);
  eq(c.lookup_(A, 'hoaianh ').ok, true);
  eq(c.lookup_(A, 'LINHLINH06').ok, true);
  eq(c.lookup_(A, 'KH-NFLX-02').ok, false);
  eq(c.lookup_('b@mail.com', 'kh-nflx-02').ok, true);
});
t('có 1 dòng để trống mã → email đó không cần mã', () => {
  const c = makeEnv({ accounts: [[A, 'x1', '', true], [A, '', '', true]] });
  eq([c.lookup_(A, '').ok, c.lookup_(A, '').needPin], [true, false]);
});
t('sai mã khách 5 lần → khoá, kể cả nhập đúng', () => {
  const c = makeEnv({ accounts: [[A, '1111', '', true]] });
  for (let i = 0; i < 5; i++) c.lookup_(A, '0000');
  const r = c.lookup_(A, '1111'); eq(r.ok, false); if (!/30 phút/.test(r.message)) throw new Error(r.message);
});
t('giới hạn số lần tra', () => {
  const c = makeEnv({ accounts: [[A, '', '', true]] });
  for (let i = 0; i < 40; i++) eq(c.lookup_(A, '').ok, true);
  eq(c.lookup_(A, '').ok, false);
});
t('doPost: JSON hỏng / action lạ', () => {
  const c = makeEnv();
  eq(JSON.parse(c.doPost({ postData: { contents: '{x' } }).body).ok, false);
  eq(JSON.parse(c.doPost({ postData: { contents: '{"action":"del"}' } }).body).ok, false);
});
t('doPost: tra thật trả JSON đúng hợp đồng', () => {
  const c = makeEnv({ accounts: [[A, '', '', true]], mails: [{ ...HH, to: A }] });
  const r = JSON.parse(c.doPost({ postData: { contents: JSON.stringify({ action: 'lookup', email: A, pin: '' }) } }).body);
  eq(Object.keys(r).sort(), ['items', 'needPin', 'ok', 'windowMin']);
  eq(Object.keys(r.items[0]).sort(), ['at', 'id', 'link', 'title', 'type']);
});


// ───── ChatGPT 2FA ─────
const RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // "12345678901234567890"
t('TOTP đúng bộ mẫu RFC 6238', () => {
  const c = makeEnv();
  eq(c.totp_(RFC, 59000).code, '287082');
  eq(c.totp_(RFC, 1111111109000).code, '081804');
  eq(c.totp_(RFC, 1234567890000).code, '005924');
  eq(c.totp_('gezd gnbv gy3t qojq gezd gnbv gy3t qojq', 59000).code, '287082');
  eq(c.totp_(RFC, 59000).secondsLeft, 1);
});
const G = 'dncethxyz@gmail.com';
const fut = new Date(Date.now() + 9 * 864e5), past = new Date(Date.now() - 2 * 864e5);
const ddmmyyyy = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const GPT = { success: true, data: [
  { rootEmail: G, userCode: 'KH-CAFARD-01', userName: 'Cafard', expiryDate: ddmmyyyy(fut) },
  { email: G, note: '[Khách: Hoan Tran | Mã: KH-HOANTRAN-01] 10 thg 8', expiryDate: ddmmyyyy(fut) },
  { rootEmail: G, userCode: 'KH-OLD-01', expiryDate: ddmmyyyy(past) },
  { rootEmail: G, userCode: 'KH-RENEW-01', expiryDate: ddmmyyyy(past) },
  { rootEmail: G, userCode: 'KH-RENEW-01', expiryDate: ddmmyyyy(fut) },
] };
const P = { ['TOTP_' + G]: RFC };
t('gpt: khách còn hạn lấy được mã 6 số (mã ở cột riêng hoặc trong ghi chú, không phân biệt hoa thường)', () => {
  const c = makeEnv({ gpt: GPT, props: P });
  let r = c.gptTotp_(G, 'kh-cafard-01'); eq([r.ok, /^\d{6}$/.test(r.code), r.name], [true, true, 'Cafard']);
  r = c.gptTotp_(' DncEthxyz@gmail.com ', 'KH-HOANTRAN-01'); eq([r.ok, r.name], [true, 'Hoan Tran']);
  if (!(r.secondsLeft >= 1 && r.secondsLeft <= 30)) throw new Error('secondsLeft');
});
t('gpt: hết hạn → không cho; đã gia hạn (có dòng mới còn hạn) → cho', () => {
  const c = makeEnv({ gpt: GPT, props: P });
  const r = c.gptTotp_(G, 'KH-OLD-01'); eq(r.ok, false); if (!/hết hạn/.test(r.message)) throw new Error(r.message);
  eq(c.gptTotp_(G, 'KH-RENEW-01').ok, true);
});
t('gpt: sai mã / thiếu mã / email lạ / chưa cài khoá', () => {
  const c = makeEnv({ gpt: GPT, props: P });
  eq(c.gptTotp_(G, '').ok, false);
  eq(c.gptTotp_(G, 'KH-NFLX-01').message, 'Mã khách không đúng.');
  eq(c.gptTotp_('khac@gmail.com', 'KH-CAFARD-01').ok, false);
  const c2 = makeEnv({ gpt: GPT });
  const r = c2.gptTotp_(G, 'KH-CAFARD-01'); eq(r.ok, false); if (r.code) throw new Error('lộ mã');
});
t('gpt: sai mã 5 lần → khoá; chặn spam 30 request / 10 phút', () => {
  const c = makeEnv({ gpt: GPT, props: P });
  for (let i = 0; i < 5; i++) c.gptTotp_(G, 'sai');
  eq(c.gptTotp_(G, 'KH-CAFARD-01').ok, false);
  const c2 = makeEnv({ gpt: GPT, props: P });
  for (let i = 0; i < 30; i++) eq(c2.gptTotp_(G, 'KH-CAFARD-01').ok, true); // cùng 1 phiên 3 phút → không tốn lượt
  eq(c2.gptTotp_(G, 'KH-CAFARD-01').ok, false);
});
t('gpt lượt: trong 3 phút lấy lại không tốn lượt; hết 3 lượt thì chặn; mỗi khách đếm riêng', () => {
  const c = makeEnv({ gpt: GPT, props: P });
  const real = Date.now; let now = real();
  vm.runInContext('Date', c).now = () => now;
  try {
    let r = c.gptTotp_(G, 'KH-CAFARD-01'); eq([r.ok, r.used, r.quota], [true, 1, 3]);
    now += 60e3; r = c.gptTotp_(G, 'KH-CAFARD-01'); eq([r.used, r.sessionLeft], [1, 120]);
    now += 121e3; eq(c.gptTotp_(G, 'KH-CAFARD-01').used, 2);
    now += 181e3; eq(c.gptTotp_(G, 'KH-CAFARD-01').used, 3);
    now += 100e3; eq(c.gptTotp_(G, 'KH-CAFARD-01').ok, true); // vẫn trong phiên lần 3
    now += 81e3; r = c.gptTotp_(G, 'KH-CAFARD-01'); eq([r.ok, r.quotaOut, r.used], [false, true, 3]); if (r.code) throw new Error('lộ mã');
    eq(c.gptTotp_(G, 'KH-HOANTRAN-01').used, 1);
    const row = c._sheets['GPT lượt'].data.find(x => x[1] === 'kh-cafard-01'); eq([row[0], row[2], row[3]], [G, 'Cafard', 3]);
  } finally { vm.runInContext('Date', c).now = real; }
});
t('gpt lượt: admin reset (đúng khoá) cấp lại lượt; cột Giới hạn riêng; sai khoá bị chặn', () => {
  const c = makeEnv({ gpt: GPT, props: P });
  const real = Date.now; let now = real(); vm.runInContext('Date', c).now = () => now;
  try {
    for (let i = 0; i < 3; i++) { c.gptTotp_(G, 'KH-CAFARD-01'); now += 181e3; }
    eq(c.gptTotp_(G, 'KH-CAFARD-01').ok, false);
    const bad = JSON.parse(c.doPost({ postData: { contents: JSON.stringify({ action: 'gpt_reset', email: G, pin: 'KH-CAFARD-01', authToken: 'x' }) } }).body);
    eq(bad.ok, false);
    const ok = JSON.parse(c.doPost({ postData: { contents: JSON.stringify({ action: 'gpt_reset', email: G, pin: 'kh-cafard-01', authToken: 'c74391ab-gpt-sec-2026' }) } }).body);
    eq(ok.ok, true);
    eq(c.gptTotp_(G, 'KH-CAFARD-01').used, 1);
    const u = JSON.parse(c.doPost({ postData: { contents: JSON.stringify({ action: 'gpt_usage', authToken: 'c74391ab-gpt-sec-2026' }) } }).body);
    eq([u.ok, u.quota, u.usage[0].used, u.usage[0].pin], [true, 3, 1, 'kh-cafard-01']);
    c._sheets['GPT lượt'].data.find(x => x[1] === 'kh-cafard-01')[4] = 5; now += 181e3;
    eq(c.gptTotp_(G, 'KH-CAFARD-01').quota, 5);
  } finally { vm.runInContext('Date', c).now = real; }
});
t('gpt: backend lỗi → báo lỗi, không lộ mã; danh sách được cache', () => {
  const c = makeEnv({ gpt: { success: false }, props: P });
  const r = c.gptTotp_(G, 'KH-CAFARD-01'); eq(r.ok, false); if (r.code) throw new Error('lộ mã');
  const c2 = makeEnv({ gpt: GPT, props: P });
  c2.gptTotp_(G, 'KH-CAFARD-01'); c2.gptTotp_(G, 'KH-HOANTRAN-01'); eq(c2.fetchCount, 1);
});
t('doPost gpt_totp trả đúng hợp đồng', () => {
  const c = makeEnv({ gpt: GPT, props: P });
  const r = JSON.parse(c.doPost({ postData: { contents: JSON.stringify({ action: 'gpt_totp', email: G, pin: 'KH-CAFARD-01' }) } }).body);
  eq(Object.keys(r).sort(), ['code', 'name', 'ok', 'quota', 'secondsLeft', 'sessionLeft', 'used']);
});

t('khoá 2FA nhiều tài khoản: admin thêm / đổi / xoá, không lộ khoá, mỗi email dùng khoá riêng', () => {
  const G2 = 'gpt2@gmail.com';
  const data = { success: true, data: [...GPT.data, { rootEmail: G2, userCode: 'KH-B-01', expiryDate: ddmmyyyy(fut) }] };
  const c = makeEnv({ gpt: data });
  const post = b => JSON.parse(c.doPost({ postData: { contents: JSON.stringify({ authToken: 'c74391ab-gpt-sec-2026', ...b }) } }).body);
  eq(post({ action: 'gpt_key_set', email: G, secret: 'abc', authToken: 'x' }).ok, false);
  eq(post({ action: 'gpt_key_set', email: G, secret: 'abc' }).ok, false);
  let r = post({ action: 'gpt_key_set', email: ' DncEthxyz@gmail.com ', secret: 'gezd gnbv gy3t qojq gezd gnbv gy3t qojq' });
  eq([r.ok, /^\d{6}$/.test(r.code), r.emails], [true, true, [G]]);
  eq(c.gptTotp_(G2, 'KH-B-01').ok, false); // G2 chưa có khoá
  post({ action: 'gpt_key_set', email: G2, secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' });
  const k = post({ action: 'gpt_keys' }); eq(k.emails, [G, G2]); if (JSON.stringify(k).includes('JBSW')) throw new Error('lộ khoá');
  const a = c.gptTotp_(G, 'KH-CAFARD-01').code, b = c.gptTotp_(G2, 'KH-B-01').code;
  eq([a, b], [c.totp_(RFC, Date.now()).code, c.totp_('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', Date.now()).code]);
  eq(c.gptTotp_(G2, 'KH-CAFARD-01').ok, false); // mã khách của tài khoản khác không dùng được
  r = post({ action: 'gpt_key_set', email: G2, secret: '' }); eq([r.ok, r.emails], [true, [G]]);
});

console.log(`\n${pass}/${pass + fail} đạt`);
process.exit(fail ? 1 : 0);
