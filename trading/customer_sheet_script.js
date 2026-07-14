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
  if (params.action === 'getSettings') {
    return handleGetSettings({ username: params.username });
  }
  return jsonResponse({ status: '✅ DNC Customer Trading Sheet Script is running' });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'saveTrade') return handleSaveTrade(data);
    if (data.action === 'deleteTrade') return handleDeleteTrade(data);
    if (data.action === 'saveCapital') return handleSaveCapital(data);
    if (data.action === 'saveSettings') return handleSaveSettings(data);
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
  const settings = readSettingsFromSheet(username);
  const sheet = getOrCreateLogSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return jsonResponse({
      success: true,
      trades: [],
      capital: settings.capital,
      currency: settings.currency,
      geminiApiKey: settings.geminiApiKey,
      webhookUrl: settings.webhookUrl,
      riskPercent: settings.riskPercent
    });
  }

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

  return jsonResponse({
    success: true,
    trades,
    capital: settings.capital,
    currency: settings.currency,
    geminiApiKey: settings.geminiApiKey,
    webhookUrl: settings.webhookUrl,
    riskPercent: settings.riskPercent
  });
}

// ───────────────────────────────────────────────
// SAVE CAPITAL — Lưu vốn của khách vào Property Service và tab Setting
// ───────────────────────────────────────────────
function handleSaveCapital(data) {
  PropertiesService.getUserProperties().setProperty('DNC_CAPITAL', String(data.capital || 0));
  PropertiesService.getUserProperties().setProperty('DNC_CURRENCY', String(data.currency || 'USD'));
  writeSettingsToSheet(data || {});
  return jsonResponse({ success: true });
}

// ───────────────────────────────────────────────
// SETTINGS HANDLERS — Quản lý AI Gemini API Key & Webhook URL & Risk trong tab Setting
// ───────────────────────────────────────────────
function handleGetSettings(data) {
  const settings = readSettingsFromSheet((data && data.username) || '');
  return jsonResponse({ success: true, ...settings });
}

function handleSaveSettings(data) {
  writeSettingsToSheet(data || {});
  return jsonResponse({ success: true, message: '✅ Đã lưu cấu hình vào tab Setting' });
}

function getOrCreateSettingSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Setting') || ss.getSheetByName('Settings');
  if (!sheet) {
    sheet = ss.insertSheet('Setting');
  }
  if (sheet.getLastRow() === 0) {
    const headers = ['Cài Đặt (Key)', 'Giá Trị (Value)', 'Ghi Chú'];
    sheet.appendRow(headers);
    const r = sheet.getRange(1, 1, 1, headers.length);
    r.setBackground('#0D1322').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.appendRow(['AI Gemini API Key', '', 'Dùng cho AI đọc ảnh TradingView tự động']);
    sheet.appendRow(['Webhook URL Google Sheet', '', 'URL Apps Script để đồng bộ thiết bị']);
    sheet.appendRow(['Risk Percent (%)', '5', 'Tỷ lệ rủi ro kỷ luật / lệnh']);
    sheet.appendRow(['Capital', '10000', 'Vốn gốc khởi điểm']);
    sheet.appendRow(['Currency', 'USD', 'Đơn vị tiền tệ (USD/VND)']);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

function readSettingsFromSheet(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Setting') || ss.getSheetByName('Settings');
  let settings = {
    geminiApiKey: '',
    webhookUrl: '',
    riskPercent: null,
    capital: null,
    currency: 'USD'
  };

  if (!sheet) return settings;

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1 && (!rows[0] || rows[0].length === 0)) return settings;

  let isHorizontalTable = false;
  const headerRow = rows[0] ? rows[0].map(h => String(h || '').toLowerCase().trim()) : [];
  const settingKeywordsCount = headerRow.filter(h =>
    h.includes('username') || h.includes('tài khoản') || h === 'user' ||
    h.includes('gemini') || h.includes('api key') ||
    h.includes('webhook') || (h.includes('url') && !h.includes('cài đặt')) ||
    h.includes('risk') || h.includes('rủi ro') ||
    h === 'capital' || h.includes('vốn') ||
    h.includes('currency') || h.includes('tiền tệ')
  ).length;

  if (headerRow.includes('username') || headerRow.includes('tài khoản') || settingKeywordsCount >= 2) {
    isHorizontalTable = true;
  }

  if (isHorizontalTable) {
    const u = String(username || '').toLowerCase().trim();
    const userColIdx = headerRow.findIndex(h => h.includes('username') || h.includes('tài khoản') || h === 'user');
    const geminiColIdx = headerRow.findIndex(h => h.includes('gemini') || h.includes('api key'));
    const webhookColIdx = headerRow.findIndex(h => h.includes('webhook') || h.includes('url'));
    const riskColIdx = headerRow.findIndex(h => h.includes('risk') || h.includes('rủi ro'));
    const capitalColIdx = headerRow.findIndex(h => h.includes('capital') || h.includes('vốn'));
    const currencyColIdx = headerRow.findIndex(h => h.includes('currency') || h.includes('tiền tệ'));

    for (let i = 1; i < rows.length; i++) {
      const rowUser = userColIdx !== -1 ? String(rows[i][userColIdx] || '').toLowerCase().trim() : '';
      if (!u || rowUser === u || userColIdx === -1 || rows.length === 2) {
        if (geminiColIdx !== -1 && rows[i][geminiColIdx] !== undefined && rows[i][geminiColIdx] !== '') settings.geminiApiKey = String(rows[i][geminiColIdx]).trim();
        if (webhookColIdx !== -1 && rows[i][webhookColIdx] !== undefined && rows[i][webhookColIdx] !== '') settings.webhookUrl = String(rows[i][webhookColIdx]).trim();
        if (riskColIdx !== -1 && rows[i][riskColIdx] !== '' && rows[i][riskColIdx] !== undefined) settings.riskPercent = Number(rows[i][riskColIdx]);
        if (capitalColIdx !== -1 && rows[i][capitalColIdx] !== '' && rows[i][capitalColIdx] !== undefined) settings.capital = Number(rows[i][capitalColIdx]);
        if (currencyColIdx !== -1 && rows[i][currencyColIdx] !== undefined && rows[i][currencyColIdx] !== '') settings.currency = String(rows[i][currencyColIdx]).trim();
        break;
      }
    }
  } else {
    for (let i = 0; i < rows.length; i++) {
      const key = String(rows[i][0] || '').toLowerCase().trim();
      const val = rows[i][1] !== undefined && rows[i][1] !== null ? String(rows[i][1]).trim() : '';
      if (!key || (i === 0 && (key.includes('cài đặt') || key === 'key' || key === 'setting'))) continue;

      if (key.includes('gemini') || key.includes('api key')) {
        if (val) settings.geminiApiKey = val;
      } else if (key.includes('webhook') || key.includes('url google sheet')) {
        if (val) settings.webhookUrl = val;
      } else if (key.includes('risk') || key.includes('rủi ro')) {
        if (val !== '') settings.riskPercent = Number(val);
      } else if (key === 'capital' || key.includes('vốn gốc') || key.includes('vốn ban đầu')) {
        if (val !== '') settings.capital = Number(val);
      } else if (key.includes('currency') || key.includes('tiền tệ')) {
        if (val) settings.currency = val;
      }
    }
  }

  return settings;
}

function writeSettingsToSheet(data) {
  const sheet = getOrCreateSettingSheet();
  const rows = sheet.getDataRange().getValues();

  let isHorizontalTable = false;
  const headerRow = rows[0] ? rows[0].map(h => String(h || '').toLowerCase().trim()) : [];
  const settingKeywordsCount = headerRow.filter(h =>
    h.includes('username') || h.includes('tài khoản') || h === 'user' ||
    h.includes('gemini') || h.includes('api key') ||
    h.includes('webhook') || (h.includes('url') && !h.includes('cài đặt')) ||
    h.includes('risk') || h.includes('rủi ro') ||
    h === 'capital' || h.includes('vốn') ||
    h.includes('currency') || h.includes('tiền tệ')
  ).length;

  if (headerRow.includes('username') || headerRow.includes('tài khoản') || settingKeywordsCount >= 2) {
    isHorizontalTable = true;
  }

  if (isHorizontalTable) {
    const u = String(data.username || 'MyAccount').trim();
    const userColIdx = headerRow.findIndex(h => h.includes('username') || h.includes('tài khoản') || h === 'user');
    const geminiColIdx = headerRow.findIndex(h => h.includes('gemini') || h.includes('api key'));
    const webhookColIdx = headerRow.findIndex(h => h.includes('webhook') || h.includes('url'));
    const riskColIdx = headerRow.findIndex(h => h.includes('risk') || h.includes('rủi ro'));
    const capitalColIdx = headerRow.findIndex(h => h.includes('capital') || h.includes('vốn'));
    const currencyColIdx = headerRow.findIndex(h => h.includes('currency') || h.includes('tiền tệ'));

    let targetRowNumber = null;
    for (let i = 1; i < rows.length; i++) {
      const rowUser = userColIdx !== -1 ? String(rows[i][userColIdx] || '').toLowerCase().trim() : '';
      if (rowUser === u.toLowerCase() || userColIdx === -1 || (rows.length === 2 && !rowUser)) {
        targetRowNumber = i + 1;
        break;
      }
    }

    if (!targetRowNumber) {
      const newRow = new Array(headerRow.length).fill('');
      if (userColIdx !== -1) newRow[userColIdx] = u;
      if (geminiColIdx !== -1 && data.geminiApiKey !== undefined) newRow[geminiColIdx] = data.geminiApiKey;
      if (webhookColIdx !== -1 && data.webhookUrl !== undefined) newRow[webhookColIdx] = data.webhookUrl;
      if (riskColIdx !== -1 && data.riskPercent !== undefined) newRow[riskColIdx] = data.riskPercent;
      if (capitalColIdx !== -1 && data.capital !== undefined) newRow[capitalColIdx] = data.capital;
      if (currencyColIdx !== -1 && data.currency !== undefined) newRow[currencyColIdx] = data.currency;
      sheet.appendRow(newRow);
    } else {
      if (geminiColIdx !== -1 && data.geminiApiKey !== undefined && data.geminiApiKey !== null) sheet.getRange(targetRowNumber, geminiColIdx + 1).setValue(data.geminiApiKey);
      if (webhookColIdx !== -1 && data.webhookUrl !== undefined && data.webhookUrl !== null) sheet.getRange(targetRowNumber, webhookColIdx + 1).setValue(data.webhookUrl);
      if (riskColIdx !== -1 && data.riskPercent !== undefined && data.riskPercent !== null) sheet.getRange(targetRowNumber, riskColIdx + 1).setValue(data.riskPercent);
      if (capitalColIdx !== -1 && data.capital !== undefined && data.capital !== null) sheet.getRange(targetRowNumber, capitalColIdx + 1).setValue(data.capital);
      if (currencyColIdx !== -1 && data.currency !== undefined && data.currency !== null) sheet.getRange(targetRowNumber, currencyColIdx + 1).setValue(data.currency);
    }
  } else {
    const mapKeys = {
      'geminiApiKey': ['ai gemini api key', 'gemini api key', 'gemini'],
      'webhookUrl': ['webhook url google sheet', 'webhook url', 'webhook'],
      'riskPercent': ['risk percent (%)', 'risk percent', 'tỷ lệ risk'],
      'capital': ['capital', 'vốn gốc', 'vốn ban đầu'],
      'currency': ['currency', 'tiền tệ']
    };

    const keysToUpdate = ['geminiApiKey', 'webhookUrl', 'riskPercent', 'capital', 'currency'].filter(k => data[k] !== undefined && data[k] !== null && String(data[k]).trim() !== '');

    for (const k of keysToUpdate) {
      let foundRow = null;
      const aliases = mapKeys[k];
      for (let i = 0; i < rows.length; i++) {
        const rowKey = String(rows[i][0] || '').toLowerCase().trim();
        if (aliases.some(alias => rowKey.includes(alias))) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow) {
        sheet.getRange(foundRow, 2).setValue(data[k]);
      } else {
        let label = aliases[0].toUpperCase();
        if (k === 'geminiApiKey') label = 'AI Gemini API Key';
        if (k === 'webhookUrl') label = 'Webhook URL Google Sheet';
        if (k === 'riskPercent') label = 'Risk Percent (%)';
        if (k === 'capital') label = 'Capital';
        if (k === 'currency') label = 'Currency';
        sheet.appendRow([label, data[k], '']);
      }
    }
  }
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
    return `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1200`;
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
