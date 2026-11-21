/**
 * GOOGLE APPS SCRIPT API - TỔNG HỢP QUẢN LÝ SẢN PHẨM KHÁC (sanphamkhac_ DATA)
 * Spreadsheet Name: sanphamkhac_ DATA
 * Spreadsheet ID: 1-EgeNWztGQsY2rmLYp00yKDjgHR5WYoqzzhAkSnvJjc
 * Secret API Key: c74391ab-gpt-sec-2026
 * 
 * Hỗ trợ tất cả các Tab sản phẩm trong file sanphamkhac_ DATA:
 *   1. 'ThietbiGPT'     (Tab module ChatGPT - 19 Cột A:S)
 *   2. 'Netflix'        (Tab module Netflix - 16 Cột A:P)
 *   3. 'GoogleOne'      (Tab module Google One 2TB - 16 Cột A:P)
 *   4. 'Spotify'        (Tab module Spotify Premium Family - 16 Cột A:P)
 *   5. 'GoogleOne_ChuTK'(Tab Tài Khoản Chủ Google One - 8 Cột A:H)
 *   6. 'Netflix_ChuTK'  (Tab Tài Khoản Chủ Netflix - 8 Cột A:H)
 */

var SPREADSHEET_ID = '1-EgeNWztGQsY2rmLYp00yKDjgHR5WYoqzzhAkSnvJjc';
var SECRET_TOKEN = 'c74391ab-gpt-sec-2026';

var HEADERS_CHATGPT = [
  'ID',              // A
  'Mã KH',           // B: mã khách dùng ở godnc.com/vgpt (bắt buộc)
  'Tên khách',       // C
  'Email TK ChatGPT',// D: tài khoản ChatGPT dùng chung
  'Máy số',          // E: 1-3
  'Thiết bị',        // F: mô tả ngắn, vd "Macbook · Gò Vấp"
  'Ngày mua',        // G: dd/MM/yyyy
  'Số tháng',        // H
  'HSD',             // I: dd/MM/yyyy
  'CTV',             // J
  'Giá bán',         // K
  'Ghi chú',         // L
  'Trạng thái'       // M: trống = đang dùng, "Huỷ" = đã xoá (không xoá dòng)
];
var GPT_COL = { id: 0, code: 1, name: 2, email: 3, seq: 4, device: 5, act: 6, dur: 7, exp: 8, ctv: 9, price: 10, note: 11, status: 12 };

var HEADERS_FAMILY_PLAN = [
  'ID',                           // A: ID
  'Tài khoản chủ gói (Email gốc)',// B: Email gốc (Host Email)
  'Tên khách hàng',               // C: Tên khách hàng (Profile / Member)
  'Mã khách hàng',                // D: Mã KH (User Code)
  'Số thứ tự slot (1-5)',         // E: STT Slot / Profile (1-5)
  'Gói mua',                      // F: Gói mua
  'Ngày mua/kích hoạt',           // G: Ngày mua (DD/MM/YYYY)
  'Số tháng',                     // H: Số tháng (Duration)
  'HSD',                          // I: Expiry Date (DD/MM/YYYY)
  'Trạng thái',                   // J: Active/Expired
  'Còn lại (ngày)',               // K: Days left
  'CTV phụ trách',                // L: CTV
  'Giá bán',                      // M: Giá bán (VND)
  'Ghi chú',                      // N: Raw note (không sửa encoding)
  'Nguồn tạo',                    // O: Nguồn tạo (AI/Nhập tay)
  'Ngày tạo record'               // P: Ngày tạo record
];

var HEADERS_OWNER_ACCOUNT = [
  'ID',                           // A: ID
  'Email đăng nhập (chủ gói)',   // B: Email chủ gói
  'Mật khẩu',                    // C: Mật khẩu
  'Mã khôi phục/Backup codes',   // D: Mã khôi phục
  'Email khôi phục phụ',         // E: Email khôi phục phụ
  'TOTP Secret Key',             // F: TOTP Secret Key (Base32)
  'Ghi chú',                     // G: Ghi chú
  'Ngày tạo record'              // H: Ngày tạo record
];

function getOrCreateSheet(sheetName, headersArr) {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch(e) {}

  if (!ss) {
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch(err) {}
  }

  if (!ss) {
    throw new Error('Không thể kết nối đến Spreadsheet: sanphamkhac_ DATA (ID: ' + SPREADSHEET_ID + ')');
  }

  var name = sheetName || 'ThietbiGPT';
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  var headers = headersArr;
  if (!headers) {
    if (name.indexOf('_ChuTK') !== -1) {
      headers = HEADERS_OWNER_ACCOUNT;
    } else if (name === 'ThietbiGPT') {
      headers = HEADERS_CHATGPT;
    } else {
      headers = HEADERS_FAMILY_PLAN;
    }
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#EBF3FE');
  }
  return sheet;
}

function testInitSheet() {
  var s1 = getOrCreateSheet('ThietbiGPT', HEADERS_CHATGPT);
  var s2 = getOrCreateSheet('Netflix', HEADERS_FAMILY_PLAN);
  var s3 = getOrCreateSheet('GoogleOne', HEADERS_FAMILY_PLAN);
  var s4 = getOrCreateSheet('Spotify', HEADERS_FAMILY_PLAN);
  var s5 = getOrCreateSheet('GoogleOne_ChuTK', HEADERS_OWNER_ACCOUNT);
  var s6 = getOrCreateSheet('Netflix_ChuTK', HEADERS_OWNER_ACCOUNT);
  Logger.log("✅ Đã kết nối thành công 6 tab: " + s1.getName() + ", " + s2.getName() + ", " + s3.getName() + ", " + s4.getName() + ", " + s5.getName() + ", " + s6.getName());
}

function testInitAllSheets() {
  return testInitSheet();
}

// Robust Date Parser
function parseDateStr(input) {
  if (!input) return null;
  if (Object.prototype.toString.call(input) === '[object Date]' && !isNaN(input.getTime())) {
    return input;
  }

  var s = String(input).trim();
  if (!s) return null;

  var p = s.split('/');
  if (p.length === 3) {
    var day = parseInt(p[0], 10);
    var month = parseInt(p[1], 10) - 1;
    var year = parseInt(p[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day, 23, 59, 59);
    }
  }

  p = s.split('-');
  if (p.length === 3 && p[0].length === 4) {
    var year = parseInt(p[0], 10);
    var month = parseInt(p[1], 10) - 1;
    var day = parseInt(p[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day, 23, 59, 59);
    }
  }

  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    d.setHours(23, 59, 59, 0);
    return d;
  }
  return null;
}

// Clean Date Formatter (DD/MM/YYYY)
function formatDate(input) {
  var d = parseDateStr(input);
  if (!d) return String(input || '');
  var day = ('0' + d.getDate()).slice(-2);
  var mon = ('0' + (d.getMonth() + 1)).slice(-2);
  var yr = d.getFullYear();
  return day + '/' + mon + '/' + yr;
}

function calculateExpiry(actDateStr, months) {
  var actDate = parseDateStr(actDateStr);
  if (!actDate) return '';
  var m = parseInt(months, 10) || 1;
  var expDate = new Date(actDate.getTime());
  expDate.setMonth(expDate.getMonth() + m);
  return formatDate(expDate);
}

function calculateDaysLeft(expiryInput) {
  var expObj = parseDateStr(expiryInput);
  if (!expObj) return 0;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var expMid = new Date(expObj.getFullYear(), expObj.getMonth(), expObj.getDate());
  var diffTime = expMid.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function countActiveSlotsForHost(sheet, hostEmail) {
  if (!hostEmail) return 0;
  var email = String(hostEmail).toLowerCase().trim();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 0;
  
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var rEmail = String(r[1] || '').toLowerCase().trim();
    if (rEmail === email) {
      var expStr = formatDate(r[8]);
      if (calculateDaysLeft(expStr) >= 0) count++;
    }
  }
  return count;
}

function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var module = String(params.module || params.tab || params.sheet || '').toLowerCase().trim();
    var action = String(params.action || params.type || '').toLowerCase().trim();

    // =========================================================================
    // ACTION: READ MASTER OWNER ACCOUNTS ('get_owner_accounts')
    // =========================================================================
    if (action === 'get_owner_accounts' || action === 'owner_accounts') {
      var ownerTabName = 'GoogleOne_ChuTK';
      if (module === 'netflix') ownerTabName = 'Netflix_ChuTK';
      
      var ownerSheet = getOrCreateSheet(ownerTabName, HEADERS_OWNER_ACCOUNT);
      var ownerData = ownerSheet.getDataRange().getValues();
      if (ownerData.length <= 1) {
        return responseJSON({ success: true, count: 0, data: [] });
      }

      var ownerRows = ownerData.slice(1);
      var ownerList = ownerRows.map(function(r, idx) {
        return {
          rowNum: idx + 2,
          id: String(r[0] || '').trim() || ('OWNER-' + (idx + 1)),
          email: String(r[1] || '').trim(),
          rootEmail: String(r[1] || '').trim(),
          password: String(r[2] || '').trim(),
          backupCodes: String(r[3] || '').trim(),
          recoveryEmail: String(r[4] || '').trim(),
          totpSecret: String(r[5] || '').trim(),
          note: String(r[6] || '').trim(),
          createdAt: formatDate(r[7])
        };
      });

      return responseJSON({ success: true, count: ownerList.length, data: ownerList });
    }

    // =========================================================================
    // MODULE: NETFLIX / GOOGLE ONE / SPOTIFY (Family Plan 16 Columns A:P)
    // =========================================================================
    if (module === 'netflix' || module === 'googleone' || module === 'spotify') {
      var tabName = 'Netflix';
      var defaultPkg = 'Netflix-Premium';
      var idPrefix = 'NFLX-';
      
      if (module === 'googleone') {
        tabName = 'GoogleOne';
        defaultPkg = 'GoogleOne-2TB';
        idPrefix = 'G1-';
      } else if (module === 'spotify') {
        tabName = 'Spotify';
        defaultPkg = 'Spotify-Family';
        idPrefix = 'SPOT-';
      }

      var sheetFam = getOrCreateSheet(tabName, HEADERS_FAMILY_PLAN);
      var dataFam = sheetFam.getDataRange().getValues();

      if (dataFam.length <= 1) {
        return responseJSON({ success: true, count: 0, data: [] });
      }

      var rowsFam = dataFam.slice(1);
      var resultFam = rowsFam.map(function(r, idx) {
        var id = String(r[0] || '').trim();
        var rootEmail = String(r[1] || '').trim();
        var userName = String(r[2] || '').trim();
        var userCode = String(r[3] || '').trim();
        var slotSeq = parseInt(r[4], 10) || 1;
        var product = String(r[5] || defaultPkg).trim();
        var activationDate = formatDate(r[6]);
        var duration = parseInt(r[7], 10) || 1;
        var expiryDate = formatDate(r[8]);
        if (!expiryDate && activationDate) {
          expiryDate = calculateExpiry(activationDate, duration);
        }
        var daysLeft = calculateDaysLeft(expiryDate || r[8]);
        var expired = daysLeft < 0;
        var status = expired ? 'Expired' : 'Active';
        var ctv = String(r[11] || 'Dnc').trim();
        var price = parseFloat(r[12]) || 0;
        var note = String(r[13] || '').trim();
        var source = String(r[14] || 'Webapp').trim();
        var createdAt = formatDate(r[15]);

        return {
          rowNum: idx + 2,
          id: id || (idPrefix + (idx + 1)),
          email: rootEmail,
          rootEmail: rootEmail,
          userName: userName,
          userCode: userCode,
          slotSeq: slotSeq,
          profileSeq: slotSeq,
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

      var statusFilterFam = params.status;
      if (statusFilterFam === 'active') {
        resultFam = resultFam.filter(function(i) { return !i.expired; });
      } else if (statusFilterFam === 'expired') {
        resultFam = resultFam.filter(function(i) { return i.expired; });
      }

      var qFam = String(params.q || params.search || '').toLowerCase().trim();
      if (qFam) {
        resultFam = resultFam.filter(function(i) {
          return (i.rootEmail + i.userName + i.userCode + i.product + i.note + i.ctv).toLowerCase().indexOf(qFam) !== -1;
        });
      }

      return responseJSON({ success: true, count: resultFam.length, data: resultFam });
    }

    // =====================================================================
    // DEFAULT MODULE: CHATGPT (Tab 'ThietbiGPT' - 13 cột A:M)
    // =====================================================================
    var rowsGpt = gptRows_();
    var resultGpt = rowsGpt.filter(function (o) { return !gptCancelled_(o.status); }).map(gptToJson_);
    var qGpt = String(params.q || params.search || '').toLowerCase().trim();
    if (qGpt) {
      resultGpt = resultGpt.filter(function (i) {
        return (i.userCode + ' ' + i.userName + ' ' + i.email + ' ' + i.device + ' ' + i.note + ' ' + i.ctv).toLowerCase().indexOf(qGpt) !== -1;
      });
    }
    return responseJSON({ success: true, count: resultGpt.length, data: resultGpt });

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

    var module = String(postData.module || postData.tab || postData.sheet || '').toLowerCase().trim();
    var action = String(postData.action || '').toLowerCase().trim();
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    // =========================================================================
    // ACTION: SAVE / EDIT OWNER ACCOUNT ('save_owner_account')
    // =========================================================================
    if (action === 'save_owner_account') {
      var ownerTabName = (module === 'netflix') ? 'Netflix_ChuTK' : 'GoogleOne_ChuTK';
      var ownerSheet = getOrCreateSheet(ownerTabName, HEADERS_OWNER_ACCOUNT);
      var ownerData = ownerSheet.getDataRange().getValues();

      var email = String(postData.email || postData.rootEmail || '').trim();
      var password = String(postData.password || '').trim();
      var backupCodes = String(postData.backupCodes || '').trim();
      var recoveryEmail = String(postData.recoveryEmail || '').trim();
      var totpSecret = String(postData.totpSecret || '').trim();
      var note = String(postData.note || '').trim();

      if (!email) {
        return responseJSON({ success: false, error: 'Email chủ gói không được để trống' });
      }

      var targetIndex = -1;
      var targetId = String(postData.id || '').trim();
      if (targetId) {
        for (var r = 1; r < ownerData.length; r++) {
          if (String(ownerData[r][0]).trim() === targetId) {
            targetIndex = r + 1;
            break;
          }
        }
      }

      if (targetIndex === -1) {
        for (var r2 = 1; r2 < ownerData.length; r2++) {
          if (String(ownerData[r2][1]).toLowerCase().trim() === email.toLowerCase()) {
            targetIndex = r2 + 1;
            break;
          }
        }
      }

      if (targetIndex > 1) {
        // Update existing owner account
        ownerSheet.getRange(targetIndex, 2).setValue(email);
        ownerSheet.getRange(targetIndex, 3).setValue(password);
        ownerSheet.getRange(targetIndex, 4).setValue(backupCodes);
        ownerSheet.getRange(targetIndex, 5).setValue(recoveryEmail);
        ownerSheet.getRange(targetIndex, 6).setValue(totpSecret);
        ownerSheet.getRange(targetIndex, 7).setValue(note);
        return responseJSON({ success: true, message: 'Đã cập nhật tài khoản chủ gói ' + email });
      } else {
        // Append new owner account
        var recId = 'OWNER-' + Date.now().toString(36).toUpperCase();
        var newOwnerRow = [
          recId, email, password, backupCodes, recoveryEmail, totpSecret, note, formatDate(new Date())
        ];
        ownerSheet.appendRow(newOwnerRow);
        return responseJSON({ success: true, id: recId, message: 'Thêm tài khoản chủ gói mới thành công' });
      }
    }

    // =========================================================================
    // ACTION: DELETE OWNER ACCOUNT ('delete_owner_account')
    // =========================================================================
    if (action === 'delete_owner_account') {
      var ownerTabName = (module === 'netflix') ? 'Netflix_ChuTK' : 'GoogleOne_ChuTK';
      var ownerSheet = getOrCreateSheet(ownerTabName, HEADERS_OWNER_ACCOUNT);
      var ownerData = ownerSheet.getDataRange().getValues();
      var targetId = String(postData.id || '').trim();
      var rowNum = parseInt(postData.rowNum, 10);

      var targetRowIndex = -1;
      if (rowNum && rowNum > 1 && rowNum <= ownerData.length) {
        targetRowIndex = rowNum;
      } else if (targetId) {
        for (var r = 1; r < ownerData.length; r++) {
          if (String(ownerData[r][0]).trim() === targetId) {
            targetRowIndex = r + 1;
            break;
          }
        }
      }

      if (targetRowIndex > 1) {
        ownerSheet.deleteRow(targetRowIndex);
        return responseJSON({ success: true, message: 'Đã xóa tài khoản chủ gói dòng ' + targetRowIndex });
      } else {
        return responseJSON({ success: false, error: 'Không tìm thấy tài khoản chủ gói để xóa' });
      }
    }

    // =========================================================================
    // ROUTE TO FAMILY PLAN MODULES: NETFLIX / GOOGLE ONE / SPOTIFY
    // =========================================================================
    if (module === 'netflix' || module === 'googleone' || module === 'spotify') {
      var tabName = 'Netflix';
      var defaultPkg = 'Netflix-Premium';
      var idPrefix = 'NFLX-';
      var defaultEmail = 'dncnetflx@gmail.com';
      
      if (module === 'googleone') {
        tabName = 'GoogleOne';
        defaultPkg = 'GoogleOne-2TB';
        idPrefix = 'G1-';
        defaultEmail = 'g1master@gmail.com';
      } else if (module === 'spotify') {
        tabName = 'Spotify';
        defaultPkg = 'Spotify-Family';
        idPrefix = 'SPOT-';
        defaultEmail = 'spotmaster@gmail.com';
      }

      var sheetFam = getOrCreateSheet(tabName, HEADERS_FAMILY_PLAN);

      // AI Batch Insert for Family Plan
      if (action === 'batch_insert') {
        var recordsFam = postData.records || [];
        if (!Array.isArray(recordsFam) || recordsFam.length === 0) {
          return responseJSON({ success: false, error: 'Danh sách records rỗng' });
        }

        var rowsToAddFam = [];
        var warningsFam = [];
        var defaultRootFam = String(postData.rootEmail || postData.email || defaultEmail).trim();

        for (var i = 0; i < recordsFam.length; i++) {
          var itemF = recordsFam[i];
          var itemRootF = String(itemF.rootEmail || itemF.email || defaultRootFam).trim();

          var recIdF = idPrefix + Date.now().toString(36).toUpperCase() + '-' + (i + 1);
          var recUserNameF = String(itemF.userName || 'Thành Viên').trim();
          var recUserCodeF = String(itemF.userCode || ('KH-' + idPrefix + '01')).trim();
          var recSlotSeqF = parseInt(itemF.slotSeq || itemF.profileSeq || itemF.deviceSeq, 10) || 1;
          var recActDateF = formatDate(itemF.activationDate || new Date());
          var recDurationF = parseInt(itemF.duration, 10) || 3;
          var recExpDateF = formatDate(itemF.expiryDate || calculateExpiry(recActDateF, recDurationF));

          var daysLeftF = calculateDaysLeft(recExpDateF);
          var statusF = daysLeftF >= 0 ? 'Active' : 'Expired';
          var rawNoteF = String(itemF.note || '').trim();
          var itemPriceF = itemF.price !== undefined && itemF.price !== null ? parseFloat(itemF.price) : 0;

          // Check ≥5 Active Slots Warning
          var activeCountF = countActiveSlotsForHost(sheetFam, itemRootF);
          if (activeCountF >= 5) {
            warningsFam.push('Cảnh báo: Tài khoản ' + itemRootF + ' đã có ' + activeCountF + '/5 Slot Active!');
          }

          var rowBatchF = [
            recIdF, itemRootF, recUserNameF, recUserCodeF, recSlotSeqF,
            itemF.product || defaultPkg, recActDateF, recDurationF, recExpDateF,
            statusF, daysLeftF, itemF.ctv || 'Dnc', itemPriceF, rawNoteF, itemF.source || 'Dán Nhanh AI', formatDate(new Date())
          ];
          rowsToAddFam.push(rowBatchF);
        }

        if (rowsToAddFam.length > 0) {
          var lastRowF = sheetFam.getLastRow();
          sheetFam.getRange(lastRowF + 1, 1, rowsToAddFam.length, rowsToAddFam[0].length).setValues(rowsToAddFam);
        }

        return responseJSON({
          success: true,
          count: rowsToAddFam.length,
          message: 'Đã lưu thành công ' + rowsToAddFam.length + ' record ' + tabName + ' vào sheet!',
          warnings: warningsFam
        });
      }

      // Inline Edit Update for Family Plan
      if (action === 'update') {
        var rowNumF = parseInt(postData.rowNum, 10);
        var targetIdF = String(postData.id || '').trim();
        var dataAllF = sheetFam.getDataRange().getValues();
        var targetRowIndexF = -1;

        if (rowNumF && rowNumF > 1 && rowNumF <= dataAllF.length) {
          targetRowIndexF = rowNumF;
        } else if (targetIdF) {
          for (var rn = 1; rn < dataAllF.length; rn++) {
            if (String(dataAllF[rn][0]).trim() === targetIdF) {
              targetRowIndexF = rn + 1;
              break;
            }
          }
        }

        if (targetRowIndexF === -1) {
          return responseJSON({ success: false, error: 'Không tìm thấy dòng tương ứng trên Sheet ' + tabName });
        }

        var updActDateF = formatDate(postData.activationDate);
        var updDurationF = parseInt(postData.duration, 10) || 1;
        var updExpDateF = formatDate(calculateExpiry(updActDateF, updDurationF));
        var updDaysLeftF = calculateDaysLeft(updExpDateF);
        var updStatusF = updDaysLeftF >= 0 ? 'Active' : 'Expired';

        sheetFam.getRange(targetRowIndexF, 7).setValue(updActDateF);
        sheetFam.getRange(targetRowIndexF, 8).setValue(updDurationF);
        sheetFam.getRange(targetRowIndexF, 9).setValue(updExpDateF);
        sheetFam.getRange(targetRowIndexF, 10).setValue(updStatusF);
        sheetFam.getRange(targetRowIndexF, 11).setValue(updDaysLeftF);

        if (postData.price !== undefined) sheetFam.getRange(targetRowIndexF, 13).setValue(parseFloat(postData.price));
        if (postData.note !== undefined) sheetFam.getRange(targetRowIndexF, 14).setValue(postData.note);

        return responseJSON({ success: true, message: 'Đã cập nhật dòng ' + targetRowIndexF + ' tab ' + tabName + ' thành công' });
      }

      // Xoá khách (giải phóng slot) — tìm theo ID cột A; dòng không có ID thì theo rowNum + khớp Mã KH cột D
      if (action === 'delete') {
        var lockD = LockService.getScriptLock();
        lockD.waitLock(15000);
        try {
          var dataDel = sheetFam.getDataRange().getValues();
          var delId = String(postData.id || '').trim();
          var delCode = String(postData.userCode || '').trim().toLowerCase();
          var delRow = -1;
          for (var dr = 1; dr < dataDel.length && delId; dr++) {
            if (String(dataDel[dr][0]).trim() === delId) { delRow = dr + 1; break; }
          }
          if (delRow === -1) {
            var rnD = parseInt(postData.rowNum, 10);
            if (rnD > 1 && rnD <= dataDel.length && String(dataDel[rnD - 1][3] || '').trim().toLowerCase() === delCode) delRow = rnD;
          }
          if (delRow === -1) return responseJSON({ success: false, error: 'Không tìm thấy khách để xoá (có thể đã xoá rồi — bấm Làm mới)' });
          sheetFam.deleteRow(delRow);
          return responseJSON({ success: true, message: 'Đã xoá dòng ' + delRow + ' tab ' + tabName });
        } finally {
          lockD.releaseLock();
        }
      }

      // Action lạ → báo lỗi, KHÔNG được rơi xuống thêm dòng mới
      if (action && action !== 'insert' && action !== 'add') {
        return responseJSON({ success: false, error: 'Action không hỗ trợ: ' + action });
      }

      // Single Insert for Family Plan
      var rootEmailF = String(postData.rootEmail || postData.email || defaultEmail).trim();
      var actDateSingleF = formatDate(postData.activationDate || new Date());
      var durSingleF = parseInt(postData.duration, 10) || 1;
      var expDateSingleF = formatDate(calculateExpiry(actDateSingleF, durSingleF));
      var daysLeftSingleF = calculateDaysLeft(expDateSingleF);
      var statusSingleF = daysLeftSingleF >= 0 ? 'Active' : 'Expired';
      var singleIdF = idPrefix + Date.now().toString(36).toUpperCase();
      var singlePriceF = postData.price !== undefined && postData.price !== null ? parseFloat(postData.price) : 0;

      var newRowF = [
        singleIdF, rootEmailF, String(postData.userName || 'Thành Viên').trim(),
        String(postData.userCode || ('KH-' + idPrefix + '01')).trim(), parseInt(postData.slotSeq || postData.profileSeq, 10) || 1,
        String(postData.product || defaultPkg).trim(), actDateSingleF, durSingleF, expDateSingleF,
        statusSingleF, daysLeftSingleF, String(postData.ctv || 'Dnc').trim(), singlePriceF,
        String(postData.note || '').trim(), String(postData.source || 'Nhập tay').trim(), formatDate(new Date())
      ];
      sheetFam.appendRow(newRowF);

      return responseJSON({ success: true, id: singleIdF, message: 'Tạo record ' + tabName + ' thành công' });
    }

    // =====================================================================
    // ROUTE TO MODULE CHATGPT (Tab 'ThietbiGPT' - 13 cột A:M)
    // =====================================================================
    var lockG = LockService.getScriptLock();
    lockG.waitLock(15000);
    try {
      if (action === 'batch_insert') {
        var recs = postData.records || [];
        if (!recs.length) return responseJSON({ success: false, error: 'Không có record nào' });
        var errB = gptCheckCodes_(recs);
        if (errB) return responseJSON({ success: false, error: errB });
        var ids = recs.map(function (r) { return gptInsert_(r, postData); });
        return responseJSON({ success: true, count: ids.length, ids: ids, message: 'Đã lưu ' + ids.length + ' máy' });
      }

      if (action === 'update') {
        var o = gptFind_(postData.id, postData.rowNum);
        if (!o) return responseJSON({ success: false, error: 'Không tìm thấy máy này trên Sheet ThietbiGPT' });
        var sh = gptSheet_(), row = o.raw.slice();
        if (postData.userCode !== undefined) {
          if (!String(postData.userCode).trim()) return responseJSON({ success: false, error: 'Mã KH không được để trống' });
          row[GPT_COL.code] = String(postData.userCode).trim();
        }
        if (postData.userName !== undefined) row[GPT_COL.name] = String(postData.userName).trim();
        if (postData.deviceSeq !== undefined) row[GPT_COL.seq] = parseInt(postData.deviceSeq, 10) || 1;
        if (postData.device !== undefined) row[GPT_COL.device] = String(postData.device).trim();
        if (postData.ctv !== undefined) row[GPT_COL.ctv] = String(postData.ctv).trim();
        if (postData.price !== undefined) row[GPT_COL.price] = parseFloat(postData.price) || 0;
        if (postData.note !== undefined) row[GPT_COL.note] = String(postData.note).trim();
        var actChanged = postData.activationDate !== undefined || postData.duration !== undefined;
        if (postData.activationDate !== undefined) row[GPT_COL.act] = formatDate(postData.activationDate);
        if (postData.duration !== undefined) row[GPT_COL.dur] = parseInt(postData.duration, 10) || 1;
        if (postData.expiryDate) row[GPT_COL.exp] = formatDate(postData.expiryDate);          // gia hạn: gửi thẳng HSD mới
        else if (actChanged) row[GPT_COL.exp] = formatDate(calculateExpiry(formatDate(row[GPT_COL.act]), parseInt(row[GPT_COL.dur], 10) || 1));
        row[GPT_COL.act] = formatDate(row[GPT_COL.act]);
        sh.getRange(o.rowNum, 1, 1, HEADERS_CHATGPT.length).setValues([row]);
        return responseJSON({ success: true, data: gptToJson_(gptParse_(row, o.rowNum)) });
      }

      if (action === 'delete') {
        var od = gptFind_(postData.id, postData.rowNum);
        if (!od) return responseJSON({ success: false, error: 'Không tìm thấy máy này' });
        gptSheet_().getRange(od.rowNum, GPT_COL.status + 1).setValue(postData.restore ? '' : 'Huỷ');
        return responseJSON({ success: true, id: od.id });
      }

      // Thêm 1 máy (mặc định khi không có action / action = insert)
      var errS = gptCheckCodes_([postData]);
      if (errS) return responseJSON({ success: false, error: errS });
      var newId = gptInsert_(postData, postData);
      return responseJSON({ success: true, id: newId, message: 'Đã thêm máy' });
    } finally {
      lockG.releaseLock();
    }

  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ───────────────────────── ChatGPT helpers ─────────────────────────
function gptCancelled_(s) { return /^(huỷ|hủy|huy|đã huỷ|đã hủy)$/i.test(String(s || '').trim()); }

function gptSheet_() {
  var sh = getOrCreateSheet('ThietbiGPT', HEADERS_CHATGPT);
  var head = sh.getRange(1, 1, 1, 2).getValues()[0];
  if (String(head[1]).trim() !== 'Mã KH') throw new Error('Tab ThietbiGPT chưa ở cấu trúc mới — chạy migrateThietbiGPT() trước.');
  return sh;
}

function gptParse_(r, rowNum) {
  return {
    rowNum: rowNum, raw: r,
    id: String(r[GPT_COL.id] || '').trim(),
    code: String(r[GPT_COL.code] || '').trim(),
    name: String(r[GPT_COL.name] || '').trim(),
    email: String(r[GPT_COL.email] || '').trim(),
    seq: parseInt(r[GPT_COL.seq], 10) || 1,
    device: String(r[GPT_COL.device] || '').trim(),
    act: formatDate(r[GPT_COL.act]),
    dur: parseInt(r[GPT_COL.dur], 10) || 1,
    exp: formatDate(r[GPT_COL.exp]),
    ctv: String(r[GPT_COL.ctv] || 'Dnc').trim(),
    price: parseFloat(r[GPT_COL.price]) || 0,
    note: String(r[GPT_COL.note] || '').trim(),
    status: String(r[GPT_COL.status] || '').trim()
  };
}

function gptRows_() {
  var sh = gptSheet_(), data = sh.getDataRange().getValues(), out = [];
  for (var i = 1; i < data.length; i++) {
    while (data[i].length < HEADERS_CHATGPT.length) data[i].push('');
    data[i] = data[i].slice(0, HEADERS_CHATGPT.length);
    if (!String(data[i][GPT_COL.id] || '').trim() && !String(data[i][GPT_COL.code] || '').trim()) continue;
    out.push(gptParse_(data[i], i + 1));
  }
  return out;
}

function gptToJson_(o) {
  var exp = o.exp || (o.act ? calculateExpiry(o.act, o.dur) : '');
  var daysLeft = calculateDaysLeft(exp);
  var expired = daysLeft < 0;
  return {
    rowNum: o.rowNum, id: o.id,
    userCode: o.code, userName: o.name,
    email: o.email, rootEmail: o.email,
    deviceSeq: o.seq, device: o.device,
    activationDate: o.act, duration: o.dur, expiryDate: exp,
    daysLeft: daysLeft, expired: expired, status: expired ? 'Expired' : 'Active',
    product: 'GPTshare', ctv: o.ctv, price: o.price, note: o.note
  };
}

function gptFind_(id, rowNum) {
  var rows = gptRows_(), sid = String(id || '').trim();
  if (sid) { for (var i = 0; i < rows.length; i++) if (rows[i].id === sid) return rows[i]; return null; }
  var rn = parseInt(rowNum, 10);
  for (var j = 0; j < rows.length; j++) if (rows[j].rowNum === rn) return rows[j];
  return null;
}

function gptCheckCodes_(recs) {
  var miss = recs.filter(function (r) { return !String(r.userCode || '').trim(); });
  if (miss.length) return 'Thiếu Mã KH (' + miss.map(function (r) { return r.userName || 'khách mới'; }).join(', ') + ')';
  return '';
}

function gptInsert_(r, base) {
  var sh = gptSheet_();
  var code = String(r.userCode).trim();
  var email = String(r.email || r.rootEmail || base.rootEmail || base.email || '').trim();
  var seq = parseInt(r.deviceSeq, 10);
  if (!seq) {
    var max = 0;
    gptRows_().forEach(function (o) { if (!gptCancelled_(o.status) && o.code.toLowerCase() === code.toLowerCase() && o.seq > max) max = o.seq; });
    seq = max + 1;
  }
  var act = formatDate(r.activationDate || new Date());
  var dur = parseInt(r.duration, 10) || 1;
  var exp = r.expiryDate ? formatDate(r.expiryDate) : formatDate(calculateExpiry(act, dur));
  var id = 'GPT-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);
  sh.appendRow([id, code, String(r.userName || '').trim(), email, seq, String(r.device || '').trim(),
    act, dur, exp, String(r.ctv || 'Dnc').trim(), parseFloat(r.price) || 0, String(r.note || '').trim(), '']);
  Utilities.sleep(2);
  return id;
}

/**
 * Chuyển tab ThietbiGPT cũ (20 cột) sang cấu trúc mới 13 cột. Chạy 1 lần.
 * Tab cũ được đổi tên thành ThietbiGPT_cu (giữ nguyên dữ liệu). Đã có ThietbiGPT_cu thì từ chối chạy.
 */
function migrateThietbiGPT() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
  if (ss.getSheetByName('ThietbiGPT_cu')) throw new Error('Đã có tab ThietbiGPT_cu — đã chuyển rồi, không chạy lại.');
  var old = ss.getSheetByName('ThietbiGPT');
  if (!old) throw new Error('Không thấy tab ThietbiGPT');
  if (String(old.getRange(1, 2).getValue()).trim() === 'Mã KH') throw new Error('ThietbiGPT đã ở cấu trúc mới.');
  var data = old.getDataRange().getValues();
  var rows = [], seqOf = {};
  var parsed = data.slice(1).filter(function (r) { return String(r[0] || '').trim(); }).map(function (r) {
    var note = String(r[16] || '');
    var m = note.match(/\[Khách:\s*([^|]+)\|\s*Mã:\s*([^\]]+)\]/);
    var code = String(r[19] || '').trim() || (m ? m[2].trim() : '');
    var name = (m ? m[1].trim() : '').replace(/\s*(Computer|iPhone|Mac|PC|Android)\s*•\s*\S+/gi, '').trim();
    if (!name || /^(pc|khách mới)$/i.test(name)) name = code;
    return { r: r, code: code, name: name, note: note.replace(/\[Khách:[^\]]*\]\s*/g, '').replace(/\s+/g, ' ').trim(), act: formatDate(r[10]) };
  });
  parsed.sort(function (a, b) { return (parseDateStr(a.act) || 0) - (parseDateStr(b.act) || 0); });
  parsed.forEach(function (p) {
    var k = p.code.toLowerCase();
    seqOf[k] = (seqOf[k] || 0) + 1;
    var r = p.r, dur = parseInt(r[9], 10) || 1;
    rows.push([String(r[0]).trim(), p.code, p.name, String(r[1] || '').trim(), seqOf[k], '',
      p.act, dur, formatDate(r[11]) || formatDate(calculateExpiry(p.act, dur)), String(r[14] || 'Dnc').trim(),
      parseFloat(r[15]) || 0, p.note, '']);
  });
  old.setName('ThietbiGPT_cu');
  var sh = ss.insertSheet('ThietbiGPT', old.getIndex() - 1);
  sh.getRange(1, 1, 1, HEADERS_CHATGPT.length).setValues([HEADERS_CHATGPT]).setFontWeight('bold').setBackground('#EBF3FE');
  sh.setFrozenRows(1);
  sh.getRange('B:B').setNumberFormat('@'); sh.getRange('G:G').setNumberFormat('@'); sh.getRange('I:I').setNumberFormat('@');
  if (rows.length) sh.getRange(2, 1, rows.length, HEADERS_CHATGPT.length).setValues(rows);
  Logger.log('✅ Đã chuyển ' + rows.length + ' máy sang cấu trúc mới. Tab cũ: ThietbiGPT_cu');
  return rows.length;
}