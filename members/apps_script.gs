/**
 * GO SHOP MEMBER SYSTEM - GOOGLE APPS SCRIPT BACKEND
 * Sheet target: MB_INVENTORY, MB_PRODUCTS, MB_ORDERS, MB_WALLET_LOG, MB_USERS, etc.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents || '{}');
    var action = data.action;

    // --- 1. ACTION: REGISTER USER (MB_USERS) ---
    if (action === 'register_user') {
      return registerUser(data.email, data.passwordHash, data.displayName, data.phone);
    }

    // --- 2. ACTION: LOGIN USER (MB_USERS) ---
    if (action === 'login_user') {
      return loginUser(data.email, data.passwordHash);
    }

    // --- 3. ACTION: CHECK EMAIL EXISTS (MB_USERS) ---
    if (action === 'check_email_exists') {
      return checkEmailExists(data.email);
    }

    // --- 4. ACTION: TOGGLE USER STATUS (ADMIN) ---
    if (action === 'toggle_user_status') {
      return toggleUserStatus(data.userId, data.status);
    }

    // --- 5. ACTION: RESET USER PASSWORD (ADMIN) ---
    if (action === 'reset_user_password') {
      return resetUserPassword(data.userId, data.newPasswordHash);
    }

    // --- 6. ACTION: SAVE PRODUCT (WITH SALE FIELDS & END DATE) ---
    if (action === 'save_product') {
      return saveProduct(data.productData);
    }

    // --- 7. ACTION: PURCHASE PRODUCT (WITH SALE & FREE LOGIC) ---
    if (action === 'purchase_product') {
      return purchaseProduct(data.email, data.productId);
    }

    // --- 8. ACTION: BULK ADD INVENTORY ---
    if (action === 'bulk_add_inventory' || action === 'add_inventory_bulk') {
      var result = addInventoryBulk(
        data.productId,
        data.items || [],
        data.slotType,
        data.maxUsers,
        data.expireDate
      );
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- 9. ACTION: INIT MEMBER SHEETS ---
    if (action === 'init_member_sheets') {
      var initResult = initMemberSheets();
      return ContentService.createTextOutput(JSON.stringify(initResult)).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Action không hợp lệ: ' + action })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function saveProduct(productData) {
  Logger.log('>>> [saveProduct] Input productData: ' + JSON.stringify(productData));

  if (!productData || !productData.name) {
    return responseJSON({ status: 'error', message: 'Dữ liệu sản phẩm không hợp lệ' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var prodSheet = ss.getSheetByName('MB_PRODUCTS');
  var expectedHeaders = ["id", "name", "description", "price", "type", "category", "status", "created_at", "slot_type", "guide_url", "sale_type", "sale_price", "sale_label", "sale_end_date"];

  if (!prodSheet) {
    prodSheet = ss.insertSheet('MB_PRODUCTS');
    prodSheet.appendRow(expectedHeaders);
  } else {
    // Đảm bảo hàng 1 luôn đủ 14 tiêu đề chuẩn để Google Sheets GViz CSV xuất đúng tên cột
    var currentHeaders = prodSheet.getRange(1, 1, 1, 14).getValues()[0];
    var needUpdateHeader = false;
    for (var h = 0; h < expectedHeaders.length; h++) {
      if (String(currentHeaders[h] || '').trim() !== expectedHeaders[h]) {
        currentHeaders[h] = expectedHeaders[h];
        needUpdateHeader = true;
      }
    }
    if (needUpdateHeader) {
      prodSheet.getRange(1, 1, 1, 14).setValues([currentHeaders]);
    }
  }

  var prodData = prodSheet.getDataRange().getValues();
  var existingRow = -1;

  for (var i = 1; i < prodData.length; i++) {
    if (productData.id && String(prodData[i][0]) === String(productData.id)) {
      existingRow = i + 1;
      break;
    }
  }

  var slotType = productData.slot_type || 'rieng';
  var guideUrl = productData.guide_url || '';
  var saleType = String(productData.sale_type || 'none').trim().toLowerCase();
  var salePrice = (productData.sale_price !== undefined && productData.sale_price !== null && String(productData.sale_price).trim() !== '') ? productData.sale_price : '';
  var saleLabel = String(productData.sale_label || '').trim();
  var saleEndDate = String(productData.sale_end_date || '').trim();
  var prodId = productData.id || ('PROD-' + Date.now());

  Logger.log('>>> [saveProduct] Writing 14 fields: ' + JSON.stringify([
    prodId, productData.name, productData.description || '', productData.price || 0, productData.type || 'auto', productData.category || '', productData.status || 'active', new Date().toISOString(), slotType, guideUrl, saleType, salePrice, saleLabel, saleEndDate
  ]));

  if (existingRow > 0) {
    prodSheet.getRange(existingRow, 1, 1, 14).setValues([[
      prodId, productData.name, productData.description || '', productData.price || 0, productData.type || 'auto', productData.category || '', productData.status || 'active', new Date().toISOString(), slotType, guideUrl, saleType, salePrice, saleLabel, saleEndDate
    ]]);
  } else {
    prodSheet.appendRow([prodId, productData.name, productData.description || '', productData.price || 0, productData.type || 'auto', productData.category || '', productData.status || 'active', new Date().toISOString(), slotType, guideUrl, saleType, salePrice, saleLabel, saleEndDate]);
  }

  return responseJSON({ status: 'success', id: prodId });
}

function purchaseProduct(email, productId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return responseJSON({ status: 'error', message: 'Hệ thống đang bận, vui lòng thử lại sau!' });
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var prodSheet = ss.getSheetByName('MB_PRODUCTS');
    var invSheet = ss.getSheetByName('MB_INVENTORY');
    var logSheet = ss.getSheetByName('MB_WALLET_LOG');
    var orderSheet = ss.getSheetByName('MB_ORDERS');

    if (!prodSheet || !invSheet || !logSheet || !orderSheet) {
      return responseJSON({ status: 'error', message: 'Sheet hệ thống chưa khởi tạo đầy đủ' });
    }

    var cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !productId) {
      return responseJSON({ status: 'error', message: 'Thiếu email hoặc productId' });
    }

    // 1. Lấy thông tin sản phẩm & tính effectivePrice
    var prodData = prodSheet.getDataRange().getValues();
    var product = null;
    var now = new Date();

    for (var p = 1; p < prodData.length; p++) {
      if (String(prodData[p][0]) === String(productId)) {
        var rawSaleType = String(prodData[p][10] || 'none').trim().toLowerCase();
        var rawSalePrice = prodData[p][11];
        var rawSaleEndDate = prodData[p][13];
        
        var isSaleValid = rawSaleType !== 'none' && rawSalePrice !== '' && rawSalePrice !== null && rawSalePrice !== undefined;
        if (isSaleValid && rawSaleEndDate) {
          try {
            if (new Date(rawSaleEndDate) < now) {
              isSaleValid = false; // Sale expired!
            }
          } catch(e) {}
        }

        var effectivePrice = parseInt(prodData[p][3]) || 0;
        if (isSaleValid) {
          effectivePrice = parseInt(rawSalePrice);
          if (isNaN(effectivePrice)) effectivePrice = 0;
        }

        product = {
          id: prodData[p][0],
          name: prodData[p][1],
          price: parseInt(prodData[p][3]) || 0,
          effectivePrice: effectivePrice,
          saleType: isSaleValid ? rawSaleType : 'none',
          type: prodData[p][4] || 'auto',
          status: prodData[p][6] || 'active'
        };
        break;
      }
    }

    if (!product || product.status !== 'active') {
      return responseJSON({ status: 'error', message: 'Sản phẩm không khả dụng' });
    }

    // 2. Tính số dư ví hiện tại
    var logData = logSheet.getDataRange().getValues();
    var currentBalance = 0;
    for (var l = 1; l < logData.length; l++) {
      if (String(logData[l][1]).trim().toLowerCase() === cleanEmail) {
        currentBalance += (parseInt(logData[l][3]) || 0);
      }
    }

    if (product.effectivePrice > 0 && currentBalance < product.effectivePrice) {
      return responseJSON({ status: 'error', message: 'Số dư ví không đủ (' + currentBalance + ' < ' + product.effectivePrice + ')' });
    }

    // 3. Tìm slot kho khả dụng
    var invData = invSheet.getDataRange().getValues();
    var targetInvRow = -1;
    var targetInvItem = null;

    for (var i = 1; i < invData.length; i++) {
      var rowProdId = String(invData[i][1]);
      var rowStatus = String(invData[i][4]);
      var rowExpire = invData[i][3] || invData[i][5];

      if (rowProdId === String(productId) && rowStatus === 'available') {
        if (rowExpire && new Date(rowExpire) < now) continue;
        targetInvRow = i + 1;
        targetInvItem = {
          id: invData[i][0],
          itemData: invData[i][2],
          expireDate: invData[i][3] || invData[i][5] || '',
          slotType: invData[i][7] || 'rieng',
          maxUsers: parseInt(invData[i][8]) || 1
        };
        break;
      }
    }

    if (targetInvRow === -1 || !targetInvItem) {
      return responseJSON({ status: 'error', message: 'Sản phẩm đã hết hàng trong kho' });
    }

    // 4. Ghi MB_WALLET_LOG (Nếu FREE effectivePrice === 0 thì amount = 0)
    var newBalance = currentBalance - product.effectivePrice;
    var logId = 'LOG-' + Date.now();
    var logNote = product.effectivePrice === 0 ? 'FREE — Hàng cận date (' + product.name + ')' : 'Mua hàng: ' + product.name;
    logSheet.appendRow([logId, cleanEmail, 'purchase', -product.effectivePrice, newBalance, product.id, logNote, new Date().toISOString()]);

    // 5. Cập nhật trạng thái slot kho
    invSheet.getRange(targetInvRow, 5).setValue('sold');
    invSheet.getRange(targetInvRow, 6).setValue(cleanEmail);
    invSheet.getRange(targetInvRow, 7).setValue(new Date().toISOString());

    // 6. Ghi đơn hàng MB_ORDERS
    var orderId = 'ORD-' + Date.now();
    orderSheet.appendRow([orderId, cleanEmail, product.id, product.name, targetInvItem.id, targetInvItem.itemData, product.effectivePrice, 'completed', new Date().toISOString(), product.effectivePrice === 0 ? 'Miễn phí' : 'Thành công']);

    // 7. Đồng bộ đơn hoàn thành sang DON_HANG_MOI (Không block đơn hàng nếu lỗi)
    syncOrderToDonHangMoi({
      orderId: orderId,
      email: cleanEmail,
      productName: product.name,
      amount: product.effectivePrice,
      expireDate: targetInvItem.expireDate || ''
    });

    return responseJSON({
      status: 'success',
      orderId: orderId,
      productName: product.name,
      itemData: targetInvItem.itemData,
      effectivePrice: product.effectivePrice,
      newBalance: newBalance
    });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * ĐỒNG BỘ ĐƠN HOÀN THÀNH SANG DON_HANG_MOI
 * Dùng LockService độc lập, nếu lỗi ghi NHAT_KY_XU_LY và không rollback đơn hàng.
 */
function syncOrderToDonHangMoi(orderData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    logErrorToNhatKyXuLy('syncOrderToDonHangMoi: Lock timeout - ' + e.toString());
    return;
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dhmSheet = ss.getSheetByName('DON_HANG_MOI');
    if (!dhmSheet) {
      logErrorToNhatKyXuLy('syncOrderToDonHangMoi: Sheet DON_HANG_MOI không tồn tại');
      return;
    }

    var orderId = String(orderData.orderId || '').trim();
    var email = String(orderData.email || '').trim().toLowerCase();
    var productName = String(orderData.productName || '').trim();
    var amount = parseInt(orderData.amount) || 0;
    var rawExpireDate = orderData.expireDate;

    // 1. Fetch Zalo phone from MB_USERS matching email (Cột C)
    var phone = '';
    try {
      var userSheet = ss.getSheetByName('MB_USERS');
      if (userSheet) {
        var uData = userSheet.getDataRange().getValues();
        for (var u = 1; u < uData.length; u++) {
          if (String(uData[u][1]).trim().toLowerCase() === email) {
            phone = String(uData[u][4] || '').trim();
            break;
          }
        }
      }
    } catch (errU) {}

    // 2. Format expireDate & Calculate durationDays (Cột E & J)
    var durationDays = 30;
    var expireDateStr = '';
    if (rawExpireDate) {
      try {
        var expD = new Date(rawExpireDate);
        if (!isNaN(expD.getTime())) {
          expireDateStr = expD.toISOString().split('T')[0];
          var nowD = new Date();
          var diffMs = expD.getTime() - nowD.getTime();
          var calculatedDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          if (calculatedDays > 0) durationDays = calculatedDays;
        } else {
          expireDateStr = String(rawExpireDate).trim();
        }
      } catch (errD) {
        expireDateStr = String(rawExpireDate).trim();
      }
    }

    // 3. Format Date YYYY-MM-DD (Cột H)
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    var dateYYYYMMDD = year + '-' + month + '-' + day;

    // 4. Format full timestamp YYYY-MM-DD HH:mm:ss (Cột L)
    var hours = String(now.getHours()).padStart(2, '0');
    var minutes = String(now.getMinutes()).padStart(2, '0');
    var seconds = String(now.getSeconds()).padStart(2, '0');
    var fullTimestamp = dateYYYYMMDD + ' ' + hours + ':' + minutes + ':' + seconds;

    // Mapping Cột A -> L
    var rowData = [
      orderId,       // A — Mã ĐH
      email,         // B — Email
      phone,         // C — Zalo
      productName,   // D — Sản phẩm
      durationDays,  // E — Thời hạn
      amount,        // F — Số tiền
      'Done',        // G — Trạng thái
      dateYYYYMMDD,  // H — Ngày tạo
      '',            // I — Người giới thiệu
      expireDateStr, // J — HSD
      '',            // K — (trống)
      fullTimestamp  // L — time
    ];

    dhmSheet.appendRow(rowData);
  } catch (err) {
    logErrorToNhatKyXuLy('syncOrderToDonHangMoi error: ' + err.toString());
  } finally {
    try {
      lock.releaseLock();
    } catch(e) {}
  }
}

function logErrorToNhatKyXuLy(errorMsg) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = ss.getSheetByName('NHAT_KY_XU_LY');
    if (!logSheet) {
      logSheet = ss.insertSheet('NHAT_KY_XU_LY');
      logSheet.appendRow(['Timestamp', 'Log Level', 'Message']);
    }
    logSheet.appendRow([new Date().toISOString(), 'ERROR', String(errorMsg)]);
  } catch (e) {
    Logger.log('logErrorToNhatKyXuLy error: ' + e.toString());
  }
}

function registerUser(email, passwordHash, displayName, phone) {
  if (!email || !passwordHash || !phone) {
    return responseJSON({ status: 'error', message: 'Vui lòng nhập đầy đủ email, mật khẩu và số điện thoại' });
  }

  var cleanEmail = String(email).trim().toLowerCase();
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return responseJSON({ status: 'error', message: 'Định dạng email không hợp lệ' });
  }

  var cleanPhone = String(phone).replace(/\s+/g, '').replace(/-/g, '');
  var phoneRegex = /^0\d{9}$/;
  if (!phoneRegex.test(cleanPhone)) {
    return responseJSON({ status: 'error', message: 'Số điện thoại không hợp lệ (cần 10 số, bắt đầu bằng 0)' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName('MB_USERS');
  if (!userSheet) {
    userSheet = ss.insertSheet('MB_USERS');
    userSheet.appendRow(["id", "email", "password_hash", "display_name", "phone", "created_at", "status", "note"]);
    userSheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#e0e7ff");
  }

  var data = userSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim().toLowerCase() === cleanEmail) {
      return responseJSON({ status: 'error', message: 'Email này đã được đăng ký' });
    }
  }

  var userId = 'USR-' + Date.now();
  var name = String(displayName || cleanEmail.split('@')[0]).trim();
  userSheet.appendRow([userId, cleanEmail, String(passwordHash).trim(), name, cleanPhone, new Date().toISOString(), 'active', 'Tự đăng ký']);

  return responseJSON({
    status: 'success',
    message: 'Đăng ký tài khoản thành công',
    userId: userId,
    email: cleanEmail,
    displayName: name,
    phone: cleanPhone
  });
}

function loginUser(email, passwordHash) {
  if (!email || !passwordHash) {
    return responseJSON({ status: 'error', message: 'Vui lòng nhập email và mật khẩu' });
  }

  var cleanEmail = String(email).trim().toLowerCase();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName('MB_USERS');
  if (!userSheet) {
    return responseJSON({ status: 'error', message: 'Email hoặc mật khẩu không đúng' });
  }

  var data = userSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][1]).trim().toLowerCase();
    var rowHash = String(data[i][2]).trim();
    var rowStatus = String(data[i][6] || 'active').trim().toLowerCase();
    var rowName = String(data[i][3] || rowEmail.split('@')[0]).trim();

    if (rowEmail === cleanEmail) {
      if (rowStatus === 'banned') {
        return responseJSON({ status: 'error', message: 'Tài khoản đã bị khóa, liên hệ admin (Zalo 0398.057.191)' });
      }
      if (rowHash === String(passwordHash).trim()) {
        return responseJSON({
          status: 'success',
          email: rowEmail,
          displayName: rowName
        });
      } else {
        return responseJSON({ status: 'error', message: 'Email hoặc mật khẩu không đúng' });
      }
    }
  }

  return responseJSON({ status: 'error', message: 'Email hoặc mật khẩu không đúng' });
}

function checkEmailExists(email) {
  if (!email) return responseJSON({ status: 'success', exists: false });
  var cleanEmail = String(email).trim().toLowerCase();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName('MB_USERS');
  if (!userSheet) return responseJSON({ status: 'success', exists: false });

  var data = userSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim().toLowerCase() === cleanEmail) {
      return responseJSON({ status: 'success', exists: true });
    }
  }
  return responseJSON({ status: 'success', exists: false });
}

function toggleUserStatus(userId, status) {
  if (!userId || !status) return responseJSON({ status: 'error', message: 'Thiếu dữ liệu' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName('MB_USERS');
  if (userSheet) {
    var data = userSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(userId) || String(data[i][1]).toLowerCase() === String(userId).toLowerCase()) {
        userSheet.getRange(i + 1, 7).setValue(status);
        return responseJSON({ status: 'success', message: 'Đã cập nhật trạng thái tài khoản' });
      }
    }
  }
  return responseJSON({ status: 'error', message: 'Không tìm thấy người dùng' });
}

function resetUserPassword(userId, newPasswordHash) {
  if (!userId || !newPasswordHash) return responseJSON({ status: 'error', message: 'Thiếu dữ liệu' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName('MB_USERS');
  if (userSheet) {
    var data = userSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(userId) || String(data[i][1]).toLowerCase() === String(userId).toLowerCase()) {
        userSheet.getRange(i + 1, 3).setValue(newPasswordHash);
        return responseJSON({ status: 'success', message: 'Đã cập nhật mật khẩu thành công' });
      }
    }
  }
  return responseJSON({ status: 'error', message: 'Không tìm thấy người dùng' });
}

function addInventoryBulk(productId, items, slotType, maxUsers, expireDate) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var invSheet = ss.getSheetByName("MB_INVENTORY");
  
  if (!invSheet) {
    invSheet = ss.insertSheet("MB_INVENTORY");
    invSheet.appendRow([
      "id",
      "product_id",
      "item_data",
      "slot_type",
      "max_users",
      "expire_date",
      "status",
      "sold_to_email",
      "sold_at"
    ]);
  }

  if (!productId) {
    return { status: "error", message: "Thiếu productId" };
  }

  slotType = slotType || "rieng";
  maxUsers = parseInt(maxUsers) || (slotType === "gia_dinh" ? 3 : 1);
  expireDate = expireDate || "";

  var addedCount = 0;
  var addedIds = [];

  if (Array.isArray(items)) {
    for (var i = 0; i < items.length; i++) {
      var line = String(items[i] || "").trim();
      if (!line) continue;

      var id = "INV-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
      invSheet.appendRow([
        id,
        productId,
        line,
        slotType,
        maxUsers,
        expireDate,
        "available",
        "",
        ""
      ]);
      addedCount++;
      addedIds.push(id);
    }
  }

  return {
    status: "success",
    message: "Đã thêm " + addedCount + " account vào kho thành công",
    addedCount: addedCount,
    addedIds: addedIds
  };
}

function initMemberSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetsToCreate = [
    { name: "MB_PRODUCTS", headers: ["id", "name", "description", "price", "type", "category", "status", "created_at", "slot_type", "guide_url", "sale_type", "sale_price", "sale_label", "sale_end_date"] },
    { name: "MB_INVENTORY", headers: ["id", "product_id", "item_data", "slot_type", "max_users", "expire_date", "status", "sold_to_email", "sold_at"] },
    { name: "MB_USERS", headers: ["id", "email", "password_hash", "display_name", "phone", "created_at", "status", "note"] },
    { name: "MB_WALLET_LOG", headers: ["id", "email", "type", "amount", "balance_after", "ref_id", "note", "timestamp"] },
    { name: "MB_TOPUP_REQ", headers: ["id", "email", "amount", "proof_url", "status", "requested_at", "reviewed_by", "note"] },
    { name: "MB_ORDERS", headers: ["id", "order_code", "email", "product_id", "product_name", "price", "inventory_id", "item_data", "status", "created_at"] },
    { name: "MB_PENDING_ORDERS", headers: ["id", "email", "product_id", "product_name", "price", "status", "created_at", "note"] }
  ];

  var created = [];
  sheetsToCreate.forEach(function(s) {
    var sh = ss.getSheetByName(s.name);
    if (!sh) {
      sh = ss.insertSheet(s.name);
      sh.appendRow(s.headers);
      created.push(s.name);
    } else {
      // Đảm bảo cập nhật đủ tiêu đề nếu sheet đã có trước đó
      if (s.name === 'MB_PRODUCTS') {
        var range = sh.getRange(1, 1, 1, s.headers.length);
        var cur = range.getValues()[0];
        var update = false;
        for (var h = 0; h < s.headers.length; h++) {
          if (String(cur[h] || '').trim() !== s.headers[h]) {
            cur[h] = s.headers[h];
            update = true;
          }
        }
        if (update) range.setValues([cur]);
      }
    }
  });

  return { status: "success", message: "Đã kiểm tra/khởi tạo xong " + created.length + " sheet tab MB_", createdSheets: created };
}
