const SHEET_NAME = 'Sheet1'; // Bạn có thể đổi tên Sheet nếu cần

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }
  // Setup headers if empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Ngày', 'Loại', 'Hạng mục', 'Số tiền', 'Ghi chú']);
    sheet.getRange('A1:E1').setFontWeight('bold');
  }
}

// Xử lý yêu cầu POST (Thêm giao dịch mới)
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const date = data.date;
    const type = data.type; // "Thu" hoặc "Chi"
    const category = data.category;
    const amount = Number(data.amount);
    const note = data.note || "";

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    
    // Validate required fields
    if (!date || !type || !amount) {
      throw new Error("Thiếu trường dữ liệu bắt buộc");
    }

    sheet.appendRow([date, type, category, amount, note]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Lưu giao dịch thành công!"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Xử lý yêu cầu GET (Lấy danh sách giao dịch)
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    
    const data = sheet.getDataRange().getValues();
    
    // Remove headers
    if (data.length > 0) {
      data.shift();
    }
    
    const transactions = data.map(row => {
      return {
        date: row[0], // Định dạng ngày có thể cần format lại ở frontend
        type: row[1],
        category: row[2],
        amount: row[3],
        note: row[4]
      };
    });

    // Sắp xếp mới nhất lên đầu
    transactions.reverse();

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: transactions
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Xử lý preflight CORS (OPTIONS)
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
