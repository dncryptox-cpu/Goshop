/**
 * TÔI TỰ HỌC - GOOGLE APPS SCRIPT BACKEND (BỔ SUNG TÍNH NĂNG GHI CHÚ HỌC TIẾNG ANH)
 * 
 * SPREADSHEET ID CỦA BẠN:
 */
var SPECIFIC_SPREADSHEET_ID = "1jIj2Zs_JKbnb2pJPFgXvoqlQ0jQk6HaR1Kp58IkGK1w";

/**
 * 🚀 HÀM KHỞI TẠO DATABASE (BẤM NÚT "CHẠY" / "RUN" NÀY ĐỂ TẠO HOẶC CẬP NHẬT CÁC TAB USERS, VOCAB, REVIEW_LOG, NOTES)
 */
function setupDatabase() {
  var ss = getOrCreateSpreadsheet();
  var resultMsg = "🎉 Đã khởi tạo thành công 4 Tab: 'users', 'vocab', 'review_log', và 'notes' trong Google Sheet: \"" + ss.getName() + "\" (ID: " + ss.getId() + ")";
  Logger.log(resultMsg);
  return resultMsg;
}

/**
 * 🧪 HÀM TEST ĐĂNG KÝ THỬ
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

/**
 * 🧪 HÀM TEST THỜI HẠN TOKEN 7 NGÀY
 */
function testTokenExpiry() {
  var ss = getOrCreateSpreadsheet();
  var usersSheet = ss.getSheetByName('users');
  var usersData = usersSheet.getDataRange().getValues();
  if (usersData.length > 1) {
    var row = usersData[1];
    var token = row[6];
    var expiresAt = row[7];
    var nowMs = new Date().getTime();
    var expiryMs = new Date(expiresAt).getTime();
    var isExpired = nowMs > expiryMs;

    var statusMsg = "User: " + row[1] + " | Token: " + token + " | Thời điểm hết hạn (7 ngày): " + expiresAt + " | Trạng thái: " + (isExpired ? "ĐÃ HẾT HẠN ❌" : "CÒN HIỆU LỰC ✅");
    Logger.log(statusMsg);
    return statusMsg;
  }
  return "Chưa có user nào trong Sheet";
}

/**
 * 🧪 HÀM TEST GỌI GEMINI 3.6 FLASH VISION
 */
function testGeminiVision(apiKey) {
  var testKey = apiKey || "AIzaSy_YOUR_API_KEY";
  var sampleBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  try {
    var items = callGeminiVisionAPIWithUserKey(sampleBase64, "image/png", testKey);
    Logger.log("Kết quả Gemini 3.6 Flash thành công: " + JSON.stringify(items));
    return items;
  } catch (e) {
    Logger.log("Lỗi gọi Gemini 3.6 Flash: " + e.toString());
    return e.toString();
  }
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
      var streak = calculateUserStreak(user.email);
      return respondJSON({
        status: 'success',
        data: {
          email: user.email,
          has_api_key: !!(user.api_key_gemini && user.api_key_gemini.trim()),
          role: user.role,
          streak: streak
        }
      });
    }

    if (action === 'getUserNotes') {
      var notesList = getUserNotes(user.email);
      return respondJSON({ status: 'success', data: notesList });
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

    // Public Actions
    if (action === 'register') {
      return handleRegister(postData);
    }

    if (action === 'login') {
      return handleLogin(postData);
    }

    if (action === 'logout') {
      return handleLogout(postData);
    }

    // Authenticated Actions
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

    if (action === 'processNote') {
      return handleProcessNote(user, postData);
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
// THAO TÁC AUTH, MẬT KHẨU & MULTI-SESSION
// ==========================================

function createSession(ss, email, userAgent) {
  var tokenObj = generateTokenWithExpiry(email);
  var sessionsSheet = ss.getSheetByName('sessions');
  if (!sessionsSheet) {
    sessionsSheet = ss.insertSheet('sessions');
    sessionsSheet.appendRow(['token', 'user_email', 'ngày_tạo', 'ngày_hết_hạn', 'thiết_bị']);
  }

  var createdAtStr = new Date().toISOString();
  var deviceStr = userAgent || 'Web App Browser';

  // 1. Dọn dẹp sơ bộ các session đã quá hạn (đảm bảo tab sessions không bị phình to)
  cleanupExpiredSessions(sessionsSheet);

  // 2. Tạo dòng phiên đăng nhập mới cho thiết bị này
  sessionsSheet.appendRow([
    tokenObj.token,
    email,
    createdAtStr,
    tokenObj.expires_at,
    deviceStr
  ]);

  return tokenObj;
}

function cleanupExpiredSessions(sessionsSheet) {
  try {
    var data = sessionsSheet.getDataRange().getValues();
    var nowMs = new Date().getTime();
    for (var i = data.length - 1; i >= 1; i--) {
      var expiresAtVal = data[i][3];
      if (expiresAtVal) {
        var expiryMs = (expiresAtVal instanceof Date) ? expiresAtVal.getTime() : new Date(expiresAtVal).getTime();
        if (!isNaN(expiryMs) && expiryMs > 0 && nowMs > expiryMs) {
          sessionsSheet.deleteRow(i + 1);
        }
      }
    }
  } catch (e) {
    Logger.log("Bỏ qua cleanup sessions: " + e.toString());
  }
}

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
  var tokenObj = createSession(ss, email, data.user_agent);

  // Ghi vào Sheet users: id | email | password_hash | api_key_gemini | ngày_đăng_ký | role | current_token | token_expires_at
  usersSheet.appendRow([
    userId,
    email,
    passwordHash,
    apiKeyGemini,
    todayStr,
    'user',
    tokenObj.token,
    tokenObj.expires_at
  ]);

  return respondJSON({
    status: 'success',
    message: 'Đăng ký tài khoản thành công! (Phiên đăng nhập có hiệu lực 7 ngày)',
    token: tokenObj.token,
    token_expires_at: tokenObj.expires_at,
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
        var tokenObj = createSession(ss, email, data.user_agent);
        
        // Cập nhật lại token mới nhất vào row user để tiện tham chiếu
        usersSheet.getRange(i + 1, 7).setValue(tokenObj.token);
        usersSheet.getRange(i + 1, 8).setValue(tokenObj.expires_at);
        
        var apiKey = usersData[i][3] || '';
        return respondJSON({
          status: 'success',
          message: 'Đăng nhập thành công! (Phiên đăng nhập hỗ trợ đồng thời nhiều thiết bị)',
          token: tokenObj.token,
          token_expires_at: tokenObj.expires_at,
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

function handleLogout(data) {
  var token = (data.token || '').trim();
  if (!token) {
    return respondJSON({ status: 'success', message: 'Đã đăng xuất.' });
  }

  var ss = getOrCreateSpreadsheet();
  var sessionsSheet = ss.getSheetByName('sessions');
  if (sessionsSheet) {
    var sessionsData = sessionsSheet.getDataRange().getValues();
    for (var i = sessionsData.length - 1; i >= 1; i--) {
      if (String(sessionsData[i][0]).trim() === token) {
        sessionsSheet.deleteRow(i + 1);
        break;
      }
    }
  }

  return respondJSON({ status: 'success', message: 'Đã hủy phiên đăng nhập thiết bị này thành công.' });
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
  if (!token || typeof token !== 'string' || !token.trim()) return null;

  var cleanToken = token.trim();
  var ss = getOrCreateSpreadsheet();
  var nowMs = new Date().getTime();

  // 1. Kiểm tra trong tab `sessions` (Mô hình Multi-Session)
  var sessionsSheet = ss.getSheetByName('sessions');
  var matchedEmail = null;
  var tokenExpiresAt = null;

  if (sessionsSheet) {
    var sessionsData = sessionsSheet.getDataRange().getValues();
    for (var s = 1; s < sessionsData.length; s++) {
      var sRow = sessionsData[s];
      if (sRow[0] && String(sRow[0]).trim() === cleanToken) {
        var expiresAtVal = sRow[3];
        if (expiresAtVal) {
          var expiryMs = (expiresAtVal instanceof Date) ? expiresAtVal.getTime() : new Date(expiresAtVal).getTime();
          if (!isNaN(expiryMs) && expiryMs > 0 && nowMs > expiryMs) {
            Logger.log("⚠️ Token phiên đăng nhập đã hết hạn 7 ngày cho user: " + sRow[1]);
            return null; // Token expired!
          }
        }
        matchedEmail = sRow[1];
        tokenExpiresAt = sRow[3];
        break;
      }
    }
  }

  // 2. Fallback đối soát ngược với tab `users` nếu là token cũ
  if (!matchedEmail) {
    var usersSheet = ss.getSheetByName('users');
    var usersData = usersSheet.getDataRange().getValues();
    for (var u = 1; u < usersData.length; u++) {
      var uRow = usersData[u];
      if (uRow[6] && String(uRow[6]).trim() === cleanToken) {
        var uExpiresVal = uRow[7];
        if (uExpiresVal) {
          var uExpiryMs = (uExpiresVal instanceof Date) ? uExpiresVal.getTime() : new Date(uExpiresVal).getTime();
          if (!isNaN(uExpiryMs) && uExpiryMs > 0 && nowMs > uExpiryMs) {
            return null;
          }
        }
        matchedEmail = uRow[1];
        tokenExpiresAt = uRow[7];
        break;
      }
    }
  }

  if (!matchedEmail) return null;

  // Lấy chi tiết thông tin người dùng từ tab `users`
  var usersSheet2 = ss.getSheetByName('users');
  var usersData2 = usersSheet2.getDataRange().getValues();
  for (var i = 1; i < usersData2.length; i++) {
    var row = usersData2[i];
    if (row[1] && String(row[1]).trim().toLowerCase() === String(matchedEmail).trim().toLowerCase()) {
      return {
        id: row[0],
        email: row[1],
        password_hash: row[2],
        api_key_gemini: row[3],
        ngay_dang_ky: row[4],
        role: row[5],
        token: cleanToken,
        token_expires_at: tokenExpiresAt
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

function generateTokenWithExpiry(email) {
  var nowMs = new Date().getTime();
  var rawStr = email + '_' + nowMs + '_' + Math.random();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, rawStr, Utilities.Charset.UTF_8);
  var token = '';
  for (var i = 0; i < digest.length; i++) {
    var byteStr = (digest[i] < 0 ? digest[i] + 256 : digest[i]).toString(16);
    if (byteStr.length === 1) byteStr = '0' + byteStr;
    token += byteStr;
  }

  // 7 ngày = 7 * 24 * 60 * 60 * 1000 = 604,800,000 ms
  var expiryMs = nowMs + (7 * 24 * 60 * 60 * 1000);
  var expiryDate = new Date(expiryMs);

  return {
    token: token,
    expires_at: expiryDate.toISOString()
  };
}

// ==========================================
// TÍNH NĂNG GHI CHÚ HỌC TIẾNG ANH (PROCESS NOTE)
// ==========================================

function handleProcessNote(user, data) {
  try {
    var userEmail = user.email;
    var userApiKey = user.api_key_gemini;
    var vietnameseText = (data.vietnamese_text || '').trim();

    if (!userApiKey || !userApiKey.trim()) {
      return respondJSON({
        status: 'error',
        code: 'NO_API_KEY',
        message: 'Bạn chưa cài đặt Gemini API Key cá nhân. Vui lòng vào Cài đặt tài khoản để nhập API Key của bạn.'
      });
    }

    if (!vietnameseText) {
      return respondJSON({ status: 'error', message: 'Vui lòng nhập câu hoặc đoạn tiếng Việt bạn muốn học.' });
    }

    // 1. Gọi Gemini API để phân tích và dịch câu
    var aiResult = callGeminiNoteAPIWithUserKey(vietnameseText, userApiKey);

    if (!aiResult || !aiResult.english_translation) {
      return respondJSON({ status: 'error', message: 'Không thể phân tích văn bản qua Gemini AI. Vui lòng kiểm tra lại Gemini API Key cá nhân.' });
    }

    var noteId = 'n_' + new Date().getTime();
    var todayStr = getTodayDateString();
    var tomorrowStr = getNextDateString(1);

    var ss = getOrCreateSpreadsheet();
    var notesSheet = ss.getSheetByName('notes');
    var vocabSheet = ss.getSheetByName('vocab');

    // 2. GHI NGAY VÀO TAB "notes"
    var alternativesJSON = JSON.stringify(aiResult.alternatives || []);
    var vocabularyJSON = JSON.stringify(aiResult.vocabulary || []);

    notesSheet.appendRow([
      noteId,
      userEmail,
      todayStr,
      vietnameseText,
      aiResult.english_translation,
      aiResult.explanation || '',
      alternativesJSON,
      vocabularyJSON
    ]);

    // 3. TỰ ĐỘNG THÊM TỪ VỰNG TRÍCH XUẤT VÀO TAB "vocab" ĐỂ ÔN TẬP FLASHCARDS
    var addedVocabCount = 0;
    if (aiResult.vocabulary && aiResult.vocabulary.length > 0) {
      for (var i = 0; i < aiResult.vocabulary.length; i++) {
        var vItem = aiResult.vocabulary[i];
        if (!vItem.word) continue;

        var vocabId = 'v_note_' + new Date().getTime() + '_' + i;
        vocabSheet.appendRow([
          vocabId,
          userEmail,
          todayStr,
          '', // link_ảnh (rỗng)
          vItem.word,
          vItem.pos || 'Phrase',
          vItem.meaning || '',
          vItem.example || aiResult.english_translation,
          vItem.grammar || '',
          2.5, // ease_factor
          1,   // interval
          tomorrowStr, // next_review_date
          vItem.phien_am || '',
          ''   // link_anh_chu_thich
        ]);
        addedVocabCount++;
      }
    }

    return respondJSON({
      status: 'success',
      message: 'Đã phân tích ghi chú, lưu vào Google Sheet và gộp ' + addedVocabCount + ' từ vựng vào Flashcard ôn tập!',
      data: {
        id: noteId,
        user_email: userEmail,
        ngay: todayStr,
        noi_dung_tieng_viet: vietnameseText,
        ban_dich_tieng_anh: aiResult.english_translation,
        giai_thich_cach_dung: aiResult.explanation || '',
        cach_noi_khac: aiResult.alternatives || [],
        tu_vung_lien_quan: aiResult.vocabulary || []
      }
    });
  } catch (eNote) {
    Logger.log("⚠️ Lỗi handleProcessNote: " + eNote.toString());
    return respondJSON({
      status: 'error',
      message: 'Đã có lỗi xảy ra khi xử lý ghi chú: ' + eNote.toString()
    });
  }
}

function callGeminiNoteAPIWithUserKey(vietnameseText, userApiKey) {
  var modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
  var lastErrorMsg = '';

  var promptText = "Bạn là một chuyên gia giảng dạy tiếng Anh tự nhiên. Người dùng gõ một câu hoặc đoạn tiếng Việt sau: \"" + vietnameseText + "\"\n" +
    "Hãy phân tích và trả về DUY NHẤT một JSON Object chứa các thông tin sau:\n" +
    "{\n" +
    "  \"english_translation\": \"Bản dịch tiếng Anh tự nhiên, chuẩn bản ngữ, đúng ngữ cảnh (KHÔNG dịch máy word-by-word)\",\n" +
    "  \"explanation\": \"Giải thích ngắn gọn tại sao dùng cấu trúc/từ đó (ngữ pháp, sắc thái ngữ cảnh, lý do bản ngữ hay nói vậy)\",\n" +
    "  \"alternatives\": [\"Gợi ý 1-2 cách nói khác cho cùng ý đó (ví dụ: Formal hơn hoặc Casual hơn)\"],\n" +
    "  \"vocabulary\": [\n" +
    "    {\n" +
    "      \"word\": \"từ hoặc cụm từ tiếng Anh đáng học trong câu\",\n" +
    "      \"phien_am\": \"phiên âm quốc tế IPA (ví dụ: /ɪɡˈzæmpəl/)\",\n" +
    "      \"pos\": \"loại từ (Noun, Verb, Adjective, Phrase, Idiom)\",\n" +
    "      \"meaning\": \"nghĩa tiếng Việt ngắn gọn\",\n" +
    "      \"example\": \"câu ví dụ tiếng Anh tự nhiên chứa từ đó\",\n" +
    "      \"grammar\": \"ghi chú cách dùng nếu có\"\n" +
    "    }\n" +
    "  ]\n" +
    "}\n" +
    "LƯU Ý: Chỉ trả về đoạn JSON thuần túy, không kèm bọc ```json hay bất kỳ văn bản giải thích nào khác.";

  var payload = {
    "contents": [
      {
        "parts": [{ "text": promptText }]
      }
    ]
  };

  for (var m = 0; m < modelsToTry.length; m++) {
    var modelName = modelsToTry[m];
    try {
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + userApiKey;
      var options = {
        "method": "post",
        "contentType": "application/json",
        "payload": JSON.stringify(payload),
        "muteHttpExceptions": true
      };

      var response = UrlFetchApp.fetch(url, options);
      var responseCode = response.getResponseCode();
      var responseText = response.getContentText();

      if (responseCode === 200) {
        var jsonRes = JSON.parse(responseText);
        var candidateText = "";
        if (jsonRes.candidates && jsonRes.candidates.length > 0 && jsonRes.candidates[0].content) {
          candidateText = jsonRes.candidates[0].content.parts[0].text;
        }

        var cleanJSONStr = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
        var parsedObj = JSON.parse(cleanJSONStr);
        if (parsedObj && parsedObj.english_translation) {
          return parsedObj;
        }
      } else {
        var errMsg = parseGoogleApiError(responseCode, responseText);
        Logger.log("⚠️ Gemini Note API (" + modelName + ") Code " + responseCode + ": " + errMsg);
        lastErrorMsg = "Model " + modelName + " (" + responseCode + "): " + errMsg;
      }
    } catch (e) {
      lastErrorMsg = e.toString();
      Logger.log("⚠️ Lỗi gọi " + modelName + ": " + e.toString());
    }
  }

  throw new Error("Lỗi kết nối Gemini API: " + lastErrorMsg);
}
}

function getUserNotes(userEmail) {
  var ss = getOrCreateSpreadsheet();
  var notesSheet = ss.getSheetByName('notes');
  var data = notesSheet.getDataRange().getValues();
  var result = [];

  for (var i = data.length - 1; i >= 1; i--) { // Đảo ngược để lấy mới nhất lên đầu
    var row = data[i];
    if (row[1] === userEmail) {
      var alternatives = [];
      var vocabulary = [];
      try { alternatives = JSON.parse(row[6] || '[]'); } catch (e) {}
      try { vocabulary = JSON.parse(row[7] || '[]'); } catch (e) {}

      result.push({
        id: row[0],
        user_email: row[1],
        ngay: formatDateString(row[2]),
        noi_dung_tieng_viet: row[3],
        ban_dich_tieng_anh: row[4],
        giai_thich_cach_dung: row[5],
        cach_noi_khac: alternatives,
        tu_vung_lien_quan: vocabulary
      });
    }
  }
  return result;
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

  // 3. TẠO ẢNH CHÚ THÍCH BẰNG AI (NANO BANANA / GEMINI FLASH IMAGE) NẾU ĐƯỢC BẬT
  var annotatedImageUrl = '';
  var annotatedImageError = '';
  var enableAnnotatedImage = (data.enable_annotated_image === true);

  if (enableAnnotatedImage) {
    try {
      var resAnnotated = callGeminiAnnotatedImageAPI(imageBase64, mimeType, userApiKey);
      annotatedImageUrl = resAnnotated.url || '';
      annotatedImageError = resAnnotated.error || '';
    } catch (eAnnotated) {
      annotatedImageError = eAnnotated.toString();
      Logger.log('Bỏ qua tạo ảnh chú thích vì lỗi: ' + annotatedImageError);
    }
  }

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
      tomorrowDateStr,
      item.phien_am || '',
      annotatedImageUrl
    ];

    vocabSheet.appendRow(row);

    addedVocabList.push({
      id: vocabId,
      user_email: userEmail,
      ngay_them: todayDateStr,
      link_anh: imageUrl,
      link_anh_chu_thich: annotatedImageUrl,
      tu_cum: item.word,
      phien_am: item.phien_am || '',
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
    annotatedImageUrl: annotatedImageUrl,
    annotatedImageError: annotatedImageError,
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
  var modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
  var lastErrorMsg = '';

  var promptText = "Bạn là một trợ lý giảng dạy tiếng Anh thông minh. Hãy đọc chữ tiếng Anh trong ảnh và trích ra từ 3 đến 8 từ vựng, cụm từ (phrasal verbs, idioms) hoặc cấu trúc ngữ pháp đáng học nhất (BỎ QUA các từ quá cơ bản như 'the', 'is', 'a', 'in', 'on', 'it', 'and').\n" +
    "Trả về kết quả duy nhất ở dạng một JSON Array chứa các đối tượng có cấu trúc chính xác như sau:\n" +
    "[\n" +
    "  {\n" +
    "    \"word\": \"từ hoặc cụm từ tiếng Anh\",\n" +
    "    \"phien_am\": \"phiên âm quốc tế IPA (ví dụ: /ɪɡˈzæmpəl/)\",\n" +
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

  for (var m = 0; m < modelsToTry.length; m++) {
    var modelName = modelsToTry[m];
    try {
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + userApiKey;
      var options = {
        "method": "post",
        "contentType": "application/json",
        "payload": JSON.stringify(payload),
        "muteHttpExceptions": true
      };

      var response = UrlFetchApp.fetch(url, options);
      var responseCode = response.getResponseCode();
      var responseText = response.getContentText();

      if (responseCode === 200) {
        var jsonRes = JSON.parse(responseText);
        var candidateText = "";
        if (jsonRes.candidates && jsonRes.candidates.length > 0 && jsonRes.candidates[0].content) {
          candidateText = jsonRes.candidates[0].content.parts[0].text;
        }

        var cleanJSONStr = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
        var items = JSON.parse(cleanJSONStr);
        if (items && items.length >= 0) {
          return items;
        }
      } else {
        var errMsg = parseGoogleApiError(responseCode, responseText);
        Logger.log("⚠️ Gemini Vision API (" + modelName + ") Code " + responseCode + ": " + errMsg);
        lastErrorMsg = "Model " + modelName + " (" + responseCode + "): " + errMsg;
      }
    } catch (e) {
      lastErrorMsg = e.toString();
      Logger.log("⚠️ Lỗi gọi " + modelName + ": " + e.toString());
    }
  }

  throw new Error("Lỗi Gemini Vision API (kiểm tra lại API Key cá nhân): " + lastErrorMsg);
}

/**
 * 🎨 HÀM GỌI GEMINI MODEL TẠO ẢNH CHÚ THÍCH (MODEL GEMINI 2.5 FLASH IMAGE)
 */
function callGeminiAnnotatedImageAPI(base64Data, mimeType, userApiKey) {
  try {
    var cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    var modelName = 'gemini-2.5-flash-image';
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + userApiKey;

    var promptText = "Bạn là một nhà thiết kế đồ họa giáo dục tiếng Anh chuyên nghiệp. Dựa trên bức ảnh được cung cấp, hãy tạo ra 1 BỨC ẢNH MỚI được vẽ chú thích phong cách infographic / sketch giáo dục sinh động:\n" +
      "1. Xác định 3 đến 8 vật thể hoặc chi tiết đáng học tiếng Anh nhất trong ảnh.\n" +
      "2. Vẽ các mũi tên màu sắc nổi bật (đỏ, vàng, xanh neon) chỉ rõ ràng vào từng vật thể (không đè lên mặt người/chi tiết chính, các đường không đè chéo lên nhau).\n" +
      "3. Ở đầu mỗi mũi tên, viết nhãn từ vựng tiếng Anh kèm loại từ và nghĩa tiếng Việt ngắn gọn tại các khoảng trống trên ảnh.\n" +
      "4. Giữ nét ảnh sắc nét, bố cục khoa học, phong cách sơ đồ giáo dục trực quan dễ học.";

    var payload = {
      "contents": [
        {
          "parts": [
            { "text": promptText },
            {
              "inlineData": {
                "mimeType": mimeType,
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
    var code = response.getResponseCode();
    var text = response.getContentText();

    if (code !== 200) {
      var errMsg = parseGoogleApiError(code, text);
      Logger.log("⚠️ Gemini Annotated Image API (" + modelName + ") Code " + code + ": " + errMsg);
      return { url: '', error: "Model " + modelName + " (" + code + "): " + errMsg };
    }

    var jsonRes = JSON.parse(text);
    var imageBase64 = '';

    if (jsonRes.candidates && jsonRes.candidates.length > 0 && jsonRes.candidates[0].content) {
      var parts = jsonRes.candidates[0].content.parts || [];
      for (var p = 0; p < parts.length; p++) {
        if (parts[p].inlineData && parts[p].inlineData.data) {
          imageBase64 = 'data:' + (parts[p].inlineData.mimeType || 'image/jpeg') + ';base64,' + parts[p].inlineData.data;
          break;
        }
      }
    }

    if (imageBase64) {
      var driveUrl = saveImageToDrive(imageBase64, 'image/jpeg', 'annotated_' + new Date().getTime() + '.jpg');
      return { url: driveUrl, error: '' };
    }
    return { url: '', error: "Model " + modelName + " không trả về dữ liệu ảnh trong response." };
  } catch (err) {
    Logger.log('⚠️ Lỗi tạo ảnh chú thích AI: ' + err.toString());
    return { url: '', error: err.toString() };
  }
}

function parseGoogleApiError(code, text) {
  if (code === 429 || (text && (text.indexOf('limit: 0') !== -1 || text.indexOf('Quota exceeded') !== -1))) {
    return 'Tài khoản Google API Key miễn phí (Free Tier) có hạn mức tạo ảnh AI = 0 (limit: 0). Google AI Studio yêu cầu tài khoản Google Cloud có bật Billing (Pay-as-you-go) cho tính năng sinh ảnh này. (Bạn vẫn có thể trích từ vựng từ ảnh hoàn toàn miễn phí 100%!)';
  }
  try {
    var json = JSON.parse(text);
    if (json.error) {
      if (json.error.message) return json.error.message;
      if (json.error.status) return json.error.status;
    }
  } catch (e) {}
  return (text || '').substring(0, 200);
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
    next_review_date: formatDateString(row[11]),
    phien_am: row[12] || '',
    link_anh_chu_thich: row[13] || ''
  };
}

// ==========================================
// TÍNH TOÁN STREAK CHUỖI NGÀY HỌC LIÊN TỤC
// ==========================================

// ==========================================
// TÍNH TOÁN STREAK CHUỖI NGÀY HỌC LIÊN TỤC (UTC+7 ASIA/HO_CHI_MINH)
// ==========================================

function calculateUserStreak(userEmail) {
  if (!userEmail) return 0;

  var ss = getOrCreateSpreadsheet();
  var activeDates = {};
  var targetEmail = String(userEmail).trim().toLowerCase();

  // 1. Thu thập danh sách NGÀY DUY NHẤT (unique dates) từ Tab vocab (ngày_thêm)
  var vocabSheet = ss.getSheetByName('vocab');
  if (vocabSheet) {
    var vocabData = vocabSheet.getDataRange().getValues();
    for (var i = 1; i < vocabData.length; i++) {
      var rowEmail = vocabData[i][1];
      if (rowEmail && String(rowEmail).trim().toLowerCase() === targetEmail) {
        var dateStr = formatDateString(vocabData[i][2]);
        if (dateStr && dateStr.length === 10) {
          activeDates[dateStr] = true; // Chỉ đánh dấu ngày có hoạt động, không cộng trùng!
        }
      }
    }
  }

  // 2. Thu thập danh sách NGÀY DUY NHẤT từ Tab review_log (ngày_ôn)
  var logSheet = ss.getSheetByName('review_log');
  if (logSheet) {
    var logData = logSheet.getDataRange().getValues();
    for (var j = 1; j < logData.length; j++) {
      var logEmail = logData[j][1];
      if (logEmail && String(logEmail).trim().toLowerCase() === targetEmail) {
        var dateStr = formatDateString(logData[j][3]);
        if (dateStr && dateStr.length === 10) {
          activeDates[dateStr] = true;
        }
      }
    }
  }

  // 3. Tính chuỗi liên tiếp từ Hôm nay hoặc Hôm qua theo giờ Việt Nam (Asia/Ho_Chi_Minh)
  var now = new Date();
  var todayStr = Utilities.formatDate(now, "Asia/Ho_Chi_Minh", "yyyy-MM-dd");

  var yesterdayMs = now.getTime() - (24 * 60 * 60 * 1000);
  var yesterdayStr = Utilities.formatDate(new Date(yesterdayMs), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");

  var streak = 0;
  var currentCheckTime = null;

  if (activeDates[todayStr]) {
    currentCheckTime = now.getTime();
  } else if (activeDates[yesterdayStr]) {
    currentCheckTime = yesterdayMs;
  }

  if (currentCheckTime !== null) {
    var checkTime = currentCheckTime;
    while (true) {
      var checkDateStr = Utilities.formatDate(new Date(checkTime), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
      if (activeDates[checkDateStr]) {
        streak++;
        checkTime -= (24 * 60 * 60 * 1000); // Lùi đúng 1 ngày
      } else {
        break;
      }
    }
  }

  return streak;
}

function testStreak() {
  var ss = getOrCreateSpreadsheet();
  var usersSheet = ss.getSheetByName('users');
  var usersData = usersSheet.getDataRange().getValues();
  if (usersData.length > 1) {
    var email = usersData[1][1];
    var streak = calculateUserStreak(email);
    var msg = "User: " + email + " | Streak học liên tục theo giờ VN: 🔥 " + streak + " ngày";
    Logger.log(msg);
    return msg;
  }
  return "Chưa có user nào trong Sheet";
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
    throw new Error('Không thể kết nối đến Google Sheet. Vui lòng kiểm tra SPECIFIC_SPREADSHEET_ID ở đầu file Code.gs.');
  }

  // 1. Tab users
  var usersSheet = ss.getSheetByName('users');
  if (!usersSheet) {
    usersSheet = ss.insertSheet('users');
    usersSheet.appendRow(['id', 'email', 'password_hash', 'api_key_gemini', 'ngày_đăng_ký', 'role', 'current_token', 'token_expires_at']);
  }

  // 2. Tab vocab
  var vocabSheet = ss.getSheetByName('vocab');
  if (!vocabSheet) {
    vocabSheet = ss.insertSheet('vocab');
    vocabSheet.appendRow([
      'id', 'user_email', 'ngày_thêm', 'link_ảnh', 'từ/cụm', 
      'loại_từ', 'nghĩa', 'câu_ví_dụ', 'ghi_chú_ngữ_pháp', 
      'ease_factor', 'interval', 'next_review_date', 'phien_am', 'link_anh_chu_thich'
    ]);
  }

  // 3. Tab review_log
  var logSheet = ss.getSheetByName('review_log');
  if (!logSheet) {
    logSheet = ss.insertSheet('review_log');
    logSheet.appendRow(['id', 'user_email', 'vocab_id', 'ngày_ôn', 'kết_quả']);
  }

  // 4. Tab notes
  var notesSheet = ss.getSheetByName('notes');
  if (!notesSheet) {
    notesSheet = ss.insertSheet('notes');
    notesSheet.appendRow([
      'id', 'user_email', 'ngày', 'nội_dung_tiếng_việt', 
      'bản_dịch_tiếng_anh', 'giải_thích_cách_dùng', 
      'cách_nói_khác', 'từ_vựng_liên_quan'
    ]);
  }

  // 5. Tab sessions (Quản lý Multi-Session nhiều thiết bị)
  var sessionsSheet = ss.getSheetByName('sessions');
  if (!sessionsSheet) {
    sessionsSheet = ss.insertSheet('sessions');
    sessionsSheet.appendRow(['token', 'user_email', 'ngày_tạo', 'ngày_hết_hạn', 'thiết_bị']);
  }

  return ss;
}

function getTodayDateString() {
  return Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
}

function getNextDateString(daysToAdd) {
  var targetMs = new Date().getTime() + (daysToAdd * 24 * 60 * 60 * 1000);
  return Utilities.formatDate(new Date(targetMs), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
}

function formatDate(d) {
  if (!d) return '';
  if (!(d instanceof Date)) {
    d = new Date(d);
  }
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
}

function formatDateString(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
  }
  var str = String(val).trim();
  if (str.length > 10 || str.indexOf('T') !== -1) {
    var parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
    }
  }
  return str.substring(0, 10);
}

function respondJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
