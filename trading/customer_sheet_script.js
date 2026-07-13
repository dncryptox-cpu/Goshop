/**
 * DNC TRADING OS — GOOGLE APPS SCRIPT DÀNH RIÊNG CHO KHÁCH HÀNG (CUSTOMER SHEET SCRIPT)
 * 
 * Hướng dẫn cài đặt cho khách hàng:
 * 1. Mở Google Sheet của bạn -> Chọn Tiện ích (Extensions) -> Apps Script
 * 2. Dán toàn bộ đoạn code này vào -> Bấm Lưu (Save)
 * 3. Bấm Triển khai (Deploy) -> Tùy chọn triển khai mới (New deployment)
 *    - Chọn loại: Ứng dụng web (Web app)
 *    - Quyền truy cập: Bất kỳ ai (Anyone)
 * 4. Copy URL ứng dụng web -> Dán vào ô Webhook URL trong mục Cài Đặt trên DNC Trading OS
 */

const LOG_SHEET_NAME = 'Trading Log';
const DRIVE_FOLDER_NAME = 'DNC Trading OS - Chart Images';

function doGet(e) {
  const params = e.parameter || {};
  if (params.action === 'getTrades') {
    return handleGetTrades({ username: params.username });
  }
  return jsonResponse({ status: '✅ DNC Customer Trading Sheet Script is running' });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'saveTrade') return handleSaveTrade(data);
    if (data.action === 'deleteTrade') return handleDeleteTrade(data);
    if (data.action === 'saveCapital') return handleSaveCapital(data);
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ───────────────────────────────────────────────
// SAVE TRADE — Ghi hoặc Cập nhật lệnh + Upload ảnh
// ───────────────────────────────────────────────
function handleSaveTrade(data) {
  const username = (data.username || 'MyAccount').trim();
  const tradeId = String(data.id || '').trim();
  const sheet = getOrCreateLogSheet();

  // Upload ảnh chart lên Google Drive cá nhân
  const htfUrl = uploadBase64Image(data.imgHtf, `${username}_${data.pair}_HTF_${Date.now()}`);
  const mtfUrl = uploadBase64Image(data.imgMtf, `${username}_${data.pair}_MTF_${Date.now()}`);
  const ltfUrl = uploadBase64Image(data.imgLtf, `${username}_${data.pair}_LTF_${Date.now()}`);

  const timestamp = new Date().toLocaleString('vi-VN');
  const row = [
    timestamp,
    username,
    data.date || '',
    data.pair || '',
    data.direction || '',
    data.entryPrice || '',
    data.stopLoss || '',
    data.takeProfit || '',
    data.lots || '',
    data.dollarValue || '',
    data.riskUsd || '',
    data.rrRatio || '',
    data.pnl || '',
    data.status || 'Running',
    data.note || '',
    data.setupTag || '',
    htfUrl || data.imgHtf || '',
    mtfUrl || data.imgMtf || '',
    ltfUrl || data.imgLtf || '',
    tradeId
  ];

  // Kiểm tra Trade ID xem lệnh đã tồn tại chưa để cập nhật đúng dòng (không tạo trùng lặp)
  const allRows = sheet.getDataRange().getValues();
  let existingRowNumber = null;
  if (tradeId) {
    for (let i = 1; i < allRows.length; i++) {
      const rowId = String(allRows[i][19] || '').trim();
      if (rowId === tradeId) {
        existingRowNumber = i + 1;
        break;
      }
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

  // Định dạng màu sắc hàng theo Lãi/Lỗ rực rỡ, dễ đọc
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
// DELETE TRADE — Xóa lệnh khỏi Sheet
// ───────────────────────────────────────────────
function handleDeleteTrade(data) {
  const tradeId = String(data.id || '').trim();
  if (!tradeId) return jsonResponse({ success: false, error: 'Thiếu ID lệnh cần xoá' });
  const sheet = getOrCreateLogSheet();
  const allRows = sheet.getDataRange().getValues();
  for (let i = 1; i < allRows.length; i++) {
    const rowId = String(allRows[i][19] || '').trim();
    if (rowId === tradeId) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true, deletedRow: i + 1 });
    }
  }
  return jsonResponse({ success: false, error: 'Không tìm thấy lệnh để xoá' });
}

// ───────────────────────────────────────────────
// GET TRADES — Tải lịch sử lệnh của khách
// ───────────────────────────────────────────────
function handleGetTrades(data) {
  const username = (data.username || '').trim();
  const sheet = getOrCreateLogSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return jsonResponse({ success: true, trades: [] });

  const trades = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowUser = String(row[1] || '').trim();
    if (username && rowUser.toLowerCase() !== username.toLowerCase()) continue;

    trades.push({
      id: String(row[19] || `cloud_${i + 1}`),
      date: String(row[2] || ''),
      pair: String(row[3] || ''),
      direction: String(row[4] || ''),
      entryPrice: Number(row[5]) || 0,
      stopLoss: Number(row[6]) || 0,
      takeProfit: Number(row[7]) || 0,
      lots: Number(row[8]) || 0,
      dollarValue: Number(row[9]) || 0,
      riskUsd: Number(row[10]) || 0,
      rrRatio: String(row[11] || ''),
      pnl: Number(row[12]) || 0,
      status: String(row[13] || 'Running'),
      note: String(row[14] || ''),
      setupTag: String(row[15] || ''),
      imgHtf: String(row[16] || ''),
      imgMtf: String(row[17] || ''),
      imgLtf: String(row[18] || ''),
      cloud_rowNumber: i + 1
    });
  }

  return jsonResponse({ success: true, trades });
}

// ───────────────────────────────────────────────
// SAVE CAPITAL — Lưu vốn của khách vào Property Service hoặc Sheet
// ───────────────────────────────────────────────
function handleSaveCapital(data) {
  PropertiesService.getUserProperties().setProperty('DNC_CAPITAL', String(data.capital || 0));
  PropertiesService.getUserProperties().setProperty('DNC_CURRENCY', String(data.currency || 'USD'));
  return jsonResponse({ success: true });
}

// ───────────────────────────────────────────────
// UTILS & GOOGLE DRIVE IMAGE UPLOAD
// ───────────────────────────────────────────────
function getOrCreateLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
    const headers = [
      'Thời Gian Lưu', 'Username', 'Ngày Vào Lệnh', 'Cặp', 'Vị Thế',
      'Entry', 'Stop Loss', 'Take Profit', 'Lots', '$ Value',
      'Risk $', 'R:R', 'PnL ($)', 'Trạng Thái', 'Ghi Chú',
      'Setup Tag', 'Ảnh HTF', 'Ảnh MTF', 'Ảnh LTF', 'Trade ID'
    ];
    sheet.appendRow(headers);
    const r = sheet.getRange(1, 1, 1, headers.length);
    r.setBackground('#0D1322').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

function uploadBase64Image(base64DataUrl, filename) {
  if (!base64DataUrl || typeof base64DataUrl !== 'string' || base64DataUrl.length < 100) return '';
  if (base64DataUrl.startsWith('http')) return base64DataUrl;
  try {
    let contentType = 'image/png';
    let base64String = base64DataUrl;
    const matches = base64DataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches) {
      contentType = matches[1];
      base64String = matches[2];
    }
    const blob = Utilities.newBlob(Utilities.base64Decode(base64String), contentType, filename + '.png');
    const folder = getOrCreateDriveFolder();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return `https://drive.google.com/uc?export=view&id=${file.getId()}`;
  } catch (err) {
    return '';
  }
}

function getOrCreateDriveFolder() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ───────────────────────────────────────────────
// HÀM CHỌN CHẠY 1 LẦN (SETUP & CLEAN SHEET KHÁCH)
// Bấm chọn hàm này -> bấm Run (Chạy) để tự động chuẩn hóa Sheet Trading Log sạch 100%
// và xóa bỏ tab Nguoidung (nếu copy nhầm từ Admin)
// ───────────────────────────────────────────────
function setupAndCleanCustomerSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Xóa tab Nguoidung nếu tồn tại (khách hàng không cần tab quản lý user của Admin)
  const adminUserSheet = ss.getSheetByName('Nguoidung');
  if (adminUserSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(adminUserSheet);
    Logger.log('✅ Đã xóa tab Nguoidung (không cần thiết cho sheet riêng của khách).');
  }

  // 2. Đảm bảo tab Trading Log chuẩn sạch
  const logSheet = getOrCreateLogSheet();
  Logger.log('✅ Sheet Trading Log đã sẵn sàng cho khách hàng: ' + logSheet.getName());
}
