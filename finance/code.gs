const SHEET_DATA = 'Dữ liệu';
const SHEET_DS = 'DS';
const SHEET_USERS = 'NguoiDung';

// Lấy thông tin user từ Sheet tổng của Admin
function getUserInfo(user) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetUsers = ss.getSheetByName(SHEET_USERS);
  if (!sheetUsers) return null;
  const data = sheetUsers.getDataRange().getValues();
  // Bỏ qua dòng 1 (header), duyệt từ dòng 2
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == user) {
      return {
        pass: data[i][1],
        sheetUrl: data[i][2],
        geminiKey: data[i][3]
      };
    }
  }
  return null;
}

// Mở Spreadsheet đích của user (nếu có URL) hoặc dùng Spreadsheet mặc định
function getTargetSpreadsheet(user) {
  if (!user) return SpreadsheetApp.getActiveSpreadsheet();
  const uInfo = getUserInfo(user);
  if (!uInfo || !uInfo.sheetUrl) return SpreadsheetApp.getActiveSpreadsheet();
  try {
    return SpreadsheetApp.openByUrl(uInfo.sheetUrl);
  } catch(e) {
    throw new Error("Không thể truy cập Google Sheet của bạn. Vui lòng cấp quyền (Share) Sheet cho tài khoản của Admin.");
  }
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetUsers = ss.getSheetByName(SHEET_USERS);
  if (!sheetUsers) {
    sheetUsers = ss.insertSheet(SHEET_USERS);
    sheetUsers.appendRow(['user', 'pass', 'Sheet', 'API']);
    sheetUsers.getRange('A1:D1').setFontWeight('bold');
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // 1. Xử lý Đăng nhập
    if (data.action === 'login') {
      const uInfo = getUserInfo(data.user);
      if (uInfo && uInfo.pass == data.pass) {
        return ContentService.createTextOutput(JSON.stringify({ 
          status: "success",
          geminiKey: uInfo.geminiKey || ""
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Sai tài khoản hoặc mật khẩu" })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 2. Xử lý Thêm Nhiều Giao Dịch (Bulk)
    if (data.action === 'add_bulk') {
      const user = data.user;
      const targetSS = getTargetSpreadsheet(user);
      let sheet = targetSS.getSheetByName(SHEET_DATA) || targetSS.getSheets()[0];
      
      const columnA = sheet.getRange('A:A').getValues();
      let emptyRow = 1;
      for (let i = 0; i < columnA.length; i++) {
        if (!columnA[i][0]) {
          emptyRow = i + 1;
          break;
        }
      }

      const rowsToInsert = data.transactions.map(t => {
        // AI format: YYYY-MM-DD
        const [yyyy, mm, dd] = t.date.split('-');
        const formattedDate = `${dd}/${mm}/${yyyy}`; // Chuyển về format hiển thị DD/MM/YYYY cho Sheet
        
        const amt = Number(t.amount) || 0;
        const signedAmount = (t.type === "Chi") ? -amt : amt;
        return [formattedDate, t.category, signedAmount, t.phanLoai || "Khác", t.note || ""];
      });

      if (rowsToInsert.length > 0) {
        sheet.getRange(emptyRow, 1, rowsToInsert.length, 5).setValues(rowsToInsert);
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: `Lưu ${rowsToInsert.length} giao dịch thành công!`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Xử lý Thêm Giao dịch Đơn (Single)
    const date = data.date;
    const type = data.type; 
    const category = data.category; 
    const amount = Number(data.amount);
    const phanLoai = data.phanLoai || "Cá nhân"; 
    const note = data.note || ""; 
    const user = data.user;

    const targetSS = getTargetSpreadsheet(user);
    let sheet = targetSS.getSheetByName(SHEET_DATA) || targetSS.getSheets()[0];
    
    if (!date || !type || !amount) {
      throw new Error("Thiếu trường dữ liệu bắt buộc");
    }

    const [yyyy, mm, dd] = date.split('-');
    const formattedDate = `${dd}/${mm}/${yyyy}`; 

    const signedAmount = (type === "Chi") ? -amount : amount;

    const columnA = sheet.getRange('A:A').getValues();
    let emptyRow = 1;
    for (let i = 0; i < columnA.length; i++) {
      if (!columnA[i][0]) {
        emptyRow = i + 1;
        break;
      }
    }

    sheet.getRange(emptyRow, 1, 1, 5).setValues([[formattedDate, category, signedAmount, phanLoai, note]]);

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
    const user = e.parameter.user;
    const targetSS = getTargetSpreadsheet(user);
    
    // Fetch Dữ liệu
    let sheetData = targetSS.getSheetByName(SHEET_DATA) || targetSS.getSheets()[0];
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

    // Fetch Danh sách DS
    let dsCategories = [];
    let sheetDS = targetSS.getSheetByName(SHEET_DS);
    if (sheetDS) {
      const dsData = sheetDS.getDataRange().getValues();
      for (let i = 1; i < dsData.length; i++) {
        if (dsData[i][0]) { 
          dsCategories.push({
            name: dsData[i][0].toString().trim(),      
            type: dsData[i][1] ? dsData[i][1].toString().trim() : "Chi", 
            phanLoai: dsData[i][2] ? dsData[i][2].toString().trim() : "Khác" 
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
