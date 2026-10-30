// Chạy: node netflix/tests/code.test.js  — giả lập GmailApp/Sheet/Cache rồi chạy Code.gs thật.
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');

function makeEnv({ accounts = [], mails = [] } = {}) {
  const store = new Map(), logs = [];
  const rows = [['Email', 'Mã', 'Ghi chú', 'Bật'], ...accounts];
  const ctx = {
    console,
    CacheService: { getScriptCache: () => ({ get: k => store.has(k) ? store.get(k) : null, put: (k, v) => store.set(k, v), remove: k => store.delete(k) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'SHEET', setProperty() {} }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: n => n === 'Tài khoản'
      ? { getDataRange: () => ({ getValues: () => rows }) }
      : { appendRow: r => logs.push(r) } }) },
    GmailApp: { search: (q) => { ctx.lastQuery = q; return [{ getMessages: () => mails.map(mkMsg) }]; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType: () => ({ body: s }) }) },
    Utilities: { DigestAlgorithm: { SHA_256: 1 }, computeDigest: (_, s) => [...crypto.createHash('sha256').update(s).digest()].map(b => b > 127 ? b - 256 : b) },
    Logger: { log() {} },
  };
  vm.createContext(ctx); vm.runInContext(SRC, ctx);
  ctx._logs = logs;
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

console.log(`\n${pass}/${pass + fail} đạt`);
process.exit(fail ? 1 : 0);
