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
  GPT_MAX_LOOKUPS: 30,       // chặn spam: số request tối đa / email / 10 phút
  GPT_QUOTA: 3,              // mỗi khách được lấy mã 3 LẦN, admin reset để cấp thêm
  GPT_SESSION_S: 180,        // 1 lần = 3 phút: trong 3 phút trang tự đổi mã mới không tính thêm lần
  SHEET_GPT: 'GPT lượt',
  ADMIN_KEY: 'c74391ab-gpt-sec-2026' // trùng CHATGPT_API_KEY ở admin/chatgpt.html
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
  if (/^gpt_(usage|reset|keys|key_set)$/.test(req.action)) {
    if (req.authToken !== CFG.ADMIN_KEY) return json_({ ok: false, message: 'Sai khoá admin' });
    if (req.action === 'gpt_usage') return json_({ ok: true, quota: CFG.GPT_QUOTA, usage: gptUsageAll_() });
    if (req.action === 'gpt_reset') return json_(gptReset_(req.email, req.pin));
    if (req.action === 'gpt_keys') return json_({ ok: true, emails: gptKeyEmails_() });
    return json_(gptKeySet_(req.email, req.secret));
  }
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
  if (!ss.getSheetByName(CFG.SHEET_GPT)) gptSheet_();
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
// Khoá bí mật 2FA lưu ở Script Properties: TOTP_<email> (không nằm trong sheet / trang). Thêm ở admin → nút "Khoá 2FA".

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
  var name = active[0].name || '';
  var now = Date.now();
  var q = gptUse_(email, pin, name, now);
  if (!q.ok) {
    log_(email, 'gpt hết lượt · ' + (name || pin), 0);
    return { ok: false, quotaOut: true, used: q.used, quota: q.quota, message: 'Bạn đã dùng hết ' + q.quota + ' lần lấy mã. Nhắn shop để được cấp thêm lượt nhé.' };
  }
  var t = totp_(secret, now);
  if (q.newSession) log_(email, 'gpt 2fa lần ' + q.used + '/' + q.quota + ' · ' + (name || pin), 1);
  return { ok: true, code: t.code, secondsLeft: t.secondsLeft, name: name, used: q.used, quota: q.quota, sessionLeft: q.sessionLeft };
}

// ── Lượt lấy mã: tab "GPT lượt" — Email | Mã khách | Tên | Đã lấy | Giới hạn | Bắt đầu lần gần nhất | Reset lúc
// Cột "Giới hạn" để trống = mặc định CFG.GPT_QUOTA; điền số để cấp riêng cho khách đó. Sửa "Đã lấy" = 0 cũng là reset.
function gptSheet_() {
  var ss = sheet_(), sh = ss.getSheetByName(CFG.SHEET_GPT);
  if (!sh) {
    sh = ss.insertSheet(CFG.SHEET_GPT);
    sh.appendRow(['Email ChatGPT', 'Mã khách', 'Tên', 'Đã lấy', 'Giới hạn (trống = ' + CFG.GPT_QUOTA + ')', 'Bắt đầu lần gần nhất', 'Reset lúc']);
    sh.getRange('A1:G1').setFontWeight('bold'); sh.setFrozenRows(1); sh.getRange('B:B').setNumberFormat('@');
  }
  return sh;
}

function gptUse_(email, pin, name, now) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = gptSheet_(), rows = sh.getDataRange().getValues(), r = -1;
    for (var i = 1; i < rows.length; i++) if (String(rows[i][0]).trim().toLowerCase() === email && String(rows[i][1]).trim().toLowerCase() === pin) { r = i; break; }
    var row = r > 0 ? rows[r] : [email, pin, name, 0, '', '', ''];
    var used = Number(row[3]) || 0, quota = Number(row[4]) || CFG.GPT_QUOTA;
    var start = row[5] ? new Date(row[5]).getTime() : 0;
    var inSession = start && now - start < CFG.GPT_SESSION_S * 1000 && used > 0;
    if (inSession) return { ok: true, used: used, quota: quota, newSession: false, sessionLeft: Math.ceil((start + CFG.GPT_SESSION_S * 1000 - now) / 1000) };
    if (used >= quota) return { ok: false, used: used, quota: quota };
    used++;
    if (r > 0) sh.getRange(r + 1, 3, 1, 4).setValues([[name || row[2], used, row[4], new Date(now)]]);
    else sh.appendRow([email, pin, name, used, '', new Date(now), '']);
    return { ok: true, used: used, quota: quota, newSession: true, sessionLeft: CFG.GPT_SESSION_S };
  } finally { lock.releaseLock(); }
}

function gptUsageAll_() {
  return gptSheet_().getDataRange().getValues().slice(1).filter(function (r) { return r[0]; }).map(function (r) {
    return { email: String(r[0]).trim().toLowerCase(), pin: String(r[1]).trim().toLowerCase(), used: Number(r[3]) || 0, quota: Number(r[4]) || CFG.GPT_QUOTA, last: r[5] ? new Date(r[5]).toISOString() : '' };
  });
}

function gptReset_(emailRaw, pinRaw) {
  var email = String(emailRaw || '').trim().toLowerCase(), pin = String(pinRaw || '').trim().toLowerCase();
  if (!email || !pin) return { ok: false, message: 'Thiếu email / mã khách' };
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = gptSheet_(), rows = sh.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) if (String(rows[i][0]).trim().toLowerCase() === email && String(rows[i][1]).trim().toLowerCase() === pin) {
      sh.getRange(i + 1, 4).setValue(0); sh.getRange(i + 1, 6).setValue(''); sh.getRange(i + 1, 7).setValue(new Date());
      log_(email, 'gpt reset lượt · ' + pin, 0);
      return { ok: true, used: 0, quota: Number(rows[i][4]) || CFG.GPT_QUOTA };
    }
    return { ok: true, used: 0, quota: CFG.GPT_QUOTA }; // chưa lấy lần nào
  } finally { lock.releaseLock(); }
}

/** Đọc danh sách khách ChatGPT từ backend admin. Trả [{email, code, name, active}] hoặc null nếu lỗi. Cache 60s. */
function gptCustomers_() {
  var cache = CacheService.getScriptCache();
  var raw = cache.get('gpt_list');
  if (raw) return JSON.parse(raw);
  var json, text = '';
  try {
    var res = UrlFetchApp.fetch(CFG.GPT_LIST_URL + '&t=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
    text = res.getContentText();
    json = JSON.parse(text);
  } catch (e) { gptListError_(e.message + (text ? ' | ' + text.slice(0, 150) : '')); return null; }
  if (!json || !json.success || !Array.isArray(json.data)) { gptListError_('backend trả: ' + text.slice(0, 150)); return null; }
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

function gptListError_(msg) {
  var cache = CacheService.getScriptCache();
  if (cache.get('gpt_list_err')) return; // ghi tối đa 1 dòng / phút
  cache.put('gpt_list_err', '1', 60);
  log_('(hệ thống)', 'gpt lỗi đọc danh sách: ' + msg, 0);
}

/** Chạy trong trình soạn (chọn testGpt → Chạy): cấp quyền đọc backend + in kết quả để soi lỗi. */
function testGpt() {
  var res = UrlFetchApp.fetch(CFG.GPT_LIST_URL + '&t=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
  Logger.log('HTTP ' + res.getResponseCode() + ' | ' + res.getContentText().slice(0, 300));
  CacheService.getScriptCache().remove('gpt_list');
  var list = gptCustomers_();
  Logger.log(list === null ? '❌ Không đọc được danh sách' : '✅ Đọc được ' + list.length + ' khách, ví dụ: ' + JSON.stringify(list.slice(0, 3)));
  gptKeyEmails_().forEach(function (e) {
    Logger.log('🔑 ' + e + ' — mã hiện tại: ' + totp_(PropertiesService.getScriptProperties().getProperty('TOTP_' + e), Date.now()).code);
  });
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

// ── Khoá 2FA theo từng tài khoản ChatGPT (nhiều email). Thêm / đổi / xoá ở admin/chatgpt.html → nút "Khoá 2FA".
// Lưu ở Script Properties: TOTP_<email>. Không bao giờ trả khoá ra ngoài, chỉ trả danh sách email + mã hiện tại để đối chiếu.
function gptKeyEmails_() {
  return Object.keys(PropertiesService.getScriptProperties().getProperties())
    .filter(function (k) { return k.indexOf('TOTP_') === 0; }).map(function (k) { return k.slice(5); }).sort();
}

function gptKeySet_(emailRaw, secretRaw) {
  var email = String(emailRaw || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Email không hợp lệ' };
  var props = PropertiesService.getScriptProperties();
  var secret = String(secretRaw || '').replace(/[\s-]/g, '').toUpperCase();
  if (!secret) { props.deleteProperty('TOTP_' + email); log_(email, 'gpt xoá khoá 2FA', 0); return { ok: true, deleted: true, emails: gptKeyEmails_() }; }
  if (!/^[A-Z2-7]+=*$/.test(secret) || secret.replace(/=/g, '').length < 16) return { ok: false, message: 'Khoá 2FA không đúng dạng (chữ A–Z và số 2–7, tối thiểu 16 ký tự)' };
  props.setProperty('TOTP_' + email, secret.replace(/=/g, ''));
  log_(email, 'gpt lưu khoá 2FA', 0);
  return { ok: true, code: totp_(secret, Date.now()).code, emails: gptKeyEmails_() };
}

// ───────────────────────── tiện ích ─────────────────────────

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s))
    .map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}
