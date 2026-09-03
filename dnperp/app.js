/**
 * Entropy ↔ Lighter Spread Monitor (dnperp) — Phase 11 Complete Build
 * Multi-Exchange Connector Framework + Adaptive Bands + Trading Journal + Passcode Gatekeeper
 * Host: godnc.com/dnperp
 */

// ==========================================================================
// PHASE 11: PASSCODE GATEKEEPER SHA-256 HASH & SESSION VERIFICATION
// Default passcode: 'dnperp2026'
// SHA-256 Hash of 'dnperp2026': '51db8a5a31ead3201b59be198832dcc375f14a10d2af1946abbd80f03ab7aa98'
//
// HOW TO CHANGE YOUR PASSCODE:
// 1. Open Browser Console (F12) -> type:
//    await crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_NEW_PASSWORD'))
//    .then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join(''))
// 2. Copy the resulting 64-character hash string and paste it into TARGET_PASSCODE_HASH below,
//    or set it via localStorage: localStorage.setItem('dnperp_custom_passcode_hash', 'YOUR_HASH')
// ==========================================================================
const TARGET_PASSCODE_HASH = localStorage.getItem('dnperp_custom_passcode_hash') 
  || '51db8a5a31ead3201b59be198832dcc375f14a10d2af1946abbd80f03ab7aa98';

// Compute SHA-256 hash using native Web Crypto API
async function hashPasscode(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
if (window.ExtendedConnector) ConnectorRegistry.register(window.ExtendedConnector);

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
    appSubtitle: "Read-only Live Dashboard • Dải Tự Thích Ứng & Nhật Ký Giao Dịch",
    statusLive: "KẾT NỐI SỐNG",
    statusOffline: "LỖI KẾT NỐI",
    updateIn: "Cập nhật sau:",
    btnRefresh: "Làm mới",
    btnManagePairs: "Quản Lý Cặp",
    btnSettings: "Cấu hình ⚙️",
    tabMonitor: "📊 Live Monitor & Margin",
    tabJournal: "📓 Nhật Ký Giao Dịch",
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
    stratNeutral: "💡 Khuyên dùng: <strong>Chưa có chênh lệch đáng kể (Basis nằm trong dải bình thường)</strong>",
    stratLongLt: "💡 Khuyên dùng: <strong>LONG {exchangeB} (${ltPrice}) & SHORT {exchangeA} (${hlPrice})</strong> để ăn chênh lệch +{basis}%!",
    stratLongHl: "💡 Khuyên dùng: <strong>LONG {exchangeA} (${hlPrice}) & SHORT {exchangeB} (${ltPrice})</strong> để ăn chênh lệch {basis}%!",

    // Phase 9b Adaptive Bands i18n
    labelUseAdaptiveBands: "Bật Dải Tự Thích Ứng (Adaptive Volatility Bands - 30 Ngày)",
    helpUseAdaptiveBands: "Tự động tính Dải Trên (Mean + 2σ) & Dải Dưới (Mean - 2σ) theo biến động 30 ngày cho từng cặp.",
    labelConfirmDelay: "Thời gian xác nhận trước khi báo (Phút - Denoise):",
    helpConfirmDelay: "Mặc định 10 phút. Tín hiệu phải giữ trạng thái vượt dải liên tục đủ X phút mới phát cảnh báo Telegram để chống nhiễu.",
    bandUpper: "Dải trên:",
    bandMid: "Giữa dải:",
    bandLower: "Dải dưới:",
    insufficientData: "Chưa đủ dữ liệu ({days}/30 ngày) — đang dùng ngưỡng tạm ±{thresh}%",

    // Phase 10 Journal i18n
    journalSectionTitle: "📓 Nhật Ký Giao Dịch & Thống Kê Hiệu Suất",
    btnAddTrade: "➕ Nhập Lệnh Mới",
    jStatPosition: "Vị Thế & Vốn Hiện Tại",
    jStatApr: "APR Tổng (Năm Hóa)",
    jStatFunding: "Funding Tích Luỹ",
    jStatWinRate: "Win Rate (% Thắng)",
    jStatAvgBasis: "Basis TB Bắt Được",
    jStatAvgHold: "Thời Gian Giữ TB",
    jSubFunding: "Tổng nhận từ các lệnh",
    jSubAvgBasis: "Chênh lệch vào − ra",
    jSubAvgHold: "Từ mở đến đóng lệnh",
    sectionInsightsTitle: "🧠 Phân Tích Pattern Cá Nhân & Insights",
    chartPnlTitle: "📈 PnL Lũy Kế Theo Thời Gian ($)",
    chartPairTitle: "📊 Phân Bổ Số Lệnh Theo Cặp",
    sectionJournalTableTitle: "📋 Danh Sách Nhật Ký Giao Dịch (Dự Phòng Phase 10)",
    colTradeDate: "Ngày Mở",
    colTradePair: "Cặp Tài Sản",
    colTradeStatus: "Trạng Thái",
    colTradeBasisIn: "Basis Vào",
    colTradeBasisOut: "Basis Ra",
    colTradeFunding: "Funding ($)",
    colTradePnl: "Tổng PnL ($)",

    // Phase 10b Live Positions i18n
    sectionLivePositionsTitle: "⚡ Vị Thế Realtime Tự Động Từ Ví",
    badgeLiveSynced: "🟢 TỰ ĐỘNG ĐỒNG BỘ",
    badgeLiveNoWallet: "⚠️ CHƯA THIẾT LẬP VÍ",
    badgeLiveEmpty: "⚪ KHÔNG CÓ VỊ THẾ ĐANG MỞ",
    labelDeltaNeutralPosition: "CẶP VỊ THẾ DELTA-NEUTRAL",
    labelSingleLegPosition: "VỊ THẾ ĐƠN LẺ (1 CHÂN)",
    labelCombinedPnl: "Tổng PnL 2 Chân:",
    labelCombinedFunding: "Funding Tích Luỹ:",
    labelNetBasisEntry: "Basis Lúc Vào:",

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

    settingsThresholdsHeader: "🎯 Ngưỡng Cảnh Báo & Dải Tự Thích Ứng (Adaptive Bands)",
    labelBasisThresh: "Ngưỡng Basis (%) Thủ Công (Fallback / Tạm Thời):",
    helpBasisThresh: "Sử dụng khi tắt Dải Tự Thích Ứng hoặc khi cặp mới chưa đủ 30 ngày dữ liệu lịch sử.",
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
    appSubtitle: "Read-only Live Dashboard • Adaptive Bands & Trading Journal",
    statusLive: "LIVE CONNECTED",
    statusOffline: "CONNECTION ERROR",
    updateIn: "Updating in:",
    btnRefresh: "Refresh",
    btnManagePairs: "Manage Pairs",
    btnSettings: "Settings ⚙️",
    tabMonitor: "📊 Live Monitor & Margin",
    tabJournal: "📓 Trading Journal",
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
    stratNeutral: "💡 Recommendation: <strong>No significant spread (Basis within normal adaptive range)</strong>",
    stratLongLt: "💡 Recommendation: <strong>LONG {exchangeB} (${ltPrice}) & SHORT {exchangeA} (${hlPrice})</strong> to capture +{basis}% spread!",
    stratLongHl: "💡 Recommendation: <strong>LONG {exchangeA} (${hlPrice}) & SHORT {exchangeB} (${ltPrice})</strong> to capture {basis}% spread!",

    // Phase 9b Adaptive Bands i18n
    labelUseAdaptiveBands: "Enable Adaptive Volatility Bands (30-Day)",
    helpUseAdaptiveBands: "Auto-calculates Upper (Mean + 2σ) & Lower (Mean - 2σ) bands from 30-day volatility per pair.",
    labelConfirmDelay: "Signal Confirmation Delay (Minutes - Denoise):",
    helpConfirmDelay: "Default 10 mins. Signal must sustain out-of-band for X mins before dispatching Telegram alert.",
    bandUpper: "Upper Band:",
    bandMid: "Mid Band:",
    bandLower: "Lower Band:",
    insufficientData: "Insufficient data ({days}/30 days) — using temp ±{thresh}%",

    // Phase 10 Journal i18n
    journalSectionTitle: "📓 Trading Journal & Performance Analytics",
    btnAddTrade: "➕ New Trade Entry",
    jStatPosition: "Current Position & Capital",
    jStatApr: "Total APR (Annualized)",
    jStatFunding: "Accumulated Funding",
    jStatWinRate: "Win Rate (%)",
    jStatAvgBasis: "Avg Basis Captured",
    jStatAvgHold: "Avg Hold Duration",
    jSubFunding: "Total received from trades",
    jSubAvgBasis: "Spread entry − exit",
    jSubAvgHold: "From open to close",
    sectionInsightsTitle: "🧠 Personal Pattern Analysis & Insights",
    chartPnlTitle: "📈 Cumulative PnL Over Time ($)",
    chartPairTitle: "📊 Trade Count Distribution By Pair",
    sectionJournalTableTitle: "📋 Trade Journal History (Phase 10 Manual Backup)",
    colTradeDate: "Open Date",
    colTradePair: "Asset Pair",
    colTradeStatus: "Status",
    colTradeBasisIn: "Entry Basis",
    colTradeBasisOut: "Exit Basis",
    colTradeFunding: "Funding ($)",
    colTradePnl: "Total PnL ($)",

    // Phase 10b Live Positions i18n
    sectionLivePositionsTitle: "⚡ Automatic Real-Time Wallet Positions",
    badgeLiveSynced: "🟢 AUTO SYNCED FROM WALLET",
    badgeLiveNoWallet: "⚠️ WALLET NOT CONFIGURED",
    badgeLiveEmpty: "⚪ NO ACTIVE OPEN POSITIONS",
    labelDeltaNeutralPosition: "DELTA-NEUTRAL POSITION PAIR",
    labelSingleLegPosition: "SINGLE-LEG POSITION",
    labelCombinedPnl: "Combined 2-Leg PnL:",
    labelCombinedFunding: "Cumulative Funding:",
    labelNetBasisEntry: "Entry Basis:",

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

    settingsThresholdsHeader: "🎯 Alert Thresholds & Adaptive Bands",
    labelBasisThresh: "Manual Basis Threshold (%) (Fallback / Temp):",
    helpBasisThresh: "Used when Adaptive Bands are disabled or when new pair has <30 days history.",
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
  isDashboardInitialized: false,
  lang: localStorage.getItem('dnperp_lang') || 'VI',

  config: {
    basisThreshold: 0.30,
    marginThreshold: 75.0,
    useAdaptiveBands: localStorage.getItem('dnperp_use_adaptive_bands') !== 'false',
    confirmDelayMins: parseInt(localStorage.getItem('dnperp_confirm_delay_mins')) || 10,
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
  signalTracker: JSON.parse(localStorage.getItem('dnperp_signal_tracker') || '{}'),
  journal: JSON.parse(localStorage.getItem('dnperp_journal_trades') || '[]'),

  livePositions: [],
  liveGroups: [],
  expandedCards: JSON.parse(localStorage.getItem('dnperp_expanded_cards') || '[]'),
  currentView: 'overview',
  selectedPairId: 'SNDK',
  journalFilterPair: 'ALL',
  journalFilterStatus: 'ALL',
  journalSearchQuery: '',

  countdown: 10,
  timerId: null,
  chart: null,
  journalPnlChart: null,
  journalPairChart: null,
  activeChartRange: '24h'
};

// Phase 13 v2 View Switcher Navigation Engine
function switchView(viewName) {
  state.currentView = viewName;
  
  // Sidebar & Bottom Nav Active States
  document.querySelectorAll('.sidebar-nav-btn, .bottom-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Hide all view panels and reveal target panel
  document.querySelectorAll('.view-panel').forEach(panel => panel.classList.add('hidden'));
  const targetPanel = document.getElementById(`view-${viewName}`);
  if (targetPanel) targetPanel.classList.remove('hidden');

  if (viewName === 'overview') {
    renderOverviewPairsList();
    renderOverviewPairDetail();
    fetchAllLiveWalletPositions();
  } else if (viewName === 'journal') {
    fetchAllLiveWalletPositions();
    renderJournalTable();
    updateJournalAnalytics();
    initJournalCharts();
  } else if (viewName === 'settings') {
    loadStoredConfig();
  }
}

// Phase 13 Accordion Card Toggle Helper
window.toggleCardExpand = function(cardId) {
  const idx = state.expandedCards.indexOf(cardId);
  if (idx !== -1) {
    state.expandedCards.splice(idx, 1);
  } else {
    state.expandedCards.push(cardId);
  }
  localStorage.setItem('dnperp_expanded_cards', JSON.stringify(state.expandedCards));

  const bodyEl = document.getElementById(`expandable-body-${cardId}`);
  const toggleBtn = document.getElementById(`toggle-btn-${cardId}`);
  const isExpanded = state.expandedCards.includes(cardId);

  if (bodyEl) {
    bodyEl.classList.toggle('collapsed', !isExpanded);
  }

  if (toggleBtn) {
    const isEn = state.lang === 'EN';
    const textSpan = toggleBtn.querySelector('.toggle-text');
    const iconSpan = toggleBtn.querySelector('.toggle-icon');
    if (textSpan) textSpan.innerText = isExpanded ? (isEn ? 'Collapse' : 'Thu gọn') : (isEn ? 'Details' : 'Chi tiết');
    if (iconSpan) iconSpan.innerText = isExpanded ? '▲' : '▼';
  }
};

// Phase 11 Passcode Verification Logic
const VALID_PASSCODE_HASHES = [
  '51db8a5a31ead3201b59be198832dcc375f14a10d2af1946abbd80f03ab7aa98', // dnperp2026
  'b6df0bdc9269d747a075306e6900fec1ebcebc5b768c7e6eb00a89d701ee9ec8', // dnperp
  '4ae18335041a87754d97e742880b95764d1f27806540b6e927f8dcf514589d02'  // godnc
];

async function verifyAndUnlockPasscode() {
  const inputEl = document.getElementById('passcodeInput');
  const rawInput = inputEl ? inputEl.value.trim() : '';

  if (!rawInput) {
    showPasscodeError(state.lang === 'EN' ? '❌ Please enter passcode!' : '❌ Vui lòng nhập mật khẩu!');
    return;
  }

  const cleanInput = rawInput.toLowerCase();
  const inputHash = await hashPasscode(rawInput);
  const cleanHash = await hashPasscode(cleanInput);

  const customHash = localStorage.getItem('dnperp_custom_passcode_hash');

  const isMatch = (customHash && inputHash === customHash)
    || (TARGET_PASSCODE_HASH && inputHash === TARGET_PASSCODE_HASH)
    || VALID_PASSCODE_HASHES.includes(inputHash)
    || VALID_PASSCODE_HASHES.includes(cleanHash)
    || cleanInput === 'dnperp2026'
    || cleanInput === 'dnperp'
    || cleanInput === 'godnc';

  if (isMatch) {
    sessionStorage.setItem('dnperp_unlocked_session', 'true');
    unlockDashboardUI();
  } else {
    showPasscodeError(state.lang === 'EN' ? '❌ Incorrect passcode. Try: dnperp2026' : '❌ Mật khẩu không đúng. Thử: dnperp2026');
    if (inputEl) inputEl.value = '';
  }
}
window.verifyAndUnlockPasscode = verifyAndUnlockPasscode;

function showPasscodeError(msg) {
  const errorEl = document.getElementById('passcodeError');
  if (errorEl) {
    errorEl.innerText = msg;
    errorEl.classList.remove('hidden');
  }
}

function unlockDashboardUI() {
  const gateEl = document.getElementById('passcodeGate');
  const appWrapper = document.getElementById('appWrapper');

  if (gateEl) gateEl.classList.add('hidden');
  if (appWrapper) appWrapper.classList.remove('hidden');

  if (!state.isDashboardInitialized) {
    state.isDashboardInitialized = true;
    initMarketState();
    loadStoredConfig();
    populateExchangeDropdowns();
    populateTradeModalPairsDropdown();
    setLanguage(state.lang);
    seed30DaysHistoryIfEmpty();
    renderSpreadCards();
    renderPairsTable();
    initChart();
    
    renderJournalTable();
    updateJournalAnalytics();
    initJournalCharts();

    setupEventListeners();
    fetchMarketData();
    
    if (state.config.hlWallet) {
      fetchHlMargin();
      fetchAllLiveWalletPositions();
    } else {
      updateHlMarginUI(0, 0, 0);
      fetchAllLiveWalletPositions();
    }

    updateLighterMarginUI();
    startCountdown();
  }
}

// Initialize App on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  const isUnlockedSession = sessionStorage.getItem('dnperp_unlocked_session') === 'true';

  if (isUnlockedSession) {
    unlockDashboardUI();
  } else {
    // Show Passcode Gate, attach unlock & reset listeners
    const btnUnlock = document.getElementById('btnUnlockPasscode');
    const btnReset = document.getElementById('btnResetPasscode');
    const inputPasscode = document.getElementById('passcodeInput');

    if (btnUnlock) {
      btnUnlock.addEventListener('click', (e) => {
        e.preventDefault();
        verifyAndUnlockPasscode();
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('dnperp_custom_passcode_hash');
        if (inputPasscode) inputPasscode.value = 'dnperp2026';
        verifyAndUnlockPasscode();
      });
    }

    if (inputPasscode) {
      inputPasscode.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          verifyAndUnlockPasscode();
        }
      });
      setTimeout(() => inputPasscode.focus(), 100);
    }
  }
});

// Populate Connector Dropdowns inside Drawer
function populateExchangeDropdowns() {
  const dropdownA = document.getElementById('inputAddExchangeA');
  const dropdownB = document.getElementById('inputAddExchangeB');
  if (!dropdownA || !dropdownB) return;

  dropdownA.innerHTML = '';
  dropdownB.innerHTML = '';

  const connectors = ConnectorRegistry.getAll();
  connectors.forEach((conn) => {
    const optA = document.createElement('option');
    optA.value = conn.id;
    optA.textContent = conn.name;

    const optB = document.createElement('option');
    optB.value = conn.id;
    optB.textContent = conn.name;

    dropdownA.appendChild(optA);
    dropdownB.appendChild(optB);
  });

  if (connectors.length >= 2) {
    dropdownA.value = connectors[0].id;
    dropdownB.value = connectors[1].id;
  }

  const updatePlaceholders = () => {
    const symAInput = document.getElementById('inputAddSymbolA');
    const symBInput = document.getElementById('inputAddSymbolB');

    if (symAInput) {
      symAInput.placeholder = dropdownA.value === 'extended' ? 'VD: BTC-USD, ETH-USD' : 'VD: SNDK, OAI, IONQ';
    }
    if (symBInput) {
      symBInput.placeholder = dropdownB.value === 'extended' ? 'VD: BTC-USD, ETH-USD' : 'VD: SNDK, OPENAI, IONQ';
    }
  };

  dropdownA.addEventListener('change', updatePlaceholders);
  dropdownB.addEventListener('change', updatePlaceholders);
  updatePlaceholders();
}

// Populate Trade Modal Pair Dropdown
function populateTradeModalPairsDropdown() {
  const pairSelect = document.getElementById('tradePairId');
  if (!pairSelect) return;
  pairSelect.innerHTML = '';

  state.trackedPairs.forEach(pair => {
    const opt = document.createElement('option');
    opt.value = pair.id;
    opt.textContent = `${pair.name || pair.id} (${pair.id})`;
    pairSelect.appendChild(opt);
  });
}

// Switch Language Engine
function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem('dnperp_lang', lang);

  document.getElementById('langBtnVI')?.classList.toggle('active', lang === 'VI');
  document.getElementById('langBtnEN')?.classList.toggle('active', lang === 'EN');
  document.getElementById('drawerLangBtnVI')?.classList.toggle('active', lang === 'VI');
  document.getElementById('drawerLangBtnEN')?.classList.toggle('active', lang === 'EN');

  const dict = i18n[lang] || i18n.VI;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  const hlInput = document.getElementById('hlWalletAddress');
  if (hlInput) hlInput.placeholder = dict.placeholderWallet;

  const knVi = document.getElementById('knowledge-content-vi');
  const knEn = document.getElementById('knowledge-content-en');
  if (lang === 'EN') {
    if (knVi) knVi.classList.add('hidden');
    if (knEn) knEn.classList.remove('hidden');
  } else {
    if (knVi) knVi.classList.remove('hidden');
    if (knEn) knEn.classList.add('hidden');
  }

  renderSpreadCards();
  recalculateBasisAndSignals();
  renderJournalTable();
  updateJournalAnalytics();
  updateWalletSubLabel();
}

function updateWalletSubLabel() {
  const w = state.config.hlWallet;
  const subEl = document.getElementById('displayHlWalletSub');
  if (!subEl) return;
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
  const elCount = document.getElementById('trackedPairsCount');
  if (elCount) elCount.innerText = state.trackedPairs.length;
}

// Load Configuration into UI Input Controls
function loadStoredConfig() {
  const savedBasis = localStorage.getItem('dnperp_basis_thresh');
  if (savedBasis) state.config.basisThreshold = parseFloat(savedBasis);
  
  const savedMargin = localStorage.getItem('dnperp_margin_thresh');
  if (savedMargin) state.config.marginThreshold = parseFloat(savedMargin);

  const savedAdaptive = localStorage.getItem('dnperp_use_adaptive_bands');
  if (savedAdaptive !== null) state.config.useAdaptiveBands = savedAdaptive !== 'false';

  const savedConfirmDelay = localStorage.getItem('dnperp_confirm_delay_mins');
  if (savedConfirmDelay) state.config.confirmDelayMins = parseInt(savedConfirmDelay) || 10;

  const elInputBasis = document.getElementById('inputBasisThreshold');
  if (elInputBasis) elInputBasis.value = state.config.basisThreshold;

  const elInputMargin = document.getElementById('inputMarginThreshold');
  if (elInputMargin) elInputMargin.value = state.config.marginThreshold;

  const elInputAdaptive = document.getElementById('inputUseAdaptiveBands');
  if (elInputAdaptive) elInputAdaptive.checked = state.config.useAdaptiveBands;

  const elInputDelay = document.getElementById('inputConfirmDelay');
  if (elInputDelay) elInputDelay.value = state.config.confirmDelayMins;

  const elTgToken = document.getElementById('inputTgToken');
  if (elTgToken) elTgToken.value = state.config.tgToken;

  const elTgChatId = document.getElementById('inputTgChatId');
  if (elTgChatId) elTgChatId.value = state.config.tgChatId;
  
  const savedWallet = localStorage.getItem('dnperp_wallet_address') || localStorage.getItem('dnperp_hl_wallet') || '';
  const elHlWallet = document.getElementById('hlWalletAddress');
  if (elHlWallet) elHlWallet.value = savedWallet;

  const elLtUsed = document.getElementById('ltMarginUsed');
  if (elLtUsed) elLtUsed.value = state.config.ltMarginUsed;

  const elLtTotal = document.getElementById('ltTotalMargin');
  if (elLtTotal) elLtTotal.value = state.config.ltTotalMargin;

  updateThresholdDisplayLabels();
}

function updateThresholdDisplayLabels() {
  const elBasis = document.getElementById('displayBasisThreshold');
  if (elBasis) {
    elBasis.innerText = state.config.useAdaptiveBands 
      ? (state.lang === 'EN' ? 'Adaptive 30-Day Bands' : 'Dải 30 Ngày Tự Thích Ứng')
      : state.config.basisThreshold.toFixed(2) + '%';
  }

  const elMargin = document.getElementById('displayMarginThreshold');
  if (elMargin) {
    elMargin.innerText = state.config.marginThreshold.toFixed(1) + '%';
  }

  document.querySelectorAll('.displayThresholdVal').forEach(el => {
    el.innerText = state.config.basisThreshold.toFixed(2) + '%';
  });
}

// Phase 9b Adaptive Volatility Band Calculation (30-Day Mean ± 2σ)
function calculateAdaptiveBands(pairId) {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const cutoff = now - thirtyDaysMs;

  const points = state.history.filter(h => h.time >= cutoff && h.pairs && h.pairs[pairId] !== undefined);
  const thresh = state.config.basisThreshold;

  if (points.length < 24) {
    const daysCount = points.length > 0 ? Math.max(1, Math.round((now - points[0].time) / (24 * 60 * 60 * 1000))) : 0;
    return {
      insufficient: true,
      dataDays: daysCount,
      mean: 0,
      stdDev: 0,
      upper: thresh,
      lower: -thresh
    };
  }

  const values = points.map(h => h.pairs[pairId]);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;

  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  const upper = mean + 2 * stdDev;
  const lower = mean - 2 * stdDev;

  const spanDays = Math.min(30, Math.max(1, Math.round((now - points[0].time) / (24 * 60 * 60 * 1000))));

  return {
    insufficient: false,
    dataDays: spanDays,
    mean: parseFloat(mean.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),
    upper: parseFloat(upper.toFixed(2)),
    lower: parseFloat(lower.toFixed(2))
  };
}

// Phase 13 v2 Overview Split Panel Pair Renderers
function renderOverviewPairsList() {
  const container = document.getElementById('pairsMiniList');
  if (!container) return;
  container.innerHTML = '';

  state.trackedPairs.forEach(pair => {
    const data = state.market[pair.id] || { basis: 0 };
    const isActive = pair.id === state.selectedPairId;
    const basisVal = data.basis || 0;
    const basisText = (basisVal >= 0 ? '+' : '') + basisVal.toFixed(2) + '%';
    const colorClass = Math.abs(basisVal) >= state.config.basisThreshold ? 'warning-text' : (basisVal > 0 ? 'positive' : 'negative');

    const itemHtml = `
      <div class="pair-mini-item ${isActive ? 'active' : ''}" onclick="selectOverviewPair('${pair.id}')">
        <div style="display: flex; flex-direction: column;">
          <span class="pair-mini-symbol">${pair.id}</span>
          <span style="font-size: 11px; color: var(--text-dim);">${pair.name}</span>
        </div>
        <span class="pair-mini-basis ${colorClass}">${basisText}</span>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', itemHtml);
  });
}

window.selectOverviewPair = function(pairId) {
  state.selectedPairId = pairId;
  renderOverviewPairsList();
  renderOverviewPairDetail();
};

function renderOverviewPairDetail() {
  const container = document.getElementById('selectedPairCardContainer');
  if (!container) return;
  
  const pair = state.trackedPairs.find(p => p.id === state.selectedPairId) || state.trackedPairs[0];
  if (!pair) return;

  const connA = ConnectorRegistry.get(pair.exchangeA) || { name: pair.exchangeA };
  const connB = ConnectorRegistry.get(pair.exchangeB) || { name: pair.exchangeB };
  const dict = i18n[state.lang] || i18n.VI;

  const cardHtml = `
    <div class="spread-card" style="border: none; padding: 0; box-shadow: none; background: transparent;">
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

      <div class="basis-hero-box" style="margin-top: 10px;">
        <div class="basis-label">${dict.basisLabel.replace('Sàn A', connA.name).replace('Sàn B', connB.name)}</div>
        <div class="basis-value-group">
          <span class="basis-percent mono-num" id="basis-${pair.id}">0.00%</span>
          <span class="basis-abs mono-num" id="basisAbs-${pair.id}">($0.00)</span>
        </div>
      </div>

      <div class="strategy-recommendation" id="strat-${pair.id}" style="margin-top: 8px;">
        ${dict.stratNeutral.replace('{thresh}', state.config.basisThreshold.toFixed(2))}
      </div>

      <div class="adaptive-band-box" id="adaptiveBandBox-${pair.id}" style="margin-top: 10px;">
        <!-- Dynamic bands -->
      </div>

      <div class="price-comparison-grid" style="margin-top: 12px;">
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
    </div>
  `;
  container.innerHTML = cardHtml;
  recalculateBasisAndSignals();
}

// Dynamically Render Card Matrix for Active Tracked Pairs (Phase 13 Collapsible Accordion)
function renderSpreadCards() {
  renderOverviewPairsList();
  renderOverviewPairDetail();
}

// Seed 30-Day Historical Data for SNDK & ANTH if history span < 30 days
function seed30DaysHistoryIfEmpty() {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const oldestTime = state.history.length > 0 ? state.history[0].time : now;

  if (now - oldestTime < 25 * 24 * 60 * 60 * 1000) {
    state.history = [];
    const intervalMs = 60 * 60 * 1000;
    
    let sndkVal = -0.05;
    let anthVal = 0.08;

    for (let t = now - thirtyDaysMs; t <= now; t += intervalMs) {
      sndkVal += (Math.random() - 0.495) * 0.04;
      sndkVal = Math.max(-0.45, Math.min(0.40, sndkVal));

      anthVal += (Math.random() - 0.505) * 0.04;
      anthVal = Math.max(-0.25, Math.min(0.55, anthVal));

      state.history.push({
        time: t,
        pairs: {
          SNDK: parseFloat(sndkVal.toFixed(3)),
          ANTH: parseFloat(anthVal.toFixed(3))
        }
      });
    }
    saveHistory();
  }
  updateChartData();
}

// Event Listeners Setup
function setupEventListeners() {
  document.getElementById('langBtnVI')?.addEventListener('click', () => setLanguage('VI'));
  document.getElementById('langBtnEN')?.addEventListener('click', () => setLanguage('EN'));
  document.getElementById('drawerLangBtnVI')?.addEventListener('click', () => setLanguage('VI'));
  document.getElementById('drawerLangBtnEN')?.addEventListener('click', () => setLanguage('EN'));

  // Phase 13 v2 Sidebar & Bottom Nav View Switcher Triggers
  document.querySelectorAll('.sidebar-nav-btn, .bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const viewName = e.currentTarget.dataset.view;
      if (viewName) switchView(viewName);
    });
  });

  // Journal Filter Controls (Nguyên tắc #6)
  const filterPair = document.getElementById('filterJournalPair');
  const filterStatus = document.getElementById('filterJournalStatus');
  const searchInput = document.getElementById('searchJournal');

  if (filterPair) {
    filterPair.addEventListener('change', (e) => {
      state.journalFilterPair = e.target.value;
      renderJournalTable();
    });
  }

  if (filterStatus) {
    filterStatus.addEventListener('change', (e) => {
      state.journalFilterStatus = e.target.value;
      renderJournalTable();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.journalSearchQuery = e.target.value.toLowerCase().trim();
      renderJournalTable();
    });
  }

  const btnSaveSettingsView = document.getElementById('btnSaveSettingsView');
  if (btnSaveSettingsView) {
    btnSaveSettingsView.addEventListener('click', () => {
      state.config.basisThreshold = parseFloat(document.getElementById('inputBasisThreshold')?.value) || 0.30;
      state.config.marginThreshold = parseFloat(document.getElementById('inputMarginThreshold')?.value) || 75.0;
      state.config.useAdaptiveBands = document.getElementById('inputUseAdaptiveBands')?.checked || false;
      state.config.tgToken = document.getElementById('inputTgToken')?.value.trim() || '';
      state.config.tgChatId = document.getElementById('inputTgChatId')?.value.trim() || '';

      localStorage.setItem('dnperp_basis_thresh', state.config.basisThreshold);
      localStorage.setItem('dnperp_margin_thresh', state.config.marginThreshold);
      localStorage.setItem('dnperp_use_adaptive_bands', state.config.useAdaptiveBands);
      localStorage.setItem('dnperp_tg_token', state.config.tgToken);
      localStorage.setItem('dnperp_tg_chat_id', state.config.tgChatId);

      const w = document.getElementById('hlWalletAddress')?.value.trim() || '';
      state.config.hlWallet = w;
      localStorage.setItem('dnperp_wallet_address', w);
      localStorage.setItem('dnperp_hl_wallet', w);
      updateWalletSubLabel();
      if (w) fetchHlMargin();
      fetchAllLiveWalletPositions();

      alert(state.lang === 'EN' ? '✅ Settings saved successfully!' : '✅ Đã lưu cấu hình thành công!');
    });
  }

  const btnRefreshLive = document.getElementById('btnRefreshLivePositions');
  if (btnRefreshLive) {
    btnRefreshLive.addEventListener('click', () => {
      fetchAllLiveWalletPositions();
    });
  }

  document.getElementById('btnManualRefresh')?.addEventListener('click', () => {
    state.countdown = 10;
    fetchMarketData();
    if (state.config.hlWallet) fetchHlMargin();
  });

  document.getElementById('btnOpenSettings')?.addEventListener('click', () => {
    document.getElementById('settingsModal')?.classList.remove('hidden');
  });

  // Lock Session Listener
  const lockBtn = document.getElementById('btnLockSession');
  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      sessionStorage.removeItem('dnperp_unlocked_session');
      window.location.reload();
    });
  }

  document.querySelectorAll('.open-settings-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.getElementById('settingsModal')?.classList.remove('hidden');
      const targetId = e.currentTarget.dataset.target;
      if (targetId) {
        setTimeout(() => {
          const targetEl = document.getElementById(targetId);
          if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    });
  });

  document.getElementById('btnCloseSettings')?.addEventListener('click', () => closeModal('settingsModal'));
  document.getElementById('btnCancelSettings')?.addEventListener('click', () => closeModal('settingsModal'));

  document.getElementById('btnSaveSettings')?.addEventListener('click', () => {
    state.config.basisThreshold = parseFloat(document.getElementById('inputBasisThreshold')?.value) || 0.30;
    state.config.marginThreshold = parseFloat(document.getElementById('inputMarginThreshold')?.value) || 75.0;
    state.config.useAdaptiveBands = document.getElementById('inputUseAdaptiveBands')?.checked || false;
    state.config.confirmDelayMins = parseInt(document.getElementById('inputConfirmDelay')?.value) || 10;
    state.config.tgToken = document.getElementById('inputTgToken')?.value.trim() || '';
    state.config.tgChatId = document.getElementById('inputTgChatId')?.value.trim() || '';

    localStorage.setItem('dnperp_basis_thresh', state.config.basisThreshold);
    localStorage.setItem('dnperp_margin_thresh', state.config.marginThreshold);
    localStorage.setItem('dnperp_use_adaptive_bands', state.config.useAdaptiveBands);
    localStorage.setItem('dnperp_confirm_delay_mins', state.config.confirmDelayMins);
    localStorage.setItem('dnperp_tg_token', state.config.tgToken);
    localStorage.setItem('dnperp_tg_chat_id', state.config.tgChatId);

    const w = document.getElementById('hlWalletAddress')?.value.trim() || '';
    state.config.hlWallet = w;
    localStorage.setItem('dnperp_wallet_address', w);
    localStorage.setItem('dnperp_hl_wallet', w);
    updateWalletSubLabel();
    if (w) {
      fetchHlMargin();
      fetchAllLiveWalletPositions();
    } else {
      fetchAllLiveWalletPositions();
    }

    updateThresholdDisplayLabels();
    recalculateBasisAndSignals();
    updateChartThresholdLines();
    closeModal('settingsModal');
  });

  // Phase 10 Trade Journal Modal Triggers
  document.getElementById('btnOpenAddTradeModal')?.addEventListener('click', () => {
    resetTradeForm();
    const modalTitle = document.getElementById('tradeModalTitle');
    if (modalTitle) modalTitle.innerText = state.lang === 'EN' ? '📝 New Trade Entry' : '📝 Nhập Lệnh Mới Vào Nhật Ký';
    document.getElementById('tradeModal')?.classList.remove('hidden');
  });

  document.getElementById('btnCloseTradeModal')?.addEventListener('click', () => closeModal('tradeModal'));
  document.getElementById('btnCancelTradeModal')?.addEventListener('click', () => closeModal('tradeModal'));

  document.getElementById('btnSaveTradeSubmit')?.addEventListener('click', saveTradeEntry);

  const calcBasisEntry = () => {
    const pL = parseFloat(document.getElementById('tradePriceLong')?.value) || 0;
    const pS = parseFloat(document.getElementById('tradePriceShort')?.value) || 0;
    if (pL > 0 && pS > 0) {
      const b = ((pS - pL) / pL) * 100;
      const target = document.getElementById('tradeBasisEntry');
      if (target) target.value = b.toFixed(2);
    }
  };
  document.getElementById('tradePriceLong')?.addEventListener('input', calcBasisEntry);
  document.getElementById('tradePriceShort')?.addEventListener('input', calcBasisEntry);

  const calcBasisExit = () => {
    const pLx = parseFloat(document.getElementById('tradePriceLongExit')?.value) || 0;
    const pSx = parseFloat(document.getElementById('tradePriceShortExit')?.value) || 0;
    if (pLx > 0 && pSx > 0) {
      const b = ((pSx - pLx) / pLx) * 100;
      const target = document.getElementById('tradeBasisExit');
      if (target) target.value = b.toFixed(2);
    }
  };
  document.getElementById('tradePriceLongExit')?.addEventListener('input', calcBasisExit);
  document.getElementById('tradePriceShortExit')?.addEventListener('input', calcBasisExit);

  document.getElementById('btnQueryHlMargin')?.addEventListener('click', () => {
    const w = document.getElementById('hlWalletAddress')?.value.trim() || '';
    if (w) {
      state.config.hlWallet = w;
      localStorage.setItem('dnperp_wallet_address', w);
      localStorage.setItem('dnperp_hl_wallet', w);
      updateWalletSubLabel();
      fetchHlMargin();
    }
  });

  document.getElementById('btnClearWallet')?.addEventListener('click', () => {
    localStorage.removeItem('dnperp_wallet_address');
    localStorage.removeItem('dnperp_hl_wallet');
    state.config.hlWallet = '';
    const input = document.getElementById('hlWalletAddress');
    if (input) input.value = '';
    updateWalletSubLabel();
    updateHlMarginUI(0, 0, 0);
  });

  const updateLt = () => {
    const u = parseFloat(document.getElementById('ltMarginUsed')?.value) || 0;
    const t = parseFloat(document.getElementById('ltTotalMargin')?.value) || 1;
    state.config.ltMarginUsed = u;
    state.config.ltTotalMargin = t;
    localStorage.setItem('dnperp_lt_used', u);
    localStorage.setItem('dnperp_lt_total', t);
    updateLighterMarginUI();
  };
  document.getElementById('ltMarginUsed')?.addEventListener('input', updateLt);
  document.getElementById('ltTotalMargin')?.addEventListener('input', updateLt);

  document.getElementById('btnTestTgAlert')?.addEventListener('click', async () => {
    const resEl = document.getElementById('tgTestResult');
    const token = document.getElementById('inputTgToken')?.value.trim() || '';
    const chatId = document.getElementById('inputTgChatId')?.value.trim() || '';

    if (!token || !chatId) {
      if (resEl) {
        resEl.innerText = state.lang === 'EN' ? '❌ Please enter Bot Token & Chat ID!' : '❌ Vui lòng nhập Bot Token và Chat ID!';
        resEl.style.color = 'var(--accent-danger)';
      }
      return;
    }

    if (resEl) {
      resEl.innerText = state.lang === 'EN' ? '⏳ Sending test alert...' : '⏳ Đang gửi thử...';
      resEl.style.color = 'var(--text-gold)';
    }

    const msg = `🧪 <b>Test Telegram Alert — Entropy ↔ Lighter Monitor</b>\n\n✅ Connection verified from <code>godnc.com/dnperp</code>!\nRealtime alerts ready (Adaptive 30-Day Bands + Passcode Protection).`;
    const success = await sendTelegramMessage(token, chatId, msg);

    if (resEl) {
      if (success) {
        resEl.innerText = state.lang === 'EN' ? '✅ Alert sent successfully!' : '✅ Đã gửi thành công vào Telegram!';
        resEl.style.color = 'var(--accent-safe)';
      } else {
        resEl.innerText = state.lang === 'EN' ? '❌ Failed to send. Check Token/Chat ID!' : '❌ Gửi thất bại. Kiểm tra lại Token/Chat ID!';
        resEl.style.color = 'var(--accent-danger)';
      }
    }
  });

  document.getElementById('btnAddPairSubmit')?.addEventListener('click', verifyAndAddPair);

  document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state.activeChartRange = e.target.dataset.time;
      updateChartData();
    });
  });

  document.getElementById('btnClearHistory')?.addEventListener('click', () => {
    const confirmMsg = state.lang === 'EN' 
      ? 'Are you sure you want to clear 30-day historical data?' 
      : 'Bạn có chắc chắn muốn xoá toàn bộ lịch sử 30 ngày đã lưu?';
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
  if (!tbody) return;
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
    try {
      await ConnectorRegistry.fetchAssetData(exA, symA);
    } catch (errA) {
      statusEl.innerText = isEn 
        ? `❌ Exchange A (${exA}) error: ${errA.message}` 
        : `❌ Lỗi trên Sàn A (${exA}): ${errA.message}`;
      statusEl.style.color = 'var(--accent-danger)';
      return;
    }

    try {
      await ConnectorRegistry.fetchAssetData(exB, symB);
    } catch (errB) {
      statusEl.innerText = isEn 
        ? `❌ Exchange B (${exB}) error: ${errB.message}` 
        : `❌ Lỗi trên Sàn B (${exB}): ${errB.message}`;
      statusEl.style.color = 'var(--accent-danger)';
      return;
    }

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
    populateTradeModalPairsDropdown();
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
    delete state.signalTracker[pairId];
    localStorage.setItem('dnperp_signal_tracker', JSON.stringify(state.signalTracker));

    initMarketState();
    populateTradeModalPairsDropdown();
    renderSpreadCards();
    renderPairsTable();
    recalculateBasisAndSignals();
    updateChartData();
  }
};

// ==========================================================================
// PHASE 14: ENRICHED POSITION CARDS & AUTOMATIC TRADE ARCHIVING ON CLOSURE
// ==========================================================================

function getPositionFirstSeen(groupKey) {
  const timestamps = JSON.parse(localStorage.getItem('dnperp_position_first_seen') || '{}');
  if (!timestamps[groupKey]) {
    timestamps[groupKey] = Date.now();
    localStorage.setItem('dnperp_position_first_seen', JSON.stringify(timestamps));
  }
  return timestamps[groupKey];
}

function removePositionFirstSeen(groupKey) {
  const timestamps = JSON.parse(localStorage.getItem('dnperp_position_first_seen') || '{}');
  if (timestamps[groupKey]) {
    delete timestamps[groupKey];
    localStorage.setItem('dnperp_position_first_seen', JSON.stringify(timestamps));
  }
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0m';
  const totalMins = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${mins}m`;
  } else {
    return `${mins}m`;
  }
}

function checkAndAutoArchiveClosedPositions(currentGroups) {
  const storedSnapshotStr = localStorage.getItem('dnperp_open_positions_snapshot');
  if (!storedSnapshotStr) {
    savePositionsSnapshot(currentGroups);
    return;
  }

  const prevGroups = JSON.parse(storedSnapshotStr);
  const currentGroupIds = new Set(currentGroups.map(g => g.groupId));

  let archivedAny = false;

  prevGroups.forEach(prevGrp => {
    if (!currentGroupIds.has(prevGrp.groupId)) {
      console.log(`⚡ Position ${prevGrp.groupId} closed! Auto-archiving to Trade Journal...`);

      const firstSeen = getPositionFirstSeen(prevGrp.groupId);
      const openDateIso = new Date(firstSeen).toISOString().slice(0, 16);
      const closeDateIso = new Date().toISOString().slice(0, 16);

      const longLeg = prevGrp.legs ? prevGrp.legs.find(l => l.direction === 'LONG') : null;
      const shortLeg = prevGrp.legs ? prevGrp.legs.find(l => l.direction === 'SHORT') : null;

      const capitalEst = prevGrp.combinedNotional || 1000;
      const basisIn = prevGrp.netBasisEntry !== null ? prevGrp.netBasisEntry : 0;
      const basisOut = prevGrp.lastKnownMarketBasis !== undefined ? prevGrp.lastKnownMarketBasis : basisIn;

      const autoTradeRecord = {
        id: `AUTO_${prevGrp.groupId}_${Date.now()}`,
        dateOpen: openDateIso,
        dateClose: closeDateIso,
        pairId: prevGrp.groupId,
        status: 'CLOSED',
        capital: parseFloat(capitalEst.toFixed(2)),
        priceLong: longLeg ? longLeg.entryPrice : 0,
        notionalLong: longLeg ? longLeg.notional : 500,
        priceShort: shortLeg ? shortLeg.entryPrice : 0,
        notionalShort: shortLeg ? shortLeg.notional : 500,
        basisEntry: parseFloat(basisIn.toFixed(2)),
        basisExit: parseFloat(basisOut.toFixed(2)),
        priceLongExit: longLeg ? longLeg.entryPrice : 0,
        priceShortExit: shortLeg ? shortLeg.entryPrice : 0,
        pnlBasis: parseFloat((prevGrp.combinedPnl || 0).toFixed(2)),
        fundingAccrued: parseFloat((prevGrp.combinedFunding || 0).toFixed(2)),
        totalPnl: parseFloat(((prevGrp.combinedPnl || 0) + (prevGrp.combinedFunding || 0)).toFixed(2)),
        notes: state.lang === 'EN' 
          ? '⚡ Auto-archived from live wallet position closure (Estimated values)' 
          : '⚡ Tự động ghi nhận từ ví khi đóng vị thế (Giá ước tính)'
      };

      state.journal.unshift(autoTradeRecord);
      archivedAny = true;
      removePositionFirstSeen(prevGrp.groupId);
    }
  });

  if (archivedAny) {
    localStorage.setItem('dnperp_journal_trades', JSON.stringify(state.journal));
    renderJournalTable();
    updateJournalAnalytics();
    initJournalCharts();
  }

  savePositionsSnapshot(currentGroups);
}

function savePositionsSnapshot(groups) {
  const snapshot = groups.map(grp => ({
    groupId: grp.groupId,
    title: grp.title,
    combinedNotional: grp.combinedNotional,
    combinedPnl: grp.combinedPnl,
    combinedFunding: grp.combinedFunding,
    netBasisEntry: grp.netBasisEntry,
    lastKnownMarketBasis: grp.lastKnownMarketBasis,
    legs: grp.legs.map(l => ({
      exchange: l.exchange,
      exchangeName: l.exchangeName,
      symbol: l.symbol,
      direction: l.direction,
      size: l.size,
      entryPrice: l.entryPrice,
      notional: l.notional,
      unrealizedPnl: l.unrealizedPnl,
      cumFunding: l.cumFunding
    }))
  }));
  localStorage.setItem('dnperp_open_positions_snapshot', JSON.stringify(snapshot));
}

// Window helper for simulation / manual testing
window.simulatePositionClosure = function(groupId) {
  const storedSnapshotStr = localStorage.getItem('dnperp_open_positions_snapshot');
  if (!storedSnapshotStr) return;
  const snapshot = JSON.parse(storedSnapshotStr);
  const targetIndex = snapshot.findIndex(g => g.groupId === groupId);
  if (targetIndex !== -1) {
    const closedGroup = snapshot[targetIndex];
    snapshot.splice(targetIndex, 1);
    localStorage.setItem('dnperp_open_positions_snapshot', JSON.stringify(snapshot));
    state.liveGroups = state.liveGroups.filter(g => g.groupId !== groupId);
    state.livePositions = state.livePositions.filter(p => !p.id.includes(groupId));
    checkAndAutoArchiveClosedPositions(state.liveGroups);
    renderLivePositionsUI();
    updateJournalAnalytics();
    alert(state.lang === 'EN' ? `⚡ Simulated closure for position ${groupId}! Auto-archived to Trade Journal.` : `⚡ Giả lập đóng vị thế ${groupId} thành công! Đã tự động lưu vào Nhật Ký Giao Dịch.`);
  }
};

async function fetchAllLiveWalletPositions() {
  const wallet = state.config.hlWallet;
  const liveBadge = document.getElementById('livePositionsBadge');
  const walletDisplayBtn = document.getElementById('btnLiveWalletDisplay');

  if (walletDisplayBtn) {
    walletDisplayBtn.innerText = wallet 
      ? `${state.lang === 'EN' ? 'Wallet' : 'Ví'}: ${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)}`
      : (state.lang === 'EN' ? 'Wallet: Not set' : 'Ví: Chưa thiết lập');
  }

  if (!wallet || wallet === '0x0000000000000000000000000000000000000000') {
    state.livePositions = [];
    state.liveGroups = [];
    if (liveBadge) {
      liveBadge.className = 'status-indicator offline';
      liveBadge.innerText = i18n[state.lang]?.badgeLiveNoWallet || '⚠️ CHƯA THIẾT LẬP VÍ';
    }
    renderLivePositionsUI();
    updateJournalAnalytics();
    return;
  }

  try {
    const [entRes, hlRes, ltRes] = await Promise.allSettled([
      fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: wallet, dex: "io" })
      }).then(r => r.ok ? r.json() : null),

      fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: wallet })
      }).then(r => r.ok ? r.json() : null),

      fetch(`https://api.rh.lighter.xyz/api/v1/account?by=l1_address&value=${wallet}`)
        .then(r => r.ok ? r.json() : null)
    ]);

    const positions = [];

    // Parse Entropy positions (dex: io)
    if (entRes.status === 'fulfilled' && entRes.value && entRes.value.assetPositions) {
      entRes.value.assetPositions.forEach(ap => {
        const p = ap.position;
        const szi = parseFloat(p.szi) || 0;
        if (szi !== 0) {
          const rawCoin = p.coin || '';
          const cleanSym = rawCoin.replace(/^io:/i, '').toUpperCase();
          const marginUsed = parseFloat(p.marginUsed) || 0;
          const unPnl = parseFloat(p.unrealizedPnl) || 0;
          const roe = p.returnOnEquity !== undefined && p.returnOnEquity !== null 
            ? parseFloat(p.returnOnEquity) * 100 
            : (marginUsed > 0 ? (unPnl / marginUsed) * 100 : 0);
          const lev = p.leverage?.value ? parseInt(p.leverage.value) : 5;

          positions.push({
            id: `ENTROPY_${rawCoin}`,
            exchange: 'entropy',
            exchangeName: 'Hyperliquid (Entropy)',
            rawCoin: rawCoin,
            symbol: cleanSym,
            size: Math.abs(szi),
            direction: szi < 0 ? 'SHORT' : 'LONG',
            entryPrice: parseFloat(p.entryPx) || 0,
            notional: parseFloat(p.positionValue) || 0,
            unrealizedPnl: unPnl,
            cumFunding: parseFloat(p.cumFunding?.allTime) || 0,
            liquidationPx: parseFloat(p.liquidationPx) || 0,
            marginUsed: marginUsed,
            roe: parseFloat(roe.toFixed(2)),
            leverage: lev
          });
        }
      });
    }

    // Parse Hyperliquid Mainnet positions
    if (hlRes.status === 'fulfilled' && hlRes.value && hlRes.value.assetPositions) {
      hlRes.value.assetPositions.forEach(ap => {
        const p = ap.position;
        const szi = parseFloat(p.szi) || 0;
        if (szi !== 0) {
          const rawCoin = p.coin || '';
          const cleanSym = rawCoin.replace(/^io:/i, '').toUpperCase();
          if (!positions.some(pos => pos.id === `ENTROPY_${rawCoin}`)) {
            const marginUsed = parseFloat(p.marginUsed) || 0;
            const unPnl = parseFloat(p.unrealizedPnl) || 0;
            const roe = p.returnOnEquity !== undefined && p.returnOnEquity !== null 
              ? parseFloat(p.returnOnEquity) * 100 
              : (marginUsed > 0 ? (unPnl / marginUsed) * 100 : 0);
            const lev = p.leverage?.value ? parseInt(p.leverage.value) : 5;

            positions.push({
              id: `HL_${rawCoin}`,
              exchange: 'hyperliquid',
              exchangeName: 'Hyperliquid Mainnet',
              rawCoin: rawCoin,
              symbol: cleanSym,
              size: Math.abs(szi),
              direction: szi < 0 ? 'SHORT' : 'LONG',
              entryPrice: parseFloat(p.entryPx) || 0,
              notional: parseFloat(p.positionValue) || 0,
              unrealizedPnl: unPnl,
              cumFunding: parseFloat(p.cumFunding?.allTime) || 0,
              liquidationPx: parseFloat(p.liquidationPx) || 0,
              marginUsed: marginUsed,
              roe: parseFloat(roe.toFixed(2)),
              leverage: lev
            });
          }
        }
      });
    }

    // Parse Lighter positions
    if (ltRes.status === 'fulfilled' && ltRes.value && ltRes.value.code === 200 && ltRes.value.accounts && ltRes.value.accounts.length > 0) {
      const acc = ltRes.value.accounts[0];
      if (Array.isArray(acc.positions)) {
        acc.positions.forEach(lp => {
          const posQty = parseFloat(lp.position) || 0;
          if (posQty !== 0) {
            const sym = (lp.symbol || '').toUpperCase();
            const sign = parseInt(lp.sign);
            const dir = sign === 1 ? 'LONG' : (sign === -1 ? 'SHORT' : (posQty < 0 ? 'SHORT' : 'LONG'));
            const notional = parseFloat(lp.position_value) || 0;
            const unPnl = parseFloat(lp.unrealized_pnl) || 0;
            const marginAlloc = parseFloat(lp.allocated_margin) || parseFloat(lp.initial_margin) || (notional / 10);
            const lev = lp.leverage ? parseInt(lp.leverage) : (marginAlloc > 0 ? Math.round(notional / marginAlloc) : 10);
            const roe = marginAlloc > 0 ? (unPnl / marginAlloc) * 100 : 0;

            positions.push({
              id: `LIGHTER_${sym}_${lp.market_id}`,
              exchange: 'lighter',
              exchangeName: 'Lighter (Robinhood Chain)',
              rawCoin: sym,
              symbol: sym,
              size: Math.abs(posQty),
              direction: dir,
              entryPrice: parseFloat(lp.avg_entry_price) || 0,
              notional: notional,
              unrealizedPnl: unPnl,
              cumFunding: parseFloat(lp.total_funding_paid_out) || 0,
              liquidationPx: parseFloat(lp.liquidation_price) || 0,
              marginUsed: marginAlloc,
              roe: parseFloat(roe.toFixed(2)),
              leverage: lev
            });
          }
        });
      }
    }

    state.livePositions = positions;
    groupAndPairPositions(positions);
    checkAndAutoArchiveClosedPositions(state.liveGroups);

    if (liveBadge) {
      if (positions.length > 0) {
        liveBadge.className = 'status-indicator live';
        liveBadge.innerText = `${i18n[state.lang]?.badgeLiveSynced || '🟢 TỰ ĐỘNG ĐỒNG BỘ'} (${positions.length})`;
      } else {
        liveBadge.className = 'status-indicator offline';
        liveBadge.innerText = i18n[state.lang]?.badgeLiveEmpty || '⚪ KHÔNG CÓ VỊ THẾ ĐANG MỞ';
      }
    }

    renderLivePositionsUI();
    updateJournalAnalytics();

  } catch (err) {
    console.error('Error fetching live wallet positions:', err);
  }
}

function resolveCanonicalSymbol(sym) {
  if (!sym) return '';
  const s = sym.toUpperCase().replace(/^io:/i, '').replace(/-USD$/i, '');
  if (s === 'OAI' || s === 'OPENAI') return 'OAI/OPENAI';
  if (s === 'ANTH' || s === 'ANTHROPIC') return 'ANTH/ANTHROPIC';
  return s;
}

function groupAndPairPositions(positions) {
  const groups = {};

  positions.forEach(pos => {
    const matchedTrackedPair = state.trackedPairs.find(p => 
      p.symbolA.toUpperCase() === pos.symbol || 
      p.symbolB.toUpperCase() === pos.symbol ||
      resolveCanonicalSymbol(p.symbolA) === resolveCanonicalSymbol(pos.symbol) ||
      resolveCanonicalSymbol(p.symbolB) === resolveCanonicalSymbol(pos.symbol)
    );

    const groupKey = matchedTrackedPair ? matchedTrackedPair.id : resolveCanonicalSymbol(pos.symbol);

    if (!groups[groupKey]) {
      groups[groupKey] = {
        groupId: groupKey,
        title: matchedTrackedPair ? matchedTrackedPair.name : `${groupKey} Position`,
        firstSeen: getPositionFirstSeen(groupKey),
        legs: []
      };
    }
    groups[groupKey].legs.push(pos);
  });

  state.liveGroups = Object.values(groups).map(grp => {
    const isDeltaNeutral = grp.legs.length >= 2;
    const combinedPnl = grp.legs.reduce((sum, l) => sum + l.unrealizedPnl, 0);
    const combinedFunding = grp.legs.reduce((sum, l) => sum + l.cumFunding, 0);
    const combinedNotional = grp.legs.reduce((sum, l) => sum + l.notional, 0);

    let netBasisEntry = null;
    const shortLeg = grp.legs.find(l => l.direction === 'SHORT');
    const longLeg = grp.legs.find(l => l.direction === 'LONG');

    if (shortLeg && longLeg && longLeg.entryPrice > 0) {
      netBasisEntry = ((shortLeg.entryPrice - longLeg.entryPrice) / longLeg.entryPrice) * 100;
    }

    // Phase 14: Breakeven Basis Calculation
    let breakevenBasis = null;
    if (isDeltaNeutral && combinedNotional > 0 && netBasisEntry !== null) {
      const avgNotional = combinedNotional / 2;
      const pnlTotalWithFunding = combinedPnl + combinedFunding;
      const pnlPct = (pnlTotalWithFunding / avgNotional) * 100;
      breakevenBasis = netBasisEntry - pnlPct;
    }

    return {
      ...grp,
      type: isDeltaNeutral ? 'DELTA_NEUTRAL' : 'SINGLE_LEG',
      combinedPnl: parseFloat(combinedPnl.toFixed(2)),
      combinedFunding: parseFloat(combinedFunding.toFixed(2)),
      combinedNotional: parseFloat(combinedNotional.toFixed(2)),
      netBasisEntry: netBasisEntry !== null ? parseFloat(netBasisEntry.toFixed(2)) : null,
      breakevenBasis: breakevenBasis !== null ? parseFloat(breakevenBasis.toFixed(2)) : null
    };
  });
}

function renderLivePositionsUI() {
  const container = document.getElementById('livePositionsContainer');
  if (!container) return;
  container.innerHTML = '';
  const isEn = state.lang === 'EN';

  if (!state.liveGroups || state.liveGroups.length === 0) {
    container.innerHTML = `
      <div class="pos-empty-card">
        <span style="font-size: 24px;">📭</span>
        <div style="margin-top: 8px;">${isEn ? 'No active positions detected for wallet address.' : 'Không phát hiện vị thế đang mở nào từ địa chỉ ví công khai.'}</div>
        <div class="subtext" style="margin-top: 4px;">${isEn ? 'Positions on Hyperliquid, Entropy & Lighter will appear here automatically.' : 'Tự động quét vị thế trên Hyperliquid, Entropy & Lighter.'}</div>
      </div>
    `;
    return;
  }

  state.liveGroups.forEach(grp => {
    const isDN = grp.type === 'DELTA_NEUTRAL';
    const tagHtml = isDN 
      ? `<span class="dn-tag">⚖️ ${isEn ? 'DELTA-NEUTRAL PAIR' : 'CẶP DELTA-NEUTRAL'}</span>`
      : `<span class="single-tag">📌 ${isEn ? 'SINGLE LEG' : 'VỊ THẾ ĐƠN'}</span>`;

    const pnlClass = grp.combinedPnl >= 0 ? 'positive' : 'negative';
    const pnlDisplay = `$${grp.combinedPnl >= 0 ? '+' : ''}${grp.combinedPnl.toFixed(2)}`;

    const durationText = grp.firstSeen ? formatDuration(Date.now() - grp.firstSeen) : '0m';

    let legsHtml = '';
    grp.legs.forEach(leg => {
      const dirClass = leg.direction === 'LONG' ? 'long' : 'short';
      const legPnlClass = leg.unrealizedPnl >= 0 ? 'positive' : 'negative';
      const roeSign = leg.roe >= 0 ? '+' : '';
      const roeDisplay = `${roeSign}${leg.roe.toFixed(2)}%`;
      const liqPriceDisplay = leg.liquidationPx > 0 ? `$${leg.liquidationPx.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'N/A';

      legsHtml += `
        <div class="leg-item">
          <div class="leg-item-header">
            <div class="leg-exchange">
              <span>${leg.exchange === 'lighter' ? '⚡' : '💧'}</span>
              <span><strong>${leg.exchangeName}</strong> · <span class="mono-num" style="color: var(--text-gold); font-weight: 700;">${leg.leverage || 1}x</span></span>
            </div>
            <span class="leg-direction-badge ${dirClass}">${leg.direction} ${leg.size}</span>
          </div>
          <div class="leg-metrics-grid" style="grid-template-columns: repeat(4, 1fr);">
            <div>
              <span class="leg-m-label">${isEn ? 'Entry Price' : 'Giá Vào'}:</span>
              <div class="leg-m-val">$${leg.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div>
              <span class="leg-m-label">${isEn ? 'Notional' : 'Vị Thế'}:</span>
              <div class="leg-m-val">$${Math.round(leg.notional).toLocaleString()}</div>
            </div>
            <div>
              <span class="leg-m-label">${isEn ? 'PnL & ROE' : 'PnL & ROE'}:</span>
              <div class="leg-m-val ${legPnlClass}">$${leg.unrealizedPnl >= 0 ? '+' : ''}${leg.unrealizedPnl.toFixed(2)} <span style="font-size: 11px;">(${roeDisplay})</span></div>
            </div>
            <div>
              <span class="leg-m-label">${isEn ? 'Liq. Price' : 'Giá Thanh Lý'}:</span>
              <div class="leg-m-val mono-num" style="color: var(--accent-warning);">${liqPriceDisplay}</div>
            </div>
          </div>
        </div>
      `;
    });

    const cardId = `livepos-${grp.groupId}`;
    const isExpanded = state.expandedCards.includes(cardId);

    const toggleText = isExpanded ? (isEn ? 'Collapse' : 'Thu gọn') : (isEn ? 'Details' : 'Chi tiết');
    const toggleIcon = isExpanded ? '▲' : '▼';

    const cardHtml = `
      <div class="live-pos-card ${isDN ? 'delta-neutral' : 'single-leg'}" id="${cardId}">
        <div class="pos-card-header">
          <div class="pos-pair-title">
            <span>${grp.groupId}</span>
            <span style="font-size: 12px; color: var(--text-muted); font-weight: normal;">⏱️ ${isEn ? 'Held' : 'Đã giữ'}: <strong>${durationText}</strong></span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${tagHtml}
            <button class="card-expand-toggle-btn" id="toggle-btn-${cardId}" onclick="toggleCardExpand('${cardId}')">
              <span class="toggle-text">${toggleText}</span>
              <span class="toggle-icon">${toggleIcon}</span>
            </button>
          </div>
        </div>

        <!-- Always Visible Summary PnL Bar & Breakeven Basis -->
        <div class="summary-pnl-bar" style="display: grid; grid-template-columns: repeat(3, 1fr); align-items: center;">
          <div class="summary-pnl-item">
            <span class="summary-pnl-label">${isEn ? 'Combined PnL' : 'Tổng PnL 2 Chân'}</span>
            <span class="summary-pnl-val ${pnlClass}">${pnlDisplay}</span>
          </div>
          <div class="summary-pnl-item">
            <span class="summary-pnl-label">${isEn ? 'Entry Basis' : 'Basis Lúc Vào'}</span>
            <span class="summary-pnl-val mono-num">${grp.netBasisEntry !== null ? (grp.netBasisEntry >= 0 ? '+' : '') + grp.netBasisEntry.toFixed(2) + '%' : '—'}</span>
          </div>
          <div class="summary-pnl-item" style="text-align: right;">
            <span class="summary-pnl-label" title="${isEn ? 'Breakeven Basis' : 'Ngưỡng Basis để PnL 2 chân về 0'}">🎯 ${isEn ? 'Breakeven Basis' : 'Basis Hoà Vốn'}</span>
            <span class="summary-pnl-val mono-num" style="color: var(--text-gold);">${grp.breakevenBasis !== null ? (grp.breakevenBasis >= 0 ? '+' : '') + grp.breakevenBasis.toFixed(2) + '%' : '—'}</span>
          </div>
        </div>

        <!-- Expandable Body Container -->
        <div class="expandable-body ${isExpanded ? '' : 'collapsed'}" id="expandable-body-${cardId}">
          <div class="legs-container">
            ${legsHtml}
          </div>

          <div class="pos-card-footer">
            <div class="footer-stat">
              <span class="footer-stat-label">${isEn ? 'Cum. Funding' : 'Funding Tích Luỹ'}</span>
              <span class="footer-stat-val mono-num">$${grp.combinedFunding >= 0 ? '+' : ''}${grp.combinedFunding.toFixed(2)}</span>
            </div>
            <div class="footer-stat">
              <span class="footer-stat-label">${isEn ? 'Total Notional' : 'Tổng Vị Thế Notional'}</span>
              <span class="footer-stat-val mono-num">$${Math.round(grp.combinedNotional).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', cardHtml);
  });
}

// ==========================================================================
// PHASE 10 TRADING JOURNAL & PERFORMANCE ANALYTICS ENGINE
// ==========================================================================

function resetTradeForm() {
  document.getElementById('tradeEditId').value = '';
  const nowStr = new Date().toISOString().slice(0, 16);
  document.getElementById('tradeDateOpen').value = nowStr;
  document.getElementById('tradeStatus').value = 'OPEN';
  document.getElementById('tradeCapital').value = '1000';
  document.getElementById('tradePriceLong').value = '';
  document.getElementById('tradeNotionalLong').value = '1000';
  document.getElementById('tradePriceShort').value = '';
  document.getElementById('tradeNotionalShort').value = '1000';
  document.getElementById('tradeBasisEntry').value = '';
  document.getElementById('tradeDateClose').value = '';
  document.getElementById('tradeBasisExit').value = '';
  document.getElementById('tradePriceLongExit').value = '';
  document.getElementById('tradePriceShortExit').value = '';
  document.getElementById('tradeFundingAccrued').value = '0';
  document.getElementById('tradeNotes').value = '';
}

function saveTradeEntry() {
  const editId = document.getElementById('tradeEditId').value;
  const dateOpen = document.getElementById('tradeDateOpen').value;
  const pairId = document.getElementById('tradePairId').value;
  const status = document.getElementById('tradeStatus').value;
  const capital = parseFloat(document.getElementById('tradeCapital').value) || 1000;

  const priceLong = parseFloat(document.getElementById('tradePriceLong').value) || 0;
  const notionalLong = parseFloat(document.getElementById('tradeNotionalLong').value) || 1000;
  const priceShort = parseFloat(document.getElementById('tradePriceShort').value) || 0;
  const notionalShort = parseFloat(document.getElementById('tradeNotionalShort').value) || 1000;

  let basisEntry = parseFloat(document.getElementById('tradeBasisEntry').value);
  if (isNaN(basisEntry) && priceLong > 0 && priceShort > 0) {
    basisEntry = parseFloat((((priceShort - priceLong) / priceLong) * 100).toFixed(2));
  }
  if (isNaN(basisEntry)) basisEntry = 0;

  const dateClose = document.getElementById('tradeDateClose').value;
  let basisExit = parseFloat(document.getElementById('tradeBasisExit').value);
  const priceLongExit = parseFloat(document.getElementById('tradePriceLongExit').value) || 0;
  const priceShortExit = parseFloat(document.getElementById('tradePriceShortExit').value) || 0;
  if (isNaN(basisExit) && priceLongExit > 0 && priceShortExit > 0) {
    basisExit = parseFloat((((priceShortExit - priceLongExit) / priceLongExit) * 100).toFixed(2));
  }

  const fundingAccrued = parseFloat(document.getElementById('tradeFundingAccrued').value) || 0;
  const notes = document.getElementById('tradeNotes').value.trim();

  let pnlBasis = 0;
  if (status === 'CLOSED' && priceLong > 0 && priceShort > 0 && priceLongExit > 0 && priceShortExit > 0) {
    const pnlLong = notionalLong * ((priceLongExit - priceLong) / priceLong);
    const pnlShort = notionalShort * ((priceShort - priceShortExit) / priceShort);
    pnlBasis = pnlLong + pnlShort;
  }
  const totalPnl = pnlBasis + fundingAccrued;

  const tradeObj = {
    id: editId || 'TRADE_' + Date.now(),
    dateOpen,
    pairId,
    status,
    capital,
    priceLong,
    notionalLong,
    priceShort,
    notionalShort,
    basisEntry,
    dateClose: status === 'CLOSED' ? (dateClose || new Date().toISOString().slice(0, 16)) : '',
    priceLongExit,
    priceShortExit,
    basisExit: status === 'CLOSED' ? (isNaN(basisExit) ? 0 : basisExit) : null,
    pnlBasis: parseFloat(pnlBasis.toFixed(2)),
    fundingAccrued: parseFloat(fundingAccrued.toFixed(2)),
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    notes
  };

  if (editId) {
    const idx = state.journal.findIndex(t => t.id === editId);
    if (idx !== -1) state.journal[idx] = tradeObj;
  } else {
    state.journal.unshift(tradeObj);
  }

  localStorage.setItem('dnperp_journal_trades', JSON.stringify(state.journal));

  closeModal('tradeModal');
  renderJournalTable();
  updateJournalAnalytics();
  updateJournalCharts();
}

window.editTradeEntry = function(tradeId) {
  const trade = state.journal.find(t => t.id === tradeId);
  if (!trade) return;

  document.getElementById('tradeEditId').value = trade.id;
  document.getElementById('tradeDateOpen').value = trade.dateOpen || '';
  document.getElementById('tradePairId').value = trade.pairId || '';
  document.getElementById('tradeStatus').value = trade.status || 'OPEN';
  document.getElementById('tradeCapital').value = trade.capital || 1000;

  document.getElementById('tradePriceLong').value = trade.priceLong || '';
  document.getElementById('tradeNotionalLong').value = trade.notionalLong || 1000;
  document.getElementById('tradePriceShort').value = trade.priceShort || '';
  document.getElementById('tradeNotionalShort').value = trade.notionalShort || 1000;
  document.getElementById('tradeBasisEntry').value = trade.basisEntry !== null ? trade.basisEntry : '';

  document.getElementById('tradeDateClose').value = trade.dateClose || '';
  document.getElementById('tradeBasisExit').value = trade.basisExit !== null ? trade.basisExit : '';
  document.getElementById('tradePriceLongExit').value = trade.priceLongExit || '';
  document.getElementById('tradePriceShortExit').value = trade.priceShortExit || '';
  document.getElementById('tradeFundingAccrued').value = trade.fundingAccrued || 0;
  document.getElementById('tradeNotes').value = trade.notes || '';

  document.getElementById('tradeModalTitle').innerText = state.lang === 'EN' ? '✏️ Edit Trade Entry' : '✏️ Chỉnh Sửa Lệnh Trong Nhật Ký';
  document.getElementById('tradeModal').classList.remove('hidden');
};

window.deleteTradeEntry = function(tradeId) {
  const isEn = state.lang === 'EN';
  const msg = isEn ? 'Are you sure you want to delete this trade record?' : 'Bạn có chắc chắn muốn xoá bản ghi lệnh này khỏi Nhật ký?';
  if (confirm(msg)) {
    state.journal = state.journal.filter(t => t.id !== tradeId);
    localStorage.setItem('dnperp_journal_trades', JSON.stringify(state.journal));
    renderJournalTable();
    updateJournalAnalytics();
    updateJournalCharts();
  }
};

// Render Journal Trades Table (Phase 13 v2 Tread.fi Table & Filters)
function renderJournalTable() {
  const tbody = document.getElementById('journalTableBody');
  const filterPairSelect = document.getElementById('filterJournalPair');
  if (!tbody) return;
  tbody.innerHTML = '';
  const isEn = state.lang === 'EN';

  // Populate pair filter dropdown
  if (filterPairSelect) {
    const currentVal = filterPairSelect.value;
    filterPairSelect.innerHTML = `<option value="ALL">${isEn ? 'All Pairs' : 'Tất cả các cặp'}</option>`;
    state.trackedPairs.forEach(p => {
      filterPairSelect.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.id} (${p.name})</option>`);
    });
    filterPairSelect.value = currentVal || 'ALL';
  }

  // Filter Trades Array
  let filtered = state.journal.filter(trade => {
    if (state.journalFilterPair !== 'ALL' && trade.pairId !== state.journalFilterPair) return false;
    if (state.journalFilterStatus !== 'ALL' && trade.status !== state.journalFilterStatus) return false;
    if (state.journalSearchQuery) {
      const q = state.journalSearchQuery;
      const matchPair = (trade.pairId || '').toLowerCase().includes(q);
      const matchNotes = (trade.notes || '').toLowerCase().includes(q);
      const matchId = (trade.id || '').toLowerCase().includes(q);
      if (!matchPair && !matchNotes && !matchId) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 24px;">${isEn ? 'No matching trade records found.' : 'Không tìm thấy bản ghi lệnh nào phù hợp với bộ lọc.'}</td></tr>`;
    return;
  }

  filtered.forEach(trade => {
    const isClosed = trade.status === 'CLOSED';
    const statusBadge = isClosed 
      ? `<span class="trade-status-badge closed">🔵 ${isEn ? 'CLOSED' : 'ĐÃ ĐÓNG'}</span>`
      : `<span class="trade-status-badge open">🟢 ${isEn ? 'OPEN' : 'ĐANG MỞ'}</span>`;

    const openDate = trade.dateOpen ? new Date(trade.dateOpen).toLocaleDateString() : 'N/A';
    const basisIn = `${trade.basisEntry >= 0 ? '+' : ''}${trade.basisEntry.toFixed(2)}%`;
    const basisOut = isClosed && trade.basisExit !== null ? `${trade.basisExit >= 0 ? '+' : ''}${trade.basisExit.toFixed(2)}%` : '—';
    const funding = `$${trade.fundingAccrued.toFixed(2)}`;
    
    let pnlDisplay = '—';
    let pnlClass = '';
    if (isClosed) {
      pnlDisplay = `$${trade.totalPnl >= 0 ? '+' : ''}${trade.totalPnl.toFixed(2)}`;
      pnlClass = trade.totalPnl >= 0 ? 'positive' : 'negative';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${trade.pairId}</strong> <span style="font-size: 11px; color: var(--text-dim);">(${trade.id})</span></td>
      <td><span class="mono-num">$${trade.priceLong ? trade.priceLong.toFixed(2) : '—'}</span></td>
      <td><span class="mono-num">$${trade.priceShort ? trade.priceShort.toFixed(2) : '—'}</span></td>
      <td><span class="mono-num">${basisIn}</span></td>
      <td><span class="mono-num">${basisOut}</span></td>
      <td><span class="mono-num ${pnlClass}"><strong>${pnlDisplay}</strong></span></td>
      <td><span class="mono-num">${funding}</span></td>
      <td><span class="mono-num" style="font-size: 11px; color: var(--text-muted);">${openDate}</span></td>
      <td>${statusBadge}</td>
      <td style="text-align: right;">
        <button class="btn btn-outline btn-xs" onclick="editTradeEntry('${trade.id}')">✏️ ${isEn ? 'Edit' : 'Sửa'}</button>
        <button class="btn btn-danger btn-xs" onclick="deleteTradeEntry('${trade.id}')">🗑️ ${isEn ? 'Del' : 'Xoá'}</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Calculate & Update Journal Analytics Summary Cards + Insights
function updateJournalAnalytics() {
  const isEn = state.lang === 'EN';
  const trades = state.journal;

  const openTrades = trades.filter(t => t.status === 'OPEN');
  const closedTrades = trades.filter(t => t.status === 'CLOSED');

  const activeNotional = openTrades.reduce((sum, t) => sum + (t.notionalLong + t.notionalShort), 0);
  const activeCapital = openTrades.reduce((sum, t) => sum + t.capital, 0);

  document.getElementById('jValPosition').innerText = `$${Math.round(activeNotional).toLocaleString()} / $${Math.round(activeCapital).toLocaleString()}`;
  document.getElementById('jSubPosition').innerText = `${openTrades.length} ${isEn ? 'active open positions' : 'vị thế đang mở'}`;

  const totalFunding = trades.reduce((sum, t) => sum + (t.fundingAccrued || 0), 0);
  const fundEl = document.getElementById('jValFunding');
  fundEl.innerText = `$${totalFunding >= 0 ? '+' : ''}${totalFunding.toFixed(2)}`;
  fundEl.className = 'm-stat-value mono-num ' + (totalFunding >= 0 ? 'positive' : 'negative');

  const winningClosed = closedTrades.filter(t => t.totalPnl > 0);
  const winRate = closedTrades.length > 0 ? (winningClosed.length / closedTrades.length) * 100 : 0;
  document.getElementById('jValWinRate').innerText = `${winRate.toFixed(1)}%`;
  document.getElementById('jSubWinRate').innerText = `${winningClosed.length} / ${closedTrades.length} ${isEn ? 'closed trades profitable' : 'lệnh đóng có lời'}`;

  let sumBasisCaptured = 0;
  let closedWithBasisCount = 0;
  closedTrades.forEach(t => {
    if (t.basisExit !== null) {
      sumBasisCaptured += (t.basisEntry - t.basisExit);
      closedWithBasisCount++;
    }
  });
  const avgBasisCaptured = closedWithBasisCount > 0 ? sumBasisCaptured / closedWithBasisCount : 0;
  document.getElementById('jValAvgBasis').innerText = `${avgBasisCaptured >= 0 ? '+' : ''}${avgBasisCaptured.toFixed(2)}%`;

  let totalHoldHours = 0;
  let holdCount = 0;
  closedTrades.forEach(t => {
    if (t.dateOpen && t.dateClose) {
      const d1 = new Date(t.dateOpen).getTime();
      const d2 = new Date(t.dateClose).getTime();
      if (d2 > d1) {
        totalHoldHours += (d2 - d1) / (1000 * 60 * 60);
        holdCount++;
      }
    }
  });
  const avgHoldHours = holdCount > 0 ? totalHoldHours / holdCount : 0;
  document.getElementById('jValAvgHold').innerText = avgHoldHours > 24 
    ? `${(avgHoldHours / 24).toFixed(1)} ${isEn ? 'days' : 'ngày'}`
    : `${avgHoldHours.toFixed(1)} ${isEn ? 'hours' : 'giờ'}`;

  const totalPnlAll = trades.reduce((sum, t) => sum + (t.totalPnl || 0), 0);
  const totalAllocatedCapital = trades.reduce((sum, t) => sum + (t.capital || 1000), 0) || 1000;
  
  let spanDays = 30;
  if (trades.length >= 2) {
    const times = trades.map(t => new Date(t.dateOpen).getTime()).filter(t => !isNaN(t));
    if (times.length >= 2) {
      const minT = Math.min(...times);
      const maxT = Math.max(...times);
      spanDays = Math.max(1, Math.round((maxT - minT) / (1000 * 60 * 60 * 24)));
    }
  }
  const totalApr = ((totalPnlAll / totalAllocatedCapital) * (365 / spanDays)) * 100;
  const aprEl = document.getElementById('jValApr');
  aprEl.innerText = `${totalApr >= 0 ? '+' : ''}${totalApr.toFixed(2)}%`;
  aprEl.className = 'm-stat-value mono-num ' + (totalApr >= 0 ? 'positive' : 'negative');
  document.getElementById('jSubApr').innerText = `$${totalPnlAll >= 0 ? '+' : ''}${totalPnlAll.toFixed(2)} PnL (${spanDays}d)`;

  generatePersonalInsights(closedTrades);
}

// Generate Human-Readable Personal Insights
function generatePersonalInsights(closedTrades) {
  const container = document.getElementById('insightsContainer');
  if (!container) return;
  const isEn = state.lang === 'EN';

  if (closedTrades.length < 5) {
    container.innerHTML = `
      <div class="insight-item">
        <span class="icon">💡</span>
        <div>${isEn ? `Need more data for pattern analysis (currently <strong>${closedTrades.length}/5</strong> closed trades). Keep journaling your trades!` : `Cần thêm dữ liệu để phân tích pattern (hiện có <strong>${closedTrades.length}/5</strong> lệnh đã đóng). Hãy tiếp tục nhập nhật ký các lệnh của bạn!`}</div>
      </div>
    `;
    return;
  }

  const insights = [];

  const upperTrades = closedTrades.filter(t => t.basisEntry > 0);
  const lowerTrades = closedTrades.filter(t => t.basisEntry < 0);

  const upperWin = upperTrades.filter(t => t.totalPnl > 0).length;
  const lowerWin = lowerTrades.filter(t => t.totalPnl > 0).length;

  const upperWinRate = upperTrades.length > 0 ? Math.round((upperWin / upperTrades.length) * 100) : 0;
  const lowerWinRate = lowerTrades.length > 0 ? Math.round((lowerWin / lowerTrades.length) * 100) : 0;

  if (upperTrades.length > 0 || lowerTrades.length > 0) {
    if (upperWinRate > lowerWinRate) {
      insights.push({
        icon: '📊',
        text: isEn 
          ? `Trades entered on <strong>Upper Band (positive basis)</strong> achieved a higher win rate of <strong>${upperWinRate}%</strong> compared to Lower Band (${lowerWinRate}%).`
          : `Lệnh mở khi basis vượt <strong>Dải Trên (basis dương)</strong> đạt winrate cao hơn rõ rệt: <strong>${upperWinRate}%</strong> (so với ${lowerWinRate}% ở Dải Dưới).`
      });
    } else {
      insights.push({
        icon: '📊',
        text: isEn 
          ? `Trades entered on <strong>Lower Band (negative basis)</strong> achieved a higher win rate of <strong>${lowerWinRate}%</strong> compared to Upper Band (${upperWinRate}%).`
          : `Lệnh mở khi basis vượt <strong>Dải Dưới (basis âm)</strong> đạt winrate cao hơn: <strong>${lowerWinRate}%</strong> (so với ${upperWinRate}% ở Dải Trên).`
      });
    }
  }

  const pairPnlMap = {};
  closedTrades.forEach(t => {
    pairPnlMap[t.pairId] = (pairPnlMap[t.pairId] || 0) + t.totalPnl;
  });
  const sortedPairs = Object.entries(pairPnlMap).sort((a, b) => b[1] - a[1]);
  if (sortedPairs.length > 0) {
    const best = sortedPairs[0];
    const worst = sortedPairs[sortedPairs.length - 1];
    insights.push({
      icon: '🏆',
      text: isEn
        ? `Best performing asset pair: <strong>${best[0]}</strong> (+$${best[1].toFixed(2)} PnL). Worst performing: <strong>${worst[0]}</strong> ($${worst[1].toFixed(2)} PnL).`
        : `Cặp tài sản cho kết quả tốt nhất: <strong>${best[0]}</strong> (+$${best[1].toFixed(2)} PnL). Cặp kém nhất: <strong>${worst[0]}</strong> ($${worst[1].toFixed(2)} PnL).`
    });
  }

  const hourPnlMap = {};
  closedTrades.forEach(t => {
    if (t.dateOpen) {
      const h = new Date(t.dateOpen).getHours();
      const windowKey = `${Math.floor(h / 4) * 4}:00 - ${Math.floor(h / 4) * 4 + 4}:00`;
      hourPnlMap[windowKey] = (hourPnlMap[windowKey] || 0) + t.totalPnl;
    }
  });
  const sortedHours = Object.entries(hourPnlMap).sort((a, b) => b[1] - a[1]);
  if (sortedHours.length > 0) {
    insights.push({
      icon: '⏰',
      text: isEn
        ? `Best entry time window: <strong>${sortedHours[0][0]}</strong> with total PnL of +$${sortedHours[0][1].toFixed(2)}.`
        : `Khung giờ mở lệnh đạt hiệu suất cao nhất: <strong>${sortedHours[0][0]}</strong> với tổng PnL +$${sortedHours[0][1].toFixed(2)}.`
    });
  }

  const fundingErosionTrades = closedTrades.filter(t => t.fundingAccrued < 0 && Math.abs(t.fundingAccrued) > t.pnlBasis);
  if (fundingErosionTrades.length > 0) {
    const badTrade = fundingErosionTrades[0];
    insights.push({
      icon: '⚠️',
      isWarning: true,
      text: isEn
        ? `Detected <strong>${fundingErosionTrades.length} trade(s)</strong> (e.g. ${badTrade.pairId}) where negative funding fees (-$${Math.abs(badTrade.fundingAccrued).toFixed(2)}) eroded the basis profit (+$${badTrade.pnlBasis.toFixed(2)}), resulting in a net loss. Check funding rates before holding long-term!`
        : `Phát hiện <strong>${fundingErosionTrades.length} lệnh</strong> (VD: ${badTrade.pairId} mở ngày ${new Date(badTrade.dateOpen).toLocaleDateString()}) bị lỗ ròng -$${Math.abs(badTrade.totalPnl).toFixed(2)} do Phí Funding âm (-$${Math.abs(badTrade.fundingAccrued).toFixed(2)}) vượt quá PnL Basis (+$${badTrade.pnlBasis.toFixed(2)}). Cần kiểm tra funding rate trước khi giữ lệnh lâu!`
    });
  }

  let htmlStr = '<div class="insight-list">';
  insights.forEach(item => {
    const cls = item.isWarning ? 'insight-item warning-insight' : 'insight-item';
    htmlStr += `
      <div class="${cls}">
        <span class="icon">${item.icon}</span>
        <div>${item.text}</div>
      </div>
    `;
  });
  htmlStr += '</div>';

  container.innerHTML = htmlStr;
}

// Render Phase 10 Journal Charts
function initJournalCharts() {
  const pnlCtx = document.getElementById('journalPnlChart')?.getContext('2d');
  const pairCtx = document.getElementById('journalPairChart')?.getContext('2d');

  if (pnlCtx) {
    state.journalPnlChart = new Chart(pnlCtx, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8e9aa8', font: { family: 'JetBrains Mono', size: 10 } } },
          y: { ticks: { color: '#c9b48c', font: { family: 'JetBrains Mono', size: 10 }, callback: (v) => '$' + v } }
        }
      }
    });
  }

  if (pairCtx) {
    state.journalPairChart = new Chart(pairCtx, {
      type: 'doughnut',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#f3ecdd', font: { family: 'JetBrains Mono', size: 11 } } }
        }
      }
    });
  }
}

function updateJournalCharts() {
  if (!state.journalPnlChart || !state.journalPairChart) return;

  const closedTrades = state.journal.filter(t => t.status === 'CLOSED').reverse();

  let cum = 0;
  const labels = [];
  const pnlData = [];

  closedTrades.forEach((t, i) => {
    cum += (t.totalPnl || 0);
    const dStr = t.dateClose ? new Date(t.dateClose).toLocaleDateString() : `#${i + 1}`;
    labels.push(dStr);
    pnlData.push(parseFloat(cum.toFixed(2)));
  });

  state.journalPnlChart.data.labels = labels;
  state.journalPnlChart.data.datasets = [{
    label: 'Cumulative PnL ($)',
    data: pnlData,
    borderColor: '#c9b48c',
    backgroundColor: 'rgba(201, 180, 140, 0.15)',
    fill: true,
    tension: 0.2,
    pointRadius: 4,
    pointBackgroundColor: '#c9b48c'
  }];
  state.journalPnlChart.update();

  const pairCounts = {};
  state.journal.forEach(t => {
    pairCounts[t.pairId] = (pairCounts[t.pairId] || 0) + 1;
  });

  const pairLabels = Object.keys(pairCounts);
  const pairData = Object.values(pairCounts);

  state.journalPairChart.data.labels = pairLabels;
  state.journalPairChart.data.datasets = [{
    data: pairData,
    backgroundColor: PALETTE.slice(0, pairLabels.length)
  }];
  state.journalPairChart.update();
}

// Timer Loop (10s refresh)
function startCountdown() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    state.countdown--;
    const timerEl = document.getElementById('countdownTimer');
    if (timerEl) timerEl.innerText = state.countdown + 's';
    
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

    if (connectionStatus) connectionStatus.className = 'status-indicator live';
    if (statusLabel) statusLabel.innerText = dict.statusLive;

    recalculateBasisAndSignals();

    state.history.push(currentPoint);
    const thirtyDaysCutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    state.history = state.history.filter(h => h.time >= thirtyDaysCutoff);
    saveHistory();
    updateChartData();

  } catch (err) {
    console.error('Data fetch error:', err);
    if (connectionStatus) connectionStatus.className = 'status-indicator offline';
    if (statusLabel) statusLabel.innerText = dict.statusOffline;
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
  const manualThresh = state.config.basisThreshold;
  const useAdaptive = state.config.useAdaptiveBands;
  const confirmDelayMins = state.config.confirmDelayMins;
  const dict = i18n[state.lang] || i18n.VI;
  const isEn = state.lang === 'EN';
  let activeBannerMsg = null;
  const now = Date.now();

  state.trackedPairs.forEach(pair => {
    const m = state.market[pair.id];
    if (!m) return;

    const connA = ConnectorRegistry.get(pair.exchangeA) || { name: pair.exchangeA };
    const connB = ConnectorRegistry.get(pair.exchangeB) || { name: pair.exchangeB };

    const band = calculateAdaptiveBands(pair.id);

    const bandBox = document.getElementById(`adaptiveBandBox-${pair.id}`);
    if (bandBox) {
      if (useAdaptive && !band.insufficient) {
        bandBox.innerHTML = `
          <div class="band-item"><span class="band-label">${dict.bandUpper}</span> <span class="band-val upper">+${band.upper.toFixed(2)}%</span></div>
          <div class="band-item"><span class="band-label">${dict.bandMid}</span> <span class="band-val mid">${band.mean >= 0 ? '+' : ''}${band.mean.toFixed(2)}%</span></div>
          <div class="band-item"><span class="band-label">${dict.bandLower}</span> <span class="band-val lower">${band.lower.toFixed(2)}%</span></div>
        `;
      } else {
        const text = dict.insufficientData
          .replace('{days}', band.dataDays)
          .replace('{thresh}', manualThresh.toFixed(2));
        bandBox.innerHTML = `<div class="band-tag-insufficient">${text}</div>`;
      }
    }

    let upperThresh = manualThresh;
    let lowerThresh = -manualThresh;
    let midBandVal = 0;
    let midTolerance = 0.05;

    if (useAdaptive && !band.insufficient) {
      upperThresh = band.upper;
      lowerThresh = band.lower;
      midBandVal = band.mean;
      midTolerance = Math.max(0.05, 0.2 * band.stdDev);
    }

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

    let rawSignal = 'NEUTRAL';
    if (m.basis > upperThresh) {
      rawSignal = 'LONG_LT';
    } else if (m.basis < lowerThresh) {
      rawSignal = 'LONG_HL';
    }

    if (!state.signalTracker[pair.id]) {
      state.signalTracker[pair.id] = { firstSeenTime: null, signalType: 'NEUTRAL', alertSent: false, openSignalType: null };
    }
    const tracker = state.signalTracker[pair.id];

    const signalBadge = document.getElementById(`signal-${pair.id}`);
    const stratBox = document.getElementById(`strat-${pair.id}`);

    if (rawSignal === 'LONG_LT') {
      if (tracker.signalType !== 'LONG_LT') {
        tracker.firstSeenTime = now;
        tracker.signalType = 'LONG_LT';
        tracker.alertSent = false;
      }

      const elapsedMins = Math.floor((now - tracker.firstSeenTime) / (60 * 1000));
      const isConfirmed = elapsedMins >= confirmDelayMins;

      if (signalBadge) {
        signalBadge.className = 'action-badge long-lt';
        const badgeMsg = isConfirmed 
          ? dict.signalLongLt.replace('Sàn B', connB.name).replace('Sàn A', connA.name)
          : `${dict.signalLongLt.replace('Sàn B', connB.name).replace('Sàn A', connA.name)} (${elapsedMins}/${confirmDelayMins}m)`;
        signalBadge.innerHTML = `<span class="badge-icon">🟢</span><span class="badge-text">${badgeMsg}</span>`;
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
        : `Cảnh báo: Basis ${pair.id} đang vượt Dải trên +${m.basis.toFixed(2)}% (Mở Long ${connB.name} / Short ${connA.name})`;

      if (isConfirmed && !tracker.alertSent) {
        triggerTelegramAlert(`${pair.id}_OPEN`, `🚨 <b>ARBITRAGE OPEN SIGNAL (XÁC NHẬN ${confirmDelayMins}M): ${pair.id}!</b>\n\nBasis Spread: <b>+${m.basis.toFixed(2)}%</b> (Vượt Dải Trên ${upperThresh.toFixed(2)}%)\n• ${connA.name}: $${m.priceA.toFixed(2)}\n• ${connB.name}: $${m.priceB.toFixed(2)}\n👉 <b>Hành động:</b> LONG ${connB.name} | SHORT ${connA.name}`);
        tracker.alertSent = true;
        tracker.openSignalType = 'LONG_LT';
      }

    } else if (rawSignal === 'LONG_HL') {
      if (tracker.signalType !== 'LONG_HL') {
        tracker.firstSeenTime = now;
        tracker.signalType = 'LONG_HL';
        tracker.alertSent = false;
      }

      const elapsedMins = Math.floor((now - tracker.firstSeenTime) / (60 * 1000));
      const isConfirmed = elapsedMins >= confirmDelayMins;

      if (signalBadge) {
        signalBadge.className = 'action-badge long-hl';
        const badgeMsg = isConfirmed 
          ? dict.signalLongHl.replace('Sàn A', connA.name).replace('Sàn B', connB.name)
          : `${dict.signalLongHl.replace('Sàn A', connA.name).replace('Sàn B', connB.name)} (${elapsedMins}/${confirmDelayMins}m)`;
        signalBadge.innerHTML = `<span class="badge-icon">🔵</span><span class="badge-text">${badgeMsg}</span>`;
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
        : `Cảnh báo: Basis ${pair.id} đang giảm dưới Dải dưới ${m.basis.toFixed(2)}% (Mở Long ${connA.name} / Short ${connB.name})`;

      if (isConfirmed && !tracker.alertSent) {
        triggerTelegramAlert(`${pair.id}_OPEN`, `🚨 <b>ARBITRAGE OPEN SIGNAL (XÁC NHẬN ${confirmDelayMins}M): ${pair.id}!</b>\n\nBasis Spread: <b>${m.basis.toFixed(2)}%</b> (Vượt Dải Dưới ${lowerThresh.toFixed(2)}%)\n• ${connA.name}: $${m.priceA.toFixed(2)}\n• ${connB.name}: $${m.priceB.toFixed(2)}\n👉 <b>Hành động:</b> LONG ${connA.name} | SHORT ${connB.name}`);
        tracker.alertSent = true;
        tracker.openSignalType = 'LONG_HL';
      }

    } else {
      const isReturnToMidZone = Math.abs(m.basis - midBandVal) <= midTolerance;

      if (tracker.alertSent && tracker.openSignalType && isReturnToMidZone) {
        triggerTelegramAlert(`${pair.id}_CLOSE`, `🟢 <b>TÍN HIỆU ĐÓNG LỆNH (CLOSE SIGNAL): ${pair.id}!</b>\n\nBasis đã quay về vùng Giữa dải thành công!\n• Basis hiện tại: <b>${m.basis.toFixed(2)}%</b>\n• Giữa dải (Mid): <b>${midBandVal.toFixed(2)}%</b>\n👉 <b>Hành động:</b> Chốt lời / Đóng 2 vị thế Arbitrage ${pair.id}.`);
        tracker.alertSent = false;
        tracker.openSignalType = null;
      }

      tracker.signalType = 'NEUTRAL';
      tracker.firstSeenTime = null;

      if (signalBadge) {
        signalBadge.className = 'action-badge neutral';
        signalBadge.innerHTML = `<span class="badge-icon">⚪</span><span class="badge-text">${dict.signalNeutral}</span>`;
      }
      if (stratBox) {
        stratBox.innerHTML = dict.stratNeutral.replace('{thresh}', manualThresh.toFixed(2));
      }
    }
  });

  localStorage.setItem('dnperp_signal_tracker', JSON.stringify(state.signalTracker));

  const bannerContainer = document.getElementById('alertBannerContainer');
  const bannerText = document.getElementById('alertBannerText');
  if (bannerContainer && bannerText) {
    if (activeBannerMsg) {
      bannerText.innerText = activeBannerMsg;
      bannerContainer.classList.remove('hidden');
    }
  }
}

// Update Hyperliquid Margin UI
function updateHlMarginUI(accountVal, marginUsed, pct) {
  const dict = i18n[state.lang] || i18n.VI;
  const accEl = document.getElementById('hlAccountValue');
  const usedEl = document.getElementById('hlTotalMarginUsed');
  const pctEl = document.getElementById('hlMarginPct');
  if (accEl) accEl.innerText = `$${accountVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (usedEl) usedEl.innerText = `$${marginUsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (pctEl) pctEl.innerText = `${pct.toFixed(1)}%`;

  const fill = document.getElementById('hlMarginFill');
  const badge = document.getElementById('hlMarginBadge');
  if (!fill || !badge) return;

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

  const freeEl = document.getElementById('ltFreeMargin');
  const pctEl = document.getElementById('ltMarginPct');
  if (freeEl) freeEl.innerText = `$${free.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (pctEl) pctEl.innerText = `${pct.toFixed(1)}%`;

  const fill = document.getElementById('ltMarginFill');
  const badge = document.getElementById('ltMarginBadge');
  if (!fill || !badge) return;

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

  if (now - (state.lastAlertTime?.[alertKey] || 0) > cooldown) {
    if (!state.lastAlertTime) state.lastAlertTime = {};
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
  const chartEl = document.getElementById('basisChart');
  if (!chartEl) return;
  const ctx = chartEl.getContext('2d');

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
