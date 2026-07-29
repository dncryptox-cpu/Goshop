/**
 * EN TERMINAL - GOOGLE APPS SCRIPT WEB APP BACKEND
 * Bound to Google Spreadsheet ID: 1gZ5sevZrKGzcL7ap0IBdyO3NdymkovwjDOQfC9xQf4o
 * 
 * Instructions:
 * 1. Open Google Sheet: https://docs.google.com/spreadsheets/d/1gZ5sevZrKGzcL7ap0IBdyO3NdymkovwjDOQfC9xQf4o/edit#gid=537818933
 * 2. Click Extensions -> Apps Script (Tiện ích mở rộng -> Apps Script)
 * 3. Replace all code in Code.gs with this exact script.
 * 4. Click Deploy -> New deployment -> Select type: Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the generated Web App URL (ending with /exec) and paste into EN Terminal!
 */

function doGet(e) {
  return respondJSON({
    status: "online",
    message: "EN Terminal Apps Script Backend is running.",
    spreadsheetId: "1gZ5sevZrKGzcL7ap0IBdyO3NdymkovwjDOQfC9xQf4o"
  });
}

function doPost(e) {
  try {
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action;
    var username = contents.username;
    var password = contents.password;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var userSheet = ss.getSheetByName("Users");
    if (!userSheet) {
      userSheet = ss.insertSheet("Users");
      userSheet.appendRow(["username", "password", "data", "updatedAt"]);
    }

    if (action === "register") {
      var data = userSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === username) {
          return respondJSON({ status: "error", message: "Tên đăng nhập đã tồn tại trên hệ thống!" });
        }
      }
      var defaultData = JSON.stringify({
        progress: { lastCompletedDate: null, lastCheckDate: getTodayDateString(), streak: 0, stakeAmount: 50000, totalBurned: 0, totalPreserved: 0 },
        journal: [],
        speaking: [],
        srs: []
      });
      userSheet.appendRow([username, password, defaultData, new Date().toISOString()]);
      return respondJSON({ status: "success", message: "Đăng ký tài khoản thành công!", data: JSON.parse(defaultData) });
    }

    if (action === "login") {
      var data = userSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === username) {
          if (data[i][1] === password) {
            var userData = data[i][2] ? JSON.parse(data[i][2]) : {};
            return respondJSON({ status: "success", message: "Đăng nhập thành công!", data: userData });
          } else {
            return respondJSON({ status: "error", message: "Mật khẩu không chính xác!" });
          }
        }
      }
      return respondJSON({ status: "error", message: "Tài khoản không tồn tại!" });
    }

    if (action === "getData") {
      var data = userSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === username && data[i][1] === password) {
          var userData = data[i][2] ? JSON.parse(data[i][2]) : {};
          return respondJSON({ status: "success", data: userData });
        }
      }
      return respondJSON({ status: "error", message: "Phiên đăng nhập không hợp lệ hoặc sai mật khẩu!" });
    }

    if (action === "saveData") {
      var data = userSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === username && data[i][1] === password) {
          userSheet.getRange(i + 1, 3).setValue(JSON.stringify(contents.data));
          userSheet.getRange(i + 1, 4).setValue(new Date().toISOString());
          return respondJSON({ status: "success", message: "Đã lưu dữ liệu lên Google Sheet!" });
        }
      }
      return respondJSON({ status: "error", message: "Không tìm thấy tài khoản để lưu dữ liệu." });
    }

    return respondJSON({ status: "error", message: "Hành động không hợp lệ." });
  } catch (err) {
    return respondJSON({ status: "error", message: "Lỗi Google Apps Script: " + err.toString() });
  }
}

function respondJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTodayDateString() {
  var d = new Date();
  var month = "" + (d.getMonth() + 1);
  var day = "" + d.getDate();
  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;
  return [d.getFullYear(), month, day].join("-");
}
