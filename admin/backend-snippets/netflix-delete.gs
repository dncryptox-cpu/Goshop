/**
 * XOÁ KHÁCH NETFLIX — dán vào Apps Script gắn với sheet "sanphamkhac_ DATA" (backend của godnc.com/admin/netflix.html).
 *
 * Cách gắn (2 bước):
 *  1) Dán NGUYÊN file này vào cuối Code.gs (hoặc tạo file mới trong cùng dự án).
 *  2) Trong hàm doPost(e) đang có, thêm 1 dòng NGAY ĐẦU hàm:
 *        var __nf = netflixDeleteRoute_(e); if (__nf) return __nf;
 *     (nếu tham số của doPost không tên là e thì đổi e cho khớp)
 *  Lưu → Triển khai → Quản lý triển khai → bút chì → Phiên bản mới → Triển khai.
 */
var NF_DELETE_KEY = 'c74391ab-gpt-sec-2026'; // trùng API_KEY ở admin/netflix.html
var NF_SHEET = 'Netflix';

function netflixDeleteRoute_(e) {
  var b;
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return null; }
  if (b.module !== 'netflix' || b.action !== 'delete') return null; // không phải lệnh xoá → để doPost cũ xử lý
  return ContentService.createTextOutput(JSON.stringify(netflixDelete_(b))).setMimeType(ContentService.MimeType.JSON);
}

function netflixDelete_(b) {
  if (b.authToken !== NF_DELETE_KEY) return { success: false, error: 'Sai khoá admin' };
  var id = String(b.id || '').trim();
  if (!id) return { success: false, error: 'Thiếu ID khách' };
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NF_SHEET);
    if (!sh) return { success: false, error: 'Không thấy tab ' + NF_SHEET };
    var ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
    // Tìm theo ID (cột A) chứ không tin rowNum — rowNum có thể lệch nếu sheet vừa bị sửa
    for (var r = ids.length - 1; r >= 1; r--) {
      if (String(ids[r][0]).trim() === id) {
        sh.deleteRow(r + 1);
        return { success: true, deletedRow: r + 1 };
      }
    }
    return { success: false, error: 'Không tìm thấy khách ID ' + id + ' (có thể đã xoá rồi — bấm Làm mới)' };
  } finally { lock.releaseLock(); }
}
