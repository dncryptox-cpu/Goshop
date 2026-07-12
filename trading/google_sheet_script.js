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

  // Health check
  return jsonResponse({ status: '✅ DNC Trading OS Auth API is running' });
}

// ───────────────────────────────────────────────
// POST HANDLER: Dùng cho SAVE TRADE
// ───────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'saveTrade') return handleSaveTrade(data);
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
  // Bỏ qua dòng header (dòng 1 — Username / Pass)
  for (let i = 1; i < rows.length; i++) {
    const rowUser = String(rows[i][0] || '').trim().toLowerCase();
    const rowPass = String(rows[i][1] || '').trim();
    if (rowUser === username.toLowerCase() && rowPass === password) {
      // Trả về displayName đúng chuẩn (giữ nguyên casing từ Sheet)
      return jsonResponse({ success: true, username: rows[i][0] });
    }
  }

  return jsonResponse({ success: false, error: 'Sai username hoặc mật khẩu' });
}

// ───────────────────────────────────────────────
// ACTION: SAVE TRADE — ghi lệnh + upload ảnh Drive
// ───────────────────────────────────────────────
function handleSaveTrade(data) {
  const sheet = getOrCreateLogSheet();
  ensureHeader(sheet);

  const tradeId = data.id || ('trade_' + Date.now());
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
    ltfUrl
  ];
  sheet.appendRow(row);

  const lastRow = sheet.getLastRow();
  const status = (data.status || '').toUpperCase();
  const rowRange = sheet.getRange(lastRow, 1, 1, row.length);
  if (status === 'WIN')       rowRange.setBackground('#0D2B1D');
  else if (status === 'LOSS') rowRange.setBackground('#2B0D15');
  else if (status === 'BE')   rowRange.setBackground('#1A1A0D');

  return jsonResponse({ success: true, row: lastRow, htfUrl, mtfUrl, ltfUrl });
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
    'Ảnh HTF', 'Ảnh MTF', 'Ảnh LTF'
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
    return file.getUrl();
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
