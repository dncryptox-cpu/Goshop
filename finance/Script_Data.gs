function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var ss = SpreadsheetApp.openById('1sdL8wF3pLDZ6V_mUqG2aVmI5f60foDzD0ZA0CmC6m3c');

    // 0. Lấy mã OTP theo Customer Key (cho khách hàng)
    if (action === 'get_customer_otp') {
      var customerKey = String(data.customerKey || '').trim().toUpperCase();
      var email = String(data.email || '').trim().toLowerCase();
      if (!customerKey || !email) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'not_found', message: 'Vui lòng nhập đầy đủ Email và Key.' })).setMimeType(ContentService.MimeType.JSON);
      }

      var twofaSheet = ss.getSheetByName('2FA');
      if (!twofaSheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'not_found', message: 'Sheet 2FA không tồn tại.' })).setMimeType(ContentService.MimeType.JSON);
      }

      var sheetData = twofaSheet.getDataRange().getValues();
      var foundSecret = null;
      var productType = 'YTB'; // mặc định

      // Cột A: Mail (index 0)
      // Cột B: Secret 2FA (index 1)
      // Cột C: Sản phẩm (index 2)
      // Cột D trở đi: các Customer Key (index 3 trở đi)
      for (var r = 1; r < sheetData.length; r++) {
        var row = sheetData[r];
        var rowEmail = String(row[0] || '').trim().toLowerCase();
        if (rowEmail !== email) continue; // Khớp email chính xác mới duyệt tiếp

        var secret2fa = String(row[1] || '').trim();
        if (!secret2fa) continue;

        var prodVal = String(row[2] || '').trim().toUpperCase();

        for (var c = 3; c < row.length; c++) {
          var cellKey = String(row[c] || '').trim().toUpperCase();
          if (cellKey && cellKey === customerKey) {
            foundSecret = secret2fa;
            productType = prodVal || 'YTB';
            break;
          }
        }
        if (foundSecret) break;
      }

      if (!foundSecret) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'not_found', message: 'Email hoặc Customer Key không hợp lệ.' })).setMimeType(ContentService.MimeType.JSON);
      }

      // Định nghĩa số lần giới hạn theo sản phẩm
      var limit = 2; // Default
      if (productType.indexOf('GPT') > -1) {
        limit = 3;
      } else if (productType.indexOf('YTB') > -1) {
        limit = -1; // Vô hạn
      }

      var props = PropertiesService.getScriptProperties();
      var usagePropKey = 'OTP_USAGE_' + email + '_' + customerKey;
      var currentUsage = parseInt(props.getProperty(usagePropKey) || '0', 10);

      // Nếu có giới hạn (limit != -1) và đã đạt tới/quá giới hạn
      if (limit !== -1 && currentUsage >= limit) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'exceeded', usedCount: currentUsage, limit: limit })).setMimeType(ContentService.MimeType.JSON);
      }

      // Tăng đếm số lần dùng
      var newUsage = currentUsage + 1;
      props.setProperty(usagePropKey, String(newUsage));

      // Tính mã TOTP
      var otpCode = generateTOTP(foundSecret);

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        otp: otpCode,
        usedCount: newUsage,
        limit: limit,
        product: productType
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 1. Xử lý Gửi Yêu cầu gia hạn từ CTV
    if (action === 'request_update_hsd') {
      var sheet = ss.getSheetByName("YEU_CAU");
      if (!sheet) {
        sheet = ss.insertSheet("YEU_CAU");
        sheet.appendRow(["ID", "Email", "HSD Cũ", "Tháng Gia Hạn", "HSD Mới", "CTV Yêu Cầu", "Thời Gian", "Trạng Thái"]);
      }
      var req = data.requestData;
      sheet.appendRow([req.id, req.email, req.oldExpiry, req.months, req.newExpiry, req.staff, req.createdAt, "Chờ Duyệt"]);
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Admin đổi Trạng thái tự do hoặc CTV Hủy yêu cầu
    if (action === 'cancel_request' || action === 'change_request_status') {
      var sheet = ss.getSheetByName("YEU_CAU");
      if (sheet) {
        var reqId = data.reqId;
        var dataRange = sheet.getDataRange();
        var values = dataRange.getValues();

        for (var i = 1; i < values.length; i++) {
          if (values[i][0] == reqId) {
            var newStatus = 'Đã Hủy';
            if (action === 'change_request_status') {
              newStatus = data.statusStr;
            }
            sheet.getRange(i + 1, 8).setValue(newStatus);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'update_hsd') {
      var email = data.email;
      var newExpiry = data.newExpiry;
      var sheet = null;
      try {
        var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
        sheet = frSs.getSheetByName("RENEW") || frSs.getSheetByName("FAMRENEW");
      } catch (err) {
        Logger.log("Không thể mở Spreadsheet phụ: " + err.message);
      }
      if (!sheet) {
        sheet = ss.getSheetByName("RENEW") || ss.getSheetByName("FAMRENEW");
      }
      if (sheet) {
        var sheetName = sheet.getName();
        var emailColIndex = (sheetName === 'RENEW') ? 3 : 4;  // Cột D (index 3) vs Cột E (index 4)
        var expiryColNum  = (sheetName === 'RENEW') ? 8 : 9;  // Cột H (col 8) vs Cột I (col 9)

        var dataRange = sheet.getDataRange();
        var values = dataRange.getValues();
        for (var i = 1; i < values.length; i++) {
          if (values[i][emailColIndex] && values[i][emailColIndex].toString().trim().toLowerCase() === email.toLowerCase()) {
            sheet.getRange(i + 1, expiryColNum).setValue(newExpiry);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Xử lý Đơn hàng mới từ Khách hàng
    if (action === 'new_order') {
      var orderSheet = ss.getSheetByName("DON_HANG_MOI");
      if (!orderSheet) {
        orderSheet = ss.insertSheet("DON_HANG_MOI");
        orderSheet.appendRow(['Mã ĐH', 'Email', 'Zalo', 'Sản phẩm', 'Thời hạn', 'Số tiền', 'Trạng thái', 'Ngày tạo', 'Người giới thiệu']);
      }
      var o = data.orderData;
      
      // AUTO GẮN CTV LÀ "Dnc" NẾU KHÁCH KHÔNG NHẬP
      var ctvData = (o.referralCode || '').trim();
      if (ctvData === "") {
          ctvData = "Dnc";
      }
      
      orderSheet.appendRow([o.orderId, o.email, o.phone, o.product, o.duration, o.amount, o.status, o.date, ctvData]);
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Xử lý Log Hoàn Tiền (Refund)
    if (action === 'log_refund') {
      var refundSheet = ss.getSheetByName('REFUND');
      if (!refundSheet) {
        refundSheet = ss.insertSheet('REFUND');
      }
      refundSheet.appendRow([
        data.refundDate,
        data.email,
        data.product,
        data.purchaseDate,
        data.months,
        data.amountPaid,
        data.usedDays,
        data.remainingDays,
        data.refundAmount,
        data.note || "",
        data.customerName || "Admin",
        data.customerPhone || "",
        "", // Cột M: Đã trả khác
        "", // Cột N: Nguồn Ref
        data.clientNote || "" // Cột O: Note gửi khách
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    // 5. Xử lý Yêu cầu rút tiền từ Affiliate
    if (action === 'request_payout') {
      var payoutSheet = ss.getSheetByName("AFF_PAYOUTS");
      if (!payoutSheet) {
        payoutSheet = ss.insertSheet("AFF_PAYOUTS");
        payoutSheet.appendRow(["ID", "Email", "Thời Gian", "Số Tiền", "Ngân Hàng", "Số Tài Khoản", "Chủ Tài Khoản", "Trạng Thái"]);
      }
      var p = data.requestData;
      payoutSheet.appendRow([p.id, p.email, p.date, p.amount, p.bank, p.account, p.name, p.status]);
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 6. Xử lý Yêu cầu duyệt thanh toán Affiliate từ Admin
    if (action === 'change_payout_status') {
      var payoutSheet = ss.getSheetByName("AFF_PAYOUTS");
      if (payoutSheet) {
        var reqId = data.reqId;
        var dataRange = payoutSheet.getDataRange();
        var values = dataRange.getValues();

        for (var i = 1; i < values.length; i++) {
          if (values[i][0] == reqId) {
            payoutSheet.getRange(i + 1, 8).setValue(data.statusStr);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 7. Lưu cấu hình bảng giá từ Admin (Đồng bộ với Khách hàng)
    if (action === 'save_pricing') {
      var pricingSheet = ss.getSheetByName("CONFIG_PRICING");
      if (!pricingSheet) {
        pricingSheet = ss.insertSheet("CONFIG_PRICING");
      }
      pricingSheet.clear();
      pricingSheet.appendRow(["ID", "Tên Sản Phẩm", "Icon", "Mô tả", "Giá 7 Ngày", "Giá 30 Ngày", "Giá 90 Ngày", "Giá 180 Ngày", "Giá 360 Ngày", "Mặc định (Ngày)"]);
      
      var products = data.products;
      if(products && products.length > 0) {
        for (var i = 0; i < products.length; i++) {
          var p = products[i];
          pricingSheet.appendRow([
            p.id, p.name, p.icon, p.desc,
            p.prices[7] || 0, p.prices[30] || 0, p.prices[90] || 0,
            p.prices[180] || 0, p.prices[360] || 0, p.defaultDuration
          ]);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 8. Bật tắt Bảo Trì (Maintenance Mode)
    if (action === 'set_maintenance_mode') {
      var configSheet = ss.getSheetByName("SYSTEM_CONFIG");
      if (!configSheet) {
        configSheet = ss.insertSheet("SYSTEM_CONFIG");
        configSheet.appendRow(["KEY", "VALUE"]);
      }
      
      var dataRange = configSheet.getDataRange();
      var values = dataRange.getValues();
      var found = false;
      
      for (var i = 1; i < values.length; i++) {
        if (values[i][0] === "MAINTENANCE_MODE") {
          configSheet.getRange(i + 1, 2).setValue(data.status ? "TRUE" : "FALSE");
          found = true;
          break;
        }
      }
      
      if (!found) {
        configSheet.appendRow(["MAINTENANCE_MODE", data.status ? "TRUE" : "FALSE"]);
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 9. Xử lý Cập Nhật Trạng Thái FamRenew
    if (action === 'update_fam_renew_status') {
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      var frSheet = frSs.getSheetByName("RENEW") || frSs.getSheetByName("FAMRENEW");
      if (frSheet) {
        var email = data.email;
        var newStatus = data.status;
        var activationDate = data.activationDate || '';
        var expiryDate = data.expiryDate || '';

        var sheetName = frSheet.getName();
        var emailColIndex    = (sheetName === 'RENEW') ? 3 : 4;  // Cột D (index 3) vs Cột E (index 4)
        var statusColNum     = (sheetName === 'RENEW') ? 3 : 2;  // Cột C (col 3) vs Cột B (col 2)
        var expiryColNum     = (sheetName === 'RENEW') ? 8 : 9;  // Cột H (col 8) vs Cột I (col 9)
        var activationColNum = (sheetName === 'RENEW') ? 0 : 4;  // Cột D (col 4) ở sheet cũ, sheet mới không có

        var dataRange = frSheet.getDataRange();
        var values = dataRange.getValues();
        
        for (var i = 1; i < values.length; i++) {
          if (values[i][emailColIndex] && values[i][emailColIndex].toString().trim().toLowerCase() === email.toLowerCase()) {
            frSheet.getRange(i + 1, statusColNum).setValue(newStatus);
            if (activationDate && activationColNum > 0) {
              frSheet.getRange(i + 1, activationColNum).setValue(activationDate);
            }
            if (expiryDate) {
              frSheet.getRange(i + 1, expiryColNum).setValue(expiryDate);
            }
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 10. Luu thong tin ghep cap Fam
    if (action === 'save_fam_pairing') {
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      var pairingSheet = frSs.getSheetByName("PAIRINGS");
      if (!pairingSheet) {
        pairingSheet = frSs.insertSheet("PAIRINGS");
        pairingSheet.appendRow(["STT FAM", "nextFamStt", "nextFamEmail", "nextFamPass", "nextFamMkp", "nextFam2fa", "pairedDate", "verStatus"]);
      }
      
      var stt = String(data.stt).trim();
      var nextFamStt = String(data.nextFamStt || '').trim();
      var nextFamEmail = String(data.nextFamEmail || '').trim();
      var nextFamPass = String(data.nextFamPass || '').trim();
      var nextFamMkp = String(data.nextFamMkp || '').trim();
      var nextFam2fa = String(data.nextFam2fa || '').trim();
      var pairedDate = new Date().toLocaleString();
      var verStatus = String(data.verStatus || '').trim();
      
      var dataRange = pairingSheet.getDataRange();
      var values = dataRange.getValues();
      var foundRow = -1;
      
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === stt) {
          foundRow = i + 1;
          break;
        }
      }
      
      if (foundRow !== -1) {
        pairingSheet.getRange(foundRow, 2).setValue(nextFamStt);
        pairingSheet.getRange(foundRow, 3).setValue(nextFamEmail);
        pairingSheet.getRange(foundRow, 4).setValue(nextFamPass);
        pairingSheet.getRange(foundRow, 5).setValue(nextFamMkp);
        pairingSheet.getRange(foundRow, 6).setValue(nextFam2fa);
        pairingSheet.getRange(foundRow, 7).setValue(pairedDate);
        if (verStatus) pairingSheet.getRange(foundRow, 8).setValue(verStatus);
      } else {
        pairingSheet.appendRow([stt, nextFamStt, nextFamEmail, nextFamPass, nextFamMkp, nextFam2fa, pairedDate, verStatus]);
      }
      
      // Update KHO_RENEW state
      var khoRenewSheet = frSs.getSheetByName("KHO_RENEW");
      if (khoRenewSheet && nextFamEmail) {
        var khoRange = khoRenewSheet.getDataRange();
        var khoValues = khoRange.getValues();
        for (var j = 1; j < khoValues.length; j++) {
          if (String(khoValues[j][0]).trim().toLowerCase() === nextFamEmail.toLowerCase()) {
            khoRenewSheet.getRange(j + 1, 7).setValue("Đã ghép");
            khoRenewSheet.getRange(j + 1, 8).setValue(stt);
            break;
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 11. Huy ghep cap Fam
    if (action === 'unpair_fam') {
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      var pairingSheet = frSs.getSheetByName("PAIRINGS");
      if (pairingSheet) {
        var stt = String(data.stt).trim();
        var dataRange = pairingSheet.getDataRange();
        var values = dataRange.getValues();
        var pairedEmail = "";
        
        for (var i = 1; i < values.length; i++) {
          if (String(values[i][0]).trim() === stt) {
            pairedEmail = String(values[i][2] || '').trim();
            pairingSheet.deleteRow(i + 1);
            break;
          }
        }
        
        // Reset status in KHO_RENEW
        var khoRenewSheet = frSs.getSheetByName("KHO_RENEW");
        if (khoRenewSheet && pairedEmail) {
          var khoRange = khoRenewSheet.getDataRange();
          var khoValues = khoRange.getValues();
          var markAsUsed = data.markAsUsed === true || data.markAsUsed === 'true';
          var targetStatus = markAsUsed ? "Đã dùng" : "Sẵn sàng";
          
          for (var j = 1; j < khoValues.length; j++) {
            if (String(khoValues[j][0]).trim().toLowerCase() === pairedEmail.toLowerCase()) {
              khoRenewSheet.getRange(j + 1, 7).setValue(targetStatus);
              khoRenewSheet.getRange(j + 1, 8).setValue("");
              break;
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 12. Lay nhanh danh sach Fam tu Kho
    if (action === 'request_bulk_fams') {
      var count = parseInt(data.count || 0);
      if (count <= 0) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Số lượng phải lớn hơn 0.'})).setMimeType(ContentService.MimeType.JSON);
      }
      
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      var khoRenewSheet = frSs.getSheetByName("KHO_RENEW");
      if (!khoRenewSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Tab KHO_RENEW không tồn tại.'})).setMimeType(ContentService.MimeType.JSON);
      }
      
      var khoRange = khoRenewSheet.getDataRange();
      var khoValues = khoRange.getValues();
      var foundFams = [];
      var rowIndices = [];
      
      for (var j = 1; j < khoValues.length; j++) {
        var status = String(khoValues[j][6] || '').trim(); // Status is column 7 (index 6)
        if (status === 'Sẵn sàng' || status === '') {
          foundFams.push({
            email: String(khoValues[j][0] || '').trim(),
            pass: String(khoValues[j][1] || '').trim(),
            recoveryEmail: String(khoValues[j][2] || '').trim(),
            twofa: String(khoValues[j][3] || '').trim(),
            renewDate: String(khoValues[j][4] || '').trim(),
            importDate: String(khoValues[j][5] || '').trim()
          });
          rowIndices.push(j + 1);
          if (foundFams.length === count) break;
        }
      }
      
      // If we found them, and confirm is true, mark them as used
      if (data.confirm === true || data.confirm === 'true') {
        for (var k = 0; k < rowIndices.length; k++) {
          khoRenewSheet.getRange(rowIndices[k], 7).setValue("Đã dùng");
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        fams: foundFams
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 13. Danh dau nhieu Fam da dung
    if (action === 'mark_fams_as_used') {
      var emails = data.emails || [];
      if (emails.length > 0) {
        var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
        var khoRenewSheet = frSs.getSheetByName("KHO_RENEW");
        if (khoRenewSheet) {
          var khoRange = khoRenewSheet.getDataRange();
          var khoValues = khoRange.getValues();
          var emailMap = {};
          emails.forEach(function(email) {
            emailMap[String(email).trim().toLowerCase()] = true;
          });
          
          for (var j = 1; j < khoValues.length; j++) {
            var currentEmail = String(khoValues[j][0] || '').trim().toLowerCase();
            if (emailMap[currentEmail]) {
              khoRenewSheet.getRange(j + 1, 7).setValue("Đã dùng");
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 14. Cap nhat thong tin Fam trong Kho
    if (action === 'update_kho_renew_item') {
      var email = String(data.email || '').trim();
      if (!email) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Thiếu email.'})).setMimeType(ContentService.MimeType.JSON);
      }
      
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      var khoRenewSheet = frSs.getSheetByName("KHO_RENEW");
      if (!khoRenewSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Tab KHO_RENEW không tồn tại.'})).setMimeType(ContentService.MimeType.JSON);
      }
      
      var khoRange = khoRenewSheet.getDataRange();
      var khoValues = khoRange.getValues();
      var foundRowIndex = -1;
      
      for (var j = 1; j < khoValues.length; j++) {
        if (String(khoValues[j][0] || '').trim().toLowerCase() === email.toLowerCase()) {
          foundRowIndex = j + 1;
          break;
        }
      }
      
      if (foundRowIndex === -1) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Không tìm thấy Fam trong Kho.'})).setMimeType(ContentService.MimeType.JSON);
      }
      
      // Update values
      if (data.twofa !== undefined) {
        khoRenewSheet.getRange(foundRowIndex, 4).setValue(String(data.twofa).trim()); // Column D
      }
      if (data.renewDate !== undefined) {
        khoRenewSheet.getRange(foundRowIndex, 5).setValue(String(data.renewDate).trim()); // Column E
      }
      if (data.status !== undefined) {
        khoRenewSheet.getRange(foundRowIndex, 7).setValue(String(data.status).trim()); // Column G
      }
      if (data.famFollow !== undefined) {
        khoRenewSheet.getRange(foundRowIndex, 8).setValue(String(data.famFollow).trim()); // Column H
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function syncDonHangMoiToTaiChinh(e) {
  if (!e) {
    console.log("CẢNH BÁO: Bạn đang bấm nút Chạy thủ công. Hãy ra ngoài Google Sheets để thao tác!");
    return;
  }
  
  var sheet = e.source.getActiveSheet();
  var range = e.range;
  var row = range.getRow();
  
  var sheetName = sheet.getName();
  var col = range.getColumn();
  var statusValue = sheet.getRange(row, 7).getValue().toString().trim();
  
  if (sheetName === "DON_HANG_MOI" && col === 7 && statusValue === "Done") {
    var lock = LockService.getDocumentLock();
    try { lock.waitLock(5000); } catch (error) { return; }

    try {
      var orderId = sheet.getRange(row, 1).getValue(); 
      var email = sheet.getRange(row, 2).getValue();   
      var productRaw = sheet.getRange(row, 4).getValue();
      var durationDays = parseInt(sheet.getRange(row, 5).getValue()) || 0;
      var dateStr = sheet.getRange(row, 8).getValue(); 
      
      var rawUser = sheet.getRange(row, 9).getValue();    
      var user = rawUser ? String(rawUser).trim() : "";
      if (user === "") { user = "Dnc"; }
      
      var durationSuffix = '0';
      if (durationDays >= 360) durationSuffix = '12';
      else if (durationDays >= 180) durationSuffix = '6';
      else if (durationDays >= 90) durationSuffix = '3';
      else if (durationDays >= 30) durationSuffix = '1';

      var basePlan = String(productRaw).trim();
      var product = basePlan;
      var baseLower = basePlan.toLowerCase();
      
      if (['còn slot', 'full', 'nk plus', 'n plus', 'youtube'].some(function(p) { return baseLower.includes(p); })) { 
          product = 'Youtube-' + durationSuffix; 
      } else {
          product = basePlan + '-' + durationSuffix; 
      }

      var targetData = [dateStr, user + " - " + orderId, "New", email, product];
      
      var targetSpreadsheetId = "1-EgeNWztGQsY2rmLYp00yKDjgHR5WYoqzzhAkSnvJjc";
      var targetSpreadsheet = SpreadsheetApp.openById(targetSpreadsheetId);
      var targetSheet = targetSpreadsheet.getSheetByName("DATA(YTB)");
      
      if (targetSheet) {
        var colA = targetSheet.getRange("A1:A").getValues();
        var emptyRow = 1;
        for (var i = colA.length - 1; i >= 0; i--) {
          if (colA[i][0] !== "") { emptyRow = i + 2; break; }
        }
        targetSheet.getRange(emptyRow, 1, 1, 5).setValues([targetData]);
        targetSheet.getRange(emptyRow, 8).setValue(user);
        SpreadsheetApp.getActiveSpreadsheet().toast('✅ Đã bắn đơn: ' + product + ' (CTV: ' + user + ')', 'DON HANG MOI', 4);
      }
    } catch (error) {
      SpreadsheetApp.getActiveSpreadsheet().toast('LỖI: ' + error.message, 'Hệ Thống', 10);
    } finally {
      lock.releaseLock();
    }
  }
}

// ============================================================
// TOTP Helper - RFC 6238 (chuẩn Google Authenticator)
// ============================================================

function generateTOTP(secret) {
  try {
    var cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    var keyBytes = base32Decode(cleanSecret);

    var epoch = Math.floor(Date.now() / 1000);
    var timeStep = Math.floor(epoch / 30);

    // 8-byte big-endian counter
    var timeBytes = [];
    for (var i = 7; i >= 0; i--) {
      timeBytes[i] = timeStep & 0xff;
      timeStep = timeStep >>> 8;
    }

    // HMAC-SHA1 via Apps Script
    var hmacBytes = Utilities.computeHmacSignature(
      Utilities.MacAlgorithm.HMAC_SHA_1,
      timeBytes,
      keyBytes
    );

    // Dynamic truncation
    var offset = hmacBytes[19] & 0xf;
    var binCode = ((hmacBytes[offset]     & 0x7f) << 24) |
                  ((hmacBytes[offset + 1] & 0xff) << 16) |
                  ((hmacBytes[offset + 2] & 0xff) << 8)  |
                   (hmacBytes[offset + 3] & 0xff);

    var otp = binCode % 1000000;
    return String(otp).padStart(6, '0');
  } catch (e) {
    Logger.log('generateTOTP error: ' + e.message);
    return '000000';
  }
}

function base32Decode(base32) {
  var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  var bits = 0;
  var value = 0;
  var output = [];
  var input = base32.replace(/=+$/, '');
  for (var i = 0; i < input.length; i++) {
    var idx = alphabet.indexOf(input[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return output;
}
