// ========================================================
// DNC TRADING OS — Google Apps Script Backend (Owner Version)
// Deploy cái này trên SHEET CỦA BẠN (DNC) — không phải của khách
//
// Sheet cần có 2 tab:
//   - "Nguoidung"  : cột A = Username, cột B = Password
//   - "Trading Log": tự tạo khi có lệnh đầu tiên
//
// Sau khi Deploy → copy URL → bake vào file index.html (AUTH_URL)
// ========================================================

const LOG_SHEET_NAME   = 'Trading Log';
const USERS_SHEET_NAME = 'Nguoidung';
const DRIVE_FOLDER_NAME = 'DNC Trading Charts';

// ───────────────────────────────────────────────
// GET HANDLER: Dùng cho LOGIN (tránh CORS preflight)
// URL: ?action=login&username=Dnc&password=2026
// ───────────────────────────────────────────────
function doGet(e) {
  const params = e ? (e.parameter || {}) : {};

  if (params.action === 'login') {
    return handleLogin({ username: params.username, password: params.password });
  }
  if (params.action === 'getUserInfo') {
    return handleGetUserInfo({ username: params.username });
  }
  if (params.action === 'getTrades') {
    return handleGetTrades({ username: params.username });
  }

  // Health check
  return jsonResponse({ status: '✅ DNC Trading OS Auth API is running' });
}

// ───────────────────────────────────────────────
// POST HANDLER: Dùng cho SAVE TRADE
// ───────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'saveTrade')      return handleSaveTrade(data);
    if (data.action === 'deleteTrade')    return handleDeleteTrade(data);
    if (data.action === 'saveCapital')    return handleSaveCapital(data);
    if (data.action === 'changePassword') return handleChangePassword(data);
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ───────────────────────────────────────────────
// ACTION: LOGIN — kiểm tra username/password từ tab Nguoidung
// ───────────────────────────────────────────────
function handleLogin(data) {
  const username = (data.username || '').trim();
  const password = (data.password || '').trim();

  if (!username || !password) {
    return jsonResponse({ success: false, error: 'Thiếu username hoặc password' });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!userSheet) {
    return jsonResponse({ success: false, error: 'Không tìm thấy sheet Nguoidung' });
  }

  const rows = userSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rowUser = String(rows[i][0] || '').trim().toLowerCase();
    const rowPass = String(rows[i][1] || '').trim();
    if (rowUser === username.toLowerCase() && rowPass === password) {
      // Cột C = Capital, Cột D = Currency (tuỳ chọn)
      const capital  = Number(rows[i][2]) || null;
      const currency = String(rows[i][3] || 'USD');
      return jsonResponse({
        success: true,
        username: rows[i][0],
        capital:  capital,
        currency: currency
      });
    }
  }

  return jsonResponse({ success: false, error: 'Sai username hoặc mật khẩu' });
}

function handleGetUserInfo(data) {
  const username = (data.username || '').trim();
  if (!username) return jsonResponse({ success: false });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!userSheet) return jsonResponse({ success: false });
  const rows = userSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim().toLowerCase() === username.toLowerCase()) {
      return jsonResponse({
        success: true,
        username: rows[i][0],
        capital: Number(rows[i][2]) || null,
        currency: String(rows[i][3] || 'USD')
      });
    }
  }
  return jsonResponse({ success: false });
}

// ───────────────────────────────────────────────
// ACTION: SAVE CAPITAL — Lưu vốn + currency vào sheet Nguoidung
// ───────────────────────────────────────────────
function handleSaveCapital(data) {
  const username = (data.username || '').trim().toLowerCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!userSheet) return jsonResponse({ success: false, error: 'Sheet Nguoidung không tồn tại' });
  const rows = userSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim().toLowerCase() === username) {
      userSheet.getRange(i + 1, 3).setValue(Number(data.capital) || 0);
      userSheet.getRange(i + 1, 4).setValue(data.currency || 'USD');
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Không tìm thấy user: ' + data.username });
}

// ───────────────────────────────────────────────
// ACTION: CHANGE PASSWORD — đổi mật khẩu, lưu vào Sheet cột B
// ───────────────────────────────────────────────
function handleChangePassword(data) {
  const username    = (data.username    || '').trim().toLowerCase();
  const oldPassword = (data.oldPassword || '').trim();
  const newPassword = (data.newPassword || '').trim();

  if (!username || !oldPassword || !newPassword) {
    return jsonResponse({ success: false, error: 'Thiếu thông tin đổi mật khẩu' });
  }
  if (newPassword.length < 4) {
    return jsonResponse({ success: false, error: 'Mật khẩu mới phải có ít nhất 4 ký tự' });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!userSheet) return jsonResponse({ success: false, error: 'Sheet Nguoidung không tồn tại' });

  const rows = userSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rowUser = String(rows[i][0] || '').trim().toLowerCase();
    const rowPass = String(rows[i][1] || '').trim();
    if (rowUser === username) {
      // Xác minh mật khẩu cũ
      if (rowPass !== oldPassword) {
        return jsonResponse({ success: false, error: 'Mật khẩu cũ không đúng' });
      }
      // Ghi mật khẩu mới vào cột B
      userSheet.getRange(i + 1, 2).setValue(newPassword);
      Logger.log(`✅ User ${rows[i][0]} đã đổi mật khẩu thành công`);
      return jsonResponse({ success: true, message: 'Đổi mật khẩu thành công!' });
    }
  }
  return jsonResponse({ success: false, error: 'Không tìm thấy tài khoản: ' + username });
}

// ───────────────────────────────────────────────
// ACTION: GET TRADES — Tải toàn bộ lệnh từ Cloud về máy
// ───────────────────────────────────────────────
function handleGetTrades(data) {
  const username = (data.username || '').trim().toLowerCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Lấy capital + currency của user từ sheet Nguoidung
  let capital = null, currency = 'USD';
  const userSheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (userSheet) {
    const userRows = userSheet.getDataRange().getValues();
    for (let i = 1; i < userRows.length; i++) {
      if (String(userRows[i][0] || '').trim().toLowerCase() === username) {
        capital  = Number(userRows[i][2]) || null;
        currency = String(userRows[i][3] || 'USD');
        break;
      }
    }
  }

  const sheet = getOrCreateLogSheet();
  const rows = sheet.getDataRange().getValues();
  const trades = [];

  for (let i = 1; i < rows.length; i++) {
    const rowUser = String(rows[i][1] || '').trim().toLowerCase();
    if (!username || rowUser === username) {
      const storedId = String(rows[i][19] || '').trim();
      trades.push({
        id: storedId || ('cloud_' + (i + 1)),
        date: String(rows[i][2] || '').split('T')[0],
        pair: String(rows[i][3] || ''),
        direction: String(rows[i][4] || 'LONG'),
        entryPrice: Number(rows[i][5]) || 0,
        stopLoss: Number(rows[i][6]) || 0,
        takeProfit: Number(rows[i][7]) || 0,
        volume: Number(rows[i][8]) || 0,
        dollarValue: Number(rows[i][9]) || 0,
        riskUsd: Number(rows[i][10]) || 0,
        rrRatio: String(rows[i][11] || '2.00').replace('1:', ''),
        pnl: Number(rows[i][12]) || 0,
        status: String(rows[i][13] || 'RUNNING'),
        note: String(rows[i][14] || ''),
        setupTag: String(rows[i][15] || ''),
        imgHtf: String(rows[i][16] || ''),
        imgMtf: String(rows[i][17] || ''),
        imgLtf: String(rows[i][18] || '')
      });
    }
  }
  trades.reverse();
  return jsonResponse({ success: true, trades, capital, currency });
}

// ───────────────────────────────────────────────
// ACTION: SAVE TRADE — ghi lệnh + upload ảnh Drive
// ───────────────────────────────────────────────
function handleSaveTrade(data) {
  const sheet = getOrCreateLogSheet();
  ensureHeader(sheet);

  const tradeId = String(data.id || ('trade_' + Date.now())).trim();
  const dateTag = (data.date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const pairTag = (data.pair || 'PAIR').toUpperCase();

  const htfUrl = uploadBase64Image(data.imgHtf, `${dateTag}_${pairTag}_HTF_${tradeId}.png`);
  const mtfUrl = uploadBase64Image(data.imgMtf, `${dateTag}_${pairTag}_MTF_${tradeId}.png`);
  const ltfUrl = uploadBase64Image(data.imgLtf, `${dateTag}_${pairTag}_LTF_${tradeId}.png`);

  const row = [
    new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    data.username || 'Anonymous',
    data.date || '',
    (data.pair || '').toUpperCase(),
    (data.direction || '').toUpperCase(),
    Number(data.entryPrice) || 0,
    Number(data.stopLoss) || 0,
    Number(data.takeProfit) || 0,
    Number(data.lots) || 0,
    Number(data.dollarValue) || 0,
    Number(data.riskUsd) || 0,
    '1:' + (data.rrRatio || '0'),
    Number(data.pnl) || 0,
    data.status || 'RUNNING',
    data.note || '',
    data.setupTag || '',
    htfUrl,
    mtfUrl,
    ltfUrl,
    tradeId
  ];

  // Tìm dòng có sẵn để cập nhật (tránh trùng lặp)
  const allRows = sheet.getDataRange().getValues();
  let existingRowNumber = null;
  for (let i = 1; i < allRows.length; i++) {
    const rowId = String(allRows[i][19] || '').trim();
    const cloudId = 'cloud_' + (i + 1);
    if (tradeId && (tradeId === rowId || tradeId === cloudId)) {
      existingRowNumber = i + 1;
      break;
    }
  }

  let targetRow;
  if (existingRowNumber) {
    targetRow = existingRowNumber;
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
    targetRow = sheet.getLastRow();
  }

  const status = (data.status || '').toUpperCase();
  const rowRange = sheet.getRange(targetRow, 1, 1, row.length);
  if (status === 'WIN') {
    rowRange.setBackground('#E6F4EA').setFontColor('#137333');
  } else if (status === 'LOSS') {
    rowRange.setBackground('#FCE8E6').setFontColor('#C5221F');
  } else if (status === 'BE') {
    rowRange.setBackground('#FEF7E0').setFontColor('#B06000');
  } else {
    rowRange.setBackground('#FFFFFF').setFontColor('#202124');
  }

  return jsonResponse({ success: true, row: targetRow, htfUrl, mtfUrl, ltfUrl, updated: !!existingRowNumber });
}

// ───────────────────────────────────────────────
// ACTION: DELETE TRADE — Xoá lệnh khỏi Google Sheet
// ───────────────────────────────────────────────
function handleDeleteTrade(data) {
  const tradeId = String(data.id || '').trim();
  if (!tradeId) return jsonResponse({ success: false, error: 'Thiếu ID lệnh cần xoá' });
  const sheet = getOrCreateLogSheet();
  const allRows = sheet.getDataRange().getValues();
  for (let i = 1; i < allRows.length; i++) {
    const rowId = String(allRows[i][19] || '').trim();
    const cloudId = 'cloud_' + (i + 1);
    if (tradeId === rowId || tradeId === cloudId) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true, message: 'Đã xoá lệnh khỏi Google Sheet' });
    }
  }
  return jsonResponse({ success: false, error: 'Không tìm thấy lệnh cần xoá' });
}

// ───────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────
function getOrCreateLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(LOG_SHEET_NAME);
  return sheet;
}

function ensureHeader(sheet) {
  if (sheet.getLastRow() > 0) return;
  const headers = [
    'Thời Gian Lưu', 'Username', 'Ngày Vào Lệnh',
    'Cặp', 'Vị Thế', 'Entry', 'Stop Loss', 'Take Profit',
    'Lots', '$ Value', 'Risk $', 'R:R', 'PnL ($)',
    'Trạng Thái', 'Ghi Chú', 'Setup Tag',
    'Ảnh HTF', 'Ảnh MTF', 'Ảnh LTF', 'Trade ID'
  ];
  sheet.appendRow(headers);
  const r = sheet.getRange(1, 1, 1, headers.length);
  r.setBackground('#0D1322');
  r.setFontColor('#FFFFFF');
  r.setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function getOrCreateDriveFolder() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function uploadBase64Image(base64DataUrl, filename) {
  if (!base64DataUrl || typeof base64DataUrl !== 'string' || base64DataUrl.length < 100) return '';
  // Skip nếu đã là URL (drive hoặc http)
  if (base64DataUrl.startsWith('http')) return base64DataUrl;
  try {
    let contentType = 'image/png';
    let base64Data = base64DataUrl;
    const match = base64DataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (match) {
      contentType = match[1];
      base64Data = match[2];
    }
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType, filename);
    const folder = getOrCreateDriveFolder();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    // Trả về URL thumbnail trực tiếp — hiển thị được trong <img src> không cần đăng nhập
    const fileId = file.getId();
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
  } catch (e) {
    Logger.log('Upload error: ' + e.toString());
    return '';
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ───────────────────────────────────────────────
// HÀM CHẠY TEST TRỰC TIẾP TRONG APPS SCRIPT
// Bấm chọn hàm này -> bấm Run (Chạy) để tự động tạo thư mục trên Drive ngay lập tức
// ───────────────────────────────────────────────
function testCreateFolderAndUpload() {
  const folder = getOrCreateDriveFolder();
  Logger.log('✅ Đã tìm thấy hoặc tạo thành công thư mục Drive: ' + folder.getName());
  Logger.log('🔗 Link thư mục Drive: ' + folder.getUrl());

  const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const fileUrl = uploadBase64Image(sampleBase64, 'test_connection.png');
  Logger.log('✅ Đã tạo ảnh test thành công: ' + fileUrl);
  
  const sheet = getOrCreateLogSheet();
  ensureHeader(sheet);
  Logger.log('✅ Đã kiểm tra Sheet Trading Log thành công.');
}
