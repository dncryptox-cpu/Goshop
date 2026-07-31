/**
 * GO SHOP MEMBER SYSTEM - GOOGLE APPS SCRIPT BACKEND
 * Sheet target: MB_INVENTORY, MB_PRODUCTS, MB_ORDERS, MB_WALLET_LOG, etc.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents || '{}');
    var action = data.action;

    // --- 1. ACTION: BULK ADD INVENTORY (REDESIGN LUỒNG NHẬP KHO) ---
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

    // --- 2. ACTION: INIT MEMBER SHEETS ---
    if (action === 'init_member_sheets') {
      var initResult = initMemberSheets();
      return ContentService.createTextOutput(JSON.stringify(initResult)).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Action không hợp lệ: ' + action })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Thêm danh sách account vào MB_INVENTORY
 * Columns: id, product_id, item_data, slot_type, max_users, expire_date, status (available/sold/expired), sold_to_email, sold_at
 */
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

/**
 * Tự động khởi tạo đủ 6 Sheet tab có prefix MB_
 */
function initMemberSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetsToCreate = [
    { name: "MB_PRODUCTS", headers: ["id", "name", "description", "price", "type", "category", "status", "created_at", "slot_type", "guide_url"] },
    { name: "MB_INVENTORY", headers: ["id", "product_id", "item_data", "slot_type", "max_users", "expire_date", "status", "sold_to_email", "sold_at"] },
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
