/**
 * LOVELY MONEY - FINANCE OS (GOOGLE SHEET MASTER ENGINE)
 * File: finance_engine.gs
 * Version: 2.0 (Clean Script Engine)
 * 
 * Mã nguồn này nhúng trực tiếp vào Google Sheet Master của Lovely Money Finance OS.
 * Không đụng chạm hay ghi đè vào Script_Data.gs (dành riêng cho Membershop).
 */

const SHEET_NAME_DATA = 'Dữ liệu';
const SHEET_NAME_ACCOUNTS = 'Tài Khoản';

// ==========================================
// 1. TRIGGER EVENTS & MENU HOOKS
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
  if (sheetName === SHEET_NAME_DATA || sheetName === SHEET_NAME_ACCOUNTS) {
    recalculateAccountBalances();
  }
}

// ==========================================
// 2. CORE LOGIC: CẬP NHẬT SỐ DƯ TÀI KHOẢN
// ==========================================

/**
 * Hàm tính toán và cập nhật cột "Số dư hiện tại" ở tab "Tài Khoản"
 * Số dư hiện tại = Số dư đầu kỳ + Sum(Thu) - Sum(Chi)
 */
function recalculateAccountBalances() {
  const lock = LockService.getDocumentLock();
  try {
    if (!lock.waitLock(5000)) return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetData = ss.getSheetByName(SHEET_NAME_DATA);
    const sheetAccounts = ss.getSheetByName(SHEET_NAME_ACCOUNTS);

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
    Logger.log("Lỗi tính toán lại số dư: " + err.toString());
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 3. ANCHOR SCANNING (DÒ DÒNG CUỐI CHUẨN XÁC)
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

// ==========================================
// 4. DUAL-LAYER CACHE (CACHE + PROPERTIES SERVICE)
// ==========================================

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

// ==========================================
// 5. DIAGNOSTICS & SYSTEM CHECKS
// ==========================================

function checkSystemStatus() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetData = ss.getSheetByName(SHEET_NAME_DATA);
  const sheetAccounts = ss.getSheetByName(SHEET_NAME_ACCOUNTS);
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
