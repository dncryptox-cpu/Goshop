/**
 * GOOGLE APPS SCRIPT API - QUẢN LÝ THIẾT BỊ CHATGPT (ThietbiGPT)
 * Spreadsheet: File DATA hiện tại -> Tab "ThietbiGPT"
 * Secret API Key: c74391ab-gpt-sec-2026
 */

var SHEET_NAME = 'ThietbiGPT';
var SECRET_TOKEN = 'c74391ab-gpt-sec-2026';

var HEADERS = [
  'ID',                           // A
  'Email khách hàng',            // B
  'Mã đơn',                      // C
  'Loại đơn (Đơn tay/Mã đơn)',   // D
  'Thiết bị (Computer/Mobile)',  // E
  'Hệ điều hành',                // F
  'Ứng dụng (ChatGPT Web/App)',  // G
  'Địa điểm',                    // H
  'Gói mua',                     // I
  'Thời hạn gói (số tháng)',    // J
  'Ngày kích hoạt',              // K
  'HSD',                         // L
  'Trạng thái',                  // M
  'Còn lại (ngày)',              // N
  'CTV phụ trách',               // O
  'Giá bán',                     // P
  'Ghi chú',                     // Q
  'Nguồn tạo (Webapp/Nhập tay)',// R
  'Ngày tạo record'              // S
];

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#EBF3FE');
  }
  return sheet;
}

function parseDateStr(str) {
  if (!str) return null;
  var s = String(str).trim();
  // Format DD/MM/YYYY
  var p = s.split('/');
  if (p.length === 3) {
    var d = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) - 1;
    var y = parseInt(p[2], 10);
    return new Date(y, m, d, 23, 59, 59);
  }
  // Format YYYY-MM-DD
  p = s.split('-');
  if (p.length === 3) {
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) - 1;
    var d = parseInt(p[2], 10);
    return new Date(y, m, d, 23, 59, 59);
  }
  return null;
}

function formatDate(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  var d = ('0' + dateObj.getDate()).slice(-2);
  var m = ('0' + (dateObj.getMonth() + 1)).slice(-2);
  var y = dateObj.getFullYear();
  return d + '/' + m + '/' + y;
}

function calculateExpiry(actDateStr, months) {
  var actDate = parseDateStr(actDateStr);
  if (!actDate) return '';
  var m = parseInt(months, 10) || 1;
  var expDate = new Date(actDate.getTime());
  expDate.setMonth(expDate.getMonth() + m);
  return formatDate(expDate);
}

function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var sheet = getOrCreateSheet();
    var data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return responseJSON({ success: true, count: 0, data: [] });
    }

    var rows = data.slice(1);
    var today = new Date();
    today.setHours(23, 59, 59, 0);

    var result = rows.map(function(r, idx) {
      var id = String(r[0] || '').trim();
      var email = String(r[1] || '').trim();
      var orderId = String(r[2] || '').trim();
      var orderType = String(r[3] || 'Đơn tay').trim();
      var device = String(r[4] || 'Computer').trim();
      var os = String(r[5] || '').trim();
      var app = String(r[6] || 'ChatGPT Web').trim();
      var location = String(r[7] || '').trim();
      var product = String(r[8] || 'GPTshare').trim();
      var duration = parseInt(r[9]) || 1;
      var activationDate = String(r[10] || '').trim();
      var expiryDate = String(r[11] || '').trim();
      var ctv = String(r[14] || 'Dnc').trim();
      var price = parseFloat(r[15]) || 0;
      var note = String(r[16] || '').trim();
      var source = String(r[17] || 'Webapp').trim();
      var createdAt = String(r[18] || '').trim();

      var expObj = parseDateStr(expiryDate);
      var daysLeft = expObj ? Math.floor((expObj.getTime() - today.getTime()) / 86400000) : 0;
      var expired = daysLeft < 0;
      var status = expired ? 'Expired' : 'Active';

      return {
        rowNum: idx + 2,
        id: id,
        email: email,
        orderId: orderId,
        orderType: orderType,
        device: device,
        os: os,
        app: app,
        location: location,
        product: product,
        duration: duration,
        activationDate: activationDate,
        expiryDate: expiryDate,
        status: status,
        daysLeft: daysLeft,
        ctv: ctv,
        price: price,
        note: note,
        source: source,
        createdAt: createdAt,
        expired: expired
      };
    });

    var statusFilter = params.status;
    if (statusFilter === 'active') {
      result = result.filter(function(i) { return !i.expired; });
    } else if (statusFilter === 'expired') {
      result = result.filter(function(i) { return i.expired; });
    }

    var query = (params.q || '').toLowerCase().trim();
    if (query) {
      result = result.filter(function(i) {
        return (i.email + i.orderId + i.product + i.note + i.ctv + i.device).toLowerCase().indexOf(query) !== -1;
      });
    }

    return responseJSON({
      success: true,
      count: result.length,
      data: result
    });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    var postData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (err) {
        postData = e.parameter || {};
      }
    } else if (e && e.parameter) {
      postData = e.parameter;
    }

    var token = postData.authToken || postData.token || (e ? e.parameter.token : '');
    if (token !== SECRET_TOKEN) {
      return responseJSON({ success: false, error: 'Unauthorized: Invalid API Token' });
    }

    var email = String(postData.email || '').trim();
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return responseJSON({ success: false, error: 'Email không hợp lệ' });
    }

    var activationDateStr = String(postData.activationDate || formatDate(new Date())).trim();
    var duration = parseInt(postData.duration, 10) || 1;
    var expiryDateStr = calculateExpiry(activationDateStr, duration);

    var expObj = parseDateStr(expiryDateStr);
    var today = new Date();
    today.setHours(23, 59, 59, 0);
    var daysLeft = expObj ? Math.floor((expObj.getTime() - today.getTime()) / 86400000) : 0;
    var status = daysLeft >= 0 ? 'Active' : 'Expired';

    var id = 'GPT-' + Date.now().toString(36).toUpperCase();
    var orderId = String(postData.orderId || '').trim();
    var orderType = orderId ? 'Mã đơn' : 'Đơn tay';
    var device = String(postData.device || 'Computer').trim();
    var os = String(postData.os || 'Windows').trim();
    var app = String(postData.app || 'ChatGPT Web').trim();
    var location = String(postData.location || '').trim();
    var product = String(postData.product || 'GPTshare-' + duration).trim();
    var ctv = String(postData.ctv || 'Dnc').trim();
    var price = parseFloat(postData.price) || 0;
    var note = String(postData.note || '').trim();
    var source = String(postData.source || 'Webapp').trim();
    var createdAt = formatDate(new Date());

    var newRow = [
      id,                 // A: ID
      email,              // B: Email
      orderId,            // C: Mã đơn
      orderType,          // D: Loại đơn
      device,             // E: Thiết bị
      os,                 // F: OS
      app,                // G: App
      location,           // H: Địa điểm
      product,            // I: Gói mua
      duration,           // J: Thời hạn
      activationDateStr,  // K: Ngày kích hoạt
      expiryDateStr,      // L: HSD
      status,             // M: Trạng thái
      daysLeft,           // N: Còn lại
      ctv,                // O: CTV
      price,              // P: Giá
      note,               // Q: Ghi chú
      source,             // R: Nguồn
      createdAt           // S: Ngày tạo
    ];

    var sheet = getOrCreateSheet();
    sheet.appendRow(newRow);

    return responseJSON({
      success: true,
      id: id,
      message: 'Tạo record thành công',
      data: {
        id: id,
        email: email,
        orderId: orderId,
        expiryDate: expiryDateStr,
        status: status,
        daysLeft: daysLeft
      }
    });

  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
