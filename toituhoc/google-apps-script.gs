/**
 * TÔI TỰ HỌC - GOOGLE APPS SCRIPT BACKEND
 * 
 * HƯỚNG DẪN CÀI ĐẶT:
 * 1. Tạo một Google Sheet mới trên Google Drive (hoặc mở Sheet có sẵn).
 * 2. Mở "Tiện ích mở rộng" -> "Apps Script" (Extensions -> Apps Script).
 * 3. Xóa hết mã nguồn cũ trong file Code.gs và dán toàn bộ đoạn mã này vào.
 * 4. Thêm Gemini API Key:
 *    - Nhấp vào biểu tượng Bánh răng (Project Settings) ở menu bên trái.
 *    - Cuộn xuống phần "Script Properties" (Các thuộc tính của kịch bản).
 *    - Thêm một thuộc tính mới:
 *      + Property: GEMINI_API_KEY
 *      + Value: <Nhập Gemini API Key của bạn từ Google AI Studio>
 * 5. Deploy Web App:
 *    - Bấm nút "Deploy" (Triển khai) -> "New deployment" (Triển khai mới).
 *    - Chọn loại: "Web app" (Ứng dụng web).
 *    - Execute as (Thực thi dưới dạng): "Me" (Tôi).
 *    - Who has access (Ai có quyền truy cập): "Anyone" (Bất kỳ ai).
 *    - Bấm "Deploy", cấp quyền cấp phép (Authorize access) khi được hỏi.
 *    - Sao chép Web App URL thu được và dán vào file app.js ở frontend.
 */

function doGet(e) {
  try {
    var params = e.parameter || {};
    var action = params.action || 'ping';

    if (action === 'ping') {
      return respondJSON({
        status: 'success',
        message: 'Backend Apps Script "Tôi Tự Học" đang hoạt động bình thường!',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'getDueVocab') {
      var userEmail = params.user_email;
      if (!userEmail) {
        return respondJSON({ status: 'error', message: 'Thiếu email người dùng.' });
      }
      var todayStr = params.today || getTodayDateString();
      var vocabList = getDueVocabForUser(userEmail, todayStr);
      return respondJSON({ status: 'success', data: vocabList });
    }

    if (action === 'getAllVocab') {
      var userEmail = params.user_email;
      if (!userEmail) {
        return respondJSON({ status: 'error', message: 'Thiếu email người dùng.' });
      }
      var vocabList = getAllVocabForUser(userEmail);
      return respondJSON({ status: 'success', data: vocabList });
    }

    return respondJSON({ status: 'error', message: 'Hành động GET không hợp lệ.' });
  } catch (err) {
    return respondJSON({ status: 'error', message: 'Lỗi server: ' + err.toString() });
  }
}

function doPost(e) {
  try {
    var postData = {};
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    }
    var action = postData.action;

    if (action === 'processImage') {
      return handleProcessImage(postData);
    }

    if (action === 'submitReview') {
      return handleSubmitReview(postData);
    }

    return respondJSON({ status: 'error', message: 'Hành động POST không hợp lệ.' });
  } catch (err) {
    return respondJSON({ status: 'error', message: 'Lỗi xử lý POST: ' + err.toString() });
  }
}

// ==========================================
// THAO TÁC XỬ LÝ ẢNH & GEMINI VISION
// ==========================================

function handleProcessImage(data) {
  var userEmail = data.user_email;
  var imageBase64 = data.image_base64; // Dạng base64 string
  var mimeType = data.mime_type || 'image/jpeg';
  var fileName = data.file_name || ('photo_' + new Date().getTime() + '.jpg');

  if (!userEmail || !imageBase64) {
    return respondJSON({ status: 'error', message: 'Dữ liệu tải lên không hợp lệ (thiếu email hoặc ảnh).' });
  }

  // 1. Upload ảnh lên Google Drive
  var imageUrl = saveImageToDrive(imageBase64, mimeType, fileName);

  // 2. Gọi Gemini API Vision để trích xuất từ vựng
  var extractedItems = callGeminiVisionAPI(imageBase64, mimeType);

  if (!extractedItems || extractedItems.length === 0) {
    return respondJSON({ 
      status: 'warning', 
      message: 'Không tìm thấy từ vựng hoặc cấu trúc tiếng Anh đáng học trong ảnh này.',
      imageUrl: imageUrl,
      data: []
    });
  }

  // 3. Ghi các từ vựng vào Tab "vocab"
  var addedVocabList = [];
  var ss = getOrCreateSpreadsheet();
  var vocabSheet = ss.getSheetByName('vocab');

  var todayDateStr = getTodayDateString();
  var tomorrowDateStr = getNextDateString(1);

  for (var i = 0; i < extractedItems.length; i++) {
    var item = extractedItems[i];
    var vocabId = 'v_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
    
    var row = [
      vocabId,
      userEmail,
      todayDateStr,
      imageUrl,
      item.word || '',
      item.pos || 'Noun',
      item.meaning || '',
      item.example || '',
      item.grammar || '',
      2.5, // ease_factor
      1,   // interval
      tomorrowDateStr // next_review_date
    ];

    vocabSheet.appendRow(row);

    addedVocabList.push({
      id: vocabId,
      user_email: userEmail,
      ngay_them: todayDateStr,
      link_anh: imageUrl,
      tu_cum: item.word,
      loai_tu: item.pos,
      nghia: item.meaning,
      cau_vi_du: item.example,
      ghi_chu_ngu_phap: item.grammar,
      ease_factor: 2.5,
      interval: 1,
      next_review_date: tomorrowDateStr
    });
  }

  return respondJSON({
    status: 'success',
    message: 'Đã phân tích ảnh và lưu ' + addedVocabList.length + ' từ vựng vào danh sách ôn tập!',
    imageUrl: imageUrl,
    data: addedVocabList
  });
}

function saveImageToDrive(base64Data, mimeType, fileName) {
  try {
    var cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    var decodedBytes = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

    var folderName = 'ToiTuHoc_Uploads';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }

    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Trả về direct thumbnail link hoặc view URL
    return 'https://lh3.googleusercontent.com/d/' + file.getId();
  } catch (e) {
    Logger.log('Lỗi lưu Drive: ' + e.toString());
    return '';
  }
}

function callGeminiVisionAPI(base64Data, mimeType) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong Script Properties của Apps Script.');
  }

  var cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  var modelName = 'gemini-1.5-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + apiKey;

  var promptText = "Bạn là một trợ lý giảng dạy tiếng Anh thông minh. Hãy đọc chữ tiếng Anh trong ảnh và trích ra từ 3 đến 8 từ vựng, cụm từ (phrasal verbs, idioms) hoặc cấu trúc ngữ pháp đáng học nhất (BỎ QUA các từ quá cơ bản như 'the', 'is', 'a', 'in', 'on', 'it', 'and').\n" +
    "Trả về kết quả duy nhất ở dạng một JSON Array chứa các đối tượng có cấu trúc chính xác như sau:\n" +
    "[\n" +
    "  {\n" +
    "    \"word\": \"từ hoặc cụm từ tiếng Anh\",\n" +
    "    \"pos\": \"loại từ (ví dụ: Noun, Verb, Adjective, Phrase, Idiom, Grammar)\",\n" +
    "    \"meaning\": \"dịch nghĩa tiếng Việt ngắn gọn, rõ ràng\",\n" +
    "    \"example\": \"câu ví dụ tiếng Anh tự nhiên chứa từ/cụm từ đó\",\n" +
    "    \"grammar\": \"ghi chú ngữ pháp hoặc lưu ý cách dùng (nếu có, không có thì để rỗng)\"\n" +
    "  }\n" +
    "]\n" +
    "LƯU Ý: Chỉ trả về đoạn JSON thuần túy, không có thẻ ```json hay bất kỳ văn bản nào khác.";

  var payload = {
    "contents": [
      {
        "parts": [
          { "text": promptText },
          {
            "inlineData": {
              "mimeType": mimeType || "image/jpeg",
              "data": cleanBase64
            }
          }
        ]
      }
    ]
  };

  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  var response = UrlFetchApp.fetch(url, options);
  var responseCode = response.getResponseCode();
  var responseText = response.getContentText();

  if (responseCode !== 200) {
    Logger.log("Lỗi gọi Gemini API (" + responseCode + "): " + responseText);
    throw new Error("Lỗi kết nối Gemini API: " + responseText);
  }

  var jsonRes = JSON.parse(responseText);
  var candidateText = "";
  if (jsonRes.candidates && jsonRes.candidates.length > 0 && jsonRes.candidates[0].content) {
    candidateText = jsonRes.candidates[0].content.parts[0].text;
  }

  // Làm sạch kết quả JSON
  var cleanJSONStr = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    var items = JSON.parse(cleanJSONStr);
    return items;
  } catch (err) {
    Logger.log("Lỗi parse JSON Gemini response: " + cleanJSONStr);
    return [];
  }
}

// ==========================================
// THUẬT TOÁN SPACED REPETITION (SM-2) & LOG
// ==========================================

function handleSubmitReview(data) {
  var userEmail = data.user_email;
  var vocabId = data.vocab_id;
  var rating = data.rating; // 'again', 'hard', 'normal', 'easy'

  if (!userEmail || !vocabId || !rating) {
    return respondJSON({ status: 'error', message: 'Dữ liệu đánh giá không đầy đủ.' });
  }

  var ss = getOrCreateSpreadsheet();
  var vocabSheet = ss.getSheetByName('vocab');
  var logSheet = ss.getSheetByName('review_log');

  var vocabData = vocabSheet.getDataRange().getValues();
  var rowIndex = -1;
  var currentEase = 2.5;
  var currentInterval = 1;

  for (var i = 1; i < vocabData.length; i++) {
    if (vocabData[i][0] === vocabId && vocabData[i][1] === userEmail) {
      rowIndex = i + 1;
      currentEase = parseFloat(vocabData[i][9]) || 2.5;
      currentInterval = parseInt(vocabData[i][10], 10) || 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return respondJSON({ status: 'error', message: 'Không tìm thấy từ vựng tương ứng.' });
  }

  // Tính toán SM-2
  var q = 3;
  if (rating === 'again') q = 0;
  else if (rating === 'hard') q = 2;
  else if (rating === 'normal') q = 4;
  else if (rating === 'easy') q = 5;

  var newEase = currentEase;
  var newInterval = currentInterval;

  if (q < 3) {
    newInterval = 1;
    newEase = Math.max(1.3, currentEase - 0.2);
  } else {
    if (currentInterval === 1) {
      newInterval = 6;
    } else {
      var multiplier = (rating === 'easy') ? 1.3 : 1.0;
      newInterval = Math.max(1, Math.round(currentInterval * currentEase * multiplier));
    }
    newEase = Math.max(1.3, currentEase + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  }

  var nextReviewDateStr = getNextDateString(newInterval);
  var todayStr = getTodayDateString();

  // Cập nhật dòng trong Sheet `vocab`
  // Cột 10 (ease_factor), Cột 11 (interval), Cột 12 (next_review_date)
  vocabSheet.getRange(rowIndex, 10).setValue(parseFloat(newEase.toFixed(2)));
  vocabSheet.getRange(rowIndex, 11).setValue(newInterval);
  vocabSheet.getRange(rowIndex, 12).setValue(nextReviewDateStr);

  // Thêm log vào Sheet `review_log`
  var logId = 'log_' + new Date().getTime();
  logSheet.appendRow([
    logId,
    userEmail,
    vocabId,
    todayStr,
    rating
  ]);

  return respondJSON({
    status: 'success',
    message: 'Đã cập nhật tiến độ ôn tập!',
    data: {
      vocab_id: vocabId,
      new_ease_factor: parseFloat(newEase.toFixed(2)),
      new_interval: newInterval,
      next_review_date: nextReviewDateStr
    }
  });
}

// ==========================================
// TRUY VẤN DỮ LIỆU GOOGLE SHEET
// ==========================================

function getDueVocabForUser(userEmail, todayStr) {
  var ss = getOrCreateSpreadsheet();
  var vocabSheet = ss.getSheetByName('vocab');
  var data = vocabSheet.getDataRange().getValues();
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var email = row[1];
    var nextReview = formatDateString(row[11]);

    if (email === userEmail && nextReview <= todayStr) {
      result.push(rowToVocabObject(row));
    }
  }
  return result;
}

function getAllVocabForUser(userEmail) {
  var ss = getOrCreateSpreadsheet();
  var vocabSheet = ss.getSheetByName('vocab');
  var data = vocabSheet.getDataRange().getValues();
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var email = row[1];
    if (email === userEmail) {
      result.push(rowToVocabObject(row));
    }
  }
  return result;
}

function rowToVocabObject(row) {
  return {
    id: row[0],
    user_email: row[1],
    ngay_them: formatDateString(row[2]),
    link_anh: row[3],
    tu_cum: row[4],
    loai_tu: row[5],
    nghia: row[6],
    cau_vi_du: row[7],
    ghi_chu_ngu_phap: row[8],
    ease_factor: row[9],
    interval: row[10],
    next_review_date: formatDateString(row[11])
  };
}

// ==========================================
// HÀM TIỆN ÍCH HELPER
// ==========================================

function getOrCreateSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Script này cần được gắn (bound) vào một Google Sheet.');
  }

  // Khởi tạo Tab vocab nếu chưa có
  var vocabSheet = ss.getSheetByName('vocab');
  if (!vocabSheet) {
    vocabSheet = ss.insertSheet('vocab');
    vocabSheet.appendRow([
      'id', 'user_email', 'ngày_thêm', 'link_ảnh', 'từ/cụm', 
      'loại_từ', 'nghĩa', 'câu_ví_dụ', 'ghi_chú_ngữ_pháp', 
      'ease_factor', 'interval', 'next_review_date'
    ]);
  }

  // Khởi tạo Tab review_log nếu chưa có
  var logSheet = ss.getSheetByName('review_log');
  if (!logSheet) {
    logSheet = ss.insertSheet('review_log');
    logSheet.appendRow(['id', 'user_email', 'vocab_id', 'ngày_ôn', 'kết_quả']);
  }

  return ss;
}

function getTodayDateString() {
  var d = new Date();
  return formatDate(d);
}

function getNextDateString(daysToAdd) {
  var d = new Date();
  d.setDate(d.getDate() + daysToAdd);
  return formatDate(d);
}

function formatDate(d) {
  var month = '' + (d.getMonth() + 1);
  var day = '' + d.getDate();
  var year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

function formatDateString(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return formatDate(val);
  }
  return String(val).substring(0, 10);
}

function respondJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
