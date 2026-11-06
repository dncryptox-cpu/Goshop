/**
 * HLV DINH DƯỠNG ULTRA RUNNER - APPLICATION CONTROLLER
 * Điều khiển UI, State, Tính toán Calo/Carb Real-time, Nhật ký Đủ/Thiếu & AI Weekly Review
 */

document.addEventListener('DOMContentLoaded', () => {
  const app = {
    currentDate: new Date().toISOString().split('T')[0],
    currentDayType: 'Thuong',
    todayData: null,
    historyLogs: [],
    pendingAiParsedResult: null,
    currentImageBase64: null,
    currentImageMime: null,
    latestWeeklyReview: null,

    init() {
      this.cacheDom();
      this.bindEvents();
      this.loadSettings();
      this.updateCloudStatusBadge();
      this.loadTodayData();
      this.loadWeeklyReview();
      this.updateSyncLinkUI();
    },

    cacheDom() {
      // Header status & Badges
      this.cloudStatusBadge = document.getElementById('cloudStatusBadge');
      this.headerUserName = document.getElementById('headerUserName');
      this.btnUserBadge = document.getElementById('btnUserBadge');

      // AI Weekly Review Banner & Modal
      this.aiWeeklyReviewBanner = document.getElementById('aiWeeklyReviewBanner');
      this.weeklyReviewMeta = document.getElementById('weeklyReviewMeta');
      this.weeklyReviewDeficitText = document.getElementById('weeklyReviewDeficitText');
      this.btnViewWeeklyMenu = document.getElementById('btnViewWeeklyMenu');
      this.btnTriggerWeeklyReview = document.getElementById('btnTriggerWeeklyReview');
      this.btnTriggerWeeklyReviewUser = document.getElementById('btnTriggerWeeklyReviewUser');
      
      this.weeklyMenuModal = document.getElementById('weeklyMenuModal');
      this.weeklyMenuModalBody = document.getElementById('weeklyMenuModalBody');
      this.btnCloseWeeklyMenuModal = document.getElementById('btnCloseWeeklyMenuModal');
      this.btnDismissWeeklyMenuModal = document.getElementById('btnDismissWeeklyMenuModal');

      // Date Picker & Day Type
      this.dateInput = document.getElementById('dateInput');
      this.dateInput.value = this.currentDate;
      this.dayTypeButtons = document.querySelectorAll('.btn-day');

      // Metric Elements & Remaining Badges
      this.valKcal = document.getElementById('valKcal');
      this.subKcal = document.getElementById('subKcal');
      this.fillKcal = document.getElementById('fillKcal');
      this.badgeKcalRemaining = document.getElementById('badgeKcalRemaining');

      this.valCarb = document.getElementById('valCarb');
      this.subCarb = document.getElementById('subCarb');
      this.fillCarb = document.getElementById('fillCarb');
      this.badgeCarbRemaining = document.getElementById('badgeCarbRemaining');

      this.valProtein = document.getElementById('valProtein');
      this.subProtein = document.getElementById('subProtein');
      this.fillProtein = document.getElementById('fillProtein');
      this.badgeProteinRemaining = document.getElementById('badgeProteinRemaining');

      this.valFat = document.getElementById('valFat');
      this.subFat = document.getElementById('subFat');
      this.fillFat = document.getElementById('fillFat');
      this.badgeFatRemaining = document.getElementById('badgeFatRemaining');

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

      // Logs & Table & History & User View
      this.mainTabBtns = document.querySelectorAll('.main-tab');
      this.tabNutritionView = document.getElementById('tabNutritionView');
      this.tabWorkoutView = document.getElementById('tabWorkoutView');
      this.tabHistoryView = document.getElementById('tabHistoryView');
      this.tabUserView = document.getElementById('tabUserView');

      this.nutritionTableBody = document.getElementById('nutritionTableBody');
      this.workoutTableBody = document.getElementById('workoutTableBody');
      
      // History elements
      this.weeklyComplianceBar = document.getElementById('weeklyComplianceBar');
      this.kcalHeatmapGrid = document.getElementById('kcalHeatmapGrid');
      this.historyTableBody = document.getElementById('historyTableBody');

      // User Profile & Sync Elements
      this.userNameInput = document.getElementById('userNameInput');
      this.userHeightInput = document.getElementById('userHeightInput');
      this.userWeightInput = document.getElementById('userWeightInput');
      this.userGoalInput = document.getElementById('userGoalInput');
      this.btnSaveUserProfile = document.getElementById('btnSaveUserProfile');
      
      this.syncLinkInput = document.getElementById('syncLinkInput');
      this.btnCopySyncLink = document.getElementById('btnCopySyncLink');
      this.btnPushLocalToCloud = document.getElementById('btnPushLocalToCloud');
      this.btnFetchCloudConfig = document.getElementById('btnFetchCloudConfig');
      this.btnModalSyncLink = document.getElementById('btnModalSyncLink');

      // Edit Item Modal
      this.editItemModal = document.getElementById('editItemModal');
      this.btnCloseEditModal = document.getElementById('btnCloseEditModal');
      this.btnCancelEditItem = document.getElementById('btnCancelEditItem');
      this.editItemForm = document.getElementById('editItemForm');
      this.editItemRowIndex = document.getElementById('editItemRowIndex');
      this.editItemType = document.getElementById('editItemType');
      this.editNutritionFields = document.getElementById('editNutritionFields');
      this.editWorkoutFields = document.getElementById('editWorkoutFields');

      this.editItemBua = document.getElementById('editItemBua');
      this.editItemTenMon = document.getElementById('editItemTenMon');
      this.editItemKcal = document.getElementById('editItemKcal');
      this.editItemCarb = document.getElementById('editItemCarb');
      this.editItemProtein = document.getElementById('editItemProtein');
      this.editItemFat = document.getElementById('editItemFat');

      this.editWorkoutMon = document.getElementById('editWorkoutMon');
      this.editWorkoutKm = document.getElementById('editWorkoutKm');
      this.editWorkoutGain = document.getElementById('editWorkoutGain');
      this.editWorkoutTime = document.getElementById('editWorkoutTime');
      this.editWorkoutKcal = document.getElementById('editWorkoutKcal');

      // Settings Modal
      this.btnOpenSettings = document.getElementById('btnOpenSettings');
      this.btnCloseSettings = document.getElementById('btnCloseSettings');
      this.settingsModal = document.getElementById('settingsModal');
      this.webAppUrlInput = document.getElementById('webAppUrlInput');
      this.geminiKeyInput = document.getElementById('geminiKeyInput');
      this.geminiModelSelect = document.getElementById('geminiModelSelect');
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
          this.tabHistoryView.style.display = target === 'history' ? 'block' : 'none';
          this.tabUserView.style.display = target === 'user' ? 'block' : 'none';

          if (target === 'history') {
            this.loadHistoryData();
          } else if (target === 'user') {
            this.updateSyncLinkUI();
          }
        });
      });

      // Weekly Review Modal & Triggers
      this.btnViewWeeklyMenu.addEventListener('click', () => this.openWeeklyMenuModal());
      this.btnTriggerWeeklyReview.addEventListener('click', () => this.runManualWeeklyReview());
      if (this.btnTriggerWeeklyReviewUser) {
        this.btnTriggerWeeklyReviewUser.addEventListener('click', () => this.runManualWeeklyReview());
      }
      this.btnCloseWeeklyMenuModal.addEventListener('click', () => this.weeklyMenuModal.classList.remove('active'));
      this.btnDismissWeeklyMenuModal.addEventListener('click', () => this.weeklyMenuModal.classList.remove('active'));

      // Header Badges click
      this.btnUserBadge.addEventListener('click', () => {
        const userTab = Array.from(this.mainTabBtns).find(b => b.dataset.view === 'user');
        if (userTab) userTab.click();
      });

      this.cloudStatusBadge.addEventListener('click', () => {
        this.settingsModal.classList.add('active');
      });

      // Save User Profile to Google Sheets
      this.btnSaveUserProfile.addEventListener('click', () => this.saveUserProfile());

      // Copy 1-Click Sync Link
      this.btnCopySyncLink.addEventListener('click', () => this.copySyncLink());
      this.btnModalSyncLink.addEventListener('click', () => this.copySyncLink());

      // Push Local Data to Cloud
      this.btnPushLocalToCloud.addEventListener('click', () => this.pushLocalDataToCloud());

      // Fetch Cloud Config from Sheets
      this.btnFetchCloudConfig.addEventListener('click', () => this.fetchCloudUserConfig());

      // Edit Modal Events
      this.btnCloseEditModal.addEventListener('click', () => this.editItemModal.classList.remove('active'));
      this.btnCancelEditItem.addEventListener('click', () => this.editItemModal.classList.remove('active'));
      this.editItemForm.addEventListener('submit', (e) => this.saveEditedItem(e));

      // Settings Modal Events
      this.btnOpenSettings.addEventListener('click', () => this.settingsModal.classList.add('active'));
      this.btnCloseSettings.addEventListener('click', () => this.settingsModal.classList.remove('active'));
      this.btnSaveSettings.addEventListener('click', () => this.saveSettings());
    },

    evaluateStatus(consumed, target) {
      if (!target || target <= 0) return { code: 'du', text: 'Đủ', cls: 'du' };
      const pct = (consumed / target) * 100;
      if (pct >= 95 && pct <= 110) {
        return { code: 'du', text: 'Đủ', cls: 'du', label: 'ĐỦ (95-110%)' };
      } else if (pct >= 85 && pct < 95) {
        return { code: 'gandu', text: 'Gần đủ', cls: 'gandu', label: 'GẦN ĐỦ (85-95%)' };
      } else if (pct < 85) {
        return { code: 'thieu', text: 'Thiếu', cls: 'thieu', label: 'THIẾU (<85%)' };
      } else {
        return { code: 'vuot', text: 'Vượt', cls: 'vuot', label: 'VƯỢT (>110%)' };
      }
    },

    updateCloudStatusBadge() {
      const url = window.hlvApi.getWebAppUrl();
      if (url) {
        this.cloudStatusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        this.cloudStatusBadge.style.color = '#10b981';
        this.cloudStatusBadge.innerHTML = '🟢 <span class="cloud-badge-text">Đã kết nối Google Sheets</span>';
      } else {
        this.cloudStatusBadge.style.background = 'rgba(245, 158, 11, 0.2)';
        this.cloudStatusBadge.style.color = '#f59e0b';
        this.cloudStatusBadge.innerHTML = '🟡 <span class="cloud-badge-text">Chưa dán Web App URL</span>';
      }
    },

    loadSettings() {
      this.webAppUrlInput.value = window.hlvApi.getWebAppUrl();
      this.geminiKeyInput.value = window.geminiParser.getApiKey();
      this.geminiModelSelect.value = window.geminiParser.getModel();
      this.userNameInput.value = window.hlvApi.getUserName();
      this.headerUserName.textContent = window.hlvApi.getUserName();
    },

    async saveSettings() {
      const url = this.webAppUrlInput.value.trim();
      const key = this.geminiKeyInput.value.trim();
      const model = this.geminiModelSelect.value.trim();

      window.hlvApi.setWebAppUrl(url);
      window.geminiParser.setApiKey(key);
      window.geminiParser.setModel(model);

      this.settingsModal.classList.remove('active');
      this.updateCloudStatusBadge();
      this.updateSyncLinkUI();

      if (url) {
        try {
          const count = await window.hlvApi.pushAllLocalDataToSheet();
          if (count > 0) {
            alert(`🎉 Đã kết nối Google Sheets và tự động đẩy ${count} bản ghi từ máy này lên Sheet!`);
          } else {
            alert('🎉 Đã kết nối Google Sheets thành công!');
          }
        } catch (e) {
          console.error(e);
        }
      }

      this.loadTodayData();
      this.loadWeeklyReview();
    },

    updateSyncLinkUI() {
      const syncUrl = window.hlvApi.generateSyncLink();
      this.syncLinkInput.value = syncUrl;
    },

    copySyncLink() {
      const link = window.hlvApi.generateSyncLink();
      navigator.clipboard.writeText(link).then(() => {
        alert('📋 Đã copy Link Đồng Bộ 1-Click vào bộ nhớ tạm!\nBạn có thể dán (Paste) link này sang Zalo/Messenger của bạn để mở trên điện thoại hoặc máy tính khác.');
      }).catch(() => {
        this.syncLinkInput.select();
        document.execCommand('copy');
        alert('📋 Đã copy Link Đồng Bộ!');
      });
    },

    async pushLocalDataToCloud() {
      try {
        const count = await window.hlvApi.pushAllLocalDataToSheet();
        if (count > 0) {
          alert(`📤 Đã đẩy thành công ${count} mục dữ liệu từ máy này lên Google Sheets!`);
        } else {
          alert('Dữ liệu trên máy này đã đồng bộ hoàn toàn với Google Sheets.');
        }
        this.loadTodayData();
        this.loadWeeklyReview();
      } catch (err) {
        alert('Lỗi đẩy dữ liệu: ' + err.message);
      }
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
            GEMINI_API_KEY: window.geminiParser.getApiKey(),
            GEMINI_MODEL: window.geminiParser.getModel()
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
        if (cfg.GEMINI_MODEL) {
          window.geminiParser.setModel(cfg.GEMINI_MODEL);
          this.geminiModelSelect.value = cfg.GEMINI_MODEL;
        }

        alert('☁️ Đã đồng bộ cấu hình từ Google Sheets về thiết bị này thành công!');
        this.loadTodayData();
        this.loadWeeklyReview();
      } catch (err) {
        alert('Lỗi đồng bộ: ' + err.message);
      }
    },

    /**
     * Tải gợi ý thực đơn tuần mới nhất từ Sheet GOI_Y_THUC_DON
     */
    async loadWeeklyReview() {
      try {
        const data = await window.hlvApi.get('get_weekly_review');
        if (data && data.latestReview && data.latestReview.menuResult) {
          this.latestWeeklyReview = data.latestReview;
          this.renderWeeklyReviewBanner(data.latestReview);
        } else {
          this.aiWeeklyReviewBanner.classList.add('hidden');
        }
      } catch (err) {
        console.error('Lỗi load Weekly Review:', err);
      }
    },

    renderWeeklyReviewBanner(review) {
      if (!review) return;
      this.aiWeeklyReviewBanner.classList.remove('hidden');
      this.weeklyReviewMeta.textContent = `Tạo ngày: ${review.ngayTao || 'Gần đây'} • Kỳ phân tích: ${review.kyPhanTich || '7 ngày'}`;
      this.weeklyReviewDeficitText.textContent = `🔍 Điểm hụt chính: ${review.diemHutChinh || 'Cần chú ý bù thêm Carb ngày tập leo dốc'}`;
    },

    openWeeklyMenuModal() {
      if (!this.latestWeeklyReview || !this.latestWeeklyReview.menuResult) {
        alert('Chưa có phân tích thực đơn mẫu. Bấm "⚡ Phân Tích Ngay" để khởi tạo!');
        return;
      }

      const res = this.latestWeeklyReview.menuResult;
      const suggestions = res.loaiNgaySuggest || [];

      let html = `
        <div style="background:var(--bg-input); padding:12px; border-radius:8px; border:1px solid var(--accent-carb); margin-bottom:14px;">
          <strong style="color:var(--accent-kcal);">🎯 Điểm hụt chính tuần qua:</strong>
          <div style="font-size:0.875rem; color:var(--text-main); margin-top:4px;">${res.diemHutChinh || 'Cần chú ý bổ sung Carb vào ngày Vert Nặng'}</div>
        </div>
      `;

      suggestions.forEach(s => {
        html += `
          <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:14px; margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span class="badge badge-vert" style="font-size:0.85rem; padding:4px 10px;">Loại Ngày: ${s.loaiNgay || 'VertNang'}</span>
            </div>
            <p style="font-size:0.825rem; color:var(--text-muted); margin-bottom:10px;">💡 <em>${s.loiKhuyen || ''}</em></p>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${(s.thucDon || []).map(m => `
                <div style="display:flex; justify-content:space-between; background:var(--bg-input); padding:8px 10px; border-radius:6px; font-size:0.825rem;">
                  <span><strong>[${m.bua}]</strong> ${m.tenMon}</span>
                  <span class="mono" style="color:var(--accent-carb);">${m.kcal || 0} kcal • ${m.carbG || 0}g Carb</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });

      this.weeklyMenuModalBody.innerHTML = html;
      this.weeklyMenuModal.classList.add('active');
    },

    async runManualWeeklyReview() {
      this.btnTriggerWeeklyReview.disabled = true;
      this.btnTriggerWeeklyReview.textContent = '⏳ Đang phân tích...';

      try {
        const res = await window.hlvApi.post('run_weekly_review', { daysLimit: 7 });
        if (res) {
          const data = await window.hlvApi.get('get_weekly_review');
          if (data && data.latestReview) {
            this.latestWeeklyReview = data.latestReview;
            this.renderWeeklyReviewBanner(data.latestReview);
            this.openWeeklyMenuModal();
          }
        }
        alert('🎉 Phân tích AI Weekly Review hoàn tất! Thực đơn gợi ý đã sẵn sàng.');
      } catch (err) {
        alert('Lỗi chạy phân tích: ' + err.message);
      } finally {
        this.btnTriggerWeeklyReview.disabled = false;
        this.btnTriggerWeeklyReview.textContent = '⚡ Phân Tích Ngay';
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

      // 1. Render Progress Bars & Metrics với Con số Còn thiếu nổi bật
      this.renderMetricCard(
        this.valKcal, this.subKcal, this.fillKcal, this.badgeKcalRemaining,
        summary.totalKcal, target.kcalTarget, 'kcal'
      );

      this.renderMetricCard(
        this.valCarb, this.subCarb, this.fillCarb, this.badgeCarbRemaining,
        summary.totalCarbG, target.carbTargetG, 'g'
      );

      this.renderMetricCard(
        this.valProtein, this.subProtein, this.fillProtein, this.badgeProteinRemaining,
        summary.totalProteinG, target.proteinTargetG, 'g'
      );

      this.renderMetricCard(
        this.valFat, this.subFat, this.fillFat, this.badgeFatRemaining,
        summary.totalFatG, target.fatTargetG, 'g'
      );

      // 2. Render Recovery Carb Advice (Workout KcalBurned > 2000)
      const heavyWorkout = (data.workouts || []).some(w => (w.kcalDot || 0) > 2000);
      if (heavyWorkout) {
        this.alertBanner.classList.remove('hidden');
      } else {
        this.alertBanner.classList.add('hidden');
      }

      // 3. Render Today's Tables
      this.renderNutritionTable(data.nutrition || []);
      this.renderWorkoutTable(data.workouts || []);
    },

    renderMetricCard(valEl, subEl, fillEl, badgeEl, current, target, unit) {
      const remaining = target - current;
      const pct = Math.min(Math.round((current / target) * 100), 100);
      const status = this.evaluateStatus(current, target);

      valEl.textContent = `${current.toLocaleString()} / ${target.toLocaleString()} ${unit}`;
      subEl.innerHTML = `<span>Tiến độ: ${pct}%</span>`;

      if (remaining > 0) {
        badgeEl.className = `metric-remaining-badge ${status.cls}`;
        badgeEl.textContent = `Còn thiếu: ${remaining.toLocaleString()} ${unit} (${status.text})`;
      } else {
        const overflow = current - target;
        badgeEl.className = `metric-remaining-badge ${status.cls}`;
        badgeEl.textContent = overflow > 0 ? `Đã vượt: +${overflow.toLocaleString()} ${unit} (${status.text})` : `Đạt target! (${status.text})`;
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
            <button class="btn-delete" title="Sửa món này" onclick="app.openEditNutritionModal(${index})">✏️</button>
            <button class="btn-delete" title="Xóa món này" onclick="app.deleteNutritionItem(${index})">🗑️</button>
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
            <button class="btn-delete" title="Sửa bài tập" onclick="app.openEditWorkoutModal(${index})">✏️</button>
            <button class="btn-delete" title="Xóa bài tập" onclick="app.deleteWorkoutItem(${index})">🗑️</button>
          </td>
        </tr>
      `).join('');
    },

    openEditNutritionModal(index) {
      if (!this.todayData || !this.todayData.nutrition || !this.todayData.nutrition[index]) return;
      const item = this.todayData.nutrition[index];

      this.editItemType.value = 'nutrition';
      this.editItemRowIndex.value = item.rowIndex !== undefined ? item.rowIndex : index;
      
      this.editNutritionFields.style.display = 'block';
      this.editWorkoutFields.style.display = 'none';
      
      this.editItemBua.value = item.bua || 'Phụ';
      this.editItemTenMon.value = item.tenMon || '';
      this.editItemKcal.value = item.kcal || 0;
      this.editItemCarb.value = item.carbG || 0;
      this.editItemProtein.value = item.proteinG || 0;
      this.editItemFat.value = item.fatG || 0;

      this.editItemModal.classList.add('active');
    },

    openEditWorkoutModal(index) {
      if (!this.todayData || !this.todayData.workouts || !this.todayData.workouts[index]) return;
      const w = this.todayData.workouts[index];

      this.editItemType.value = 'workout';
      this.editItemRowIndex.value = w.rowIndex !== undefined ? w.rowIndex : index;

      this.editNutritionFields.style.display = 'none';
      this.editWorkoutFields.style.display = 'block';

      this.editWorkoutMon.value = w.monTap || 'Chạy bộ';
      this.editWorkoutKm.value = w.quangDuongKm || 0;
      this.editWorkoutGain.value = w.elevationGainM || 0;
      this.editWorkoutTime.value = w.thoiGianH || 0;
      this.editWorkoutKcal.value = w.kcalDot || 0;

      this.editItemModal.classList.add('active');
    },

    async saveEditedItem(e) {
      e.preventDefault();
      const type = this.editItemType.value;
      const rowIndex = parseInt(this.editItemRowIndex.value, 10);

      try {
        if (type === 'nutrition') {
          const updatedItem = {
            bua: this.editItemBua.value,
            tenMon: this.editItemTenMon.value.trim(),
            kcal: Number(this.editItemKcal.value) || 0,
            carbG: Number(this.editItemCarb.value) || 0,
            proteinG: Number(this.editItemProtein.value) || 0,
            fatG: Number(this.editItemFat.value) || 0
          };
          const res = await window.hlvApi.post('edit_nutrition', {
            date: this.currentDate,
            rowIndex: rowIndex,
            item: updatedItem
          });
          this.renderDashboard(res);
        } else if (type === 'workout') {
          const updatedWorkout = {
            monTap: this.editWorkoutMon.value.trim(),
            quangDuongKm: Number(this.editWorkoutKm.value) || 0,
            elevationGainM: Number(this.editWorkoutGain.value) || 0,
            thoiGianH: Number(this.editWorkoutTime.value) || 0,
            kcalDot: Number(this.editWorkoutKcal.value) || 0
          };
          const res = await window.hlvApi.post('edit_workout', {
            date: this.currentDate,
            rowIndex: rowIndex,
            workout: updatedWorkout
          });
          this.renderDashboard(res);
        }

        this.editItemModal.classList.remove('active');
        alert('✏️ Đã cập nhật dữ liệu thành công!');
      } catch (err) {
        alert('Lỗi lưu chỉnh sửa: ' + err.message);
      }
    },

    async loadHistoryData() {
      try {
        const data = await window.hlvApi.get('get_history');
        const logs = data.historyLogs || [];
        this.historyLogs = logs;

        this.renderWeeklyComplianceSummary(logs.slice(0, 7));
        this.renderCalendarHeatmap(logs.slice(0, 30));
        this.renderHistoryTable(logs);
      } catch (err) {
        console.error('Lỗi load lịch sử nhật ký:', err);
      }
    },

    renderWeeklyComplianceSummary(last7Days) {
      if (!last7Days.length) {
        this.weeklyComplianceBar.innerHTML = `<span style="color:var(--text-sub);">Chưa đủ dữ liệu 7 ngày gần nhất.</span>`;
        return;
      }

      let kcalCount = 0, carbCount = 0, proteinCount = 0, fatCount = 0;
      const totalDays = last7Days.length;

      last7Days.forEach(day => {
        const t = day.target || { kcalTarget: 3500, carbTargetG: 525, proteinTargetG: 120, fatTargetG: 75 };
        
        if (this.evaluateStatus(day.totalKcalEaten, t.kcalTarget).cls === 'du') kcalCount++;
        if (this.evaluateStatus(day.totalCarbG, t.carbTargetG).cls === 'du') carbCount++;
        if (this.evaluateStatus(day.totalProteinG, t.proteinTargetG).cls === 'du') proteinCount++;
        if (this.evaluateStatus(day.totalFatG, t.fatTargetG).cls === 'du') fatCount++;
      });

      this.weeklyComplianceBar.innerHTML = `
        <div class="compliance-badge-item">
          <span style="color:var(--accent-kcal);">🔥 Kcal:</span>
          <strong>${kcalCount}/${totalDays} ngày đủ</strong>
        </div>
        <div class="compliance-badge-item">
          <span style="color:var(--accent-carb);">⚡ Carb:</span>
          <strong>${carbCount}/${totalDays} ngày đủ</strong>
        </div>
        <div class="compliance-badge-item">
          <span style="color:var(--accent-protein);">🥩 Protein:</span>
          <strong>${proteinCount}/${totalDays} ngày đủ</strong>
        </div>
        <div class="compliance-badge-item">
          <span style="color:var(--accent-fat);">🥑 Fat:</span>
          <strong>${fatCount}/${totalDays} ngày đủ</strong>
        </div>
      `;
    },

    renderCalendarHeatmap(pastDays) {
      if (!pastDays.length) {
        this.kcalHeatmapGrid.innerHTML = `<span style="color:var(--text-sub);">Chưa có dữ liệu heatmap.</span>`;
        return;
      }

      const cellsHtml = pastDays.map(day => {
        const t = day.target || { kcalTarget: 3500 };
        const status = this.evaluateStatus(day.totalKcalEaten, t.kcalTarget);
        let lvlClass = 'lvl-0';
        if (status.cls === 'thieu') lvlClass = 'lvl-thieu';
        else if (status.cls === 'gandu') lvlClass = 'lvl-gandu';
        else if (status.cls === 'du') lvlClass = 'lvl-du';
        else if (status.cls === 'vuot') lvlClass = 'lvl-vuot';

        return `<div class="heatmap-cell ${lvlClass}" title="Ngày ${day.date}: ${day.totalKcalEaten}/${t.kcalTarget} kcal (${status.text})" onclick="app.selectHistoryDate('${day.date}')"></div>`;
      }).join('');

      this.kcalHeatmapGrid.innerHTML = cellsHtml;
    },

    selectHistoryDate(dateStr) {
      this.currentDate = dateStr;
      this.dateInput.value = dateStr;
      this.loadTodayData();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    renderHistoryTable(logs) {
      if (!logs.length) {
        this.historyTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-sub);">Chưa có lịch sử theo dõi nào.</td></tr>`;
        return;
      }

      let html = '';
      logs.forEach((day, index) => {
        const t = day.target || { kcalTarget: 3500, carbTargetG: 525, proteinTargetG: 120, fatTargetG: 75 };
        
        const kcalSt = this.evaluateStatus(day.totalKcalEaten, t.kcalTarget);
        const carbSt = this.evaluateStatus(day.totalCarbG, t.carbTargetG);
        const protSt = this.evaluateStatus(day.totalProteinG, t.proteinTargetG);
        const fatSt = this.evaluateStatus(day.totalFatG, t.fatTargetG);

        html += `
          <tr class="row-history-main" onclick="app.toggleHistoryRowDetails(${index})">
            <td class="mono"><strong>${day.date}</strong> 🔍</td>
            <td><span class="badge badge-rest">${day.loaiNgay || 'Thuong'}</span></td>
            <td>
              <div class="mono">${day.totalKcalEaten} / ${t.kcalTarget}</div>
              <span class="badge-status ${kcalSt.cls}">${kcalSt.text}</span>
            </td>
            <td>
              <div class="mono" style="color:var(--accent-carb);">${day.totalCarbG}g / ${t.carbTargetG}g</div>
              <span class="badge-status ${carbSt.cls}">${carbSt.text}</span>
            </td>
            <td>
              <div class="mono" style="color:var(--accent-protein);">${day.totalProteinG}g / ${t.proteinTargetG}g</div>
              <span class="badge-status ${protSt.cls}">${protSt.text}</span>
            </td>
            <td>
              <div class="mono" style="color:var(--accent-fat);">${day.totalFatG}g / ${t.fatTargetG}g</div>
              <span class="badge-status ${fatSt.cls}">${fatSt.text}</span>
            </td>
            <td class="mono" style="color:var(--accent-vert);">
              ${day.totalKm > 0 ? `${day.totalKm}km (${day.totalGainM}m vert)` : 'Nghỉ tập'}
            </td>
          </tr>
          <tr id="historyDetailsRow_${index}" class="row-history-details" style="display:none;">
            <td colspan="7">
              <div class="history-details-container">
                <div style="font-weight:700; color:var(--accent-carb); margin-bottom:6px;">🍲 Chi tiết bữa ăn (${day.nutritionItems?.length || 0} món):</div>
                <div style="margin-bottom:10px;">
                  ${(day.nutritionItems || []).map(m => `<span style="display:inline-block; background:var(--bg-card); padding:4px 8px; border-radius:4px; margin-right:6px; margin-bottom:4px;">[${m.bua}] ${m.tenMon} • ${m.kcal}k (${m.carbG}g Carb)</span>`).join('') || '<span style="color:var(--text-sub);">Chưa có bữa ăn</span>'}
                </div>
                <div style="font-weight:700; color:var(--accent-vert); margin-bottom:6px;">🏃 Chi tiết tập luyện (${day.workoutItems?.length || 0} bài tập):</div>
                <div>
                  ${(day.workoutItems || []).map(w => `<span style="display:inline-block; background:var(--bg-card); padding:4px 8px; border-radius:4px; margin-right:6px;">${w.monTap} • ${w.quangDuongKm}km • ${w.elevationGainM}m gain • ${w.kcalDot} kcal</span>`).join('') || '<span style="color:var(--text-sub);">Không có bài tập</span>'}
                </div>
              </div>
            </td>
          </tr>
        `;
      });

      this.historyTableBody.innerHTML = html;
    },

    toggleHistoryRowDetails(index) {
      const detailsRow = document.getElementById(`historyDetailsRow_${index}`);
      if (detailsRow) {
        detailsRow.style.display = detailsRow.style.display === 'none' ? 'table-row' : 'none';
      }
    },

    async analyzeWithAi() {
      const activeTab = document.querySelector('.input-tab-btn.active').dataset.tab;
      
      this.btnAnalyzeAi.disabled = true;
      this.btnAnalyzeAi.innerHTML = `<div class="spinner"></div> Đang gọi Gemini AI (${window.geminiParser.getModel()}) phân tích...`;

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
        const itemsHtml = (parsedJson.items || []).map((item, idx) => `
          <div class="review-item" style="border-left: 3px solid var(--accent-carb); padding: 10px; background: var(--bg-card); border-radius: 8px; margin-bottom: 8px;">
            <div style="display: flex; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
              <select id="aiEditBua_${idx}" class="form-control" style="width: 100px; padding: 4px 8px; font-size: 0.8rem;">
                <option value="Sáng" ${item.bua === 'Sáng' ? 'selected' : ''}>Sáng</option>
                <option value="Trưa" ${item.bua === 'Trưa' ? 'selected' : ''}>Trưa</option>
                <option value="Tối" ${item.bua === 'Tối' ? 'selected' : ''}>Tối</option>
                <option value="Phụ" ${item.bua === 'Phụ' ? 'selected' : ''}>Phụ</option>
                <option value="Trong tập" ${item.bua === 'Trong tập' ? 'selected' : ''}>Trong tập</option>
              </select>
              <input type="text" id="aiEditTen_${idx}" class="form-control" value="${item.tenMon || ''}" placeholder="Tên món" style="flex: 1; min-width: 140px; padding: 4px 8px; font-size: 0.85rem; font-weight: bold;">
            </div>
            <div style="display: flex; gap: 8px; font-size: 0.8rem; flex-wrap: wrap;">
              <label style="display:flex; align-items:center; gap:4px; color:var(--accent-kcal);">
                Kcal: <input type="number" id="aiEditKcal_${idx}" class="form-control" value="${item.kcal || 0}" style="width: 70px; padding: 2px 6px;">
              </label>
              <label style="display:flex; align-items:center; gap:4px; color:var(--accent-carb);">
                Carb(g): <input type="number" id="aiEditCarb_${idx}" class="form-control" value="${item.carbG || 0}" style="width: 65px; padding: 2px 6px;">
              </label>
              <label style="display:flex; align-items:center; gap:4px; color:var(--accent-protein);">
                Prot(g): <input type="number" id="aiEditProtein_${idx}" class="form-control" value="${item.proteinG || 0}" style="width: 65px; padding: 2px 6px;">
              </label>
              <label style="display:flex; align-items:center; gap:4px; color:var(--accent-fat);">
                Fat(g): <input type="number" id="aiEditFat_${idx}" class="form-control" value="${item.fatG || 0}" style="width: 65px; padding: 2px 6px;">
              </label>
            </div>
          </div>
        `).join('');

        this.reviewContent.innerHTML = `
          <div style="margin-bottom:8px; font-weight:600; color:var(--accent-carb);">Đã nhận diện ${parsedJson.items?.length || 0} món ăn (Bạn có thể sửa trực tiếp số liệu dưới đây):</div>
          <div class="review-items-list">${itemsHtml}</div>
        `;
      } else if (parsedJson.type === 'TAP_LUYEN') {
        const w = parsedJson.workout || {};
        this.reviewContent.innerHTML = `
          <div style="margin-bottom:8px; font-weight:600; color:var(--accent-vert);">Đã nhận diện 1 Buổi tập thể thao (Bạn có thể sửa trực tiếp):</div>
          <div class="review-item workout" style="padding: 10px; background: var(--bg-card); border-radius: 8px;">
            <div style="margin-bottom: 6px;">
              <input type="text" id="aiEditMonTap" class="form-control" value="${w.monTap || 'Chạy bộ'}" style="font-weight: bold; padding: 4px 8px; margin-bottom: 6px;">
            </div>
            <div style="display: flex; gap: 8px; font-size: 0.8rem; flex-wrap: wrap;">
              <label style="display:flex; align-items:center; gap:4px; color:var(--accent-carb);">
                Km: <input type="number" id="aiEditKm" class="form-control" value="${w.quangDuongKm || 0}" step="0.1" style="width: 70px; padding: 2px 6px;">
              </label>
              <label style="display:flex; align-items:center; gap:4px; color:var(--accent-vert);">
                Gain(m): <input type="number" id="aiEditGain" class="form-control" value="${w.elevationGainM || 0}" style="width: 75px; padding: 2px 6px;">
              </label>
              <label style="display:flex; align-items:center; gap:4px;">
                Giờ: <input type="number" id="aiEditTime" class="form-control" value="${w.thoiGianH || 0}" step="0.1" style="width: 65px; padding: 2px 6px;">
              </label>
              <label style="display:flex; align-items:center; gap:4px; color:var(--accent-kcal);">
                Calo đốt: <input type="number" id="aiEditKcalDot" class="form-control" value="${w.kcalDot || 0}" style="width: 75px; padding: 2px 6px;">
              </label>
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
          const editedItems = (data.items || []).map((item, idx) => {
            const bua = document.getElementById(`aiEditBua_${idx}`)?.value || item.bua;
            const tenMon = document.getElementById(`aiEditTen_${idx}`)?.value.trim() || item.tenMon;
            const kcal = Number(document.getElementById(`aiEditKcal_${idx}`)?.value) || 0;
            const carbG = Number(document.getElementById(`aiEditCarb_${idx}`)?.value) || 0;
            const proteinG = Number(document.getElementById(`aiEditProtein_${idx}`)?.value) || 0;
            const fatG = Number(document.getElementById(`aiEditFat_${idx}`)?.value) || 0;

            return { bua, tenMon, kcal, carbG, proteinG, fatG, nguon: item.nguon || 'Text', ghiChu: item.ghiChu || '' };
          });

          const res = await window.hlvApi.post('add_nutrition', {
            date: this.currentDate,
            items: editedItems
          });
          this.renderDashboard(res);
        } else if (data.type === 'TAP_LUYEN') {
          const monTap = document.getElementById('aiEditMonTap')?.value.trim() || data.workout?.monTap;
          const quangDuongKm = Number(document.getElementById('aiEditKm')?.value) || 0;
          const elevationGainM = Number(document.getElementById('aiEditGain')?.value) || 0;
          const thoiGianH = Number(document.getElementById('aiEditTime')?.value) || 0;
          const kcalDot = Number(document.getElementById('aiEditKcalDot')?.value) || 0;

          const editedWorkout = { monTap, quangDuongKm, elevationGainM, thoiGianH, kcalDot, ghiChu: data.workout?.ghiChu || '' };

          const res = await window.hlvApi.post('add_workout', {
            date: this.currentDate,
            workout: editedWorkout
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
