/* ==========================================
   TÔI TỰ HỌC - FRONTEND LOGIC (APP.JS)
   ========================================== */

const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxpKFO65imADfV1OU_QXkgqE4AnyL1Z5My33IU5ljBjcVINdQD-Lxlg2dR7LR43QqM/exec";

const state = {
  token: localStorage.getItem('toituhoc_token') || '',
  userEmail: localStorage.getItem('toituhoc_user_email') || '',
  scriptUrl: localStorage.getItem('toituhoc_script_url') || DEFAULT_SCRIPT_URL,
  hasApiKey: false,
  dueVocabList: [],
  allVocabList: [],
  currentReviewIndex: 0,
  selectedImageBase64: null,
  selectedImageMimeType: 'image/jpeg'
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  setupNavigation();
  setupAuth();
  setupDashboard();
  setupUpload();
  setupReview();
  setupVocabList();
  setupSettings();
  
  const inputUrl = document.getElementById('input-script-url');
  if (inputUrl) {
    inputUrl.value = state.scriptUrl;
  }

  // Check login state via Token
  if (state.token && state.userEmail) {
    onUserAuthenticated(state.token, state.userEmail);
  } else {
    showView('view-auth');
    document.getElementById('bottom-navigation').style.display = 'none';
  }
}

/* ==========================================
   1. NAVIGATION & VIEWS
   ========================================== */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetView = item.getAttribute('data-target');
      showView(targetView);
      updateNavActive(targetView);
    });
  });

  const avatar = document.getElementById('user-avatar-initial');
  if (avatar) {
    avatar.addEventListener('click', () => {
      if (state.token) {
        showView('view-settings');
        updateNavActive('view-settings');
      }
    });
  }

  const warningBanner = document.getElementById('apikey-warning-banner');
  if (warningBanner) {
    warningBanner.addEventListener('click', () => {
      showView('view-settings');
      updateNavActive('view-settings');
    });
  }
}

function showView(viewId) {
  const views = document.querySelectorAll('.view-section');
  views.forEach(v => v.classList.remove('active'));

  const activeView = document.getElementById(viewId);
  if (activeView) {
    activeView.classList.add('active');
  }

  if (viewId === 'view-dashboard') {
    fetchDashboardStats();
  } else if (viewId === 'view-review') {
    loadReviewQueue();
  } else if (viewId === 'view-vocab') {
    loadAllVocab();
  } else if (viewId === 'view-settings') {
    loadUserSettings();
  }
}

function updateNavActive(targetView) {
  const items = document.querySelectorAll('.nav-item');
  items.forEach(n => {
    if (n.getAttribute('data-target') === targetView) {
      n.classList.add('active');
    } else {
      n.classList.remove('active');
    }
  });
}

/* ==========================================
   2. AUTHENTICATION (REGISTER & LOGIN)
   ========================================== */
function setupAuth() {
  const tabBtnLogin = document.getElementById('tab-btn-login');
  const tabBtnRegister = document.getElementById('tab-btn-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  tabBtnLogin.addEventListener('click', () => {
    tabBtnLogin.classList.add('active');
    tabBtnLogin.style.background = 'var(--primary)';
    tabBtnLogin.style.color = '#fff';
    
    tabBtnRegister.classList.remove('active');
    tabBtnRegister.style.background = 'transparent';
    tabBtnRegister.style.color = 'var(--text-muted)';
    
    formLogin.style.display = 'flex';
    formRegister.style.display = 'none';
  });

  tabBtnRegister.addEventListener('click', () => {
    tabBtnRegister.classList.add('active');
    tabBtnRegister.style.background = 'var(--primary)';
    tabBtnRegister.style.color = '#fff';
    
    tabBtnLogin.classList.remove('active');
    tabBtnLogin.style.background = 'transparent';
    tabBtnLogin.style.color = 'var(--text-muted)';
    
    formRegister.style.display = 'flex';
    formLogin.style.display = 'none';
  });

  // Handle Login Submit
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('input-login-email').value.trim();
    const password = document.getElementById('input-login-password').value;

    try {
      const res = await callAppsScriptAPI('login', { email, password });
      if (res.status === 'success' && res.token) {
        state.hasApiKey = !!res.has_api_key;
        onUserAuthenticated(res.token, res.email);
      } else {
        alert(res.message || 'Đăng nhập thất bại.');
      }
    } catch (err) {
      alert('Không thể kết nối đến máy chủ: ' + err.message);
    }
  });

  // Handle Register Submit
  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('input-reg-email').value.trim();
    const password = document.getElementById('input-reg-password').value;
    const apiKey = document.getElementById('input-reg-apikey').value.trim();

    try {
      const res = await callAppsScriptAPI('register', {
        email,
        password,
        api_key_gemini: apiKey
      });

      if (res.status === 'success' && res.token) {
        state.hasApiKey = !!res.has_api_key;
        alert('Đăng ký tài khoản thành công!');
        onUserAuthenticated(res.token, res.email);
      } else {
        alert(res.message || 'Đăng ký thất bại.');
      }
    } catch (err) {
      alert('Đã xảy ra lỗi khi tạo tài khoản: ' + err.message);
    }
  });

  // Config Backend URL
  const btnSaveScript = document.getElementById('btn-save-script-url');
  if (btnSaveScript) {
    btnSaveScript.addEventListener('click', () => {
      const url = document.getElementById('input-script-url').value.trim();
      if (!url) {
        alert('Vui lòng nhập Web App URL của Apps Script!');
        return;
      }
      state.scriptUrl = url;
      localStorage.setItem('toituhoc_script_url', url);
      alert('Đã lưu cấu hình Apps Script Backend thành công!');
    });
  }
}

function onUserAuthenticated(token, email) {
  state.token = token;
  state.userEmail = email;
  localStorage.setItem('toituhoc_token', token);
  localStorage.setItem('toituhoc_user_email', email);

  document.getElementById('user-email-display').innerText = email;
  document.getElementById('user-avatar-initial').innerText = email.charAt(0).toUpperCase();

  document.getElementById('bottom-navigation').style.display = 'flex';
  showView('view-dashboard');

  checkUserProfile();
}

function logout() {
  state.token = '';
  state.userEmail = '';
  state.hasApiKey = false;
  localStorage.removeItem('toituhoc_token');
  localStorage.removeItem('toituhoc_user_email');

  document.getElementById('user-email-display').innerText = 'Chưa đăng nhập';
  document.getElementById('user-avatar-initial').innerText = '?';
  document.getElementById('apikey-warning-banner').style.display = 'none';

  document.getElementById('bottom-navigation').style.display = 'none';
  showView('view-auth');
}

/* ==========================================
   3. API CALL HELPER
   ========================================== */
async function callAppsScriptAPI(action, payload = {}, method = 'POST') {
  if (!state.scriptUrl || state.scriptUrl.includes('placeholder')) {
    alert('⚠️ Bạn chưa dán Web App URL của Google Apps Script! Vui lòng nhấp vào cấu hình ở Trang chủ.');
    throw new Error('Script URL missing');
  }

  try {
    let response;
    const bodyPayload = { action, token: state.token, ...payload };

    if (method === 'GET') {
      const urlParams = new URLSearchParams(bodyPayload);
      response = await fetch(`${state.scriptUrl}?${urlParams.toString()}`);
    } else {
      response = await fetch(state.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(bodyPayload)
      });
    }

    const data = await response.json();
    if (data.code === 'UNAUTHORIZED') {
      alert('Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại!');
      logout();
    }
    return data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

async function checkUserProfile() {
  if (!state.token) return;
  try {
    const res = await callAppsScriptAPI('getUserProfile', {}, 'GET');
    if (res.status === 'success' && res.data) {
      state.hasApiKey = res.data.has_api_key;
      const warningBanner = document.getElementById('apikey-warning-banner');
      if (warningBanner) {
        warningBanner.style.display = state.hasApiKey ? 'none' : 'block';
      }
    }
  } catch (e) {
    console.warn('Could not check user profile:', e);
  }
}

/* ==========================================
   4. DASHBOARD & STATS
   ========================================== */
function setupDashboard() {
  document.getElementById('btn-goto-upload').addEventListener('click', () => {
    showView('view-upload');
    updateNavActive('view-upload');
  });

  document.getElementById('btn-goto-review').addEventListener('click', () => {
    showView('view-review');
    updateNavActive('view-review');
  });
}

async function fetchDashboardStats() {
  if (!state.token) return;

  try {
    const todayStr = getTodayDateString();
    const resDue = await callAppsScriptAPI('getDueVocab', { today: todayStr }, 'GET');
    const resAll = await callAppsScriptAPI('getAllVocab', {}, 'GET');

    if (resDue.status === 'success') {
      document.getElementById('stat-due-count').innerText = resDue.data.length;
      state.dueVocabList = resDue.data;
    }
    if (resAll.status === 'success') {
      document.getElementById('stat-total-count').innerText = resAll.data.length;
      state.allVocabList = resAll.data;
    }
  } catch (e) {
    console.warn('Could not fetch stats automatically:', e);
  }
}

/* ==========================================
   5. UPLOAD & GEMINI OCR FLOW
   ========================================== */
function setupUpload() {
  const trigger = document.getElementById('upload-trigger');
  const fileInput = document.getElementById('camera-file-input');
  const previewBox = document.getElementById('image-preview-box');
  const previewImg = document.getElementById('image-preview-img');
  const btnProcess = document.getElementById('btn-process-image');
  const spinner = document.getElementById('upload-loading-spinner');
  const resultsContainer = document.getElementById('ai-results-container');
  const btnStartReviewNew = document.getElementById('btn-start-review-new');

  trigger.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    compressAndReadImage(file, (base64Str, mimeType) => {
      state.selectedImageBase64 = base64Str;
      state.selectedImageMimeType = mimeType;

      previewImg.src = base64Str;
      previewBox.style.display = 'block';
      btnProcess.style.display = 'flex';
      resultsContainer.style.display = 'none';
    });
  });

  btnProcess.addEventListener('click', async () => {
    if (!state.selectedImageBase64) return;

    if (!state.hasApiKey) {
      alert('⚠️ Bạn chưa cài đặt Gemini API Key cá nhân! Vui lòng vào Cài đặt để thêm API Key của bạn trước khi đọc ảnh.');
      showView('view-settings');
      updateNavActive('view-settings');
      return;
    }

    btnProcess.style.display = 'none';
    spinner.style.display = 'flex';

    try {
      const result = await callAppsScriptAPI('processImage', {
        image_base64: state.selectedImageBase64,
        mime_type: state.selectedImageMimeType,
        file_name: `photo_${Date.now()}.jpg`
      });

      spinner.style.display = 'none';

      if (result.status === 'success' && result.data) {
        renderAIResults(result.data);
        resultsContainer.style.display = 'flex';
      } else {
        alert(result.message || 'Không thể trích xuất từ vựng từ ảnh.');
        btnProcess.style.display = 'flex';
      }
    } catch (err) {
      spinner.style.display = 'none';
      btnProcess.style.display = 'flex';
      alert('Đã có lỗi xảy ra khi xử lý ảnh qua AI: ' + err.message);
    }
  });

  btnStartReviewNew.addEventListener('click', () => {
    showView('view-review');
    updateNavActive('view-review');
  });
}

function compressAndReadImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 1200;
      let width = img.width;
      let height = img.height;

      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
      callback(compressedBase64, 'image/jpeg');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderAIResults(items) {
  const container = document.getElementById('ai-results-list');
  container.innerHTML = '';

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'vocab-item';
    el.innerHTML = `
      <div class="vocab-main">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="vocab-word">${escapeHTML(item.tu_cum)}</span>
          <span class="pos-tag">${escapeHTML(item.loai_tu)}</span>
        </div>
        <div class="vocab-meaning">${escapeHTML(item.nghia)}</div>
        <div style="font-size:0.8rem; color:var(--text-sub); font-style:italic;">"${escapeHTML(item.cau_vi_du)}"</div>
      </div>
      <button class="tts-btn" onclick="speakText('${escapeQuotes(item.tu_cum)}')">🔊</button>
    `;
    container.appendChild(el);
  });
}

/* ==========================================
   6. FLASHCARD REVIEW & SM-2 LOGIC
   ========================================== */
function setupReview() {
  const cardEl = document.getElementById('flashcard-element');
  const btnTtsFront = document.getElementById('btn-tts-front');
  const btnTtsBack = document.getElementById('btn-tts-back');
  const btnBackDashboard = document.getElementById('btn-back-dashboard');

  cardEl.addEventListener('click', () => {
    cardEl.classList.toggle('flipped');
  });

  btnTtsFront.addEventListener('click', (e) => {
    e.stopPropagation();
    const word = document.getElementById('card-word').innerText;
    speakText(word);
  });

  btnTtsBack.addEventListener('click', (e) => {
    e.stopPropagation();
    const word = document.getElementById('card-word').innerText;
    const example = document.getElementById('card-example').innerText;
    speakText(`${word}. ${example}`);
  });

  btnBackDashboard.addEventListener('click', () => {
    showView('view-dashboard');
    updateNavActive('view-dashboard');
  });

  const rateButtons = document.querySelectorAll('.btn-rate');
  rateButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const rating = btn.getAttribute('data-rating');
      await submitCardRating(rating);
    });
  });
}

async function loadReviewQueue() {
  const todayStr = getTodayDateString();
  const cardEl = document.getElementById('flashcard-element');
  cardEl.classList.remove('flipped');

  try {
    const res = await callAppsScriptAPI('getDueVocab', { today: todayStr }, 'GET');
    if (res.status === 'success') {
      state.dueVocabList = res.data || [];
      state.currentReviewIndex = 0;
      renderCurrentCard();
    }
  } catch (err) {
    console.error('Failed to load review queue:', err);
  }
}

function renderCurrentCard() {
  const list = state.dueVocabList;
  const emptyState = document.getElementById('review-empty-state');
  const cardWrapper = document.getElementById('review-card-container');
  const ratingControls = document.getElementById('rating-controls');
  const progressText = document.getElementById('review-progress-text');
  const cardEl = document.getElementById('flashcard-element');

  cardEl.classList.remove('flipped');

  if (!list || list.length === 0 || state.currentReviewIndex >= list.length) {
    emptyState.style.display = 'block';
    cardWrapper.style.display = 'none';
    ratingControls.style.display = 'none';
    progressText.innerText = 'Thẻ 0 / 0';
    return;
  }

  emptyState.style.display = 'none';
  cardWrapper.style.display = 'block';
  ratingControls.style.display = 'grid';

  const item = list[state.currentReviewIndex];
  progressText.innerText = `Thẻ ${state.currentReviewIndex + 1} / ${list.length}`;

  document.getElementById('card-pos').innerText = item.loai_tu || 'NOUN';
  document.getElementById('card-word').innerText = item.tu_cum || '';

  document.getElementById('card-pos-back').innerText = item.loai_tu || 'NOUN';
  document.getElementById('card-meaning').innerText = item.nghia || '';
  document.getElementById('card-example').innerText = `"${item.cau_vi_du || ''}"`;

  const grammarBox = document.getElementById('card-grammar-box');
  if (item.ghi_chu_ngu_phap && item.ghi_chu_ngu_phap.trim()) {
    document.getElementById('card-grammar').innerText = item.ghi_chu_ngu_phap;
    grammarBox.style.display = 'block';
  } else {
    grammarBox.style.display = 'none';
  }

  const photoLink = document.getElementById('card-photo-link');
  if (item.link_anh) {
    photoLink.href = item.link_anh;
    photoLink.style.display = 'inline-block';
  } else {
    photoLink.style.display = 'none';
  }

  setTimeout(() => speakText(item.tu_cum), 300);
}

async function submitCardRating(rating) {
  const currentItem = state.dueVocabList[state.currentReviewIndex];
  if (!currentItem) return;

  state.currentReviewIndex++;
  renderCurrentCard();

  try {
    await callAppsScriptAPI('submitReview', {
      vocab_id: currentItem.id,
      rating: rating
    });
  } catch (err) {
    console.error('Failed to submit rating:', err);
  }
}

/* ==========================================
   7. KHO TỪ VỰNG (ALL VOCAB LIST)
   ========================================== */
function setupVocabList() {
  const searchInput = document.getElementById('input-vocab-search');
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    filterAndRenderVocab(query);
  });
}

async function loadAllVocab() {
  try {
    const res = await callAppsScriptAPI('getAllVocab', {}, 'GET');
    if (res.status === 'success') {
      state.allVocabList = res.data || [];
      filterAndRenderVocab('');
    }
  } catch (err) {
    console.error('Failed to load all vocab:', err);
  }
}

function filterAndRenderVocab(query) {
  const container = document.getElementById('vocab-all-list');
  container.innerHTML = '';

  const filtered = state.allVocabList.filter(item => {
    return (item.tu_cum || '').toLowerCase().includes(query) ||
           (item.nghia || '').toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">Không tìm thấy từ vựng nào.</div>`;
    return;
  }

  filtered.forEach(item => {
    const el = document.createElement('div');
    el.className = 'vocab-item';
    el.innerHTML = `
      <div class="vocab-main">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="vocab-word">${escapeHTML(item.tu_cum)}</span>
          <span class="pos-tag">${escapeHTML(item.loai_tu)}</span>
        </div>
        <div class="vocab-meaning">${escapeHTML(item.nghia)}</div>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
          📅 Ôn tiếp: <strong style="color:var(--primary);">${escapeHTML(item.next_review_date)}</strong> 
          (Ease: ${item.ease_factor || 2.5}, Inter: ${item.interval || 1}d)
        </div>
      </div>
      <button class="tts-btn" onclick="speakText('${escapeQuotes(item.tu_cum)}')">🔊</button>
    `;
    container.appendChild(el);
  });
}

/* ==========================================
   8. USER SETTINGS
   ========================================== */
function setupSettings() {
  const btnSaveApiKey = document.getElementById('btn-save-user-apikey');
  const btnLogout = document.getElementById('btn-logout');

  btnSaveApiKey.addEventListener('click', async () => {
    const apiKey = document.getElementById('input-settings-apikey').value.trim();
    if (!apiKey) {
      alert('Vui lòng nhập API Key Gemini của bạn.');
      return;
    }

    try {
      const res = await callAppsScriptAPI('updateApiKey', { api_key_gemini: apiKey });
      if (res.status === 'success') {
        state.hasApiKey = true;
        document.getElementById('apikey-warning-banner').style.display = 'none';
        alert('Đã lưu Gemini API Key cá nhân thành công!');
      } else {
        alert(res.message || 'Không thể lưu API Key.');
      }
    } catch (err) {
      alert('Đã xảy ra lỗi khi lưu API Key: ' + err.message);
    }
  });

  btnLogout.addEventListener('click', () => {
    if (confirm('Bạn có chắc chắn muốn đăng xuất tài khoản?')) {
      logout();
    }
  });
}

function loadUserSettings() {
  checkUserProfile();
}

/* ==========================================
   9. WEB SPEECH API (TEXT-TO-SPEECH)
   ========================================== */
function speakText(text) {
  if (!text || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;

  const voices = window.speechSynthesis.getVoices();
  const enVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
  if (enVoice) {
    utterance.voice = enVoice;
  }

  window.speechSynthesis.speak(utterance);
}

/* ==========================================
   10. UTILITIES
   ========================================== */
function getTodayDateString() {
  const d = new Date();
  const month = '' + (d.getMonth() + 1);
  const day = '' + d.getDate();
  const year = d.getFullYear();
  return [year, month.length < 2 ? '0' + month : month, day.length < 2 ? '0' + day : day].join('-');
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeQuotes(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'");
}
