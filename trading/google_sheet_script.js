// ========================================================
// DNC TRADING OS — Google Apps Script Backend (Template)
//
// HƯỚNG DẪN SETUP (dành cho khách hàng):
// 1. Mở Google Sheet của BẠN tại: drive.google.com
// 2. Vào menu Extensions → Apps Script
// 3. Dán toàn bộ code này vào, bấm Save (Ctrl+S)
// 4. Bấm Deploy → New Deployment
//    → Type: Web App
//    → Execute as: Me (chạy quyền Google của bạn)
//    → Who has access: Anyone
// 5. Copy URL dạng https://script.google.com/macros/s/.../exec
// 6. Dán URL đó vào Trading OS → Settings → Webhook URL
//
// LƯU Ý: Dữ liệu & ảnh sẽ lưu vào DRIVE & SHEET CỦA BẠN.
// ========================================================

const LOG_SHEET_NAME = 'Trading Log';
const DRIVE_FOLDER_NAME = 'DNC Trading Charts';

// ── Lấy Sheet đang chứa script này (của chính người dùng) ──
function getLogSheet() {
  // getActiveSpreadsheet() tự động trỏ về Sheet mà script được deploy từ đó
  // → mỗi khách hàng có Sheet riêng, không dùng chung
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
  }
  return sheet;
}

// ── Lấy/tạo thư mục Drive riêng của người dùng để lưu ảnh ──
function getOrCreateDriveFolder() {
  // DriveApp chạy quyền "Execute as: Me" → tự động vào Drive của người deploy
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

// ── Upload ảnh base64 lên Drive, trả về URL xem ảnh ──
function uploadBase64Image(base64DataUrl, filename) {
  if (!base64DataUrl || base64DataUrl.length < 100) return '';
  try {
    const match = base64DataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!match) return '';
    const mimeType = 'image/' + match[1];
    const rawBase64 = match[2];
    const blob = Utilities.newBlob(Utilities.base64Decode(rawBase64), mimeType, filename);
    const folder = getOrCreateDriveFolder();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    console.warn('Upload ảnh lỗi:', e.message);
    return '';
  }
}

// ── Tạo header cho sheet khi lần đầu chạy ──
function ensureHeader(sheet) {
  if (sheet.getLastRow() > 0) return;
  const headers = [
    'Thời Gian Lưu', 'Username', 'Ngày Vào Lệnh',
    'Cặp', 'Vị Thế', 'Entry', 'Stop Loss', 'Take Profit',
    'Lots', '$ Value', 'Risk $', 'R:R', 'PnL ($)',
    'Trạng Thái', 'Ghi Chú', 'Setup Tag',
    'Ảnh HTF', 'Ảnh MTF', 'Ảnh LTF (Khung Vào Lệnh)'
  ];
  sheet.appendRow(headers);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#0D1322');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);
  sheet.setFrozenRows(1);
  // Auto-resize cột
  sheet.autoResizeColumns(1, headers.length);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getLogSheet();
    ensureHeader(sheet);

    // Upload ảnh lên Drive riêng của người dùng
    const tradeId = data.id || ('trade_' + Date.now());
    const dateTag = (data.date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const pairTag = (data.pair || 'PAIR').toUpperCase();

    const htfUrl = uploadBase64Image(data.imgHtf, `${dateTag}_${pairTag}_HTF_${tradeId}.png`);
    const mtfUrl = uploadBase64Image(data.imgMtf, `${dateTag}_${pairTag}_MTF_${tradeId}.png`);
    const ltfUrl = uploadBase64Image(data.imgLtf, `${dateTag}_${pairTag}_LTF_${tradeId}.png`);

    // Ghi dòng dữ liệu
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

    // Tô màu dòng theo kết quả lệnh
    const lastRow = sheet.getLastRow();
    const rowRange = sheet.getRange(lastRow, 1, 1, row.length);
    const status = (data.status || '').toUpperCase();
    if (status === 'WIN')  rowRange.setBackground('#0D2B1D');
    else if (status === 'LOSS') rowRange.setBackground('#2B0D15');
    else if (status === 'BE')   rowRange.setBackground('#1A1A0D');

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, row: lastRow, htfUrl, mtfUrl, ltfUrl }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test: GET request để kiểm tra script đang chạy bình thường
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ContentService
    .createTextOutput(JSON.stringify({
      status: '✅ DNC Trading OS API is running',
      sheet: ss.getName(),
      owner: ss.getOwner().getEmail()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
