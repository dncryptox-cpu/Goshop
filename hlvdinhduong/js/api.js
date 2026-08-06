/**
 * Google Apps Script Web App API Interface
 * Gửi và nhận dữ liệu từ Google Sheets độc lập + Đồng bộ đa thiết bị
 */

class HlvApi {
  constructor() {
    this.storageKeyUrl = 'hlv_gas_web_app_url';
    this.storageKeyLocalData = 'hlv_local_mock_data';
    this.storageKeyUserName = 'hlv_user_name';
    
    // Tự động kiểm tra URL hash để nhập cấu hình 1-Click từ máy khác
    this.checkSyncHashInUrl();
  }

  getWebAppUrl() {
    return localStorage.getItem(this.storageKeyUrl) || '';
  }

  setWebAppUrl(url) {
    localStorage.setItem(this.storageKeyUrl, url.trim());
  }

  getUserName() {
    return localStorage.getItem(this.storageKeyUserName) || 'Ultra Runner DNC';
  }

  setUserName(name) {
    localStorage.setItem(this.storageKeyUserName, name.trim());
  }

  /**
   * Tạo 1-Click Sync Link để gửi sang điện thoại hoặc máy tính khác
   */
  generateSyncLink() {
    const webAppUrl = this.getWebAppUrl();
    const geminiKey = window.geminiParser ? window.geminiParser.getApiKey() : '';
    const userName = this.getUserName();

    const payload = {
      u: webAppUrl,
      k: geminiKey,
      n: userName,
      t: Date.now()
    };

    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}#sync=${encoded}`;
  }

  /**
   * Kiểm tra URL Hash khi mở trang trên máy mới
   */
  checkSyncHashInUrl() {
    const hash = window.location.hash;
    if (hash && hash.includes('sync=')) {
      try {
        const rawEncoded = hash.split('sync=')[1];
        const jsonStr = decodeURIComponent(atob(rawEncoded));
        const data = JSON.parse(jsonStr);

        if (data.u) this.setWebAppUrl(data.u);
        if (data.k && window.geminiParser) window.geminiParser.setApiKey(data.k);
        if (data.n) this.setUserName(data.n);

        // Clear hash clean URL
        window.history.replaceState(null, null, window.location.pathname);
        alert('🎉 Đã đồng bộ cấu hình tự động từ Link thiết bị!');
      } catch (err) {
        console.error('Lỗi giải mã sync hash:', err);
      }
    }
  }

  /**
   * Helper gửi GET request đến Apps Script Web App
   */
  async get(action, params = {}) {
    const webAppUrl = this.getWebAppUrl();
    
    if (!webAppUrl) {
      console.warn('Chưa cấu hình Google Apps Script Web App URL. Sử dụng dữ liệu tạm thời (Local Storage).');
      return this.getLocalMockData(action, params);
    }

    const queryParams = new URLSearchParams({ action, ...params }).toString();
    const fullUrl = `${webAppUrl}?${queryParams}`;

    try {
      const res = await fetch(fullUrl, { method: 'GET' });
      if (!res.ok) throw new Error(`Lỗi HTTP GET: ${res.status}`);
      const json = await res.json();
      if (json.status === 'error') throw new Error(json.message);
      return json.data;
    } catch (err) {
      console.error('GET request error:', err);
      return this.getLocalMockData(action, params);
    }
  }

  /**
   * Helper gửi POST request đến Apps Script Web App
   */
  async post(action, payload = {}) {
    const webAppUrl = this.getWebAppUrl();
    const dataToSend = { action, ...payload };

    if (!webAppUrl) {
      console.warn('Chưa cấu hình Web App URL. Lưu dữ liệu vào Local Storage tạm thời.');
      return this.saveLocalMockData(action, payload);
    }

    try {
      const res = await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(dataToSend)
      });

      if (!res.ok) throw new Error(`Lỗi HTTP POST: ${res.status}`);
      const json = await res.json();
      if (json.status === 'error') throw new Error(json.message);
      return json.data;
    } catch (err) {
      console.error('POST request error:', err);
      return this.saveLocalMockData(action, payload);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* LOCAL MOCK STORAGE (Fallback khi chưa kết nối Sheets)                       */
  /* -------------------------------------------------------------------------- */

  getInitialLocalState() {
    return {
      date: new Date().toISOString().split('T')[0],
      dayType: 'Thuong',
      userConfig: {
        USER_NAME: 'DNC Ultra Runner',
        HEIGHT_CM: '170',
        WEIGHT_KG: '65',
        WEIGHT_GOAL: '+0.3kg/tuần'
      },
      allTargets: {
        Rest: { loaiNgay: 'Rest', kcalTarget: 2900, carbTargetG: 375, proteinTargetG: 120, fatTargetG: 75 },
        Thuong: { loaiNgay: 'Thuong', kcalTarget: 3500, carbTargetG: 525, proteinTargetG: 120, fatTargetG: 75 },
        VertNang: { loaiNgay: 'VertNang', kcalTarget: 4500, carbTargetG: 750, proteinTargetG: 120, fatTargetG: 80 },
        Peak: { loaiNgay: 'Peak', kcalTarget: 5000, carbTargetG: 800, proteinTargetG: 130, fatTargetG: 85 }
      },
      nutritionLogs: [],
      workoutLogs: []
    };
  }

  getLocalState() {
    const raw = localStorage.getItem(this.storageKeyLocalData);
    if (!raw) {
      const initial = this.getInitialLocalState();
      localStorage.setItem(this.storageKeyLocalData, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  }

  saveLocalState(state) {
    localStorage.setItem(this.storageKeyLocalData, JSON.stringify(state));
  }

  getLocalMockData(action, params) {
    const state = this.getLocalState();
    const dateStr = params.date || new Date().toISOString().split('T')[0];

    const nutritionToday = state.nutritionLogs.filter(item => item.ngay === dateStr);
    const workoutsToday = state.workoutLogs.filter(w => w.ngay === dateStr);

    let totalKcal = 0, totalProtein = 0, totalFat = 0, totalCarb = 0;
    nutritionToday.forEach(item => {
      totalKcal += item.kcal || 0;
      totalProtein += item.proteinG || 0;
      totalFat += item.fatG || 0;
      totalCarb += item.carbG || 0;
    });

    const dayType = state.dayType || 'Thuong';
    const currentTarget = state.allTargets[dayType] || state.allTargets['Thuong'];

    if (action === 'get_weekly') {
      return {
        weeklyLogs: [
          { date: dateStr, totalKm: workoutsToday.reduce((a,b)=>a+(b.quangDuongKm||0),0), totalGainM: workoutsToday.reduce((a,b)=>a+(b.elevationGainM||0),0), totalTimeH: workoutsToday.reduce((a,b)=>a+(b.thoiGianH||0),0), totalKcalBurned: workoutsToday.reduce((a,b)=>a+(b.kcalDot||0),0), totalKcalEaten: totalKcal, totalCarbG: totalCarb, loaiNgay: dayType }
        ]
      };
    }

    return {
      date: dateStr,
      dayType: dayType,
      targets: currentTarget,
      allTargets: state.allTargets,
      userConfig: state.userConfig || {},
      summary: {
        totalKcal,
        totalProteinG: totalProtein,
        totalFatG: totalFat,
        totalCarbG: totalCarb
      },
      workouts: workoutsToday,
      nutrition: nutritionToday
    };
  }

  saveLocalMockData(action, payload) {
    const state = this.getLocalState();
    const dateStr = payload.date || new Date().toISOString().split('T')[0];

    if (action === 'set_day_type') {
      state.dayType = payload.loaiNgay;
    } else if (action === 'add_nutrition') {
      (payload.items || []).forEach((item) => {
        state.nutritionLogs.push({
          rowIndex: state.nutritionLogs.length + 1,
          ngay: dateStr,
          bua: item.bua || 'Phụ',
          tenMon: item.tenMon || 'Món ăn',
          kcal: Number(item.kcal) || 0,
          proteinG: Number(item.proteinG) || 0,
          fatG: Number(item.fatG) || 0,
          carbG: Number(item.carbG) || 0,
          nguon: item.nguon || 'Text',
          ghiChu: item.ghiChu || ''
        });
      });
    } else if (action === 'add_workout') {
      state.workoutLogs.push({
        rowIndex: state.workoutLogs.length + 1,
        ngay: dateStr,
        loaiNgay: state.dayType,
        monTap: payload.workout.monTap || 'Chạy bộ',
        quangDuongKm: Number(payload.workout.quangDuongKm) || 0,
        elevationGainM: Number(payload.workout.elevationGainM) || 0,
        thoiGianH: Number(payload.workout.thoiGianH) || 0,
        kcalDot: Number(payload.workout.kcalDot) || 0,
        ghiChu: payload.workout.ghiChu || ''
      });
    } else if (action === 'delete_nutrition') {
      state.nutritionLogs = state.nutritionLogs.filter((_, idx) => idx !== payload.rowIndex);
    } else if (action === 'delete_workout') {
      state.workoutLogs = state.workoutLogs.filter((_, idx) => idx !== payload.rowIndex);
    } else if (action === 'save_user_config') {
      state.userConfig = { ...state.userConfig, ...(payload.config || {}) };
    }

    this.saveLocalState(state);
    return this.getLocalMockData('get_day', { date: dateStr });
  }
}

window.hlvApi = new HlvApi();
