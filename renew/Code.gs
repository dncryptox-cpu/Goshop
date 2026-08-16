/**
 * FAM ISSUE TRACKER - BACKEND APPS SCRIPT
 * SpreadSheet: FAM_ISSUE_TRACKER
 * 
 * Tự động đồng bộ cache từ kho TK (ID: 1Agq-0ITsQgzhwnWvQTUthAjS2e8zJfgNd8dGGkCDniA)
 * Quản lý báo lỗi theo Group/Fam (RN1, RN2, RN3...)
 * Nhận diện lỗi tái phát (is_recurring, recur_count) trong vòng 24h từ khi Đã xử lý
 */

const KHO_TK_ID = '1Agq-0ITsQgzhwnWvQTUthAjS2e8zJfgNd8dGGkCDniA';
const KHO_TK_TAB_NAME = 'DATA';
const RECUR_WINDOW_HOURS = 24; // Cấu hình thời gian tính tái phát (giờ)

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
  // Cho phép CORS
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    let params = {};
    if (e && e.parameter) {
      params = e.parameter;
    }
    
    // Nếu có POST JSON body
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
 * 2. Tự động đồng bộ cache Email -> STT từ Sheet Kho TK
 * Đọc theo TÊN CỘT Header ('Email khách' và 'STT'), KHÔNG hardcode chỉ số cột.
 */
function syncEmailLookupCache() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
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

    const headers = data[0];
    let emailColIdx = -1;
    let sttColIdx = -1;

    for (let i = 0; i < headers.length; i++) {
      const headerStr = String(headers[i]).trim().toLowerCase();
      if (headerStr === 'email khách' || headerStr.includes('email')) {
        if (emailColIdx === -1) emailColIdx = i;
      }
      if (headerStr === 'stt' || headerStr === 'mã stt' || headerStr.includes('stt')) {
        if (sttColIdx === -1) sttColIdx = i;
      }
    }

    if (emailColIdx === -1 || sttColIdx === -1) {
      return { 
        success: false, 
        message: 'Không tìm thấy đủ cột "Email khách" hoặc "STT" trong tab DATA Kho TK. Cột hiện có: ' + headers.join(', ')
      };
    }

    const cacheMap = {};
    const nowIso = new Date().toISOString();

    for (let r = 1; r < data.length; r++) {
      const emailRaw = data[r][emailColIdx];
      const sttRaw = data[r][sttColIdx];

      if (emailRaw && sttRaw) {
        const emailClean = String(emailRaw).trim().toLowerCase();
        const sttClean = String(sttRaw).trim();
        if (emailClean && sttClean) {
          cacheMap[emailClean] = sttClean;
        }
      }
    }

    // Ghi đè vào tab EMAIL_LOOKUP_CACHE
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');
    
    // Clear dữ liệu cũ (trừ header)
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

    return { 
      success: true, 
      count: rowsToInsert.length, 
      synced_at: nowIso, 
      message: 'Đồng bộ thành công ' + rowsToInsert.length + ' tài khoản từ Kho TK!'
    };
  } catch (err) {
    return { success: false, message: 'Lỗi đồng bộ cache: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: Tra cứu STT group từ Email trong cache
 */
function getSttGroupByEmail(emailClean) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cacheSheet = ss.getSheetByName('EMAIL_LOOKUP_CACHE');
  if (!cacheSheet || cacheSheet.getLastRow() <= 1) {
    // Thử auto sync nếu chưa có cache
    syncEmailLookupCache();
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
    return { success: false, message: 'Vui lòng nhập Email.' };
  }

  const emailClean = String(emailRaw).trim().toLowerCase();
  const sttGroup = getSttGroupByEmail(emailClean);

  if (!sttGroup) {
    return {
      success: false,
      message: 'Không tìm thấy tài khoản với email này. Vui lòng kiểm tra lại hoặc liên hệ CTV.'
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

    // Duyệt danh sách tickets để tìm ticket mở hoặc ticket cũ nhất
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
          // Ghi nhận ticket đã xử lý gần nhất
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
      // 1. CÓ TICKET MỞ -> Không tạo ticket mới. Chỉ append report và cập nhật updated_at
      targetTicketId = openTicketData.ticket_id;
      ticketStatus = openTicketData.status;
      isRecurring = Boolean(openTicketData.is_recurring);
      recurCount = openTicketData.recur_count;

      // Cập nhật updated_at của ticket ở row `openTicketRowIndex`
      ticketsSheet.getRange(openTicketRowIndex, 5).setValue(nowIso);

    } else {
      // 2. KHÔNG CÓ TICKET MỞ -> Tạo ticket mới
      if (lastClosedTicket && lastClosedTicket.resolved_at) {
        const resolvedTime = new Date(lastClosedTicket.resolved_at).getTime();
        const diffHours = (now.getTime() - resolvedTime) / (1000 * 60 * 60);

        if (diffHours < RECUR_WINDOW_HOURS) {
          // Lỗi tái phát trong 24h từ khi Đã xử lý!
          isRecurring = true;
          recurCount = lastClosedTicket.recur_count + 1;
        }
      }

      targetTicketId = 'TK-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      ticketStatus = 'Mới';

      // Insert 1 dòng vào TICKETS
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

    // Insert 1 dòng vào REPORTS (log đầy đủ)
    const reportId = 'RP-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    reportsSheet.appendRow([
      reportId,
      targetTicketId,
      emailClean,
      nowIso,
      message || ''
    ]);

    return {
      success: true,
      stt_group: sttGroup,
      ticket_id: targetTicketId,
      status: ticketStatus,
      is_recurring: isRecurring,
      recur_count: recurCount,
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
    return { success: false, message: 'Vui lòng nhập Email.' };
  }

  const emailClean = String(emailRaw).trim().toLowerCase();
  const sttGroup = getSttGroupByEmail(emailClean);

  if (!sttGroup) {
    return {
      success: false,
      message: 'Không tìm thấy tài khoản với email này trong hệ thống. Vui lòng kiểm tra lại.'
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

  // Lấy ticket MỚI NHẤT theo created_at của stt_group
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

  // Đếm số lượng report gắn với ticket này
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

  if (!ticketsSheet || ticketsSheet.getLastRow() <= 1) {
    return { success: true, tickets: [] };
  }

  // Map số lượng và danh sách email từ REPORTS
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

  // Sắp xếp Ticket:
  // 1. Ticket đang mở (Mới/Đang xử lý) lên trước Đã xử lý
  // 2. Ticket có recur_count cao hơn lên trước
  // 3. Ngày tạo mới nhất lên trước
  tickets.sort((a, b) => {
    const aClosed = (a.status === 'Đã xử lý') ? 1 : 0;
    const bClosed = (b.status === 'Đã xử lý') ? 1 : 0;
    if (aClosed !== bClosed) return aClosed - bClosed;

    if (b.recur_count !== a.recur_count) {
      return b.recur_count - a.recur_count;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return { success: true, tickets: tickets };
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

    // Cập nhật status (cột 3), updated_at (cột 5), note (cột 10)
    ticketsSheet.getRange(targetRowIndex, 3).setValue(newStatus);
    ticketsSheet.getRange(targetRowIndex, 5).setValue(nowIso);
    if (note !== undefined && note !== null) {
      ticketsSheet.getRange(targetRowIndex, 10).setValue(note);
    }

    if (newStatus === 'Đã xử lý') {
      ticketsSheet.getRange(targetRowIndex, 6).setValue(nowIso); // resolved_at
      if (resolvedBy) {
        ticketsSheet.getRange(targetRowIndex, 7).setValue(resolvedBy); // resolved_by
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
