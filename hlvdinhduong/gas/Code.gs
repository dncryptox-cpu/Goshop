/**
 * HLV DINH DƯỠNG ULTRA RUNNER - GOOGLE APPS SCRIPT BACKEND
 * Web App Endpoint riêng biệt cho godnc.com/hlvdinhduong
 */

// Đảm bảo tạo đủ 4 sheet nếu chưa tồn tại
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. TAP_LUYEN
  var sheetTapLuyen = ss.getSheetByName('TAP_LUYEN');
  if (!sheetTapLuyen) {
    sheetTapLuyen = ss.insertSheet('TAP_LUYEN');
    sheetTapLuyen.appendRow([
      'Ngay', 'LoaiNgay', 'MonTap', 'QuangDuong_km', 'Elevation_Gain_m', 'ThoiGian_h', 'KcalDot', 'GhiChu'
    ]);
    sheetTapLuyen.getRange('1:1').setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
  }
  
  // 2. DINH_DUONG
  var sheetDinhDuong = ss.getSheetByName('DINH_DUONG');
  if (!sheetDinhDuong) {
    sheetDinhDuong = ss.insertSheet('DINH_DUONG');
    sheetDinhDuong.appendRow([
      'Ngay', 'Bua', 'TenMon', 'Kcal', 'Protein_g', 'Fat_g', 'Carb_g', 'Nguon', 'GhiChu'
    ]);
    sheetDinhDuong.getRange('1:1').setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
  }
  
  // 3. MUC_TIEU_NGAY
  var sheetMucTieu = ss.getSheetByName('MUC_TIEU_NGAY');
  if (!sheetMucTieu) {
    sheetMucTieu = ss.insertSheet('MUC_TIEU_NGAY');
    sheetMucTieu.appendRow([
      'LoaiNgay', 'Kcal_Target', 'Carb_Target_g', 'Protein_Target_g', 'Fat_Target_g'
    ]);
    sheetMucTieu.getRange('1:1').setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    
    sheetMucTieu.appendRow(['Rest', 2900, 375, 120, 75]);
    sheetMucTieu.appendRow(['Thuong', 3500, 525, 120, 75]);
    sheetMucTieu.appendRow(['VertNang', 4500, 750, 120, 80]);
    sheetMucTieu.appendRow(['Peak', 5000, 800, 130, 85]);
  }

  // 4. NGUOI_DUNG
  var sheetNguoiDung = ss.getSheetByName('NGUOI_DUNG');
  if (!sheetNguoiDung) {
    sheetNguoiDung = ss.insertSheet('NGUOI_DUNG');
    sheetNguoiDung.appendRow(['Key', 'Value', 'GhiChu']);
    sheetNguoiDung.getRange('1:1').setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    
    sheetNguoiDung.appendRow(['USER_NAME', 'DNC Ultra Runner', 'Tên vận động viên']);
    sheetNguoiDung.appendRow(['HEIGHT_CM', '170', 'Chiều cao (cm)']);
    sheetNguoiDung.appendRow(['WEIGHT_KG', '65', 'Cân nặng hiện tại (kg)']);
    sheetNguoiDung.appendRow(['WEIGHT_GOAL', '+0.3kg/tuần', 'Mục tiêu tăng cân']);
    sheetNguoiDung.appendRow(['GEMINI_API_KEY', '', 'Gemini API Key lưu mã hóa/đồng bộ']);
  }
  
  var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }
}

// REST GET endpoint
function doGet(e) {
  setupSheets();
  var params = e ? e.parameter : {};
  var action = params.action || 'init';
  var dateStr = params.date || getTodayString();
  
  var responseData = {};
  
  try {
    if (action === 'init' || action === 'get_day') {
      responseData = getDayData(dateStr);
    } else if (action === 'get_weekly' || action === 'get_history') {
      responseData = getHistoryData();
    } else if (action === 'get_targets') {
      responseData = { targets: getTargets() };
    } else if (action === 'get_user_config') {
      responseData = { userConfig: getUserConfig() };
    } else {
      responseData = { error: 'Invalid GET action' };
    }
    return createJsonResponse({ status: 'success', data: responseData });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// REST POST endpoint
function doPost(e) {
  setupSheets();
  try {
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action;
    var result = {};
    
    if (action === 'add_nutrition') {
      result = addNutritionLogs(contents.date || getTodayString(), contents.items || []);
    } else if (action === 'edit_nutrition') {
      result = editNutritionRow(contents.date || getTodayString(), contents.rowIndex, contents.item || {});
    } else if (action === 'add_workout') {
      result = addWorkoutLog(contents.date || getTodayString(), contents.workout || {});
    } else if (action === 'edit_workout') {
      result = editWorkoutRow(contents.date || getTodayString(), contents.rowIndex, contents.workout || {});
    } else if (action === 'set_day_type') {
      result = setDayType(contents.date || getTodayString(), contents.loaiNgay || 'Thuong');
    } else if (action === 'update_targets') {
      result = updateTargets(contents.targets || []);
    } else if (action === 'delete_nutrition') {
      result = deleteNutritionRow(contents.date, contents.rowIndex);
    } else if (action === 'delete_workout') {
      result = deleteWorkoutRow(contents.date, contents.rowIndex);
    } else if (action === 'save_user_config') {
      result = saveUserConfig(contents.config || {});
    } else {
      result = { error: 'Invalid POST action' };
    }
    
    return createJsonResponse({ status: 'success', data: result });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// Helper: Format date string YYYY-MM-DD
function getTodayString() {
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'Asia/Ho_Chi_Minh';
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}

// Response JSON helper
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Lấy danh sách MUC_TIEU_NGAY
function getTargets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('MUC_TIEU_NGAY');
  var data = sheet.getDataRange().getValues();
  var targets = {};
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[0]) {
      targets[row[0].toString().trim()] = {
        loaiNgay: row[0].toString().trim(),
        kcalTarget: Number(row[1]) || 0,
        carbTargetG: Number(row[2]) || 0,
        proteinTargetG: Number(row[3]) || 0,
        fatTargetG: Number(row[4]) || 0
      };
    }
  }
  return targets;
}

// Lấy cấu hình NGUOI_DUNG
function getUserConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('NGUOI_DUNG');
  if (!sheet) return {};
  var data = sheet.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      config[data[i][0].toString().trim()] = data[i][1] ? data[i][1].toString().trim() : '';
    }
  }
  return config;
}

// Lưu cấu hình NGUOI_DUNG
function saveUserConfig(cfg) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('NGUOI_DUNG');
  if (!sheet) {
    setupSheets();
    sheet = ss.getSheetByName('NGUOI_DUNG');
  }

  var keys = Object.keys(cfg);
  keys.forEach(function(k) {
    var val = cfg[k];
    var data = sheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() === k) {
        sheet.getRange(i + 1, 2).setValue(val);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([k, val, 'Cấu hình người dùng']);
    }
  });

  return getUserConfig();
}

// Lấy dữ liệu 1 ngày
function getDayData(dateStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targets = getTargets();
  var userConfig = getUserConfig();
  
  var sheetTL = ss.getSheetByName('TAP_LUYEN');
  var dataTL = sheetTL.getDataRange().getValues();
  var workouts = [];
  var dayType = 'Thuong';
  
  for (var i = 1; i < dataTL.length; i++) {
    var row = dataTL[i];
    var rowDate = formatDateValue(row[0]);
    if (rowDate === dateStr) {
      if (row[1]) dayType = row[1].toString().trim();
      workouts.push({
        rowIndex: i,
        ngay: rowDate,
        loaiNgay: row[1],
        monTap: row[2],
        quangDuongKm: Number(row[3]) || 0,
        elevationGainM: Number(row[4]) || 0,
        thoiGianH: Number(row[5]) || 0,
        kcalDot: Number(row[6]) || 0,
        ghiChu: row[7] || ''
      });
    }
  }
  
  var sheetDD = ss.getSheetByName('DINH_DUONG');
  var dataDD = sheetDD.getDataRange().getValues();
  var nutrition = [];
  var totalKcal = 0, totalProtein = 0, totalFat = 0, totalCarb = 0;
  
  for (var j = 1; j < dataDD.length; j++) {
    var r = dataDD[j];
    var rDate = formatDateValue(r[0]);
    if (rDate === dateStr) {
      var kcal = Number(r[3]) || 0;
      var prot = Number(r[4]) || 0;
      var fat = Number(r[5]) || 0;
      var carb = Number(r[6]) || 0;
      
      totalKcal += kcal;
      totalProtein += prot;
      totalFat += fat;
      totalCarb += carb;
      
      nutrition.push({
        rowIndex: j,
        ngay: rDate,
        bua: r[1] || 'Khác',
        tenMon: r[2] || '',
        kcal: kcal,
        proteinG: prot,
        fatG: fat,
        carbG: carb,
        nguon: r[7] || '',
        ghiChu: r[8] || ''
      });
    }
  }
  
  return {
    date: dateStr,
    dayType: dayType,
    targets: targets[dayType] || targets['Thuong'] || { kcalTarget: 3500, carbTargetG: 525, proteinTargetG: 120, fatTargetG: 75 },
    allTargets: targets,
    userConfig: userConfig,
    summary: {
      totalKcal: totalKcal,
      totalProteinG: totalProtein,
      totalFatG: totalFat,
      totalCarbG: totalCarb
    },
    workouts: workouts,
    nutrition: nutrition
  };
}

// Ghi nhận món ăn
function addNutritionLogs(dateStr, items) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('DINH_DUONG');
  
  items.forEach(function(item) {
    sheet.appendRow([
      dateStr,
      item.bua || 'Phụ',
      item.tenMon || 'Món ăn',
      Number(item.kcal) || 0,
      Number(item.proteinG) || 0,
      Number(item.fatG) || 0,
      Number(item.carbG) || 0,
      item.nguon || 'Text',
      item.ghiChu || ''
    ]);
  });
  
  return getDayData(dateStr);
}

// Chỉnh sửa dòng món ăn
function editNutritionRow(dateStr, rowIndex, item) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('DINH_DUONG');
  if (rowIndex > 0) {
    var sheetRow = rowIndex + 1; // 1-indexed header
    sheet.getRange(sheetRow, 2).setValue(item.bua || 'Phụ');
    sheet.getRange(sheetRow, 3).setValue(item.tenMon || '');
    sheet.getRange(sheetRow, 4).setValue(Number(item.kcal) || 0);
    sheet.getRange(sheetRow, 5).setValue(Number(item.proteinG) || 0);
    sheet.getRange(sheetRow, 6).setValue(Number(item.fatG) || 0);
    sheet.getRange(sheetRow, 7).setValue(Number(item.carbG) || 0);
    if (item.ghiChu !== undefined) sheet.getRange(sheetRow, 9).setValue(item.ghiChu);
  }
  return getDayData(dateStr);
}

// Ghi nhận bài tập
function addWorkoutLog(dateStr, workout) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TAP_LUYEN');
  
  sheet.appendRow([
    dateStr,
    workout.loaiNgay || 'Thuong',
    workout.monTap || 'Chạy bộ',
    Number(workout.quangDuongKm) || 0,
    Number(workout.elevationGainM) || 0,
    Number(workout.thoiGianH) || 0,
    Number(workout.kcalDot) || 0,
    workout.ghiChu || ''
  ]);
  
  return getDayData(dateStr);
}

// Chỉnh sửa dòng bài tập
function editWorkoutRow(dateStr, rowIndex, workout) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TAP_LUYEN');
  if (rowIndex > 0) {
    var sheetRow = rowIndex + 1;
    sheet.getRange(sheetRow, 3).setValue(workout.monTap || 'Chạy bộ');
    sheet.getRange(sheetRow, 4).setValue(Number(workout.quangDuongKm) || 0);
    sheet.getRange(sheetRow, 5).setValue(Number(workout.elevationGainM) || 0);
    sheet.getRange(sheetRow, 6).setValue(Number(workout.thoiGianH) || 0);
    sheet.getRange(sheetRow, 7).setValue(Number(workout.kcalDot) || 0);
    if (workout.ghiChu !== undefined) sheet.getRange(sheetRow, 8).setValue(workout.ghiChu);
  }
  return getDayData(dateStr);
}

// Set LoaiNgay cho ngày hiện tại
function setDayType(dateStr, loaiNgay) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TAP_LUYEN');
  var data = sheet.getDataRange().getValues();
  var updated = false;
  
  for (var i = 1; i < data.length; i++) {
    if (formatDateValue(data[i][0]) === dateStr) {
      sheet.getRange(i + 1, 2).setValue(loaiNgay);
      updated = true;
    }
  }
  
  if (!updated) {
    sheet.appendRow([dateStr, loaiNgay, 'Khởi tạo ngày', 0, 0, 0, 0, 'Set loại ngày']);
  }
  
  return getDayData(dateStr);
}

// Cập nhật bảng MUC_TIEU_NGAY
function updateTargets(targetsArray) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('MUC_TIEU_NGAY');
  sheet.clearContents();
  sheet.appendRow(['LoaiNgay', 'Kcal_Target', 'Carb_Target_g', 'Protein_Target_g', 'Fat_Target_g']);
  sheet.getRange('1:1').setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
  
  targetsArray.forEach(function(t) {
    sheet.appendRow([t.loaiNgay, t.kcalTarget, t.carbTargetG, t.proteinTargetG, t.fatTargetG]);
  });
  
  return getTargets();
}

// Delete nutrition row
function deleteNutritionRow(dateStr, rowIndex) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('DINH_DUONG');
  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex + 1);
  }
  return getDayData(dateStr);
}

// Delete workout row
function deleteWorkoutRow(dateStr, rowIndex) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TAP_LUYEN');
  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex + 1);
  }
  return getDayData(dateStr);
}

// Thống kê lịch sử chi tiết cho Nhật ký Đủ/Thiếu + Chi tiết ngày
function getHistoryData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetTL = ss.getSheetByName('TAP_LUYEN');
  var sheetDD = ss.getSheetByName('DINH_DUONG');
  var targets = getTargets();
  
  var dataTL = sheetTL.getDataRange().getValues();
  var dataDD = sheetDD.getDataRange().getValues();
  
  var daysMap = {};
  
  // Aggregate workouts
  for (var i = 1; i < dataTL.length; i++) {
    var dStr = formatDateValue(dataTL[i][0]);
    if (!dStr) continue;
    if (!daysMap[dStr]) {
      daysMap[dStr] = {
        date: dStr,
        loaiNgay: dataTL[i][1] || 'Thuong',
        totalKm: 0,
        totalGainM: 0,
        totalTimeH: 0,
        totalKcalBurned: 0,
        totalKcalEaten: 0,
        totalCarbG: 0,
        totalProteinG: 0,
        totalFatG: 0,
        nutritionItems: [],
        workoutItems: []
      };
    }
    var lNgay = dataTL[i][1] ? dataTL[i][1].toString().trim() : '';
    if (lNgay && lNgay !== 'Khởi tạo ngày') daysMap[dStr].loaiNgay = lNgay;
    
    var km = Number(dataTL[i][3]) || 0;
    var gain = Number(dataTL[i][4]) || 0;
    var timeH = Number(dataTL[i][5]) || 0;
    var kcalDot = Number(dataTL[i][6]) || 0;

    daysMap[dStr].totalKm += km;
    daysMap[dStr].totalGainM += gain;
    daysMap[dStr].totalTimeH += timeH;
    daysMap[dStr].totalKcalBurned += kcalDot;

    if (km > 0 || gain > 0 || kcalDot > 0) {
      daysMap[dStr].workoutItems.push({
        monTap: dataTL[i][2] || 'Chạy bộ',
        quangDuongKm: km,
        elevationGainM: gain,
        thoiGianH: timeH,
        kcalDot: kcalDot,
        ghiChu: dataTL[i][7] || ''
      });
    }
  }
  
  // Aggregate nutrition
  for (var j = 1; j < dataDD.length; j++) {
    var dStr2 = formatDateValue(dataDD[j][0]);
    if (!dStr2) continue;
    if (!daysMap[dStr2]) {
      daysMap[dStr2] = {
        date: dStr2,
        loaiNgay: 'Thuong',
        totalKm: 0,
        totalGainM: 0,
        totalTimeH: 0,
        totalKcalBurned: 0,
        totalKcalEaten: 0,
        totalCarbG: 0,
        totalProteinG: 0,
        totalFatG: 0,
        nutritionItems: [],
        workoutItems: []
      };
    }
    
    var k = Number(dataDD[j][3]) || 0;
    var p = Number(dataDD[j][4]) || 0;
    var f = Number(dataDD[j][5]) || 0;
    var c = Number(dataDD[j][6]) || 0;

    daysMap[dStr2].totalKcalEaten += k;
    daysMap[dStr2].totalProteinG += p;
    daysMap[dStr2].totalFatG += f;
    daysMap[dStr2].totalCarbG += c;

    daysMap[dStr2].nutritionItems.push({
      bua: dataDD[j][1] || 'Phụ',
      tenMon: dataDD[j][2] || '',
      kcal: k,
      proteinG: p,
      fatG: f,
      carbG: c,
      nguon: dataDD[j][7] || '',
      ghiChu: dataDD[j][8] || ''
    });
  }
  
  var sortedDates = Object.keys(daysMap).sort().reverse();
  var historyList = sortedDates.map(function(k) {
    var item = daysMap[k];
    var dayTarget = targets[item.loaiNgay] || targets['Thuong'] || { kcalTarget: 3500, carbTargetG: 525, proteinTargetG: 120, fatTargetG: 75 };
    item.target = dayTarget;
    return item;
  });
  
  return { historyLogs: historyList, allTargets: targets };
}

// Format date helper
function formatDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'Asia/Ho_Chi_Minh';
    return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
  }
  return val.toString().trim().substring(0, 10);
}
