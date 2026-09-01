/**
 * Entropy ↔ Lighter Spread Monitor (dnperp) — Phase 7 Engine
 * Host: godnc.com/dnperp
 */

// Palette for chart lines per pair
const PALETTE = ['#4bacf5', '#e59866', '#26a69a', '#e91e63', '#ab47bc', '#fbc02d', '#00bcd4', '#ff7043'];

// Default Tracked Pairs if none in localStorage
const DEFAULT_PAIRS = [
  { id: 'SNDK', name: 'SanDisk Synthetic', hlSymbol: 'SNDK', ltSymbol: 'SNDK' },
  { id: 'ANTH', name: 'Anthropic Pre-IPO', hlSymbol: 'ANTH', ltSymbol: 'ANTHROPIC' }
];

// Multilingual i18n Dictionary
const i18n = {
  VI: {
    appTitle: "Spread & Margin Monitor",
    appSubtitle: "Read-only Live Dashboard • Quản Lý Cặp Động & Playbook Kiến Thức",
    statusLive: "KẾT NỐI SỐNG",
    statusOffline: "LỖI KẾT NỐI",
    updateIn: "Cập nhật sau:",
    btnRefresh: "Làm mới",
    btnManagePairs: "Quản Lý Cặp",
    btnSettings: "Cấu hình",
    tabMonitor: "📊 Live Monitor & Margin",
    tabKnowledge: "📚 Kiến Thức / Playbook",
    
    sectionSpreadTitle: "📊 Basis & Tín Hiệu Delta-Neutral",
    sectionSpreadSub: "Đang theo dõi",
    pairsCountUnit: "cặp",
    warnThreshold: "Ngưỡng cảnh báo:",
    basisLabel: "CHÊNH LỆCH BASIS (Entropy - Lighter)",
    fundingYear: "Funding (Năm):",
    fundingProxy: "Funding Proxy:",
    vol24h: "Volume 24h:",
    signalNeutral: "TRUNG LẬP",
    signalLongLt: "LONG Lighter | SHORT Entropy",
    signalLongHl: "LONG Entropy | SHORT Lighter",
    stratNeutral: "💡 Khuyên dùng: <strong>Chưa có chênh lệch đáng kể (Basis trong ngưỡng safe ±{thresh}%)</strong>",
    stratLongLt: "💡 Khuyên dùng: <strong>LONG Lighter (${ltPrice}) & SHORT Entropy (${hlPrice})</strong> để ăn chênh lệch +{basis}%!",
    stratLongHl: "💡 Khuyên dùng: <strong>LONG Entropy (${hlPrice}) & SHORT Lighter (${ltPrice})</strong> để ăn chênh lệch {basis}%!",

    sectionMarginTitle: "🛡️ Giám Sát Margin & Nguy Cơ Thanh Lý",
    marginWarnThreshold: "Ngưỡng cảnh báo Margin:",
    hlMarginTitle: "Hyperliquid Margin (Entropy)",
    hlMarginSub: "Truy vấn tự động công khai qua clearinghouseState",
    ltMarginTitle: "Lighter Margin (Robinhood Chain)",
    ltMarginSub: "Nhập tay số dư margin cá nhân",
    badgeSafe: "AN TOÀN",
    badgeWarning: "CẢNH BÁO",
    badgeDanger: "NGUY HIỂM",
    labelWallet: "Địa chỉ ví Public (0x...):",
    placeholderWallet: "Nhập địa chỉ ví Hyperliquid (0x...)",
    btnQuery: "Query",
    btnClearWallet: "🗑️ Xoá ví",
    noticeWalletSaved: "Ví sẽ tự động được lưu và tải lại mỗi lần mở trang.",
    labelMarginUsedPct: "Tỷ lệ Margin đã dùng:",
    labelAccountValue: "Tổng Tài Sản (Account Value)",
    labelMarginUsedVal: "Margin Đã Sử Dụng",
    labelLtMarginUsed: "Margin đã dùng ($):",
    labelLtTotalMargin: "Tổng Margin / Equity ($):",
    labelLtFreeMargin: "Margin Khả Dụng (Free)",
    labelLtWarnAt: "Cảnh Báo Thanh Lý At",

    sectionChartTitle: "📈 Lịch Sử Basis 24 Giờ & Biểu Đồ Dao Động",
    btnClearHistory: "Xoá lịch sử",

    modalPairsTitle: "⚙️ Quản Lý Cặp Theo Dõi Động",
    modalAddPairHeader: "➕ Thêm Cặp Mới",
    modalAddPairSub: "Hệ thống sẽ kiểm tra tự động xem ticker có tồn tại trên cả 2 sàn Entropy (dex \"io\") và Lighter hay không trước khi thêm.",
    labelHlTicker: "Ticker Entropy (Hyperliquid):",
    labelLtTicker: "Ticker Lighter (Robinhood):",
    labelPairName: "Tên Hiển Thị (Mô tả):",
    btnAddPairSubmit: "🔍 Xác Minh & Thêm Cặp",
    modalActivePairsHeader: "📋 Danh Sách Cặp Đang Theo Dõi",
    colPairName: "Tên Cặp",
    colHlTicker: "Ticker Entropy (io)",
    colLtTicker: "Ticker Lighter",
    colActions: "Hành Động",
    btnDelete: "🗑️ Xoá",
    btnClose: "Đóng",

    modalSettingsTitle: "⚙️ Cấu Hình Ngưỡng Cảnh Báo & Telegram",
    settingsThresholdsHeader: "🎯 Ngưỡng Cảnh Báo (Thresholds)",
    labelBasisThresh: "Ngưỡng Basis (%) kích hoạt tín hiệu Arbitrage:",
    helpBasisThresh: "Mặc định 0.30%. Khi |Basis| > ngưỡng này, hệ thống hiện tín hiệu Long/Short và bắn Cảnh báo Telegram.",
    labelMarginThresh: "Ngưỡng Cảnh Báo Margin Usage (%):",
    helpMarginThresh: "Mặc định 75.0%. Khi tỷ lệ margin đã dùng vượt quá mức này sẽ hiện màu đỏ nguy hiểm.",
    settingsTgHeader: "✈️ Bot Telegram Cảnh Báo (Tùy chọn)",
    settingsTgDesc: "Tái sử dụng Bot Telegram Hyperliquid sẵn có để nhận thông báo realtime.",
    labelTgToken: "Telegram Bot Token:",
    labelTgChatId: "Telegram Chat ID / Group ID:",
    btnTestTgAlert: "🧪 Gửi Thử Cảnh Báo Telegram",
    btnCancel: "Hủy",
    btnSaveSettings: "Lưu Cấu Hình",

    disclaimerText: "⚠️ Bản build thuần đọc dữ liệu công khai (Read-only). Không kết nối ví, không ký giao dịch."
  },

  EN: {
    appTitle: "Spread & Margin Monitor",
    appSubtitle: "Read-only Live Dashboard • Dynamic Pair Management & Knowledge Playbook",
    statusLive: "LIVE CONNECTED",
    statusOffline: "CONNECTION ERROR",
    updateIn: "Updating in:",
    btnRefresh: "Refresh",
    btnManagePairs: "Manage Pairs",
    btnSettings: "Settings",
    tabMonitor: "📊 Live Monitor & Margin",
    tabKnowledge: "📚 Knowledge / Playbook",

    sectionSpreadTitle: "📊 Basis & Delta-Neutral Signals",
    sectionSpreadSub: "Tracking",
    pairsCountUnit: "pairs",
    warnThreshold: "Warning threshold:",
    basisLabel: "BASIS SPREAD (Entropy - Lighter)",
    fundingYear: "Funding (Annual):",
    fundingProxy: "Funding Proxy:",
    vol24h: "24h Volume:",
    signalNeutral: "NEUTRAL",
    signalLongLt: "LONG Lighter | SHORT Entropy",
    signalLongHl: "LONG Entropy | SHORT Lighter",
    stratNeutral: "💡 Recommendation: <strong>No significant spread (Basis within safe range ±{thresh}%)</strong>",
    stratLongLt: "💡 Recommendation: <strong>LONG Lighter (${ltPrice}) & SHORT Entropy (${hlPrice})</strong> to capture +{basis}% spread!",
    stratLongHl: "💡 Recommendation: <strong>LONG Entropy (${hlPrice}) & SHORT Lighter (${ltPrice})</strong> to capture {basis}% spread!",

    sectionMarginTitle: "🛡️ Margin Monitoring & Liquidation Risk",
    marginWarnThreshold: "Margin alert threshold:",
    hlMarginTitle: "Hyperliquid Margin (Entropy)",
    hlMarginSub: "Auto public query via clearinghouseState",
    ltMarginTitle: "Lighter Margin (Robinhood Chain)",
    ltMarginSub: "Manual personal margin entry",
    badgeSafe: "SAFE",
    badgeWarning: "WARNING",
    badgeDanger: "DANGER",
    labelWallet: "Public Wallet Address (0x...):",
    placeholderWallet: "Enter Hyperliquid public address (0x...)",
    btnQuery: "Query",
    btnClearWallet: "🗑️ Clear Wallet",
    noticeWalletSaved: "Wallet will auto-save and reload on every page visit.",
    labelMarginUsedPct: "Margin Used Ratio:",
    labelAccountValue: "Total Assets (Account Value)",
    labelMarginUsedVal: "Margin Used Amount",
    labelLtMarginUsed: "Margin Used ($):",
    labelLtTotalMargin: "Total Margin / Equity ($):",
    labelLtFreeMargin: "Free Available Margin",
    labelLtWarnAt: "Liquidation Warning At",

    sectionChartTitle: "📈 24-Hour Basis History & Volatility Chart",
    btnClearHistory: "Clear history",

    modalPairsTitle: "⚙️ Dynamic Pair Management",
    modalAddPairHeader: "➕ Add New Pair",
    modalAddPairSub: "System will automatically check if tickers exist on both Entropy (dex \"io\") and Lighter before adding.",
    labelHlTicker: "Entropy Ticker (Hyperliquid):",
    labelLtTicker: "Lighter Ticker (Robinhood):",
    labelPairName: "Display Name (Description):",
    btnAddPairSubmit: "🔍 Verify & Add Pair",
    modalActivePairsHeader: "📋 Active Tracked Pairs",
    colPairName: "Pair Name",
    colHlTicker: "Entropy Ticker (io)",
    colLtTicker: "Lighter Ticker",
    colActions: "Actions",
    btnDelete: "🗑️ Remove",
    btnClose: "Close",

    modalSettingsTitle: "⚙️ Alert Thresholds & Telegram Settings",
    settingsThresholdsHeader: "🎯 Alert Thresholds",
    labelBasisThresh: "Basis Threshold (%) for Arbitrage Signals:",
    helpBasisThresh: "Default 0.30%. When |Basis| > threshold, system triggers Long/Short signal and Telegram alert.",
    labelMarginThresh: "Margin Usage Alert Threshold (%):",
    helpMarginThresh: "Default 75.0%. Highlighted red when margin usage exceeds this level.",
    settingsTgHeader: "✈️ Telegram Alert Bot (Optional)",
    settingsTgDesc: "Reuse existing Hyperliquid Telegram Bot for real-time alerts.",
    labelTgToken: "Telegram Bot Token:",
    labelTgChatId: "Telegram Chat ID / Group ID:",
    btnTestTgAlert: "🧪 Test Telegram Alert",
    btnCancel: "Cancel",
    btnSaveSettings: "Save Settings",

    disclaimerText: "⚠️ 100% Read-only public data dashboard. No wallet connection, no transaction signing required."
  }
};

// Global Application State
const state = {
  // Active Language
  lang: localStorage.getItem('dnperp_lang') || 'VI',

  // Configuration Settings (saved in localStorage)
  config: {
    basisThreshold: 0.30, // %
    marginThreshold: 75.0, // %
    tgToken: localStorage.getItem('dnperp_tg_token') || '',
    tgChatId: localStorage.getItem('dnperp_tg_chat_id') || '',
    hlWallet: localStorage.getItem('dnperp_wallet_address') || localStorage.getItem('dnperp_hl_wallet') || '',
    ltMarginUsed: parseFloat(localStorage.getItem('dnperp_lt_used')) || 0,
    ltTotalMargin: parseFloat(localStorage.getItem('dnperp_lt_total')) || 1000
  },

  // Dynamic Tracked Pairs List
  trackedPairs: JSON.parse(localStorage.getItem('dnperp_tracked_pairs') || 'null') || DEFAULT_PAIRS,

  // Live Market Data per pair ID
  market: {},

  // Margin Data
  margin: {
    hl: { accountValue: 0, totalMarginUsed: 0, pct: 0 },
    lt: { used: 0, total: 1000, pct: 0 }
  },

  // Historical Basis Samples (up to 24h)
  history: JSON.parse(localStorage.getItem('dnperp_history') || '[]'),
  
  // App Controls
  countdown: 10,
  timerId: null,
  chart: null,
  activeChartRange: '24h',
  lastAlertTime: {}
};

// Initialize App on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  initMarketState();
  loadStoredConfig();
  setLanguage(state.lang);
  renderSpreadCards();
  initChart();
  seedHistoryIfEmpty();
  
  // Attach Event Listeners
  setupEventListeners();
  
  // Perform First Data Fetch
  fetchMarketData();
  
  // Auto-fetch HL Wallet Margin on load if saved
  if (state.config.hlWallet) {
    fetchHlMargin();
  } else {
    updateHlMarginUI(0, 0, 0);
  }

  updateLighterMarginUI();

  // Start Refresh Timer
  startCountdown();
});

// Switch Language Engine
function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem('dnperp_lang', lang);

  // Update Language Switcher Buttons UI
  document.getElementById('langBtnVI').classList.toggle('active', lang === 'VI');
  document.getElementById('langBtnEN').classList.toggle('active', lang === 'EN');

  // Update Static Elements with data-i18n Attribute
  const dict = i18n[lang] || i18n.VI;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  // Update Input Placeholders
  document.getElementById('hlWalletAddress').placeholder = dict.placeholderWallet;

  // Toggle Knowledge Content Blocks
  if (lang === 'EN') {
    document.getElementById('knowledge-content-vi').classList.add('hidden');
    document.getElementById('knowledge-content-en').classList.remove('hidden');
  } else {
    document.getElementById('knowledge-content-vi').classList.remove('hidden');
    document.getElementById('knowledge-content-en').classList.add('hidden');
  }

  // Re-render Dynamic Cards & Signals with new language text
  renderSpreadCards();
  recalculateBasisAndSignals();
}

// Initialize market data structures for tracked pairs
function initMarketState() {
  state.trackedPairs.forEach(p => {
    if (!state.market[p.id]) {
      state.market[p.id] = { hlPrice: 0, hlFunding: 0, hlVol: 0, ltPrice: 0, ltFunding: 0, ltVol: 0, basis: 0, basisAbs: 0 };
    }
  });
  document.getElementById('trackedPairsCount').innerText = state.trackedPairs.length;
}

// Load Configuration into UI Input Controls
function loadStoredConfig() {
  const savedBasis = localStorage.getItem('dnperp_basis_thresh');
  if (savedBasis) state.config.basisThreshold = parseFloat(savedBasis);
  
  const savedMargin = localStorage.getItem('dnperp_margin_thresh');
  if (savedMargin) state.config.marginThreshold = parseFloat(savedMargin);

  document.getElementById('inputBasisThreshold').value = state.config.basisThreshold;
  document.getElementById('inputMarginThreshold').value = state.config.marginThreshold;
  document.getElementById('inputTgToken').value = state.config.tgToken;
  document.getElementById('inputTgChatId').value = state.config.tgChatId;
  
  const savedWallet = localStorage.getItem('dnperp_wallet_address') || localStorage.getItem('dnperp_hl_wallet') || '';
  document.getElementById('hlWalletAddress').value = savedWallet;

  document.getElementById('ltMarginUsed').value = state.config.ltMarginUsed;
  document.getElementById('ltTotalMargin').value = state.config.ltTotalMargin;

  updateThresholdDisplayLabels();
}

function updateThresholdDisplayLabels() {
  document.getElementById('displayBasisThreshold').innerText = state.config.basisThreshold.toFixed(2) + '%';
  document.getElementById('displayMarginThreshold').innerText = state.config.marginThreshold.toFixed(1) + '%';
  
  document.querySelectorAll('.displayThresholdVal').forEach(el => {
    el.innerText = state.config.basisThreshold.toFixed(2) + '%';
  });
}

// Dynamically Render Card Matrix for Active Tracked Pairs
function renderSpreadCards() {
  const container = document.getElementById('spreadCardsContainer');
  container.innerHTML = '';

  const dict = i18n[state.lang] || i18n.VI;

  state.trackedPairs.forEach(pair => {
    const cardHtml = `
      <div class="spread-card" id="card-${pair.id}">
        <div class="card-top">
          <div class="pair-info">
            <span class="pair-symbol">${pair.id}</span>
            <span class="pair-name">${pair.name}</span>
          </div>
          <div class="action-badge neutral" id="signal-${pair.id}">
            <span class="badge-icon">⚪</span>
            <span class="badge-text">${dict.signalNeutral}</span>
          </div>
        </div>

        <div class="basis-hero-box">
          <div class="basis-label">${dict.basisLabel}</div>
          <div class="basis-value-group">
            <span class="basis-percent mono-num" id="basis-${pair.id}">0.00%</span>
            <span class="basis-abs mono-num" id="basisAbs-${pair.id}">($0.00)</span>
          </div>
        </div>

        <div class="price-comparison-grid">
          <div class="source-col entropy">
            <div class="source-header">
              <span class="source-tag">Entropy (Hyperliquid)</span>
              <span class="dex-tag">io:${pair.hlSymbol}</span>
            </div>
            <div class="source-price mono-num" id="hlPrice-${pair.id}">$0.00</div>
            <div class="source-metrics">
              <div class="metric-item">
                <span class="m-label">${dict.fundingYear}</span>
                <span class="m-val mono-num" id="hlFunding-${pair.id}">0.00%</span>
              </div>
              <div class="metric-item">
                <span class="m-label">${dict.vol24h}</span>
                <span class="m-val mono-num" id="hlVol-${pair.id}">$0</span>
              </div>
            </div>
          </div>

          <div class="vs-divider">VS</div>

          <div class="source-col lighter">
            <div class="source-header">
              <span class="source-tag">Lighter</span>
              <span class="dex-tag">${pair.ltSymbol}</span>
            </div>
            <div class="source-price mono-num" id="ltPrice-${pair.id}">$0.00</div>
            <div class="source-metrics">
              <div class="metric-item">
                <span class="m-label">${dict.fundingProxy}</span>
                <span class="m-val mono-num" id="ltFunding-${pair.id}">0.00%</span>
              </div>
              <div class="metric-item">
                <span class="m-label">${dict.vol24h}</span>
                <span class="m-val mono-num" id="ltVol-${pair.id}">$0</span>
              </div>
            </div>
          </div>
        </div>

        <div class="strategy-recommendation" id="strat-${pair.id}">
          ${dict.stratNeutral.replace('{thresh}', state.config.basisThreshold.toFixed(2))}
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHtml);
  });
}

// Seed Initial 24h Data if History is Empty
function seedHistoryIfEmpty() {
  if (state.history.length === 0) {
    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    const intervalMs = 15 * 60 * 1000;
    
    let baseValues = { SNDK: -0.05, ANTH: 0.08, OAI: 0.12, IONQ: -0.10, NBIS: 0.04 };

    for (let t = now - twentyFourHoursMs; t <= now; t += intervalMs) {
      const point = { time: t, pairs: {} };
      state.trackedPairs.forEach(p => {
        let val = baseValues[p.id] || 0.02;
        val += (Math.random() - 0.49) * 0.05;
        val = Math.max(-0.45, Math.min(0.55, val));
        baseValues[p.id] = val;
        point.pairs[p.id] = parseFloat(val.toFixed(3));
      });
      state.history.push(point);
    }
    saveHistory();
  }
  updateChartData();
}

// Event Listeners Setup
function setupEventListeners() {
  // Language Switcher Buttons
  document.getElementById('langBtnVI').addEventListener('click', () => setLanguage('VI'));
  document.getElementById('langBtnEN').addEventListener('click', () => setLanguage('EN'));

  // Navigation Tab Switching
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      const targetTab = e.target.dataset.tab;
      if (targetTab === 'tab-monitor') {
        document.getElementById('tab-monitor-view').classList.remove('hidden');
        document.getElementById('tab-knowledge-view').classList.add('hidden');
      } else if (targetTab === 'tab-knowledge') {
        document.getElementById('tab-monitor-view').classList.add('hidden');
        document.getElementById('tab-knowledge-view').classList.remove('hidden');
      }
    });
  });

  // Manual Refresh
  document.getElementById('btnManualRefresh').addEventListener('click', () => {
    state.countdown = 10;
    fetchMarketData();
    if (state.config.hlWallet) fetchHlMargin();
  });

  // Query HL Margin Button
  document.getElementById('btnQueryHlMargin').addEventListener('click', () => {
    const w = document.getElementById('hlWalletAddress').value.trim();
    if (w) {
      state.config.hlWallet = w;
      localStorage.setItem('dnperp_wallet_address', w);
      localStorage.setItem('dnperp_hl_wallet', w);
      fetchHlMargin();
    }
  });

  // Enter Key on Wallet Input
  document.getElementById('hlWalletAddress').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const w = e.target.value.trim();
      if (w) {
        state.config.hlWallet = w;
        localStorage.setItem('dnperp_wallet_address', w);
        localStorage.setItem('dnperp_hl_wallet', w);
        fetchHlMargin();
      }
    }
  });

  // Clear Saved Wallet Address
  document.getElementById('btnClearWallet').addEventListener('click', () => {
    localStorage.removeItem('dnperp_wallet_address');
    localStorage.removeItem('dnperp_hl_wallet');
    state.config.hlWallet = '';
    document.getElementById('hlWalletAddress').value = '';
    updateHlMarginUI(0, 0, 0);
  });

  // Manual Lighter Margin Inputs
  const updateLt = () => {
    const u = parseFloat(document.getElementById('ltMarginUsed').value) || 0;
    const t = parseFloat(document.getElementById('ltTotalMargin').value) || 1;
    state.config.ltMarginUsed = u;
    state.config.ltTotalMargin = t;
    localStorage.setItem('dnperp_lt_used', u);
    localStorage.setItem('dnperp_lt_total', t);
    updateLighterMarginUI();
  };
  document.getElementById('ltMarginUsed').addEventListener('input', updateLt);
  document.getElementById('ltTotalMargin').addEventListener('input', updateLt);

  // Settings Modal Controls
  document.getElementById('btnOpenSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('hidden');
  });
  document.getElementById('btnCloseSettings').addEventListener('click', () => closeModal('settingsModal'));
  document.getElementById('btnCancelSettings').addEventListener('click', () => closeModal('settingsModal'));

  document.getElementById('btnSaveSettings').addEventListener('click', () => {
    state.config.basisThreshold = parseFloat(document.getElementById('inputBasisThreshold').value) || 0.30;
    state.config.marginThreshold = parseFloat(document.getElementById('inputMarginThreshold').value) || 75.0;
    state.config.tgToken = document.getElementById('inputTgToken').value.trim();
    state.config.tgChatId = document.getElementById('inputTgChatId').value.trim();

    localStorage.setItem('dnperp_basis_thresh', state.config.basisThreshold);
    localStorage.setItem('dnperp_margin_thresh', state.config.marginThreshold);
    localStorage.setItem('dnperp_tg_token', state.config.tgToken);
    localStorage.setItem('dnperp_tg_chat_id', state.config.tgChatId);

    updateThresholdDisplayLabels();
    recalculateBasisAndSignals();
    updateChartThresholdLines();
    closeModal('settingsModal');
  });

  // Test Telegram Notification
  document.getElementById('btnTestTgAlert').addEventListener('click', async () => {
    const resEl = document.getElementById('tgTestResult');
    const token = document.getElementById('inputTgToken').value.trim();
    const chatId = document.getElementById('inputTgChatId').value.trim();

    if (!token || !chatId) {
      resEl.innerText = state.lang === 'EN' ? '❌ Please enter Bot Token & Chat ID!' : '❌ Vui lòng nhập Bot Token và Chat ID!';
      resEl.style.color = 'var(--accent-danger)';
      return;
    }

    resEl.innerText = state.lang === 'EN' ? '⏳ Sending test alert...' : '⏳ Đang gửi thử...';
    resEl.style.color = 'var(--text-gold)';

    const msg = `🧪 <b>Test Telegram Alert — Entropy ↔ Lighter Monitor</b>\n\n✅ Connection verified from <code>godnc.com/dnperp</code>!\nRealtime alerts ready when basis or margin threshold is breached.`;
    const success = await sendTelegramMessage(token, chatId, msg);

    if (success) {
      resEl.innerText = state.lang === 'EN' ? '✅ Alert sent successfully!' : '✅ Đã gửi thành công vào Telegram!';
      resEl.style.color = 'var(--accent-safe)';
    } else {
      resEl.innerText = state.lang === 'EN' ? '❌ Failed to send. Check Token/Chat ID!' : '❌ Gửi thất bại. Kiểm tra lại Token/Chat ID!';
      resEl.style.color = 'var(--accent-danger)';
    }
  });

  // Manage Pairs Modal Controls
  document.getElementById('btnManagePairs').addEventListener('click', () => {
    renderPairsTable();
    document.getElementById('pairsModal').classList.remove('hidden');
  });
  document.getElementById('btnClosePairsModal').addEventListener('click', () => closeModal('pairsModal'));
  document.getElementById('btnClosePairsFooter').addEventListener('click', () => closeModal('pairsModal'));

  // Add Pair Form Submission & Verification
  document.getElementById('btnAddPairSubmit').addEventListener('click', verifyAndAddPair);

  // Chart Range Selector Tabs
  document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state.activeChartRange = e.target.dataset.time;
      updateChartData();
    });
  });

  // Clear History
  document.getElementById('btnClearHistory').addEventListener('click', () => {
    const confirmMsg = state.lang === 'EN' 
      ? 'Are you sure you want to clear 24h historical data?' 
      : 'Bạn có chắc chắn muốn xoá toàn bộ lịch sử 24h đã lưu?';
    if (confirm(confirmMsg)) {
      state.history = [];
      saveHistory();
      updateChartData();
    }
  });
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// Render Pairs Management Table
function renderPairsTable() {
  const tbody = document.getElementById('pairsTableBody');
  tbody.innerHTML = '';
  const dict = i18n[state.lang] || i18n.VI;

  state.trackedPairs.forEach((pair) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${pair.name || pair.id}</strong> (${pair.id})</td>
      <td><span class="dex-tag">io:${pair.hlSymbol}</span></td>
      <td><span class="dex-tag">${pair.ltSymbol}</span></td>
      <td style="text-align: right;">
        <button class="btn btn-danger btn-xs" onclick="removeTrackedPair('${pair.id}')" ${state.trackedPairs.length <= 1 ? 'disabled title="Minimum 1 pair required"' : ''}>
          ${dict.btnDelete}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Verify Pair on APIs and Add to Active List
async function verifyAndAddPair() {
  const statusEl = document.getElementById('addPairStatus');
  const hlSym = document.getElementById('inputAddHlSymbol').value.trim().toUpperCase();
  const ltSym = document.getElementById('inputAddLtSymbol').value.trim().toUpperCase();
  let name = document.getElementById('inputAddName').value.trim();

  const isEn = state.lang === 'EN';

  if (!hlSym || !ltSym) {
    statusEl.innerText = isEn ? '❌ Please enter both Entropy and Lighter tickers!' : '❌ Vui lòng nhập cả Ticker Entropy và Lighter!';
    statusEl.style.color = 'var(--accent-danger)';
    return;
  }

  const pairId = hlSym;
  if (state.trackedPairs.some(p => p.id === pairId)) {
    statusEl.innerText = isEn ? `❌ Pair ${pairId} already exists in tracking list!` : `❌ Cặp ${pairId} đã tồn tại trong danh sách!`;
    statusEl.style.color = 'var(--accent-danger)';
    return;
  }

  if (!name) name = `${hlSym} Synthetic`;

  statusEl.innerText = isEn ? '⏳ Verifying ticker on Hyperliquid & Lighter...' : '⏳ Đang kiểm tra ticker trên Hyperliquid & Lighter...';
  statusEl.style.color = 'var(--text-gold)';

  try {
    const hlRes = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs', dex: 'io' })
    });
    const hlData = await hlRes.json();
    const hlUniverse = hlData[0]?.universe || [];
    const hlFound = hlUniverse.some(u => u.name === hlSym || u.name === `io:${hlSym}` || u.name.endsWith(':' + hlSym));

    if (!hlFound) {
      statusEl.innerText = isEn ? `❌ Ticker '${hlSym}' not found on Hyperliquid dex "io"!` : `❌ Ticker '${hlSym}' không tìm thấy trên Hyperliquid dex "io"!`;
      statusEl.style.color = 'var(--accent-danger)';
      return;
    }

    const ltRes = await fetch('https://api.rh.lighter.xyz/api/v1/orderBookDetails');
    const ltData = await ltRes.json();
    const books = ltData.order_book_details || [];
    const ltFound = books.some(b => b.symbol === ltSym);

    if (!ltFound) {
      statusEl.innerText = isEn ? `❌ Ticker '${ltSym}' not found on Lighter Robinhood Chain!` : `❌ Ticker '${ltSym}' không tìm thấy trên Lighter Robinhood Chain!`;
      statusEl.style.color = 'var(--accent-danger)';
      return;
    }

    const newPair = { id: pairId, name: name, hlSymbol: hlSym, ltSymbol: ltSym };
    state.trackedPairs.push(newPair);
    localStorage.setItem('dnperp_tracked_pairs', JSON.stringify(state.trackedPairs));

    initMarketState();
    renderSpreadCards();
    renderPairsTable();
    updateChartData();

    fetchMarketData();

    document.getElementById('inputAddHlSymbol').value = '';
    document.getElementById('inputAddLtSymbol').value = '';
    document.getElementById('inputAddName').value = '';

    statusEl.innerText = isEn ? `✅ Pair ${pairId} added successfully!` : `✅ Đã thêm cặp ${pairId} thành công!`;
    statusEl.style.color = 'var(--accent-safe)';

  } catch (err) {
    console.error('Verification error:', err);
    statusEl.innerText = isEn ? '❌ API error during ticker verification!' : '❌ Lỗi kết nối API khi xác minh ticker!';
    statusEl.style.color = 'var(--accent-danger)';
  }
}

// Remove Tracked Pair
window.removeTrackedPair = function(pairId) {
  const isEn = state.lang === 'EN';
  if (state.trackedPairs.length <= 1) {
    alert(isEn ? 'At least 1 tracked pair required!' : 'Cần giữ ít nhất 1 cặp để theo dõi!');
    return;
  }

  const msg = isEn ? `Are you sure you want to remove pair ${pairId}?` : `Bạn có chắc muốn xoá cặp ${pairId} khỏi danh sách theo dõi?`;
  if (confirm(msg)) {
    state.trackedPairs = state.trackedPairs.filter(p => p.id !== pairId);
    localStorage.setItem('dnperp_tracked_pairs', JSON.stringify(state.trackedPairs));

    delete state.market[pairId];
    initMarketState();
    renderSpreadCards();
    renderPairsTable();
    recalculateBasisAndSignals();
    updateChartData();
  }
};

// Timer Loop (10s refresh)
function startCountdown() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    state.countdown--;
    document.getElementById('countdownTimer').innerText = state.countdown + 's';
    
    if (state.countdown <= 0) {
      state.countdown = 10;
      fetchMarketData();
      if (state.config.hlWallet) fetchHlMargin();
    }
  }, 1000);
}

// Main Fetcher for Hyperliquid (Entropy) & Lighter Markets
async function fetchMarketData() {
  const statusLabel = document.getElementById('statusLabel');
  const connectionStatus = document.getElementById('connectionStatus');
  const dict = i18n[state.lang] || i18n.VI;

  try {
    const [hlRes, ltRes] = await Promise.all([
      fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs', dex: 'io' })
      }),
      fetch('https://api.rh.lighter.xyz/api/v1/orderBookDetails')
    ]);

    if (!hlRes.ok || !ltRes.ok) throw new Error('API fetch failed');

    const hlData = await hlRes.json();
    const ltData = await ltRes.json();

    const hlUniverse = hlData[0]?.universe || [];
    const hlAssetCtxs = hlData[1] || [];
    const books = ltData.order_book_details || [];

    const currentPoint = { time: Date.now(), pairs: {} };

    state.trackedPairs.forEach(pair => {
      const hlIdx = hlUniverse.findIndex(u => u.name === pair.hlSymbol || u.name === `io:${pair.hlSymbol}` || u.name.endsWith(':' + pair.hlSymbol));
      if (hlIdx !== -1 && hlAssetCtxs[hlIdx]) {
        const ctx = hlAssetCtxs[hlIdx];
        const markPx = parseFloat(ctx.markPx) || 0;
        const fundingHourly = parseFloat(ctx.funding) || 0;
        const fundingAnnual = fundingHourly * 24 * 365 * 100;
        const vol24h = parseFloat(ctx.dayNtlVlm) || 0;
        
        state.market[pair.id].hlPrice = markPx;
        state.market[pair.id].hlFunding = fundingAnnual;
        state.market[pair.id].hlVol = vol24h;
      }

      const ltBook = books.find(b => b.symbol === pair.ltSymbol);
      if (ltBook) {
        const markPx = parseFloat(ltBook.mark_price) || 0;
        const indexPx = parseFloat(ltBook.index_price) || markPx || 1;
        const fundingProxy = ((markPx - indexPx) / indexPx) * 100;
        const vol24h = parseFloat(ltBook.daily_quote_token_volume) || 0;

        state.market[pair.id].ltPrice = markPx;
        state.market[pair.id].ltFunding = fundingProxy;
        state.market[pair.id].ltVol = vol24h;
      }

      const m = state.market[pair.id];
      if (m.ltPrice > 0 && m.hlPrice > 0) {
        m.basis = ((m.hlPrice - m.ltPrice) / m.ltPrice) * 100;
        m.basisAbs = m.hlPrice - m.ltPrice;
      } else {
        m.basis = 0;
        m.basisAbs = 0;
      }

      currentPoint.pairs[pair.id] = parseFloat(m.basis.toFixed(3));
    });

    connectionStatus.className = 'status-indicator live';
    statusLabel.innerText = dict.statusLive;

    recalculateBasisAndSignals();

    state.history.push(currentPoint);
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    state.history = state.history.filter(h => h.time >= cutoff);
    saveHistory();
    updateChartData();

  } catch (err) {
    console.error('Data fetch error:', err);
    connectionStatus.className = 'status-indicator offline';
    statusLabel.innerText = dict.statusOffline;
  }
}

// Fetch Public Hyperliquid Wallet Clearinghouse State
async function fetchHlMargin() {
  const wallet = state.config.hlWallet;
  if (!wallet || wallet === '0x0000000000000000000000000000000000000000') {
    updateHlMarginUI(0, 0, 0);
    return;
  }

  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: wallet, dex: 'io' })
    });
    
    if (!res.ok) throw new Error('HL margin query failed');
    const data = await res.json();

    const summary = data.marginSummary || {};
    const accountVal = parseFloat(summary.accountValue) || 0;
    const marginUsed = parseFloat(summary.totalMarginUsed) || 0;
    const pct = accountVal > 0 ? (marginUsed / accountVal) * 100 : 0;

    state.margin.hl = { accountValue: accountVal, totalMarginUsed: marginUsed, pct };
    updateHlMarginUI(accountVal, marginUsed, pct);

    if (pct >= state.config.marginThreshold) {
      triggerTelegramAlert('HL_MARGIN', `⚠️ <b>Hyperliquid Margin Warning!</b>\n\nVí: <code>${wallet}</code>\nMargin Usage: <b>${pct.toFixed(1)}%</b> (Vượt ngưỡng ${state.config.marginThreshold}%)\nTài sản: $${accountVal.toLocaleString()}\nMargin dùng: $${marginUsed.toLocaleString()}`);
    }

  } catch (err) {
    console.error('HL Margin query error:', err);
  }
}

// Recalculate Signals & Update UI Cards
function recalculateBasisAndSignals() {
  const thresh = state.config.basisThreshold;
  const dict = i18n[state.lang] || i18n.VI;
  const isEn = state.lang === 'EN';
  let activeBannerMsg = null;

  state.trackedPairs.forEach(pair => {
    const m = state.market[pair.id];
    if (!m) return;

    const hlPriceEl = document.getElementById(`hlPrice-${pair.id}`);
    const hlFundingEl = document.getElementById(`hlFunding-${pair.id}`);
    const hlVolEl = document.getElementById(`hlVol-${pair.id}`);

    const ltPriceEl = document.getElementById(`ltPrice-${pair.id}`);
    const ltFundingEl = document.getElementById(`ltFunding-${pair.id}`);
    const ltVolEl = document.getElementById(`ltVol-${pair.id}`);

    const yearSuffix = isEn ? '/yr' : '/năm';

    if (hlPriceEl) hlPriceEl.innerText = `$${m.hlPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (hlFundingEl) hlFundingEl.innerText = `${m.hlFunding > 0 ? '+' : ''}${m.hlFunding.toFixed(2)}%${yearSuffix}`;
    if (hlVolEl) hlVolEl.innerText = `$${Math.round(m.hlVol).toLocaleString()}`;

    if (ltPriceEl) ltPriceEl.innerText = `$${m.ltPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (ltFundingEl) ltFundingEl.innerText = `${m.ltFunding > 0 ? '+' : ''}${m.ltFunding.toFixed(2)}%`;
    if (ltVolEl) ltVolEl.innerText = `$${Math.round(m.ltVol).toLocaleString()}`;

    const basisEl = document.getElementById(`basis-${pair.id}`);
    const basisAbsEl = document.getElementById(`basisAbs-${pair.id}`);

    if (basisEl) {
      const formattedBasis = `${m.basis >= 0 ? '+' : ''}${m.basis.toFixed(2)}%`;
      basisEl.innerText = formattedBasis;
      basisEl.className = 'basis-percent mono-num ' + (m.basis > 0 ? 'positive' : (m.basis < 0 ? 'negative' : ''));
    }

    if (basisAbsEl) {
      basisAbsEl.innerText = `($${m.basisAbs >= 0 ? '+' : ''}${m.basisAbs.toFixed(2)})`;
    }

    const signalBadge = document.getElementById(`signal-${pair.id}`);
    const stratBox = document.getElementById(`strat-${pair.id}`);

    if (m.basis > thresh) {
      if (signalBadge) {
        signalBadge.className = 'action-badge long-lt';
        signalBadge.innerHTML = `<span class="badge-icon">🟢</span><span class="badge-text">${dict.signalLongLt}</span>`;
      }
      if (stratBox) {
        stratBox.innerHTML = dict.stratLongLt
          .replace('{ltPrice}', m.ltPrice.toFixed(2))
          .replace('{hlPrice}', m.hlPrice.toFixed(2))
          .replace('{basis}', m.basis.toFixed(2));
      }

      activeBannerMsg = isEn 
        ? `Warning: ${pair.id} Basis exceeds +${m.basis.toFixed(2)}% (Open Long Lighter / Short Entropy)`
        : `Cảnh báo: Basis ${pair.id} đang vượt ngưỡng +${m.basis.toFixed(2)}% (Mở Long Lighter / Short Entropy)`;

      triggerTelegramAlert(pair.id, `🚨 <b>ARBITRAGE SIGNAL: ${pair.id}!</b>\n\nBasis Spread: <b>+${m.basis.toFixed(2)}%</b> (Exceeds ${thresh}%)\n• Entropy: $${m.hlPrice.toFixed(2)}\n• Lighter: $${m.ltPrice.toFixed(2)}\n👉 <b>Action:</b> LONG Lighter | SHORT Entropy`);

    } else if (m.basis < -thresh) {
      if (signalBadge) {
        signalBadge.className = 'action-badge long-hl';
        signalBadge.innerHTML = `<span class="badge-icon">🔵</span><span class="badge-text">${dict.signalLongHl}</span>`;
      }
      if (stratBox) {
        stratBox.innerHTML = dict.stratLongHl
          .replace('{hlPrice}', m.hlPrice.toFixed(2))
          .replace('{ltPrice}', m.ltPrice.toFixed(2))
          .replace('{basis}', m.basis.toFixed(2));
      }

      activeBannerMsg = isEn 
        ? `Warning: ${pair.id} Basis drops below ${m.basis.toFixed(2)}% (Open Long Entropy / Short Lighter)`
        : `Cảnh báo: Basis ${pair.id} đang giảm âm ${m.basis.toFixed(2)}% (Mở Long Entropy / Short Lighter)`;

      triggerTelegramAlert(pair.id, `🚨 <b>ARBITRAGE SIGNAL: ${pair.id}!</b>\n\nBasis Spread: <b>${m.basis.toFixed(2)}%</b> (Exceeds -${thresh}%)\n• Entropy: $${m.hlPrice.toFixed(2)}\n• Lighter: $${m.ltPrice.toFixed(2)}\n👉 <b>Action:</b> LONG Entropy | SHORT Lighter`);

    } else {
      if (signalBadge) {
        signalBadge.className = 'action-badge neutral';
        signalBadge.innerHTML = `<span class="badge-icon">⚪</span><span class="badge-text">${dict.signalNeutral}</span>`;
      }
      if (stratBox) {
        stratBox.innerHTML = dict.stratNeutral.replace('{thresh}', thresh.toFixed(2));
      }
    }
  });

  const bannerContainer = document.getElementById('alertBannerContainer');
  const bannerText = document.getElementById('alertBannerText');
  if (activeBannerMsg) {
    bannerText.innerText = activeBannerMsg;
    bannerContainer.classList.remove('hidden');
  }
}

// Update Hyperliquid Margin UI
function updateHlMarginUI(accountVal, marginUsed, pct) {
  const dict = i18n[state.lang] || i18n.VI;
  document.getElementById('hlAccountValue').innerText = `$${accountVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('hlTotalMarginUsed').innerText = `$${marginUsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('hlMarginPct').innerText = `${pct.toFixed(1)}%`;

  const fill = document.getElementById('hlMarginFill');
  const badge = document.getElementById('hlMarginBadge');
  const clampedPct = Math.min(100, Math.max(0, pct));
  fill.style.width = clampedPct + '%';

  const warnThresh = state.config.marginThreshold;
  if (pct >= warnThresh) {
    fill.className = 'meter-fill danger';
    badge.className = 'margin-status-badge danger';
    badge.innerText = dict.badgeDanger;
  } else if (pct >= 50) {
    fill.className = 'meter-fill warning';
    badge.className = 'margin-status-badge warning';
    badge.innerText = dict.badgeWarning;
  } else {
    fill.className = 'meter-fill safe';
    badge.className = 'margin-status-badge safe';
    badge.innerText = dict.badgeSafe;
  }
}

// Update Lighter Margin UI
function updateLighterMarginUI() {
  const dict = i18n[state.lang] || i18n.VI;
  const used = state.config.ltMarginUsed;
  const total = state.config.ltTotalMargin;
  const free = Math.max(0, total - used);
  const pct = total > 0 ? (used / total) * 100 : 0;

  document.getElementById('ltFreeMargin').innerText = `$${free.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('ltMarginPct').innerText = `${pct.toFixed(1)}%`;

  const fill = document.getElementById('ltMarginFill');
  const badge = document.getElementById('ltMarginBadge');
  const clampedPct = Math.min(100, Math.max(0, pct));
  fill.style.width = clampedPct + '%';

  const warnThresh = state.config.marginThreshold;
  if (pct >= warnThresh) {
    fill.className = 'meter-fill danger';
    badge.className = 'margin-status-badge danger';
    badge.innerText = dict.badgeDanger;

    triggerTelegramAlert('LT_MARGIN', `⚠️ <b>Lighter Margin Warning!</b>\n\nMargin Usage: <b>${pct.toFixed(1)}%</b> (Vượt ngưỡng ${warnThresh}%)\nTotal Equity: $${total.toLocaleString()}\nMargin dùng: $${used.toLocaleString()}`);

  } else if (pct >= 50) {
    fill.className = 'meter-fill warning';
    badge.className = 'margin-status-badge warning';
    badge.innerText = dict.badgeWarning;
  } else {
    fill.className = 'meter-fill safe';
    badge.className = 'margin-status-badge safe';
    badge.innerText = dict.badgeSafe;
  }
}

// Save History to LocalStorage
function saveHistory() {
  localStorage.setItem('dnperp_history', JSON.stringify(state.history));
}

// Send Telegram Message Helper
async function sendTelegramMessage(token, chatId, text) {
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    return res.ok;
  } catch (e) {
    console.error('Telegram dispatch error:', e);
    return false;
  }
}

// Trigger Telegram Alert with Anti-Spam Throttle (5 mins cooldown)
function triggerTelegramAlert(alertKey, message) {
  const now = Date.now();
  const cooldown = 5 * 60 * 1000;

  if (now - (state.lastAlertTime[alertKey] || 0) > cooldown) {
    const token = state.config.tgToken;
    const chatId = state.config.tgChatId;
    if (token && chatId) {
      sendTelegramMessage(token, chatId, message);
      state.lastAlertTime[alertKey] = now;
    }
  }
}

// Initialize Chart.js with Dynamic Datasets for Tracked Pairs
function initChart() {
  const ctx = document.getElementById('basisChart').getContext('2d');

  state.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0c1420',
          titleColor: '#f3ecdd',
          bodyColor: '#c9b48c',
          borderColor: '#1e324d',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(3)}%`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#8e9aa8', font: { family: 'JetBrains Mono', size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#c9b48c',
            font: { family: 'JetBrains Mono', size: 11 },
            callback: (val) => val.toFixed(2) + '%'
          }
        }
      }
    }
  });
}

// Update Chart Data dynamically for active tracked pairs
function updateChartData() {
  if (!state.chart) return;

  const now = Date.now();
  let duration = 24 * 60 * 60 * 1000;
  if (state.activeChartRange === '1h') duration = 60 * 60 * 1000;
  if (state.activeChartRange === '6h') duration = 6 * 60 * 60 * 1000;

  const cutoff = now - duration;
  const filtered = state.history.filter(h => h.time >= cutoff);

  const labels = filtered.map(h => {
    const d = new Date(h.time);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const datasets = [];
  const legendHtml = [];

  state.trackedPairs.forEach((pair, idx) => {
    const color = PALETTE[idx % PALETTE.length];
    
    const series = filtered.map(h => {
      if (h.pairs && h.pairs[pair.id] !== undefined) return h.pairs[pair.id];
      if (pair.id === 'SNDK' && h.sndk !== undefined) return h.sndk;
      if (pair.id === 'ANTH' && h.anth !== undefined) return h.anth;
      return 0;
    });

    datasets.push({
      label: `${pair.id} Basis %`,
      data: series,
      borderColor: color,
      backgroundColor: color + '1a',
      borderWidth: 2,
      tension: 0.2,
      pointRadius: 0,
      pointHoverRadius: 5
    });

    legendHtml.push(`
      <div class="legend-item">
        <span class="legend-color" style="background: ${color}"></span> ${pair.id} Basis %
      </div>
    `);
  });

  const thresh = state.config.basisThreshold;
  datasets.push({
    label: 'Upper Threshold',
    data: filtered.map(() => thresh),
    borderColor: 'rgba(78, 159, 112, 0.6)',
    borderWidth: 1.5,
    borderDash: [5, 5],
    pointRadius: 0,
    fill: false
  });

  datasets.push({
    label: 'Lower Threshold',
    data: filtered.map(() => -thresh),
    borderColor: 'rgba(217, 56, 56, 0.6)',
    borderWidth: 1.5,
    borderDash: [5, 5],
    pointRadius: 0,
    fill: false
  });

  const upperLabel = state.lang === 'EN' ? 'Upper Threshold' : 'Ngưỡng Upper';
  const lowerLabel = state.lang === 'EN' ? 'Lower Threshold' : 'Ngưỡng Lower';

  legendHtml.push(`
    <div class="legend-item"><span class="legend-color line-upper"></span> ${upperLabel} (+<span class="displayThresholdVal">${thresh.toFixed(2)}%</span>)</div>
    <div class="legend-item"><span class="legend-color line-lower"></span> ${lowerLabel} (-<span class="displayThresholdVal">${thresh.toFixed(2)}%</span>)</div>
  `);

  state.chart.data.labels = labels;
  state.chart.data.datasets = datasets;
  state.chart.update();

  const legendContainer = document.getElementById('chartLegendContainer');
  if (legendContainer) legendContainer.innerHTML = legendHtml.join('');
}

function updateChartThresholdLines() {
  updateChartData();
}
