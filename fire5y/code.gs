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
  // CHỐT CHẶN: hàm này XOÁ SẠCH mọi tab. Chỉ chạy trên Sheet trống.
  const _d = ss.getSheetByName(SHEET_DATA), _u = ss.getSheetByName(SHEET_USERS);
  if ((_d && getRealLastRow(_d, 1) > 1) || (_u && getRealLastRow(_u, 1) > 1)) {
    throw new Error('Sheet đã có dữ liệu, không chạy createNewMasterSheet để tránh xoá mất dữ liệu.');
  }
  
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

// Token = HMAC(user | password hash, khoá bí mật trong Script Properties).
// Đổi mật khẩu → token cũ mất hiệu lực. Muốn đăng xuất mọi thiết bị: xoá FIRE5Y_SECRET trong Script Properties.
function authSecret_() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('FIRE5Y_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('FIRE5Y_SECRET', s); }
  return s;
}
function makeToken_(u) {
  const sig = Utilities.computeHmacSha256Signature(String(u.username) + '|' + String(u.passwordHash), authSecret_());
  return Utilities.base64EncodeWebSafe(sig);
}
function verifyToken_(user, token) {
  if (!user || !token) return false;
  const u = getUserRecord(user);
  return !!u && makeToken_(u) === token;
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

    // Tin nhắn Telegram (webhook) — xác thực bằng tham số bí mật trên URL
    if (e.parameter && e.parameter.tg) return handleTelegramUpdate_(e);

    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    // --- Cổng bảo vệ: mọi lệnh (trừ login) phải kèm token do login cấp ---
    if (action === 'add_user') {
      const adminKey = PropertiesService.getScriptProperties().getProperty('FIRE5Y_ADMIN_KEY');
      if (!adminKey || data.adminKey !== adminKey) return respondJSON({ status: "error", code: "AUTH", message: "Không có quyền tạo tài khoản." });
    } else if (action !== 'login') {
      if (!verifyToken_(data.user, data.token)) return respondJSON({ status: "error", code: "AUTH", message: "Phiên đăng nhập không hợp lệ, hãy đăng nhập lại." });
    }

    // --- Authentication ---
    if (action === 'login') {
      const uInfo = getUserRecord(data.user);
      const inputHash = hashPassword(data.pass);
      if (uInfo && uInfo.passwordHash === inputHash) {
        return respondJSON({
          status: "success",
          user: uInfo.username,
          token: makeToken_(uInfo),
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

    if (action === 'upsert_transactions') return handleUpsertTransactions(data);
    if (action === 'delete_transactions') return handleDeleteTransactions(data);

    if (action === 'get_state') return handleGetState(data);
    if (action === 'set_state') return handleSetState(data);

    if (action === 'goshop_days') {
      const map = goshopDayMap_(), out = {};
      Object.keys(map).forEach(d => { if (d >= data.from && d <= data.to) out[d] = { n: map[d].n, profit: map[d].profit, rev: map[d].rev }; });
      return respondJSON({ status: "success", data: out });
    }

    if (action === 'goshop_stats') {
      const out = {};
      (data.periods || []).slice(0, 12).forEach(p => { if (p && p.key && p.from && p.to) out[p.key] = goshopStats_(p.from, p.to); });
      return respondJSON({ status: "success", data: out });
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
      const id = item.id ? String(item.id) : timeBase + String(index + 1).padStart(3, '0');
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
  const list = raw.filter(row => String(row[8]).trim() !== 'Cancelled' && row[0] !== '').map(row => ({
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

// ==========================================
// 7. FIRE5Y APP v3 — ĐỒNG BỘ SỬA/XOÁ THEO ID
// ==========================================
// App v3 tự sinh ID cho mỗi khoản và gửi kèm. upsert: ID đã có thì ghi đè dòng đó, chưa có thì thêm dòng mới.
// delete: không xoá dòng, chỉ đặt Trạng thái = Cancelled (số dư và báo cáo đều bỏ qua dòng Cancelled).

function txRow_(item, tz) {
  return [
    String(item.id),
    item.date || Utilities.formatDate(new Date(), tz, "yyyy-MM-dd"),
    item.type === 'Thu' ? 'Thu' : 'Chi',
    Number(item.amount) || 0,
    item.category || 'Khác',
    item.account || 'Tiền mặt',
    item.description || '',
    item.source || 'FIRE5Y app',
    item.status || 'Confirmed'
  ];
}

function idRowMap_(sheet) {
  const last = getRealLastRow(sheet, 1);
  const map = {};
  if (last < 2) return { map: map, last: last };
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  ids.forEach((r, i) => { if (r[0] !== '') map[String(r[0])] = i + 2; });
  return { map: map, last: last };
}

function handleUpsertTransactions(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return respondJSON({ status: "error", message: "Sheet đang bận ghi, thử lại sau vài giây." });
  try {
    const items = (data.items || []).filter(it => it && it.id);
    if (!items.length) return respondJSON({ status: "success", updated: 0, added: 0 });
    const ss = getTargetSpreadsheet(data.user);
    const sheet = ss.getSheetByName(SHEET_DATA);
    if (!sheet) throw new Error("Không tìm thấy tab Dữ liệu.");
    const tz = ss.getSpreadsheetTimeZone() || "GMT+7";
    const idx = idRowMap_(sheet);
    const toAppend = [];
    let updated = 0;
    items.forEach(it => {
      const row = txRow_(it, tz);
      const r = idx.map[String(it.id)];
      if (r) { sheet.getRange(r, 1, 1, 9).setValues([row]); updated++; }
      else { toAppend.push(row); idx.map[String(it.id)] = -1; }
    });
    if (toAppend.length) sheet.getRange(idx.last + 1, 1, toAppend.length, 9).setValues(toAppend);
    recalculateAccountBalances(ss);
    return respondJSON({ status: "success", updated: updated, added: toAppend.length });
  } catch (err) {
    return respondJSON({ status: "error", message: err.toString() });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function handleDeleteTransactions(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return respondJSON({ status: "error", message: "Sheet đang bận ghi, thử lại sau vài giây." });
  try {
    const ids = (data.ids || []).map(String);
    if (!ids.length) return respondJSON({ status: "success", cancelled: 0 });
    const ss = getTargetSpreadsheet(data.user);
    const sheet = ss.getSheetByName(SHEET_DATA);
    if (!sheet) throw new Error("Không tìm thấy tab Dữ liệu.");
    const idx = idRowMap_(sheet);
    let n = 0;
    ids.forEach(id => { const r = idx.map[id]; if (r) { sheet.getRange(r, 9).setValue('Cancelled'); n++; } });
    recalculateAccountBalances(ss);
    return respondJSON({ status: "success", cancelled: n });
  } catch (err) {
    return respondJSON({ status: "error", message: err.toString() });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ==========================================
// 8. FIRE5Y — NHẮC GHI CHÉP & TỔNG KẾT QUA TELEGRAM
// ==========================================
// Cài một lần trong Project Settings → Script Properties:
//   TG_BOT_TOKEN  = token của bot (vd bot myagent)
//   TG_CHAT_ID    = chat id nhận tin
//   FIRE5Y_USER   = tên đăng nhập FIRE5Y (để biết đọc Sheet nào)
// Sau đó chạy hàm setupFire5yTriggers() một lần.

const TRANSFER_CAT = 'Chuyển khoản';

function setupFire5yTriggers() {
  const names = ['fire5yDailyReminder', 'fire5yWeeklySummary', 'fire5yMonthlySummary'];
  ScriptApp.getProjectTriggers().forEach(t => { if (names.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('fire5yDailyReminder').timeBased().everyDays(1).atHour(21).nearMinute(0).inTimezone('Asia/Ho_Chi_Minh').create();
  ScriptApp.newTrigger('fire5yWeeklySummary').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(20).inTimezone('Asia/Ho_Chi_Minh').create();
  ScriptApp.newTrigger('fire5yMonthlySummary').timeBased().onMonthDay(1).atHour(8).inTimezone('Asia/Ho_Chi_Minh').create();
  sendTelegram_('✅ FIRE5Y đã bật: nhắc ghi chép 21h mỗi ngày, tổng kết tuần tối Chủ nhật, tổng kết tháng sáng ngày 1.');
}

function sendTelegram_(text, plain) {
  const p = PropertiesService.getScriptProperties();
  const token = (p.getProperty('TG_BOT_TOKEN') || '').trim(), chat = (p.getProperty('TG_CHAT_ID') || '').trim();
  if (!token || !chat) throw new Error('Thiếu TG_BOT_TOKEN hoặc TG_CHAT_ID trong Script Properties');
  const body = { chat_id: chat, text: text, disable_web_page_preview: true };
  if (!plain) body.parse_mode = 'HTML';
  const r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(body)
  });
  if (r.getResponseCode() !== 200) {
    console.error('Telegram sendMessage ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
    if (!plain) sendTelegram_(text.replace(/<[^>]+>/g, ''), true); // gửi lại dạng text thường
  }
}

function fire5yRows_() {
  const user = PropertiesService.getScriptProperties().getProperty('FIRE5Y_USER');
  const ss = getTargetSpreadsheet(user);
  const sheet = ss.getSheetByName(SHEET_DATA);
  if (!sheet) return [];
  const last = getRealLastRow(sheet, 1);
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, 9).getValues()
    .filter(r => r[0] !== '' && String(r[8]).trim() !== 'Cancelled')
    .map(r => ({
      date: r[1] instanceof Date ? Utilities.formatDate(r[1], 'GMT+7', 'yyyy-MM-dd') : String(r[1]).slice(0, 10),
      type: String(r[2]).trim(), amount: Number(r[3]) || 0, category: String(r[4] || 'Khác'), account: String(r[5] || '')
    }));
}

function ymd_(d) { return Utilities.formatDate(d, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd'); }
function money_(n) { return Math.round(n).toLocaleString('vi-VN') + 'đ'; }
function short_(n) {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return s + (Math.round(a / 1e5) / 10).toString().replace('.', ',') + 'tr';
  if (a >= 1e3) return s + Math.round(a / 1e3) + 'k';
  return s + Math.round(a);
}

function fire5yDailyReminder() {
  const today = ymd_(new Date());
  const rows = fire5yRows_().filter(r => r.date === today && r.category !== TRANSFER_CAT);
  if (rows.length) return; // hôm nay đã ghi → không làm phiền
  sendTelegram_('📝 <b>FIRE5Y</b>: hôm nay bạn chưa ghi khoản nào.\nMở app ghi nhanh 1 phút: https://godnc.com/fire5y/');
}

function periodStats_(rows, from, to) {
  const list = rows.filter(r => r.date >= from && r.date <= to && r.category !== TRANSFER_CAT);
  let thu = 0, chi = 0; const byCat = {}, byDay = {};
  list.forEach(r => {
    if (r.type === 'Thu') thu += r.amount;
    else { chi += r.amount; byCat[r.category] = (byCat[r.category] || 0) + r.amount; byDay[r.date] = (byDay[r.date] || 0) + r.amount; }
  });
  const top = Object.keys(byCat).map(k => [k, byCat[k]]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const maxDay = Object.keys(byDay).sort((a, b) => byDay[b] - byDay[a])[0];
  return { thu: thu, chi: chi, top: top, maxDay: maxDay, maxDayAmt: maxDay ? byDay[maxDay] : 0, count: list.length };
}

function summaryText_(title, cur, prev) {
  const rate = cur.thu ? Math.round((cur.thu - cur.chi) / cur.thu * 100) : null;
  const diff = prev.chi ? Math.round((cur.chi - prev.chi) / prev.chi * 100) : null;
  let t = '📊 <b>' + title + '</b>\n';
  t += 'Thu: ' + money_(cur.thu) + '\nChi: ' + money_(cur.chi);
  if (diff !== null) t += ' (' + (diff >= 0 ? '+' : '') + diff + '% so với kỳ trước)';
  t += '\nĐể dành: ' + money_(cur.thu - cur.chi) + (rate !== null ? ' · ' + rate + '%' : '');
  if (cur.top.length) t += '\n\nChi nhiều nhất:\n' + cur.top.map(c => '• ' + c[0] + ': ' + short_(c[1])).join('\n');
  if (cur.maxDay) t += '\n\nNgày tiêu nhiều nhất: ' + cur.maxDay.slice(8) + '/' + cur.maxDay.slice(5, 7) + ' (' + short_(cur.maxDayAmt) + ')';
  if (!cur.count) t += '\n\nKỳ này chưa có khoản nào được ghi.';
  return t;
}

function fire5yWeeklySummary() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // T2 = 0
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
  const pMon = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() - 7);
  const pSun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() - 1);
  const rows = fire5yRows_();
  const cur = periodStats_(rows, ymd_(mon), ymd_(now));
  const prev = periodStats_(rows, ymd_(pMon), ymd_(pSun));
  sendTelegram_(summaryText_('Tổng kết tuần ' + ymd_(mon).slice(8) + '/' + ymd_(mon).slice(5, 7) + ' – ' + ymd_(now).slice(8) + '/' + ymd_(now).slice(5, 7), cur, prev) + '\n' + overviewText_('', ymd_(mon), ymd_(now)));
}

function fire5yMonthlySummary() {
  // chạy ngày 1 → tổng kết tháng vừa qua
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  const pFirst = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const pLast = new Date(now.getFullYear(), now.getMonth() - 1, 0);
  const rows = fire5yRows_();
  const cur = periodStats_(rows, ymd_(first), ymd_(last));
  const prev = periodStats_(rows, ymd_(pFirst), ymd_(pLast));
  sendTelegram_(summaryText_('Tổng kết tháng ' + (first.getMonth() + 1) + '/' + first.getFullYear(), cur, prev) + '\n' + overviewText_('', ymd_(first), ymd_(last)));
}

// Chạy tay để kiểm tra kết nối Telegram (không in token ra log)
function testTelegram() {
  const p = PropertiesService.getScriptProperties();
  const token = (p.getProperty('TG_BOT_TOKEN') || '').trim(), chat = (p.getProperty('TG_CHAT_ID') || '').trim();
  Logger.log('Có token: ' + !!token + ' | độ dài: ' + token.length + ' | có dấu hai chấm: ' + (token.indexOf(':') > 0));
  Logger.log('Chat id: ' + chat);
  if (!token) return;
  const me = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getMe', { muteHttpExceptions: true });
  Logger.log('getMe: ' + me.getResponseCode() + ' ' + me.getContentText().slice(0, 300));
  const r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ chat_id: chat, text: '✅ FIRE5Y test kết nối Telegram' })
  });
  Logger.log('sendMessage: ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 300));
}


// ==========================================
// 9. FIRE5Y — GHI CHÉP QUA TELEGRAM (nhắn bot → ghi vào tab Dữ liệu)
// ==========================================
// Cài một lần: chạy setupTelegramWebhook() (sau khi deploy bản có hàm này).
// Cách nhắn: "50k cafe", "1tr2 giày mb", "+15tr doanh thu", nhiều dòng = nhiều khoản,
// "hqua 120k ăn tối" = ghi cho hôm qua. Lệnh: /undo (huỷ lần ghi gần nhất), /help.

const FIRE5Y_EXEC_URL = 'https://script.google.com/macros/s/AKfycbzm49bx5a2HCd1Bb9QX58aj3lxZET_WnJSri-46ynMAxOkWjtpsftQHlhdUWIga4tnq/exec';

const TG_KEYWORDS_ = {
  'Cà phê': ['cafe', 'ca phe', 'cf', 'coffee', 'tra sua', 'highlands', 'starbucks', 'nuoc ep', 'sinh to'],
  'Ăn uống': ['an', 'com', 'pho', 'bun', 'banh mi', 'banh', 'lau', 'nuong', 'an trua', 'an toi', 'an sang', 'do an', 'grabfood', 'bun cha', 'hu tieu', 'mi', 'oc', 'hai san', 'di cho', 'sieu thi'],
  'Đi lại': ['grab', 'xang', 'taxi', 'be', 'gui xe', 've may bay', 'xe khach', 'sua xe', 'xanh sm'],
  'Nhà & hoá đơn': ['nha', 'tien nha', 'dien', 'nuoc', 'internet', 'wifi', 'gas', 'dien thoai', '4g'],
  'Gói đăng ký': ['netflix', 'spotify', 'icloud', 'youtube', 'chatgpt', 'google one', 'claude', 'canva'],
  'Trail & sức khoẻ': ['giay', 'gel', 'giai', 'race', 'vmm', 'gym', 'massage', 'chay', 'trail', 'dinh duong', 'vitamin'],
  'Mua sắm': ['mua', 'shopee', 'lazada', 'tiki', 'quan ao', 'ao', 'quan'],
  'Giải trí': ['phim', 'game', 'bia', 'nhau', 'karaoke', 'du lich'],
  'Kinh doanh DNC': ['ctv', 'gia von', 'nhap slot', 'ads', 'quang cao', 'tk ytb', 'fam'],
  'Doanh thu Premium': ['doanh thu', 'ban', 'khach', 'gia han', 'thu tien'],
  'Thu khác': ['luong', 'thuong', 'lai', 'hoan tien', 'thu'],
  'Lỗ trading': ['trade', 'trading', 'long', 'short', 'futures', 'hyperliquid', 'binance', 'okx', 'bybit', 'lo trade', 'lai trade', 'hl']
};
const TG_THU_CATS_ = ['Doanh thu Premium', 'Thu khác', 'Lãi trading'];
const TG_ACC_ALIAS_ = { 'tcb': 'techcombank', 'mb': 'mb bank', 'mbbank': 'mb bank', 'momo': 'momo', 'zalopay': 'zalopay', 'zalo': 'zalopay', 'tm': 'tien mat', 'cash': 'tien mat', 'tienmat': 'tien mat', 'hl': 'hyperliquid' };

function tgStrip_(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
}

function tgParseLine_(line) {
  let s = String(line || '').trim(); if (!s) return null;
  let forceThu = false;
  if (s.charAt(0) === '+') { forceThu = true; s = s.slice(1).trim(); }
  const pats = [
    [/(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|trieu|m)(\d{1,3})?(?!\p{L})/iu, m => parseFloat(m[1].replace(',', '.')) * 1e6 + (m[2] ? +m[2] * Math.pow(10, 6 - m[2].length) : 0)],
    [/(\d+(?:[.,]\d+)?)\s*(?:k|nghìn|ngàn|nghin|ngan)(?!\p{L})/iu, m => parseFloat(m[1].replace(',', '.')) * 1e3],
    [/\d{1,3}(?:[.,]\d{3})+(?!\d)/u, m => +m[0].replace(/[.,]/g, '')],
    [/\d+(?:[.,]\d+)?/u, m => { const n = parseFloat(m[0].replace(',', '.')); return n < 1000 ? n * 1000 : n; }]
  ];
  for (const [re, fn] of pats) {
    const m = s.match(re);
    if (m) {
      const note = (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').replace(/^[-–:,\s]+|[-–:,\s]+$/g, '');
      return { amount: Math.round(fn(m)), note: note, forceThu: forceThu };
    }
  }
  return { amount: 0, note: s, forceThu: forceThu };
}

function tgGuessCat_(note) {
  const padded = ' ' + tgStrip_(note) + ' ';
  let best = null, bestLen = 0;
  Object.keys(TG_KEYWORDS_).forEach(cat => TG_KEYWORDS_[cat].forEach(kw => {
    if (padded.indexOf(' ' + kw + ' ') >= 0 && kw.length > bestLen) { best = cat; bestLen = kw.length; }
  }));
  return best;
}

// Tìm ví trong ghi chú (vd "mb", "tcb", "momo"), trả về tên ví + ghi chú đã bỏ chữ đó
function tgPickAccount_(note, accounts, defAcc) {
  const words = String(note).split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const w = tgStrip_(words[i]);
    if (!w) continue;
    const key = TG_ACC_ALIAS_[w] || w;
    const generic = ['tien', 'bank', 'ngan', 'hang', 'mat', 'vi', 'san', 'trading', 'crypto'];
    const hit = accounts.find(a => {
      const n = tgStrip_(a);
      if (n === key || (TG_ACC_ALIAS_[w] && n.indexOf(key) >= 0)) return true;
      return n.split(/[^a-z0-9]+/).some(tok => tok.length >= 4 && generic.indexOf(tok) < 0 && tok === key);
    });
    if (hit) { words.splice(i, 1); return { account: hit, note: words.join(' ').trim() }; }
  }
  return { account: defAcc, note: note };
}

function handleTelegramUpdate_(e) {
  const ok = ContentService.createTextOutput('ok');
  try {
    const props = PropertiesService.getScriptProperties();
    const hook = props.getProperty('FIRE5Y_TG_HOOK');
    if (!hook || e.parameter.tg !== hook) return ok;
    const upd = JSON.parse(e.postData.contents);
    const msg = upd.message;
    if (!msg || !msg.text) return ok;
    if (String(msg.chat.id) !== String(props.getProperty('TG_CHAT_ID')).trim()) return ok;

    // Telegram gửi lại cùng một update khi chưa nhận được 200 → bỏ qua update đã xử lý
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return ok;
    try {
      const last = Number(props.getProperty('FIRE5Y_TG_LAST_UPDATE') || 0);
      if (upd.update_id <= last) return ok;
      props.setProperty('FIRE5Y_TG_LAST_UPDATE', String(upd.update_id));
      tgHandleText_(msg.text, upd.update_id, props, msg.date);
    } finally { lock.releaseLock(); }
  } catch (err) {
    console.error(err.stack || err.message);
    try { sendTelegram_('⚠️ FIRE5Y chưa xử lý được tin vừa nhắn: ' + err.message, true); } catch (e2) {}
  }
  return ok;
}

function tgHandleText_(text, updateId, props, msgDate) {
  const t = String(text).trim();
  const ss = getTargetSpreadsheet(props.getProperty('FIRE5Y_USER'));
  const sheet = ss.getSheetByName(SHEET_DATA);
  const tz = 'Asia/Ho_Chi_Minh';

  const st = tgStrip_(t);
  const askCmd = /^\/(homnay|tongquan|today|tuan|thang)\b/.test(st);
  const askText = !/\d/.test(t) && /(loi nhuan|tong quan|thu chi|doanh thu|bao cao|hom nay|tuan nay|thang nay|^thu$|^chi$)/m.test(st);
  if (askCmd || askText) {
    const now = new Date(), tzz = 'Asia/Ho_Chi_Minh', today = Utilities.formatDate(now, tzz, 'yyyy-MM-dd');
    let from = today, title = 'Tổng quan hôm nay ' + today.slice(8) + '/' + today.slice(5, 7);
    if (/^\/tuan|tuan/.test(st)) {
      const mon = new Date(now.getTime() - ((now.getDay() + 6) % 7) * 864e5);
      from = Utilities.formatDate(mon, tzz, 'yyyy-MM-dd'); title = 'Tổng quan tuần này (từ ' + from.slice(8) + '/' + from.slice(5, 7) + ')';
    } else if (/^\/thang|thang/.test(st)) {
      from = today.slice(0, 8) + '01'; title = 'Tổng quan tháng ' + Number(today.slice(5, 7)) + '/' + today.slice(0, 4);
    }
    sendTelegram_(overviewText_(title, from, today));
    return;
  }

  if (/^\/(start|help)/i.test(t)) {
    sendTelegram_('Nhắn khoản chi/thu để ghi vào FIRE5Y:\n• <code>50k cafe</code>\n• <code>1tr2 giày mb</code> (thêm tên ví: mb, tcb, momo, tm…)\n• <code>+15tr doanh thu</code> (dấu + = khoản thu)\n• <code>hqua 120k ăn tối</code> (ghi cho hôm qua)\n• Nhiều dòng = nhiều khoản\n• /undo — huỷ lần ghi gần nhất\n\nXem tổng quan (Goshop + cá nhân + trading):\n• /homnay, /tuan, /thang\n• hoặc nhắn <code>lợi nhuận hôm nay</code>, <code>tổng quan tháng này</code>');
    return;
  }
  if (/^\/undo/i.test(t)) {
    const ids = JSON.parse(props.getProperty('FIRE5Y_TG_LAST_IDS') || '[]');
    if (!ids.length) { sendTelegram_('Không có lần ghi nào để huỷ.'); return; }
    const idx = idRowMap_(sheet);
    let n = 0;
    ids.forEach(id => { const r = idx.map[id]; if (r) { sheet.getRange(r, 9).setValue('Cancelled'); n++; } });
    props.deleteProperty('FIRE5Y_TG_LAST_IDS');
    recalculateAccountBalances(ss);
    sendTelegram_('↩️ Đã huỷ ' + n + ' khoản vừa ghi.');
    return;
  }

  let date = msgDate ? new Date(msgDate * 1000) : new Date();
  let body = t;
  const dm = tgStrip_(body).match(/^(hqua|hom qua|hq)\b/);
  if (dm) { date = new Date(date.getTime() - 864e5); body = body.replace(/^\S+(\s+qua)?\s*/i, ''); }
  const dateStr = Utilities.formatDate(date, tz, 'yyyy-MM-dd');

  const accSheet = ss.getSheetByName(SHEET_ACCOUNTS);
  const accounts = accSheet && getRealLastRow(accSheet, 1) > 1 ? accSheet.getRange(2, 1, getRealLastRow(accSheet, 1) - 1, 1).getValues().map(r => String(r[0]).trim()).filter(String) : [];
  const defAcc = props.getProperty('FIRE5Y_TG_DEFAULT_ACC') || (accounts.indexOf('Tiền mặt') >= 0 ? 'Tiền mặt' : (accounts[0] || 'Tiền mặt'));

  const items = [], bad = [];
  body.split('\n').forEach((line, i) => {
    const p = tgParseLine_(line);
    if (!p) return;
    if (!p.amount) { bad.push(line.trim()); return; }
    const a = tgPickAccount_(p.note, accounts, defAcc);
    const cat = tgGuessCat_(a.note);
    const isThu = p.forceThu || (cat && TG_THU_CATS_.indexOf(cat) >= 0);
    let category = cat && (TG_THU_CATS_.indexOf(cat) >= 0) === isThu ? cat : (isThu ? 'Thu khác' : 'Khác');
    if (cat === 'Lỗ trading') category = isThu ? 'Lãi trading' : 'Lỗ trading';
    items.push({ id: 'tg' + updateId + '-' + (i + 1), date: dateStr, type: isThu ? 'Thu' : 'Chi', amount: p.amount, category: category, account: a.account, description: a.note, source: 'Telegram', status: 'Confirmed' });
  });

  if (!items.length) {
    sendTelegram_('Không đọc được số tiền. Gõ kiểu <code>50k cafe</code> hoặc /help.');
    return;
  }
  const start = getRealLastRow(sheet, 1) + 1;
  sheet.getRange(start, 1, items.length, 9).setValues(items.map(it => txRow_(it, tz)));
  recalculateAccountBalances(ss);
  props.setProperty('FIRE5Y_TG_LAST_IDS', JSON.stringify(items.map(it => it.id)));

  const todayChi = fire5yRows_().filter(r => r.date === Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd') && r.type === 'Chi' && r.category !== TRANSFER_CAT).reduce((s, r) => s + r.amount, 0);
  let reply = '✅ Đã ghi ' + items.length + ' khoản' + (dm ? ' (hôm qua)' : '') + ':\n' +
    items.map(it => (it.type === 'Thu' ? '+' : '−') + short_(it.amount) + ' · ' + it.category + ' · ' + it.account + (it.description ? ' · ' + it.description : '')).join('\n') +
    '\nHôm nay đã chi: ' + short_(todayChi);
  if (bad.length) reply += '\n⚠️ Bỏ qua (thiếu số tiền): ' + bad.join(', ');
  reply += '\n/undo để huỷ';
  sendTelegram_(reply);
}

// Chạy tay 1 lần sau khi deploy: gắn webhook của bot vào Apps Script này
function setupTelegramWebhook() {
  throw new Error('Webhook vào Apps Script làm kẹt hàng đợi Telegram. Dùng setupTelegramPolling().');
  const p = PropertiesService.getScriptProperties();
  const token = (p.getProperty('TG_BOT_TOKEN') || '').trim();
  if (!token) throw new Error('Thiếu TG_BOT_TOKEN');
  const info = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getWebhookInfo', { muteHttpExceptions: true }).getContentText());
  const cur = (info.result && info.result.url) || '';
  Logger.log('Webhook hiện tại: ' + (cur ? cur.replace(/tg=[^&]+/, 'tg=***') : '(trống)'));
  if (cur && cur.indexOf(FIRE5Y_EXEC_URL) !== 0) {
    throw new Error('Bot đang gắn webhook của hệ thống khác, không ghi đè. Gỡ webhook đó trước nếu muốn dùng cho FIRE5Y.');
  }
  let hook = p.getProperty('FIRE5Y_TG_HOOK');
  if (!hook) { hook = Utilities.getUuid().replace(/-/g, ''); p.setProperty('FIRE5Y_TG_HOOK', hook); }
  const r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/setWebhook', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ url: FIRE5Y_EXEC_URL + '?tg=' + hook, allowed_updates: ['message'], drop_pending_updates: true })
  });
  Logger.log('setWebhook: ' + r.getResponseCode() + ' ' + r.getContentText());
  if (r.getResponseCode() === 200) sendTelegram_('🤖 Đã bật ghi chép qua Telegram. Nhắn <code>50k cafe</code> để thử, /help để xem cách gõ.');
}


// ==========================================
// 10. NHẬN TIN TELEGRAM BẰNG POLLING (thay webhook)
// ==========================================
// Webhook vào Apps Script luôn trả 302 nên Telegram gửi lại mãi. Polling mỗi phút bằng trigger thì ổn định:
// chạy setupTelegramPolling() một lần — nó gỡ webhook và tạo trigger tgPoll mỗi phút.

function tgPoll() {
  const props = PropertiesService.getScriptProperties();
  const token = (props.getProperty('TG_BOT_TOKEN') || '').trim();
  const chat = (props.getProperty('TG_CHAT_ID') || '').trim();
  if (!token) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const offset = Number(props.getProperty('FIRE5Y_TG_LAST_UPDATE') || 0) + 1;
    const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates?timeout=0&allowed_updates=%5B%22message%22%5D&offset=' + offset, { muteHttpExceptions: true });
    if (res.getResponseCode() === 409) return; // đang dùng webhook
    if (res.getResponseCode() !== 200) { console.error('getUpdates ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200)); return; }
    const updates = JSON.parse(res.getContentText()).result || [];
    updates.forEach(u => {
      props.setProperty('FIRE5Y_TG_LAST_UPDATE', String(u.update_id)); // đánh dấu trước để lỗi không làm ghi lặp
      const msg = u.message;
      if (!msg || !msg.text || String(msg.chat.id) !== chat) return;
      try {
        tgHandleText_(msg.text, u.update_id, props, msg.date);
      } catch (err) {
        console.error(err.stack || err.message);
        sendTelegram_('⚠️ FIRE5Y chưa ghi được "' + msg.text.slice(0, 60) + '": ' + err.message, true);
      }
    });
  } finally { lock.releaseLock(); }
}

function setupTelegramPolling() {
  const p = PropertiesService.getScriptProperties();
  const token = (p.getProperty('TG_BOT_TOKEN') || '').trim();
  if (!token) throw new Error('Thiếu TG_BOT_TOKEN');
  const info = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getWebhookInfo', { muteHttpExceptions: true }).getContentText()).result || {};
  if (info.url && info.url.indexOf(FIRE5Y_EXEC_URL) !== 0) throw new Error('Bot đang gắn webhook của hệ thống khác, không gỡ.');
  // gỡ webhook FIRE5Y + bỏ các tin đang kẹt (Telegram gửi lại vì lỗi 302)
  const d = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/deleteWebhook?drop_pending_updates=true', { muteHttpExceptions: true });
  Logger.log('deleteWebhook: ' + d.getContentText());
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'tgPoll') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tgPoll').timeBased().everyMinutes(1).create();
  sendTelegram_('🤖 FIRE5Y: đã chuyển sang nhận tin mỗi phút. Nhắn lại khoản chi để ghi (vd <code>40k đi chợ</code>), bot trả lời trong vòng 1 phút. /help xem cách gõ.');
}


// ==========================================
// 11. TỔNG QUAN: GOSHOP (sheet Tài chính) + FIRE5Y THEO MẢNG
// ==========================================
// Lợi nhuận Goshop tính giống dashboard godnc.com/admin: DATA(YTB) + DATA(GCC),
// cột A ngày (dd/MM/yyyy), I hoa hồng, J giá vốn, K phát sinh, L giá bán, M lợi nhuận (trống → L−J−I−K).

const GOSHOP_FIN_ID = '1-EgeNWztGQsY2rmLYp00yKDjgHR5WYoqzzhAkSnvJjc';

function gsNum_(v) {
  if (typeof v === 'number') return v;
  let s = String(v || '').toLowerCase().replace(/\s/g, '');
  if (!s) return 0;
  let mul = 1;
  if (s.endsWith('k')) { mul = 1e3; s = s.slice(0, -1); }
  else if (s.endsWith('m') || s.endsWith('tr')) { mul = 1e6; s = s.replace(/m|tr/g, ''); }
  s = s.replace(/[.,]/g, '').replace(/[^0-9-]/g, '');
  return (parseFloat(s) || 0) * mul;
}
function gsDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  const m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : null;
}

// Gộp đơn theo ngày, cache 5 phút (sheet ~20k dòng)
function goshopDayMap_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('GOSHOP_DAYMAP_V1');
  if (hit) return JSON.parse(hit);
  const ss = SpreadsheetApp.openById(GOSHOP_FIN_ID);
  const map = {};
  ['DATA(YTB)', 'DATA(GCC)'].forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const last = getRealLastRow(sh, 1);
    if (last < 2) return;
    sh.getRange(2, 1, last - 1, 13).getValues().forEach(r => {
      const d = gsDate_(r[0]);
      if (!d) return;
      const price = gsNum_(r[11]), cost = gsNum_(r[9]), comm = gsNum_(r[8]), misc = gsNum_(r[10]);
      const profit = String(r[12]).trim() !== '' ? gsNum_(r[12]) : price - cost - comm - misc;
      const type = String(r[2] || '').trim().toLowerCase();
      const o = map[d] || (map[d] = { n: 0, nw: 0, rn: 0, rev: 0, cost: 0, comm: 0, misc: 0, profit: 0 });
      o.n++;
      if (type === 'new') o.nw++; else if (type.indexOf('gia h') === 0) o.rn++;
      o.rev += price; o.cost += cost; o.comm += comm; o.misc += misc; o.profit += profit;
    });
  });
  try { cache.put('GOSHOP_DAYMAP_V1', JSON.stringify(map), 1200); } catch (e) {}
  return map;
}

function goshopStats_(from, to) {
  const map = goshopDayMap_();
  const s = { n: 0, nw: 0, rn: 0, rev: 0, cost: 0, comm: 0, misc: 0, profit: 0 };
  Object.keys(map).forEach(d => { if (d >= from && d <= to) Object.keys(s).forEach(k => s[k] += map[d][k]); });
  return s;
}

// Mảng của một danh mục FIRE5Y: personal / biz / trading (theo tên + cột Nhóm của tab DS)
function dsGroups_() {
  const ss = getTargetSpreadsheet(PropertiesService.getScriptProperties().getProperty('FIRE5Y_USER'));
  const sh = ss.getSheetByName(SHEET_DS);
  const out = {};
  if (!sh || getRealLastRow(sh, 1) < 2) return out;
  sh.getRange(2, 1, getRealLastRow(sh, 1) - 1, 2).getValues().forEach(r => { if (r[0]) out[String(r[0]).trim()] = String(r[1] || ''); });
  return out;
}
function fire5yScope_(cat, groups) {
  const c = tgStrip_(cat), g = tgStrip_((groups || {})[cat] || '');
  if (/trading|trade/.test(c) || /trading/.test(g)) return 'trading';
  if (/kinh doanh|doanh thu premium|gia von|chi phi ctv|van hanh/.test(c) || /kinh doanh/.test(g)) return 'biz';
  return 'personal';
}
function scopeStats_(from, to) {
  const groups = dsGroups_();
  const out = { personal: { thu: 0, chi: 0 }, biz: { thu: 0, chi: 0 }, trading: { thu: 0, chi: 0 } };
  fire5yRows_().forEach(r => {
    if (r.date < from || r.date > to || r.category === TRANSFER_CAT) return;
    const sc = fire5yScope_(r.category, groups);
    if (r.type === 'Thu') out[sc].thu += r.amount; else out[sc].chi += r.amount;
  });
  return out;
}

function overviewText_(title, from, to) {
  const g = goshopStats_(from, to), s = scopeStats_(from, to);
  let t = title ? '📊 <b>' + title + '</b>\n' : '';
  t += '\n🏪 <b>Goshop</b>: ' + g.n + ' đơn' + (g.n ? ' (' + g.nw + ' mới, ' + g.rn + ' gia hạn)' : '') +
       '\nDoanh thu ' + short_(g.rev) + ' · Lợi nhuận <b>' + short_(g.profit) + '</b>';
  t += '\n\n👤 <b>Cá nhân</b>: chi ' + short_(s.personal.chi) + (s.personal.thu ? ' · thu ' + short_(s.personal.thu) : '');
  if (s.biz.thu || s.biz.chi) t += '\n💼 <b>Kinh doanh (ghi trong FIRE5Y)</b>: ' + (s.biz.thu ? 'thu ' + short_(s.biz.thu) + ' · ' : '') + 'chi ' + short_(s.biz.chi);
  if (s.trading.thu || s.trading.chi) {
    const net = s.trading.thu - s.trading.chi;
    t += '\n📈 <b>Trading</b>: ' + (net >= 0 ? '+' : '') + short_(net) + ' (lãi ' + short_(s.trading.thu) + ', lỗ ' + short_(s.trading.chi) + ')';
  }
  return t;
}


// ==========================================
// 12. WEBHOOK NHANH (Telegram đẩy tin ngay) — thử trước rồi mới bật
// ==========================================
// Gọi đúng như Telegram gọi (POST vào web app, ẩn danh) để kiểm tra ghi trong ngữ cảnh web app.
function tgWebhookSelfTest() {
  const p = PropertiesService.getScriptProperties();
  let hook = p.getProperty('FIRE5Y_TG_HOOK');
  if (!hook) { hook = Utilities.getUuid().replace(/-/g, ''); p.setProperty('FIRE5Y_TG_HOOK', hook); }
  const prev = p.getProperty('FIRE5Y_TG_LAST_UPDATE');
  const fakeId = Number(prev || 0) + 1;
  const t0 = Date.now();
  const r = UrlFetchApp.fetch(FIRE5Y_EXEC_URL + '?tg=' + hook, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, followRedirects: false,
    payload: JSON.stringify({ update_id: fakeId, message: { message_id: 1, date: Math.floor(Date.now() / 1000), chat: { id: Number(p.getProperty('TG_CHAT_ID')) }, text: '/homnay' } })
  });
  Logger.log('Mã trả về: ' + r.getResponseCode() + ' | thời gian: ' + (Date.now() - t0) + 'ms | LAST_UPDATE sau: ' + p.getProperty('FIRE5Y_TG_LAST_UPDATE'));
  // trả lại mốc cũ để không bỏ sót tin thật
  if (prev === null) p.deleteProperty('FIRE5Y_TG_LAST_UPDATE'); else p.setProperty('FIRE5Y_TG_LAST_UPDATE', prev);
}

// Bật webhook: tin tới là xử lý ngay. Telegram vẫn gửi lại vì Apps Script trả 302,
// nhưng bản gửi lại bị bỏ qua nhờ chống trùng update_id. Trigger tgPoll được gỡ.
function setupTelegramWebhookFast() {
  // KHÔNG DÙNG (25/10/2026): Apps Script luôn trả 302 → Telegram coi tin đầu hàng là lỗi, gửi lại mãi
  // và chặn mọi tin phía sau (max_connections 1). Bot đã bị kẹt từ 10:49 tới 14:10. Dùng setupTelegramPolling().
  throw new Error('Webhook vào Apps Script làm kẹt hàng đợi Telegram. Dùng setupTelegramPolling().');
  const p = PropertiesService.getScriptProperties();
  const token = (p.getProperty('TG_BOT_TOKEN') || '').trim();
  let hook = p.getProperty('FIRE5Y_TG_HOOK');
  if (!hook) { hook = Utilities.getUuid().replace(/-/g, ''); p.setProperty('FIRE5Y_TG_HOOK', hook); }
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'tgPoll') ScriptApp.deleteTrigger(t); });
  const r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/setWebhook', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ url: FIRE5Y_EXEC_URL + '?tg=' + hook, allowed_updates: ['message'], max_connections: 1 })
  });
  Logger.log('setWebhook: ' + r.getContentText());
}

// ==========================================
// 13. CHỐT GIÁ VỐN / GIÁ BÁN TRONG SHEET TÀI CHÍNH GOSHOP
// ==========================================
// Cột J (Cost) và L (Price) của DATA(YTB)/DATA(GCC) là công thức tra tab PRICE → sửa PRICE làm đổi cả đơn cũ.
// Chốt = thay công thức bằng số đang hiển thị cho các đơn trước ngày cutoff. Đơn mới vẫn tra PRICE.
// Trigger mỗi đêm chốt các đơn của những ngày trước → sửa PRICE chỉ ảnh hưởng đơn từ hôm sửa trở đi.

function goshopFreezeBefore_(cutoff) {
  const ss = SpreadsheetApp.openById(GOSHOP_FIN_ID);
  const done = {};
  ['DATA(YTB)', 'DATA(GCC)'].forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const last = getRealLastRow(sh, 1);
    if (last < 2) return;
    const dates = sh.getRange(2, 1, last - 1, 1).getValues();
    let n = 0;
    [10, 12].forEach(col => { // J = Cost, L = Price
      const rng = sh.getRange(2, col, last - 1, 1);
      const f = rng.getFormulas(), v = rng.getValues();
      let start = -1;
      const flush = end => { // ghi số cho đoạn dòng liền nhau [start, end)
        if (start < 0) return;
        sh.getRange(2 + start, col, end - start, 1).setValues(v.slice(start, end));
        n += end - start; start = -1;
      };
      for (let i = 0; i < f.length; i++) {
        const d = gsDate_(dates[i][0]);
        const freeze = f[i][0] && d && d < cutoff;
        if (freeze && start < 0) start = i;
        if (!freeze) flush(i);
      }
      flush(f.length);
    });
    done[name] = n;
  });
  CacheService.getScriptCache().remove('GOSHOP_DAYMAP_V1');
  return done;
}

function goshopFreezeDaily() {
  const today = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  const r = goshopFreezeBefore_(today);
  Logger.log('Đã chốt (ô): ' + JSON.stringify(r));
}

function setupGoshopFreezeTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'goshopFreezeDaily') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('goshopFreezeDaily').timeBased().everyDays(1).atHour(1).inTimezone('Asia/Ho_Chi_Minh').create();
}


// ==========================================
// 14. ĐỒNG BỘ TRẠNG THÁI APP GIỮA CÁC MÁY (danh mục đầu tư, FIRE, ví, danh mục, định kỳ, nợ, cài đặt)
// ==========================================
// Tab AppState: A key | B json | C at (ms). Ghi đè theo kiểu bản mới nhất thắng.
const SHEET_APPSTATE = 'AppState';
function stateRow_(sh, key) {
  const last = getRealLastRow(sh, 1);
  if (last < 2) return 0;
  const keys = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < keys.length; i++) if (String(keys[i][0]) === key) return i + 2;
  return 0;
}
function handleGetState(data) {
  const ss = getTargetSpreadsheet(data.user);
  const sh = ss.getSheetByName(SHEET_APPSTATE);
  if (!sh) return respondJSON({ status: 'success', state: null, at: 0 });
  const r = stateRow_(sh, 'fire5y:' + data.user);
  if (!r) return respondJSON({ status: 'success', state: null, at: 0 });
  const v = sh.getRange(r, 1, 1, 3).getValues()[0];
  return respondJSON({ status: 'success', state: String(v[1] || ''), at: Number(v[2]) || 0 });
}
function handleSetState(data) {
  const json = String(data.state || '');
  if (!json || json.length > 45000) return respondJSON({ status: 'error', message: 'Dữ liệu trạng thái rỗng hoặc quá lớn' });
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return respondJSON({ status: 'error', message: 'Sheet đang bận, thử lại sau.' });
  try {
    const ss = getTargetSpreadsheet(data.user);
    let sh = ss.getSheetByName(SHEET_APPSTATE);
    if (!sh) { sh = ss.insertSheet(SHEET_APPSTATE); sh.appendRow(['Key', 'JSON', 'At']); }
    const key = 'fire5y:' + data.user, at = Number(data.at) || Date.now();
    const r = stateRow_(sh, key);
    if (r) {
      const cur = Number(sh.getRange(r, 3).getValue()) || 0;
      if (cur > at) return respondJSON({ status: 'success', conflict: true, at: cur });
      sh.getRange(r, 1, 1, 3).setValues([[key, json, at]]);
    } else {
      sh.getRange(getRealLastRow(sh, 1) + 1, 1, 1, 3).setValues([[key, json, at]]);
    }
    return respondJSON({ status: 'success', at: at });
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
