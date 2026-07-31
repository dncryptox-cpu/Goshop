/**
 * TÔI TỰ HỌC - GOOGLE APPS SCRIPT BACKEND (PHIÊN BẢN AUTH RIÊNG & PER-USER API KEY)
 * 
 * =========================================================================================
 * CẤU HÌNH GOOGLE SHEET ID (NẾU DÙNG SCRIPT TÁCH BIỆT HOẶC CẦN CHỈ ĐỊNH CHÍNH XÁC ID SHEET)
 * Nếu bạn để trống (""), script sẽ tự động lấy Google Sheet đang được gắn (Active Sheet).
 * Nếu bạn muốn chỉ định ID Sheet, dán ID Sheet của bạn vào giữa 2 dấu ngoặc kép bên dưới:
 * Ví dụ: var SPECIFIC_SPREADSHEET_ID = "1ABC123456789xyz...";
 * =========================================================================================
 */
var SPECIFIC_SPREADSHEET_ID = "";

/**
 * 🚀 HÀM KHỞI TẠO DATABASE (BẤM NÚT "CHẠY" / "RUN" NÀY TRONG APPS SCRIPT EDITOR DỂ TẠO CÁC TAB NGAY LẬP TỨC)
 * Nút "Chạy" nằm ở thanh công cụ phía trên. Chọn hàm `setupDatabase` rồi bấm `Chạy`.
 */
function setupDatabase() {
  var ss = getOrCreateSpreadsheet();
  var resultMsg = "🎉 Đã khởi tạo thành công 3 Tab: 'users', 'vocab', và 'review_log' trong Google Sheet: \"" + ss.getName() + "\" (ID: " + ss.getId() + ")";
  Logger.log(resultMsg);
  return resultMsg;
}

/**
 * 🧪 HÀM TEST ĐĂNG KÝ THỬ (Bấm nút "Chạy" hàm này để test trực tiếp ghi dữ liệu vào Sheet)
 */
function testRegister() {
  var testResult = handleRegister({
    email: "testuser@gmail.com",
    password: "password123",
    api_key_gemini: "AIzaSyTestApiKey123456"
  });
  Logger.log("Kết quả test đăng ký: " + testResult.getContent());
  return testResult.getContent();
}

// ==========================================
// API ROUTER (GET & POST)
// ==========================================

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'ping';

    if (action === 'ping') {
      return respondJSON({
        status: 'success',
        message: 'Backend Apps Script "Tôi Tự Học" đang hoạt động bình thường!',
        timestamp: new Date().toISOString()
      });
    }

    var token = params.token;
    var user = getUserByToken(token);
    if (!user) {
      return respondJSON({ status: 'error', code: 'UNAUTHORIZED', message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
    }

    if (action === 'getDueVocab') {
      var todayStr = params.today || getTodayDateString();
      var vocabList = getDueVocabForUser(user.email, todayStr);
      return respondJSON({ status: 'success', data: vocabList });
    }

    if (action === 'getAllVocab') {
      var vocabList = getAllVocabForUser(user.email);
      return respondJSON({ status: 'success', data: vocabList });
    }

    if (action === 'getUserProfile') {
      return respondJSON({
        status: 'success',
        data: {
          email: user.email,
          has_api_key: !!(user.api_key_gemini && user.api_key_gemini.trim()),
          role: user.role
        }
      });
    }

    return respondJSON({ status: 'error', message: 'Hành động GET không hợp lệ.' });
  } catch (err) {
    return respondJSON({ status: 'error', message: 'Lỗi server: ' + err.toString() });
  }
}

function doPost(e) {
  try {
    var postData = {};
    if (e && e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    }
    var action = postData.action;

    // Các hành động công khai (không cần Token)
    if (action === 'register') {
      return handleRegister(postData);
    }

    if (action === 'login') {
      return handleLogin(postData);
    }

    // Các hành động yêu cầu Token xác thực
    var token = postData.token;
    var user = getUserByToken(token);
    if (!user) {
      return respondJSON({ status: 'error', code: 'UNAUTHORIZED', message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
    }

    if (action === 'updateApiKey') {
      return handleUpdateApiKey(user.email, postData.api_key_gemini);
    }

    if (action === 'processImage') {
      return handleProcessImage(user, postData);
    }

    if (action === 'submitReview') {
      return handleSubmitReview(user.email, postData);
    }

    return respondJSON({ status: 'error', message: 'Hành động POST không hợp lệ.' });
  } catch (err) {
    return respondJSON({ status: 'error', message: 'Lỗi xử lý POST: ' + err.toString() });
  }
}

// ==========================================
// THAO TÁC AUTH, MẬT KHẨU & TOKEN
// ==========================================

function handleRegister(data) {
  var email = (data.email || '').trim().toLowerCase();
  var password = data.password || '';
  var apiKeyGemini = (data.api_key_gemini || '').trim();

  if (!email || !password) {
    return respondJSON({ status: 'error', message: 'Vui lòng nhập đầy đủ Email và Mật khẩu.' });
  }

  if (password.length < 6) {
    return respondJSON({ status: 'error', message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
  }

  var ss = getOrCreateSpreadsheet();
  var usersSheet = ss.getSheetByName('users');
  var usersData = usersSheet.getDataRange().getValues();

  for (var i = 1; i < usersData.length; i++) {
    if (usersData[i][1] === email) {
      return respondJSON({ status: 'error', message: 'Email này đã được đăng ký tài khoản trên hệ thống.' });
    }
  }

  var userId = 'u_' + new Date().getTime();
  var passwordHash = hashPassword(password);
  var todayStr = getTodayDateString();
  var token = generateToken(email);

  // Ghi vào Sheet users: id | email | password_hash | api_key_gemini | ngày_đăng_ký | role | current_token
  usersSheet.appendRow([
    userId,
    email,
    passwordHash,
    apiKeyGemini,
    todayStr,
    'user',
    token
  ]);

  return respondJSON({
    status: 'success',
    message: 'Đăng ký tài khoản thành công!',
    token: token,
    email: email,
    has_api_key: !!apiKeyGemini
  });
}

function handleLogin(data) {
  var email = (data.email || '').trim().toLowerCase();
  var password = data.password || '';

  if (!email || !password) {
    return respondJSON({ status: 'error', message: 'Vui lòng nhập Email và Mật khẩu.' });
  }

  var passwordHash = hashPassword(password);
  var ss = getOrCreateSpreadsheet();
  var usersSheet = ss.getSheetByName('users');
  var usersData = usersSheet.getDataRange().getValues();

  for (var i = 1; i < usersData.length; i++) {
    if (usersData[i][1] === email) {
      var storedHash = usersData[i][2];
      if (storedHash === passwordHash) {
        var token = generateToken(email);
        usersSheet.getRange(i + 1, 7).setValue(token);
        
        var apiKey = usersData[i][3] || '';
        return respondJSON({
          status: 'success',
          message: 'Đăng nhập thành công!',
          token: token,
          email: email,
          has_api_key: !!apiKey
        });
      } else {
        return respondJSON({ status: 'error', message: 'Mật khẩu không chính xác.' });
      }
    }
  }

  return respondJSON({ status: 'error', message: 'Tài khoản không tồn tại trên hệ thống.' });
}

function handleUpdateApiKey(userEmail, newApiKey) {
  var apiKeyClean = (newApiKey || '').trim();
  var ss = getOrCreateSpreadsheet();
  var usersSheet = ss.getSheetByName('users');
  var usersData = usersSheet.getDataRange().getValues();

  for (var i = 1; i < usersData.length; i++) {
    if (usersData[i][1] === userEmail) {
      usersSheet.getRange(i + 1, 4).setValue(apiKeyClean);
      return respondJSON({
        status: 'success',
        message: 'Cập nhật Gemini API Key cá nhân thành công!',
        has_api_key: !!apiKeyClean
      });
    }
  }

  return respondJSON({ status: 'error', message: 'Không tìm thấy thông tin người dùng.' });
}

function getUserByToken(token) {
  if (!token) return null;

  var ss = getOrCreateSpreadsheet();
  var usersSheet = ss.getSheetByName('users');
  var usersData = usersSheet.getDataRange().getValues();

  for (var i = 1; i < usersData.length; i++) {
    var row = usersData[i];
    var storedToken = row[6];
    if (storedToken && storedToken === token) {
      return {
        id: row[0],
        email: row[1],
        password_hash: row[2],
        api_key_gemini: row[3],
        ngay_dang_ky: row[4],
        role: row[5],
        token: row[6]
      };
    }
  }
  return null;
}

function hashPassword(password) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    var byteStr = (digest[i] < 0 ? digest[i] + 256 : digest[i]).toString(16);
    if (byteStr.length === 1) byteStr = '0' + byteStr;
    hex += byteStr;
  }
  return hex;
}

function generateToken(email) {
  var timestamp = new Date().getTime();
  var rawStr = email + '_' + timestamp + '_' + Math.random();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, rawStr, Utilities.Charset.UTF_8);
  var token = '';
  for (var i = 0; i < digest.length; i++) {
    var byteStr = (digest[i] < 0 ? digest[i] + 256 : digest[i]).toString(16);
    if (byteStr.length === 1) byteStr = '0' + byteStr;
    token += byteStr;
  }
  return token;
}

// ==========================================
// THAO TÁC XỬ LÝ ẢNH & GEMINI VISION
// ==========================================

function handleProcessImage(user, data) {
  var userEmail = user.email;
  var userApiKey = user.api_key_gemini;
  var imageBase64 = data.image_base64;
  var mimeType = data.mime_type || 'image/jpeg';
  var fileName = data.file_name || ('photo_' + new Date().getTime() + '.jpg');

  if (!userApiKey || !userApiKey.trim()) {
    return respondJSON({
      status: 'error',
      code: 'NO_API_KEY',
      message: 'Bạn chưa cài đặt Gemini API Key cá nhân. Vui lòng vào Cài đặt tài khoản để nhập API Key của bạn.'
    });
  }

  if (!imageBase64) {
    return respondJSON({ status: 'error', message: 'Dữ liệu ảnh gửi lên không hợp lệ.' });
  }

  var imageUrl = saveImageToDrive(imageBase64, mimeType, fileName);
  var extractedItems = callGeminiVisionAPIWithUserKey(imageBase64, mimeType, userApiKey);

  if (!extractedItems || extractedItems.length === 0) {
    return respondJSON({ 
      status: 'warning', 
      message: 'Không tìm thấy từ vựng hoặc cấu trúc tiếng Anh đáng học trong ảnh này.',
      imageUrl: imageUrl,
      data: []
    });
  }

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
      2.5,
      1,
      tomorrowDateStr
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
    
    return 'https://lh3.googleusercontent.com/d/' + file.getId();
  } catch (e) {
    Logger.log('Lỗi lưu Drive: ' + e.toString());
    return '';
  }
}

function callGeminiVisionAPIWithUserKey(base64Data, mimeType, userApiKey) {
  var cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  var modelName = 'gemini-1.5-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + userApiKey;

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
    Logger.log("Lỗi gọi Gemini API với User Key (" + responseCode + "): " + responseText);
    throw new Error("Lỗi Gemini API (kiểm tra lại API Key cá nhân): " + responseText);
  }

  var jsonRes = JSON.parse(responseText);
  var candidateText = "";
  if (jsonRes.candidates && jsonRes.candidates.length > 0 && jsonRes.candidates[0].content) {
    candidateText = jsonRes.candidates[0].content.parts[0].text;
  }

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

function handleSubmitReview(userEmail, data) {
  var vocabId = data.vocab_id;
  var rating = data.rating;

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

  vocabSheet.getRange(rowIndex, 10).setValue(parseFloat(newEase.toFixed(2)));
  vocabSheet.getRange(rowIndex, 11).setValue(newInterval);
  vocabSheet.getRange(rowIndex, 12).setValue(nextReviewDateStr);

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
// HÀM TIỆN ÍCH HELPER & KHỞI TẠO SHEET
// ==========================================

function getOrCreateSpreadsheet() {
  var ss;
  if (typeof SPECIFIC_SPREADSHEET_ID !== 'undefined' && SPECIFIC_SPREADSHEET_ID && SPECIFIC_SPREADSHEET_ID.trim()) {
    ss = SpreadsheetApp.openById(SPECIFIC_SPREADSHEET_ID.trim());
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  if (!ss) {
    throw new Error('Không thể kết nối đến Google Sheet. Nếu dùng Standalone Script, vui lòng nhập SPECIFIC_SPREADSHEET_ID ở đầu file Code.gs.');
  }

  // 1. Tab users
  var usersSheet = ss.getSheetByName('users');
  if (!usersSheet) {
    usersSheet = ss.insertSheet('users');
    usersSheet.appendRow(['id', 'email', 'password_hash', 'api_key_gemini', 'ngày_đăng_ký', 'role', 'current_token']);
  }

  // 2. Tab vocab
  var vocabSheet = ss.getSheetByName('vocab');
  if (!vocabSheet) {
    vocabSheet = ss.insertSheet('vocab');
    vocabSheet.appendRow([
      'id', 'user_email', 'ngày_thêm', 'link_ảnh', 'từ/cụm', 
      'loại_từ', 'nghĩa', 'câu_ví_dụ', 'ghi_chú_ngữ_pháp', 
      'ease_factor', 'interval', 'next_review_date'
    ]);
  }

  // 3. Tab review_log
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
