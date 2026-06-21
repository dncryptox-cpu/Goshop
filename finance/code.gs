const SHEET_NAME = 'Sheet1';

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }
  // Setup headers if empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Ngày tháng năm', 'Nội dung', 'Thu/ chi', 'Phân loại', 'chi tiết']);
    sheet.getRange('A1:E1').setFontWeight('bold');
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const date = data.date;
    const type = data.type; // "Thu" hoặc "Chi"
    const category = data.category; // Nội dung (Cột B)
    const amount = Number(data.amount);
    const phanLoai = data.phanLoai || "Cá nhân"; // Phân loại (Cột D)
    const note = data.note || ""; // Chi tiết (Cột E)

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    
    if (!date || !type || !amount) {
      throw new Error("Thiếu trường dữ liệu bắt buộc");
    }

    // Nếu là "Chi", số tiền mang dấu âm. Nếu "Thu", số tiền mang dấu dương.
    const signedAmount = (type === "Chi") ? -amount : amount;

    // Tìm hàng trống đầu tiên ở cột A (để không bị nhảy xuống dưới cùng nếu có format/công thức dư thừa)
    const columnA = sheet.getRange('A:A').getValues();
    let emptyRow = 1;
    for (let i = 0; i < columnA.length; i++) {
      if (!columnA[i][0]) {
        emptyRow = i + 1;
        break;
      }
    }

    // Ghi dữ liệu theo thứ tự: Ngày, Nội dung, Thu/chi, Phân loại, Chi tiết
    sheet.getRange(emptyRow, 1, 1, 5).setValues([[date, category, signedAmount, phanLoai, note]]);

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

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    
    // Tìm hàng trống cuối cùng ở cột A để chỉ lấy data có thật
    const columnA = sheet.getRange('A:A').getValues();
    let lastRow = 0;
    for (let i = 0; i < columnA.length; i++) {
      if (columnA[i][0]) lastRow = i + 1;
    }

    if (lastRow <= 1) {
       return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        data: []
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    
    const transactions = data.map(row => {
      const amt = Number(row[2]) || 0; // Cột C: Thu/chi
      return {
        date: row[0],             // Cột A
        category: row[1],         // Cột B (Nội dung)
        amount: Math.abs(amt),    // Số tiền tuyệt đối
        type: amt >= 0 ? "Thu" : "Chi", // Dấu để biết thu hay chi
        phanLoai: row[3],         // Cột D (Phân loại)
        note: row[4]              // Cột E (Chi tiết)
      };
    });

    // Mới nhất lên đầu
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

function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
}
