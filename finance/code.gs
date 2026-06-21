const SHEET_DATA = 'Dữ liệu';
const SHEET_DS = 'DS';

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_DATA);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_DATA);
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
    let sheet = ss.getSheetByName(SHEET_DATA) || ss.getSheets()[0];
    
    if (!date || !type || !amount) {
      throw new Error("Thiếu trường dữ liệu bắt buộc");
    }

    const signedAmount = (type === "Chi") ? -amount : amount;

    // Tìm hàng trống đầu tiên ở cột A
    const columnA = sheet.getRange('A:A').getValues();
    let emptyRow = 1;
    for (let i = 0; i < columnA.length; i++) {
      if (!columnA[i][0]) {
        emptyRow = i + 1;
        break;
      }
    }

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
    
    // 1. Fetch Transactions
    let sheetData = ss.getSheetByName(SHEET_DATA) || ss.getSheets()[0];
    const columnA = sheetData.getRange('A:A').getValues();
    let lastRow = 0;
    for (let i = 0; i < columnA.length; i++) {
      if (columnA[i][0]) lastRow = i + 1;
    }

    let transactions = [];
    if (lastRow > 1) {
      const data = sheetData.getRange(2, 1, lastRow - 1, 5).getValues();
      transactions = data.map(row => {
        const amt = Number(row[2]) || 0; 
        return {
          date: row[0],             
          category: row[1],         
          amount: Math.abs(amt),    
          type: amt >= 0 ? "Thu" : "Chi", 
          phanLoai: row[3],         
          note: row[4]              
        };
      });
      transactions.reverse();
    }

    // 2. Fetch Categories from DS sheet
    let dsCategories = [];
    let sheetDS = ss.getSheetByName(SHEET_DS);
    if (sheetDS) {
      const dsData = sheetDS.getDataRange().getValues();
      // Skip header row 1, start from index 1
      for (let i = 1; i < dsData.length; i++) {
        if (dsData[i][0]) { 
          dsCategories.push({
            name: dsData[i][0].toString().trim(),      // Nội dung
            type: dsData[i][1] ? dsData[i][1].toString().trim() : "Chi", // Thu/Chi
            phanLoai: dsData[i][2] ? dsData[i][2].toString().trim() : "Khác" // Phân loại
          });
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: transactions,
      categories: dsCategories
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
