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
 * Endpoint nhận Request qua HTTP GET / POST
 */
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
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
        result = submitReport(params.email, params.message, params.submitted_by);
        break;
      case 'submitBulkReport':
        result = submitBulkReport(params.rawText, params.ctvName);
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
        result = updateTicketStatus(ticketIdParam, newStatusParam, resolvedByParam, noteParam);
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
      case 'getCacheInfo':
        result = { success: true, cache_info: checkCacheHealth() };
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
 * Cột TICKETS (11): ticket_id, stt_group, status, created_at, updated_at, resolved_at, resolved_by, is_recurring, recur_count, note, notified_at
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
      'is_recurring', 'recur_count', 'note', 'notified_at'
    ]);
    ticketsSheet.getRange(1, 1, 1, 11).setFontWeight('bold');
  } else {
    const headers = ticketsSheet.getRange(1, 1, 1, Math.max(11, ticketsSheet.getLastColumn())).getValues()[0];
    if (!headers[10] || String(headers[10]).trim() !== 'notified_at') {
      ticketsSheet.getRange(1, 11).setValue('notified_at').setFontWeight('bold');
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
    cacheSheet.appendRow(['email', 'stt_group', 'synced_at', 'owner_email', 'ctv']);
    cacheSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  } else {
    const headers = cacheSheet.getRange(1, 1, 1, Math.max(5, cacheSheet.getLastColumn())).getValues()[0];
    if (!headers[4] || String(headers[4]).trim() !== 'ctv') {
      cacheSheet.getRange(1, 5).setValue('ctv').setFontWeight('bold');
    }
  }

  return { success: true, message: 'Đã khởi tạo/cập nhật xong cấu trúc các tab TICKETS, REPORTS, EMAIL_LOOKUP_CACHE' };
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

    let currentSttGroup = '';

    for (let r = startDataRow; r < data.length; r++) {
      const sttRaw = data[r][sttColIdx];
      if (sttRaw && String(sttRaw).trim()) {
        currentSttGroup = String(sttRaw).trim();
      }

      if (!currentSttGroup) continue;

      // Extract email & CTV STRICTLY from current row r (no carry-forward!)
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

      if (ownerEmailClean && ownerEmailClean.includes('@') && !ownerMap[currentSttGroup]) {
        ownerMap[currentSttGroup] = ownerEmailClean;
      }

      if (emailClean && emailClean.includes('@')) {
        cacheMap[emailClean] = currentSttGroup;
        // CTV is strictly bound to current row r only (never inherited from previous rows)
        ctvMap[emailClean] = ctvClean || '';
      }
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');
    
    if (cacheSheet.getLastRow() > 1) {
      cacheSheet.getRange(2, 1, cacheSheet.getLastRow() - 1, Math.max(5, cacheSheet.getLastColumn())).clearContent();
    }

    const rowsToInsert = [];
    for (const email in cacheMap) {
      const stt = cacheMap[email];
      rowsToInsert.push([email, stt, nowIso, ownerMap[stt] || '', ctvMap[email] || '']);
    }

    if (rowsToInsert.length > 0) {
      cacheSheet.getRange(2, 1, rowsToInsert.length, 5).setValues(rowsToInsert);
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
function getSttGroupByEmail(emailClean) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');
  if (!cacheSheet || cacheSheet.getLastRow() <= 1) {
    return null;
  }

  const data = cacheSheet.getDataRange().getValues();
  if (data.length <= 1) return null;

  for (let i = 1; i < data.length; i++) {
    const rowEmail = String(data[i][0]).trim().toLowerCase();
    if (rowEmail === emailClean) {
      return String(data[i][1]).trim();
    }
  }
  return null;
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
 * HÀM DÙNG CHUNG DUY NHẤT: findOrCreateTicketForGroup(sttGroup, now)
 * 1. Kiểm tra có ticket mở ('Mới' / 'Đang xử lý') -> Nối vào ticket đó.
 * 2. Kiểm tra ticket đóng gần nhất trong 24h -> Tạo ticket mới đánh dấu is_recurring = true, recur_count += 1.
 * 3. Nếu không có -> Tạo ticket mới bình thường.
 */
function findOrCreateTicketForGroup(sttGroup, now) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ticketsSheet = ss.getSheetByName('TICKETS');
  const ticketsData = ticketsSheet.getDataRange().getValues();
  const nowIso = now.toISOString();

  let openTicketRowIndex = -1;
  let openTicketData = null;
  let latestClosedTicket = null;
  let latestClosedTime = 0;

  for (let r = 1; r < ticketsData.length; r++) {
    const row = ticketsData[r];
    const rowStt = String(row[1]).trim();
    const rowStatus = String(row[2]).trim();

    if (rowStt === sttGroup) {
      if (rowStatus !== 'Đã xử lý') {
        openTicketRowIndex = r + 1; // 1-indexed
        openTicketData = {
          ticket_id: row[0],
          stt_group: row[1],
          status: row[2],
          created_at: row[3],
          updated_at: row[4],
          resolved_at: row[5],
          is_recurring: row[7],
          recur_count: Number(row[8] || 0)
        };
        break; // Ưu tiên ticket mở đang có
      } else {
        const rDate = parseDateHelper(row[5] || row[4] || row[3]);
        const rTime = rDate ? rDate.getTime() : 0;
        if (rTime > latestClosedTime) {
          latestClosedTime = rTime;
          latestClosedTicket = {
            ticket_id: row[0],
            stt_group: row[1],
            status: row[2],
            resolved_at: row[5],
            is_recurring: row[7],
            recur_count: Number(row[8] || 0)
          };
        }
      }
    }
  }

  if (openTicketData) {
    // Đã có ticket mở -> Cập nhật updated_at
    ticketsSheet.getRange(openTicketRowIndex, 5).setValue(nowIso);
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

  ticketsSheet.appendRow([
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
 * API 1: submitReport(email, message, submittedBy)
 */
function submitReport(emailRaw, message, submittedBy) {
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
    const ticketInfo = findOrCreateTicketForGroup(sttGroup, now);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reportsSheet = ss.getSheetByName('REPORTS');

    // Insert 1 dòng vào REPORTS (ghi kèm submitted_by ở cột 6)
    const reportId = 'RP-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    reportsSheet.appendRow([
      reportId,
      ticketInfo.ticket_id,
      emailClean,
      nowIso,
      message || '',
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
 * API CTV: submitBulkReport(rawText, ctvName)
 * Tách tối đa 50 email bằng Regex, báo lỗi hàng loạt & trả chi tiết từng dòng
 */
function submitBulkReport(rawText, ctvName) {
  if (!rawText) {
    return { success: false, message: 'Vui lòng dán danh sách email hoặc nội dung tin nhắn.' };
  }

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = String(rawText).match(emailRegex);

  if (!matches || matches.length === 0) {
    return { success: false, message: 'Không tìm thấy địa chỉ email hợp lệ nào trong đoạn văn bản đã dán.' };
  }

  const uniqueEmails = [];
  for (let i = 0; i < matches.length; i++) {
    const clean = matches[i].trim().toLowerCase();
    if (uniqueEmails.indexOf(clean) === -1) {
      uniqueEmails.push(clean);
    }
  }

  if (uniqueEmails.length > 50) {
    return { 
      success: false, 
      message: 'Danh sách tìm thấy ' + uniqueEmails.length + ' email (vượt quá giới hạn 50 email/lần). Vui lòng chia nhỏ danh sách để xử lý.' 
    };
  }

  const results = [];
  let foundCount = 0;
  let notFoundCount = 0;

  for (let i = 0; i < uniqueEmails.length; i++) {
    const email = uniqueEmails[i];
    const res = submitReport(email, 'Gửi hàng loạt bởi CTV ' + (ctvName || ''), ctvName);
    
    if (res.success) {
      foundCount++;
      let noteText = res.is_existing_open ? 'Đã báo trước đó, admin đang xử lý' : 'Vừa ghi nhận';
      if (res.status === 'Đã xử lý') {
        noteText = 'Đã xử lý xong';
      }

      results.push({
        email: email,
        found: true,
        stt_group: res.stt_group,
        ticket_status: res.status,
        created_at: res.created_at,
        resolved_at: res.resolved_at,
        is_recurring: res.is_recurring,
        recur_count: res.recur_count,
        note: noteText
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
    ctv_name: ctvName,
    total: uniqueEmails.length,
    found_count: foundCount,
    not_found_count: notFoundCount,
    results: results,
    message: 'Đã xử lý xong ' + uniqueEmails.length + ' email (' + foundCount + ' thành công, ' + notFoundCount + ' không tìm thấy).'
  };
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
 * API CTV: listCtvReports(ctvName)
 */
function listCtvReports(ctvName) {
  if (!ctvName) {
    return { success: false, message: 'Thiếu ctvName.' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reportsSheet = ss.getSheetByName('REPORTS');
  const ticketsSheet = ss.getSheetByName('TICKETS');

  if (!reportsSheet || reportsSheet.getLastRow() <= 1) {
    return { success: true, reports: [] };
  }

  const ticketMap = {};
  if (ticketsSheet && ticketsSheet.getLastRow() > 1) {
    const tData = ticketsSheet.getDataRange().getValues();
    for (let i = 1; i < tData.length; i++) {
      const row = tData[i];
      ticketMap[String(row[0]).trim()] = {
        stt_group: row[1],
        status: row[2],
        created_at: row[3],
        updated_at: row[4],
        resolved_at: row[5],
        resolved_by: row[6],
        is_recurring: Boolean(row[7]),
        recur_count: Number(row[8] || 0)
      };
    }
  }

  const rData = reportsSheet.getDataRange().getValues();
  const ctvReports = [];
  const targetCtvClean = String(ctvName).trim().toLowerCase();

  for (let i = 1; i < rData.length; i++) {
    const row = rData[i];
    const submittedByRow = String(row[5] || '').trim().toLowerCase();

    if (submittedByRow === targetCtvClean) {
      const ticketId = String(row[1]).trim();
      const ticketInfo = ticketMap[ticketId] || { stt_group: '---', status: 'Mới' };

      ctvReports.push({
        report_id: row[0],
        ticket_id: ticketId,
        customer_email: row[2],
        reported_at: row[3],
        message: row[4],
        submitted_by: row[5],
        stt_group: ticketInfo.stt_group,
        status: ticketInfo.status,
        created_at: ticketInfo.created_at,
        resolved_at: ticketInfo.resolved_at,
        is_recurring: ticketInfo.is_recurring,
        recur_count: ticketInfo.recur_count
      });
    }
  }

  ctvReports.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());

  return { success: true, ctv_name: ctvName, reports: ctvReports };
}

/**
 * API 2: checkStatus(email)
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
  const sttGroup = getSttGroupByEmail(emailClean);

  if (!sttGroup) {
    return {
      success: false,
      error: "email_not_found",
      message: "Không tìm thấy tài khoản với email này. Có thể dữ liệu chưa được đồng bộ, vui lòng thử lại sau ít phút hoặc liên hệ CTV."
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ticketsSheet = ss.getSheetByName('TICKETS');
  const reportsSheet = ss.getSheetByName('REPORTS');

  if (!ticketsSheet) {
    return { success: false, message: 'Chưa có dữ liệu sự cố.' };
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
        note: row[9]
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
      stt_group: sttGroup,
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
        note: row[9] || ''
      });
    }
  }

  historyTickets.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  return {
    success: true,
    has_ticket: true,
    stt_group: sttGroup,
    status: latestTicket.status,
    ticket_id: latestTicket.ticket_id,
    created_at: latestTicket.created_at,
    updated_at: latestTicket.updated_at,
    resolved_at: latestTicket.resolved_at,
    resolved_by: latestTicket.resolved_by || '',
    is_recurring: latestTicket.is_recurring,
    recur_count: latestTicket.recur_count,
    note: latestTicket.note || '',
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
      const ticketId = String(rData[i][1]).trim();
      const email = String(rData[i][2]).trim();
      if (!reportMap[ticketId]) {
        reportMap[ticketId] = { count: 0, emails: [] };
      }
      reportMap[ticketId].count++;
      if (email && reportMap[ticketId].emails.indexOf(email) === -1) {
        reportMap[ticketId].emails.push(email);
      }
    }
  }

  const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');
  let ownerMap = {};
  let hasOwnersInCache = false;
  if (cacheSheet && cacheSheet.getLastRow() > 1) {
    const cData = cacheSheet.getDataRange().getValues();
    for (let i = 1; i < cData.length; i++) {
      const stt = String(cData[i][1]).trim();
      const owner = cData[i][3] ? String(cData[i][3]).trim().toLowerCase() : '';
      if (stt && owner) {
        hasOwnersInCache = true;
        if (!ownerMap[stt]) ownerMap[stt] = owner;
      }
    }
  }

  // Auto-sync if cache has no owner email column populated yet
  if (!hasOwnersInCache) {
    try {
      syncEmailLookupCache();
      const newCacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');
      if (newCacheSheet && newCacheSheet.getLastRow() > 1) {
        const cData = newCacheSheet.getDataRange().getValues();
        ownerMap = {};
        for (let i = 1; i < cData.length; i++) {
          const stt = String(cData[i][1]).trim();
          const owner = cData[i][3] ? String(cData[i][3]).trim().toLowerCase() : (cData[i][0] ? String(cData[i][0]).trim().toLowerCase() : '');
          if (stt && owner && !ownerMap[stt]) {
            ownerMap[stt] = owner;
          }
        }
      }
    } catch (e) {
      Logger.log('Auto sync owners warning: ' + e.toString());
    }
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
    const ownerEmail = ownerMap[sttGroup] || (reportInfo.emails && reportInfo.emails[0] ? reportInfo.emails[0] : '');

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
      report_count: reportInfo.count,
      reported_emails: reportInfo.emails
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
    cache_info: cacheHealth
  };
}

/**
 * API 4: updateTicketStatus(ticket_id, newStatus, resolvedBy, note)
 * Tự động gửi mail thông báo khi chuyển thành 'Đã xử lý'
 */
function updateTicketStatus(ticketId, newStatus, resolvedBy, note) {
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

    ticketsSheet.getRange(targetRowIndex, 3).setValue(newStatus);
    ticketsSheet.getRange(targetRowIndex, 5).setValue(nowIso);
    if (note !== undefined && note !== null) {
      ticketsSheet.getRange(targetRowIndex, 10).setValue(note);
    }

    let emailSentCount = 0;

    if (newStatus === 'Đã xử lý') {
      ticketsSheet.getRange(targetRowIndex, 6).setValue(nowIso); // resolved_at
      if (resolvedBy) {
        ticketsSheet.getRange(targetRowIndex, 7).setValue(resolvedBy); // resolved_by
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

        ticketsSheet.getRange(targetRowIndex, 11).setValue(nowIso);
      }
    }

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

  // 1. Map stt_group -> Owner Email & Set of CTV names & email -> ctv name from EMAIL_LOOKUP_CACHE
  const sttOwnerMap = {};
  const emailCtvMap = {};
  const sttCtvMap = {};
  if (cacheSheet && cacheSheet.getLastRow() > 1) {
    const cData = cacheSheet.getDataRange().getValues();
    for (let i = 1; i < cData.length; i++) {
      const em = String(cData[i][0] || '').trim().toLowerCase();
      const stt = String(cData[i][1] || '').trim();
      const ownerEm = String(cData[i][3] || '').trim();
      const ctvVal = cData[i][4] ? String(cData[i][4]).trim() : '';

      if (stt && ownerEm && ownerEm.includes('@')) {
        sttOwnerMap[stt] = ownerEm;
      }
      if (em && ctvVal) {
        emailCtvMap[em] = ctvVal;
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

      const customerDetails = [];
      const emailList = rStats.emails || [];
      for (let e = 0; e < emailList.length; e++) {
        const em = emailList[e];
        const ctvVal = emailCtvMap[em] || '';
        customerDetails.push({
          email: em,
          ctv: ctvVal
        });
      }

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
        affected_count: Math.max(1, rStats.count),
        customer_emails: emailList,
        customer_details: customerDetails,
        is_relevant_to_ctv: isRelevant
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
