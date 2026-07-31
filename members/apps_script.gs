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
      return registerUser(data.email, data.passwordHash, data.displayName);
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

    // --- 6. ACTION: BULK ADD INVENTORY ---
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

    // --- 7. ACTION: INIT MEMBER SHEETS ---
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

function registerUser(email, passwordHash, displayName) {
  if (!email || !passwordHash) {
    return responseJSON({ status: 'error', message: 'Vui lòng nhập email và mật khẩu' });
  }

  var cleanEmail = String(email).trim().toLowerCase();
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return responseJSON({ status: 'error', message: 'Định dạng email không hợp lệ' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName('MB_USERS');
  if (!userSheet) {
    userSheet = ss.insertSheet('MB_USERS');
    userSheet.appendRow(["id", "email", "password_hash", "display_name", "created_at", "status", "note"]);
    userSheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#e0e7ff");
  }

  var data = userSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim().toLowerCase() === cleanEmail) {
      return responseJSON({ status: 'error', message: 'Email này đã được đăng ký' });
    }
  }

  var userId = 'USR-' + Date.now();
  var name = String(displayName || cleanEmail.split('@')[0]).trim();
  userSheet.appendRow([userId, cleanEmail, String(passwordHash).trim(), name, new Date().toISOString(), 'active', 'Tự đăng ký']);

  return responseJSON({
    status: 'success',
    message: 'Đăng ký tài khoản thành công',
    userId: userId,
    email: cleanEmail,
    displayName: name
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
    var rowStatus = String(data[i][5] || 'active').trim().toLowerCase();
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
        userSheet.getRange(i + 1, 6).setValue(status);
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
    { name: "MB_PRODUCTS", headers: ["id", "name", "description", "price", "type", "category", "status", "created_at", "slot_type", "guide_url"] },
    { name: "MB_INVENTORY", headers: ["id", "product_id", "item_data", "slot_type", "max_users", "expire_date", "status", "sold_to_email", "sold_at"] },
    { name: "MB_USERS", headers: ["id", "email", "password_hash", "display_name", "created_at", "status", "note"] },
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
    }
  });

  return { status: "success", message: "Đã kiểm tra/khởi tạo xong " + created.length + " sheet tab MB_", createdSheets: created };
}
