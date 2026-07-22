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
  const params = (e && e.parameter) ? e.parameter : {};
  if (params.action === 'getTrades') {
    return handleGetTrades({ username: params.username });
  }
  if (params.action === 'getSettings') {
    return handleGetSettings({ username: params.username });
  }
  if (params.action === 'getCloudLinks') {
    return jsonResponse({ success: true, ...getCloudLinks() });
  }
  if (params.action === 'saveTrade') {
    return handleSaveTrade(params);
  }
  if (params.action === 'testSave') {
    return handleSaveTrade({
      username: params.username || 'TestUser',
      date: new Date().toISOString().split('T')[0],
      pair: 'BTCUSDT',
      direction: 'LONG',
      entryPrice: 95000,
      stopLoss: 94000,
      takeProfit: 98000,
      lots: 0.5,
      pnl: 1500,
      status: 'WIN',
      note: '✅ Kiểm tra lưu lệnh thành công từ Webhook!'
    });
  }
  // Khi khách mở Webhook URL trực tiếp trên trình duyệt, tự động chuyển hướng / hiển thị link đến thẳng Google Sheet cá nhân của họ
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss && ss.getUrl()) {
      const sheetUrl = ss.getUrl();
      const sheetName = ss.getName();
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Kết nối DNC Trading Sheet</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 36px; border-radius: 20px; border: 1px solid #334155; max-width: 460px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
            .title { color: #34d399; font-size: 20px; font-weight: bold; margin-bottom: 12px; }
            .desc { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
            .btn { display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-weight: bold; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(16,185,129,0.3); transition: all 0.2s; }
            .btn:hover { background: #059669; }
            .link-text { margin-top: 16px; font-size: 12px; color: #64748b; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="title">✅ Webhook DNC Trading OS Hoạt Động!</div>
            <div class="desc">Kết nối tự động giữa giao diện DNC Trading OS và bảng dữ liệu <b>${sheetName}</b> của bạn đã sẵn sàng.<br><br>Đang chuyển hướng bạn tới Google Sheet...</div>
            <a href="${sheetUrl}" class="btn">→ Mở Google Sheet Ngay</a>
            <div class="link-text">${sheetUrl}</div>
          </div>
          <script>setTimeout(function() { window.location.href = "${sheetUrl}"; }, 1200);</script>
        </body>
        </html>
      `);
    }
  } catch(err) {}

  return jsonResponse({ status: '✅ DNC Customer Trading Sheet Script is running', ...getCloudLinks() });
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
    const oldRow = allRows[existingRowNumber - 1] || [];
    if (!htfUrl && !data.imgHtf && oldRow[16]) row[16] = oldRow[16];
    if (!mtfUrl && !data.imgMtf && oldRow[17]) row[17] = oldRow[17];
    if (!ltfUrl && !data.imgLtf && oldRow[18]) row[18] = oldRow[18];
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

  function parseSheetNumber(val) {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const cleaned = String(val).replace(/,/g, '.').replace(/[^0-9.-]/g, '');
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  }

  const trades = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowUser = String(row[1] || '').trim();
    if (username && rowUser && rowUser.toLowerCase() !== username.toLowerCase()) continue;

    const riskUsd = parseSheetNumber(row[10]);
    let pnl = parseSheetNumber(row[12]);
    const status = String(row[13] || 'RUNNING').toUpperCase();
    const entryPrice = parseSheetNumber(row[5]);
    const stopLoss = parseSheetNumber(row[6]);
    const takeProfit = parseSheetNumber(row[7]);
    let lots = parseSheetNumber(row[8]);
    const dollarValue = parseSheetNumber(row[9]);
    const rrRatio = parseSheetNumber(row[11]);

    const cap = settings.capital || 10000;
    if (Math.abs(pnl) > 100000 && Math.abs(pnl) > cap * 50) {
      let actualLots = lots;
      if (actualLots > 100 && (entryPrice > 100 || stopLoss > 100)) {
        actualLots = actualLots / 1000;
        lots = actualLots;
      }
      if (status === 'WIN') {
        if (entryPrice && takeProfit && actualLots) {
          pnl = Number((Math.abs(takeProfit - entryPrice) * actualLots).toFixed(2));
        } else if (riskUsd && rrRatio) {
          pnl = Number((riskUsd * rrRatio).toFixed(2));
        } else {
          pnl = 0;
        }
      } else if (status === 'LOSS') {
        if (entryPrice && stopLoss && actualLots) {
          pnl = -Number((Math.abs(entryPrice - stopLoss) * actualLots).toFixed(2));
        } else if (riskUsd) {
          pnl = -Number(riskUsd.toFixed(2));
        } else {
          pnl = 0;
        }
      } else {
        pnl = 0;
      }
    }

    let rAchieved = (riskUsd > 0 && pnl !== 0) ? Number((pnl / riskUsd).toFixed(2)) : (status === 'WIN' ? parseSheetNumber(row[11]) : (status === 'LOSS' ? -1 : 0));
    if (Math.abs(rAchieved) > 500) rAchieved = 0;

    trades.push({
      id: String(row[19] || `cloud_${i + 1}`),
      date: String(row[2] || '').split('T')[0],
      pair: String(row[3] || ''),
      direction: String(row[4] || 'LONG'),
      entryPrice: entryPrice,
      stopLoss: stopLoss,
      takeProfit: takeProfit,
      volume: lots,
      lots: lots,
      dollarValue: dollarValue,
      riskUsd: riskUsd,
      rrRatio: String(row[11] || '').replace('1:', ''),
      pnl: pnl,
      rAchieved: rAchieved,
      status: status,
      note: String(row[14] || ''),
      setupTag: String(row[15] || ''),
      imgHtf: String(row[16] || ''),
      imgMtf: String(row[17] || ''),
      imgLtf: String(row[18] || ''),
      cloud_rowNumber: i + 1
    });
  }

  // Tổng hợp trực tiếp từ dữ liệu nguyên bản trên Sheet (Single Source of Truth)
  const winTrades = trades.filter(t => t.status === 'WIN' && t.pnl > 0);
  const lossTrades = trades.filter(t => t.status === 'LOSS' && t.pnl < 0);
  const closedTrades = trades.filter(t => t.status === 'WIN' || t.status === 'LOSS' || t.status === 'BE' || t.pnl !== 0);

  const totalNetPnL = Number(trades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0).toFixed(2));
  const totalR = Number(trades.reduce((sum, t) => sum + (Number(t.rAchieved) || 0), 0).toFixed(2));
  const winCount = winTrades.length;
  const lossCount = lossTrades.length;
  const closedCount = closedTrades.length;
  const winRate = closedCount > 0 ? Number(((winCount / closedCount) * 100).toFixed(1)) : 0;

  const grossWin = winTrades.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(lossTrades.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss === 0 ? (grossWin > 0 ? 'MAX' : '0.0') : (grossWin / grossLoss).toFixed(2);

  trades.reverse();
  return jsonResponse({
    success: true,
    trades,
    capital: settings.capital,
    currency: settings.currency,
    geminiApiKey: settings.geminiApiKey,
    webhookUrl: settings.webhookUrl,
    riskPercent: settings.riskPercent,
    summary: {
      totalNetPnL,
      totalR,
      winCount,
      lossCount,
      closedCount,
      winRate,
      profitFactor
    }
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
  // Tự động nhận diện tab theo nhiều tên phổ biến — ưu tiên từ trên xuống
  const candidates = [
    LOG_SHEET_NAME,              // 'Trading Log' (mặc định)
    'Trading Log customer',
    'Trading Log Customer',
    'Log'
  ];
  let sheet = null;
  for (const name of candidates) {
    sheet = ss.getSheetByName(name);
    if (sheet) break;
  }
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
