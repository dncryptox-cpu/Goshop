/**
 * Entropy ↔ Lighter Spread Monitor (dnperp) — Phase 9 Refactored Engine
 * Multi-Exchange Connector Architecture Framework
 * Host: godnc.com/dnperp
 */

// Palette for chart lines per pair
const PALETTE = ['#4bacf5', '#e59866', '#26a69a', '#e91e63', '#ab47bc', '#fbc02d', '#00bcd4', '#ff7043'];

// Central Connector Registry
const ConnectorRegistry = {
  connectors: {},

  register(connector) {
    if (!connector || !connector.id) return;
    this.connectors[connector.id] = connector;
  },

  get(id) {
    return this.connectors[id] || null;
  },

  getAll() {
    return Object.values(this.connectors);
  },

  async fetchAssetData(exchangeId, symbol, options = {}) {
    const conn = this.get(exchangeId);
    if (!conn) {
      throw new Error(`Exchange Connector '${exchangeId}' is not registered`);
    }
    return await conn.fetchAssetData(symbol, options);
  }
};

// Register Built-in Connectors
if (window.HyperliquidConnector) ConnectorRegistry.register(window.HyperliquidConnector);
if (window.LighterConnector) ConnectorRegistry.register(window.LighterConnector);

// Default Tracked Pairs using Connector Framework schema
const DEFAULT_PAIRS = [
  { id: 'SNDK', name: 'SanDisk Synthetic', exchangeA: 'hyperliquid', symbolA: 'SNDK', exchangeB: 'lighter', symbolB: 'SNDK' },
  { id: 'ANTH', name: 'Anthropic Pre-IPO', exchangeA: 'hyperliquid', symbolA: 'ANTH', exchangeB: 'lighter', symbolB: 'ANTHROPIC' }
];

// Migrate legacy stored pairs to new schema
function migrateTrackedPairs(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) return DEFAULT_PAIRS;
  return pairs.map(p => ({
    id: p.id || p.symbolA || p.hlSymbol || 'PAIR',
    name: p.name || `${p.id} Pair`,
    exchangeA: p.exchangeA || 'hyperliquid',
    symbolA: p.symbolA || p.hlSymbol || p.id,
    exchangeB: p.exchangeB || 'lighter',
    symbolB: p.symbolB || p.ltSymbol || p.id
  }));
}

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
    btnSettings: "Cấu hình ⚙️",
    tabMonitor: "📊 Live Monitor & Margin",
    tabKnowledge: "📚 Kiến Thức / Playbook",
    
    sectionSpreadTitle: "📊 Basis & Tín Hiệu Delta-Neutral",
    sectionSpreadSub: "Đang theo dõi",
    pairsCountUnit: "cặp",
    warnThreshold: "Ngưỡng cảnh báo:",
    basisLabel: "CHÊNH LỆCH BASIS (Sàn A - Sàn B)",
    fundingYear: "Funding (Năm):",
    fundingProxy: "Funding Proxy:",
    vol24h: "Volume 24h:",
    signalNeutral: "TRUNG LẬP",
    signalLongLt: "LONG Sàn B | SHORT Sàn A",
    signalLongHl: "LONG Sàn A | SHORT Sàn B",
    stratNeutral: "💡 Khuyên dùng: <strong>Chưa có chênh lệch đáng kể (Basis trong ngưỡng safe ±{thresh}%)</strong>",
    stratLongLt: "💡 Khuyên dùng: <strong>LONG {exchangeB} (${ltPrice}) & SHORT {exchangeA} (${hlPrice})</strong> để ăn chênh lệch +{basis}%!",
    stratLongHl: "💡 Khuyên dùng: <strong>LONG {exchangeA} (${hlPrice}) & SHORT {exchangeB} (${ltPrice})</strong> để ăn chênh lệch {basis}%!",

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
    noticeWalletSaved: "Ví sẽ tự động được lưu vào localStorage và tải lại mỗi lần mở trang.",
    labelMarginUsedPct: "Tỷ lệ Margin đã dùng:",
    labelAccountValue: "Tổng Tài Sản (Account Value)",
    labelMarginUsedVal: "Margin Đã Sử Dụng",
    labelLtMarginUsed: "Margin đã dùng ($):",
    labelLtTotalMargin: "Tổng Margin / Equity ($):",
    labelLtFreeMargin: "Margin Khả Dụng (Free)",
    labelLtWarnAt: "Cảnh Báo Thanh Lý At",
    btnChangeWallet: "⚙️ Đổi ví / Cấu hình",
    btnEditLtMargin: "⚙️ Sửa Margin Lighter",

    sectionChartTitle: "📈 Lịch Sử Basis 24 Giờ & Biểu Đồ Dao Động",
    btnClearHistory: "Xoá lịch sử",

    modalSettingsTitle: "⚙️ Cấu Hình Hệ Thống (Settings Drawer)",
    sectionLangTitle: "🌐 Ngôn Ngữ / Language",
    sectionWalletTitle: "💧 Địa Chỉ Ví Hyperliquid (Entropy)",
    sectionLtMarginTitle: "⚡ Số Dư Margin Lighter (Robinhood Chain)",
    modalPairsTitle: "📋 Quản Lý Cặp Theo Dõi Động (Connectors)",
    modalAddPairSubMulti: "Chọn Sàn A & Sàn B từ danh sách Connector đã đăng ký trong hệ thống để tự động ghép cặp theo dõi.",
    labelExchangeA: "Sàn A (Exchange A):",
    labelSymbolA: "Ticker trên Sàn A:",
    labelExchangeB: "Sàn B (Exchange B):",
    labelSymbolB: "Ticker trên Sàn B:",
    labelPairName: "Tên Hiển Thị (Mô tả):",
    btnAddPairSubmit: "🔍 Xác Minh & Thêm Cặp",
    modalActivePairsHeader: "📋 Danh Sách Cặp Đang Theo Dõi",
    colPairName: "Tên Cặp",
    colExchangeA: "Sàn A (Ticker)",
    colExchangeB: "Sàn B (Ticker)",
    colActions: "Hành Động",
    btnDelete: "🗑️ Xoá",
    btnClose: "Đóng",

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
    btnSettings: "Settings ⚙️",
    tabMonitor: "📊 Live Monitor & Margin",
    tabKnowledge: "📚 Knowledge / Playbook",

    sectionSpreadTitle: "📊 Basis & Delta-Neutral Signals",
    sectionSpreadSub: "Tracking",
    pairsCountUnit: "pairs",
    warnThreshold: "Warning threshold:",
    basisLabel: "BASIS SPREAD (Exchange A - Exchange B)",
    fundingYear: "Funding (Annual):",
    fundingProxy: "Funding Proxy:",
    vol24h: "24h Volume:",
    signalNeutral: "NEUTRAL",
    signalLongLt: "LONG Exchange B | SHORT Exchange A",
    signalLongHl: "LONG Exchange A | SHORT Exchange B",
    stratNeutral: "💡 Recommendation: <strong>No significant spread (Basis within safe range ±{thresh}%)</strong>",
    stratLongLt: "💡 Recommendation: <strong>LONG {exchangeB} (${ltPrice}) & SHORT {exchangeA} (${hlPrice})</strong> to capture +{basis}% spread!",
    stratLongHl: "💡 Recommendation: <strong>LONG {exchangeA} (${hlPrice}) & SHORT {exchangeB} (${ltPrice})</strong> to capture {basis}% spread!",

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
    noticeWalletSaved: "Wallet will auto-save to localStorage and reload on every page visit.",
    labelMarginUsedPct: "Margin Used Ratio:",
    labelAccountValue: "Total Assets (Account Value)",
    labelMarginUsedVal: "Margin Used Amount",
    labelLtMarginUsed: "Margin Used ($):",
    labelLtTotalMargin: "Total Margin / Equity ($):",
    labelLtFreeMargin: "Free Available Margin",
    labelLtWarnAt: "Liquidation Warning At",
    btnChangeWallet: "⚙️ Change Wallet / Config",
    btnEditLtMargin: "⚙️ Edit Lighter Margin",

    sectionChartTitle: "📈 24-Hour Basis History & Volatility Chart",
    btnClearHistory: "Clear history",

    modalSettingsTitle: "⚙️ System Settings (Settings Drawer)",
    sectionLangTitle: "🌐 Ngôn Ngữ / Language",
    sectionWalletTitle: "💧 Hyperliquid Wallet Address (Entropy)",
    sectionLtMarginTitle: "⚡ Lighter Margin Balance (Robinhood Chain)",
    modalPairsTitle: "📋 Dynamic Pair Management (Connectors)",
    modalAddPairSubMulti: "Select Exchange A & Exchange B from registered System Connectors to pair and track automatically.",
    labelExchangeA: "Exchange A:",
    labelSymbolA: "Ticker on Exchange A:",
    labelExchangeB: "Exchange B:",
    labelSymbolB: "Ticker on Exchange B:",
    labelPairName: "Display Name (Description):",
    btnAddPairSubmit: "🔍 Verify & Add Pair",
    modalActivePairsHeader: "📋 Active Tracked Pairs",
    colPairName: "Pair Name",
    colExchangeA: "Exchange A (Ticker)",
    colExchangeB: "Exchange B (Ticker)",
    colActions: "Actions",
    btnDelete: "🗑️ Remove",
    btnClose: "Close",

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
const rawStoredPairs = JSON.parse(localStorage.getItem('dnperp_tracked_pairs') || 'null');
const state = {
  lang: localStorage.getItem('dnperp_lang') || 'VI',

  config: {
    basisThreshold: 0.30,
    marginThreshold: 75.0,
    tgToken: localStorage.getItem('dnperp_tg_token') || '',
    tgChatId: localStorage.getItem('dnperp_tg_chat_id') || '',
    hlWallet: localStorage.getItem('dnperp_wallet_address') || localStorage.getItem('dnperp_hl_wallet') || '',
    ltMarginUsed: parseFloat(localStorage.getItem('dnperp_lt_used')) || 0,
    ltTotalMargin: parseFloat(localStorage.getItem('dnperp_lt_total')) || 1000
  },

  trackedPairs: migrateTrackedPairs(rawStoredPairs),
  market: {},

  margin: {
    hl: { accountValue: 0, totalMarginUsed: 0, pct: 0 },
    lt: { used: 0, total: 1000, pct: 0 }
  },

  history: JSON.parse(localStorage.getItem('dnperp_history') || '[]'),
  
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
  populateExchangeDropdowns();
  setLanguage(state.lang);
  renderSpreadCards();
  renderPairsTable();
  initChart();
  seedHistoryIfEmpty();
  
  setupEventListeners();
  fetchMarketData();
  
  if (state.config.hlWallet) {
    fetchHlMargin();
  } else {
    updateHlMarginUI(0, 0, 0);
  }

  updateLighterMarginUI();
  startCountdown();
});

// Populate Connector Dropdowns inside Drawer
function populateExchangeDropdowns() {
  const dropdownA = document.getElementById('inputAddExchangeA');
  const dropdownB = document.getElementById('inputAddExchangeB');
  if (!dropdownA || !dropdownB) return;

  dropdownA.innerHTML = '';
  dropdownB.innerHTML = '';

  const connectors = ConnectorRegistry.getAll();
  connectors.forEach((conn, idx) => {
    const optA = document.createElement('option');
    optA.value = conn.id;
    optA.textContent = conn.name;

    const optB = document.createElement('option');
    optB.value = conn.id;
    optB.textContent = conn.name;

    dropdownA.appendChild(optA);
    dropdownB.appendChild(optB);
  });

  // Default dropdown selection
  if (connectors.length >= 2) {
    dropdownA.value = connectors[0].id;
    dropdownB.value = connectors[1].id;
  }
}

// Switch Language Engine
function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem('dnperp_lang', lang);

  document.getElementById('langBtnVI').classList.toggle('active', lang === 'VI');
  document.getElementById('langBtnEN').classList.toggle('active', lang === 'EN');
  document.getElementById('drawerLangBtnVI').classList.toggle('active', lang === 'VI');
  document.getElementById('drawerLangBtnEN').classList.toggle('active', lang === 'EN');

  const dict = i18n[lang] || i18n.VI;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  document.getElementById('hlWalletAddress').placeholder = dict.placeholderWallet;

  if (lang === 'EN') {
    document.getElementById('knowledge-content-vi').classList.add('hidden');
    document.getElementById('knowledge-content-en').classList.remove('hidden');
  } else {
    document.getElementById('knowledge-content-vi').classList.remove('hidden');
    document.getElementById('knowledge-content-en').classList.add('hidden');
  }

  renderSpreadCards();
  recalculateBasisAndSignals();
  updateWalletSubLabel();
}

function updateWalletSubLabel() {
  const w = state.config.hlWallet;
  const subEl = document.getElementById('displayHlWalletSub');
  const isEn = state.lang === 'EN';
  if (w) {
    const shortW = `${w.substring(0, 6)}...${w.substring(w.length - 4)}`;
    subEl.innerText = `${isEn ? 'Wallet' : 'Ví'}: ${shortW}`;
  } else {
    subEl.innerText = isEn ? 'Wallet: Not set' : 'Ví: Chưa thiết lập';
  }
}

// Initialize market data structures for tracked pairs
function initMarketState() {
  state.trackedPairs.forEach(p => {
    if (!state.market[p.id]) {
      state.market[p.id] = { priceA: 0, fundingA: 0, volA: 0, priceB: 0, fundingB: 0, volB: 0, basis: 0, basisAbs: 0 };
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
    const connA = ConnectorRegistry.get(pair.exchangeA) || { name: pair.exchangeA };
    const connB = ConnectorRegistry.get(pair.exchangeB) || { name: pair.exchangeB };

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
          <div class="basis-label">${dict.basisLabel.replace('Sàn A', connA.name).replace('Sàn B', connB.name)}</div>
          <div class="basis-value-group">
            <span class="basis-percent mono-num" id="basis-${pair.id}">0.00%</span>
            <span class="basis-abs mono-num" id="basisAbs-${pair.id}">($0.00)</span>
          </div>
        </div>

        <div class="price-comparison-grid">
          <div class="source-col entropy">
            <div class="source-header">
              <span class="source-tag">${connA.name}</span>
              <span class="dex-tag">${pair.symbolA}</span>
            </div>
            <div class="source-price mono-num" id="priceA-${pair.id}">$0.00</div>
            <div class="source-metrics">
              <div class="metric-item">
                <span class="m-label">${dict.fundingYear}</span>
                <span class="m-val mono-num" id="fundingA-${pair.id}">0.00%</span>
              </div>
              <div class="metric-item">
                <span class="m-label">${dict.vol24h}</span>
                <span class="m-val mono-num" id="volA-${pair.id}">$0</span>
              </div>
            </div>
          </div>

          <div class="vs-divider">VS</div>

          <div class="source-col lighter">
            <div class="source-header">
              <span class="source-tag">${connB.name}</span>
              <span class="dex-tag">${pair.symbolB}</span>
            </div>
            <div class="source-price mono-num" id="priceB-${pair.id}">$0.00</div>
            <div class="source-metrics">
              <div class="metric-item">
                <span class="m-label">${dict.fundingProxy}</span>
                <span class="m-val mono-num" id="fundingB-${pair.id}">0.00%</span>
              </div>
              <div class="metric-item">
                <span class="m-label">${dict.vol24h}</span>
                <span class="m-val mono-num" id="volB-${pair.id}">$0</span>
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
  document.getElementById('langBtnVI').addEventListener('click', () => setLanguage('VI'));
  document.getElementById('langBtnEN').addEventListener('click', () => setLanguage('EN'));
  document.getElementById('drawerLangBtnVI').addEventListener('click', () => setLanguage('VI'));
  document.getElementById('drawerLangBtnEN').addEventListener('click', () => setLanguage('EN'));

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

  document.getElementById('btnManualRefresh').addEventListener('click', () => {
    state.countdown = 10;
    fetchMarketData();
    if (state.config.hlWallet) fetchHlMargin();
  });

  document.getElementById('btnOpenSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('hidden');
  });

  document.querySelectorAll('.open-settings-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.getElementById('settingsModal').classList.remove('hidden');
      const targetId = e.currentTarget.dataset.target;
      if (targetId) {
        setTimeout(() => {
          const targetEl = document.getElementById(targetId);
          if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    });
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

    const w = document.getElementById('hlWalletAddress').value.trim();
    state.config.hlWallet = w;
    localStorage.setItem('dnperp_wallet_address', w);
    localStorage.setItem('dnperp_hl_wallet', w);
    updateWalletSubLabel();
    if (w) fetchHlMargin();

    updateThresholdDisplayLabels();
    recalculateBasisAndSignals();
    updateChartThresholdLines();
    closeModal('settingsModal');
  });

  document.getElementById('btnQueryHlMargin').addEventListener('click', () => {
    const w = document.getElementById('hlWalletAddress').value.trim();
    if (w) {
      state.config.hlWallet = w;
      localStorage.setItem('dnperp_wallet_address', w);
      localStorage.setItem('dnperp_hl_wallet', w);
      updateWalletSubLabel();
      fetchHlMargin();
    }
  });

  document.getElementById('btnClearWallet').addEventListener('click', () => {
    localStorage.removeItem('dnperp_wallet_address');
    localStorage.removeItem('dnperp_hl_wallet');
    state.config.hlWallet = '';
    document.getElementById('hlWalletAddress').value = '';
    updateWalletSubLabel();
    updateHlMarginUI(0, 0, 0);
  });

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

  document.getElementById('btnAddPairSubmit').addEventListener('click', verifyAndAddPair);

  document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state.activeChartRange = e.target.dataset.time;
      updateChartData();
    });
  });

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

// Render Pairs Management Table inside Drawer
function renderPairsTable() {
  const tbody = document.getElementById('pairsTableBody');
  tbody.innerHTML = '';
  const dict = i18n[state.lang] || i18n.VI;

  state.trackedPairs.forEach((pair) => {
    const connA = ConnectorRegistry.get(pair.exchangeA);
    const connB = ConnectorRegistry.get(pair.exchangeB);
    const nameA = connA ? connA.name : pair.exchangeA;
    const nameB = connB ? connB.name : pair.exchangeB;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${pair.name || pair.id}</strong> (${pair.id})</td>
      <td><span class="dex-tag">${nameA}: ${pair.symbolA}</span></td>
      <td><span class="dex-tag">${nameB}: ${pair.symbolB}</span></td>
      <td style="text-align: right;">
        <button class="btn btn-danger btn-xs" onclick="removeTrackedPair('${pair.id}')" ${state.trackedPairs.length <= 1 ? 'disabled title="Minimum 1 pair required"' : ''}>
          ${dict.btnDelete}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Verify Pair via Connector Interface and Add to Active List
async function verifyAndAddPair() {
  const statusEl = document.getElementById('addPairStatus');
  const exA = document.getElementById('inputAddExchangeA').value;
  const symA = document.getElementById('inputAddSymbolA').value.trim().toUpperCase();
  const exB = document.getElementById('inputAddExchangeB').value;
  const symB = document.getElementById('inputAddSymbolB').value.trim().toUpperCase();
  let name = document.getElementById('inputAddName').value.trim();

  const isEn = state.lang === 'EN';

  if (!symA || !symB) {
    statusEl.innerText = isEn ? '❌ Please enter symbols for both Exchange A and Exchange B!' : '❌ Vui lòng nhập Ticker cho cả Sàn A và Sàn B!';
    statusEl.style.color = 'var(--accent-danger)';
    return;
  }

  const pairId = symA;
  if (state.trackedPairs.some(p => p.id === pairId)) {
    statusEl.innerText = isEn ? `❌ Pair ${pairId} already exists in tracking list!` : `❌ Cặp ${pairId} đã tồn tại trong danh sách theo dõi!`;
    statusEl.style.color = 'var(--accent-danger)';
    return;
  }

  if (!name) name = `${symA} Synthetic`;

  statusEl.innerText = isEn ? '⏳ Verifying symbol via exchange connectors...' : '⏳ Đang xác minh Ticker qua Connector Sàn A & Sàn B...';
  statusEl.style.color = 'var(--text-gold)';

  try {
    // 1. Verify Exchange A
    try {
      await ConnectorRegistry.fetchAssetData(exA, symA);
    } catch (errA) {
      statusEl.innerText = isEn 
        ? `❌ Exchange A (${exA}) error: ${errA.message}` 
        : `❌ Lỗi trên Sàn A (${exA}): ${errA.message}`;
      statusEl.style.color = 'var(--accent-danger)';
      return;
    }

    // 2. Verify Exchange B
    try {
      await ConnectorRegistry.fetchAssetData(exB, symB);
    } catch (errB) {
      statusEl.innerText = isEn 
        ? `❌ Exchange B (${exB}) error: ${errB.message}` 
        : `❌ Lỗi trên Sàn B (${exB}): ${errB.message}`;
      statusEl.style.color = 'var(--accent-danger)';
      return;
    }

    // Both verification calls succeeded!
    const newPair = {
      id: pairId,
      name: name,
      exchangeA: exA,
      symbolA: symA,
      exchangeB: exB,
      symbolB: symB
    };

    state.trackedPairs.push(newPair);
    localStorage.setItem('dnperp_tracked_pairs', JSON.stringify(state.trackedPairs));

    initMarketState();
    renderSpreadCards();
    renderPairsTable();
    updateChartData();

    fetchMarketData();

    document.getElementById('inputAddSymbolA').value = '';
    document.getElementById('inputAddSymbolB').value = '';
    document.getElementById('inputAddName').value = '';

    statusEl.innerText = isEn ? `✅ Pair ${pairId} verified and added successfully!` : `✅ Đã xác minh & thêm cặp ${pairId} thành công!`;
    statusEl.style.color = 'var(--accent-safe)';

  } catch (err) {
    console.error('Verification error:', err);
    statusEl.innerText = isEn ? '❌ Connector verification error!' : '❌ Lỗi kết nối Connector!';
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

// Main Fetcher refactored to query via ConnectorRegistry
async function fetchMarketData() {
  const statusLabel = document.getElementById('statusLabel');
  const connectionStatus = document.getElementById('connectionStatus');
  const dict = i18n[state.lang] || i18n.VI;

  try {
    const currentPoint = { time: Date.now(), pairs: {} };

    await Promise.all(state.trackedPairs.map(async (pair) => {
      try {
        const [dataA, dataB] = await Promise.all([
          ConnectorRegistry.fetchAssetData(pair.exchangeA, pair.symbolA),
          ConnectorRegistry.fetchAssetData(pair.exchangeB, pair.symbolB)
        ]);

        state.market[pair.id].priceA = dataA.price;
        state.market[pair.id].fundingA = dataA.funding || 0;
        state.market[pair.id].volA = dataA.volume24h || 0;

        state.market[pair.id].priceB = dataB.price;
        state.market[pair.id].fundingB = dataB.funding || 0;
        state.market[pair.id].volB = dataB.volume24h || 0;

        const m = state.market[pair.id];
        if (m.priceB > 0 && m.priceA > 0) {
          m.basis = ((m.priceA - m.priceB) / m.priceB) * 100;
          m.basisAbs = m.priceA - m.priceB;
        } else {
          m.basis = 0;
          m.basisAbs = 0;
        }

        currentPoint.pairs[pair.id] = parseFloat(m.basis.toFixed(3));
      } catch (errPair) {
        console.error(`Error fetching data for pair ${pair.id}:`, errPair);
      }
    }));

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

    const connA = ConnectorRegistry.get(pair.exchangeA) || { name: pair.exchangeA };
    const connB = ConnectorRegistry.get(pair.exchangeB) || { name: pair.exchangeB };

    const priceAEl = document.getElementById(`priceA-${pair.id}`);
    const fundingAEl = document.getElementById(`fundingA-${pair.id}`);
    const volAEl = document.getElementById(`volA-${pair.id}`);

    const priceBEl = document.getElementById(`priceB-${pair.id}`);
    const fundingBEl = document.getElementById(`fundingB-${pair.id}`);
    const volBEl = document.getElementById(`volB-${pair.id}`);

    const yearSuffix = isEn ? '/yr' : '/năm';

    if (priceAEl) priceAEl.innerText = `$${m.priceA.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (fundingAEl) fundingAEl.innerText = `${m.fundingA > 0 ? '+' : ''}${m.fundingA.toFixed(2)}%${yearSuffix}`;
    if (volAEl) volAEl.innerText = `$${Math.round(m.volA).toLocaleString()}`;

    if (priceBEl) priceBEl.innerText = `$${m.priceB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (fundingBEl) fundingBEl.innerText = `${m.fundingB > 0 ? '+' : ''}${m.fundingB.toFixed(2)}%`;
    if (volBEl) volBEl.innerText = `$${Math.round(m.volB).toLocaleString()}`;

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
        signalBadge.innerHTML = `<span class="badge-icon">🟢</span><span class="badge-text">${dict.signalLongLt.replace('Sàn B', connB.name).replace('Sàn A', connA.name)}</span>`;
      }
      if (stratBox) {
        stratBox.innerHTML = dict.stratLongLt
          .replace('{exchangeB}', connB.name)
          .replace('{ltPrice}', m.priceB.toFixed(2))
          .replace('{exchangeA}', connA.name)
          .replace('{hlPrice}', m.priceA.toFixed(2))
          .replace('{basis}', m.basis.toFixed(2));
      }

      activeBannerMsg = isEn 
        ? `Warning: ${pair.id} Basis exceeds +${m.basis.toFixed(2)}% (Open Long ${connB.name} / Short ${connA.name})`
        : `Cảnh báo: Basis ${pair.id} đang vượt ngưỡng +${m.basis.toFixed(2)}% (Mở Long ${connB.name} / Short ${connA.name})`;

      triggerTelegramAlert(pair.id, `🚨 <b>ARBITRAGE SIGNAL: ${pair.id}!</b>\n\nBasis Spread: <b>+${m.basis.toFixed(2)}%</b> (Exceeds ${thresh}%)\n• ${connA.name}: $${m.priceA.toFixed(2)}\n• ${connB.name}: $${m.priceB.toFixed(2)}\n👉 <b>Action:</b> LONG ${connB.name} | SHORT ${connA.name}`);

    } else if (m.basis < -thresh) {
      if (signalBadge) {
        signalBadge.className = 'action-badge long-hl';
        signalBadge.innerHTML = `<span class="badge-icon">🔵</span><span class="badge-text">${dict.signalLongHl.replace('Sàn A', connA.name).replace('Sàn B', connB.name)}</span>`;
      }
      if (stratBox) {
        stratBox.innerHTML = dict.stratLongHl
          .replace('{exchangeA}', connA.name)
          .replace('{hlPrice}', m.priceA.toFixed(2))
          .replace('{exchangeB}', connB.name)
          .replace('{ltPrice}', m.priceB.toFixed(2))
          .replace('{basis}', m.basis.toFixed(2));
      }

      activeBannerMsg = isEn 
        ? `Warning: ${pair.id} Basis drops below ${m.basis.toFixed(2)}% (Open Long ${connA.name} / Short ${connB.name})`
        : `Cảnh báo: Basis ${pair.id} đang giảm âm ${m.basis.toFixed(2)}% (Mở Long ${connA.name} / Short ${connB.name})`;

      triggerTelegramAlert(pair.id, `🚨 <b>ARBITRAGE SIGNAL: ${pair.id}!</b>\n\nBasis Spread: <b>${m.basis.toFixed(2)}%</b> (Exceeds -${thresh}%)\n• ${connA.name}: $${m.priceA.toFixed(2)}\n• ${connB.name}: $${m.priceB.toFixed(2)}\n👉 <b>Action:</b> LONG ${connA.name} | SHORT ${connB.name}`);

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
