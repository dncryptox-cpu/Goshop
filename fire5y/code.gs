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
const SHEET_NAV_HISTORY = 'NAV_History';
const SHEET_TRADE_JOURNAL = 'Nhat_Ky_Trade';
const SHEET_CRYPTO_PORTFOLIO = 'Portfolio_Crypto';

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
  sheetUsers.appendRow(['Username', 'Password_Hash', 'Sheet_URL', 'Gemini_Key', 'Ngay_Tao', 'NextRace_Ten', 'NextRace_Ngay']);
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
  sheetAccounts.appendRow(['Tên tài khoản', 'Loại', 'Số dư đầu kỳ', 'Số dư hiện tại', 'Vốn đã nạp ròng']);
  formatHeaderRow(sheetAccounts, '1565D8');
  
  const sampleAccounts = [
    ['Tiền mặt', 'Tiền mặt', 1000000, 1000000, 0],
    ['Tài khoản Ngân hàng', 'Ngân hàng', 10000000, 10000000, 0],
    ['Ví Ví Momo/ZaloPay', 'Ví điện tử', 2000000, 2000000, 0],
    ['Binance Crypto', 'Sàn Trading/Crypto', 50000000, 50000000, 50000000]
  ];
  sheetAccounts.getRange(2, 1, sampleAccounts.length, 5).setValues(sampleAccounts);

  // --- 4. Tab "NAV_History" ---
  let sheetNAV = getOrCreateSheet(ss, SHEET_NAV_HISTORY);
  sheetNAV.clear();
  sheetNAV.appendRow(['Ngày', 'Tài khoản', 'NAV', 'Vốn đã nạp ròng']);
  formatHeaderRow(sheetNAV, '1565D8');
  sheetNAV.getRange("C2:D").setNumberFormat("#,##0");

  // --- 5. Tab "Nhat_Ky_Trade" ---
  let sheetJournal = getOrCreateSheet(ss, SHEET_TRADE_JOURNAL);
  sheetJournal.clear();
  sheetJournal.appendRow(['ID', 'Ngày', 'Tài khoản', 'Symbol', 'Hướng', 'Giá vào', 'Giá ra', 'Khối lượng', 'P&L', 'Setup_PriceAction', 'Trạng thái']);
  formatHeaderRow(sheetJournal, '1565D8');
  sheetJournal.getRange("F2:I").setNumberFormat("#,##0.##");

  // --- 6. Tab "Portfolio_Crypto" ---
  let sheetPort = getOrCreateSheet(ss, SHEET_CRYPTO_PORTFOLIO);
  sheetPort.clear();
  sheetPort.appendRow(['Tài khoản', 'Mã Coin', 'Số lượng', 'Giá vốn trung bình', 'Giá hiện tại', 'Ngày cập nhật']);
  formatHeaderRow(sheetPort, '1565D8');
  sheetPort.getRange("C2:E").setNumberFormat("#,##0.##");

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
function recalculateAccountBalances(ssInput) {
  try {
    const ss = ssInput || getTargetSpreadsheet();
    if (!ss) return;

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

const DEFAULT_MASTER_SHEET_ID = "1Y5NbQzvhdoie92Yg_iCxz8kGgODF3D0wCUpUS-fgjXE";

function getTargetSpreadsheet(user) {
  if (user) {
    const uInfo = getUserRecord(user);
    if (uInfo && uInfo.sheetUrl) {
      try {
        return SpreadsheetApp.openByUrl(uInfo.sheetUrl);
      } catch (e) {
        Logger.log("openByUrl error: " + e.toString());
      }
    }
  }

  // Fallback to active spreadsheet or open master sheet by ID
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    try {
      ss = SpreadsheetApp.openById(DEFAULT_MASTER_SHEET_ID);
    } catch (e) {
      throw new Error("Không thể mở Google Sheet Master (" + DEFAULT_MASTER_SHEET_ID + "): " + e.toString());
    }
  }
  return ss;
}

// ==========================================
// 4. API DISPATCHER (doPost & doGet)
// ==========================================

function doGet(e) {
  return respondJSON({ status: "success", message: "FIRE5Y OS API v2.0 is running." });
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
      if (data.nextRaceName !== undefined) sheetUsers.getRange(uInfo.rowIndex, 6).setValue(data.nextRaceName);
      if (data.nextRaceDate !== undefined) sheetUsers.getRange(uInfo.rowIndex, 7).setValue(data.nextRaceDate);

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

    // --- CRUD Tab Tài Khoản & NAV Trading ---
    if (action === 'get_accounts') return handleGetAccounts(data);
    if (action === 'add_account') return handleAddAccount(data);
    if (action === 'update_account') return handleUpdateAccount(data);
    if (action === 'delete_account') return handleDeleteAccount(data);
    if (action === 'update_nav') return handleUpdateNAV(data);
    if (action === 'get_nav_history') return handleGetNAVHistory(data);

    // --- CRUD Tab Nhật Ký Trade (Nhat_Ky_Trade) ---
    if (action === 'get_trade_journal') return handleGetTradeJournal(data);
    if (action === 'add_trade_journal') return handleAddTradeJournal(data);
    if (action === 'update_trade_journal') return handleUpdateTradeJournal(data);
    if (action === 'delete_trade_journal') return handleDeleteTradeJournal(data);

    // --- CRUD Tab Portfolio Altcoin (Portfolio_Crypto) ---
    if (action === 'get_crypto_portfolio') return handleGetCryptoPortfolio(data);
    if (action === 'update_crypto_portfolio') return handleUpdateCryptoPortfolio(data);

    return respondJSON({ status: "error", message: "Action không hợp lệ: " + action });

  } catch (err) {
    return respondJSON({ status: "error", message: err.toString() });
  }
}

// ==========================================
// 5. HAM XỬ LÝ NHIỆM VỤ DỮ LIỆU
// ==========================================

function handleAddTransactionsBatch(data) {
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(5000);
  if (!acquired) {
    return respondJSON({ status: "error", message: "Lỗi Backend Apps Script: Lock timeout (5s - khóa ghi dữ liệu đang bận). Vui lòng thử lại sau giây lát." });
  }

  try {
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
      const account = item.account || 'Tài khoản Ngân hàng';
      const description = item.description || '';
      const source = item.source || 'Tay';
      const status = item.status || 'Confirmed';

      return [id, dateStr, type, amount, category, account, description, source, status];
    });

    const startRow = getRealLastRow(sheetData, 1) + 1;
    sheetData.getRange(startRow, 1, rowsToAppend.length, 9).setValues(rowsToAppend);

    // Tự động tính toán lại số dư sau khi thêm đơn mới (Truyền tham số ss để không bị null trong Web App)
    recalculateAccountBalances(ss);

    return respondJSON({
      status: "success",
      addedCount: rowsToAppend.length,
      message: `Đã lưu thành công ${rowsToAppend.length} giao dịch!`
    });

  } catch (err) {
    return respondJSON({ status: "error", message: err.toString() });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
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
  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  return respondJSON({ status: "success", data: values.map(r => ({
    name: String(r[0]),
    type: String(r[1]),
    initialBalance: Number(r[2]) || 0,
    currentBalance: Number(r[3]) || 0,
    netCapital: Number(r[4]) || 0
  })) });
}

function handleAddAccount(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheet = ss.getSheetByName(SHEET_ACCOUNTS);
  const initial = Number(data.initialBalance) || 0;
  const netCapital = Number(data.netCapital) || 0;
  sheet.appendRow([data.name, data.type || 'Tài khoản', initial, initial, netCapital]);
  recalculateAccountBalances(ss);
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
      if (data.netCapital !== undefined) sheet.getRange(i + 2, 5).setValue(Number(data.netCapital));
      recalculateAccountBalances(ss);
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
      recalculateAccountBalances(ss);
      return respondJSON({ status: "success", message: "Xóa tài khoản thành công!" });
    }
  }
  return respondJSON({ status: "error", message: "Không tìm thấy tài khoản." });
}

// Cập nhật NAV & Vốn nạp ròng cho tài khoản Trading/Crypto
function handleUpdateNAV(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheetAccounts = ss.getSheetByName(SHEET_ACCOUNTS);
  let sheetNAV = getOrCreateSheet(ss, SHEET_NAV_HISTORY);

  const accName = data.accountName;
  const navAmt = Number(data.navAmount) || 0;
  const netCapitalAmt = Number(data.netCapitalAmount) || 0;
  const dateStr = data.date || Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone() || "GMT+7", "yyyy-MM-dd");

  if (!accName) return respondJSON({ status: "error", message: "Tên tài khoản không được để trống." });

  // 1. Cập nhật tab "Tài Khoản" (Số dư hiện tại = NAV, Vốn đã nạp ròng)
  const lastRowAcc = getRealLastRow(sheetAccounts, 1);
  let found = false;
  if (lastRowAcc >= 2) {
    const accValues = sheetAccounts.getRange(2, 1, lastRowAcc - 1, 1).getValues();
    for (let i = 0; i < accValues.length; i++) {
      if (accValues[i][0] === accName) {
        sheetAccounts.getRange(i + 2, 4).setValue(navAmt); // Số dư hiện tại = NAV
        sheetAccounts.getRange(i + 2, 5).setValue(netCapitalAmt); // Vốn đã nạp ròng
        found = true;
        break;
      }
    }
  }

  // 2. APPEND 1 dòng mới vào tab "NAV_History" (KHÔNG ghi đè)
  sheetNAV.appendRow([dateStr, accName, navAmt, netCapitalAmt]);

  recalculateAccountBalances(ss);

  return respondJSON({
    status: "success",
    message: `Đã cập nhật NAV thành công cho ${accName} (${navAmt.toLocaleString('vi-VN')} VND)!`
  });
}

function handleGetNAVHistory(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheetNAV = ss.getSheetByName(SHEET_NAV_HISTORY);
  if (!sheetNAV) return respondJSON({ status: "success", data: [] });

  const lastRow = getRealLastRow(sheetNAV, 1);
  if (lastRow < 2) return respondJSON({ status: "success", data: [] });

  const values = sheetNAV.getRange(2, 1, lastRow - 1, 4).getValues();
  const list = values.map(r => ({
    date: r[0] instanceof Date ? Utilities.formatDate(r[0], "GMT+7", "yyyy-MM-dd") : String(r[0]),
    account: String(r[1]),
    nav: Number(r[2]) || 0,
    netCapital: Number(r[3]) || 0
  }));

  return respondJSON({ status: "success", data: list });
}

// ==========================================
// 5.5. NHẬT KÝ TRADE (Nhat_Ky_Trade) & PORTFOLIO ALTCOIN (Portfolio_Crypto)
// ==========================================

function handleGetTradeJournal(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheet = getOrCreateSheet(ss, SHEET_TRADE_JOURNAL);
  const lastRow = getRealLastRow(sheet, 1);
  if (lastRow < 2) return respondJSON({ status: "success", data: [] });

  const values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  const list = values.map(r => ({
    id: String(r[0]),
    date: r[1] instanceof Date ? Utilities.formatDate(r[1], "GMT+7", "yyyy-MM-dd") : String(r[1]),
    account: String(r[2]),
    symbol: String(r[3]),
    direction: String(r[4]),
    entryPrice: Number(r[5]) || 0,
    exitPrice: r[6] !== "" && r[6] !== null ? Number(r[6]) : null,
    size: Number(r[7]) || 0,
    pnl: r[8] !== "" && r[8] !== null ? Number(r[8]) : null,
    setup: String(r[9] || ''),
    status: String(r[10] || 'Đang mở')
  }));

  return respondJSON({ status: "success", data: list });
}

function handleAddTradeJournal(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheet = getOrCreateSheet(ss, SHEET_TRADE_JOURNAL);
  const id = 'TJ' + new Date().getTime();
  const dateStr = data.date || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
  const acc = data.account || 'Sàn Trading/Crypto';
  const symbol = String(data.symbol || '').toUpperCase();
  const direction = String(data.direction || 'Long');
  const entryPrice = Number(data.entryPrice) || 0;
  const exitPrice = data.exitPrice !== undefined && data.exitPrice !== null && data.exitPrice !== '' ? Number(data.exitPrice) : null;
  const size = Number(data.size) || 0;
  const setup = data.setup || '';
  const status = data.status || (exitPrice !== null ? 'Đã đóng' : 'Đang mở');

  let pnl = null;
  if (exitPrice !== null) {
    const factor = (direction.toLowerCase() === 'long') ? 1 : -1;
    pnl = (exitPrice - entryPrice) * size * factor;
  }

  sheet.appendRow([id, dateStr, acc, symbol, direction, entryPrice, exitPrice !== null ? exitPrice : '', size, pnl !== null ? pnl : '', setup, status]);

  return respondJSON({ status: "success", message: "Đã ghi nhật ký trade thành công!", id });
}

function handleUpdateTradeJournal(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheet = getOrCreateSheet(ss, SHEET_TRADE_JOURNAL);
  const lastRow = getRealLastRow(sheet, 1);
  if (lastRow < 2) return respondJSON({ status: "error", message: "Không tìm thấy lệnh!" });

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(data.id)) {
      const rowIndex = i + 2;
      const direction = String(data.direction || sheet.getRange(rowIndex, 5).getValue());
      const entryPrice = Number(data.entryPrice !== undefined ? data.entryPrice : sheet.getRange(rowIndex, 6).getValue()) || 0;
      const size = Number(data.size !== undefined ? data.size : sheet.getRange(rowIndex, 8).getValue()) || 0;
      const exitPrice = data.exitPrice !== undefined && data.exitPrice !== null && data.exitPrice !== '' ? Number(data.exitPrice) : null;
      const status = data.status || (exitPrice !== null ? 'Đã đóng' : 'Đang mở');

      let pnl = null;
      if (exitPrice !== null) {
        const factor = (direction.toLowerCase() === 'long') ? 1 : -1;
        pnl = (exitPrice - entryPrice) * size * factor;
      }

      sheet.getRange(rowIndex, 5).setValue(direction);
      sheet.getRange(rowIndex, 6).setValue(entryPrice);
      sheet.getRange(rowIndex, 7).setValue(exitPrice !== null ? exitPrice : '');
      sheet.getRange(rowIndex, 8).setValue(size);
      sheet.getRange(rowIndex, 9).setValue(pnl !== null ? pnl : '');
      if (data.setup) sheet.getRange(rowIndex, 10).setValue(data.setup);
      sheet.getRange(rowIndex, 11).setValue(status);

      return respondJSON({ status: "success", message: "Đã cập nhật lệnh trade thành công!" });
    }
  }
  return respondJSON({ status: "error", message: "Không tìm thấy ID lệnh!" });
}

function handleDeleteTradeJournal(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheet = getOrCreateSheet(ss, SHEET_TRADE_JOURNAL);
  const lastRow = getRealLastRow(sheet, 1);
  if (lastRow < 2) return respondJSON({ status: "error", message: "Không tìm thấy lệnh!" });

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(data.id)) {
      sheet.deleteRow(i + 2);
      return respondJSON({ status: "success", message: "Đã xóa lệnh trade!" });
    }
  }
  return respondJSON({ status: "error", message: "Không tìm thấy ID lệnh!" });
}

// Portfolio Crypto Handlers
function handleGetCryptoPortfolio(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheet = getOrCreateSheet(ss, SHEET_CRYPTO_PORTFOLIO);
  const lastRow = getRealLastRow(sheet, 1);
  if (lastRow < 2) return respondJSON({ status: "success", data: [] });

  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  let list = values.map(r => ({
    account: String(r[0]),
    symbol: String(r[1]),
    qty: Number(r[2]) || 0,
    buyPrice: Number(r[3]) || 0,
    currentPrice: Number(r[4]) || 0,
    updatedAt: r[5] instanceof Date ? Utilities.formatDate(r[5], "GMT+7", "yyyy-MM-dd") : String(r[5] || '')
  }));

  if (data.accountName) {
    list = list.filter(item => item.account === data.accountName);
  }

  return respondJSON({ status: "success", data: list });
}

function handleUpdateCryptoPortfolio(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sheetPort = getOrCreateSheet(ss, SHEET_CRYPTO_PORTFOLIO);
  const sheetAcc = ss.getSheetByName(SHEET_ACCOUNTS);
  const accName = data.accountName;
  const items = data.items || [];
  const dateStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");

  if (!accName) return respondJSON({ status: "error", message: "Tên tài khoản không được để trống." });

  // 1. Xóa các dòng cũ của accountName trong Portfolio_Crypto
  const lastRowPort = getRealLastRow(sheetPort, 1);
  if (lastRowPort >= 2) {
    const accColVals = sheetPort.getRange(2, 1, lastRowPort - 1, 1).getValues();
    for (let i = accColVals.length - 1; i >= 0; i--) {
      if (String(accColVals[i][0]) === String(accName)) {
        sheetPort.deleteRow(i + 2);
      }
    }
  }

  // 2. Thêm các dòng coin mới
  let totalAccountNAV = 0;
  items.forEach(it => {
    const sym = String(it.symbol || '').toUpperCase();
    const q = Number(it.qty) || 0;
    const bp = Number(it.buyPrice) || 0;
    const cp = Number(it.currentPrice) || 0;
    const coinVal = q * cp;
    totalAccountNAV += coinVal;

    sheetPort.appendRow([accName, sym, q, bp, cp, dateStr]);
  });

  // 3. Tự động cập nhật "Số dư hiện tại" (NAV) trong tab "Tài Khoản" cho tài khoản này
  const lastRowAcc = getRealLastRow(sheetAcc, 1);
  if (lastRowAcc >= 2) {
    const accNames = sheetAcc.getRange(2, 1, lastRowAcc - 1, 1).getValues();
    for (let i = 0; i < accNames.length; i++) {
      if (String(accNames[i][0]) === String(accName)) {
        sheetAcc.getRange(i + 2, 4).setValue(totalAccountNAV);
        break;
      }
    }
  }

  recalculateAccountBalances(ss);

  return respondJSON({
    status: "success",
    message: `Đã cập nhật danh mục Altcoin Crypto cho ${accName}! Tổng giá trị NAV mới: ${totalAccountNAV.toLocaleString('vi-VN')} VND`,
    totalValue: totalAccountNAV
  });
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
    'Trạng Thái Hệ Thống FIRE5Y OS',
    ` Hệ thống hoạt động tốt!\n\n` +
    `- Tổng số giao dịch: ${dataRows > 0 ? dataRows : 0}\n` +
    `- Số lượng tài khoản: ${accountRows > 0 ? accountRows : 0}\n` +
    `- Anchor Scan Engine: Ready\n` +
    `- Spreadsheet ID: ${ss ? ss.getId() : 'N/A'}`,
    ui.ButtonSet.OK
  );
}

function respondJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
