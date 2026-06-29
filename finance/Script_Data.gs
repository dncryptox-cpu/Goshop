function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var ss = SpreadsheetApp.openById('1sdL8wF3pLDZ6V_mUqG2aVmI5f60foDzD0ZA0CmC6m3c');

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
      var frSheet = frSs.getSheetByName("FAMRENEW");
      if (frSheet) {
        var email = data.email;
        var newStatus = data.status;
        var activationDate = data.activationDate || '';
        var expiryDate = data.expiryDate || '';

        var dataRange = frSheet.getDataRange();
        var values = dataRange.getValues();
        
        // Email ở cột E (index 4)
        for (var i = 1; i < values.length; i++) {
          if (values[i][4] && values[i][4].toString().trim().toLowerCase() === email.toLowerCase()) {
            frSheet.getRange(i + 1, 2).setValue(newStatus);          // Cột B: Trạng thái
            if (activationDate) {
              frSheet.getRange(i + 1, 4).setValue(activationDate);   // Cột D: Ngày kích hoạt gói
            }
            if (expiryDate) {
              frSheet.getRange(i + 1, 9).setValue(expiryDate);       // Cột I: Ngày hết hạn
            }
            break;
          }
        }
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
