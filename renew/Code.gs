/**
 * FAM ISSUE TRACKER - BACKEND APPS SCRIPT (v5 CTV BULK CHECK & AUTO EMAIL)
 * SpreadSheet: FAM_ISSUE_TRACKER
 * 
 * Quản lý báo lỗi theo Group/Fam (RN1, RN2, RN3...)
 * Hỗ trợ luồng CTV báo lỗi hàng loạt, tra cứu hàng loạt & tự động gửi mail khi Đã xử lý xong
 */

const KHO_TK_ID = '1Agq-0ITsQgzhwnWvQTUthAjS2e8zJfgNd8dGGkCDniA';
const KHO_TK_TAB_NAME = 'DATA';
const RECUR_WINDOW_HOURS = 24; // Cấu hình thời gian tính tái phát (giờ)
const STALE_CACHE_THRESHOLD_HOURS = 6; // Ngưỡng cảnh báo cache cũ (giờ)

/**
 * BỘ ĐỆM BỘ NHỚ SIÊU TỐC TRONG 1 LẦN THỰC THI (REQUEST-SCOPED CACHE)
 */
const _REQUEST_CACHE = {
  spreadsheet: null,
  sheets: {},
  sheetValues: {},
  sheetObjects: {},
  khoTkValues: null
};

function clearRequestCache() {
  _REQUEST_CACHE.spreadsheet = null;
  _REQUEST_CACHE.sheets = {};
  _REQUEST_CACHE.sheetValues = {};
  _REQUEST_CACHE.sheetObjects = {};
  _REQUEST_CACHE.khoTkValues = null;
}

function getSpreadsheetCached() {
  if (!_REQUEST_CACHE.spreadsheet) {
    try {
      _REQUEST_CACHE.spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    } catch (err) {}
    if (!_REQUEST_CACHE.spreadsheet) {
      _REQUEST_CACHE.spreadsheet = SpreadsheetApp.openById('1-rxrJrBTMY3DqJ_DMRzPMg7lzEEIhvpfxPtaEVPl0jY');
    }
  }
  return _REQUEST_CACHE.spreadsheet;
}

function getSpreadsheet() {
  return getSpreadsheetCached();
}

function getSheetCached(sheetName) {
  if (!_REQUEST_CACHE.sheets[sheetName]) {
    const ss = getSpreadsheetCached();
    _REQUEST_CACHE.sheets[sheetName] = ss.getSheetByName(sheetName);
  }
  return _REQUEST_CACHE.sheets[sheetName];
}

function readSheetValuesCached(sheetName) {
  if (!_REQUEST_CACHE.sheetValues[sheetName]) {
    const sheet = getSheetCached(sheetName);
    if (!sheet || sheet.getLastRow() === 0) {
      _REQUEST_CACHE.sheetValues[sheetName] = [];
    } else {
      _REQUEST_CACHE.sheetValues[sheetName] = sheet.getDataRange().getValues();
    }
  }
  return _REQUEST_CACHE.sheetValues[sheetName];
}

function readSheetAsObjects(sheetName) {
  if (!_REQUEST_CACHE.sheetObjects[sheetName]) {
    const values = readSheetValuesCached(sheetName);
    if (values.length <= 1) {
      _REQUEST_CACHE.sheetObjects[sheetName] = [];
    } else {
      const headers = values[0].map(h => String(h || '').trim());
      const objects = [];
      for (let r = 1; r < values.length; r++) {
        const obj = { _rowIndex: r + 1, _rowValues: values[r] };
        const row = values[r];
        for (let c = 0; c < headers.length; c++) {
          obj[headers[c]] = row[c];
        }
        objects.push(obj);
      }
      _REQUEST_CACHE.sheetObjects[sheetName] = objects;
    }
  }
  return _REQUEST_CACHE.sheetObjects[sheetName];
}

function appendRowFast(sheetName, rowArray) {
  const sheet = getSheetCached(sheetName);
  if (!sheet) return;
  sheet.appendRow(rowArray);
  
  delete _REQUEST_CACHE.sheetValues[sheetName];
  delete _REQUEST_CACHE.sheetObjects[sheetName];
}

function updateRowRangeFast(sheetName, rowIndex, startCol, rowValuesArray) {
  const sheet = getSheetCached(sheetName);
  if (!sheet || !rowValuesArray || rowValuesArray.length === 0) return;
  sheet.getRange(rowIndex, startCol, 1, rowValuesArray.length).setValues([rowValuesArray]);

  delete _REQUEST_CACHE.sheetValues[sheetName];
  delete _REQUEST_CACHE.sheetObjects[sheetName];
}

function getKhoTKDataCached() {
  if (!_REQUEST_CACHE.khoTkValues) {
    try {
      const khoSpreadsheet = SpreadsheetApp.openById(KHO_TK_ID);
      const dataSheet = khoSpreadsheet.getSheetByName(KHO_TK_TAB_NAME);
      if (dataSheet && dataSheet.getLastRow() > 1) {
        const lastRow = dataSheet.getLastRow();
        const maxCols = Math.min(18, Math.max(16, dataSheet.getLastColumn()));
        _REQUEST_CACHE.khoTkValues = dataSheet.getRange(1, 1, lastRow, maxCols).getValues();
      } else {
        _REQUEST_CACHE.khoTkValues = [];
      }
    } catch (err) {
      Logger.log('Lỗi đọc Kho TK: ' + err.toString());
      _REQUEST_CACHE.khoTkValues = [];
    }
  }
  return _REQUEST_CACHE.khoTkValues;
}

/**
 * Endpoint nhận Request qua HTTP GET / POST
 */
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  clearRequestCache();
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    let params = {};
    if (e && e.parameter) {
      params = e.parameter;
    }
    
    if (e && e.postData && e.postData.contents) {
      try {
        const body = JSON.parse(e.postData.contents);
        params = Object.assign({}, params, body);
      } catch (err) {
        // Fallback parameter
      }
    }

    const action = params.action;
    let result = {};

    switch (action) {
      case 'submitReport':
        const zaloPhoneParam = params.zalo_phone || params.zaloPhone;
        result = submitReport(params.email, params.message, params.submitted_by, zaloPhoneParam);
        break;
      case 'submitBulkReport':
        result = submitBulkReport(params.emailList || params.emails || params.rawText, params.ctvName);
        break;
      case 'checkBulkStatus':
        result = checkBulkStatus(params.emailList || params.rawText);
        break;
      case 'listCtvReports':
        result = listCtvReports(params.ctvName);
        break;
      case 'checkStatus':
        result = checkStatus(params.email);
        break;
      case 'listTickets':
        result = listTickets(params.filterStatus);
        break;
      case 'updateTicketStatus':
        const ticketIdParam = params.ticket_id || params.ticketId;
        const newStatusParam = params.newStatus || params.status || params.new_status;
        const resolvedByParam = params.resolvedBy || params.resolved_by;
        const noteParam = params.note;
        const resTypeParam = params.resolutionType || params.resolution_type;
        result = updateTicketStatus(ticketIdParam, newStatusParam, resolvedByParam, noteParam, resTypeParam);
        break;
      case 'resolveTicketWithType':
        const rTicketId = params.ticket_id || params.ticketId;
        const rResType = params.resolutionType || params.resolution_type || 'Fix thường';
        const rResolvedBy = params.resolvedBy || params.resolved_by || 'Admin';
        const rNote = params.note;
        result = updateTicketStatus(rTicketId, 'Đã xử lý', rResolvedBy, rNote, rResType);
        break;
      case 'updateActivityStatus':
        const actTicketId = params.ticket_id || params.ticketId;
        const actStatus = params.activity_status || params.activityStatus;
        result = updateActivityStatus(actTicketId, actStatus);
        break;
      case 'syncCache':
      case 'syncEmailLookupCache':
        result = syncEmailLookupCache();
        break;
      case 'setupDatabase':
      case 'setupTriggers':
      case 'setupAutoSyncTrigger':
        result = setupDatabase();
        setupAutoSyncTrigger();
        break;
      case 'getTicketsFeed':
      case 'getPendingFeed':
        result = getTicketsFeed(params.ctvName || params.ctv_name || params.ctv, params.feedType || params.type || params.statusFilter || 'pending');
        break;
      case 'getFixedSlotsFeed':
        result = getFixedSlotsFeed(params.ctvName || params.ctv_name || params.ctv);
        break;
      case 'cleanupDuplicateTickets':
        result = cleanupDuplicateTickets();
        break;
      case 'proactiveQuickFix':
        result = proactiveQuickFix(params.rawText || params.raw_text || params.items, params.resolvedBy || params.resolved_by || 'Admin');
        break;
      case 'getCacheInfo':
        result = { success: true, cache_info: checkCacheHealth() };
        break;
      case 'toggleZaloSent':
        const rIdParam = params.reportId || params.report_id;
        const custEmailParam = params.customerEmail || params.email || params.customer_email;
        const isSentParam = (params.isSent === 'true' || params.isSent === true || params.isSent === 1 || params.isSent === '1');
        result = toggleZaloSent(rIdParam, custEmailParam, isSentParam);
        break;
      case 'assignWarrantyAccount':
        const wCustEmail = params.customerEmail || params.email || params.customer_email;
        const wCtvName = params.ctvName || params.ctv || params.ctv_name;
        result = assignWarrantyAccount(wCustEmail, wCtvName);
        break;
      case 'auditAffectedTickets':
        result = auditAffectedTickets();
        break;
      case 'executeCleanUpAfterConfirmation':
        result = executeCleanUpAfterConfirmation(params);
        break;
      case 'submitMailPhuRequest':
        const pEmail = params.primaryEmail || params.primary_email || params.email;
        const mPhu = params.mailPhu || params.mail_phu || params.secondary_email;
        result = submitMailPhuRequest(pEmail, mPhu);
        break;
      case 'getMailPhuRequests':
        result = getMailPhuRequests(params.statusFilter || params.status);
        break;
      case 'updateMailPhuStatus':
        const mpReqId = params.requestId || params.request_id;
        const mpStatus = params.newStatus || params.status || params.new_status;
        const mpNote = params.note;
        result = updateMailPhuStatus(mpReqId, mpStatus, mpNote);
        break;
      case 'deleteMailPhuRequest':
        result = deleteMailPhuRequest(params.requestId || params.request_id);
        break;
      case 'checkMailPhuStatus':
        const chkEmail = params.primaryEmail || params.primary_email || params.email;
        result = checkMailPhuStatus(chkEmail);
        break;
      case 'getTOTPCode':
        const wSecret = params.secret2fa || params.secret || params.secret_2fa;
        result = getTOTPCode(wSecret);
        break;
      case 'autoClassifyPlusTickets':
        result = autoClassifyPlusTickets();
        break;
      default:
        result = { success: false, message: 'Action không hợp lệ: ' + action };
    }

    output.setContent(JSON.stringify(result));
    return output;
  } catch (error) {
    output.setContent(JSON.stringify({
      success: false,
      message: 'Lỗi server Apps Script: ' + error.toString()
    }));
    return output;
  }
}

/**
 * 1. Khởi tạo cấu trúc các Sheet nếu chưa có
 * Cột TICKETS (12): ticket_id, stt_group, status, created_at, updated_at, resolved_at, resolved_by, is_recurring, recur_count, note, notified_at, resolution_type
 * Cột REPORTS (6): report_id, ticket_id, customer_email, reported_at, message, submitted_by
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Tab TICKETS
  let ticketsSheet = ss.getSheetByName('TICKETS');
  if (!ticketsSheet) {
    ticketsSheet = ss.insertSheet('TICKETS');
  }
  if (ticketsSheet.getLastRow() === 0) {
    ticketsSheet.appendRow([
      'ticket_id', 'stt_group', 'status', 'created_at', 
      'updated_at', 'resolved_at', 'resolved_by', 
      'is_recurring', 'recur_count', 'note', 'notified_at', 'resolution_type'
    ]);
    ticketsSheet.getRange(1, 1, 1, 12).setFontWeight('bold');
  } else {
    const headers = ticketsSheet.getRange(1, 1, 1, Math.max(12, ticketsSheet.getLastColumn())).getValues()[0];
    if (!headers[10] || String(headers[10]).trim() !== 'notified_at') {
      ticketsSheet.getRange(1, 11).setValue('notified_at').setFontWeight('bold');
    }
    if (!headers[11] || String(headers[11]).trim() !== 'resolution_type') {
      ticketsSheet.getRange(1, 12).setValue('resolution_type').setFontWeight('bold');
    }
  }

  // Tab REPORTS
  let reportsSheet = ss.getSheetByName('REPORTS');
  if (!reportsSheet) {
    reportsSheet = ss.insertSheet('REPORTS');
  }
  if (reportsSheet.getLastRow() === 0) {
    reportsSheet.appendRow([
      'report_id', 'ticket_id', 'customer_email', 'reported_at', 'message', 'submitted_by'
    ]);
    reportsSheet.getRange(1, 1, 1, 6).setFontWeight('bold');
  } else {
    const headers = reportsSheet.getRange(1, 1, 1, Math.max(6, reportsSheet.getLastColumn())).getValues()[0];
    if (!headers[5] || String(headers[5]).trim() !== 'submitted_by') {
      reportsSheet.getRange(1, 6).setValue('submitted_by').setFontWeight('bold');
    }
  }

  // Tab EMAIL_LOOKUP_CACHE
  let cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');
  if (!cacheSheet) {
    cacheSheet = ss.insertSheet('EMAIL_LOOKUP_CACHE');
  }
  if (cacheSheet.getLastRow() === 0) {
    cacheSheet.appendRow(['email', 'stt_group', 'synced_at', 'owner_email', 'ctv', 'ngay_het_han']);
    cacheSheet.getRange(1, 1, 1, 6).setFontWeight('bold');
  } else {
    const headers = cacheSheet.getRange(1, 1, 1, Math.max(6, cacheSheet.getLastColumn())).getValues()[0];
    if (!headers[5] || String(headers[5]).trim() !== 'ngay_het_han') {
      cacheSheet.getRange(1, 6).setValue('ngay_het_han').setFontWeight('bold');
    }
  }

  // Tab MAIL_PHU_REQUESTS
  let mailPhuSheet = ss.getSheetByName('MAIL_PHU_REQUESTS');
  if (!mailPhuSheet) {
    mailPhuSheet = ss.insertSheet('MAIL_PHU_REQUESTS');
  }
  if (mailPhuSheet.getLastRow() === 0) {
    mailPhuSheet.appendRow([
      'request_id', 'stt_group', 'primary_email', 'mail_phu',
      'ngay_het_han', 'requested_at', 'status', 'note'
    ]);
    mailPhuSheet.getRange(1, 1, 1, 8).setFontWeight('bold');
  }

  // Tab WARRANTY
  let warrantySheet = ss.getSheetByName('WARRANTY');
  if (!warrantySheet) {
    warrantySheet = ss.insertSheet('WARRANTY');
  }
  if (warrantySheet.getLastRow() === 0) {
    warrantySheet.appendRow([
      'STT', 'Email', 'Pass', 'MKP', '2fa', 'Ngày Renew',
      'BHCus1', 'BHCus2', 'BHCus3', 'BHCus4', 'BHCus5'
    ]);
    warrantySheet.getRange(1, 1, 1, 11).setFontWeight('bold');
  }

  return { success: true, message: 'Đã khởi tạo/cập nhật xong cấu trúc toàn bộ các tab TICKETS, REPORTS, EMAIL_LOOKUP_CACHE, MAIL_PHU_REQUESTS, WARRANTY!' };
}

/**
 * Helper: Kiểm tra sức khỏe cache email
 */
function checkCacheHealth() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');

  if (!cacheSheet || cacheSheet.getLastRow() <= 1) {
    return {
      cache_stale: true,
      stale_hours: 999,
      last_synced_at: null,
      count: 0
    };
  }

  const data = cacheSheet.getDataRange().getValues();
  let latestSynced = null;
  let totalCount = data.length - 1;

  for (let i = 1; i < data.length; i++) {
    const syncedAtRaw = data[i][2];
    if (syncedAtRaw) {
      const d = new Date(syncedAtRaw);
      if (!latestSynced || d > latestSynced) {
        latestSynced = d;
      }
    }
  }

  if (!latestSynced || isNaN(latestSynced.getTime())) {
    return {
      cache_stale: true,
      stale_hours: 999,
      last_synced_at: null,
      count: totalCount
    };
  }

  const now = new Date();
  const diffHours = (now.getTime() - latestSynced.getTime()) / (1000 * 3600);
  const staleHoursRounded = Math.round(diffHours * 10) / 10;

  return {
    cache_stale: diffHours > STALE_CACHE_THRESHOLD_HOURS,
    stale_hours: staleHoursRounded,
    last_synced_at: latestSynced.toISOString(),
    count: totalCount
  };
}

/**
 * 2. Đồng bộ cache Email -> STT từ Sheet Kho TK
 */
function syncEmailLookupCache() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return { success: false, message: 'Hệ thống đang bận đồng bộ, vui lòng thử lại sau.' };
  }

  try {
    setupDatabase();

    const khoSpreadsheet = SpreadsheetApp.openById(KHO_TK_ID);
    const dataSheet = khoSpreadsheet.getSheetByName(KHO_TK_TAB_NAME);
    if (!dataSheet) {
      return { success: false, message: 'Không tìm thấy tab ' + KHO_TK_TAB_NAME + ' trong sheet Kho TK' };
    }

    const data = dataSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: false, message: 'Tab DATA trong Kho TK không có dữ liệu' };
    }

    let headerRowIdx = -1;
    let emailColIdx = -1;
    const maxScanRows = Math.min(10, data.length);

    for (let r = 0; r < maxScanRows; r++) {
      const row = data[r];
      for (let c = 0; c < row.length; c++) {
        const cellStr = String(row[c] || '').trim();
        if (cellStr.toLowerCase() === 'email khách' || cellStr === 'Email khách') {
          headerRowIdx = r;
          emailColIdx = c;
          break;
        }
      }
      if (headerRowIdx !== -1) break;
    }

    if (headerRowIdx === -1) {
      for (let r = 0; r < maxScanRows; r++) {
        const row = data[r];
        for (let c = 0; c < row.length; c++) {
          const cellStr = String(row[c] || '').trim().toLowerCase();
          if (cellStr.includes('email') && !cellStr.includes('ngày')) {
            headerRowIdx = r;
            emailColIdx = c;
            break;
          }
        }
        if (headerRowIdx !== -1) break;
      }
    }

    if (headerRowIdx === -1 || emailColIdx === -1) {
      Logger.log('LỖI: Không tìm thấy ô tiêu đề "Email khách" trong 10 hàng đầu tiên.');
      return { 
        success: false, 
        message: 'Không tìm thấy cột tiêu đề "Email khách" trong 10 hàng đầu tiên của tab DATA Kho TK.'
      };
    }

    const sttColIdx = 0;
    const startDataRow = headerRowIdx + 1;

    Logger.log('Tìm thấy tiêu đề "Email khách" ở Hàng ' + (headerRowIdx + 1) + ', Cột ' + (emailColIdx + 1) + '. Bắt đầu đọc dữ liệu từ Hàng ' + (startDataRow + 1));

    const cacheMap = {};
    const ownerMap = {};
    const ctvMap = {};
    const nowIso = new Date().toISOString();

    // Read Master/Owner emails directly from tab STOCK if present
    const stockSheet = khoSpreadsheet.getSheetByName('STOCK') || khoSpreadsheet.getSheetByName('Stock') || khoSpreadsheet.getSheetByName('stock');
    if (stockSheet && stockSheet.getLastRow() > 1) {
      const stockData = stockSheet.getDataRange().getValues();
      let sHeaderRowIdx = -1;
      let sSttColIdx = -1;
      let sEmailColIdx = -1;

      for (let r = 0; r < Math.min(10, stockData.length); r++) {
        const row = stockData[r];
        for (let c = 0; c < row.length; c++) {
          const cellStr = String(row[c] || '').trim().toLowerCase();
          if (cellStr === 'stt' || cellStr === 'mã' || cellStr.includes('stt')) {
            sSttColIdx = c;
          }
          if (cellStr === 'email' || cellStr === 'email gốc' || cellStr.includes('email')) {
            sEmailColIdx = c;
          }
        }
        if (sSttColIdx !== -1 && sEmailColIdx !== -1) {
          sHeaderRowIdx = r;
          break;
        }
      }

      if (sSttColIdx === -1) sSttColIdx = 0;
      if (sEmailColIdx === -1) sEmailColIdx = 1;
      const sStartRow = sHeaderRowIdx !== -1 ? sHeaderRowIdx + 1 : 1;

      for (let r = sStartRow; r < stockData.length; r++) {
        const sttVal = String(stockData[r][sSttColIdx] || '').trim();
        const emailVal = String(stockData[r][sEmailColIdx] || '').trim().toLowerCase();
        if (sttVal && emailVal && emailVal.includes('@')) {
          ownerMap[sttVal] = emailVal;
        }
      }
      Logger.log('Đã đọc được ' + Object.keys(ownerMap).length + ' tài khoản chủ gia đình từ tab STOCK.');
    }

    // Read ownerColIdx in DATA sheet ONLY if header explicitly states owner/master/chủ fam
    let ownerColIdx = -1;
    const headerRow = data[headerRowIdx];
    for (let c = 0; c < headerRow.length; c++) {
      if (c === emailColIdx) continue;
      const cellStr = String(headerRow[c] || '').trim().toLowerCase();
      if (cellStr.includes('chủ fam') || cellStr.includes('tài khoản mẹ') || cellStr.includes('email gốc') || cellStr.includes('master') || cellStr.includes('owner')) {
        ownerColIdx = c;
        break;
      }
    }

    let ctvColIdx = -1;
    for (let c = 0; c < headerRow.length; c++) {
      const cellStr = String(headerRow[c] || '').trim();
      if (cellStr.toUpperCase() === 'CTV' || cellStr.toLowerCase() === 'ctv') {
        ctvColIdx = c;
        break;
      }
    }

    let dateColIdx = -1;
    let renewColIdx = -1;

    for (let c = 0; c < headerRow.length; c++) {
      const cellRaw = String(headerRow[c] || '').trim();
      const cellLower = cellRaw.toLowerCase();
      if (cellLower.includes('renew')) {
        renewColIdx = c;
      }
      if (cellRaw === 'Date' || cellLower === 'ngày hết hạn' || cellLower === 'hạn gia hạn' || cellLower === 'hsd') {
        dateColIdx = c;
      }
    }

    if (renewColIdx === -1) renewColIdx = 8; // Default Column I (index 8 - Ngày Renew)
    if (dateColIdx === -1) dateColIdx = 13;   // Default Column N (index 13 - Date/HSD)

    const ngayHetHanMap = {};
    let currentSttGroup = '';
    let groupRowCount = 0;

    for (let r = startDataRow; r < data.length; r++) {
      const sttRaw = data[r][sttColIdx];
      const sttStr = sttRaw ? String(sttRaw).trim() : '';

      if (sttStr) {
        currentSttGroup = sttStr;
        groupRowCount = 1;
      } else {
        groupRowCount++;
        if (groupRowCount > 5) {
          currentSttGroup = '';
        }
      }

      if (!currentSttGroup) continue;

      const emailRaw = data[r][emailColIdx];
      const emailClean = emailRaw ? String(emailRaw).trim().toLowerCase() : '';

      let ownerEmailClean = '';
      if (ownerColIdx !== -1 && data[r][ownerColIdx]) {
        ownerEmailClean = String(data[r][ownerColIdx]).trim().toLowerCase();
      }

      let ctvClean = '';
      if (ctvColIdx !== -1 && data[r][ctvColIdx]) {
        ctvClean = String(data[r][ctvColIdx]).trim();
      }

      let ngayHetHanClean = '';
      // Read Date Col (N) or Renew Col (I)
      const targetCol = (dateColIdx !== -1 && data[r][dateColIdx]) ? dateColIdx : renewColIdx;
      if (targetCol !== -1 && data[r][targetCol]) {
        const rawDate = data[r][targetCol];
        if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
          ngayHetHanClean = Utilities.formatDate(rawDate, Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy');
        } else {
          ngayHetHanClean = String(rawDate).trim();
        }
      }

      if (ownerEmailClean && ownerEmailClean.includes('@') && !ownerMap[currentSttGroup]) {
        ownerMap[currentSttGroup] = ownerEmailClean;
      }

      if (emailClean && emailClean.includes('@')) {
        cacheMap[emailClean] = currentSttGroup;
        ctvMap[emailClean] = ctvClean || '';
        ngayHetHanMap[emailClean] = ngayHetHanClean || '';
      }
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');
    
    if (cacheSheet.getLastColumn() < 6) {
      cacheSheet.getRange(1, 6).setValue('ngay_het_han');
    }

    if (cacheSheet.getLastRow() > 1) {
      cacheSheet.getRange(2, 1, cacheSheet.getLastRow() - 1, Math.max(6, cacheSheet.getLastColumn())).clearContent();
    }

    const rowsToInsert = [];
    for (const email in cacheMap) {
      const stt = cacheMap[email];
      rowsToInsert.push([email, stt, nowIso, ownerMap[stt] || '', ctvMap[email] || '', ngayHetHanMap[email] || '']);
    }

    if (rowsToInsert.length > 0) {
      cacheSheet.getRange(2, 1, rowsToInsert.length, 6).setValues(rowsToInsert);
    }

    Logger.log('THÀNH CÔNG: Đã ghi ' + rowsToInsert.length + ' dòng tài khoản vào tab EMAIL_LOOKUP_CACHE lúc ' + nowIso);

    return { 
      success: true, 
      count: rowsToInsert.length, 
      synced_at: nowIso, 
      cache_info: {
        cache_stale: false,
        stale_hours: 0,
        last_synced_at: nowIso,
        count: rowsToInsert.length
      },
      message: 'Đồng bộ thành công ' + rowsToInsert.length + ' tài khoản từ Kho TK!'
    };
  } catch (err) {
    Logger.log('LỖI DỒNG BỘ CACHE: ' + err.toString());
    return { success: false, message: 'Lỗi đồng bộ cache: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Tự động đăng ký Time-Driven Trigger đồng bộ mỗi 1 giờ trong Apps Script
 */
function setupAutoSyncTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'syncEmailLookupCache') {
        return { success: true, message: 'Trigger tự động đồng bộ Kho TK mỗi 1 giờ đã tồn tại.' };
      }
    }
    ScriptApp.newTrigger('syncEmailLookupCache')
      .timeBased()
      .everyHours(1)
      .create();
    return { success: true, message: 'Đã tạo Trigger tự động đồng bộ Kho TK mỗi 1 giờ thành công!' };
  } catch (err) {
    return { success: false, message: 'Lỗi đăng ký trigger tự động: ' + err.toString() };
  }
}

/**
 * Helper: Tra cứu STT group từ Email CHỈ TRONG CACHE local.
 */
/**
 * Helper: Tra cứu STT group từ Email 100% TRỰC TIẾP từ Kho TK Google Sheet
 */
function getSttGroupByEmail(emailClean) {
  const info = lookupKhoTKDirect(emailClean);
  return info ? info.stt_group : null;
}

/**
 * Helper parse ngày giờ linh hoạt (Date object, ISO string, dd/mm/yyyy string)
 */
function parseDateHelper(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const str = String(val).trim();
  if (!str) return null;

  let d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  const parts = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1;
    const year = parseInt(parts[3], 10);
    const hrs = parts[4] ? parseInt(parts[4], 10) : 0;
    const mins = parts[5] ? parseInt(parts[5], 10) : 0;
    const secs = parts[6] ? parseInt(parts[6], 10) : 0;
    d = new Date(year, month, day, hrs, mins, secs);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Helper: Tra cứu Email Chủ Fam từ STT Group 100% TRỰC TIẾP từ Kho TK Google Sheet
 */
function getSttOwnerEmail(sttGroup) {
  if (!sttGroup) return '';
  const targetGroup = String(sttGroup || '').trim().toUpperCase();
  try {
    const khoData = getKhoTKDataCached();
    if (khoData && khoData.length > 1) {
      let emailColIdx = -1;
      let ownerColIdx = -1;
      const maxScanRows = Math.min(10, khoData.length);
      let headerRowIdx = -1;

      for (let r = 0; r < maxScanRows; r++) {
        const row = khoData[r];
        for (let c = 0; c < row.length; c++) {
          const cellStr = String(row[c] || '').trim().toLowerCase();
          if (cellStr.includes('chủ fam') || cellStr.includes('tài khoản mẹ') || cellStr.includes('owner') || cellStr.includes('master')) {
            ownerColIdx = c;
            headerRowIdx = r;
          }
        }
      }

      if (ownerColIdx !== -1) {
        let currentStt = '';
        for (let r = (headerRowIdx !== -1 ? headerRowIdx + 1 : 1); r < khoData.length; r++) {
          const sttRaw = khoData[r][0];
          if (sttRaw && String(sttRaw).trim()) {
            currentStt = String(sttRaw).trim().toUpperCase();
          }
          if (currentStt === targetGroup && khoData[r][ownerColIdx]) {
            const owner = String(khoData[r][ownerColIdx]).trim();
            if (owner && owner.includes('@')) return owner;
          }
        }
      }
    }

    // Try tab STOCK
    const khoSpreadsheet = SpreadsheetApp.openById(KHO_TK_ID);
    const stockSheet = khoSpreadsheet.getSheetByName('STOCK') || khoSpreadsheet.getSheetByName('Stock');
    if (stockSheet && stockSheet.getLastRow() > 1) {
      const stockData = stockSheet.getDataRange().getValues();
      for (let r = 1; r < stockData.length; r++) {
        const sttVal = String(stockData[r][0] || '').trim().toUpperCase();
        const ownerVal = String(stockData[r][1] || '').trim();
        if (sttVal === targetGroup && ownerVal && ownerVal.includes('@')) {
          return ownerVal;
        }
      }
    }
  } catch (e) {}
  return '';
}

/**
 * GỬI THÔNG BÁO VỀ TELEGRAM BOT (@goshop86_bot)
 * Đọc BOT_TOKEN và CHAT_ID từ Script Properties của Apps Script
 */
function sendTelegramNotification(message) {
  try {
    const props = PropertiesService.getScriptProperties();
    const botToken = props.getProperty('BOT_TOKEN') || props.getProperty('TELEGRAM_BOT_TOKEN') || '7948647340:AAFWFVUHabmWqsoR53cbPgS5CVWWGjaIae4';
    const chatId = props.getProperty('CHAT_ID') || props.getProperty('TELEGRAM_CHAT_ID') || '1134598172';

    if (!botToken || !chatId) {
      Logger.log('CẢNH BÁO TELEGRAM: Chưa cấu hình BOT_TOKEN hoặc CHAT_ID trong Script Properties.');
      return false;
    }

    const url = 'https://api.telegram.org/bot' + botToken.trim() + '/sendMessage';
    const payload = {
      chat_id: chatId.trim(),
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    Logger.log('TELEGRAM RESPONSE: ' + response.getContentText());
    return true;
  } catch (err) {
    Logger.log('LỖI GỬI TELEGRAM: ' + err.toString());
    return false;
  }
}

/**
 * HÀM DÙNG CHUNG DUY NHẤT: findOrCreateTicketForGroup(sttGroup, now, customerEmail)
 * 1. Kiểm tra có ticket mở ('Mới' / 'Đang xử lý') -> Nối vào ticket đó. (KHÔNG gửi Telegram)
 * 2. Kiểm tra ticket đóng gần nhất trong 24h -> Tạo ticket mới đánh dấu is_recurring = true, recur_count += 1. (GỬI Telegram tái phát)
 * 3. Nếu không có -> Tạo ticket mới bình thường. (GỬI Telegram sự cố mới)
 */
function findOrCreateTicketForGroup(sttGroup, now, customerEmail) {
  const tickets = readSheetAsObjects('TICKETS');
  const nowIso = now.toISOString();

  let openTicketRowIndex = -1;
  let openTicketData = null;
  let latestClosedTicket = null;
  let latestClosedTime = 0;

  for (let r = 0; r < tickets.length; r++) {
    const obj = tickets[r];
    const rowStt = String(obj['stt_group'] || '').trim();
    const rowStatus = String(obj['status'] || '').trim();

    if (rowStt === sttGroup) {
      if (rowStatus !== 'Đã xử lý') {
        openTicketRowIndex = obj._rowIndex; // 1-indexed sheet row
        openTicketData = {
          ticket_id: obj['ticket_id'],
          stt_group: obj['stt_group'],
          status: obj['status'],
          created_at: obj['created_at'],
          updated_at: obj['updated_at'],
          resolved_at: obj['resolved_at'],
          is_recurring: obj['is_recurring'],
          recur_count: Number(obj['recur_count'] || 0)
        };
        break; // Ưu tiên ticket mở đang có
      } else {
        const rDate = parseDateHelper(obj['resolved_at'] || obj['updated_at'] || obj['created_at']);
        const rTime = rDate ? rDate.getTime() : 0;
        if (rTime > latestClosedTime) {
          latestClosedTime = rTime;
          latestClosedTicket = {
            ticket_id: obj['ticket_id'],
            stt_group: obj['stt_group'],
            status: obj['status'],
            resolved_at: obj['resolved_at'],
            is_recurring: obj['is_recurring'],
            recur_count: Number(obj['recur_count'] || 0)
          };
        }
      }
    }
  }

  if (openTicketData) {
    // Đã có ticket mở -> Cập nhật updated_at (1-call updateFast, KHÔNG GỬI TELEGRAM TRÁNH SPAM)
    updateRowRangeFast('TICKETS', openTicketRowIndex, 5, [nowIso]);
    return {
      ticket_id: openTicketData.ticket_id,
      stt_group: sttGroup,
      status: openTicketData.status,
      created_at: openTicketData.created_at,
      resolved_at: openTicketData.resolved_at,
      is_recurring: Boolean(openTicketData.is_recurring),
      recur_count: openTicketData.recur_count,
      is_existing_open: true
    };
  }

  // Không có ticket mở -> Tạo ticket mới (kiểm tra tái phát 24h)
  let isRecurring = false;
  let recurCount = 0;

  if (latestClosedTicket && latestClosedTime > 0) {
    const diffHours = (now.getTime() - latestClosedTime) / (1000 * 60 * 60);
    if (diffHours >= 0 && diffHours < RECUR_WINDOW_HOURS) {
      isRecurring = true;
      recurCount = (latestClosedTicket.recur_count || 0) + 1;
    }
  }

  const targetTicketId = 'TK-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const ticketStatus = 'Mới';

  appendRowFast('TICKETS', [
    targetTicketId,
    sttGroup,
    ticketStatus,
    nowIso,
    nowIso,
    '',
    '',
    isRecurring,
    recurCount,
    '',
    ''
  ]);

  // GỬI THÔNG BÁO TELEGRAM KHI TẠO TICKET MỚI (TẠO MỚI HOẶC TÁI PHÁT)
  try {
    const ownerEmail = getSttOwnerEmail(sttGroup);
    const formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone() || 'GMT+7', 'HH:mm dd-MM-yyyy');
    
    let msg = '';
    if (isRecurring) {
      msg += `🚨 <b>Sự cố fam TÁI PHÁT: ${sttGroup}</b> (Lần thứ ${recurCount})\n`;
      msg += `👤 Khách báo: ${customerEmail || 'Khách/CTV báo'}\n`;
      if (ownerEmail) msg += `📧 Tài khoản gốc: ${ownerEmail}\n`;
      msg += `🕐 Báo lúc: ${formattedDate}\n`;
      msg += `🔁 Đây là lần tái phát thứ ${recurCount} trong 24h qua — cần kiểm tra kỹ hơn thay vì fix tạm.\n`;
      msg += `👉 Admin xử lý tại: https://godnc.com/renew/admin/`;
    } else {
      msg += `🚨 <b>Sự cố fam mới: ${sttGroup}</b>\n`;
      msg += `👤 Khách báo: ${customerEmail || 'Khách/CTV báo'}\n`;
      if (ownerEmail) msg += `📧 Tài khoản gốc: ${ownerEmail}\n`;
      msg += `🕐 Báo lúc: ${formattedDate}\n`;
      msg += `👉 Admin xử lý tại: https://godnc.com/renew/admin/`;
    }

    sendTelegramNotification(msg);
  } catch (telErr) {
    Logger.log('Lỗi tạo tin nhắn Telegram: ' + telErr.toString());
  }

  return {
    ticket_id: targetTicketId,
    stt_group: sttGroup,
    status: ticketStatus,
    created_at: nowIso,
    resolved_at: '',
    is_recurring: isRecurring,
    recur_count: recurCount,
    is_existing_open: false
  };
}

/**
 * API Admin: updateActivityStatus(ticketIdOrGroup, activityStatus)
 * Cập nhật/Tạo trạng thái hoạt động ("Đang hoạt động" / "Không hoạt động") theo ticket_id HOẶC stt_group (vd: PL389)
 */
function updateActivityStatus(ticketIdOrGroup, activityStatus) {
  if (!ticketIdOrGroup) {
    return { success: false, message: 'Thiếu ticket_id hoặc mã nhóm Fam (stt_group).' };
  }

  const ss = getSpreadsheetCached();
  const ticketsSheet = ss.getSheetByName('TICKETS');
  if (!ticketsSheet || ticketsSheet.getLastRow() <= 1) {
    return { success: false, message: 'Không tìm thấy tab TICKETS.' };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return { success: false, message: 'Hệ thống đang bận, vui lòng thử lại sau 3 giây.' };
  }

  try {
    const data = ticketsSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || '').trim());
    
    let actColIdx = headers.indexOf('activity_status');
    if (actColIdx === -1) {
      actColIdx = 12; // Cột 13 (Index 12)
      ticketsSheet.getRange(1, 13).setValue('activity_status');
    }

    const cleanInput = String(ticketIdOrGroup).trim();
    let targetRowIndex = -1;
    let targetTicketId = '';

    // 1. Tìm theo ticket_id trước
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim().toLowerCase() === cleanInput.toLowerCase()) {
        targetRowIndex = r + 1;
        targetTicketId = data[r][0];
        break;
      }
    }

    // 2. Nếu không thấy theo ticket_id, tìm theo stt_group (vd: PL389)
    if (targetRowIndex === -1) {
      for (let r = 1; r < data.length; r++) {
        const rowStt = String(data[r][1] || '').trim().toLowerCase();
        const rowStatus = String(data[r][2] || '').trim();
        if (rowStt === cleanInput.toLowerCase() && rowStatus !== 'Đã xử lý') {
          targetRowIndex = r + 1;
          targetTicketId = data[r][0];
          break;
        }
      }
    }

    // 3. Nếu khách chưa từng gửi ticket báo lỗi cho stt_group này -> TỰ ĐỘNG TẠO TICKET MỚI CHO NHÓM!
    if (targetRowIndex === -1) {
      let sttGroup = cleanInput.toUpperCase();
      if (/^\d+$/.test(sttGroup)) {
        sttGroup = 'PL' + sttGroup;
      }

      const now = new Date();
      const ticketInfo = findOrCreateTicketForGroup(sttGroup, now, 'Admin Direct Tag');
      targetTicketId = ticketInfo.ticket_id;

      // Đọc lại data để lấy targetRowIndex vừa tạo
      const updatedData = ticketsSheet.getDataRange().getValues();
      for (let r = 1; r < updatedData.length; r++) {
        if (String(updatedData[r][0]).trim() === targetTicketId) {
          targetRowIndex = r + 1;
          break;
        }
      }
    }

    if (targetRowIndex !== -1) {
      const nowIso = new Date().toISOString();
      // Ghi activity_status vào cột 13
      ticketsSheet.getRange(targetRowIndex, 13).setValue(activityStatus || '');
      // Ghi updated_at vào cột 5
      ticketsSheet.getRange(targetRowIndex, 5).setValue(nowIso);
    }

    delete _REQUEST_CACHE.sheetValues['TICKETS'];
    delete _REQUEST_CACHE.sheetObjects['TICKETS'];

    return {
      success: true,
      ticket_id: targetTicketId,
      stt_group: cleanInput,
      activity_status: activityStatus,
      message: 'Đã gắn nhãn "' + (activityStatus || 'Trống') + '" thành công cho Fam ' + cleanInput
    };
  } catch (err) {
    return { success: false, message: 'Lỗi cập nhật activity_status: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * API 1: submitReport(email, message, submittedBy, zaloPhoneRaw)
 */
function submitReport(emailRaw, message, submittedBy, zaloPhoneRaw) {
  if (!emailRaw) {
    return { 
      success: false, 
      error: "missing_email",
      message: "Vui lòng nhập Email." 
    };
  }

  const emailClean = String(emailRaw).trim().toLowerCase();
  const sttGroup = getSttGroupByEmail(emailClean);

  if (!sttGroup) {
    return {
      success: false,
      error: "email_not_found",
      message: "Không tìm thấy tài khoản với email này. Có thể dữ liệu chưa được đồng bộ, vui lòng thử lại sau ít phút hoặc liên hệ CTV."
    };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { success: false, message: 'Hệ thống đang xử lý lượt gửi khác, vui lòng thử lại sau 3 giây.' };
  }

  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const ticketInfo = findOrCreateTicketForGroup(sttGroup, now, emailClean);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reportsSheet = ss.getSheetByName('REPORTS');

    let finalMsg = message || '';
    if (zaloPhoneRaw && String(zaloPhoneRaw).trim()) {
      const zClean = String(zaloPhoneRaw).replace(/\D+/g, '');
      if (zClean) {
        finalMsg = '[Zalo: ' + zClean + '] ' + finalMsg;
      }
    }

    // Insert 1 dòng vào REPORTS (ghi kèm submitted_by ở cột 6)
    const reportId = 'RP-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    appendRowFast('REPORTS', [
      reportId,
      ticketInfo.ticket_id,
      emailClean,
      nowIso,
      finalMsg,
      submittedBy || ''
    ]);

    const cacheHealth = checkCacheHealth();

    return {
      success: true,
      stt_group: sttGroup,
      ticket_id: ticketInfo.ticket_id,
      status: ticketInfo.status,
      is_recurring: ticketInfo.is_recurring,
      recur_count: ticketInfo.recur_count,
      created_at: ticketInfo.created_at,
      resolved_at: ticketInfo.resolved_at,
      is_existing_open: ticketInfo.is_existing_open,
      cache_stale: cacheHealth.cache_stale,
      stale_hours: cacheHealth.stale_hours,
      message: ticketInfo.is_existing_open 
        ? 'Báo lỗi đã được ghi nhận. Fam ' + sttGroup + ' đang được kỹ thuật xử lý.' 
        : 'Đã tạo báo cáo sự cố thành công cho Fam ' + sttGroup + '.'
    };

  } catch (err) {
    return { success: false, message: 'Lỗi ghi nhận báo cáo: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * API CTV: submitBulkReport(rawTextOrList, ctvName) — TỐI ƯU SIÊU TỐC 1 LẦN BATCH INSERT (< 1s)
 */
function submitBulkReport(rawTextOrList, ctvName) {
  if (!rawTextOrList) {
    return { success: false, message: 'Vui lòng dán danh sách email hoặc nội dung tin nhắn.' };
  }

  let matches = [];
  if (Array.isArray(rawTextOrList)) {
    matches = rawTextOrList;
  } else if (typeof rawTextOrList === 'string') {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    matches = String(rawTextOrList).match(emailRegex) || [];
  }

  if (!matches || matches.length === 0) {
    return { success: false, message: 'Không tìm thấy địa chỉ email hợp lệ nào trong đoạn văn bản đã dán.' };
  }

  const uniqueEmails = [];
  for (let i = 0; i < matches.length; i++) {
    const clean = String(matches[i] || '').trim().toLowerCase();
    if (clean && uniqueEmails.indexOf(clean) === -1) {
      uniqueEmails.push(clean);
    }
  }

  if (uniqueEmails.length > 50) {
    return { 
      success: false, 
      message: 'Danh sách tìm thấy ' + uniqueEmails.length + ' email (vượt quá giới hạn 50 email/lần). Vui lòng chia nhỏ danh sách để xử lý.' 
    };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { success: false, message: 'Hệ thống đang bận, vui lòng thử lại sau 3 giây.' };
  }

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    const ss = getSpreadsheetCached();
    const ticketsSheet = ss.getSheetByName('TICKETS');
    const reportsSheet = ss.getSheetByName('REPORTS');

    // Map các ticket đang mở theo STT Group
    const openTicketsMap = {};
    if (ticketsSheet && ticketsSheet.getLastRow() > 1) {
      const tData = ticketsSheet.getDataRange().getValues();
      for (let r = 1; r < tData.length; r++) {
        const stt = String(tData[r][1] || '').trim();
        const status = String(tData[r][2] || '').trim();
        if (stt && status !== 'Đã xử lý') {
          openTicketsMap[stt] = {
            ticket_id: tData[r][0],
            stt_group: stt,
            status: status,
            created_at: tData[r][3],
            resolved_at: tData[r][5]
          };
        }
      }
    }

    const newTicketsRows = [];
    const newReportsRows = [];
    const results = [];
    let foundCount = 0;
    let notFoundCount = 0;

    for (let i = 0; i < uniqueEmails.length; i++) {
      const email = uniqueEmails[i];
      const khoInfo = lookupKhoTKDirect(email);

      if (khoInfo && khoInfo.stt_group) {
        foundCount++;
        const sttGroup = khoInfo.stt_group;
        let ticketId = '';
        let ticketStatus = 'Mới';
        let isExistingOpen = false;

        if (openTicketsMap[sttGroup]) {
          ticketId = openTicketsMap[sttGroup].ticket_id;
          ticketStatus = openTicketsMap[sttGroup].status;
          isExistingOpen = true;
        } else {
          ticketId = 'TK-' + Date.now() + '-' + (i + 1) + '-' + Math.floor(Math.random() * 100);
          ticketStatus = 'Mới';
          newTicketsRows.push([
            ticketId, sttGroup, ticketStatus, nowIso, nowIso, '', '', false, 0, 'Báo lỗi hàng loạt bởi ' + (ctvName || 'CTV'), '', 'Fix thường'
          ]);
          openTicketsMap[sttGroup] = { ticket_id: ticketId, stt_group: sttGroup, status: ticketStatus };
        }

        const reportId = 'RP-' + Date.now() + '-' + (i + 1);
        newReportsRows.push([
          reportId, ticketId, email, nowIso, 'Gửi hàng loạt bởi CTV ' + (ctvName || ''), ctvName || ''
        ]);

        results.push({
          email: email,
          found: true,
          stt_group: sttGroup,
          ticket_status: ticketStatus,
          created_at: nowIso,
          resolved_at: '',
          is_recurring: false,
          recur_count: 0,
          note: isExistingOpen ? 'Đã báo trước đó, kỹ thuật đang xử lý' : 'Vừa ghi nhận thành công'
        });
      } else {
        notFoundCount++;
        results.push({
          email: email,
          found: false,
          stt_group: '---',
          ticket_status: 'Không tìm thấy',
          created_at: '',
          resolved_at: '',
          is_recurring: false,
          recur_count: 0,
          note: 'Không có trong Kho TK'
        });
      }
    }

    // Ghi 1 lần Batch Insert vào TICKETS
    if (newTicketsRows.length > 0 && ticketsSheet) {
      ticketsSheet.getRange(ticketsSheet.getLastRow() + 1, 1, newTicketsRows.length, 12).setValues(newTicketsRows);
    }

    // Ghi 1 lần Batch Insert vào REPORTS
    if (newReportsRows.length > 0 && reportsSheet) {
      reportsSheet.getRange(reportsSheet.getLastRow() + 1, 1, newReportsRows.length, 6).setValues(newReportsRows);
    }

    return {
      success: true,
      total: uniqueEmails.length,
      found_count: foundCount,
      not_found_count: notFoundCount,
      results: results,
      message: 'Đã ghi nhận báo lỗi thành công cho ' + foundCount + ' email (' + notFoundCount + ' email không thấy trong Kho TK).'
    };
  } catch (err) {
    Logger.log('Lỗi submitBulkReport: ' + err.toString());
    return { success: false, message: 'Lỗi ghi nhận báo lỗi hàng loạt: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * API CTV: checkBulkStatus(rawTextOrList)
 * Tra cứu lại trạng thái hàng loạt của danh sách email KHÔNG tạo ticket mới
 */
function checkBulkStatus(rawTextOrList) {
  let emails = [];
  if (Array.isArray(rawTextOrList)) {
    emails = rawTextOrList;
  } else if (typeof rawTextOrList === 'string') {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = String(rawTextOrList).match(emailRegex) || [];
    emails = matches;
  }

  const cleanEmails = [];
  for (let i = 0; i < emails.length; i++) {
    const em = String(emails[i] || '').trim().toLowerCase();
    if (em && cleanEmails.indexOf(em) === -1) {
      cleanEmails.push(em);
    }
  }

  if (cleanEmails.length === 0) {
    return { success: false, message: 'Không tìm thấy email hợp lệ nào để kiểm tra.' };
  }

  if (cleanEmails.length > 50) {
    return { success: false, message: 'Danh sách kiểm tra vượt quá 50 email.' };
  }

  const results = [];
  let foundCount = 0;
  let notFoundCount = 0;

  for (let i = 0; i < cleanEmails.length; i++) {
    const email = cleanEmails[i];
    const res = checkStatus(email);

    if (res.success && res.has_ticket) {
      foundCount++;
      let noteText = (res.status === 'Đã xử lý') ? 'Đã xử lý xong' : 'Đã báo trước đó, admin đang xử lý';
      results.push({
        email: email,
        found: true,
        stt_group: res.stt_group,
        ticket_status: res.status,
        ticket_id: res.ticket_id,
        created_at: res.created_at,
        updated_at: res.updated_at,
        resolved_at: res.resolved_at,
        is_recurring: res.is_recurring,
        recur_count: res.recur_count,
        report_count: res.report_count,
        note: noteText
      });
    } else if (res.success && !res.has_ticket) {
      foundCount++;
      results.push({
        email: email,
        found: true,
        stt_group: res.stt_group,
        ticket_status: 'Chưa có lỗi',
        ticket_id: '',
        created_at: '',
        updated_at: '',
        resolved_at: '',
        is_recurring: false,
        recur_count: 0,
        report_count: 0,
        note: 'Không có ticket mở'
      });
    } else {
      notFoundCount++;
      results.push({
        email: email,
        found: false,
        stt_group: '---',
        ticket_status: 'Không tìm thấy',
        created_at: '',
        resolved_at: '',
        is_recurring: false,
        recur_count: 0,
        note: 'Kiểm tra lại email'
      });
    }
  }

  return {
    success: true,
    total: cleanEmails.length,
    found_count: foundCount,
    not_found_count: notFoundCount,
    results: results,
    message: 'Đã cập nhật trạng thái mới nhất cho ' + cleanEmails.length + ' email.'
  };
}

/**
 * Helper: Tra cứu 100% TRỰC TIẾP từ Sheet Kho TK (tab DATA) chuẩn theo tiêu đề Hàng 1:
 * Cột A (0): STT Group (RN366)
 * Cột D (3): Chủ fam (Email chủ gia đình / master)
 * Cột I (8): ngày renew (Ngày Renew)
 * Cột K (10): Email khách (Email chính)
 * Cột N (13): Date (HSD / Ngày hết hạn)
 * Cột O (14): Mail phụ (Secondary email)
 * Cột P (15): CTV (Tên CTV quản lý)
 */
/**
 * Helper: Tra cứu 100% TRỰC TIẾP từ Sheet Kho TK (tab DATA) chuẩn theo tiêu đề Hàng 1:
 * Cột A (0): STT Group (RN366)
 * Cột D (3): Chủ fam (Email chủ gia đình / master)
 * Cột I (8): ngày renew (Ngày Renew)
 * Cột K (10): Email khách (Email chính)
 * Cột N (13): Date (HSD / Ngày hết hạn)
 * Cột O (14): Mail phụ (Secondary email)
 * Cột P (15): CTV (Tên CTV quản lý)
 */
function lookupKhoTKDirect(emailClean) {
  if (!emailClean) return null;
  const targetEmail = String(emailClean).trim().toLowerCase();

  try {
    const khoData = getKhoTKDataCached();
    if (!khoData || khoData.length <= 1) return null;

    let currentSttGroup = '';
    let currentOwnerEmail = '';

    // Standard column indices matching Row 1 of Kho TK tab DATA
    let colStt = 0;      // Cột A: STT Group (RN366)
    let colOwner = 3;    // Cột D: Chủ fam
    let colRenew = 8;    // Cột I: ngày renew
    let colEmail = 10;   // Cột K: Email khách
    let colHsd = 13;     // Cột N: Date (HSD)
    let colMailPhu = 14; // Cột O: Mail phụ
    let colCtv = 15;     // Cột P: CTV

    // Scan headers in first 5 rows to confirm/adjust column indices dynamically
    for (let r = 0; r < Math.min(5, khoData.length); r++) {
      const row = khoData[r];
      for (let c = 0; c < row.length; c++) {
        const cellStr = String(row[c] || '').trim().toLowerCase();
        if (cellStr === 'chủ fam' || cellStr === 'chu fam') colOwner = c;
        if (cellStr === 'ngày renew' || cellStr === 'ngay renew') colRenew = c;
        if (cellStr === 'email khách' || cellStr === 'email khach') colEmail = c;
        if (cellStr === 'date' && c >= 12) colHsd = c;
        if (cellStr === 'mail phụ' || cellStr === 'mail phu') colMailPhu = c;
        if (cellStr === 'ctv') colCtv = c;
      }
    }

    for (let r = 1; r < khoData.length; r++) {
      const row = khoData[r];
      
      // Update STT group from Column A if present
      const sttRaw = row[colStt];
      if (sttRaw && String(sttRaw).trim()) {
        currentSttGroup = String(sttRaw).trim();
      }

      // Update Owner Email from Column D if present for current STT block
      if (colOwner !== -1 && row[colOwner]) {
        const ownerVal = String(row[colOwner]).trim();
        if (ownerVal && ownerVal.includes('@')) {
          currentOwnerEmail = ownerVal;
        }
      }

      const emailPrimary = colEmail !== -1 ? String(row[colEmail] || '').trim().toLowerCase() : '';
      const emailPhu = colMailPhu !== -1 ? String(row[colMailPhu] || '').trim().toLowerCase() : '';

      let isMatch = (emailPrimary === targetEmail || (emailPhu && emailPhu === targetEmail));
      if (!isMatch) {
        for (let c = 0; c < row.length; c++) {
          if (String(row[c] || '').trim().toLowerCase() === targetEmail) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch) {
        let ngayRenewClean = '';
        if (colRenew !== -1 && row[colRenew]) {
          const rawDate = row[colRenew];
          if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            ngayRenewClean = Utilities.formatDate(rawDate, Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy');
          } else {
            ngayRenewClean = String(row[colRenew]).trim();
          }
        }

        let ngayHetHanClean = '';
        if (colHsd !== -1 && row[colHsd]) {
          const rawDate = row[colHsd];
          if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            ngayHetHanClean = Utilities.formatDate(rawDate, Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy');
          } else {
            ngayHetHanClean = String(row[colHsd]).trim();
          }
        }

        if (!ngayRenewClean) ngayRenewClean = ngayHetHanClean;
        if (!ngayHetHanClean) ngayHetHanClean = ngayRenewClean;

        let ctvClean = (colCtv !== -1 && row[colCtv]) ? String(row[colCtv]).trim() : '';
        let ownerClean = currentOwnerEmail || ((colOwner !== -1 && row[colOwner]) ? String(row[colOwner]).trim() : '');

        if (!ownerClean && currentSttGroup) {
          ownerClean = getSttOwnerEmail(currentSttGroup);
        }

        return {
          stt_group: currentSttGroup,
          email: targetEmail,
          ctv: ctvClean,
          ngay_renew: ngayRenewClean,
          ngay_het_han: ngayHetHanClean,
          hsd: ngayHetHanClean,
          owner_email: ownerClean
        };
      }
    }
  } catch (err) {
    Logger.log('Lỗi lookupKhoTKDirect: ' + err.toString());
  }
  return null;
}

/**
 * API CTV: listCtvReports(ctvName)
 */
function listCtvReports(ctvName) {
  if (!ctvName) {
    return { success: false, message: 'Thiếu ctvName.' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reportsSheet = ss.getSheetByName('REPORTS');
  const ticketsSheet = ss.getSheetByName('TICKETS');

  const ticketMap = {};
  if (ticketsSheet && ticketsSheet.getLastRow() > 1) {
    const tData = ticketsSheet.getDataRange().getValues();
    for (let i = 1; i < tData.length; i++) {
      const row = tData[i];
      const stt = String(row[1]).trim();
      const status = String(row[2]).trim();
      if (!ticketMap[stt] || status !== 'Đã xử lý') {
        ticketMap[stt] = {
          ticket_id: row[0],
          stt_group: stt,
          status: status,
          created_at: row[3],
          resolved_at: row[5]
        };
      }
    }
  }

  const ctvReports = [];
  const seenEmails = new Set();
  const targetCtvClean = String(ctvName).trim().toLowerCase();
  const isAllAdmin = targetCtvClean === 'all' || targetCtvClean === 'admin' || targetCtvClean === 'dnc';

  // 1. Scan REPORTS for reports submitted by this CTV
  if (reportsSheet && reportsSheet.getLastRow() > 1) {
    const rData = reportsSheet.getDataRange().getValues();
    for (let i = 1; i < rData.length; i++) {
      const row = rData[i];
      const submittedByRow = String(row[5] || '').trim().toLowerCase();
      const custEmail = String(row[2] || '').trim().toLowerCase();

      if ((isAllAdmin || submittedByRow === targetCtvClean) && custEmail) {
        seenEmails.add(custEmail);
        const ticketId = String(row[1]).trim();
        const ticketInfo = ticketMap[ticketId] || { stt_group: '---', status: 'Đang hoạt động' };

        ctvReports.push({
          report_id: row[0],
          ticket_id: ticketId,
          customer_email: custEmail,
          reported_at: row[3],
          message: row[4],
          submitted_by: row[5],
          stt_group: ticketInfo.stt_group,
          status: ticketInfo.status
        });
      }
    }
  }

  // 2. Scan EMAIL_LOOKUP_CACHE for ALL customers belonging to this CTV
  try {
    const cache = readSheetAsObjects('EMAIL_LOOKUP_CACHE');
    for (let i = 0; i < cache.length; i++) {
      const custEmail = String(cache[i]['email'] || '').trim().toLowerCase();
      const ctvRow = String(cache[i]['ctv'] || '').trim().toLowerCase();

      if (custEmail && !seenEmails.has(custEmail)) {
        if (isAllAdmin || (ctvRow && ctvRow === targetCtvClean) || (targetCtvClean === 'tuan' && (!ctvRow || ctvRow === 'tuan'))) {
          seenEmails.add(custEmail);
          const stt = String(cache[i]['stt_group'] || '').trim();
          const ticketInfo = ticketMap[stt] || { status: 'Đang hoạt động' };

          ctvReports.push({
            report_id: 'CACHE-' + (i + 1),
            ticket_id: ticketInfo.ticket_id || '',
            customer_email: custEmail,
            reported_at: cache[i]['synced_at'] || '',
            message: 'Dữ liệu từ Kho TK',
            submitted_by: cache[i]['ctv'] || ctvName,
            stt_group: stt,
            status: ticketInfo.status
          });
        }
      }
    }
  } catch (e) {}

  return { success: true, ctv_name: ctvName, reports: ctvReports };
}

/**
 * API 2: checkStatus(email) — ĐỌC 100% TRỰC TIẾP TỪ KHO TK GOOGLE SHEET
 */
function checkStatus(emailRaw) {
  if (!emailRaw) {
    return { 
      success: false, 
      error: "missing_email",
      message: 'Vui lòng nhập Email.' 
    };
  }

  const emailClean = String(emailRaw).trim().toLowerCase();
  
  // Đọc 100% trực tiếp từ Sheet Kho TK (ID: 1Agq-0ITsQgzhwnWvQTUthAjS2e8zJfgNd8dGGkCDniA)
  const khoInfo = lookupKhoTKDirect(emailClean);

  if (!khoInfo || !khoInfo.stt_group) {
    return {
      success: false,
      error: "email_not_found",
      email: emailClean,
      message: "Không tìm thấy tài khoản với email này trong Kho TK chính. Vui lòng kiểm tra lại địa chỉ email."
    };
  }

  const sttGroup = khoInfo.stt_group;
  const ownerEmail = khoInfo.owner_email || '';
  const ctvName = khoInfo.ctv || '';
  const ngayRenew = khoInfo.ngay_renew || khoInfo.ngay_het_han || '';

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ticketsSheet = ss.getSheetByName('TICKETS');
  const reportsSheet = ss.getSheetByName('REPORTS');

  if (!ticketsSheet) {
    return { 
      success: true, 
      has_ticket: false, 
      email: emailClean,
      stt_group: sttGroup,
      owner_email: ownerEmail,
      ctv: ctvName,
      ngay_renew: ngayRenew,
      message: 'Chưa có dữ liệu sự cố.' 
    };
  }

  const ticketsData = ticketsSheet.getDataRange().getValues();
  let latestTicket = null;

  for (let r = 1; r < ticketsData.length; r++) {
    const row = ticketsData[r];
    if (String(row[1]).trim() === sttGroup) {
      const ticketObj = {
        ticket_id: row[0],
        stt_group: row[1],
        status: row[2],
        created_at: row[3],
        updated_at: row[4],
        resolved_at: row[5],
        resolved_by: row[6],
        is_recurring: Boolean(row[7]),
        recur_count: Number(row[8] || 0),
        note: row[9],
        resolution_type: row[11] ? String(row[11]).trim() : '',
        activity_status: row[12] ? String(row[12]).trim() : ''
      };
      
      if (!latestTicket || new Date(ticketObj.created_at) > new Date(latestTicket.created_at)) {
        latestTicket = ticketObj;
      }
    }
  }

  if (!latestTicket) {
    return {
      success: true,
      has_ticket: false,
      email: emailClean,
      stt_group: sttGroup,
      owner_email: ownerEmail,
      ctv: ctvName,
      ngay_renew: ngayRenew,
      message: 'Chưa có báo cáo sự cố nào cho fam (' + sttGroup + ') của bạn.'
    };
  }

  let reportCount = 0;
  if (reportsSheet && reportsSheet.getLastRow() > 1) {
    const reportsData = reportsSheet.getDataRange().getValues();
    for (let i = 1; i < reportsData.length; i++) {
      if (String(reportsData[i][1]).trim() === latestTicket.ticket_id) {
        reportCount++;
      }
    }
  }

  const historyTickets = [];
  for (let r = 1; r < ticketsData.length; r++) {
    const row = ticketsData[r];
    if (String(row[1]).trim() === sttGroup) {
      historyTickets.push({
        ticket_id: row[0],
        stt_group: row[1],
        status: row[2],
        created_at: row[3],
        updated_at: row[4],
        resolved_at: row[5],
        resolved_by: row[6] || '',
        is_recurring: Boolean(row[7]),
        recur_count: Number(row[8] || 0),
        note: row[9] || '',
        resolution_type: row[11] ? String(row[11]).trim() : '',
        activity_status: row[12] ? String(row[12]).trim() : ''
      });
    }
  }

  historyTickets.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  return {
    success: true,
    has_ticket: true,
    email: emailClean,
    stt_group: sttGroup,
    owner_email: ownerEmail,
    ctv: ctvName,
    ngay_renew: ngayRenew,
    status: latestTicket.status,
    ticket_id: latestTicket.ticket_id,
    created_at: latestTicket.created_at,
    updated_at: latestTicket.updated_at,
    resolved_at: latestTicket.resolved_at,
    resolved_by: latestTicket.resolved_by || '',
    is_recurring: latestTicket.is_recurring,
    recur_count: latestTicket.recur_count,
    note: latestTicket.note || '',
    resolution_type: latestTicket.resolution_type || '',
    activity_status: latestTicket.activity_status || '',
    report_count: reportCount,
    history_tickets: historyTickets
  };
}

/**
 * API 3: listTickets(filterStatus) - Admin Dashboard
 */
function listTickets(filterStatus) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ticketsSheet = ss.getSheetByName('TICKETS');
  const reportsSheet = ss.getSheetByName('REPORTS');

  let cacheHealth = checkCacheHealth();
  if (cacheHealth.cache_stale) {
    try {
      syncEmailLookupCache();
      cacheHealth = checkCacheHealth();
    } catch (e) {
      Logger.log('Auto sync warning: ' + e.toString());
    }
  }

  if (!ticketsSheet || ticketsSheet.getLastRow() <= 1) {
    return { 
      success: true, 
      tickets: [],
      cache_info: cacheHealth
    };
  }

  const reportMap = {};
  if (reportsSheet && reportsSheet.getLastRow() > 1) {
    const rData = reportsSheet.getDataRange().getValues();
    for (let i = 1; i < rData.length; i++) {
      const reportId = String(rData[i][0] || '').trim();
      const ticketId = String(rData[i][1]).trim();
      const email = String(rData[i][2]).trim();
      const reportedAt = rData[i][3];
      const message = String(rData[i][4] || '');
      const submittedBy = String(rData[i][5] || '');
      const zaloSentAt = rData[i][6] ? rData[i][6] : null;
      const isZaloSent = Boolean(zaloSentAt);

      if (!reportMap[ticketId]) {
        reportMap[ticketId] = { count: 0, emails: [], reports: [] };
      }
      reportMap[ticketId].count++;
      if (email && reportMap[ticketId].emails.indexOf(email) === -1) {
        reportMap[ticketId].emails.push(email);
      }
      reportMap[ticketId].reports.push({
        report_id: reportId,
        customer_email: email,
        reported_at: reportedAt,
        message: message,
        submitted_by: submittedBy,
        zalo_sent_at: zaloSentAt,
        is_zalo_sent: isZaloSent
      });
    }
  }

  // 1. Read Master/Owner emails directly from tab STOCK in Kho TK
  const sttOwnerMap = {};
  try {
    const khoSs = SpreadsheetApp.openById(KHO_TK_ID);
    const stockSheet = khoSs.getSheetByName('STOCK') || khoSs.getSheetByName('Stock') || khoSs.getSheetByName('stock');
    if (stockSheet && stockSheet.getLastRow() > 1) {
      const sData = stockSheet.getDataRange().getValues();
      let sSttCol = -1;
      let sEmailCol = -1;
      for (let r = 0; r < Math.min(10, sData.length); r++) {
        for (let c = 0; c < sData[r].length; c++) {
          const cellStr = String(sData[r][c] || '').trim().toLowerCase();
          if (cellStr === 'stt' || cellStr === 'mã' || cellStr.includes('stt')) sSttCol = c;
          if (cellStr === 'email' || cellStr.includes('email')) sEmailCol = c;
        }
        if (sSttCol !== -1 && sEmailCol !== -1) break;
      }
      if (sSttCol === -1) sSttCol = 0;
      if (sEmailCol === -1) sEmailCol = 1;

      for (let r = 1; r < sData.length; r++) {
        const stt = String(sData[r][sSttCol] || '').trim();
        const em = String(sData[r][sEmailCol] || '').trim().toLowerCase();
        if (stt && em && em.includes('@')) {
          sttOwnerMap[stt] = em;
        }
      }
    }
  } catch (errStock) {
    Logger.log('Warning reading STOCK in listTickets: ' + errStock.toString());
  }

  // 2. Read EMAIL_LOOKUP_CACHE for all customer emails & CTV per group
  const cacheEntries = [];
  const sttMembersMap = {};
  const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');
  if (cacheSheet && cacheSheet.getLastRow() > 1) {
    const cData = cacheSheet.getDataRange().getValues();
    for (let i = 1; i < cData.length; i++) {
      const em = String(cData[i][0] || '').trim().toLowerCase();
      const stt = String(cData[i][1] || '').trim();
      const owner = cData[i][3] ? String(cData[i][3]).trim().toLowerCase() : '';
      const ctv = cData[i][4] ? String(cData[i][4]).trim() : '';

      if (stt && owner && owner.includes('@') && !sttOwnerMap[stt]) {
        sttOwnerMap[stt] = owner;
      }

      if (em && stt) {
        if (!sttMembersMap[stt]) sttMembersMap[stt] = [];
        if (sttMembersMap[stt].findIndex(m => m.email === em) === -1) {
          sttMembersMap[stt].push({ email: em, ctv: ctv });
        }
        cacheEntries.push({
          email: em,
          stt_group: stt,
          owner_email: sttOwnerMap[stt] || owner || '',
          ctv: ctv
        });
      }
    }
  }

  // 3. Read WARRANTY customer emails for cross-reference matching
  const warrantyCustomerEmails = new Set();
  try {
    const wObjects = readSheetAsObjects('WARRANTY');
    for (let w = 0; w < wObjects.length; w++) {
      const rowVal = wObjects[w]._rowValues || [];
      for (let c = 6; c < rowVal.length; c++) {
        const em = String(rowVal[c] || '').trim().toLowerCase();
        if (em && em.includes('@')) {
          warrantyCustomerEmails.add(em);
        }
      }
    }
  } catch (wErr) {
    Logger.log('Warning reading WARRANTY in listTickets: ' + wErr.toString());
  }

  const tData = ticketsSheet.getDataRange().getValues();
  const tickets = [];

  for (let i = 1; i < tData.length; i++) {
    const row = tData[i];
    const ticketId = String(row[0]).trim();
    const sttGroup = String(row[1]).trim();
    const status = String(row[2]).trim();

    if (filterStatus && filterStatus !== 'All' && filterStatus !== 'Tất cả') {
      if (filterStatus === 'Tái phát' || filterStatus === 'Recurring') {
        if (!Boolean(row[7])) continue;
      } else if (status !== filterStatus) {
        continue;
      }
    }

    const reportInfo = reportMap[ticketId] || { count: 0, emails: [] };
    const ownerEmail = sttOwnerMap[sttGroup] || (reportInfo.emails && reportInfo.emails[0] ? reportInfo.emails[0] : '');
    const allMembers = sttMembersMap[sttGroup] || [];

    tickets.push({
      ticket_id: ticketId,
      stt_group: sttGroup,
      owner_email: ownerEmail,
      status: status,
      created_at: row[3],
      updated_at: row[4],
      resolved_at: row[5],
      resolved_by: row[6],
      is_recurring: Boolean(row[7]),
      recur_count: Number(row[8] || 0),
      note: row[9] || '',
      notified_at: row[10] || '',
      resolution_type: row[11] ? String(row[11]).trim() : '',
      activity_status: row[12] ? String(row[12]).trim() : '',
      report_count: reportInfo.count,
      reported_emails: reportInfo.emails,
      reports: reportInfo.reports || [],
      fam_all_members: allMembers
    });
  }

  tickets.sort((a, b) => {
    const aClosed = (a.status === 'Đã xử lý') ? 1 : 0;
    const bClosed = (b.status === 'Đã xử lý') ? 1 : 0;
    if (aClosed !== bClosed) return aClosed - bClosed;

    if (b.recur_count !== a.recur_count) {
      return b.recur_count - a.recur_count;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return { 
    success: true, 
    tickets: tickets,
    cache_entries: cacheEntries,
    stt_members_map: sttMembersMap,
    warranty_assigned_emails: Array.from(warrantyCustomerEmails),
    cache_info: cacheHealth
  };
}

/**
 * API 4: updateTicketStatus(ticket_id, newStatus, resolvedBy, note, resolutionType)
 * Tự động gửi mail thông báo khi chuyển thành 'Đã xử lý'
 */
function updateTicketStatus(ticketId, newStatus, resolvedBy, note, resolutionType) {
  if (!ticketId || !newStatus) {
    return { success: false, message: 'Thiếu ticket_id hoặc newStatus.' };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { success: false, message: 'Hệ thống đang bận, vui lòng thử lại sau ít giây.' };
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ticketsSheet = ss.getSheetByName('TICKETS');
    const reportsSheet = ss.getSheetByName('REPORTS');
    const data = ticketsSheet.getDataRange().getValues();

    let targetRowIndex = -1;
    let currentTicket = null;

    for (let r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim() === String(ticketId).trim()) {
        targetRowIndex = r + 1; // 1-indexed
        currentTicket = {
          ticket_id: data[r][0],
          stt_group: data[r][1],
          status: data[r][2],
          notified_at: data[r][10]
        };
        break;
      }
    }

    if (targetRowIndex === -1) {
      return { success: false, message: 'Không tìm thấy ticket_id: ' + ticketId };
    }

    const nowIso = new Date().toISOString();
    const rowValues = data[targetRowIndex - 1] ? [...data[targetRowIndex - 1]] : [];
    while (rowValues.length < 12) rowValues.push('');

    rowValues[2] = newStatus; // status
    rowValues[4] = nowIso; // updated_at
    if (note !== undefined && note !== null) {
      rowValues[9] = note; // note
    }

    let emailSentCount = 0;

    if (newStatus === 'Đã xử lý') {
      rowValues[5] = nowIso; // resolved_at
      if (resolvedBy) {
        rowValues[6] = resolvedBy; // resolved_by
      }
      if (resolutionType) {
        rowValues[11] = resolutionType; // resolution_type
      }

      if (!currentTicket.notified_at) {
        const customerEmails = [];
        if (reportsSheet && reportsSheet.getLastRow() > 1) {
          const rData = reportsSheet.getDataRange().getValues();
          for (let i = 1; i < rData.length; i++) {
            if (String(rData[i][1]).trim() === String(ticketId).trim()) {
              const em = String(rData[i][2] || '').trim().toLowerCase();
              if (em && em.includes('@') && customerEmails.indexOf(em) === -1) {
                customerEmails.push(em);
              }
            }
          }
        }

        const resolvedTimeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' +
                                new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

        for (let eIdx = 0; eIdx < customerEmails.length; eIdx++) {
          const email = customerEmails[eIdx];
          try {
            MailApp.sendEmail({
              to: email,
              subject: '[Go DNC] Sự cố nhóm tài khoản Fam ' + currentTicket.stt_group + ' đã được khắc phục',
              body: 'Chào bạn,\n\n' +
                    'Sự cố nhóm tài khoản Fam (' + currentTicket.stt_group + ') của bạn đã được đội ngũ kỹ thuật Go DNC xử lý hoàn tất lúc ' + resolvedTimeStr + '.\n\n' +
                    'Nếu bạn vẫn gặp gián đoạn hoặc cần hỗ trợ thêm, vui lòng gửi báo lỗi mới tại: https://godnc.com/renew/\n\n' +
                    'Cảm ơn bạn đã đồng hành cùng Go DNC!\n' +
                    'Trân trọng,\nĐội ngũ Kỹ Thuật Go DNC'
            });
            emailSentCount++;
          } catch (mailErr) {
            Logger.log('CẢNH BÁO gửi mail thất bại cho ' + email + ': ' + mailErr.toString());
          }
        }

        rowValues[10] = nowIso; // notified_at
      }
    }

    // Ghi gộp toàn bộ 12 cột của dòng ticket được cập nhật xuống Google Sheet
    updateRowRangeFast('TICKETS', targetRowIndex, 1, rowValues);

    return { 
      success: true, 
      emails_sent: emailSentCount,
      message: 'Đã cập nhật trạng thái ticket ' + ticketId + ' thành "' + newStatus + '"' + (emailSentCount > 0 ? (' (Đã gửi email thông báo cho ' + emailSentCount + ' khách)') : '')
    };

  } catch (err) {
    return { success: false, message: 'Lỗi cập nhật ticket: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * API CHÍNH: getTicketsFeed(ctvName, feedType)
 * feedType: 'pending' (Chưa xử lý - Khu 3) hoặc 'resolved' (Đã xử lý - Khu 2)
 */
function getTicketsFeed(ctvNameRaw, feedType) {
  const ctvNameClean = ctvNameRaw ? String(ctvNameRaw).trim().toLowerCase() : '';
  const isPendingType = (feedType === 'pending' || feedType === 'Pending' || feedType === 'chờ' || feedType === 'cho');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ticketsSheet = ss.getSheetByName('TICKETS');
  const reportsSheet = ss.getSheetByName('REPORTS');
  const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');

  if (!ticketsSheet || ticketsSheet.getLastRow() <= 1) {
    return { success: true, total: 0, feed: [] };
  }

  // 1. Map stt_group -> Owner Email directly from tab STOCK in Kho TK
  const sttOwnerMap = {};
  try {
    const khoSs = SpreadsheetApp.openById(KHO_TK_ID);
    const stockSheet = khoSs.getSheetByName('STOCK') || khoSs.getSheetByName('Stock') || khoSs.getSheetByName('stock');
    if (stockSheet && stockSheet.getLastRow() > 1) {
      const sData = stockSheet.getDataRange().getValues();
      let sSttCol = -1;
      let sEmailCol = -1;
      for (let r = 0; r < Math.min(10, sData.length); r++) {
        for (let c = 0; c < sData[r].length; c++) {
          const cellStr = String(sData[r][c] || '').trim().toLowerCase();
          if (cellStr === 'stt' || cellStr === 'mã' || cellStr.includes('stt')) sSttCol = c;
          if (cellStr === 'email' || cellStr.includes('email')) sEmailCol = c;
        }
        if (sSttCol !== -1 && sEmailCol !== -1) break;
      }
      if (sSttCol === -1) sSttCol = 0;
      if (sEmailCol === -1) sEmailCol = 1;

      for (let r = 1; r < sData.length; r++) {
        const stt = String(sData[r][sSttCol] || '').trim();
        const em = String(sData[r][sEmailCol] || '').trim().toLowerCase();
        if (stt && em && em.includes('@')) {
          sttOwnerMap[stt] = em;
        }
      }
    }
  } catch (errStock) {
    Logger.log('Cảnh báo đọc tab STOCK trực tiếp: ' + errStock.toString());
  }

  // Also read cache for emailCtvMap & sttCtvMap, and fallback sttOwnerMap if needed
  const emailCtvMap = {};
  const sttCtvMap = {};
  const sttMembersMap = {};
  const cacheGroupMap = {};

  if (cacheSheet && cacheSheet.getLastRow() > 1) {
    const cData = cacheSheet.getDataRange().getValues();
    for (let i = 1; i < cData.length; i++) {
      const em = String(cData[i][0] || '').trim().toLowerCase();
      const stt = String(cData[i][1] || '').trim();
      const ownerEm = String(cData[i][3] || '').trim();
      const ctvVal = cData[i][4] ? String(cData[i][4]).trim() : '';

      if (em && stt) {
        cacheGroupMap[em] = stt;
      }
      if (stt && ownerEm && ownerEm.includes('@') && !sttOwnerMap[stt]) {
        sttOwnerMap[stt] = ownerEm;
      }
      if (em && ctvVal) {
        emailCtvMap[em] = ctvVal;
      }
      if (stt && em) {
        if (!sttMembersMap[stt]) sttMembersMap[stt] = [];
        if (sttMembersMap[stt].findIndex(m => m.email === em) === -1) {
          sttMembersMap[stt].push({ email: em, ctv: ctvVal });
        }
      }
      if (stt && ctvVal) {
        if (!sttCtvMap[stt]) sttCtvMap[stt] = new Set();
        sttCtvMap[stt].add(ctvVal.toLowerCase());
      }
    }
  }

  // 2. Map ticket_id -> reports count, emails & submitted_by CTVs from REPORTS
  const reportStatsMap = {};
  if (reportsSheet && reportsSheet.getLastRow() > 1) {
    const rData = reportsSheet.getDataRange().getValues();
    for (let i = 1; i < rData.length; i++) {
      const ticketId = String(rData[i][1]).trim();
      const email = String(rData[i][2] || '').trim().toLowerCase();
      const submittedBy = rData[i][5] ? String(rData[i][5]).trim() : '';
      if (!reportStatsMap[ticketId]) {
        reportStatsMap[ticketId] = { count: 0, ctvs: new Set(), emails: [] };
      }
      reportStatsMap[ticketId].count++;
      if (email && reportStatsMap[ticketId].emails.indexOf(email) === -1) {
        reportStatsMap[ticketId].emails.push(email);
      }
      if (email && submittedBy && !emailCtvMap[email]) {
        emailCtvMap[email] = submittedBy;
      }
      if (submittedBy) {
        reportStatsMap[ticketId].ctvs.add(submittedBy.toLowerCase());
      }
    }
  }

  // 3. Scan TICKETS with status filter
  const tData = ticketsSheet.getDataRange().getValues();
  const feed = [];

  for (let i = 1; i < tData.length; i++) {
    const row = tData[i];
    const status = String(row[2]).trim();

    const isResolvedStatus = (status === 'Đã xử lý');
    const matchFilter = isPendingType ? !isResolvedStatus : isResolvedStatus;

    if (matchFilter) {
      const ticketId = String(row[0]).trim();
      const sttGroup = String(row[1]).trim();
      const resolvedAt = row[5] || row[4] || row[3];
      const isRecurring = Boolean(row[7]);
      const recurCount = Number(row[8] || 0);
      const note = row[9] || '';

      const rStats = reportStatsMap[ticketId] || { count: 0, ctvs: new Set(), emails: [] };
      
      let isRelevant = false;
      if (ctvNameClean) {
        if (sttCtvMap[sttGroup] && sttCtvMap[sttGroup].has(ctvNameClean)) {
          isRelevant = true;
        }
        if (rStats.ctvs.has(ctvNameClean)) {
          isRelevant = true;
        }
      }

      // Combine reported emails with all members in Kho TK for this sttGroup
      const combinedEmailMap = {};
      (rStats.emails || []).forEach(em => {
        if (em) {
          const emClean = em.toLowerCase();
          const mappedStt = cacheGroupMap[emClean];
          if (!mappedStt || mappedStt === sttGroup) {
            combinedEmailMap[emClean] = em;
          }
        }
      });
      const khoMembers = sttMembersMap[sttGroup] || [];
      khoMembers.forEach(m => {
        if (m.email && !combinedEmailMap[m.email.toLowerCase()]) {
          combinedEmailMap[m.email.toLowerCase()] = m.email;
        }
        if (m.email && m.ctv && !emailCtvMap[m.email.toLowerCase()]) {
          emailCtvMap[m.email.toLowerCase()] = m.ctv;
        }
      });

      const customerDetails = [];
      const emailList = Object.values(combinedEmailMap);
      for (let e = 0; e < emailList.length; e++) {
        const em = emailList[e];
        const ctvVal = emailCtvMap[em.toLowerCase()] || emailCtvMap[em] || '';
        
        // Privacy filter: If CTV name is specified, only include customers belonging to that CTV!
        if (ctvNameClean && ctvNameClean !== 'admin') {
          if (ctvVal && ctvVal.toLowerCase() === ctvNameClean) {
            customerDetails.push({
              email: em,
              ctv: ctvVal
            });
          }
        } else {
          customerDetails.push({
            email: em,
            ctv: ctvVal
          });
        }
      }

      // If CTV filter is active and there are 0 customers belonging to this CTV, skip ticket
      if (ctvNameClean && ctvNameClean !== 'admin' && customerDetails.length === 0) {
        continue;
      }

      const filteredEmailList = customerDetails.map(c => c.email);

      feed.push({
        ticket_id: ticketId,
        stt_group: sttGroup,
        root_email: sttOwnerMap[sttGroup] || 'Chưa rõ tài khoản gốc',
        status: status,
        created_at: row[3],
        updated_at: row[4],
        resolved_at: resolvedAt,
        resolved_by: row[6] || 'Admin',
        is_recurring: isRecurring,
        recur_count: recurCount,
        note: note,
        resolution_type: row[11] ? String(row[11]).trim() : '',
        activity_status: row[12] ? String(row[12]).trim() : '',
        affected_count: customerDetails.length,
        customer_emails: filteredEmailList,
        customer_details: customerDetails,
        is_relevant_to_ctv: true
      });
    }
  }

  // Sort feed:
  // First: is_relevant_to_ctv = true on top
  // If pending feed: sort relevant tickets by created_at ASC (oldest waiting first)
  // If resolved feed: sort by resolved_at DESC
  feed.sort((a, b) => {
    if (a.is_relevant_to_ctv && !b.is_relevant_to_ctv) return -1;
    if (!a.is_relevant_to_ctv && b.is_relevant_to_ctv) return 1;

    if (isPendingType) {
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    } else {
      return new Date(b.resolved_at || 0).getTime() - new Date(a.resolved_at || 0).getTime();
    }
  });

  return {
    success: true,
    total: feed.length,
    feed: feed
  };
}

function getFixedSlotsFeed(ctvNameRaw) {
  return getTicketsFeed(ctvNameRaw, 'resolved');
}

/**
 * DỌN DẸP TICKET TRÙNG: cleanupDuplicateTickets()
 * Quét toàn bộ TICKETS tab, gộp các ticket trùng stt_group được tạo trong cùng khung 24h
 */
function cleanupDuplicateTickets() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { success: false, message: 'Hệ thống đang bận, vui lòng thử lại sau.' };
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ticketsSheet = ss.getSheetByName('TICKETS');
    const reportsSheet = ss.getSheetByName('REPORTS');

    if (!ticketsSheet || ticketsSheet.getLastRow() <= 1) {
      return { success: true, message: 'Không có dữ liệu ticket.' };
    }

    const tData = ticketsSheet.getDataRange().getValues();
    const rData = reportsSheet ? reportsSheet.getDataRange().getValues() : [];

    // Count reports per ticket_id
    const reportCountMap = {};
    for (let i = 1; i < rData.length; i++) {
      const ticketId = String(rData[i][1]).trim();
      reportCountMap[ticketId] = (reportCountMap[ticketId] || 0) + 1;
    }

    // Group tickets by stt_group
    const groupTicketsMap = {};
    for (let i = 1; i < tData.length; i++) {
      const row = tData[i];
      const ticketId = String(row[0]).trim();
      const sttGroup = String(row[1]).trim();
      const status = String(row[2]).trim();

      if (!groupTicketsMap[sttGroup]) {
        groupTicketsMap[sttGroup] = [];
      }
      groupTicketsMap[sttGroup].push({
        rowIndex: i + 1,
        ticket_id: ticketId,
        stt_group: sttGroup,
        status: status,
        created_at: parseDateHelper(row[3]),
        resolved_at: parseDateHelper(row[5]),
        is_recurring: Boolean(row[7]),
        recur_count: Number(row[8] || 0),
        reportCount: reportCountMap[ticketId] || 0
      });
    }

    let mergedCount = 0;
    const rowsToDelete = [];
    const reportsToUpdate = [];

    for (const stt in groupTicketsMap) {
      const list = groupTicketsMap[stt];
      if (list.length > 1) {
        // Sort by reportCount DESC, created_at DESC
        list.sort((a, b) => b.reportCount - a.reportCount);
        const primaryTicket = list[0];

        for (let k = 1; k < list.length; k++) {
          const dupTicket = list[k];
          const pTime = primaryTicket.created_at ? primaryTicket.created_at.getTime() : 0;
          const dTime = dupTicket.created_at ? dupTicket.created_at.getTime() : 0;
          const diffHours = Math.abs(pTime - dTime) / (1000 * 60 * 60);

          if (diffHours <= 24) {
            for (let r = 1; r < rData.length; r++) {
              if (String(rData[r][1]).trim() === dupTicket.ticket_id) {
                reportsToUpdate.push({ rowIndex: r + 1, newTicketId: primaryTicket.ticket_id });
              }
            }
            rowsToDelete.push(dupTicket.rowIndex);
            mergedCount++;
          }
        }
      }
    }

    // Update REPORTS sheet
    for (let u = 0; u < reportsToUpdate.length; u++) {
      reportsSheet.getRange(reportsToUpdate[u].rowIndex, 2).setValue(reportsToUpdate[u].newTicketId);
    }

    // Delete duplicate rows in TICKETS sheet from bottom to top
    rowsToDelete.sort((a, b) => b - a);
    for (let d = 0; d < rowsToDelete.length; d++) {
      ticketsSheet.deleteRow(rowsToDelete[d]);
    }

    Logger.log('Đã dọn dẹp ' + mergedCount + ' ticket trùng lặp!');
    return {
      success: true,
      merged_count: mergedCount,
      message: 'Đã gộp thành công ' + mergedCount + ' ticket trùng lặp!'
    };
  } catch (err) {
    Logger.log('Lỗi dọn dẹp ticket trùng: ' + err.toString());
    return { success: false, message: 'Lỗi dọn dẹp: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * API Admin: proactiveQuickFix(rawText, resolvedBy)
 * Admin dán danh sách mã RN hoặc email vừa fix xong ➔ Tự động tìm stt_group & cập nhật/tạo ticket ĐÃ XỬ LÝ
 */
function proactiveQuickFix(rawText, resolvedBy) {
  if (!rawText || !String(rawText).trim()) {
    return { success: false, message: 'Vui lòng dán mã RN hoặc email vừa fix.' };
  }

  const textStr = String(rawText).trim();
  
  // Extract RN codes
  const rnRegex = /\bRN\d+\b/gi;
  const rnMatches = textStr.match(rnRegex) || [];
  
  // Extract Emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailMatches = textStr.match(emailRegex) || [];

  const targetGroups = new Set();

  rnMatches.forEach(rn => targetGroups.add(rn.toUpperCase()));

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');
  const cacheMap = {};
  if (cacheSheet && cacheSheet.getLastRow() > 1) {
    const cData = cacheSheet.getDataRange().getValues();
    for (let i = 1; i < cData.length; i++) {
      const em = String(cData[i][0] || '').trim().toLowerCase();
      const stt = String(cData[i][1] || '').trim().toUpperCase();
      if (em && stt) cacheMap[em] = stt;
    }
  }

  emailMatches.forEach(em => {
    const cleanEm = em.toLowerCase();
    if (cacheMap[cleanEm]) {
      targetGroups.add(cacheMap[cleanEm]);
    }
  });

  if (targetGroups.size === 0) {
    return { success: false, message: 'Không tìm thấy mã RN hoặc email hợp lệ nào trong cache Kho TK.' };
  }

  const now = new Date();
  const fixedGroups = Array.from(targetGroups);

  for (let i = 0; i < fixedGroups.length; i++) {
    const stt = fixedGroups[i];
    const ticketInfo = findOrCreateTicketForGroup(stt, now);
    updateTicketStatus(ticketInfo.ticket_id, 'Đã xử lý', resolvedBy || 'Admin', 'Admin chủ động fix hàng loạt');
  }

  return {
    success: true,
    count: fixedGroups.length,
    fixed_groups: fixedGroups,
    message: 'Đã cập nhật trạng thái "Đã xử lý" thành công cho ' + fixedGroups.length + ' nhóm: ' + fixedGroups.join(', ')
  };
}

/**
  * Đánh dấu / Bỏ đánh dấu Trạng thái Báo Zalo Khách (Lưu tập trung ở Spreadsheet tab REPORTS Col 7)
  */
function toggleZaloSent(reportId, customerEmail, isSent) {
  try {
    const ss = getSpreadsheet();
    const reportsSheet = ss.getSheetByName('REPORTS');
    if (!reportsSheet || reportsSheet.getLastRow() < 2) {
      return { success: false, error: 'Chưa có sheet REPORTS' };
    }
    const rData = reportsSheet.getDataRange().getValues();
    let updated = 0;
    const targetEmail = customerEmail ? String(customerEmail).trim().toLowerCase() : '';
    const targetReportId = reportId ? String(reportId).trim() : '';

    // Ghi tiêu đề cột G nếu chưa có
    if (rData[0].length < 7 || String(rData[0][6] || '').trim() === '') {
      reportsSheet.getRange(1, 7).setValue('zalo_sent_at');
    }

    for (let i = 1; i < rData.length; i++) {
      const rId = String(rData[i][0] || '').trim();
      const em = String(rData[i][2] || '').trim().toLowerCase();

      if ((targetReportId && rId === targetReportId) || (targetEmail && em === targetEmail)) {
        const valToSet = (isSent === true || isSent === 'true' || isSent === 1 || isSent === '1') ? new Date() : '';
        reportsSheet.getRange(i + 1, 7).setValue(valToSet);
        updated++;
      }
    }

    return { success: true, updated: updated, is_sent: Boolean(isSent) };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * TÍNH MÃ 6 SỐ TOTP THEO CHUẨN RFC 6238 (HMAC-SHA1, 30 GIÂY)
 */
function getCurrentTOTPCode(base32Secret) {
  if (!base32Secret) {
    return { success: false, code: '------', secondsRemaining: 0 };
  }
  
  try {
    const cleanSecret = String(base32Secret).replace(/\s+/g, '').toUpperCase();
    const keyBytes = base32ToBytes(cleanSecret);
    if (!keyBytes || keyBytes.length === 0) {
      return { success: false, code: '------', secondsRemaining: 0 };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(nowSec / 30);
    const secondsRemaining = 30 - (nowSec % 30);

    // Convert timeStep to 8-byte big-endian array
    const counterBytes = new Array(8);
    let temp = timeStep;
    for (let i = 7; i >= 0; i--) {
      counterBytes[i] = temp & 0xff;
      temp = Math.floor(temp / 256);
    }

    const hmacSigned = Utilities.computeHmacSha1Signature(counterBytes, keyBytes);
    const hmac = hmacSigned.map(b => (b < 0 ? b + 256 : b));

    // Dynamic truncation according to RFC 4226 / RFC 6238
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) |
                   ((hmac[offset + 1] & 0xff) << 16) |
                   ((hmac[offset + 2] & 0xff) << 8) |
                   (hmac[offset + 3] & 0xff);

    const otp = binary % 1000000;
    const codeStr = String(otp).padStart(6, '0');

    return {
      success: true,
      code: codeStr,
      secondsRemaining: secondsRemaining
    };
  } catch (err) {
    Logger.log('Lỗi tính TOTP: ' + err.toString());
    return { success: false, code: '------', secondsRemaining: 0, error: err.toString() };
  }
}

/**
 * Decode chuỗi Base32 (RFC 4648) thành mảng Byte
 */
function base32ToBytes(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (let i = 0; i < base32.length; i++) {
    const char = base32.charAt(i);
    const val = alphabet.indexOf(char);
    if (val !== -1) {
      bits += val.toString(2).padStart(5, '0');
    }
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return bytes;
}

function getTOTPCode(secret2fa) {
  return getCurrentTOTPCode(secret2fa);
}

/**
 * CẤP TÀI KHOẢN BẢO HÀNH TẠM (Tab WARRANTY trong FAM_ISSUE_TRACKER - Tối ưu 1-Read & 1-Write)
 */
function assignWarrantyAccount(customerEmail, ctvName) {
  const tStart = Date.now();
  Logger.log('[PERF] Start assignWarrantyAccount for: ' + customerEmail);

  if (!customerEmail || !customerEmail.trim()) {
    return { success: false, message: 'Vui lòng nhập email khách hàng cần cấp tài khoản bảo hành.' };
  }

  const cleanEmail = customerEmail.trim().toLowerCase();

  try {
    // Mở Spreadsheet ĐÚNG 1 LẦN
    const ss = getSpreadsheet();

    // 1. Kiểm tra email khách trong Cache (dùng lại ss đã mở)
    const isFound = isCustomerEmailInCache(cleanEmail, ss);
    const tCache = Date.now();
    Logger.log('[PERF] Step 1 (Cache Check): ' + (tCache - tStart) + ' ms');

    if (!isFound) {
      return {
        success: false,
        message: 'Email này không khớp với danh sách khách hàng trong Kho TK, không thể cấp tài khoản bảo hành.'
      };
    }

    // 2. Mở tab WARRANTY & Đọc toàn bộ dữ liệu ĐÚNG 1 LẦN
    let warrantySheet = ss.getSheetByName('WARRANTY') || ss.getSheetByName('Warranty') || ss.getSheetByName('warranty');
    if (!warrantySheet) {
      return { success: false, message: 'Không tìm thấy tab WARRANTY trong sheet FAM_ISSUE_TRACKER.' };
    }

    const lastRow = warrantySheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'Hết tài khoản bảo hành tạm, vui lòng báo admin bổ sung.' };
    }

    const data = warrantySheet.getDataRange().getValues();
    const tData = Date.now();
    Logger.log('[PERF] Step 2 (Read WARRANTY Data): ' + (tData - tCache) + ' ms');

    const headers = data[0];

    // Đọc động tất cả cột BHCus*
    const bhCusCols = [];
    for (let c = 0; c < headers.length; c++) {
      const hStr = String(headers[c] || '').trim().toLowerCase();
      if (hStr.startsWith('bhcus')) {
        bhCusCols.push({
          colIndex: c,
          headerName: String(headers[c]).trim(),
          slotNum: bhCusCols.length + 1
        });
      }
    }

    if (bhCusCols.length === 0) {
      bhCusCols.push({ colIndex: 6, headerName: 'BHCus1', slotNum: 1 });
      bhCusCols.push({ colIndex: 7, headerName: 'BHCus2', slotNum: 2 });
      bhCusCols.push({ colIndex: 8, headerName: 'BHCus3', slotNum: 3 });
      bhCusCols.push({ colIndex: 9, headerName: 'BHCus4', slotNum: 4 });
      bhCusCols.push({ colIndex: 10, headerName: 'BHCus5', slotNum: 5 });
    }

    // 3. Xử lý trong RAM: Quét xem khách đã từng được cấp chưa (Triệu hồi)
    for (let r = 1; r < data.length; r++) {
      for (let k = 0; k < bhCusCols.length; k++) {
        const cellVal = String(data[r][bhCusCols[k].colIndex] || '').trim().toLowerCase();
        if (cellVal === cleanEmail) {
          const rowData = data[r];
          const stt = rowData[0] || '';
          const accEmail = String(rowData[1] || '').trim();
          const pass = String(rowData[2] || '').trim();
          const mkp = String(rowData[3] || '').trim();
          const secret2fa = String(rowData[4] || '').trim();
          
          let ngayRenew = '---';
          if (rowData[5]) {
            try {
              const d = new Date(rowData[5]);
              if (!isNaN(d.getTime())) {
                ngayRenew = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
              } else {
                ngayRenew = String(rowData[5]);
              }
            } catch (e) {
              ngayRenew = String(rowData[5]);
            }
          }

          const tDone = Date.now();
          Logger.log('[PERF] Step 3 (Re-summon Match Found): ' + (tDone - tData) + ' ms. Total: ' + (tDone - tStart) + ' ms');

          return {
            success: true,
            isReassigned: true,
            stt: stt,
            email: accEmail,
            pass: pass,
            mkp: mkp,
            secret2fa: secret2fa,
            totpCode: '------',
            secondsRemaining: 30,
            ngayRenew: ngayRenew,
            slotUsed: bhCusCols[k].slotNum,
            totalSlots: bhCusCols.length,
            customerEmail: cleanEmail,
            message: 'Khách hàng này đã được cấp tài khoản bảo hành trước đó. Đã triệu hồi lại tài khoản!'
          };
        }
      }
    }

    // 4. Xử lý trong RAM: Tìm slot BHCus* trống đầu tiên từ trái sang phải
    let foundRowIndex = -1;
    let foundTargetColIndex = -1;
    let slotUsed = 0;

    for (let r = 1; r < data.length; r++) {
      for (let k = 0; k < bhCusCols.length; k++) {
        const val = String(data[r][bhCusCols[k].colIndex] || '').trim();
        if (!val) {
          foundRowIndex = r + 1; // 1-indexed row
          foundTargetColIndex = bhCusCols[k].colIndex + 1; // 1-indexed col
          slotUsed = bhCusCols[k].slotNum;
          break;
        }
      }
      if (foundRowIndex !== -1) break;
    }

    if (foundRowIndex === -1 || foundTargetColIndex === -1) {
      return { success: false, message: 'Hết tài khoản bảo hành tạm, vui lòng báo admin bổ sung.' };
    }

    // Ghi kết quả ĐÚNG 1 LẦN duy nhất
    warrantySheet.getRange(foundRowIndex, foundTargetColIndex).setValue(cleanEmail);

    const rowData = data[foundRowIndex - 1];
    const stt = rowData[0] || '';
    const accEmail = String(rowData[1] || '').trim();
    const pass = String(rowData[2] || '').trim();
    const mkp = String(rowData[3] || '').trim();
    const secret2fa = String(rowData[4] || '').trim();
    
    let ngayRenew = '---';
    if (rowData[5]) {
      try {
        const d = new Date(rowData[5]);
        if (!isNaN(d.getTime())) {
          ngayRenew = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } else {
          ngayRenew = String(rowData[5]);
        }
      } catch (e) {
        ngayRenew = String(rowData[5]);
      }
    }

    const tDone = Date.now();
    Logger.log('[PERF] Step 3 (Write Slot Done): ' + (tDone - tData) + ' ms. Total: ' + (tDone - tStart) + ' ms');

    return {
      success: true,
      isReassigned: false,
      stt: stt,
      email: accEmail,
      pass: pass,
      mkp: mkp,
      secret2fa: secret2fa,
      totpCode: '------',
      secondsRemaining: 30,
      ngayRenew: ngayRenew,
      slotUsed: slotUsed,
      totalSlots: bhCusCols.length,
      customerEmail: cleanEmail,
      message: 'Cấp tài khoản bảo hành tạm thành công!'
    };

  } catch (err) {
    Logger.log('Lỗi assignWarrantyAccount: ' + err.toString());
    return { success: false, message: 'Lỗi xử lý máy chủ: ' + err.toString() };
  }
}

/**
 * Helper lấy Spreadsheet FAM_ISSUE_TRACKER (Tự động thử getActiveSpreadsheet trước, fallback openById)
 */
function getSpreadsheet() {
  let ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {}
  if (!ss) {
    ss = SpreadsheetApp.openById('1-rxrJrBTMY3DqJ_DMRzPMg7lzEEIhvpfxPtaEVPl0jY');
  }
  return ss;
}

/**
 * Helper kiểm tra email khách siêu tốc (Tái sử dụng Spreadsheet object đã mở)
 */
function isCustomerEmailInCache(email, targetSs) {
  if (!email) return false;
  const cleanEm = String(email).trim().toLowerCase();
  if (!cleanEm || !cleanEm.includes('@')) return false;

  // 0. CacheService In-Memory Check (Siêu tốc 0.001s)
  try {
    const memCache = CacheService.getScriptCache();
    const cachedVal = memCache.get('valid_cust_' + cleanEm);
    if (cachedVal === '1') return true;
  } catch (eMem) {}

  // 1. Kiểm tra trong tab EMAIL_LOOKUP_CACHE (Dùng targetSs đã mở, 0.05s)
  try {
    const ss = targetSs || getSpreadsheet();
    const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');
    if (cacheSheet && cacheSheet.getLastRow() > 1) {
      const lastR = cacheSheet.getLastRow();
      const colAValues = cacheSheet.getRange(2, 1, lastR - 1, 1).getValues();
      for (let i = 0; i < colAValues.length; i++) {
        const em = String(colAValues[i][0] || '').trim().toLowerCase();
        if (em === cleanEm) {
          try { CacheService.getScriptCache().put('valid_cust_' + cleanEm, '1', 21600); } catch (e) {}
          return true;
        }
      }
    }
  } catch (err) {
    Logger.log('Lỗi check EMAIL_LOOKUP_CACHE: ' + err.toString());
  }

  // 2. FALLBACK TỐI ƯU SIÊU TỐC VÀO KHO TK (Chỉ đọc cột K - Email khách 0.2s)
  try {
    const khoSs = SpreadsheetApp.openById(KHO_TK_ID);
    const khoSheet = khoSs.getSheetByName(KHO_TK_TAB_NAME);
    if (khoSheet && khoSheet.getLastRow() > 1) {
      const lastR = khoSheet.getLastRow();
      const colKValues = khoSheet.getRange(2, 11, lastR - 1, 1).getValues();
      for (let i = 0; i < colKValues.length; i++) {
        const kEmail = String(colKValues[i][0] || '').trim().toLowerCase();
        if (kEmail === cleanEm) {
          // Lưu vào Memory Cache và tự động bổ sung vào tab EMAIL_LOOKUP_CACHE để lần sau 0ms
          try {
            CacheService.getScriptCache().put('valid_cust_' + cleanEm, '1', 21600);
            const ss = getSpreadsheet();
            const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');
            if (cacheSheet) {
              cacheSheet.appendRow([cleanEm, new Date()]);
            }
          } catch (eApp) {}
          return true;
        }
      }
    }
  } catch (err2) {
    Logger.log('Lỗi fallback check Kho TK: ' + err2.toString());
  }

  return false;
}

/**
 * AUDIT TICKET VÀ REPORT BỊ ẢNH HƯỞNG BỞI LỖI CARRY-FORWARD CŨ:
 * 1. Sync lại EMAIL_LOOKUP_CACHE với logic 5-dòng mới
 * 2. Quét toàn bộ dòng trong TICKETS và REPORTS cho PL394, Ticket "79", và các ticket bất thường > 5 member
 * 3. Đánh giá stt_group thật của từng email
 * 4. Trả về bảng đối chiếu trước/sau hoàn chỉnh cho DNL duyệt!
 */
function auditAffectedTickets() {
  const syncRes = syncEmailLookupCache();
  
  const ss = getSpreadsheet();
  const ticketsSheet = ss.getSheetByName('TICKETS');
  const reportsSheet = ss.getSheetByName('REPORTS');
  const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');

  const cleanCacheMap = {};
  if (cacheSheet && cacheSheet.getLastRow() > 1) {
    const cData = cacheSheet.getDataRange().getValues();
    for (let i = 1; i < cData.length; i++) {
      const em = String(cData[i][0] || '').trim().toLowerCase();
      const stt = String(cData[i][1] || '').trim();
      if (em && stt) {
        cleanCacheMap[em] = stt;
      }
    }
  }

  let is79RealGroupInKho = false;
  try {
    const khoSs = SpreadsheetApp.openById(KHO_TK_ID);
    const dataSheet = khoSs.getSheetByName(KHO_TK_TAB_NAME);
    if (dataSheet && dataSheet.getLastRow() > 1) {
      const dData = dataSheet.getDataRange().getValues();
      for (let r = 0; r < dData.length; r++) {
        const valStr = String(dData[r][0] || '').trim();
        if (valStr === '79' || valStr === 'RN79' || valStr === 'PL79') {
          is79RealGroupInKho = true;
          break;
        }
      }
    }
  } catch (e) {}

  const ticketMap = {};
  if (ticketsSheet && ticketsSheet.getLastRow() > 1) {
    const tData = ticketsSheet.getDataRange().getValues();
    for (let r = 1; r < tData.length; r++) {
      const tId = String(tData[r][0] || '').trim();
      const sttGroup = String(tData[r][1] || '').trim();
      const status = String(tData[r][2] || '').trim();
      const createdAt = tData[r][3];
      ticketMap[tId] = {
        rowIndex: r + 1,
        ticket_id: tId,
        stt_group: sttGroup,
        status: status,
        created_at: createdAt,
        reports: []
      };
    }
  }

  if (reportsSheet && reportsSheet.getLastRow() > 1) {
    const rData = reportsSheet.getDataRange().getValues();
    for (let r = 1; r < rData.length; r++) {
      const rId = String(rData[r][0] || '').trim();
      const tId = String(rData[r][1] || '').trim();
      const em = String(rData[r][2] || '').trim().toLowerCase();
      const reportedAt = rData[r][3];
      const msg = String(rData[r][4] || '');
      const ctv = String(rData[r][5] || '');

      if (ticketMap[tId]) {
        ticketMap[tId].reports.push({
          rowIndex: r + 1,
          report_id: rId,
          email: em,
          reported_at: reportedAt,
          message: msg,
          submitted_by: ctv,
          true_stt_group: cleanCacheMap[em] || 'RÁC (Không thuộc nhóm nào)'
        });
      }
    }
  }

  const pl394Audit = [];
  const ticket79Audit = [];
  const abnormalTicketsAudit = [];

  for (const tId in ticketMap) {
    const t = ticketMap[tId];
    if (t.stt_group === 'PL394') {
      pl394Audit.push(t);
    }
    if (t.stt_group === '79' || t.stt_group === 'RN79' || t.stt_group === 'PL79') {
      ticket79Audit.push(t);
    }
    if (t.reports.length > 5 && t.stt_group !== 'PL394' && t.stt_group !== '79') {
      abnormalTicketsAudit.push(t);
    }
  }

  return {
    success: true,
    synced_cache_count: Object.keys(cleanCacheMap).length,
    is_79_real_group_in_kho: is79RealGroupInKho,
    pl394_tickets: pl394Audit,
    ticket79_tickets: ticket79Audit,
    abnormal_tickets: abnormalTicketsAudit
  };
}

/**
 * HÀM THỰC THI DỌN DẸP / GÁN LẠI TICKET VÀ REPORT SAU KHU DNL XÁC NHẬN:
 * 1. Chạy syncEmailLookupCache() lấy map nhóm chuẩn
 * 2. Đọc REPORTS, gán lại ticket_id mới theo nhóm chuẩn của từng email (hoặc tách khỏi PL394/79)
 * 3. Xóa các dòng ticket rác (như ticket 79 nếu là rác)
 */
function executeCleanUpAfterConfirmation(options) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { success: false, message: 'Hệ thống đang bận, thử lại sau 5s.' };
  }

  try {
    const syncRes = syncEmailLookupCache();
    const ss = getSpreadsheet();
    const ticketsSheet = ss.getSheetByName('TICKETS');
    const reportsSheet = ss.getSheetByName('REPORTS');
    const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');

    const cleanCacheMap = {};
    if (cacheSheet && cacheSheet.getLastRow() > 1) {
      const cData = cacheSheet.getDataRange().getValues();
      for (let i = 1; i < cData.length; i++) {
        const em = String(cData[i][0] || '').trim().toLowerCase();
        const stt = String(cData[i][1] || '').trim();
        if (em && stt) cleanCacheMap[em] = stt;
      }
    }

    let updatedReportCount = 0;
    let deletedTicketCount = 0;

    // 1. Re-link REPORTS rows attached to PL394 or 79 to their TRUE groups
    if (reportsSheet && reportsSheet.getLastRow() > 1) {
      const rData = reportsSheet.getDataRange().getValues();
      for (let i = 1; i < rData.length; i++) {
        const email = String(rData[i][2] || '').trim().toLowerCase();
        const trueGroup = cleanCacheMap[email];
        
        if (trueGroup) {
          // Find or create correct ticket for trueGroup
          const now = parseDateHelper(rData[i][3]) || new Date();
          const targetTicket = findOrCreateTicketForGroup(trueGroup, now, email);
          if (targetTicket && targetTicket.ticket_id) {
            reportsSheet.getRange(i + 1, 2).setValue(targetTicket.ticket_id);
            updatedReportCount++;
          }
        }
      }
    }

    // 2. Remove orphaned tickets with 0 reports or invalid group '79' if empty
    if (ticketsSheet && ticketsSheet.getLastRow() > 1) {
      const tData = ticketsSheet.getDataRange().getValues();
      const rData = reportsSheet ? reportsSheet.getDataRange().getValues() : [];
      const activeTicketIds = new Set();
      for (let r = 1; r < rData.length; r++) {
        activeTicketIds.add(String(rData[r][1]).trim());
      }

      for (let r = tData.length - 1; r >= 1; r--) {
        const tId = String(tData[r][0]).trim();
        const sttGroup = String(tData[r][1]).trim();
        if ((sttGroup === '79' || !activeTicketIds.has(tId)) && sttGroup !== 'PL394') {
          // If ticket 79 or ticket with no reports remaining
          if (!activeTicketIds.has(tId)) {
            ticketsSheet.deleteRow(r + 1);
            deletedTicketCount++;
          }
        }
      }
    }

    return {
      success: true,
      updated_reports: updatedReportCount,
      deleted_tickets: deletedTicketCount,
      message: 'Đã hoàn tất dọn dẹp và cập nhật lại toàn bộ Ticket / Report theo đúng nhóm chuẩn!'
    };
  } catch (err) {
    return { success: false, message: 'Lỗi dọn dẹp: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * YÊU CẦU 3 — ĐỔI SANG MAIL PHỤ: submitMailPhuRequest(primaryEmail, mailPhu)
 */
function submitMailPhuRequest(primaryEmailRaw, mailPhuRaw) {
  if (!primaryEmailRaw || !mailPhuRaw) {
    return { success: false, message: 'Vui lòng nhập đầy đủ Email hiện tại và Email phụ.' };
  }

  const primaryEmail = String(primaryEmailRaw).trim().toLowerCase();
  const mailPhu = String(mailPhuRaw).trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(mailPhu)) {
    return { success: false, message: 'Email phụ không đúng định dạng. Vui lòng kiểm tra lại.' };
  }

  if (primaryEmail === mailPhu) {
    return { success: false, message: 'Email phụ phải khác với Email hiện tại.' };
  }

  const cacheObjects = readSheetAsObjects('EMAIL_LOOKUP_CACHE');
  let sttGroup = '';
  let ngayHetHan = '';
  let isFound = false;

  for (let i = 0; i < cacheObjects.length; i++) {
    const em = String(cacheObjects[i]['email'] || '').trim().toLowerCase();
    if (em === primaryEmail) {
      sttGroup = String(cacheObjects[i]['stt_group'] || '').trim();
      ngayHetHan = cacheObjects[i]['ngay_het_han'] ? String(cacheObjects[i]['ngay_het_han']).trim() : '';
      isFound = true;
      break;
    }
  }

  if (!isFound) {
    const directInfo = lookupCustomerInfoFromKhoTK(primaryEmail);
    if (!directInfo.found) {
      return {
        success: false,
        message: 'Email này không khớp với danh sách khách hàng trong Kho TK, không thể xử lý yêu cầu.'
      };
    }
    sttGroup = directInfo.stt_group;
    ngayHetHan = directInfo.ngay_het_han;
  }

  if (!ngayHetHan) {
    const directInfo = lookupCustomerInfoFromKhoTK(primaryEmail);
    if (directInfo.found) {
      if (!sttGroup || sttGroup === 'KHO_TK') sttGroup = directInfo.stt_group;
      if (directInfo.ngay_het_han) ngayHetHan = directInfo.ngay_het_han;
    }
  }

  if (!sttGroup) sttGroup = 'KHO_TK';

  const nowIso = new Date().toISOString();
  const formattedHSD = formatDateOnlyHelper(ngayHetHan);

  const ss = getSpreadsheetCached();
  let reqSheet = ss.getSheetByName('MAIL_PHU_REQUESTS');
  if (!reqSheet) {
    reqSheet = ss.insertSheet('MAIL_PHU_REQUESTS');
    reqSheet.appendRow([
      'request_id',
      'stt_group',
      'primary_email',
      'mail_phu',
      'ngay_het_han',
      'requested_at',
      'status',
      'note'
    ]);
  }

  // Quét xem đã có yêu cầu đang chờ (Mới / Đã mời) của primaryEmail này chưa
  const reqObjects = readSheetAsObjects('MAIL_PHU_REQUESTS');
  let existingRowIdx = -1;
  let existingOldMailPhu = '';
  let existingReqId = '';

  for (let r = 0; r < reqObjects.length; r++) {
    const em = String(reqObjects[r]['primary_email'] || '').trim().toLowerCase();
    const st = String(reqObjects[r]['status'] || '').trim();
    if (em === primaryEmail && (st === 'Mới' || st === 'Đã mời')) {
      existingRowIdx = reqObjects[r]._rowIndex; // 1-indexed row index
      existingReqId = String(reqObjects[r]['request_id'] || '').trim();
      existingOldMailPhu = String(reqObjects[r]['mail_phu'] || '').trim().toLowerCase();
      break;
    }
  }

  if (existingRowIdx !== -1) {
    let noteText = '';
    if (existingOldMailPhu && existingOldMailPhu !== mailPhu) {
      noteText = `Đã đổi mail phụ từ ${existingOldMailPhu} sang ${mailPhu}`;
    } else {
      noteText = `Làm mới thời gian yêu cầu lúc ${formattedHSD}`;
    }

    // 1-call batch update row
    updateRowRangeFast('MAIL_PHU_REQUESTS', existingRowIdx, 1, [
      existingReqId,
      sttGroup,
      primaryEmail,
      mailPhu,
      formattedHSD,
      nowIso,
      'Mới',
      noteText
    ]);

    return {
      success: true,
      request_id: existingReqId,
      stt_group: sttGroup,
      primary_email: primaryEmail,
      mail_phu: mailPhu,
      ngay_het_han: formattedHSD,
      is_updated: true,
      message: (existingOldMailPhu && existingOldMailPhu !== mailPhu)
        ? `🔄 Đã cập nhật lại yêu cầu: Thay thế mail phụ cũ bằng mail phụ mới (${mailPhu})!`
        : `⚠️ Email ${primaryEmail} đã có yêu cầu đổi mail phụ đang chờ. Hệ thống đã làm mới mốc thời gian cho yêu cầu này!`
    };
  }

  // Thêm mới 1 dòng siêu tốc
  const requestId = 'MP-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

  appendRowFast('MAIL_PHU_REQUESTS', [
    requestId,
    sttGroup,
    primaryEmail,
    mailPhu,
    formattedHSD,
    nowIso,
    'Mới',
    ''
  ]);

  return {
    success: true,
    request_id: requestId,
    stt_group: sttGroup,
    primary_email: primaryEmail,
    mail_phu: mailPhu,
    ngay_het_han: formattedHSD,
    is_updated: false,
    message: `Đã ghi nhận yêu cầu đổi sang mail phụ ${mailPhu}. Đội ngũ sẽ mời email này vào nhóm trong thời gian sớm nhất.`
  };
}

/**
 * YÊU CẦU 4 — ADMIN: getMailPhuRequests(statusFilter)
 */
function getMailPhuRequests(statusFilter) {
  const reqObjects = readSheetAsObjects('MAIL_PHU_REQUESTS');
  if (reqObjects.length === 0) {
    return { success: true, total: 0, requests: [] };
  }

  const cacheObjects = readSheetAsObjects('EMAIL_LOOKUP_CACHE');
  const ctvCacheMap = {};
  for (let i = 0; i < cacheObjects.length; i++) {
    const em = String(cacheObjects[i]['email'] || '').trim().toLowerCase();
    const ctv = String(cacheObjects[i]['ctv'] || '').trim();
    if (em && ctv) ctvCacheMap[em] = ctv;
  }

  const requests = [];

  for (let r = 0; r < reqObjects.length; r++) {
    const obj = reqObjects[r];
    const requestId = String(obj['request_id'] || '').trim();
    const sttGroup = String(obj['stt_group'] || '').trim();
    const primaryEmail = String(obj['primary_email'] || '').trim();
    const mailPhu = String(obj['mail_phu'] || '').trim();
    const ngayHetHan = String(obj['ngay_het_han'] || '').trim();
    const requestedAt = obj['requested_at'];
    const status = String(obj['status'] || 'Mới').trim();
    const note = String(obj['note'] || '').trim();

    if (statusFilter && statusFilter !== 'Tất cả' && statusFilter !== 'All') {
      if (status !== statusFilter) continue;
    }

    let ctvName = ctvCacheMap[primaryEmail] || '';
    if (!ctvName) {
      const direct = lookupCustomerInfoFromKhoTK(primaryEmail);
      if (direct && direct.ctv) ctvName = direct.ctv;
    }

    requests.push({
      request_id: requestId,
      stt_group: sttGroup,
      primary_email: primaryEmail,
      mail_phu: mailPhu,
      ngay_het_han: ngayHetHan,
      ctv: ctvName,
      requested_at: requestedAt,
      status: status,
      note: note
    });
  }

  requests.sort((a, b) => {
    const aNew = (a.status === 'Mới') ? 0 : (a.status === 'Đã mời' ? 1 : 2);
    const bNew = (b.status === 'Mới') ? 0 : (b.status === 'Đã mời' ? 1 : 2);
    if (aNew !== bNew) return aNew - bNew;

    return new Date(b.requested_at || 0).getTime() - new Date(a.requested_at || 0).getTime();
  });

  return {
    success: true,
    total: requests.length,
    requests: requests
  };
}

/**
 * YÊU CẦU 4 — ADMIN: updateMailPhuStatus(requestId, newStatus, note)
 */
function updateMailPhuStatus(requestId, newStatus, note) {
  if (!requestId || !newStatus) {
    return { success: false, message: 'Thiếu request_id hoặc newStatus.' };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return { success: false, message: 'Hệ thống đang bận, vui lòng thử lại sau.' };
  }

  try {
    const reqObjects = readSheetAsObjects('MAIL_PHU_REQUESTS');
    let targetObj = null;

    for (let r = 0; r < reqObjects.length; r++) {
      if (String(reqObjects[r]['request_id']).trim() === String(requestId).trim()) {
        targetObj = reqObjects[r];
        break;
      }
    }

    if (!targetObj) {
      return { success: false, message: 'Không tìm thấy request_id: ' + requestId };
    }

    const rowIdx = targetObj._rowIndex;
    const currentValues = targetObj._rowValues ? [...targetObj._rowValues] : [];
    while (currentValues.length < 8) currentValues.push('');
    
    currentValues[6] = newStatus;
    if (note !== undefined && note !== null && String(note).trim() !== '') {
      currentValues[7] = note;
    }

    updateRowRangeFast('MAIL_PHU_REQUESTS', rowIdx, 1, currentValues);

    return {
      success: true,
      request_id: requestId,
      new_status: newStatus,
      message: 'Đã cập nhật trạng thái "' + newStatus + '" thành công!'
    };
  } catch (err) {
    return { success: false, message: 'Lỗi cập nhật: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: Tra trực tiếp Kho TK tab DATA để lấy stt_group và ngay_het_han nếu Cache chưa có
 */
function lookupCustomerInfoFromKhoTK(primaryEmail) {
  if (!primaryEmail) return { found: false, stt_group: '', ngay_het_han: '' };
  
  const targetEmail = String(primaryEmail).trim().toLowerCase();
  
  try {
    const data = getKhoTKDataCached();
    if (!data || data.length <= 1) return { found: false, stt_group: '', ngay_het_han: '' };

    let headerRowIdx = -1;
    let emailColIdx = -1;
    const maxScanRows = Math.min(10, data.length);

    for (let r = 0; r < maxScanRows; r++) {
      const row = data[r];
      for (let c = 0; c < row.length; c++) {
        const cellStr = String(row[c] || '').trim().toLowerCase();
        if (cellStr === 'email khách' || cellStr.includes('email khách')) {
          headerRowIdx = r;
          emailColIdx = c;
          break;
        }
      }
      if (headerRowIdx !== -1) break;
    }

    if (headerRowIdx === -1 || emailColIdx === -1) {
      emailColIdx = 10; // Default Column K ('Email khách')
      headerRowIdx = 4;
    }

    let ctvColIdx = -1;
    let dateColIdx = -1;
    const hRow = data[headerRowIdx] || [];

    for (let c = 0; c < hRow.length; c++) {
      const hStr = String(hRow[c] || '').trim();
      const hLower = hStr.toLowerCase();
      if (hLower === 'ctv') {
        ctvColIdx = c;
      }
      if (hStr === 'Date' || hLower === 'ngày hết hạn' || hLower === 'hạn gia hạn' || hLower === 'hsd') {
        dateColIdx = c;
      }
    }

    if (dateColIdx === -1) {
      for (let c = 0; c < hRow.length; c++) {
        const hLower = String(hRow[c] || '').trim().toLowerCase();
        if (hLower.includes('mua') || hLower.includes('renew')) continue;
        if (hLower.includes('date') || hLower.includes('hạn') || hLower.includes('hsd')) {
          dateColIdx = c;
          break;
        }
      }
    }

    if (dateColIdx === -1) {
      dateColIdx = 13; // Column N ('Date')
    }

    let currentGroup = '';
    let groupRowCount = 0;

    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const sttVal = String(data[r][0] || '').trim();
      if (sttVal) {
        currentGroup = sttVal;
        groupRowCount = 1;
      } else {
        groupRowCount++;
        if (groupRowCount > 5) currentGroup = '';
      }

      const em = String(data[r][emailColIdx] || '').trim().toLowerCase();
      if (em === targetEmail) {
        let ngayHetHanStr = '';
        if (dateColIdx !== -1 && data[r][dateColIdx]) {
          const rawDate = data[r][dateColIdx];
          if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            ngayHetHanStr = Utilities.formatDate(rawDate, Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy');
          } else {
            ngayHetHanStr = String(rawDate).trim();
          }
        }
        let ctvStr = '';
        if (ctvColIdx !== -1 && data[r][ctvColIdx]) {
          ctvStr = String(data[r][ctvColIdx]).trim();
        }
        return {
          found: true,
          stt_group: currentGroup || 'KHO_TK',
          ngay_het_han: ngayHetHanStr,
          ctv: ctvStr
        };
      }
    }
  } catch (err) {
    Logger.log('Lỗi lookupCustomerInfoFromKhoTK: ' + err.toString());
  }

  return { found: false, stt_group: '', ngay_het_han: '' };
}

/**
 * Admin API: Xóa yêu cầu mail phụ bị sai / dư thừa
 */
function deleteMailPhuRequest(requestId) {
  if (!requestId) return { success: false, message: 'Thiếu request_id.' };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return { success: false, message: 'Hệ thống đang bận, vui lòng thử lại.' };
  }

  try {
    const ss = getSpreadsheet();
    const reqSheet = ss.getSheetByName('MAIL_PHU_REQUESTS');
    if (!reqSheet || reqSheet.getLastRow() <= 1) {
      return { success: false, message: 'Chưa có dữ liệu.' };
    }

    const data = reqSheet.getDataRange().getValues();
    for (let r = data.length - 1; r >= 1; r--) {
      if (String(data[r][0]).trim() === String(requestId).trim()) {
        reqSheet.deleteRow(r + 1);
        return { success: true, request_id: requestId, message: 'Đã xóa yêu cầu đổi mail phụ thành công!' };
      }
    }
    return { success: false, message: 'Không tìm thấy request_id: ' + requestId };
  } catch (err) {
    return { success: false, message: 'Lỗi xóa yêu cầu: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: Chuẩn hóa ngày thành định dạng dd/MM/yyyy sạch
 */
function formatDateOnlyHelper(rawDate) {
  if (!rawDate) return '';
  if (rawDate instanceof Date) {
    if (isNaN(rawDate.getTime())) return '';
    return Utilities.formatDate(rawDate, Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy');
  }
  const str = String(rawDate).trim();
  if (!str) return '';

  if (/^\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}$/.test(str)) {
    return str;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return str;
}

/**
 * Tra cứu xem email chính đã có yêu cầu đổi mail phụ trước đó hay chưa
 */
function checkMailPhuStatus(primaryEmailRaw) {
  if (!primaryEmailRaw) {
    return { success: true, has_existing: false };
  }
  
  const primaryEmail = String(primaryEmailRaw).trim().toLowerCase();
  const reqObjects = readSheetAsObjects('MAIL_PHU_REQUESTS');
  if (reqObjects.length === 0) {
    return { success: true, has_existing: false };
  }

  for (let r = reqObjects.length - 1; r >= 0; r--) {
    const obj = reqObjects[r];
    const em = String(obj['primary_email'] || '').trim().toLowerCase();
    if (em === primaryEmail) {
      const st = String(obj['status'] || 'Mới').trim();
      const mPhu = String(obj['mail_phu'] || '').trim();
      const hsd = String(obj['ngay_het_han'] || '').trim();
      const reqAt = obj['requested_at'];
      
      return {
        success: true,
        has_existing: true,
        request_id: String(obj['request_id'] || '').trim(),
        stt_group: String(obj['stt_group'] || '').trim(),
        primary_email: primaryEmail,
        mail_phu: mPhu,
        ngay_het_han: formatDateOnlyHelper(hsd),
        status: st,
        requested_at: reqAt
      };
    }
  }

  return { success: true, has_existing: false };
}

/**
 * Tự động phân loại ticket PL đang "Chưa xử lý" dựa trên đối chiếu chéo dữ liệu
 * 1. Đọc WARRANTY -> Tập hợp email đang dùng TK bảo hành
 * 2. Đọc MAIL_PHU_REQUESTS -> Tập hợp primary_email yêu cầu đổi mail phụ
 * 3. Đọc TICKETS + REPORTS + EMAIL_LOOKUP_CACHE -> Lọc ticket PL đang mở (status !== 'Đã xử lý')
 * 4. Gán ưu tiên 1: WARRANTY -> resolution_type = "Dùng TK bảo hành"
 * 5. Gán ưu tiên 2: MAIL_PHU_REQUESTS -> resolution_type = "Đổi mail phụ"
 * 6. Gửi email thông báo khách & Ghi gộp siêu tốc các dòng được cập nhật bằng updateRowRangeFast
 */
function autoClassifyPlusTickets() {
  const startTime = Date.now();

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { success: false, message: 'Hệ thống đang bận, vui lòng thử lại sau ít giây.' };
  }

  try {
    const ss = getSpreadsheetCached();

    // 1. Collect WARRANTY customer emails
    const warrantyCustomerEmails = new Set();
    try {
      const wObjects = readSheetAsObjects('WARRANTY');
      for (let w = 0; w < wObjects.length; w++) {
        const rowVal = wObjects[w]._rowValues || [];
        for (let c = 6; c < rowVal.length; c++) {
          const em = String(rowVal[c] || '').trim().toLowerCase();
          if (em && em.includes('@')) {
            warrantyCustomerEmails.add(em);
          }
        }
      }
    } catch (wErr) {
      Logger.log('Warning reading WARRANTY in autoClassifyPlusTickets: ' + wErr.toString());
    }

    // 2. Collect MAIL_PHU_REQUESTS primary emails
    const mailPhuPrimaryEmails = new Set();
    try {
      const mpObjects = readSheetAsObjects('MAIL_PHU_REQUESTS');
      for (let m = 0; m < mpObjects.length; m++) {
        const rowVal = mpObjects[m]._rowValues || [];
        const pEm = String(rowVal[1] || '').trim().toLowerCase(); // primary_email
        if (pEm && pEm.includes('@')) {
          mailPhuPrimaryEmails.add(pEm);
        }
      }
    } catch (mpErr) {
      Logger.log('Warning reading MAIL_PHU_REQUESTS in autoClassifyPlusTickets: ' + mpErr.toString());
    }

    // 3. Collect sttOwnerMap from EMAIL_LOOKUP_CACHE
    const sttOwnerMap = {};
    try {
      const cacheObjects = readSheetAsObjects('EMAIL_LOOKUP_CACHE');
      for (let c = 0; c < cacheObjects.length; c++) {
        const cRow = cacheObjects[c]._rowValues || [];
        const stt = String(cRow[1] || '').trim();
        const owner = cRow[3] ? String(cRow[3]).trim().toLowerCase() : '';
        if (stt && owner && owner.includes('@') && !sttOwnerMap[stt]) {
          sttOwnerMap[stt] = owner;
        }
      }
    } catch (cErr) {
      Logger.log('Warning reading EMAIL_LOOKUP_CACHE in autoClassifyPlusTickets: ' + cErr.toString());
    }

    // 4. Collect REPORTS mapped to ticket_id
    const reportEmailsMap = {};
    const rObjects = readSheetAsObjects('REPORTS');
    for (let r = 0; r < rObjects.length; r++) {
      const rRow = rObjects[r]._rowValues || [];
      const tId = String(rRow[1] || '').trim();
      const em = String(rRow[2] || '').trim().toLowerCase();
      if (tId && em && em.includes('@')) {
        if (!reportEmailsMap[tId]) reportEmailsMap[tId] = new Set();
        reportEmailsMap[tId].add(em);
      }
    }

    // 5. Read TICKETS
    const tObjects = readSheetAsObjects('TICKETS');
    let classifiedCount = 0;
    let warrantyCount = 0;
    let mailPhuCount = 0;
    const nowIso = new Date().toISOString();

    for (let i = 0; i < tObjects.length; i++) {
      const tObj = tObjects[i];
      const rowVal = tObj._rowValues ? [...tObj._rowValues] : [];
      const ticketId = String(rowVal[0] || '').trim();
      const sttGroup = String(rowVal[1] || '').trim();
      const status = String(rowVal[2] || '').trim();

      // Only evaluate open PL tickets (stt_group matching /^PL\d+$/i)
      if (status === 'Đã xử lý' || !/^PL\d+$/i.test(sttGroup)) {
        continue;
      }

      // Collect all emails associated with this ticket
      const ticketEmails = new Set();
      if (reportEmailsMap[ticketId]) {
        reportEmailsMap[ticketId].forEach(e => ticketEmails.add(e));
      }
      if (sttOwnerMap[sttGroup]) {
        ticketEmails.add(sttOwnerMap[sttGroup]);
      }

      // Priority 1: Check WARRANTY
      let isWarranty = false;
      ticketEmails.forEach(e => {
        if (warrantyCustomerEmails.has(e)) isWarranty = true;
      });

      // Priority 2: Check MAIL_PHU_REQUESTS
      let isMailPhu = false;
      if (!isWarranty) {
        ticketEmails.forEach(e => {
          if (mailPhuPrimaryEmails.has(e)) isMailPhu = true;
        });
      }

      if (isWarranty || isMailPhu) {
        while (rowVal.length < 12) rowVal.push('');

        const resType = isWarranty ? 'Dùng TK bảo hành' : 'Đổi mail phụ';
        rowVal[2] = 'Đã xử lý'; // status
        rowVal[4] = nowIso; // updated_at
        rowVal[5] = nowIso; // resolved_at
        rowVal[6] = 'System-Auto'; // resolved_by
        rowVal[9] = `Tự động phân loại: ${resType}`; // note
        rowVal[11] = resType; // resolution_type

        // Send notification email to customer if not already notified
        if (!rowVal[10]) {
          const custEmails = reportEmailsMap[ticketId] ? Array.from(reportEmailsMap[ticketId]) : [];
          const resolvedTimeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' +
                                  new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

          for (let eIdx = 0; eIdx < custEmails.length; eIdx++) {
            const email = custEmails[eIdx];
            try {
              MailApp.sendEmail({
                to: email,
                subject: '[Go DNC] Sự cố nhóm tài khoản Fam ' + sttGroup + ' đã được khắc phục',
                body: 'Chào bạn,\n\n' +
                      'Sự cố nhóm tài khoản Fam (' + sttGroup + ') của bạn đã được đội ngũ kỹ thuật Go DNC xử lý hoàn tất lúc ' + resolvedTimeStr + '.\n\n' +
                      'Nếu bạn vẫn gặp gián đoạn hoặc cần hỗ trợ thêm, vui lòng gửi báo lỗi mới tại: https://godnc.com/renew/\n\n' +
                      'Cảm ơn bạn đã đồng hành cùng Go DNC!\n' +
                      'Trân trọng,\nĐội ngũ Kỹ Thuật Go DNC'
              });
            } catch (mailErr) {
              Logger.log('CẢNH BÁO gửi mail tự động thất bại cho ' + email + ': ' + mailErr.toString());
            }
          }
          rowVal[10] = nowIso; // notified_at
        }

        // Fast update single row in RAM / Sheet
        updateRowRangeFast('TICKETS', tObj._rowIndex, 1, rowVal);
        classifiedCount++;
        if (isWarranty) warrantyCount++;
        if (isMailPhu) mailPhuCount++;
      }
    }

    const elapsedMs = Date.now() - startTime;
    return {
      success: true,
      message: `🎉 Đã tự động phân loại và đóng ${classifiedCount} ticket PL (${warrantyCount} dùng TK bảo hành, ${mailPhuCount} đổi mail phụ) trong ${(elapsedMs / 1000).toFixed(2)}s!`,
      classified_count: classifiedCount,
      warranty_count: warrantyCount,
      mail_phu_count: mailPhuCount,
      elapsed_ms: elapsedMs
    };
  } catch (err) {
    return { success: false, message: 'Lỗi tự động phân loại ticket PL: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}
