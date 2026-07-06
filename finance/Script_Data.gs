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
      var modSheet = frSs.getSheetByName("RENEW_MODIFIED");
      var frSheet = frSs.getSheetByName("RENEW") || frSs.getSheetByName("FAMRENEW");
      if (frSheet) {
        var email = data.email;
        var newStatus = data.status;
        var expiryDate = data.expiryDate || '';

        var targetSheet = modSheet || frSheet;
        var sheetName = frSheet.getName();
        var emailColIndex = (sheetName === 'RENEW') ? 3 : 4;  // Cột D vs E
        var sttColIndex   = (sheetName === 'RENEW') ? 1 : 2;  // Cột B vs C

        var dataRange = targetSheet.getDataRange();
        var values = dataRange.getValues();
        
        for (var i = 1; i < values.length; i++) {
          if (values[i][emailColIndex] && values[i][emailColIndex].toString().trim().toLowerCase() === email.toLowerCase()) {
            var stt = String(values[i][sttColIndex]).trim();
            var updates = {
              status: newStatus,
              expiryDate: expiryDate || undefined
            };
            if (data.notes !== undefined) {
              updates.notes = String(data.notes).trim();
            }
            updateRenewModifiedRow(frSs, stt, updates);
            break;
          }
        }
        
        // Đồng bộ Fam hiện tại sang Kho
        syncFamHienTaiToKhoRenew();
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 9.4b. Cập nhật trạng thái trực tiếp trong KHO_RENEW (từ tab Theo Dõi Lỗi)
    if (action === 'update_kho_renew_status') {
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      var khoRenewSheet = frSs.getSheetByName("KHO_RENEW");
      if (!khoRenewSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'KHO_RENEW not found'})).setMimeType(ContentService.MimeType.JSON);
      }
      var email = String(data.email || '').trim().toLowerCase();
      var newStatus = String(data.status || '').trim();
      var notes = String(data.notes || '').trim();
      var operator = String(data.operator || 'Admin').trim();
      
      if (!email || !newStatus) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Missing email or status'})).setMimeType(ContentService.MimeType.JSON);
      }
      var khoRange = khoRenewSheet.getDataRange();
      var khoValues = khoRange.getValues();
      var updated = false;
      for (var i = 1; i < khoValues.length; i++) {
        var rowEmail = String(khoValues[i][0] || '').trim().toLowerCase();
        if (rowEmail === email) {
          khoRenewSheet.getRange(i + 1, 7).setValue(newStatus); // Cột G = Trạng thái
          
          if (notes) {
            var fullNote = "[" + operator + "] " + notes;
            var currentNote = String(khoValues[i][8] || '').trim(); // Cột I (index 8)
            var finalNote = currentNote ? currentNote + "\n" + fullNote : fullNote;
            khoRenewSheet.getRange(i + 1, 9).setValue(finalNote);
          }
          
          updated = true;
          break;
        }
      }
      if (updated) {
        return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({status: 'not_found', message: 'Email không tìm thấy trong KHO_RENEW'})).setMimeType(ContentService.MimeType.JSON);
      }
    }


    // 9.5. Xử lý Thay Fam Mới cho Slot (renew_fam_slot)
    if (action === 'renew_fam_slot') {
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      var pairingSheet = frSs.getSheetByName("PAIRINGS");
      var khoRenewSheet = frSs.getSheetByName("KHO_RENEW");
      
      var stt = String(data.stt).trim();
      var expiryDate = data.expiryDate || '';
      
      if (pairingSheet && khoRenewSheet) {
        // 1. Tìm thông tin ghép cặp trong PAIRINGS
        var pairingRange = pairingSheet.getDataRange();
        var pairingValues = pairingRange.getValues();
        var pairedInfo = null;
        var pairingRowIdx = -1;
        
        for (var i = 1; i < pairingValues.length; i++) {
          if (String(pairingValues[i][0]).trim() === stt) {
            pairedInfo = {
              nextFamEmail: String(pairingValues[i][2]).trim(),
              nextFamPass: String(pairingValues[i][3]).trim(),
              nextFamMkp: String(pairingValues[i][4]).trim(),
              nextFam2fa: String(pairingValues[i][5]).trim()
            };
            pairingRowIdx = i + 1;
            break;
          }
        }
        
        if (pairedInfo && pairedInfo.nextFamEmail) {
          // 2. Ghi đè vào dòng có STT FAM tương ứng ở RENEW_MODIFIED
          updateRenewModifiedRow(frSs, stt, {
            status: "Đang dùng",
            email: pairedInfo.nextFamEmail,
            pass: pairedInfo.nextFamPass,
            mkp: pairedInfo.nextFamMkp,
            twofa: pairedInfo.nextFam2fa,
            expiryDate: expiryDate || undefined
          });
          
          // 3. Cập nhật trạng thái của Fam mới trong KHO_RENEW thành "Đã dùng" và xóa FamFollow
          var khoRange = khoRenewSheet.getDataRange();
          var khoValues = khoRange.getValues();
          for (var k = 1; k < khoValues.length; k++) {
            if (String(khoValues[k][0]).trim().toLowerCase() === pairedInfo.nextFamEmail.toLowerCase()) {
              khoRenewSheet.getRange(k + 1, 7).setValue("Đã dùng"); // Cột G
              khoRenewSheet.getRange(k + 1, 8).setValue("");        // Cột H
              break;
            }
          }
          
          // 4. Xóa dòng ghép cặp trong PAIRINGS
          if (pairingRowIdx !== -1) {
            pairingSheet.deleteRow(pairingRowIdx);
          }
          logToKiemSoatRN(frSs, stt, "Thay mới tài khoản (từ PAIRINGS)", "", pairedInfo.nextFamEmail, "Đang dùng", expiryDate, "DNC", "Ghép từ PAIRINGS");
        }
        
        // Đồng bộ Fam hiện tại sang Kho
        syncFamHienTaiToKhoRenew();
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 9.6. Xử lý Thay Fam Hàng Loạt Từ Tab Yêu Cầu (bulk_renew_fam_slots)
    if (action === 'bulk_renew_fam_slots') {
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      var khoRenewSheet = frSs.getSheetByName("KHO_RENEW");
      
      var replacements = data.replacements || [];
      var expiryDate = data.expiryDate || '';
      
      if (khoRenewSheet && replacements.length > 0) {
        var khoRange = khoRenewSheet.getDataRange();
        var khoValues = khoRange.getValues();
        
        for (var r = 0; r < replacements.length; r++) {
          var rep = replacements[r];
          var stt = String(rep.stt).trim();
          var nextEmail = String(rep.nextFamEmail).trim();
          
          // Ghi đè vào RENEW_MODIFIED
          updateRenewModifiedRow(frSs, stt, {
            status: "Đang dùng",
            email: nextEmail,
            pass: String(rep.nextFamPass).trim(),
            mkp: String(rep.nextFamMkp).trim(),
            twofa: String(rep.nextFam2fa).trim(),
            expiryDate: expiryDate || undefined
          });
          
          // Cập nhật KHO_RENEW thành Đã dùng và lưu STT Fam cũ vào cột FamFollow (cột 8)
          for (var k = 1; k < khoValues.length; k++) {
            if (String(khoValues[k][0]).trim().toLowerCase() === nextEmail.toLowerCase()) {
              khoRenewSheet.getRange(k + 1, 7).setValue("Đã dùng"); // Cột G
              khoRenewSheet.getRange(k + 1, 8).setValue(stt);       // Cột H (FamFollow)
              break;
            }
          }
          logToKiemSoatRN(frSs, stt, "Thay mới tài khoản (từ Yêu Cầu)", "", nextEmail, "Đang dùng", expiryDate, "DNC", "Xử lý yêu cầu renew");
        }
        
        // Đồng bộ Fam hiện tại sang Kho
        syncFamHienTaiToKhoRenew();
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
      if (data.notes !== undefined) {
        // Ghi chú lỗi ở cột I (cột 9)
        var headerCell = khoRenewSheet.getRange(1, 9);
        if (headerCell.getValue() === "") {
          headerCell.setValue("Ghi chú").setFontWeight("bold");
        }
        khoRenewSheet.getRange(foundRowIndex, 9).setValue(String(data.notes).trim());
      }
      
      // Đồng bộ Fam hiện tại sang Kho
      syncFamHienTaiToKhoRenew();
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 15. Bulk Mark Banned
    if (action === 'bulk_mark_banned') {
      var emails = data.emails || [];
      var notes = data.notes || '';
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      
      var modSheet = frSs.getSheetByName("RENEW_MODIFIED");
      var frSheet = frSs.getSheetByName("RENEW") || frSs.getSheetByName("FAMRENEW");
      var khoRenewSheet = frSs.getSheetByName("KHO_RENEW");
      
      var emailMap = {};
      emails.forEach(function(email) {
        emailMap[String(email).trim().toLowerCase()] = true;
      });
      
      var updatedCount = 0;
      
      if (frSheet) {
        var targetSheet = modSheet || frSheet;
        var sheetName = frSheet.getName();
        var emailColIndex = (sheetName === 'RENEW') ? 3 : 4;  // Cột D (index 3) vs Cột E (index 4)
        var sttColIndex   = (sheetName === 'RENEW') ? 1 : 2;  // Cột B (index 1) vs Cột C (index 2)
        
        var dataRange = targetSheet.getDataRange();
        var values = dataRange.getValues();
        
        for (var i = 1; i < values.length; i++) {
          var currentEmail = String(values[i][emailColIndex] || '').trim().toLowerCase();
          if (emailMap[currentEmail]) {
            var stt = String(values[i][sttColIndex] || '').trim();
            if (stt) {
              var oldNotes = String(values[i][(sheetName === 'RENEW') ? 8 : 9] || '').trim();
              var finalNotes = (oldNotes ? oldNotes + " - " : "") + (notes || "Banned");
              updateRenewModifiedRow(frSs, stt, {
                status: "Banned",
                notes: finalNotes
              });
              logToKiemSoatRN(frSs, stt, "Cập nhật trạng thái", currentEmail, currentEmail, "Banned", "", "DNC", finalNotes || "Banned");
            }
            updatedCount++;
          }
        }
      }
      
      if (khoRenewSheet) {
        var dataRange = khoRenewSheet.getDataRange();
        var values = dataRange.getValues();
        
        for (var j = 1; j < values.length; j++) {
          var currentEmail = String(values[j][0] || '').trim().toLowerCase();
          if (emailMap[currentEmail]) {
            khoRenewSheet.getRange(j + 1, 7).setValue("Banned"); // Cột G: Trạng thái
            if (notes) {
              khoRenewSheet.getRange(j + 1, 9).setValue(notes); // Cột I: Ghi chú
            }
            updatedCount++;
          }
        }
      }
      
      syncFamHienTaiToKhoRenew();
      return ContentService.createTextOutput(JSON.stringify({status: 'success', updatedCount: updatedCount})).setMimeType(ContentService.MimeType.JSON);
    }

    // 16. Bulk Replace Fams With History
    if (action === 'bulk_replace_fams_with_history') {
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      var frSheet = frSs.getSheetByName("RENEW") || frSs.getSheetByName("FAMRENEW");
      var khoRenewSheet = frSs.getSheetByName("KHO_RENEW");
      
      var historySheet = frSs.getSheetByName("REPLACE_HISTORY");
      if (!historySheet) {
        historySheet = frSs.insertSheet("REPLACE_HISTORY");
        historySheet.appendRow(["Thời Gian", "STT FAM", "Email Cũ", "Pass Cũ", "MKP Cũ", "2FA Cũ", "Email Mới", "Mật Khẩu Mới", "MKP Mới", "2FA Mới", "HSD Mới", "Người Thực Hiện", "Ghi Chú", "Trạng Thái"]);
        historySheet.getRange(1, 1, 1, 14).setFontWeight("bold").setBackground("#f3f3f3");
      }
      
      var replacements = data.replacements || [];
      var staff = standardizeStaffName(data.staff);
      var timestamp = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
      
      if (frSheet && khoRenewSheet && replacements.length > 0) {
        var renewRange = frSheet.getDataRange();
        var renewValues = renewRange.getValues();
        var sheetName = frSheet.getName();
        
        var sttColNum     = (sheetName === 'RENEW') ? 2 : 3;
        var statusColNum  = (sheetName === 'RENEW') ? 3 : 2;
        var emailColNum   = (sheetName === 'RENEW') ? 4 : 5;
        var passColNum    = (sheetName === 'RENEW') ? 5 : 6;
        var mkpColNum     = (sheetName === 'RENEW') ? 6 : 7;
        var twofaColNum   = (sheetName === 'RENEW') ? 7 : 8;
        var expiryColNum  = (sheetName === 'RENEW') ? 8 : 9;
        var notesColNum   = (sheetName === 'RENEW') ? 9 : 10;
        
        var khoRange = khoRenewSheet.getDataRange();
        var khoValues = khoRange.getValues();
        
        for (var r = 0; r < replacements.length; r++) {
          var rep = replacements[r];
          var stt = String(rep.stt).trim();
          var oldEmail = String(rep.oldEmail || '').trim();
          var nextEmail = String(rep.nextFamEmail).trim();
          var nextPass = String(rep.nextFamPass).trim();
          var nextMkp = String(rep.nextFamMkp || '').trim();
          var next2fa = String(rep.nextFam2fa || '').trim();
          var expiryDate = String(rep.expiryDate || '').trim();
          var notes = String(rep.notes || '').trim();
          
          var oldPass = "";
          var oldMkp = "";
          var old2fa = "";
          
          // 1. Ghi đè vào RENEW_MODIFIED
          var foundRenew = false;
          for (var j = 1; j < renewValues.length; j++) {
            if (String(renewValues[j][sttColNum - 1]).trim() === stt) {
              oldPass = String(renewValues[j][passColNum - 1] || '');
              oldMkp = String(renewValues[j][mkpColNum - 1] || '');
              old2fa = String(renewValues[j][twofaColNum - 1] || '');
              
              var autoNote = "Thay từ " + oldEmail + " ngày " + timestamp.split(' ')[0];
              var finalNotes = autoNote + (notes ? " - " + notes : "");
              
              updateRenewModifiedRow(frSs, stt, {
                status: "Đang dùng",
                email: nextEmail,
                pass: nextPass,
                mkp: nextMkp,
                twofa: next2fa,
                expiryDate: expiryDate || undefined,
                notes: finalNotes
              });
              
              foundRenew = true;
              break;
            }
          }
          
          // 2. Cập nhật KHO_RENEW thành Đã dùng cho Fam mới
          for (var k = 1; k < khoValues.length; k++) {
            if (String(khoValues[k][0]).trim().toLowerCase() === nextEmail.toLowerCase()) {
              khoRenewSheet.getRange(k + 1, 7).setValue("Đã dùng"); // Cột G
              khoRenewSheet.getRange(k + 1, 8).setValue(stt);       // Cột H (FamFollow / FAM HIỆN TẠI)
              khoRenewSheet.getRange(k + 1, 9).setValue(notes);     // Cột I (Ghi chú)
              khoRenewSheet.getRange(k + 1, 10).setValue(staff);    // Cột J (Người làm)
              break;
            }
          }
          
          // 3. Đánh dấu Đã thay cho Fam cũ trong KHO_RENEW (nếu tồn tại trong kho)
          if (oldEmail) {
            for (var k = 1; k < khoValues.length; k++) {
              if (String(khoValues[k][0]).trim().toLowerCase() === oldEmail.toLowerCase()) {
                khoRenewSheet.getRange(k + 1, 7).setValue("Đã dùng"); // Cột G
                khoRenewSheet.getRange(k + 1, 8).setValue("");         // Cột H (FamFollow / FAM HIỆN TẠI) - Clear it
                khoRenewSheet.getRange(k + 1, 9).setValue("Thay thế bằng " + nextEmail + (notes ? " - " + notes : "")); // Cột I (Ghi chú)
                khoRenewSheet.getRange(k + 1, 10).setValue(staff);    // Cột J (Người làm)
                break;
              }
            }
          }
          
          // 4. Ghi lịch sử vào REPLACE_HISTORY
          historySheet.appendRow([timestamp, stt, oldEmail, oldPass, oldMkp, old2fa, nextEmail, nextPass, nextMkp, next2fa, expiryDate, staff, notes, "Hoạt động"]);
          logToKiemSoatRN(frSs, stt, "Thay mới tài khoản", oldEmail, nextEmail, "Đang dùng", expiryDate, staff, notes || ("Thay từ " + oldEmail + " sang " + nextEmail));
        }
        
        syncFamHienTaiToKhoRenew();
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 17. Revert Replacement
    if (action === 'revert_replacement') {
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      var frSheet = frSs.getSheetByName("RENEW") || frSs.getSheetByName("FAMRENEW");
      var khoRenewSheet = frSs.getSheetByName("KHO_RENEW");
      var historySheet = frSs.getSheetByName("REPLACE_HISTORY");
      
      var timestamp = String(data.timestamp).trim();
      var stt = String(data.stt).trim();
      
      if (frSheet && khoRenewSheet && historySheet) {
        var historyRange = historySheet.getDataRange();
        var historyValues = historyRange.getValues();
        var histRowIdx = -1;
        var record = null;
        
        for (var i = 1; i < historyValues.length; i++) {
          var rowTime = formatCellDateTime(historyValues[i][0]);
          if (rowTime === timestamp && String(historyValues[i][1]).trim() === stt) {
            histRowIdx = i + 1;
            record = {
              oldEmail: String(historyValues[i][2]).trim(),
              oldPass: String(historyValues[i][3]).trim(),
              oldMkp: String(historyValues[i][4]).trim(),
              old2fa: String(historyValues[i][5]).trim(),
              newEmail: String(historyValues[i][6]).trim()
            };
            break;
          }
        }
        
        if (record && histRowIdx !== -1) {
          // 1. Khôi phục RENEW_MODIFIED
          updateRenewModifiedRow(frSs, stt, {
            status: "Đang dùng",
            email: record.oldEmail,
            pass: record.oldPass,
            mkp: record.oldMkp,
            twofa: record.old2fa,
            notes: "Hoàn tác thay thế ngày " + new Date().toLocaleDateString('vi-VN')
          });
          
          // 2. Khôi phục KHO_RENEW: Đặt Fam mới về Sẵn sàng
          var khoRange = khoRenewSheet.getDataRange();
          var khoValues = khoRange.getValues();
          for (var k = 1; k < khoValues.length; k++) {
            if (String(khoValues[k][0]).trim().toLowerCase() === record.newEmail.toLowerCase()) {
              khoRenewSheet.getRange(k + 1, 7).setValue("Sẵn sàng");
              khoRenewSheet.getRange(k + 1, 8).setValue("");
              break;
            }
          }
          
          // Đặt Fam cũ về Đã dùng (nếu có)
          if (record.oldEmail) {
            for (var k = 1; k < khoValues.length; k++) {
              if (String(khoValues[k][0]).trim().toLowerCase() === record.oldEmail.toLowerCase()) {
                khoRenewSheet.getRange(k + 1, 7).setValue("Đã dùng");
                khoRenewSheet.getRange(k + 1, 8).setValue(stt);
                break;
              }
            }
          }
          
          // 3. Cập nhật trạng thái lịch sử
          historySheet.getRange(histRowIdx, 14).setValue("Đã hoàn tác");
          logToKiemSoatRN(frSs, stt, "Hoàn tác thay thế", record.newEmail, record.oldEmail, "Đang dùng", "", "DNC", "Hoàn tác về " + record.oldEmail);
          
          syncFamHienTaiToKhoRenew();
          return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Không tìm thấy bản ghi lịch sử.'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 18. Update History Item
    if (action === 'update_history_item') {
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      var frSheet = frSs.getSheetByName("RENEW") || frSs.getSheetByName("FAMRENEW");
      var khoRenewSheet = frSs.getSheetByName("KHO_RENEW");
      var historySheet = frSs.getSheetByName("REPLACE_HISTORY");
      
      var timestamp = String(data.timestamp).trim();
      var stt = String(data.stt).trim();
      
      var newEmail = String(data.newEmail || '').trim();
      var newPass = String(data.newPass || '').trim();
      var newMkp = String(data.newMkp || '').trim();
      var new2fa = String(data.new2fa || '').trim();
      var expiryDate = String(data.expiryDate || '').trim();
      var notes = String(data.notes || '').trim();
      
      if (historySheet) {
        var historyRange = historySheet.getDataRange();
        var historyValues = historyRange.getValues();
        var histRowIdx = -1;
        
        for (var i = 1; i < historyValues.length; i++) {
          var rowTime = formatCellDateTime(historyValues[i][0]);
          if (rowTime === timestamp && String(historyValues[i][1]).trim() === stt) {
            histRowIdx = i + 1;
            break;
          }
        }
        
        if (histRowIdx !== -1) {
          var oldNewEmail = String(historyValues[histRowIdx - 1][6]).trim();
          
          // Cập nhật REPLACE_HISTORY
          if (newEmail) historySheet.getRange(histRowIdx, 7).setValue(newEmail);
          historySheet.getRange(histRowIdx, 8).setValue(newPass);
          historySheet.getRange(histRowIdx, 9).setValue(newMkp);
          historySheet.getRange(histRowIdx, 10).setValue(new2fa);
          if (expiryDate) historySheet.getRange(histRowIdx, 11).setValue(expiryDate);
          historySheet.getRange(histRowIdx, 13).setValue(notes);
          
          // Nếu email này đang active ở RENEW, cập nhật luôn ở RENEW_MODIFIED
          if (frSheet) {
            updateRenewModifiedRow(frSs, stt, {
              email: newEmail,
              pass: newPass,
              mkp: newMkp,
              twofa: new2fa,
              expiryDate: expiryDate || undefined
            });
          }
          
          // Cập nhật KHO_RENEW nếu email mới thay đổi
          if (newEmail.toLowerCase() !== oldNewEmail.toLowerCase()) {
            if (khoRenewSheet) {
              var khoRange = khoRenewSheet.getDataRange();
              var khoValues = khoRange.getValues();
              
              // Set old new email to Sẵn sàng
              for (var k = 1; k < khoValues.length; k++) {
                if (String(khoValues[k][0]).trim().toLowerCase() === oldNewEmail.toLowerCase()) {
                  khoRenewSheet.getRange(k + 1, 7).setValue("Sẵn sàng");
                  khoRenewSheet.getRange(k + 1, 8).setValue("");
                  break;
                }
              }
              // Set new new email to Đã dùng
              for (var k = 1; k < khoValues.length; k++) {
                if (String(khoValues[k][0]).trim().toLowerCase() === newEmail.toLowerCase()) {
                  khoRenewSheet.getRange(k + 1, 7).setValue("Đã dùng");
                  khoRenewSheet.getRange(k + 1, 8).setValue(stt);
                  break;
                }
              }
            }
          } else {
            if (khoRenewSheet) {
              var khoRange = khoRenewSheet.getDataRange();
              var khoValues = khoRange.getValues();
              for (var k = 1; k < khoValues.length; k++) {
                if (String(khoValues[k][0]).trim().toLowerCase() === newEmail.toLowerCase()) {
                  khoRenewSheet.getRange(k + 1, 4).setValue(new2fa);
                  break;
                }
              }
            }
          }
          
          syncFamHienTaiToKhoRenew();
          return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Lỗi cập nhật lịch sử.'})).setMimeType(ContentService.MimeType.JSON);
    }

    // 18.1 Get Status History
    if (action === 'get_status_history') {
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      var statusSheet = frSs.getSheetByName("STATUS_HISTORY");
      if (!statusSheet) {
        statusSheet = frSs.insertSheet("STATUS_HISTORY");
        statusSheet.appendRow(["Thời Gian", "STT FAM", "Email", "Trạng Thái Mới", "Người Thực Hiện", "Ghi Chú"]);
        statusSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#f3f3f3");
      }
      
      var dataRange = statusSheet.getDataRange();
      var values = dataRange.getValues();
      var history = [];
      
      for (var i = 1; i < values.length; i++) {
        history.push({
          timestamp: formatCellDateTime(values[i][0]),
          stt: String(values[i][1] || '').trim(),
          email: String(values[i][2] || '').trim(),
          status: String(values[i][3] || '').trim(),
          staff: standardizeStaffName(values[i][4]),
          notes: String(values[i][5] || '').trim()
        });
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success', data: history})).setMimeType(ContentService.MimeType.JSON);
    }

    // 19. Get Replace History
    if (action === 'get_replace_history') {
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      var historySheet = frSs.getSheetByName("REPLACE_HISTORY");
      if (!historySheet) {
        historySheet = frSs.insertSheet("REPLACE_HISTORY");
        historySheet.appendRow(["Thời Gian", "STT FAM", "Email Cũ", "Pass Cũ", "MKP Cũ", "2FA Cũ", "Email Mới", "Mật Khẩu Mới", "MKP Mới", "2FA Mới", "HSD Mới", "Người Thực Hiện", "Ghi Chú", "Trạng Thái"]);
        historySheet.getRange(1, 1, 1, 14).setFontWeight("bold").setBackground("#f3f3f3");
      }
      
      var dataRange = historySheet.getDataRange();
      var values = dataRange.getValues();
      var history = [];
      
      for (var i = 1; i < values.length; i++) {
        history.push({
          timestamp: formatCellDateTime(values[i][0]),
          stt: String(values[i][1] || '').trim(),
          oldEmail: String(values[i][2] || '').trim(),
          oldPass: String(values[i][3] || '').trim(),
          oldMkp: String(values[i][4] || '').trim(),
          old2fa: String(values[i][5] || '').trim(),
          newEmail: String(values[i][6] || '').trim(),
          newPass: String(values[i][7] || '').trim(),
          newMkp: String(values[i][8] || '').trim(),
          new2fa: String(values[i][9] || '').trim(),
          expiryDate: formatCellDate(values[i][10]),
          staff: standardizeStaffName(values[i][11]),
          notes: String(values[i][12] || '').trim(),
          status: String(values[i][13] || 'Hoạt động').trim()
        });
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success', data: history})).setMimeType(ContentService.MimeType.JSON);
    }

    // 20. Bulk Update Status
    if (action === 'bulk_update_status') {
      var emails = data.emails || [];
      var newStatus = String(data.status || 'Banned').trim();
      var notes = data.notes || '';
      var staff = standardizeStaffName(data.staff);
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      
      var modSheet = frSs.getSheetByName("RENEW_MODIFIED");
      var frSheet = frSs.getSheetByName("RENEW") || frSs.getSheetByName("FAMRENEW");
      var khoRenewSheet = frSs.getSheetByName("KHO_RENEW");
      
      var statusHistorySheet = frSs.getSheetByName("STATUS_HISTORY");
      if (!statusHistorySheet) {
        statusHistorySheet = frSs.insertSheet("STATUS_HISTORY");
        statusHistorySheet.appendRow(["Thời Gian", "STT FAM", "Email", "Trạng Thái Mới", "Người Thực Hiện", "Ghi Chú"]);
        statusHistorySheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#f3f3f3");
      }
      var timestamp = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
      
      var emailMap = {};
      emails.forEach(function(email) {
        emailMap[String(email).trim().toLowerCase()] = true;
      });
      
      var updatedCount = 0;
      var sttMap = {};
      var loggedEmails = {};
      
      if (frSheet) {
        var targetSheet = modSheet || frSheet;
        var sheetName = frSheet.getName();
        var emailColIndex = (sheetName === 'RENEW') ? 3 : 4;  // Cột D (index 3) vs Cột E (index 4)
        var sttColIndex   = (sheetName === 'RENEW') ? 1 : 2;  // Cột B (index 1) vs Cột C (index 2)
        
        var dataRange = targetSheet.getDataRange();
        var values = dataRange.getValues();
        
        for (var i = 1; i < values.length; i++) {
          var currentEmail = String(values[i][emailColIndex] || '').trim().toLowerCase();
          if (emailMap[currentEmail]) {
            var stt = String(values[i][sttColIndex] || '').trim();
            sttMap[currentEmail] = stt;
            if (stt) {
              var oldNotes = String(values[i][(sheetName === 'RENEW') ? 8 : 9] || '').trim();
              var finalNotes = (oldNotes ? oldNotes + " - " : "") + (notes || (newStatus + " hàng loạt"));
              updateRenewModifiedRow(frSs, stt, {
                status: newStatus,
                notes: finalNotes
              });
            }
            if (!loggedEmails[currentEmail]) {
              statusHistorySheet.appendRow([timestamp, stt || "", currentEmail, newStatus, staff, finalNotes || notes || (newStatus + " hàng loạt")]);
              loggedEmails[currentEmail] = true;
            }
            updatedCount++;
          }
        }
      }
      
      if (khoRenewSheet) {
        var dataRange = khoRenewSheet.getDataRange();
        var values = dataRange.getValues();
        
        for (var j = 1; j < values.length; j++) {
          var currentEmail = String(values[j][0] || '').trim().toLowerCase();
          if (emailMap[currentEmail]) {
            khoRenewSheet.getRange(j + 1, 7).setValue(newStatus); // Cột G: Trạng thái
            if (notes) {
              khoRenewSheet.getRange(j + 1, 9).setValue(notes); // Cột I: Ghi chú
            }
            khoRenewSheet.getRange(j + 1, 10).setValue(staff); // Cột J: Người làm
            if (!loggedEmails[currentEmail]) {
              var sttVal = sttMap[currentEmail] || String(values[j][7] || '').trim(); // Cột H: Fam hiện tại
              statusHistorySheet.appendRow([timestamp, sttVal || "", currentEmail, newStatus, staff, notes || (newStatus + " hàng loạt")]);
              logToKiemSoatRN(frSs, sttVal || "", "Cập nhật trạng thái", currentEmail, currentEmail, newStatus, "", staff, notes || (newStatus + " hàng loạt"));
              loggedEmails[currentEmail] = true;
            }
            updatedCount++;
          }
        }
      }
      
      syncFamHienTaiToKhoRenew();
      return ContentService.createTextOutput(JSON.stringify({status: 'success', updatedCount: updatedCount})).setMimeType(ContentService.MimeType.JSON);
    }

    // 21. Get Kiem Soat RN (Hệ thống kiểm soát định danh RN - Nhật ký & Timeline)
    if (action === 'get_kiem_soat_rn') {
      var frSs = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
      
      // Tự động phát hiện và track thay đổi email ở cột D sheet RENEW
      trackRenewEmailChanges(frSs);
      
      var trackingSheet = frSs.getSheetByName("KIEM_SOAT_RN");
      if (!trackingSheet) {
        trackingSheet = frSs.insertSheet("KIEM_SOAT_RN");
        trackingSheet.appendRow(["Thời Gian", "Định Danh RN", "Sự Kiện", "Email Cũ", "Email Mới", "Trạng Thái", "HSD", "Người Thực Hiện", "Ghi Chú Chi Tiết"]);
        trackingSheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#e0e7ff").setFontColor("#1e1b4b");
        trackingSheet.setFrozenRows(1);
      }
      
      // Nếu sheet mới tạo hoặc chỉ có dòng tiêu đề, tiến hành tự động migration dữ liệu từ REPLACE_HISTORY và STATUS_HISTORY
      if (trackingSheet.getLastRow() <= 1) {
        var migratedRows = [];
        
        var replaceSheet = frSs.getSheetByName("REPLACE_HISTORY");
        if (replaceSheet && replaceSheet.getLastRow() > 1) {
          var repVals = replaceSheet.getRange(2, 1, replaceSheet.getLastRow() - 1, replaceSheet.getLastColumn()).getValues();
          for (var r = 0; r < repVals.length; r++) {
            var ts = formatCellDateTime(repVals[r][0]);
            var stt = String(repVals[r][1] || '').trim();
            if (stt) {
              var rawTs = 0;
              try {
                var parts = ts.split(' ');
                var dParts = parts[0].split('/');
                if (dParts.length === 3) {
                  rawTs = new Date(parseInt(dParts[2]), parseInt(dParts[1])-1, parseInt(dParts[0])).getTime();
                }
              } catch(err) {}
              
              migratedRows.push({
                rawDate: rawTs || r,
                row: [
                  ts,
                  stt,
                  "Thay mới tài khoản",
                  String(repVals[r][2] || '').trim(),
                  String(repVals[r][6] || '').trim(),
                  String(repVals[r][13] || 'Đang dùng').trim(),
                  formatCellDate(repVals[r][10]),
                  standardizeStaffName(repVals[r][11]),
                  String(repVals[r][12] || '').trim()
                ]
              });
            }
          }
        }
        
        var statusSheet = frSs.getSheetByName("STATUS_HISTORY");
        if (statusSheet && statusSheet.getLastRow() > 1) {
          var statVals = statusSheet.getRange(2, 1, statusSheet.getLastRow() - 1, statusSheet.getLastColumn()).getValues();
          for (var s = 0; s < statVals.length; s++) {
            var tsStat = formatCellDateTime(statVals[s][0]);
            var sttStat = String(statVals[s][1] || '').trim();
            var emailStat = String(statVals[s][2] || '').trim();
            if (sttStat || emailStat) {
              var rawTsStat = 0;
              try {
                var partsS = tsStat.split(' ');
                var dPartsS = partsS[0].split('/');
                if (dPartsS.length === 3) {
                  rawTsStat = new Date(parseInt(dPartsS[2]), parseInt(dPartsS[1])-1, parseInt(dPartsS[0])).getTime();
                }
              } catch(err) {}
              
              migratedRows.push({
                rawDate: rawTsStat || (100000 + s),
                row: [
                  tsStat,
                  sttStat || "N/A",
                  "Cập nhật trạng thái",
                  emailStat,
                  emailStat,
                  String(statVals[s][3] || '').trim(),
                  "-",
                  standardizeStaffName(statVals[s][4]),
                  String(statVals[s][5] || '').trim()
                ]
              });
            }
          }
        }
        
        if (migratedRows.length > 0) {
          migratedRows.sort(function(a, b) { return a.rawDate - b.rawDate; });
          var appendData = migratedRows.map(function(m) { return m.row; });
          trackingSheet.getRange(2, 1, appendData.length, 9).setValues(appendData);
        }
      }
      
      var dataRange = trackingSheet.getDataRange();
      var values = dataRange.getValues();
      var history = [];
      
      for (var i = 1; i < values.length; i++) {
        var rnVal = String(values[i][1] || '').trim();
        var newEmailVal = String(values[i][4] || '').trim();
        if (!rnVal || rnVal.toLowerCase() === 'stt fam' || rnVal.toLowerCase() === 'stt' || rnVal.toLowerCase() === 'định danh rn' || rnVal.toLowerCase() === 'slot' || rnVal === 'N/A' || newEmailVal.includes('GMT+') || newEmailVal.includes('Indochina Time')) continue;
        history.push({
          timestamp: formatCellDateTime(values[i][0]),
          rn: rnVal,
          eventType: String(values[i][2] || '').trim(),
          oldEmail: String(values[i][3] || '').trim(),
          newEmail: newEmailVal,
          status: String(values[i][5] || '').trim(),
          expiryDate: formatCellDate(values[i][6]),
          staff: standardizeStaffName(values[i][7]),
          notes: String(values[i][8] || '').trim()
        });
      }
      
      // Lấy danh sách Định Danh gốc từ RENEW / FAMRENEW (Cột B là định danh RN, Cột D là Email hiện tại)
      var renewSheet = frSs.getSheetByName("RENEW") || frSs.getSheetByName("FAMRENEW");
      var renewList = [];
      if (renewSheet) {
        var rVals = renewSheet.getDataRange().getValues();
        if (rVals.length > 2) {
          var rHeaders = rVals[1]; // Dòng 2 (index 1) là dòng tên cột thực sự
          var sttColIdx = -1;
          var emailColIdx = -1;
          var statColIdx = -1;
          var expColIdx = -1;
          for (var c = 0; c < rHeaders.length; c++) {
            var h = String(rHeaders[c]).toLowerCase();
            if (h.includes('stt') || h.includes('fam')) sttColIdx = c;
            if ((h.includes('email') || h.includes('stock') || h === 'stockrenew' || h === 'renew') && !h.includes('ngày') && !h.includes('ngay') && !h.includes('hsd') && !h.includes('date')) emailColIdx = c;
            if (h.includes('trạng thái') || h.includes('trang thai') || h.includes('status')) statColIdx = c;
            if (h.includes('ngày') || h.includes('ngay') || h.includes('hsd') || h.includes('exp')) expColIdx = c;
          }
          if (sttColIdx === -1) sttColIdx = 1;     // Cột B
          if (emailColIdx === -1) emailColIdx = 3; // Cột D
          if (statColIdx === -1) statColIdx = 2;   // Cột C
          if (expColIdx === -1) expColIdx = 7;     // Cột H
          
          for (var r = 2; r < rVals.length; r++) { // Bỏ qua 2 dòng trên (dòng 0 là note "7", dòng 1 là tiêu đề)
            var sttVal = String(rVals[r][sttColIdx] || '').trim();
            if (sttVal && sttVal.toLowerCase() !== 'stt fam' && sttVal.toLowerCase() !== 'stt' && sttVal.toLowerCase() !== 'slot') {
              renewList.push({
                rn: sttVal,
                email: String(rVals[r][emailColIdx] || '').trim(),
                status: String(rVals[r][statColIdx] || 'Đang dùng').trim(),
                expiryDate: formatCellDate(rVals[r][expColIdx])
              });
            }
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success', data: history, renewList: renewList})).setMimeType(ContentService.MimeType.JSON);
    }

    // 22. Rebuild Kiem Soat RN (Đã vô hiệu hóa để tránh mất dữ liệu lịch sử)
    if (action === 'rebuild_kiem_soat_rn') {
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Chức năng đồng bộ lại từ đầu (Rebuild) đã bị vô hiệu hóa để bảo vệ dữ liệu lịch sử.'})).setMimeType(ContentService.MimeType.JSON);
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

// 15. Hàm Trigger onEdit tự động note ghi chú khi đổi trạng thái lỗi ở cột G (sheet KHO_RENEW)
function onEdit(e) {
  if (!e) return;
  
  var lock = LockService.getDocumentLock();
  try {
    // Chờ tối đa 5 giây để lấy khóa chống ghi đè đồng thời
    if (lock.tryLock(5000)) {
      var range = e.range;
      var sheet = range.getSheet();
      var sheetName = sheet.getName();
      var row = range.getRow();
      var col = range.getColumn();
      
      // Tự động đối chiếu đồng bộ FAM HIỆN TẠI (Cột H của KHO_RENEW) từ RENEW
      if (sheetName === "KHO_RENEW" || sheetName === "RENEW" || sheetName === "FAMRENEW") {
        syncFamHienTaiToKhoRenew();
      }
      
      // Bỏ qua dòng tiêu đề (dòng 1)
      if (row === 1) return;
      
      // Chỉ chạy trên sheet KHO_RENEW và cột G (cột 7)
      if (sheetName === "KHO_RENEW" && col === 7) {
        var newValue = String(e.value || '').trim();
        
        // Các trạng thái bình thường (không cần note lý do lỗi)
        var normalStatuses = ["sẵn sàng", "đã dùng", "đã ghép", ""];
        var isError = normalStatuses.indexOf(newValue.toLowerCase()) === -1;
        
        if (isError) {
          // Hiển thị hộp thoại Input Box nhập lý do lỗi trực tiếp trên Google Sheets
          var note = Browser.inputBox(
            "⚠️ Trạng thái đặc biệt: " + newValue,
            "Nhập lý do lỗi hoặc ghi chú cho tài khoản này (hoặc Cancel):",
            Browser.Buttons.OK_CANCEL
          );
          
          if (note !== "cancel" && note.trim() !== "") {
            // Kiểm tra cột I (cột 9) xem đã có tiêu đề "Ghi chú" chưa
            var headerCell = sheet.getRange(1, 9);
            if (headerCell.getValue() === "") {
              headerCell.setValue("Ghi chú").setFontWeight("bold");
            }
            // Ghi nội dung note vào cột I (cột 9)
            sheet.getRange(row, 9).setValue(note.trim());
          }
        } else {
          // Nếu chuyển về Sẵn sàng/Đã dùng hoặc xóa trạng thái -> Tự động xóa ghi chú cũ ở cột I
          sheet.getRange(row, 9).setValue("");
        }
      }
    }
  } catch (error) {
    Logger.log("Lỗi trong onEdit: " + error.toString());
  } finally {
    lock.releaseLock();
  }
}

// 16. Hàm tự động đối chiếu KHO_RENEW sang RENEW để lấy STT FAM điền vào FAM HIỆN TẠI (Cột H / Cột 8)
// ĐÃ VÔ HIỆU HÓA - Chỉ dùng 1 lần để sync ban đầu, không cần chạy tự động nữa
function syncFamHienTaiToKhoRenew() {
  return; // Disabled
  var ss = SpreadsheetApp.openById('1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc');
  
  // Tự động theo dõi thay đổi Email ở cột D sheet RENEW (do hàm hoặc thao tác) vào sheet KIEM_SOAT_RN
  trackRenewEmailChanges(ss);
  
  var modSheet = ss.getSheetByName("RENEW_MODIFIED");
  var renewSheet = ss.getSheetByName("RENEW") || ss.getSheetByName("FAMRENEW");
  var khoRenewSheet = ss.getSheetByName("KHO_RENEW");
  
  if (!renewSheet || !khoRenewSheet) return;
  
  // 1. Đọc dữ liệu từ RENEW_MODIFIED (ưu tiên) hoặc RENEW
  var targetSheet = modSheet || renewSheet;
  var renewRange = targetSheet.getDataRange();
  var renewValues = renewRange.getValues();
  var renewHeaders = renewValues[0];
  
  // Tìm cột STT FAM và Email/StockRenew ở sheet RENEW
  var kSttIndex = -1;
  var kEmailIndex = -1;
  for (var c = 0; c < renewHeaders.length; c++) {
    var h = String(renewHeaders[c]).toLowerCase();
    if (h.includes('stt') || h.includes('fam')) {
      kSttIndex = c;
    }
    if ((h.includes('email') || h.includes('stock') || h === 'stockrenew' || h === 'renew') && !h.includes('ngày') && !h.includes('ngay') && !h.includes('hsd') && !h.includes('date')) {
      kEmailIndex = c;
    }
  }
  
  // Nếu không tìm thấy cột thì dùng index mặc định
  if (kSttIndex === -1) kSttIndex = 1; // Cột B
  if (kEmailIndex === -1) kEmailIndex = 3; // Cột D
  
  // Tạo map từ email sang STT FAM
  var emailToFamMap = {};
  var startRowRenew = (targetSheet.getName() === 'RENEW' || targetSheet.getName() === 'FAMRENEW') ? 2 : 1;
  for (var i = startRowRenew; i < renewValues.length; i++) {
    var rawEmail = String(renewValues[i][kEmailIndex] || '').trim().toLowerCase();
    var sttFam = String(renewValues[i][kSttIndex] || '').trim();
    if (rawEmail && sttFam && sttFam.toLowerCase() !== 'stt fam' && sttFam.toLowerCase() !== 'stt') {
      // Chuẩn hóa email: bỏ phần @gmail.com nếu có để đối chiếu chính xác
      var cleanEmail = rawEmail.replace(/@gmail\.com$/, '');
      if (cleanEmail) {
        emailToFamMap[cleanEmail] = sttFam;
      }
    }
  }
  
  // Đọc từ RENEW_MODIFIED đè lên (nếu có)
  var modSheet = ss.getSheetByName("RENEW_MODIFIED");
  if (modSheet) {
    var modValues = modSheet.getDataRange().getValues();
    for (var i = 1; i < modValues.length; i++) {
      var rawEmail = String(modValues[i][3] || '').trim().toLowerCase(); // Cột StockRenew (index 3)
      var sttFam = String(modValues[i][1] || '').trim();                 // Cột STT FAM (index 1)
      var status = String(modValues[i][2] || '').trim().toLowerCase();    // Cột Trạng thái (index 2)
      if (rawEmail && status !== 'banned') {
        var cleanEmail = rawEmail.replace(/@gmail\.com$/, '');
        if (cleanEmail) {
          emailToFamMap[cleanEmail] = sttFam;
        }
      }
    }
  }
  
  // 2. Đọc dữ liệu từ sheet KHO_RENEW
  var khoRange = khoRenewSheet.getDataRange();
  var khoValues = khoRange.getValues();
  var khoHeaders = khoValues[0];
  
  // Tìm cột Email và cột FAM HIỆN TẠI ở sheet KHO_RENEW
  var khoEmailIndex = -1;
  var khoFamHienTaiIndex = -1;
  for (var c = 0; c < khoHeaders.length; c++) {
    var h = String(khoHeaders[c]).toLowerCase();
    if (h.includes('email') || h.includes('mail')) {
      khoEmailIndex = c;
    }
    if (h.includes('fam hiện tại') || h.includes('fam hien tai') || h.includes('famfollow')) {
      khoFamHienTaiIndex = c;
    }
  }
  
  // Nếu không tìm thấy cột thì dùng index mặc định
  if (khoEmailIndex === -1) khoEmailIndex = 0; // Cột A
  if (khoFamHienTaiIndex === -1) {
    // Nếu chưa có cột FAM HIỆN TẠI, ta tự tạo tiêu đề ở cột H (index 7, cột 8)
    khoFamHienTaiIndex = 7;
    khoRenewSheet.getRange(1, 8).setValue("FAM HIỆN TẠI").setFontWeight("bold");
  }
  
  var updatedFamHienTaiValues = [];
  var updatedStatusValues = [];
  var isModified = false;
  
  for (var i = 1; i < khoValues.length; i++) {
    var rawEmail = String(khoValues[i][khoEmailIndex] || '').trim().toLowerCase();
    var cleanEmail = rawEmail.replace(/@gmail\.com$/, '');
    
    var currentFamValue = String(khoValues[i][khoFamHienTaiIndex] || '').trim();
    var mappedFamValue = cleanEmail ? (emailToFamMap[cleanEmail] || '') : '';
    
    var currentStatus = String(khoValues[i][6] || '').trim(); // Cột G (index 6, tức cột 7)
    var mappedStatus = currentStatus;
    
    // Các trạng thái thủ công không được sync tự động ghi đè
    var PROTECTED_STATUSES = ["Banned", "Ver lần 1", "Lỗi Pay", "Đã ghép"];
    var isProtected = PROTECTED_STATUSES.indexOf(currentStatus) !== -1;
    
    if (mappedFamValue) {
      // Có Fam đang dùng → chỉ set Đã dùng nếu chưa phải và không bị protected
      if (!isProtected && currentStatus !== "Đã dùng") {
        mappedStatus = "Đã dùng";
      }
    } else {
      // Không tìm thấy mapping → chỉ reset về Sẵn sàng nếu đúng là "Đã dùng" (không protected)
      // KHÔNG reset nếu là các trạng thái thủ công như Banned, Ver lần 1, Lỗi Pay...
      if (currentStatus === "Đã dùng" && !isProtected) {
        mappedStatus = "Sẵn sàng";
      }
    }
    
    if (currentFamValue !== mappedFamValue || currentStatus !== mappedStatus) {
      isModified = true;
    }
    
    updatedFamHienTaiValues.push([mappedFamValue]);
    updatedStatusValues.push([mappedStatus]);
  }
  
  // 3. Ghi đè hàng loạt vào cột FAM HIỆN TẠI và TRẠNG THÁI nếu có thay đổi
  if (isModified && updatedFamHienTaiValues.length > 0) {
    var writeRangeFam = khoRenewSheet.getRange(2, khoFamHienTaiIndex + 1, updatedFamHienTaiValues.length, 1);
    writeRangeFam.setValues(updatedFamHienTaiValues);
    
    var writeRangeStatus = khoRenewSheet.getRange(2, 7, updatedStatusValues.length, 1); // Cột G (cột 7)
    writeRangeStatus.setValues(updatedStatusValues);
  }
}

// Tự động phát hiện và theo dõi khi cột D (Email) của định danh RN (cột B) trong sheet RENEW thay đổi do hàm/thao tác
function trackRenewEmailChanges(ss) {
  try {
    var renewSheet = ss.getSheetByName("RENEW") || ss.getSheetByName("FAMRENEW");
    if (!renewSheet) return;
    
    var renewValues = renewSheet.getDataRange().getValues();
    if (renewValues.length <= 1) return;
    
    var headers = renewValues.length > 1 ? renewValues[1] : renewValues[0];
    var sttCol = -1;
    var emailCol = -1;
    for (var c = 0; c < headers.length; c++) {
      var h = String(headers[c]).toLowerCase();
      if (h.includes('stt') || h.includes('fam')) sttCol = c;
      if ((h.includes('email') || h.includes('stock') || h === 'stockrenew' || h === 'renew') && !h.includes('ngày') && !h.includes('ngay') && !h.includes('hsd') && !h.includes('date')) emailCol = c;
    }
    if (sttCol === -1) sttCol = 1;   // Cột B
    if (emailCol === -1) emailCol = 3; // Cột D
    
    var trackingSheet = ss.getSheetByName("KIEM_SOAT_RN");
    if (!trackingSheet) {
      trackingSheet = ss.insertSheet("KIEM_SOAT_RN");
      trackingSheet.appendRow(["Thời Gian", "Định Danh RN", "Sự Kiện", "Email Cũ", "Email Mới", "Trạng Thái", "HSD", "Người Thực Hiện", "Ghi Chú Chi Tiết"]);
      trackingSheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#e0e7ff").setFontColor("#1e1b4b");
      trackingSheet.setFrozenRows(1);
    }
    
    var trackValues = trackingSheet.getDataRange().getValues();
    var latestEmailInHistory = {};
    var rowsToDelete = [];
    
    for (var i = 1; i < trackValues.length; i++) {
      var rnKey = String(trackValues[i][1] || '').trim();
      var newEmail = String(trackValues[i][4] || '').trim();
      var oldEmail = String(trackValues[i][3] || '').trim();
      if (rnKey.toLowerCase() === 'stt fam' || rnKey.toLowerCase() === 'stt' || rnKey.toLowerCase() === 'định danh rn' || rnKey.toLowerCase() === 'slot' || newEmail.includes('GMT+') || oldEmail.includes('GMT+') || newEmail.includes('Indochina Time') || oldEmail.includes('Indochina Time')) {
        rowsToDelete.push(i + 1);
      } else if (rnKey) {
        if (newEmail) {
          latestEmailInHistory[rnKey] = newEmail.toLowerCase();
        } else if (oldEmail) {
          latestEmailInHistory[rnKey] = oldEmail.toLowerCase();
        }
      }
    }
    
    // Tự động dọn dẹp các dòng tiêu đề bị ghi nhầm vào sheet KIEM_SOAT_RN
    for (var d = rowsToDelete.length - 1; d >= 0; d--) {
      try { trackingSheet.deleteRow(rowsToDelete[d]); } catch(err) {}
    }
    
    var newLogs = [];
    var timestamp = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
    
    for (var r = 2; r < renewValues.length; r++) { // Bỏ qua 2 dòng trên (dòng 0 note "7", dòng 1 tiêu đề)
      var stt = String(renewValues[r][sttCol] || '').trim();
      var currentEmail = String(renewValues[r][emailCol] || '').trim();
      if (stt && currentEmail && stt.toLowerCase() !== 'stt fam' && stt.toLowerCase() !== 'stt' && stt.toLowerCase() !== 'slot') {
        var cleanCurrent = currentEmail.toLowerCase();
        var recordedLatest = latestEmailInHistory[stt];
        
        if (recordedLatest && recordedLatest !== cleanCurrent) {
          newLogs.push([
            timestamp,
            stt,
            "Thay đổi tài khoản (từ RENEW)",
            recordedLatest,
            currentEmail,
            "Đang dùng",
            formatCellDate(renewValues[r][7]),
            "Hệ thống / Hàm",
            "Tự động track thay đổi email cột D sheet RENEW"
          ]);
          latestEmailInHistory[stt] = cleanCurrent;
        } else if (!recordedLatest) {
          newLogs.push([
            timestamp,
            stt,
            "Ghi nhận ban đầu (từ RENEW)",
            "",
            currentEmail,
            "Đang dùng",
            formatCellDate(renewValues[r][7]),
            "Hệ thống",
            "Khởi tạo theo dõi định danh RN theo bảng RENEW"
          ]);
          latestEmailInHistory[stt] = cleanCurrent;
        }
      }
    }
    
    if (newLogs.length > 0) {
      trackingSheet.getRange(trackingSheet.getLastRow() + 1, 1, newLogs.length, 9).setValues(newLogs);
    }
  } catch (err) {
    Logger.log("Error in trackRenewEmailChanges: " + err.toString());
  }
}

// Helper to get or create RENEW_MODIFIED sheet
function getOrCreateRenewModifiedSheet(ss) {
  var sheet = ss.getSheetByName("RENEW_MODIFIED");
  if (!sheet) {
    sheet = ss.insertSheet("RENEW_MODIFIED");
    sheet.appendRow(["Slot", "STT FAM", "Trạng thái", "StockRenew", "Pass", "MKP", "2fa", "Ngày Renew", "Ghi chú"]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#e6f7ff");
  }
  return sheet;
}

// Helper to update or insert override row in RENEW_MODIFIED sheet
function updateRenewModifiedRow(ss, stt, updatedData) {
  var renewSheet = ss.getSheetByName("RENEW") || ss.getSheetByName("FAMRENEW");
  var modSheet = getOrCreateRenewModifiedSheet(ss);
  
  var renewValues = renewSheet.getDataRange().getValues();
  var modValues = modSheet.getDataRange().getValues();
  
  var hdRow = renewValues.length > 1 ? renewValues[1] : renewValues[0];
  var sttColIdxRenew = -1;
  for (var c = 0; c < hdRow.length; c++) {
    var h = String(hdRow[c]).toLowerCase();
    if (h.includes('stt') || h.includes('fam')) {
      sttColIdxRenew = c;
      break;
    }
  }
  if (sttColIdxRenew === -1) sttColIdxRenew = 1; // default B
  
  // Find original row in RENEW
  var originalRow = null;
  for (var i = 2; i < renewValues.length; i++) {
    if (String(renewValues[i][sttColIdxRenew]).trim() === stt) {
      originalRow = renewValues[i];
      break;
    }
  }
  
  if (!originalRow) return false;
  
  // Find if row exists in RENEW_MODIFIED
  var modRowIdx = -1;
  for (var j = 1; j < modValues.length; j++) {
    if (String(modValues[j][1]).trim() === stt) {
      modRowIdx = j + 1;
      break;
    }
  }
  
  // Construct the updated row values matching columns: Slot, STT FAM, Trạng thái, StockRenew, Pass, MKP, 2fa, Ngày Renew, Ghi chú
  var rowValues = [
    originalRow[0], // Slot (col A)
    stt,            // STT FAM (col B)
    updatedData.status !== undefined ? updatedData.status : (originalRow[2] || "Đang dùng"),
    updatedData.email !== undefined ? updatedData.email : originalRow[3],
    updatedData.pass !== undefined ? updatedData.pass : originalRow[4],
    updatedData.mkp !== undefined ? updatedData.mkp : originalRow[5],
    updatedData.twofa !== undefined ? updatedData.twofa : originalRow[6],
    updatedData.expiryDate !== undefined ? updatedData.expiryDate : originalRow[7],
    updatedData.notes !== undefined ? updatedData.notes : originalRow[8]
  ];
  
  if (modRowIdx !== -1) {
    modSheet.getRange(modRowIdx, 1, 1, 9).setValues([rowValues]);
  } else {
    modSheet.appendRow(rowValues);
  }
  return true;
}

function formatCellDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, "GMT+7", "dd/MM/yyyy");
  }
  var str = String(val).trim();
  if (str.includes('GMT+') || str.includes('Indochina Time') || str.match(/^[a-zA-Z]{3} [a-zA-Z]{3} \d{2} \d{4}/)) {
    try {
      var d = new Date(str);
      if (!isNaN(d.getTime())) {
        return Utilities.formatDate(d, "GMT+7", "dd/MM/yyyy");
      }
    } catch(err) {}
  }
  return str;
}

function formatCellDateTime(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, "GMT+7", "dd/MM/yyyy HH:mm:ss");
  }
  var str = String(val).trim();
  if (str.includes('GMT+') || str.includes('Indochina Time') || str.match(/^[a-zA-Z]{3} [a-zA-Z]{3} \d{2} \d{4}/)) {
    try {
      var d = new Date(str);
      if (!isNaN(d.getTime())) {
        return Utilities.formatDate(d, "GMT+7", "dd/MM/yyyy HH:mm:ss");
      }
    } catch(err) {}
  }
  return str;
}

function standardizeStaffName(staff) {
  var s = String(staff || '').trim();
  if (!s || s.toLowerCase() === 'admin' || s.toLowerCase() === 'dnc operator' || s.toLowerCase() === 'dnc') {
    return 'DNC';
  }
  if (s.toLowerCase() === 'goshop1' || s.toLowerCase() === 'staff' || s.toLowerCase() === 'lộc' || s.toLowerCase() === 'loc') {
    return 'Lộc';
  }
  return s;
}

function logToKiemSoatRN(frSs, stt, eventType, oldEmail, newEmail, status, expiryDate, staff, notes) {
  try {
    var sheet = frSs.getSheetByName("KIEM_SOAT_RN");
    if (!sheet) {
      sheet = frSs.insertSheet("KIEM_SOAT_RN");
      sheet.appendRow(["Thời Gian", "Định Danh RN", "Sự Kiện", "Email Cũ", "Email Mới", "Trạng Thái", "HSD", "Người Thực Hiện", "Ghi Chú Chi Tiết"]);
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#e0e7ff").setFontColor("#1e1b4b");
      sheet.setFrozenRows(1);
    }
    var timestamp = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
    sheet.appendRow([timestamp, String(stt || '').trim(), String(eventType || '').trim(), String(oldEmail || '').trim(), String(newEmail || '').trim(), String(status || '').trim(), String(expiryDate || '').trim(), standardizeStaffName(staff), String(notes || '').trim()]);
  } catch (e) {
    Logger.log("Error logging to KIEM_SOAT_RN: " + e.toString());
  }
}
