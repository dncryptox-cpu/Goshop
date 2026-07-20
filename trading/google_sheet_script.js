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

const LOG_SHEET_NAME = 'Trading Log';
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
  if (params.action === 'getSettings') {
    return handleGetSettings({ username: params.username });
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
    if (data.action === 'deleteTrade') return handleDeleteTrade(data);
    if (data.action === 'saveCapital') return handleSaveCapital(data);
    if (data.action === 'changePassword') return handleChangePassword(data);
    if (data.action === 'saveSettings') return handleSaveSettings(data);
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
      const capital = Number(rows[i][2]) || null;
      const currency = String(rows[i][3] || 'USD');
      const settings = readSettingsFromSheet(rows[i][0]);
      return jsonResponse({
        success: true,
        username: rows[i][0],
        capital: capital !== null ? capital : settings.capital,
        currency: currency || settings.currency,
        geminiApiKey: settings.geminiApiKey,
        webhookUrl: settings.webhookUrl,
        riskPercent: settings.riskPercent
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
      const settings = readSettingsFromSheet(rows[i][0]);
      return jsonResponse({
        success: true,
        username: rows[i][0],
        capital: Number(rows[i][2]) || settings.capital || null,
        currency: String(rows[i][3] || settings.currency || 'USD'),
        geminiApiKey: settings.geminiApiKey,
        webhookUrl: settings.webhookUrl,
        riskPercent: settings.riskPercent
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
      writeSettingsToSheet(data || {});
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Không tìm thấy user: ' + data.username });
}

// ───────────────────────────────────────────────
// ACTION: CHANGE PASSWORD — đổi mật khẩu, lưu vào Sheet cột B
// ───────────────────────────────────────────────
function handleChangePassword(data) {
  const username = (data.username || '').trim().toLowerCase();
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

  const settings = readSettingsFromSheet(username);
  let capital = settings.capital, currency = settings.currency || 'USD';
  const userSheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (userSheet) {
    const userRows = userSheet.getDataRange().getValues();
    for (let i = 1; i < userRows.length; i++) {
      if (String(userRows[i][0] || '').trim().toLowerCase() === username) {
        if (Number(userRows[i][2])) capital = Number(userRows[i][2]);
        if (String(userRows[i][3])) currency = String(userRows[i][3] || 'USD');
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
  return jsonResponse({
    success: true,
    trades,
    capital,
    currency,
    geminiApiKey: settings.geminiApiKey,
    webhookUrl: settings.webhookUrl,
    riskPercent: settings.riskPercent
  });
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

function getCloudLinks() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const folder = getOrCreateDriveFolder();
    return {
      sheetUrl: ss ? ss.getUrl() : '',
      driveUrl: folder ? folder.getUrl() : '',
      sheetName: ss ? ss.getName() : '',
      driveName: folder ? folder.getName() : ''
    };
  } catch (e) {
    return { sheetUrl: '', driveUrl: '', sheetName: '', driveName: '' };
  }
}

function jsonResponse(obj) {
  let finalObj = obj;
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    finalObj = { ...obj, ...getCloudLinks() };
  }
  return ContentService
    .createTextOutput(JSON.stringify(finalObj))
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
