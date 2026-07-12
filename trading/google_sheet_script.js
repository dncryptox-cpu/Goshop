// ========================================================
// DNC TRADING OS — Google Apps Script Backend
// Dán toàn bộ code này vào Google Sheet → Extensions → Apps Script
// Sau đó Deploy → New Deployment → Web App → Execute as: Me → Anyone
// ========================================================

const SHEET_ID = '1-ulfvVBeKvNb-K-k_ntjJGF4-n6hVcUgqITLwEytg3s';
const LOG_SHEET_NAME = 'Trading Log';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SHEET_ID);

    // Tạo sheet nếu chưa có
    let sheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(LOG_SHEET_NAME);
    }

    // Tạo header nếu sheet còn trống
    if (sheet.getLastRow() === 0) {
      const headers = [
        'Thời Gian Lưu', 'Username', 'Ngày Vào Lệnh',
        'Cặp', 'Vị Thế', 'Entry', 'Stop Loss', 'Take Profit',
        'Lots', '$ Value', 'Risk $', 'R:R', 'PnL ($)',
        'Trạng Thái', 'Ghi Chú', 'Setup Tag'
      ];
      sheet.appendRow(headers);

      // Định dạng header
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#0D1322');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      headerRange.setFontSize(10);
      sheet.setFrozenRows(1);
    }

    // Ghi dòng dữ liệu mới
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
      data.setupTag || ''
    ];

    sheet.appendRow(row);

    // Tô màu dòng theo kết quả
    const lastRow = sheet.getLastRow();
    const rowRange = sheet.getRange(lastRow, 1, 1, row.length);
    const status = (data.status || '').toUpperCase();
    if (status === 'WIN') {
      rowRange.setBackground('#0D2B1D'); // xanh đậm
    } else if (status === 'LOSS') {
      rowRange.setBackground('#2B0D15'); // đỏ đậm
    } else if (status === 'BE') {
      rowRange.setBackground('#1A1A0D'); // vàng đậm
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, row: lastRow }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Kiểm tra GET (để test xem script đang chạy)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'DNC Trading OS Sheet API is running ✅' }))
    .setMimeType(ContentService.MimeType.JSON);
}
