/**
 * FAM ISSUE TRACKER - BACKEND APPS SCRIPT (v3 FIX CACHE HEADER & PERFORMANCE)
 * SpreadSheet: FAM_ISSUE_TRACKER
 * 
 * Tự động đồng bộ cache từ kho TK (ID: 1Agq-0ITsQgzhwnWvQTUthAjS2e8zJfgNd8dGGkCDniA)
 * Quản lý báo lỗi theo Group/Fam (RN1, RN2, RN3...)
 * Nhận diện lỗi tái phát (is_recurring, recur_count) trong vòng 24h từ khi Đã xử lý
 */

const KHO_TK_ID = '1Agq-0ITsQgzhwnWvQTUthAjS2e8zJfgNd8dGGkCDniA';
const KHO_TK_TAB_NAME = 'DATA';
const RECUR_WINDOW_HOURS = 24; // Cấu hình thời gian tính tái phát (giờ)
const STALE_CACHE_THRESHOLD_HOURS = 3; // Ngưỡng cảnh báo cache cũ (giờ)

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
        result = submitReport(params.email, params.message);
        break;
      case 'checkStatus':
        result = checkStatus(params.email);
        break;
      case 'listTickets':
        result = listTickets(params.filterStatus);
        break;
      case 'updateTicketStatus':
        result = updateTicketStatus(params.ticket_id, params.newStatus, params.resolvedBy, params.note);
        break;
      case 'syncCache':
        result = syncEmailLookupCache();
        break;
      case 'setupDatabase':
        result = setupDatabase();
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
      'is_recurring', 'recur_count', 'note'
    ]);
    ticketsSheet.getRange(1, 1, 1, 10).setFontWeight('bold');
  }

  // Tab REPORTS
  let reportsSheet = ss.getSheetByName('REPORTS');
  if (!reportsSheet) {
    reportsSheet = ss.insertSheet('REPORTS');
  }
  if (reportsSheet.getLastRow() === 0) {
    reportsSheet.appendRow([
      'report_id', 'ticket_id', 'customer_email', 'reported_at', 'message'
    ]);
    reportsSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  }

  // Tab EMAIL_LOOKUP_CACHE
  let cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');
  if (!cacheSheet) {
    cacheSheet = ss.insertSheet('EMAIL_LOOKUP_CACHE');
  }
  if (cacheSheet.getLastRow() === 0) {
    cacheSheet.appendRow(['email', 'stt_group', 'synced_at']);
    cacheSheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }

  return { success: true, message: 'Đã khởi tạo xong các tab TICKETS, REPORTS, EMAIL_LOOKUP_CACHE' };
}

/**
 * Helper: Kiểm tra sức khỏe của cache email (tuổi cache, cảnh báo nếu > 3h)
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
 * 2. Tự động đồng bộ cache Email -> STT từ Sheet Kho TK
 * ĐẶC BIỆT: Dò header "Email khách" động trong 10 hàng đầu tiên.
 * Cột STT/RN luôn là Cột A (Index 0).
 */
function syncEmailLookupCache() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return { success: false, message: 'Hệ thống đang bận đồng bộ, vui lòng thử lại sau.' };
  }

  try {
    setupDatabase();

    // Đọc sheet Kho TK
    const khoSpreadsheet = SpreadsheetApp.openById(KHO_TK_ID);
    const dataSheet = khoSpreadsheet.getSheetByName(KHO_TK_TAB_NAME);
    if (!dataSheet) {
      return { success: false, message: 'Không tìm thấy tab ' + KHO_TK_TAB_NAME + ' trong sheet Kho TK' };
    }

    const data = dataSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: false, message: 'Tab DATA trong Kho TK không có dữ liệu' };
    }

    // 1. Dò header "Email khách" trong 10 hàng đầu tiên
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

    // Fallback: Nếu không khớp chính xác "Email khách", tìm ô chứa chữ "email"
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

    // 2. Cột mã nhóm (STT/RN) luôn là cột A (cột 1 -> index 0)
    const sttColIdx = 0;
    const startDataRow = headerRowIdx + 1;

    Logger.log('Tìm thấy tiêu đề "Email khách" ở Hàng ' + (headerRowIdx + 1) + ', Cột ' + (emailColIdx + 1) + '. Cột STT = Cột 1. Bắt đầu đọc dữ liệu từ Hàng ' + (startDataRow + 1));

    const cacheMap = {};
    const nowIso = new Date().toISOString();

    for (let r = startDataRow; r < data.length; r++) {
      const sttRaw = data[r][sttColIdx];
      const emailRaw = data[r][emailColIdx];

      if (sttRaw && emailRaw) {
        const sttClean = String(sttRaw).trim();
        const emailClean = String(emailRaw).trim().toLowerCase();

        // Email và STT nhóm phải hợp lệ (email chứa dấu @ và STT không rỗng)
        if (emailClean && sttClean && emailClean.includes('@')) {
          cacheMap[emailClean] = sttClean;
        }
      }
    }

    // Ghi đè vào tab EMAIL_LOOKUP_CACHE
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');
    
    // Clear toàn bộ dữ liệu cũ (trừ hàng tiêu đề 1)
    if (cacheSheet.getLastRow() > 1) {
      cacheSheet.getRange(2, 1, cacheSheet.getLastRow() - 1, 3).clearContent();
    }

    const rowsToInsert = [];
    for (const email in cacheMap) {
      rowsToInsert.push([email, cacheMap[email], nowIso]);
    }

    if (rowsToInsert.length > 0) {
      cacheSheet.getRange(2, 1, rowsToInsert.length, 3).setValues(rowsToInsert);
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
 * Helper: Tra cứu STT group từ Email CHỈ TRONG CACHE local.
 * TUỆT ĐỐI KHÔNG gọi Kho TK live-lookup hay syncEmailLookupCache() ở đây.
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
 * API 1: submitReport(email, message)
 */
function submitReport(emailRaw, message) {
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ticketsSheet = ss.getSheetByName('TICKETS');
    const reportsSheet = ss.getSheetByName('REPORTS');

    const ticketsData = ticketsSheet.getDataRange().getValues();
    const now = new Date();
    const nowIso = now.toISOString();

    let openTicketRowIndex = -1;
    let openTicketData = null;
    let lastClosedTicket = null;

    for (let r = 1; r < ticketsData.length; r++) {
      const row = ticketsData[r];
      const rowStt = String(row[1]).trim();
      const rowStatus = String(row[2]).trim();

      if (rowStt === sttGroup) {
        if (rowStatus !== 'Đã xử lý') {
          openTicketRowIndex = r + 1; // 1-indexed for Sheet
          openTicketData = {
            ticket_id: row[0],
            stt_group: row[1],
            status: row[2],
            created_at: row[3],
            updated_at: row[4],
            is_recurring: row[7],
            recur_count: Number(row[8] || 0)
          };
          break; // Đang có ticket mở
        } else {
          lastClosedTicket = {
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

    let targetTicketId = '';
    let ticketStatus = 'Mới';
    let isRecurring = false;
    let recurCount = 0;

    if (openTicketData) {
      targetTicketId = openTicketData.ticket_id;
      ticketStatus = openTicketData.status;
      isRecurring = Boolean(openTicketData.is_recurring);
      recurCount = openTicketData.recur_count;

      ticketsSheet.getRange(openTicketRowIndex, 5).setValue(nowIso);

    } else {
      if (lastClosedTicket && lastClosedTicket.resolved_at) {
        const resolvedTime = new Date(lastClosedTicket.resolved_at).getTime();
        const diffHours = (now.getTime() - resolvedTime) / (1000 * 60 * 60);

        if (diffHours < RECUR_WINDOW_HOURS) {
          isRecurring = true;
          recurCount = lastClosedTicket.recur_count + 1;
        }
      }

      targetTicketId = 'TK-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      ticketStatus = 'Mới';

      ticketsSheet.appendRow([
        targetTicketId,
        sttGroup,
        ticketStatus,
        nowIso, // created_at
        nowIso, // updated_at
        '',     // resolved_at
        '',     // resolved_by
        isRecurring,
        recurCount,
        ''      // note
      ]);
    }

    // Insert 1 dòng vào REPORTS
    const reportId = 'RP-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    reportsSheet.appendRow([
      reportId,
      targetTicketId,
      emailClean,
      nowIso,
      message || ''
    ]);

    const cacheHealth = checkCacheHealth();

    return {
      success: true,
      stt_group: sttGroup,
      ticket_id: targetTicketId,
      status: ticketStatus,
      is_recurring: isRecurring,
      recur_count: recurCount,
      cache_stale: cacheHealth.cache_stale,
      stale_hours: cacheHealth.stale_hours,
      message: openTicketData 
        ? 'Báo lỗi đã được ghi nhận. Fam ' + sttGroup + ' của bạn đang trong tiến trình xử lý.' 
        : 'Đã tạo báo cáo sự cố thành công cho Fam ' + sttGroup + '.'
    };

  } catch (err) {
    return { success: false, message: 'Lỗi ghi nhận báo cáo: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
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

  return {
    success: true,
    has_ticket: true,
    stt_group: sttGroup,
    status: latestTicket.status,
    ticket_id: latestTicket.ticket_id,
    created_at: latestTicket.created_at,
    updated_at: latestTicket.updated_at,
    resolved_at: latestTicket.resolved_at,
    is_recurring: latestTicket.is_recurring,
    recur_count: latestTicket.recur_count,
    report_count: reportCount
  };
}

/**
 * API 3: listTickets(filterStatus) - Dành cho Admin Dashboard
 */
function listTickets(filterStatus) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ticketsSheet = ss.getSheetByName('TICKETS');
  const reportsSheet = ss.getSheetByName('REPORTS');

  const cacheHealth = checkCacheHealth();

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

  const tData = ticketsSheet.getDataRange().getValues();
  const tickets = [];

  for (let i = 1; i < tData.length; i++) {
    const row = tData[i];
    const ticketId = String(row[0]).trim();
    const status = String(row[2]).trim();

    if (filterStatus && filterStatus !== 'All' && filterStatus !== 'Tất cả') {
      if (filterStatus === 'Tái phát' || filterStatus === 'Recurring') {
        if (!Boolean(row[7])) continue;
      } else if (status !== filterStatus) {
        continue;
      }
    }

    const reportInfo = reportMap[ticketId] || { count: 0, emails: [] };

    tickets.push({
      ticket_id: ticketId,
      stt_group: row[1],
      status: status,
      created_at: row[3],
      updated_at: row[4],
      resolved_at: row[5],
      resolved_by: row[6],
      is_recurring: Boolean(row[7]),
      recur_count: Number(row[8] || 0),
      note: row[9] || '',
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
    const data = ticketsSheet.getDataRange().getValues();

    let targetRowIndex = -1;
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim() === String(ticketId).trim()) {
        targetRowIndex = r + 1; // 1-indexed
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

    if (newStatus === 'Đã xử lý') {
      ticketsSheet.getRange(targetRowIndex, 6).setValue(nowIso);
      if (resolvedBy) {
        ticketsSheet.getRange(targetRowIndex, 7).setValue(resolvedBy);
      }
    }

    return { 
      success: true, 
      message: 'Đã cập nhật trạng thái ticket ' + ticketId + ' thành "' + newStatus + '"'
    };

  } catch (err) {
    return { success: false, message: 'Lỗi cập nhật ticket: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}
