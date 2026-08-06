/**
 * HLV DINH DƯỠNG ULTRA RUNNER - APPLICATION CONTROLLER
 * Điều khiển UI, State, Tính toán Calo/Carb và Tích hợp Gemini & Sheets & Đồng bộ Người dùng
 */

document.addEventListener('DOMContentLoaded', () => {
  const app = {
    currentDate: new Date().toISOString().split('T')[0],
    currentDayType: 'Thuong',
    todayData: null,
    pendingAiParsedResult: null,
    currentImageBase64: null,
    currentImageMime: null,

    init() {
      this.cacheDom();
      this.bindEvents();
      this.loadSettings();
      this.loadTodayData();
      this.updateSyncLinkUI();
    },

    cacheDom() {
      // Date Picker & Day Type
      this.dateInput = document.getElementById('dateInput');
      this.dateInput.value = this.currentDate;
      this.dayTypeButtons = document.querySelectorAll('.btn-day');

      // Metric Elements
      this.valKcal = document.getElementById('valKcal');
      this.subKcal = document.getElementById('subKcal');
      this.fillKcal = document.getElementById('fillKcal');

      this.valCarb = document.getElementById('valCarb');
      this.subCarb = document.getElementById('subCarb');
      this.fillCarb = document.getElementById('fillCarb');

      this.valProtein = document.getElementById('valProtein');
      this.subProtein = document.getElementById('subProtein');
      this.fillProtein = document.getElementById('fillProtein');

      this.valFat = document.getElementById('valFat');
      this.subFat = document.getElementById('subFat');
      this.fillFat = document.getElementById('fillFat');

      // Alert Banner
      this.alertBanner = document.getElementById('alertBanner');

      // Input Tabs & Elements
      this.inputTabBtns = document.querySelectorAll('.input-tab-btn');
      this.tabTextInput = document.getElementById('tabTextInput');
      this.tabImageInput = document.getElementById('tabImageInput');
      this.smartTextInput = document.getElementById('smartTextInput');
      
      this.imageDropzone = document.getElementById('imageDropzone');
      this.imageFileInput = document.getElementById('imageFileInput');
      this.imagePreview = document.getElementById('imagePreview');
      this.imageNoteInput = document.getElementById('imageNoteInput');

      this.btnAnalyzeAi = document.getElementById('btnAnalyzeAi');

      // AI Preview Box
      this.reviewBox = document.getElementById('reviewBox');
      this.reviewContent = document.getElementById('reviewContent');
      this.btnConfirmSave = document.getElementById('btnConfirmSave');
      this.btnCancelReview = document.getElementById('btnCancelReview');

      // Logs & Table & User View
      this.mainTabBtns = document.querySelectorAll('.main-tab');
      this.tabNutritionView = document.getElementById('tabNutritionView');
      this.tabWorkoutView = document.getElementById('tabWorkoutView');
      this.tabWeeklyView = document.getElementById('tabWeeklyView');
      this.tabUserView = document.getElementById('tabUserView');

      this.nutritionTableBody = document.getElementById('nutritionTableBody');
      this.workoutTableBody = document.getElementById('workoutTableBody');
      this.weeklyTableBody = document.getElementById('weeklyTableBody');

      // User Profile & Sync Elements
      this.headerUserName = document.getElementById('headerUserName');
      this.btnUserBadge = document.getElementById('btnUserBadge');
      this.userNameInput = document.getElementById('userNameInput');
      this.userHeightInput = document.getElementById('userHeightInput');
      this.userWeightInput = document.getElementById('userWeightInput');
      this.userGoalInput = document.getElementById('userGoalInput');
      this.btnSaveUserProfile = document.getElementById('btnSaveUserProfile');
      
      this.syncLinkInput = document.getElementById('syncLinkInput');
      this.btnCopySyncLink = document.getElementById('btnCopySyncLink');
      this.btnFetchCloudConfig = document.getElementById('btnFetchCloudConfig');
      this.btnModalSyncLink = document.getElementById('btnModalSyncLink');

      // Settings Modal
      this.btnOpenSettings = document.getElementById('btnOpenSettings');
      this.btnCloseSettings = document.getElementById('btnCloseSettings');
      this.settingsModal = document.getElementById('settingsModal');
      this.webAppUrlInput = document.getElementById('webAppUrlInput');
      this.geminiKeyInput = document.getElementById('geminiKeyInput');
      this.btnSaveSettings = document.getElementById('btnSaveSettings');
    },

    bindEvents() {
      // Date Selector
      this.dateInput.addEventListener('change', (e) => {
        this.currentDate = e.target.value;
        this.loadTodayData();
      });

      // Day Type Selector Buttons
      this.dayTypeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const type = btn.dataset.type;
          this.setDayType(type);
        });
      });

      // Input Sub-tabs (Text vs Image)
      this.inputTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.inputTabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const tabMode = btn.dataset.tab;
          if (tabMode === 'text') {
            this.tabTextInput.style.display = 'block';
            this.tabImageInput.style.display = 'none';
          } else {
            this.tabTextInput.style.display = 'none';
            this.tabImageInput.style.display = 'block';
          }
        });
      });

      // Image Upload / Dropzone / Clipboard Paste
      this.imageDropzone.addEventListener('click', () => this.imageFileInput.click());
      this.imageFileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));

      this.imageDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.imageDropzone.classList.add('dragover');
      });
      this.imageDropzone.addEventListener('dragleave', () => this.imageDropzone.classList.remove('dragover'));
      this.imageDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        this.imageDropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) this.handleFileSelect(e.dataTransfer.files[0]);
      });

      // Paste image from clipboard anywhere in document
      document.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let item of items) {
          if (item.type.indexOf('image') === 0) {
            const blob = item.getAsFile();
            this.handleFileSelect(blob);
            this.inputTabBtns[1].click();
            break;
          }
        }
      });

      // AI Analyze Trigger
      this.btnAnalyzeAi.addEventListener('click', () => this.analyzeWithAi());

      // Save AI Parsed Result
      this.btnConfirmSave.addEventListener('click', () => this.savePendingAiResult());
      this.btnCancelReview.addEventListener('click', () => {
        this.reviewBox.style.display = 'none';
        this.pendingAiParsedResult = null;
      });

      // Main Navigation Tabs
      this.mainTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.mainTabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const target = btn.dataset.view;
          
          this.tabNutritionView.style.display = target === 'nutrition' ? 'block' : 'none';
          this.tabWorkoutView.style.display = target === 'workout' ? 'block' : 'none';
          this.tabWeeklyView.style.display = target === 'weekly' ? 'block' : 'none';
          this.tabUserView.style.display = target === 'user' ? 'block' : 'none';

          if (target === 'weekly') {
            this.loadWeeklyData();
          } else if (target === 'user') {
            this.updateSyncLinkUI();
          }
        });
      });

      // Header User Badge click -> Switch to User Tab
      this.btnUserBadge.addEventListener('click', () => {
        const userTab = Array.from(this.mainTabBtns).find(b => b.dataset.view === 'user');
        if (userTab) userTab.click();
      });

      // Save User Profile to Google Sheets
      this.btnSaveUserProfile.addEventListener('click', () => this.saveUserProfile());

      // Copy 1-Click Sync Link
      this.btnCopySyncLink.addEventListener('click', () => this.copySyncLink());
      this.btnModalSyncLink.addEventListener('click', () => this.copySyncLink());

      // Fetch Cloud Config from Sheets
      this.btnFetchCloudConfig.addEventListener('click', () => this.fetchCloudUserConfig());

      // Settings Modal Events
      this.btnOpenSettings.addEventListener('click', () => this.settingsModal.classList.add('active'));
      this.btnCloseSettings.addEventListener('click', () => this.settingsModal.classList.remove('active'));
      this.btnSaveSettings.addEventListener('click', () => this.saveSettings());
    },

    loadSettings() {
      this.webAppUrlInput.value = window.hlvApi.getWebAppUrl();
      this.geminiKeyInput.value = window.geminiParser.getApiKey();
      this.userNameInput.value = window.hlvApi.getUserName();
      this.headerUserName.textContent = window.hlvApi.getUserName();
    },

    saveSettings() {
      const url = this.webAppUrlInput.value.trim();
      const key = this.geminiKeyInput.value.trim();

      window.hlvApi.setWebAppUrl(url);
      window.geminiParser.setApiKey(key);

      this.settingsModal.classList.remove('active');
      this.updateSyncLinkUI();
      alert('Đã lưu cấu hình thành công!');
      this.loadTodayData();
    },

    updateSyncLinkUI() {
      const syncUrl = window.hlvApi.generateSyncLink();
      this.syncLinkInput.value = syncUrl;
    },

    copySyncLink() {
      const link = window.hlvApi.generateSyncLink();
      navigator.clipboard.writeText(link).then(() => {
        alert('📋 Đã copy Link Đồng Bộ 1-Click vào bộ nhớ tạm!\nBạn có thể dán (Paste) link này sang Zalo/Messenger để mở trên điện thoại hoặc máy tính khác.');
      }).catch(() => {
        this.syncLinkInput.select();
        document.execCommand('copy');
        alert('📋 Đã copy Link Đồng Bộ!');
      });
    },

    async saveUserProfile() {
      const name = this.userNameInput.value.trim() || 'Ultra Runner DNC';
      const height = this.userHeightInput.value.trim();
      const weight = this.userWeightInput.value.trim();
      const goal = this.userGoalInput.value.trim();

      window.hlvApi.setUserName(name);
      this.headerUserName.textContent = name;

      try {
        await window.hlvApi.post('save_user_config', {
          config: {
            USER_NAME: name,
            HEIGHT_CM: height,
            WEIGHT_KG: weight,
            WEIGHT_GOAL: goal,
            GEMINI_API_KEY: window.geminiParser.getApiKey()
          }
        });
        this.updateSyncLinkUI();
        alert('💾 Đã lưu thông tin cá nhân lên Google Sheets thành công!');
      } catch (err) {
        alert('Lỗi lưu cấu hình: ' + err.message);
      }
    },

    async fetchCloudUserConfig() {
      try {
        const data = await window.hlvApi.get('get_user_config');
        const cfg = data.userConfig || {};

        if (cfg.USER_NAME) {
          this.userNameInput.value = cfg.USER_NAME;
          window.hlvApi.setUserName(cfg.USER_NAME);
          this.headerUserName.textContent = cfg.USER_NAME;
        }
        if (cfg.HEIGHT_CM) this.userHeightInput.value = cfg.HEIGHT_CM;
        if (cfg.WEIGHT_KG) this.userWeightInput.value = cfg.WEIGHT_KG;
        if (cfg.WEIGHT_GOAL) this.userGoalInput.value = cfg.WEIGHT_GOAL;
        if (cfg.GEMINI_API_KEY && !window.geminiParser.getApiKey()) {
          window.geminiParser.setApiKey(cfg.GEMINI_API_KEY);
          this.geminiKeyInput.value = cfg.GEMINI_API_KEY;
        }

        alert('☁️ Đã đồng bộ cấu hình từ Google Sheets về thiết bị này thành công!');
      } catch (err) {
        alert('Lỗi đồng bộ: ' + err.message);
      }
    },

    handleFileSelect(file) {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.currentImageBase64 = e.target.result;
        this.currentImageMime = file.type;
        this.imagePreview.src = e.target.result;
        this.imagePreview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    },

    async setDayType(loaiNgay) {
      this.currentDayType = loaiNgay;
      this.updateDayButtonsUI(loaiNgay);

      try {
        const res = await window.hlvApi.post('set_day_type', {
          date: this.currentDate,
          loaiNgay: loaiNgay
        });
        this.renderDashboard(res);
      } catch (err) {
        console.error(err);
      }
    },

    updateDayButtonsUI(activeType) {
      this.dayTypeButtons.forEach(btn => {
        if (btn.dataset.type === activeType) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    },

    async loadTodayData() {
      try {
        const data = await window.hlvApi.get('get_day', { date: this.currentDate });
        this.renderDashboard(data);
      } catch (err) {
        console.error('Lỗi load dữ liệu ngày:', err);
      }
    },

    renderDashboard(data) {
      if (!data) return;
      this.todayData = data;
      this.currentDayType = data.dayType || 'Thuong';
      this.updateDayButtonsUI(this.currentDayType);

      // Load user config if returned
      if (data.userConfig) {
        if (data.userConfig.USER_NAME) {
          this.headerUserName.textContent = data.userConfig.USER_NAME;
          this.userNameInput.value = data.userConfig.USER_NAME;
        }
        if (data.userConfig.HEIGHT_CM) this.userHeightInput.value = data.userConfig.HEIGHT_CM;
        if (data.userConfig.WEIGHT_KG) this.userWeightInput.value = data.userConfig.WEIGHT_KG;
        if (data.userConfig.WEIGHT_GOAL) this.userGoalInput.value = data.userConfig.WEIGHT_GOAL;
      }

      const summary = data.summary || { totalKcal: 0, totalCarbG: 0, totalProteinG: 0, totalFatG: 0 };
      const target = data.targets || { kcalTarget: 3500, carbTargetG: 525, proteinTargetG: 120, fatTargetG: 75 };

      // 1. Render Progress Bars & Metrics
      this.renderMetricCard(
        this.valKcal, this.subKcal, this.fillKcal,
        summary.totalKcal, target.kcalTarget, 'kcal'
      );

      this.renderMetricCard(
        this.valCarb, this.subCarb, this.fillCarb,
        summary.totalCarbG, target.carbTargetG, 'g'
      );

      this.renderMetricCard(
        this.valProtein, this.subProtein, this.fillProtein,
        summary.totalProteinG, target.proteinTargetG, 'g'
      );

      this.renderMetricCard(
        this.valFat, this.subFat, this.fillFat,
        summary.totalFatG, target.fatTargetG, 'g'
      );

      // 2. Render Recovery Carb Advice (Workout KcalBurned > 2000)
      const heavyWorkout = (data.workouts || []).some(w => (w.kcalDot || 0) > 2000);
      if (heavyWorkout) {
        this.alertBanner.classList.remove('hidden');
      } else {
        this.alertBanner.classList.add('hidden');
      }

      // 3. Render Logs Tables
      this.renderNutritionTable(data.nutrition || []);
      this.renderWorkoutTable(data.workouts || []);
    },

    renderMetricCard(valEl, subEl, fillEl, current, target, unit) {
      const remaining = target - current;
      const pct = Math.min(Math.round((current / target) * 100), 100);

      valEl.textContent = `${current.toLocaleString()} ${unit}`;
      
      if (remaining > 0) {
        subEl.innerHTML = `<span>Target: ${target.toLocaleString()} ${unit}</span> <span class="remaining">Còn thiếu: ${remaining.toLocaleString()} ${unit} (${pct}%)</span>`;
      } else {
        subEl.innerHTML = `<span>Target: ${target.toLocaleString()} ${unit}</span> <span class="remaining" style="color:#10b981;">Đạt target! (${pct}%)</span>`;
      }

      fillEl.style.width = `${pct}%`;
    },

    renderNutritionTable(items) {
      if (!items.length) {
        this.nutritionTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-sub);">Chưa có ghi nhận dinh dưỡng nào trong ngày.</td></tr>`;
        return;
      }

      this.nutritionTableBody.innerHTML = items.map((item, index) => `
        <tr>
          <td><span class="badge badge-bua">${item.bua || 'Phụ'}</span></td>
          <td><strong>${item.tenMon || ''}</strong></td>
          <td class="mono" style="color:var(--accent-kcal);">${item.kcal || 0}</td>
          <td class="mono" style="color:var(--accent-carb);">${item.carbG || 0}g</td>
          <td class="mono" style="color:var(--accent-protein);">${item.proteinG || 0}g</td>
          <td class="mono" style="color:var(--accent-fat);">${item.fatG || 0}g</td>
          <td><small style="color:var(--text-sub);">${item.nguon || 'Text'}</small></td>
          <td>
            <button class="btn-delete" onclick="app.deleteNutritionItem(${index})">🗑️</button>
          </td>
        </tr>
      `).join('');
    },

    renderWorkoutTable(workouts) {
      if (!workouts.length) {
        this.workoutTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-sub);">Chưa có ghi nhận bài tập nào trong ngày.</td></tr>`;
        return;
      }

      this.workoutTableBody.innerHTML = workouts.map((w, index) => `
        <tr>
          <td><strong>${w.monTap || 'Chạy bộ'}</strong></td>
          <td class="mono" style="color:var(--accent-carb);">${w.quangDuongKm || 0} km</td>
          <td class="mono" style="color:var(--accent-vert);">${w.elevationGainM || 0} m</td>
          <td class="mono">${w.thoiGianH || 0} giờ</td>
          <td class="mono" style="color:var(--accent-kcal);">${w.kcalDot || 0} kcal</td>
          <td><small style="color:var(--text-sub);">${w.ghiChu || ''}</small></td>
          <td>
            <button class="btn-delete" onclick="app.deleteWorkoutItem(${index})">🗑️</button>
          </td>
        </tr>
      `).join('');
    },

    async loadWeeklyData() {
      try {
        const data = await window.hlvApi.get('get_weekly');
        const logs = data.weeklyLogs || [];
        if (!logs.length) {
          this.weeklyTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-sub);">Chưa có dữ liệu tuần.</td></tr>`;
          return;
        }

        this.weeklyTableBody.innerHTML = logs.map(row => `
          <tr>
            <td class="mono">${row.date}</td>
            <td><span class="badge badge-rest">${row.loaiNgay || 'Thuong'}</span></td>
            <td class="mono" style="color:var(--accent-carb);">${row.totalKm || 0} km</td>
            <td class="mono" style="color:var(--accent-vert);">${row.totalGainM || 0} m</td>
            <td class="mono" style="color:var(--accent-kcal);">${row.totalKcalBurned || 0} kcal</td>
            <td class="mono" style="color:var(--accent-protein);">${row.totalKcalEaten || 0} kcal</td>
            <td class="mono" style="color:var(--accent-carb);">${row.totalCarbG || 0} g</td>
          </tr>
        `).join('');
      } catch (err) {
        console.error('Lỗi load dữ liệu tuần:', err);
      }
    },

    async analyzeWithAi() {
      const activeTab = document.querySelector('.input-tab-btn.active').dataset.tab;
      
      this.btnAnalyzeAi.disabled = true;
      this.btnAnalyzeAi.innerHTML = `<div class="spinner"></div> Đang gọi Gemini AI phân tích...`;

      try {
        let result = null;
        if (activeTab === 'text') {
          const prompt = this.smartTextInput.value.trim();
          if (!prompt) {
            alert('Vui lòng dán văn bản món ăn hoặc bài tập!');
            return;
          }
          result = await window.geminiParser.parseText(prompt);
        } else {
          if (!this.currentImageBase64) {
            alert('Vui lòng chọn hoặc dán 1 hình ảnh món ăn / bài tập!');
            return;
          }
          const note = this.imageNoteInput.value.trim();
          result = await window.geminiParser.parseImage(this.currentImageBase64, this.currentImageMime, note);
        }

        this.showAiReviewPreview(result);
      } catch (err) {
        alert(err.message || 'Lỗi phân tích Gemini AI');
      } finally {
        this.btnAnalyzeAi.disabled = false;
        this.btnAnalyzeAi.innerHTML = `✨ Phân tích bằng Gemini AI`;
      }
    },

    showAiReviewPreview(parsedJson) {
      this.pendingAiParsedResult = parsedJson;
      this.reviewBox.style.display = 'block';

      if (parsedJson.type === 'DINH_DUONG') {
        const itemsHtml = (parsedJson.items || []).map(item => `
          <div class="review-item">
            <div>
              <strong>[${item.bua || 'Phụ'}] ${item.tenMon}</strong>
              <div style="font-size:0.75rem; color:var(--text-sub);">${item.ghiChu || ''}</div>
            </div>
            <div class="review-item-details">
              <span style="color:var(--accent-kcal);">${item.kcal || 0} kcal</span>
              <span style="color:var(--accent-carb);">${item.carbG || 0}g Carb</span>
              <span style="color:var(--accent-protein);">${item.proteinG || 0}g P</span>
              <span style="color:var(--accent-fat);">${item.fatG || 0}g F</span>
            </div>
          </div>
        `).join('');

        this.reviewContent.innerHTML = `
          <div style="margin-bottom:8px; font-weight:600; color:var(--accent-carb);">Đã nhận diện: ${parsedJson.items?.length || 0} món ăn</div>
          <div class="review-items-list">${itemsHtml}</div>
        `;
      } else if (parsedJson.type === 'TAP_LUYEN') {
        const w = parsedJson.workout || {};
        this.reviewContent.innerHTML = `
          <div style="margin-bottom:8px; font-weight:600; color:var(--accent-vert);">Đã nhận diện: 1 Buổi tập thể thao</div>
          <div class="review-item workout">
            <div>
              <strong>${w.monTap || 'Chạy bộ'}</strong>
              <div style="font-size:0.75rem; color:var(--text-sub);">${w.ghiChu || ''}</div>
            </div>
            <div class="review-item-details">
              <span style="color:var(--accent-carb);">${w.quangDuongKm || 0} km</span>
              <span style="color:var(--accent-vert);">${w.elevationGainM || 0} m Gain</span>
              <span>${w.thoiGianH || 0} giờ</span>
              <span style="color:var(--accent-kcal);">${w.kcalDot || 0} kcal</span>
            </div>
          </div>
        `;
      }
    },

    async savePendingAiResult() {
      if (!this.pendingAiParsedResult) return;
      const data = this.pendingAiParsedResult;

      try {
        if (data.type === 'DINH_DUONG') {
          const res = await window.hlvApi.post('add_nutrition', {
            date: this.currentDate,
            items: data.items
          });
          this.renderDashboard(res);
        } else if (data.type === 'TAP_LUYEN') {
          const res = await window.hlvApi.post('add_workout', {
            date: this.currentDate,
            workout: data.workout
          });
          this.renderDashboard(res);
        }

        // Reset input fields
        this.smartTextInput.value = '';
        this.currentImageBase64 = null;
        this.imagePreview.style.display = 'none';
        this.reviewBox.style.display = 'none';
        this.pendingAiParsedResult = null;

        alert('Đã lưu thành công vào Google Sheets!');
      } catch (err) {
        alert('Lỗi lưu dữ liệu: ' + err.message);
      }
    },

    async deleteNutritionItem(rowIndex) {
      if (!confirm('Bạn có chắc muốn xóa món ăn này khỏi Sheets?')) return;
      try {
        const res = await window.hlvApi.post('delete_nutrition', {
          date: this.currentDate,
          rowIndex: rowIndex
        });
        this.renderDashboard(res);
      } catch (err) {
        alert('Lỗi xóa dòng: ' + err.message);
      }
    },

    async deleteWorkoutItem(rowIndex) {
      if (!confirm('Bạn có chắc muốn xóa bài tập này khỏi Sheets?')) return;
      try {
        const res = await window.hlvApi.post('delete_workout', {
          date: this.currentDate,
          rowIndex: rowIndex
        });
        this.renderDashboard(res);
      } catch (err) {
        alert('Lỗi xóa dòng: ' + err.message);
      }
    }
  };

  window.app = app;
  app.init();
});
