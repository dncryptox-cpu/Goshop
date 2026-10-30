/**
 * Netflix tự xác minh — Apps Script chạy trên Gmail CHUNG (nơi mail các tài khoản Netflix đổ về).
 * Trang khách: godnc.com/vnetflix  →  POST {action:'lookup', email, pin}
 * Trả: {ok, needPin, windowMin, items:[{id,type,title,link|code,at}]}  hoặc  {ok:false, message, needPin?}
 *
 * Cài đặt: chạy setup() 1 lần → tạo Sheet "Netflix xác minh – danh sách". Deploy → Web app
 * (Execute as: Me, Who has access: Anyone). Xem netflix/apps-script/README.md.
 */

var CFG = {
  WINDOW_MIN: 20,            // chỉ đọc email trong 20 phút gần nhất
  MAX_LOOKUPS: 40,           // số lần tra tối đa / email / 10 phút (trang tự chờ = ~15 lần)
  LOOKUP_WINDOW_S: 600,
  MAX_BAD_PIN: 5,            // nhập sai mã khách 5 lần → khoá
  LOCK_S: 1800,              // khoá 30 phút
  REQUIRE_DKIM: true,        // chỉ nhận email có chữ ký DKIM hợp lệ của netflix.com
  SHEET_ACCOUNTS: 'Tài khoản',
  SHEET_LOG: 'Nhật ký',
  // ChatGPT 2FA — danh sách khách lấy từ backend godnc.com/admin/chatgpt.html
  GPT_LIST_URL: 'https://script.google.com/macros/s/AKfycbySu9evgLmqMVKSc-Z1cKUIzcfqJH9_pEFDdzOERQ1yP8uLy1hvLqJgNRkOlwDJEOba/exec?action=list',
  GPT_MAX_LOOKUPS: 20        // số lần lấy mã 2FA tối đa / email / 10 phút
};

// ───────────────────────── Web app ─────────────────────────

function doGet() {
  return json_({ ok: true, service: 'netflix-verify' });
}

function doPost(e) {
  var req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, message: 'Yêu cầu không hợp lệ' }); }
  if (req.action === 'lookup') return json_(lookup_(req.email, req.pin));
  if (req.action === 'gpt_totp') return json_(gptTotp_(req.email, req.pin));
  return json_({ ok: false, message: 'Yêu cầu không hợp lệ' });
}

function lookup_(emailRaw, pinRaw) {
  var email = String(emailRaw || '').trim().toLowerCase();
  var pin = String(pinRaw || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Email không hợp lệ' };

  var cache = CacheService.getScriptCache();
  var key = hash_(email);

  if (cache.get('lock_' + key)) return { ok: false, message: 'Nhập sai mã khách quá nhiều lần. Thử lại sau 30 phút hoặc nhắn shop.' };

  var n = Number(cache.get('n_' + key) || 0) + 1;
  cache.put('n_' + key, String(n), CFG.LOOKUP_WINDOW_S);
  if (n > CFG.MAX_LOOKUPS) return { ok: false, message: 'Tra quá nhiều lần. Đợi 10 phút rồi thử lại.' };

  var acc = findAccount_(email);
  if (!acc) {
    log_(email, 'không có trong danh sách', 0);
    return { ok: false, message: 'Email này chưa có trong danh sách của shop. Kiểm tra lại hoặc nhắn shop.' };
  }

  // Mỗi khách 1 dòng (cùng email, mã khách riêng). Dòng nào để trống mã khách = email đó không cần mã.
  var needPin = !acc.open;
  if (needPin && acc.pins.indexOf(pin.toLowerCase()) < 0) {
    if (pin) {
      var bad = Number(cache.get('bad_' + key) || 0) + 1;
      cache.put('bad_' + key, String(bad), CFG.LOCK_S);
      if (bad >= CFG.MAX_BAD_PIN) { cache.put('lock_' + key, '1', CFG.LOCK_S); log_(email, 'khoá: sai mã khách', 0); }
      return { ok: false, needPin: true, message: 'Mã khách không đúng.' };
    }
    return { ok: false, needPin: true, message: 'Nhập thêm mã khách shop gửi kèm tài khoản.' };
  }
  if (needPin) cache.remove('bad_' + key);

  var items = findItems_(email, new Date());
  if (n === 1 || items.length) log_(email, 'tra', items.length);
  return { ok: true, needPin: needPin, windowMin: CFG.WINDOW_MIN, items: items };
}

// ───────────────────────── Đọc Gmail ─────────────────────────

function findItems_(email, now) {
  var since = new Date(now.getTime() - CFG.WINDOW_MIN * 60000);
  var q = 'from:netflix.com to:' + email + ' after:' + Math.floor(since.getTime() / 1000);
  var threads = GmailApp.search(q, 0, 20);
  var found = [];
  threads.forEach(function (t) {
    t.getMessages().forEach(function (m) {
      if (m.getDate() < since) return;
      if (!isGenuine_(m)) return;
      if (!sentTo_(m, email)) return;
      var item = classify_(m.getSubject(), m.getBody(), m.getPlainBody());
      if (!item) return;
      item.id = hash_(m.getId()).slice(0, 12);
      item.at = m.getDate().toISOString();
      found.push(item);
    });
  });
  // mới nhất trước, mỗi loại chỉ giữ email mới nhất
  found.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  var seen = {};
  return found.filter(function (it) { if (seen[it.type]) return false; seen[it.type] = 1; return true; });
}

function isGenuine_(m) {
  var from = String(m.getFrom() || '').toLowerCase();
  var addr = (from.match(/<([^>]+)>/) || [null, from])[1].trim();
  if (!/@([a-z0-9-]+\.)*netflix\.com$/.test(addr)) return false;
  if (!CFG.REQUIRE_DKIM) return true;
  var auth = String(m.getHeader('Authentication-Results') || '') + ' ' + String(m.getHeader('ARC-Authentication-Results') || '');
  return /dkim=pass[^;]*header\.(i|d)=@?([a-z0-9-]+\.)*netflix\.com/i.test(auth);
}

function sentTo_(m, email) {
  var to = (String(m.getTo() || '') + ',' + String(m.getCc() || '') + ',' + String(m.getHeader('Delivered-To') || '') + ',' + String(m.getHeader('X-Forwarded-To') || '') + ',' + String(m.getHeader('X-Original-To') || '')).toLowerCase();
  var re = new RegExp('(^|[\\s<,;"])' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[\\s>,;"])');
  return re.test(to);
}

var BLOCK_SUBJECT = /(m[aậ]t kh[aẩ]u|password|passwort|kennwort|contrase[ñn]a|mot de passe|senha|đặt lại|dat lai|reset|zurücksetzen|đổi email|thay đổi email|email.*(đã|da) (thay|đổi)|email (address )?(change|updated)|change.*email|e-mail-adresse|thanh toán|payment|zahlung|pago|paiement|pagamento|billing|rechnung|hóa đơn|hoá đơn|receipt|thẻ|card|karte|tarjeta|membership|mitgliedschaft|gói dịch vụ|tư cách thành viên|cancel|kündig|hủy|huỷ|số điện thoại|phone number|telefonnummer)/i;

/** Trả {type,title,link|code} hoặc null. Chỉ nhận đúng 3 loại; mọi thứ khác bỏ qua. */
function classify_(subject, html, text) {
  subject = String(subject || '');
  html = String(html || '');
  text = String(text || '');
  if (BLOCK_SUBJECT.test(subject)) return null;

  var links = netflixLinks_(html + ' ' + text);
  // Link chứa đường dẫn nguy hiểm → bỏ cả email
  if (links.some(function (u) { return /\/(password|loginhelp|changeemail|email|payment|billing|account\/security)\b/i.test(u.replace(/\?.*$/, '')); })) {
    // vẫn cho qua nếu đó chỉ là link footer kèm theo link xác minh hợp lệ
    if (!links.some(isTempLink_) && !links.some(isHouseholdLink_)) return null;
  }

  var temp = links.filter(isTempLink_)[0];
  if (temp) return { type: 'TEMP', title: 'Mã truy cập tạm thời', link: temp };

  var hh = links.filter(isHouseholdLink_)[0];
  if (hh) return { type: 'HOUSEHOLD', title: 'Cập nhật Hộ gia đình', link: hh };

  // Mã đăng nhập: Netflix gửi theo ngôn ngữ của tài khoản ("Sign-in code", "Login-Code", "Mã đăng nhập", "code de connexion"…)
  if (/(code|mã|ma dang nhap|código|codice|kod)/i.test(subject)) {
    var plain = text || html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
    plain = plain.replace(/&nbsp;/g, ' ');
    // ưu tiên dãy 4 số đứng riêng một dòng (đúng chỗ Netflix in mã), sau đó mới tới số đầu tiên
    var m = plain.match(/^[ \t]*(\d[ \t]?\d[ \t]?\d[ \t]?\d)[ \t]*$/m) || plain.match(/(?:^|[^\d])(\d{4})(?!\d)/);
    if (m) return { type: 'SIGNIN', title: 'Mã đăng nhập', code: m[1].replace(/\s/g, '') };
  }
  return null;
}

function netflixLinks_(s) {
  var out = [], re = /https:\/\/(www\.)?netflix\.com\/[^\s"'<>)\]]+/gi, m;
  while ((m = re.exec(s))) out.push(m[0].replace(/&amp;/g, '&').replace(/[.,;]+$/, ''));
  return out;
}
function isTempLink_(u) { return /netflix\.com\/account\/travel\/verify\b/i.test(u); }
function isHouseholdLink_(u) { return /netflix\.com\/account\/(update-primary-location|set-primary-location)\b/i.test(u); }

// ───────────────────────── Sheet ─────────────────────────

function sheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Chưa chạy setup()');
  return SpreadsheetApp.openById(id);
}

function findAccount_(email) {
  var cache = CacheService.getScriptCache();
  var raw = cache.get('accounts');
  var map;
  if (raw) map = JSON.parse(raw);
  else {
    map = {};
    var rows = sheet_().getSheetByName(CFG.SHEET_ACCOUNTS).getDataRange().getValues().slice(1);
    rows.forEach(function (r) {
      var em = String(r[0] || '').trim().toLowerCase();
      var on = String(r[3]).trim().toUpperCase() !== 'FALSE';
      if (!em || !on) return;
      var m = map[em] || (map[em] = { pins: [], open: false });
      var pin = String(r[1] || '').trim().toLowerCase();
      if (pin) m.pins.push(pin); else m.open = true;
    });
    cache.put('accounts', JSON.stringify(map), 60); // sửa sheet → có hiệu lực sau ≤ 1 phút
  }
  return map[email] || null;
}

function log_(email, what, count) {
  try { sheet_().getSheetByName(CFG.SHEET_LOG).appendRow([new Date(), email, what, count]); } catch (e) {}
}

/** Chạy 1 lần trong trình soạn Apps Script. */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID'), ss;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create('Netflix xác minh – danh sách'); props.setProperty('SHEET_ID', ss.getId()); }

  var a = ss.getSheetByName(CFG.SHEET_ACCOUNTS) || ss.insertSheet(CFG.SHEET_ACCOUNTS);
  if (a.getLastRow() === 0) {
    a.appendRow(['Email Netflix', 'Mã khách (mỗi khách 1 dòng)', 'Tên khách / ghi chú', 'Bật (TRUE/FALSE)']);
    a.getRange('A1:D1').setFontWeight('bold');
    a.getRange('B:B').setNumberFormat('@'); // giữ số 0 đầu mã khách
    a.setFrozenRows(1);
  }
  var l = ss.getSheetByName(CFG.SHEET_LOG) || ss.insertSheet(CFG.SHEET_LOG);
  if (l.getLastRow() === 0) { l.appendRow(['Lúc', 'Email', 'Việc', 'Số kết quả']); l.setFrozenRows(1); }
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (def && ss.getSheets().length > 2) ss.deleteSheet(def);

  GmailApp.getInboxUnreadCount(); // để Google hỏi quyền Gmail ngay lúc setup
  Logger.log('Sheet: ' + ss.getUrl());
  return ss.getUrl();
}

/** Soi lỗi: đổi email rồi bấm Chạy, xem Nhật ký thực thi — từng email Netflix 20 phút qua và lý do bị bỏ. */
function testLookup() {
  var email = 'email-tai-khoan@vidu.com';
  var since = new Date(Date.now() - CFG.WINDOW_MIN * 60000);
  GmailApp.search('from:netflix.com to:' + email + ' after:' + Math.floor(since.getTime() / 1000), 0, 20).forEach(function (t) {
    t.getMessages().forEach(function (m) {
      var why = m.getDate() < since ? 'quá 20 phút' : !isGenuine_(m) ? 'không qua kiểm tra người gửi/DKIM: ' + m.getHeader('Authentication-Results')
        : !sentTo_(m, email) ? 'không gửi tới email này (To: ' + m.getTo() + ')' : JSON.stringify(classify_(m.getSubject(), m.getBody(), m.getPlainBody()) || 'không thuộc 3 loại');
      Logger.log(m.getDate() + ' | ' + m.getSubject() + ' → ' + why);
    });
  });
  Logger.log('Kết quả trả cho khách: ' + JSON.stringify(findItems_(email, new Date())));
}

// ───────────────────────── ChatGPT 2FA ─────────────────────────
// Khoá bí mật 2FA lưu ở Script Properties: TOTP_<email> (không nằm trong sheet / trang). Đặt bằng hàm setGptTotp().

function gptTotp_(emailRaw, pinRaw) {
  var email = String(emailRaw || '').trim().toLowerCase();
  var pin = String(pinRaw || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Email không hợp lệ' };
  if (!pin) return { ok: false, message: 'Nhập mã khách shop gửi kèm tài khoản.' };

  var cache = CacheService.getScriptCache();
  var key = 'g' + hash_(email);
  if (cache.get('lock_' + key)) return { ok: false, message: 'Nhập sai mã khách quá nhiều lần. Thử lại sau 30 phút hoặc nhắn shop.' };
  var n = Number(cache.get('n_' + key) || 0) + 1;
  cache.put('n_' + key, String(n), CFG.LOOKUP_WINDOW_S);
  if (n > CFG.GPT_MAX_LOOKUPS) return { ok: false, message: 'Lấy mã quá nhiều lần. Đợi 10 phút rồi thử lại.' };

  var secret = PropertiesService.getScriptProperties().getProperty('TOTP_' + email);
  var list = gptCustomers_();
  if (list === null) return { ok: false, message: 'Không tải được danh sách khách. Thử lại sau ít phút.' };
  var mine = list.filter(function (c) { return c.email === email; });
  if (!mine.length || !secret) {
    log_(email, 'gpt: ' + (!mine.length ? 'không có trong danh sách' : 'chưa cài khoá 2FA'), 0);
    return { ok: false, message: !mine.length ? 'Email này chưa có trong danh sách của shop. Kiểm tra lại hoặc nhắn shop.' : 'Tài khoản này chưa bật tự lấy mã 2FA. Nhắn shop nhé.' };
  }
  var hit = mine.filter(function (c) { return c.code === pin; });
  if (!hit.length) {
    var bad = Number(cache.get('bad_' + key) || 0) + 1;
    cache.put('bad_' + key, String(bad), CFG.LOCK_S);
    if (bad >= CFG.MAX_BAD_PIN) { cache.put('lock_' + key, '1', CFG.LOCK_S); log_(email, 'gpt khoá: sai mã khách', 0); }
    return { ok: false, message: 'Mã khách không đúng.' };
  }
  cache.remove('bad_' + key);
  var active = hit.filter(function (c) { return c.active; });
  if (!active.length) {
    log_(email, 'gpt: ' + pin + ' hết hạn', 0);
    return { ok: false, message: 'Gói của bạn đã hết hạn. Nhắn shop để gia hạn nhé.' };
  }
  var now = Date.now();
  var t = totp_(secret, now);
  log_(email, 'gpt 2fa · ' + (active[0].name || pin), 1);
  return { ok: true, code: t.code, secondsLeft: t.secondsLeft, name: active[0].name || '' };
}

/** Đọc danh sách khách ChatGPT từ backend admin. Trả [{email, code, name, active}] hoặc null nếu lỗi. Cache 60s. */
function gptCustomers_() {
  var cache = CacheService.getScriptCache();
  var raw = cache.get('gpt_list');
  if (raw) return JSON.parse(raw);
  var json;
  try {
    var res = UrlFetchApp.fetch(CFG.GPT_LIST_URL + '&t=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
    json = JSON.parse(res.getContentText());
  } catch (e) { return null; }
  if (!json || !json.success || !Array.isArray(json.data)) return null;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var out = json.data.map(function (it) {
    var m = String(it.note || '').match(/\[Khách:\s*([^|]+)\|\s*Mã:\s*([^\]]+)\]/);
    var code = String(it.userCode || (m && m[2]) || '').trim().toLowerCase();
    var exp = parseDate_(it.expiryDate);
    var expired = /expired/i.test(String(it.status || '')) && !exp ? true : (exp ? exp < today : false);
    return { email: String(it.rootEmail || it.email || '').trim().toLowerCase(), code: code, name: String(it.userName || (m && m[1]) || '').trim(), active: !expired };
  }).filter(function (c) { return c.email && c.code; });
  try { cache.put('gpt_list', JSON.stringify(out), 60); } catch (e) {}
  return out;
}

function parseDate_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v) ? null : v;
  var s = String(v).trim(), m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  var d = new Date(s);
  return isNaN(d) ? null : d;
}

/** TOTP chuẩn RFC 6238 (SHA1, 6 số, 30 giây) — giống Google Authenticator. */
function totp_(secretB32, nowMs) {
  var key = base32_(secretB32);
  var step = Math.floor(nowMs / 1000 / 30);
  var msg = [0, 0, 0, 0, 0, 0, 0, 0];
  for (var i = 7, x = step; i >= 0; i--) { msg[i] = x & 0xff; x = Math.floor(x / 256); }
  var h = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, msg, key).map(function (b) { return (b + 256) % 256; });
  var o = h[h.length - 1] & 0xf;
  var bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return { code: String(bin % 1000000).padStart(6, '0'), secondsLeft: 30 - Math.floor(nowMs / 1000) % 30 };
}

function base32_(s) {
  var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', bits = '', out = [];
  String(s).toUpperCase().replace(/[^A-Z2-7]/g, '').split('').forEach(function (c) { bits += ('0000' + A.indexOf(c).toString(2)).slice(-5); });
  for (var i = 0; i + 8 <= bits.length; i += 8) { var b = parseInt(bits.substr(i, 8), 2); out.push(b > 127 ? b - 256 : b); }
  return out;
}

/** Chạy trong trình soạn: sửa email + khoá rồi bấm Chạy. Log in ra mã hiện tại để so với app Authenticator. Chạy xong XOÁ khoá khỏi code. */
function setGptTotp() {
  var email = 'dncethxyz@gmail.com';
  var secret = 'DAN_KHOA_2FA_VAO_DAY';
  if (/DAN_KHOA/.test(secret)) throw new Error('Chưa dán khoá 2FA');
  PropertiesService.getScriptProperties().setProperty('TOTP_' + email.toLowerCase(), secret.replace(/\s/g, '').toUpperCase());
  Logger.log('Đã lưu. Mã hiện tại: ' + totp_(secret, Date.now()).code + ' — so với app Authenticator phải trùng.');
}

// ───────────────────────── tiện ích ─────────────────────────

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s))
    .map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}
