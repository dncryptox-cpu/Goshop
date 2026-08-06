/**
 * HLV DINH DƯỠNG ULTRA RUNNER - GOOGLE APPS SCRIPT BACKEND
 * Web App Endpoint riêng biệt cho godnc.com/hlvdinhduong
 */

// Đảm bảo tạo đủ 3 sheet nếu chưa tồn tại
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
    
    // Thêm dữ liệu mặc định cho MUC_TIEU_NGAY
    sheetMucTieu.appendRow(['Rest', 2900, 375, 120, 75]);
    sheetMucTieu.appendRow(['Thuong', 3500, 525, 120, 75]);
    sheetMucTieu.appendRow(['VertNang', 4500, 750, 120, 80]);
    sheetMucTieu.appendRow(['Peak', 5000, 800, 130, 85]);
  }
  
  // Xóa Sheet1 mặc định nếu có nhiều hơn 1 sheet
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
    } else if (action === 'get_weekly') {
      responseData = getWeeklyData();
    } else if (action === 'get_targets') {
      responseData = { targets: getTargets() };
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
    } else if (action === 'add_workout') {
      result = addWorkoutLog(contents.date || getTodayString(), contents.workout || {});
    } else if (action === 'set_day_type') {
      result = setDayType(contents.date || getTodayString(), contents.loaiNgay || 'Thuong');
    } else if (action === 'update_targets') {
      result = updateTargets(contents.targets || []);
    } else if (action === 'delete_nutrition') {
      result = deleteNutritionRow(contents.date, contents.rowIndex);
    } else if (action === 'delete_workout') {
      result = deleteWorkoutRow(contents.date, contents.rowIndex);
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

// Lấy dữ liệu 1 ngày
function getDayData(dateStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targets = getTargets();
  
  // Read TAP_LUYEN
  var sheetTL = ss.getSheetByName('TAP_LUYEN');
  var dataTL = sheetTL.getDataRange().getValues();
  var workouts = [];
  var dayType = 'Thuong'; // Default
  
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
  
  // Read DINH_DUONG
  var sheetDD = ss.getSheetByName('DINH_DUONG');
  var dataDD = sheetDD.getDataRange().getValues();
  var nutrition = [];
  var totalKcal = 0, totalProtein = 0, totalFat = 0, totalCarb = 0;
  
  for (var j = 1; j < dataDD.length; i++, j++) {
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

// Thống kê 7 ngày gần nhất
function getWeeklyData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetTL = ss.getSheetByName('TAP_LUYEN');
  var sheetDD = ss.getSheetByName('DINH_DUONG');
  
  var dataTL = sheetTL.getDataRange().getValues();
  var dataDD = sheetDD.getDataRange().getValues();
  
  var daysMap = {};
  
  // Aggregate workouts
  for (var i = 1; i < dataTL.length; i++) {
    var dStr = formatDateValue(dataTL[i][0]);
    if (!dStr) continue;
    if (!daysMap[dStr]) {
      daysMap[dStr] = { date: dStr, totalKm: 0, totalGainM: 0, totalTimeH: 0, totalKcalBurned: 0, totalKcalEaten: 0, totalCarbG: 0, loaiNgay: dataTL[i][1] || 'Thuong' };
    }
    daysMap[dStr].totalKm += Number(dataTL[i][3]) || 0;
    daysMap[dStr].totalGainM += Number(dataTL[i][4]) || 0;
    daysMap[dStr].totalTimeH += Number(dataTL[i][5]) || 0;
    daysMap[dStr].totalKcalBurned += Number(dataTL[i][6]) || 0;
  }
  
  // Aggregate nutrition
  for (var j = 1; j < dataDD.length; j++) {
    var dStr2 = formatDateValue(dataDD[j][0]);
    if (!dStr2) continue;
    if (!daysMap[dStr2]) {
      daysMap[dStr2] = { date: dStr2, totalKm: 0, totalGainM: 0, totalTimeH: 0, totalKcalBurned: 0, totalKcalEaten: 0, totalCarbG: 0, loaiNgay: 'Thuong' };
    }
    daysMap[dStr2].totalKcalEaten += Number(dataDD[j][3]) || 0;
    daysMap[dStr2].totalCarbG += Number(dataDD[j][6]) || 0;
  }
  
  var sortedDates = Object.keys(daysMap).sort().reverse().slice(0, 14); // 14 ngày gần nhất
  var list = sortedDates.map(function(k) { return daysMap[k]; });
  
  return { weeklyLogs: list };
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
