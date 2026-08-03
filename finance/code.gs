/**
 * LOVELY MONEY - FINANCE OS (UNIFIED GOOGLE APPS SCRIPT)
 * File: code.gs (Tất cả trong 1 script duy nhất)
 * Version: 2.0
 * 
 * Mã nguồn gộp đầy đủ bao gồm:
 * 1. Hàm khởi tạo Master Sheet mới (createNewMasterSheet)
 * 2. API Server Endpoint (doPost, doGet) cho Web App (Login, Auth, Batch Transaction, CRUD)
 * 3. Sheet Engine (onOpen, onEdit, Tự động tính Số dư tài khoản, Anchor Scan & Dual-Cache)
 */

// ==========================================
// TÊN CÁC TAB CHUẨN TRONG GOOGLE SHEET
// ==========================================
const SHEET_USERS = 'NguoiDung';
const SHEET_DATA = 'Dữ liệu';
const SHEET_DS = 'DS';
const SHEET_ACCOUNTS = 'Tài Khoản';
const SHEET_AI_RULES = 'AI_Rules';

// ==========================================
// 1. TẠO SHEET MASTER MỚI (SETUP FUNCTION)
// ==========================================

/**
 * Hàm khởi tạo Master Sheet mới hoàn toàn.
 * Chạy hàm này 1 lần duy nhất trên Google Sheet Master.
 */
function createNewMasterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // --- 1. Tab "NguoiDung" ---
  let sheetUsers = getOrCreateSheet(ss, SHEET_USERS);
  sheetUsers.clear();
  sheetUsers.appendRow(['Username', 'Password_Hash', 'Sheet_URL', 'Gemini_Key', 'Ngay_Tao']);
  formatHeaderRow(sheetUsers, '1565D8');
  
  // --- 2. Tab "DS" ---
  let sheetDS = getOrCreateSheet(ss, SHEET_DS);
  sheetDS.clear();
  sheetDS.appendRow(['Tên danh mục', 'Nhóm', 'Loại', 'Ngân sách tháng']);
  formatHeaderRow(sheetDS, '1565D8');
  
  const sampleDS = [
    // Nhóm Ăn uống hàng ngày
    ['Cà phê sáng', 'Ăn uống hàng ngày', 'Chi', 1500000],
    ['Ăn trưa ngoài', 'Ăn uống hàng ngày', 'Chi', 3000000],
    ['Ăn tối', 'Ăn uống hàng ngày', 'Chi', 3000000],
    ['Ăn vặt khác', 'Ăn uống hàng ngày', 'Chi', 1000000],
    // Nhóm Kinh doanh DNC
    ['Doanh thu bán Premium', 'Kinh doanh DNC', 'Thu', 0],
    ['Giá vốn gia hạn subscription', 'Kinh doanh DNC', 'Chi', 0],
    ['Chi phí CTV', 'Kinh doanh DNC', 'Chi', 0],
    ['Chi phí vận hành khác', 'Kinh doanh DNC', 'Chi', 0],
    // Nhóm Ultra Trail & Sức khoẻ
    ['Phí giải đấu', 'Ultra Trail & Sức khoẻ', 'Chi', 2000000],
    ['Trang thiết bị', 'Ultra Trail & Sức khoẻ', 'Chi', 3000000],
    ['Dinh dưỡng & gel', 'Ultra Trail & Sức khoẻ', 'Chi', 1500000],
    ['Coaching/PT', 'Ultra Trail & Sức khoẻ', 'Chi', 2000000],
    ['Hồi phục', 'Ultra Trail & Sức khoẻ', 'Chi', 1000000],
    ['Di chuyển tới giải', 'Ultra Trail & Sức khoẻ', 'Chi', 2000000],
    // Nhóm Sinh hoạt Nha Trang
    ['Thuê nhà', 'Sinh hoạt Nha Trang', 'Chi', 5000000],
    ['Điện nước', 'Sinh hoạt Nha Trang', 'Chi', 1500000],
    ['Di chuyển hàng ngày', 'Sinh hoạt Nha Trang', 'Chi', 1000000],
    ['Giải trí', 'Sinh hoạt Nha Trang', 'Chi', 2000000],
    // Nhóm Khác
    ['Khác', 'Khác', 'Chi', 0]
  ];
  sheetDS.getRange(2, 1, sampleDS.length, 4).setValues(sampleDS);

  // --- 3. Tab "Tài Khoản" ---
  let sheetAccounts = getOrCreateSheet(ss, SHEET_ACCOUNTS);
  sheetAccounts.clear();
  sheetAccounts.appendRow(['Tên tài khoản', 'Loại', 'Số dư đầu kỳ', 'Số dư hiện tại']);
  formatHeaderRow(sheetAccounts, '1565D8');
  
  const sampleAccounts = [
    ['Tiền mặt', 'Tiền mặt', 1000000, 1000000],
    ['Tài khoản Ngân hàng', 'Ngân hàng', 10000000, 10000000],
    ['Ví Ví Momo/ZaloPay', 'Ví điện tử', 2000000, 2000000]
  ];
  sheetAccounts.getRange(2, 1, sampleAccounts.length, 4).setValues(sampleAccounts);

  // --- 4. Tab "Dữ liệu" ---
  let sheetData = getOrCreateSheet(ss, SHEET_DATA);
  sheetData.clear();
  sheetData.appendRow(['ID', 'Ngày', 'Loại', 'Số tiền', 'Danh mục', 'Tài khoản', 'Mô tả', 'Nguồn nhập', 'Trạng thái']);
  formatHeaderRow(sheetData, '1565D8');
  
  // Format Cột D (Số tiền) là dạng số tiền
  sheetData.getRange("D2:D").setNumberFormat("#,##0");
  sheetData.getRange("B2:B").setNumberFormat("yyyy-MM-dd");

  // Data Validation
  const ruleType = SpreadsheetApp.newDataValidation().requireValueInList(['Thu', 'Chi'], true).build();
  sheetData.getRange("C2:C").setDataValidation(ruleType);

  const ruleCategory = SpreadsheetApp.newDataValidation().requireValueInRange(sheetDS.getRange("A2:A"), true).build();
  sheetData.getRange("E2:E").setDataValidation(ruleCategory);

  const ruleAccount = SpreadsheetApp.newDataValidation().requireValueInRange(sheetAccounts.getRange("A2:A"), true).build();
  sheetData.getRange("F2:F").setDataValidation(ruleAccount);

  const ruleSource = SpreadsheetApp.newDataValidation().requireValueInList(['AI', 'Tay'], true).build();
  sheetData.getRange("H2:H").setDataValidation(ruleSource);

  const ruleStatus = SpreadsheetApp.newDataValidation().requireValueInList(['Confirmed', 'Pending'], true).build();
  sheetData.getRange("I2:I").setDataValidation(ruleStatus);

  // Conditional Formatting (Thu = Green, Chi = Red)
  applyConditionalFormatting(sheetData);

  // --- 5. Tab "AI_Rules" ---
  let sheetAIRules = getOrCreateSheet(ss, SHEET_AI_RULES);
  sheetAIRules.clear();
  sheetAIRules.appendRow(['Từ khoá', 'Danh mục gán', 'Tài khoản gán', 'Số lần dùng']);
  formatHeaderRow(sheetAIRules, '1565D8');

  SpreadsheetApp.flush();
  Logger.log('Tạo Master Sheet thành công!');
}

function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  return sheet;
}

function formatHeaderRow(sheet, hexColor) {
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1);
  headerRange.setFontWeight('bold')
             .setBackground('#' + hexColor)
             .setFontColor('#FFFFFF')
             .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 35);
}

function applyConditionalFormatting(sheet) {
  const rangeC = sheet.getRange("C2:C1000");
  
  const ruleGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Thu")
    .setBackground("#d1fae5")
    .setFontColor("#065f46")
    .setRanges([rangeC])
    .build();

  const ruleRed = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Chi")
    .setBackground("#ffe4e6")
    .setFontColor("#9f1239")
    .setRanges([rangeC])
    .build();

  sheet.setConditionalFormatRules([ruleGreen, ruleRed]);
}

// ==========================================
// 2. SHEET TRIGGERS & TỰ ĐỘNG TÍNH SỐ DƯ
// ==========================================

function onOpen(e) {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu(' Lovely Money OS')
    .addItem(' Cập nhật lại số dư tài khoản', 'recalculateAccountBalances')
    .addItem(' Kiểm tra trạng thái hệ thống', 'checkSystemStatus')
    .addToUi();

  recalculateAccountBalances();
}

function onEdit(e) {
  if (!e || !e.range) return;
  const sheetName = e.range.getSheet().getName();
  if (sheetName === SHEET_DATA || sheetName === SHEET_ACCOUNTS) {
    recalculateAccountBalances();
  }
}

/**
 * Hàm tính toán và cập nhật cột "Số dư hiện tại" ở tab "Tài Khoản"
 * Số dư hiện tại = Số dư đầu kỳ + Sum(Thu) - Sum(Chi)
 */
function recalculateAccountBalances() {
  const lock = LockService.getDocumentLock();
  try {
    if (!lock.waitLock(5000)) return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetData = ss.getSheetByName(SHEET_DATA);
    const sheetAccounts = ss.getSheetByName(SHEET_ACCOUNTS);

    if (!sheetAccounts) return;

    const accountsLastRow = getRealLastRow(sheetAccounts, 1);
    if (accountsLastRow < 2) return;

    const accountsData = sheetAccounts.getRange(2, 1, accountsLastRow - 1, 4).getValues();

    const accountMap = {};
    accountsData.forEach(row => {
      const accName = String(row[0]).trim();
      if (accName) {
        accountMap[accName] = { initial: Number(row[2]) || 0, thu: 0, chi: 0 };
      }
    });

    if (sheetData) {
      const dataLastRow = getRealLastRow(sheetData, 1);
      if (dataLastRow >= 2) {
        const rawTransactions = sheetData.getRange(2, 1, dataLastRow - 1, 9).getValues();
        rawTransactions.forEach(row => {
          const type = String(row[2]).trim();     // Cột C: Loại (Thu/Chi)
          const amount = Number(row[3]) || 0;     // Cột D: Số tiền
          const account = String(row[5]).trim();  // Cột F: Tài khoản
          const status = String(row[8]).trim();   // Cột I: Trạng thái

          if (status !== 'Cancelled' && accountMap[account]) {
            if (type === 'Thu') accountMap[account].thu += amount;
            else if (type === 'Chi') accountMap[account].chi += amount;
          }
        });
      }
    }

    const newCurrentBalances = accountsData.map(row => {
      const accName = String(row[0]).trim();
      const accInfo = accountMap[accName];
      if (!accInfo) return [Number(row[3]) || 0];

      const currentBalance = accInfo.initial + accInfo.thu - accInfo.chi;
      setCacheAndProperty(`ACC_BAL_${accName}`, String(currentBalance));
      return [currentBalance];
    });

    sheetAccounts.getRange(2, 4, newCurrentBalances.length, 1).setValues(newCurrentBalances);

  } catch (err) {
    Logger.log("Lỗi tính toán số dư: " + err.toString());
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 3. HELPER BẢO MẬT & TRUY CẤP DATABASE
// ==========================================

function hashPassword(password) {
  if (!password) return '';
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return digest.map(byte => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0')).join('');
}

function getUserRecord(user) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetUsers = ss.getSheetByName(SHEET_USERS);
  if (!sheetUsers) return null;
  
  const data = sheetUsers.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === user) {
      return {
        rowIndex: i + 1,
        username: data[i][0],
        passwordHash: data[i][1],
        sheetUrl: data[i][2],
        geminiKey: data[i][3],
        createdDate: data[i][4]
      };
    }
  }
  return null;
}

function getTargetSpreadsheet(user) {
  if (!user) return SpreadsheetApp.getActiveSpreadsheet();
  const uInfo = getUserRecord(user);
  if (!uInfo || !uInfo.sheetUrl) return SpreadsheetApp.getActiveSpreadsheet();
  try {
    return SpreadsheetApp.openByUrl(uInfo.sheetUrl);
  } catch (e) {
    throw new Error("Không thể mở Google Sheet của bạn. Vui lòng cấp quyền chia sẻ Sheet.");
  }
}

// ==========================================
// 4. API DISPATCHER (doPost & doGet)
// ==========================================

function doGet(e) {
  return respondJSON({ status: "success", message: "Lovely Money Finance OS API v2.0 is running." });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respondJSON({ status: "error", message: "Payload dữ liệu không hợp lệ." });
    }

    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    // --- Authentication ---
    if (action === 'login') {
      const uInfo = getUserRecord(data.user);
      const inputHash = hashPassword(data.pass);
      if (uInfo && uInfo.passwordHash === inputHash) {
        return respondJSON({
          status: "success",
          user: uInfo.username,
          sheetUrl: uInfo.sheetUrl || "",
          geminiKey: uInfo.geminiKey || ""
        });
      } else {
        return respondJSON({ status: "error", message: "Tài khoản hoặc mật khẩu không chính xác." });
      }
    }

    if (action === 'add_user') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetUsers = getOrCreateSheet(ss, SHEET_USERS);
      if (getUserRecord(data.newUser)) {
        return respondJSON({ status: "error", message: "Tên đăng nhập đã tồn tại!" });
      }

      const pwdHash = hashPassword(data.newPass);
      const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      sheetUsers.appendRow([data.newUser, pwdHash, data.newSheetUrl || "", data.newApiKey || "", nowStr]);

      return respondJSON({ status: "success", message: "Tạo tài khoản thành công!" });
    }

    if (action === 'update_user') {
      const uInfo = getUserRecord(data.user);
      if (!uInfo) return respondJSON({ status: "error", message: "Không tìm thấy người dùng." });

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetUsers = ss.getSheetByName(SHEET_USERS);

      if (data.newPass) sheetUsers.getRange(uInfo.rowIndex, 2).setValue(hashPassword(data.newPass));
      if (data.newSheetUrl !== undefined) sheetUsers.getRange(uInfo.rowIndex, 3).setValue(data.newSheetUrl);
      if (data.newApiKey !== undefined) sheetUsers.getRange(uInfo.rowIndex, 4).setValue(data.newApiKey);

      return respondJSON({ status: "success", message: "Cập nhật thông tin tài khoản thành công!" });
    }

    // --- Batch Ghi Giao Dịch ---
    if (action === 'add_transactions_batch') {
      return handleAddTransactionsBatch(data);
    }

    if (action === 'get_transactions') {
      return handleGetTransactions(data);
    }

    // --- CRUD Tab DS ---
    if (action === 'get_ds') return handleGetDS(data);
    if (action === 'add_ds') return handleAddDS(data);
    if (action === 'update_ds') return handleUpdateDS(data);
    if (action === 'delete_ds') return handleDeleteDS(data);

    // --- CRUD Tab Tài Khoản ---
    if (action === 'get_accounts') return handleGetAccounts(data);
    if (action === 'add_account') return handleAddAccount(data);
    if (action === 'update_account') return handleUpdateAccount(data);
    if (action === 'delete_account') return handleDeleteAccount(data);

    return respondJSON({ status: "error", message: "Action không hợp lệ: " + action });

  } catch (err) {
    return respondJSON({ status: "error", message: err.toString() });
  }
}

// ==========================================
// 5. HAM XỬ LÝ NHIỆM VỤ DỮ LIỆU
// ==========================================

function handleAddTransactionsBatch(data) {
  const lock = LockService.getDocumentLock();
  try {
    if (!lock.waitLock(10000)) {
      return respondJSON({ status: "error", message: "Hệ thống bận, vui lòng thử lại sau giây lát." });
    }

    const items = data.items;
    if (!Array.isArray(items) || items.length === 0) {
      return respondJSON({ status: "error", message: "Danh sách giao dịch rỗng." });
    }

    const ss = getTargetSpreadsheet(data.user);
    let sheetData = ss.getSheetByName(SHEET_DATA);
    if (!sheetData) throw new Error("Không tìm thấy tab Dữ liệu.");

    const now = new Date();
    const timeBase = Utilities.formatDate(now, ss.getSpreadsheetTimeZone() || "GMT+7", "yyyyMMddHHmmss");

    const rowsToAppend = items.map((item, index) => {
      const id = timeBase + String(index + 1).padStart(3, '0');
      const dateStr = item.date || Utilities.formatDate(now, ss.getSpreadsheetTimeZone() || "GMT+7", "yyyy-MM-dd");
      const type = item.type === 'Thu' ? 'Thu' : 'Chi';
      const amount = Number(item.amount) || 0;
      const category = item.category || 'Khác';
      const account = item.account || 'Tiền mặt';
      const description = item.description || '';
      const source = item.source || 'Tay';
      const status = item.status || 'Confirmed';

      return [id, dateStr, type, amount, category, account, description, source, status];
    });

    const startRow = getRealLastRow(sheetData, 1) + 1;
    sheetData.getRange(startRow, 1, rowsToAppend.length, 9).setValues(rowsToAppend);

    // Tự động tính toán lại số dư sau khi thêm đơn mới
    recalculateAccountBalances();

    return respondJSON({
      status: "success",
      addedCount: rowsToAppend.length,
      message: `Đã lưu thành công ${rowsToAppend.length} giao dịch!`
    });

  } finally {
    lock.releaseLock();
  }
}

function handleGetTransactions(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheetData = ss.getSheetByName(SHEET_DATA);
  if (!sheetData) return respondJSON({ status: "success", data: [] });

  const lastRow = getRealLastRow(sheetData, 1);
  if (lastRow < 2) return respondJSON({ status: "success", data: [] });

  const raw = sheetData.getRange(2, 1, lastRow - 1, 9).getValues();
  const list = raw.map(row => ({
    id: String(row[0]),
    date: row[1] instanceof Date ? Utilities.formatDate(row[1], "GMT+7", "yyyy-MM-dd") : String(row[1]),
    type: row[2],
    amount: Number(row[3]) || 0,
    category: row[4],
    account: row[5],
    description: row[6],
    source: row[7],
    status: row[8]
  }));

  return respondJSON({ status: "success", data: list });
}

function handleGetDS(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheet = ss.getSheetByName(SHEET_DS);
  if (!sheet) return respondJSON({ status: "success", data: [] });
  const lastRow = getRealLastRow(sheet, 1);
  if (lastRow < 2) return respondJSON({ status: "success", data: [] });
  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  return respondJSON({ status: "success", data: values.map(r => ({ name: r[0], group: r[1], type: r[2], budget: Number(r[3]) || 0 })) });
}

function handleAddDS(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheet = ss.getSheetByName(SHEET_DS);
  sheet.appendRow([data.name, data.group || 'Khác', data.type || 'Chi', Number(data.budget) || 0]);
  return respondJSON({ status: "success", message: "Đã thêm danh mục thành công!" });
}

function handleUpdateDS(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheet = ss.getSheetByName(SHEET_DS);
  const lastRow = getRealLastRow(sheet, 1);
  if (lastRow < 2) return respondJSON({ status: "error", message: "Danh mục không tồn tại" });
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === data.oldName) {
      if (data.name) sheet.getRange(i + 2, 1).setValue(data.name);
      if (data.group) sheet.getRange(i + 2, 2).setValue(data.group);
      if (data.type) sheet.getRange(i + 2, 3).setValue(data.type);
      if (data.budget !== undefined) sheet.getRange(i + 2, 4).setValue(Number(data.budget));
      return respondJSON({ status: "success", message: "Cập nhật danh mục thành công!" });
    }
  }
  return respondJSON({ status: "error", message: "Không tìm thấy danh mục." });
}

function handleDeleteDS(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheet = ss.getSheetByName(SHEET_DS);
  const lastRow = getRealLastRow(sheet, 1);
  if (lastRow < 2) return respondJSON({ status: "error", message: "Danh mục không tồn tại" });
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === data.name) {
      sheet.deleteRow(i + 2);
      return respondJSON({ status: "success", message: "Xóa danh mục thành công!" });
    }
  }
  return respondJSON({ status: "error", message: "Không tìm thấy danh mục." });
}

function handleGetAccounts(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheet = ss.getSheetByName(SHEET_ACCOUNTS);
  if (!sheet) return respondJSON({ status: "success", data: [] });
  const lastRow = getRealLastRow(sheet, 1);
  if (lastRow < 2) return respondJSON({ status: "success", data: [] });
  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  return respondJSON({ status: "success", data: values.map(r => ({ name: r[0], type: r[1], initialBalance: Number(r[2]) || 0, currentBalance: Number(r[3]) || 0 })) });
}

function handleAddAccount(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheet = ss.getSheetByName(SHEET_ACCOUNTS);
  const initial = Number(data.initialBalance) || 0;
  sheet.appendRow([data.name, data.type || 'Tài khoản', initial, initial]);
  recalculateAccountBalances();
  return respondJSON({ status: "success", message: "Đã thêm tài khoản thành công!" });
}

function handleUpdateAccount(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheet = ss.getSheetByName(SHEET_ACCOUNTS);
  const lastRow = getRealLastRow(sheet, 1);
  if (lastRow < 2) return respondJSON({ status: "error", message: "Tài khoản không tồn tại" });
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === data.oldName) {
      if (data.name) sheet.getRange(i + 2, 1).setValue(data.name);
      if (data.type) sheet.getRange(i + 2, 2).setValue(data.type);
      if (data.initialBalance !== undefined) sheet.getRange(i + 2, 3).setValue(Number(data.initialBalance));
      recalculateAccountBalances();
      return respondJSON({ status: "success", message: "Cập nhật tài khoản thành công!" });
    }
  }
  return respondJSON({ status: "error", message: "Không tìm thấy tài khoản." });
}

function handleDeleteAccount(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheet = ss.getSheetByName(SHEET_ACCOUNTS);
  const lastRow = getRealLastRow(sheet, 1);
  if (lastRow < 2) return respondJSON({ status: "error", message: "Tài khoản không tồn tại" });
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === data.name) {
      sheet.deleteRow(i + 2);
      recalculateAccountBalances();
      return respondJSON({ status: "success", message: "Xóa tài khoản thành công!" });
    }
  }
  return respondJSON({ status: "error", message: "Không tìm thấy tài khoản." });
}

// ==========================================
// 6. UTILITY FUNCTIONS & DUAL-LAYER CACHE
// ==========================================

function getRealLastRow(sheet, anchorColumn) {
  if (!sheet) return 0;
  const colIndex = anchorColumn || 1;
  const lastPossibleRow = sheet.getLastRow();
  if (lastPossibleRow === 0) return 0;

  const values = sheet.getRange(1, colIndex, lastPossibleRow, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    const val = values[i][0];
    if (val !== "" && val !== null && val !== undefined) {
      return i + 1;
    }
  }
  return 0;
}

function setCacheAndProperty(key, value) {
  try {
    const cache = CacheService.getScriptCache();
    const props = PropertiesService.getScriptProperties();
    cache.put(key, value, 21600);
    props.setProperty(key, value);
  } catch (e) {
    Logger.log("Cache write error: " + e.toString());
  }
}

function getCacheOrProperty(key) {
  try {
    const cache = CacheService.getScriptCache();
    let val = cache.get(key);
    if (val !== null) return val;

    const props = PropertiesService.getScriptProperties();
    val = props.getProperty(key);
    if (val !== null) {
      cache.put(key, val, 21600);
      return val;
    }
  } catch (e) {
    Logger.log("Cache read error: " + e.toString());
  }
  return null;
}

function checkSystemStatus() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetData = ss.getSheetByName(SHEET_DATA);
  const sheetAccounts = ss.getSheetByName(SHEET_ACCOUNTS);
  const dataRows = sheetData ? getRealLastRow(sheetData, 1) - 1 : 0;
  const accountRows = sheetAccounts ? getRealLastRow(sheetAccounts, 1) - 1 : 0;

  ui.alert(
    'Trạng Thái Hệ Thống Lovely Money',
    ` Hệ thống hoạt động tốt!\n\n` +
    `- Tổng số giao dịch: ${dataRows > 0 ? dataRows : 0}\n` +
    `- Số lượng tài khoản: ${accountRows > 0 ? accountRows : 0}\n` +
    `- Anchor Scan Engine: Ready\n` +
    `- Dual-Layer Cache: Active`,
    ui.ButtonSet.OK
  );
}

function respondJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
