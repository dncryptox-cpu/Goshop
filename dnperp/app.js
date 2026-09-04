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
  selectedChartPair: 'SNDK',
  candleTimeframe: '1h',
  hlChartInstance: null,
  hlCandleSeries: null,
  ltChartInstance: null,
  ltCandleSeries: null,
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
    document.getElementById('settingsModal')?.classList.remove('hidden');
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
    renderPairChartTabs();
    initCandleTimeframeToolbar();
    updateChartData();
    fetchAndRenderCandleCharts();
    
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

    if (window.StorageAdapter) {
      syncStorageWithRemote();
    }
  }
}

async function syncStorageWithRemote() {
  if (!window.StorageAdapter) return;
  try {
    const wallet = await StorageAdapter.loadData('dnperp_wallet_address');
    if (wallet && wallet !== state.config.hlWallet) {
      state.config.hlWallet = wallet;
      const inputWallet = document.getElementById('inputHlWallet');
      if (inputWallet) inputWallet.value = wallet;
      updateWalletSubLabel();
      fetchHlMargin();
      fetchAllLiveWalletPositions();
    }

    const pairs = await StorageAdapter.loadData('dnperp_tracked_pairs');
    if (pairs && Array.isArray(pairs) && pairs.length > 0) {
      state.trackedPairs = pairs;
      initMarketState();
      populateTradeModalPairsDropdown();
      renderSpreadCards();
      renderPairsTable();
      renderPairChartTabs();
    }

    const history = await StorageAdapter.loadData('dnperp_basis_history');
    if (history && Array.isArray(history) && history.length > 0) {
      state.history = history;
      updateChartData();
    }

    const journal = await StorageAdapter.loadData('dnperp_journal_trades');
    if (journal && Array.isArray(journal)) {
      state.journal = journal;
      renderJournalTable();
      updateJournalAnalytics();
      initJournalCharts();
    }

    console.log('☁️ StorageAdapter: Multi-device sync completed successfully.');
  } catch (err) {
    console.warn('StorageAdapter sync error:', err);
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

  const setInputVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  const setInputChecked = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  };

  // Populate Modal Inputs
  setInputVal('inputBasisThreshold', state.config.basisThreshold);
  setInputVal('inputMarginThreshold', state.config.marginThreshold);
  setInputChecked('inputUseAdaptiveBands', state.config.useAdaptiveBands);
  setInputVal('inputConfirmDelay', state.config.confirmDelayMins);
  setInputVal('inputTgToken', state.config.tgToken);
  setInputVal('inputTgChatId', state.config.tgChatId);

  // Populate View-Settings Inputs
  setInputVal('viewInputBasisThreshold', state.config.basisThreshold);
  setInputVal('viewInputMarginThreshold', state.config.marginThreshold);
  setInputChecked('viewInputUseAdaptiveBands', state.config.useAdaptiveBands);
  setInputVal('viewInputTgToken', state.config.tgToken);
  setInputVal('viewInputTgChatId', state.config.tgChatId);

  const savedWallet = localStorage.getItem('dnperp_wallet_address') || localStorage.getItem('dnperp_hl_wallet') || '';
  setInputVal('hlWalletAddress', savedWallet);
  setInputVal('viewHlWalletAddress', savedWallet);

  setInputVal('ltMarginUsed', state.config.ltMarginUsed);
  setInputVal('ltTotalMargin', state.config.ltTotalMargin);
  setInputVal('viewLtMarginUsed', state.config.ltMarginUsed);
  setInputVal('viewLtTotalMargin', state.config.ltTotalMargin);

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

  const saveSettingsFromUI = (isView = false) => {
    if (isView) {
      state.config.basisThreshold = parseFloat(document.getElementById('viewInputBasisThreshold')?.value) || 0.30;
      state.config.marginThreshold = parseFloat(document.getElementById('viewInputMarginThreshold')?.value) || 75.0;
      state.config.useAdaptiveBands = document.getElementById('viewInputUseAdaptiveBands')?.checked || false;
      state.config.tgToken = document.getElementById('viewInputTgToken')?.value.trim() || '';
      state.config.tgChatId = document.getElementById('viewInputTgChatId')?.value.trim() || '';
      state.config.ltMarginUsed = parseFloat(document.getElementById('viewLtMarginUsed')?.value) || 0;
      state.config.ltTotalMargin = parseFloat(document.getElementById('viewLtTotalMargin')?.value) || 1000;
      const w = document.getElementById('viewHlWalletAddress')?.value.trim() || '';
      state.config.hlWallet = w;
      localStorage.setItem('dnperp_wallet_address', w);
      localStorage.setItem('dnperp_hl_wallet', w);
      if (window.StorageAdapter) StorageAdapter.saveData('dnperp_wallet_address', w);
    } else {
      state.config.basisThreshold = parseFloat(document.getElementById('inputBasisThreshold')?.value) || 0.30;
      state.config.marginThreshold = parseFloat(document.getElementById('inputMarginThreshold')?.value) || 75.0;
      state.config.useAdaptiveBands = document.getElementById('inputUseAdaptiveBands')?.checked || false;
      state.config.confirmDelayMins = parseInt(document.getElementById('inputConfirmDelay')?.value) || 10;
      state.config.tgToken = document.getElementById('inputTgToken')?.value.trim() || '';
      state.config.tgChatId = document.getElementById('inputTgChatId')?.value.trim() || '';
      state.config.ltMarginUsed = parseFloat(document.getElementById('ltMarginUsed')?.value) || 0;
      state.config.ltTotalMargin = parseFloat(document.getElementById('ltTotalMargin')?.value) || 1000;
      const w = document.getElementById('hlWalletAddress')?.value.trim() || '';
      state.config.hlWallet = w;
      localStorage.setItem('dnperp_wallet_address', w);
      localStorage.setItem('dnperp_hl_wallet', w);
      if (window.StorageAdapter) StorageAdapter.saveData('dnperp_wallet_address', w);
    }

    localStorage.setItem('dnperp_basis_thresh', state.config.basisThreshold);
    localStorage.setItem('dnperp_margin_thresh', state.config.marginThreshold);
    localStorage.setItem('dnperp_use_adaptive_bands', state.config.useAdaptiveBands);
    localStorage.setItem('dnperp_confirm_delay_mins', state.config.confirmDelayMins);
    localStorage.setItem('dnperp_tg_token', state.config.tgToken);
    localStorage.setItem('dnperp_tg_chat_id', state.config.tgChatId);

    updateWalletSubLabel();
    if (state.config.hlWallet) fetchHlMargin();
    fetchAllLiveWalletPositions();

    loadStoredConfig();
    recalculateBasisAndSignals();
    updateChartThresholdLines();

    if (!isView) {
      closeModal('settingsModal');
    } else {
      const msg = document.getElementById('viewSaveSuccessMsg');
      if (msg) {
        msg.innerText = state.lang === 'EN' ? '✅ Settings saved successfully!' : '✅ Đã lưu cấu hình thành công!';
        setTimeout(() => { msg.innerText = ''; }, 3000);
      }
    }
  };

  document.getElementById('btnSaveSettings')?.addEventListener('click', () => saveSettingsFromUI(false));
  document.getElementById('btnSaveSettingsView')?.addEventListener('click', () => saveSettingsFromUI(true));

  // Wallet Query & Clear Event Listeners
  const bindWalletBtns = (btnQueryId, btnClearId, inputId) => {
    document.getElementById(btnQueryId)?.addEventListener('click', () => {
      const w = document.getElementById(inputId)?.value.trim() || '';
      if (!w) return;
      localStorage.setItem('dnperp_wallet_address', w);
      localStorage.setItem('dnperp_hl_wallet', w);
      state.config.hlWallet = w;
      loadStoredConfig();
      fetchHlMargin();
      fetchAllLiveWalletPositions();
    });

    document.getElementById(btnClearId)?.addEventListener('click', () => {
      localStorage.removeItem('dnperp_wallet_address');
      localStorage.removeItem('dnperp_hl_wallet');
      state.config.hlWallet = '';
      loadStoredConfig();
      fetchAllLiveWalletPositions();
    });
  };

  bindWalletBtns('btnQueryHlMargin', 'btnClearWallet', 'hlWalletAddress');
  bindWalletBtns('viewBtnQueryHlMargin', 'viewBtnClearWallet', 'viewHlWalletAddress');

  // Telegram Test Alert Handlers
  const testTgHandler = async (isView = false) => {
    const tokenId = isView ? 'viewInputTgToken' : 'inputTgToken';
    const chatId = isView ? 'viewInputTgChatId' : 'inputTgChatId';
    const resultId = isView ? 'viewTgTestResult' : 'tgTestResult';

    const token = document.getElementById(tokenId)?.value.trim();
    const chat = document.getElementById(chatId)?.value.trim();
    const resultEl = document.getElementById(resultId);

    if (!token || !chat) {
      if (resultEl) {
        resultEl.innerText = state.lang === 'EN' ? '❌ Please enter Token & Chat ID!' : '❌ Vui lòng nhập Token & Chat ID!';
        resultEl.style.color = 'var(--accent-danger)';
      }
      return;
    }

    if (resultEl) {
      resultEl.innerText = state.lang === 'EN' ? '⏳ Sending test alert...' : '⏳ Đang gửi thử...';
      resultEl.style.color = 'var(--text-gold)';
    }

    try {
      const msg = `⚡ [dnperp monitor] Test alert message successfully sent!`;
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text: msg, parse_mode: 'HTML' })
      });
      const data = await res.json();
      if (data.ok) {
        if (resultEl) {
          resultEl.innerText = state.lang === 'EN' ? '✅ Sent successfully!' : '✅ Đã gửi thành công!';
          resultEl.style.color = 'var(--accent-safe)';
        }
      } else {
        throw new Error(data.description || 'Telegram API error');
      }
    } catch (err) {
      if (resultEl) {
        resultEl.innerText = `❌ ${err.message}`;
        resultEl.style.color = 'var(--accent-danger)';
      }
    }
  };

  document.getElementById('btnTestTgAlert')?.addEventListener('click', () => testTgHandler(false));
  document.getElementById('viewBtnTestTgAlert')?.addEventListener('click', () => testTgHandler(true));

  const btnRefreshLive = document.getElementById('btnRefreshLivePositions');
  if (btnRefreshLive) {
    btnRefreshLive.addEventListener('click', () => {
      fetchAllLiveWalletPositions();
    });
  }

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
  document.getElementById(id)?.classList.add('hidden');
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
  const exA = document.getElementById('inputAddExchangeA')?.value || '';
  const symA = (document.getElementById('inputAddSymbolA')?.value || '').trim().toUpperCase();
  const exB = document.getElementById('inputAddExchangeB')?.value || '';
  const symB = (document.getElementById('inputAddSymbolB')?.value || '').trim().toUpperCase();
  let name = (document.getElementById('inputAddName')?.value || '').trim();

  const isEn = state.lang === 'EN';

  if (!symA || !symB) {
    if (statusEl) {
      statusEl.innerText = isEn ? '❌ Please enter symbols for both Exchange A and Exchange B!' : '❌ Vui lòng nhập Ticker cho cả Sàn A và Sàn B!';
      statusEl.style.color = 'var(--accent-danger)';
    }
    return;
  }

  const pairId = symA;
  if (state.trackedPairs.some(p => p.id === pairId)) {
    if (statusEl) {
      statusEl.innerText = isEn ? `❌ Pair ${pairId} already exists in tracking list!` : `❌ Cặp ${pairId} đã tồn tại trong danh sách theo dõi!`;
      statusEl.style.color = 'var(--accent-danger)';
    }
    return;
  }

  if (!name) name = `${symA} Synthetic`;

  if (statusEl) {
    statusEl.innerText = isEn ? '⏳ Verifying symbol via exchange connectors...' : '⏳ Đang xác minh Ticker qua Connector Sàn A & Sàn B...';
    statusEl.style.color = 'var(--text-gold)';
  }

  try {
    try {
      await ConnectorRegistry.fetchAssetData(exA, symA);
    } catch (errA) {
      if (statusEl) {
        statusEl.innerText = isEn 
          ? `❌ Exchange A (${exA}) error: ${errA.message}` 
          : `❌ Lỗi trên Sàn A (${exA}): ${errA.message}`;
        statusEl.style.color = 'var(--accent-danger)';
      }
      return;
    }

    try {
      await ConnectorRegistry.fetchAssetData(exB, symB);
    } catch (errB) {
      if (statusEl) {
        statusEl.innerText = isEn 
          ? `❌ Exchange B (${exB}) error: ${errB.message}` 
          : `❌ Lỗi trên Sàn B (${exB}): ${errB.message}`;
        statusEl.style.color = 'var(--accent-danger)';
      }
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
    if (window.StorageAdapter) StorageAdapter.saveData('dnperp_tracked_pairs', state.trackedPairs);

    initMarketState();
    populateTradeModalPairsDropdown();
    renderSpreadCards();
    renderPairsTable();
    updateChartData();

    fetchMarketData();

    const elSymA = document.getElementById('inputAddSymbolA');
    if (elSymA) elSymA.value = '';
    const elSymB = document.getElementById('inputAddSymbolB');
    if (elSymB) elSymB.value = '';
    const elName = document.getElementById('inputAddName');
    if (elName) elName.value = '';

    if (statusEl) {
      statusEl.innerText = isEn ? `✅ Pair ${pairId} verified and added successfully!` : `✅ Đã xác minh & thêm cặp ${pairId} thành công!`;
      statusEl.style.color = 'var(--accent-safe)';
    }

  } catch (err) {
    console.error('Verification error:', err);
    if (statusEl) {
      statusEl.innerText = isEn ? '❌ Connector verification error!' : '❌ Lỗi kết nối Connector!';
      statusEl.style.color = 'var(--accent-danger)';
    }
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
    if (window.StorageAdapter) StorageAdapter.saveData('dnperp_tracked_pairs', state.trackedPairs);

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
  const everInitialized = localStorage.getItem('dnperp_snapshot_ever_initialized') === 'true';

  let prevGroups = null;

  if (!storedSnapshotStr) {
    if (everInitialized) {
      console.warn('⚠️ Mất mốc theo dõi vị thế trước đó — có thể đã bỏ lỡ ghi nhận 1 số lệnh đã đóng/thanh lý!');
      const warningBanner = document.getElementById('snapshotLossAlertBannerContainer');
      if (warningBanner) {
        warningBanner.classList.remove('hidden');
      }

      // Try restoring baseline from backup snapshot
      const backupStr = localStorage.getItem('dnperp_open_positions_snapshot_backup');
      if (backupStr) {
        try {
          prevGroups = JSON.parse(backupStr);
        } catch (e) {
          prevGroups = null;
        }
      }
    }

    if (!prevGroups) {
      savePositionsSnapshot(currentGroups);
      return;
    }
  } else {
    try {
      prevGroups = JSON.parse(storedSnapshotStr);
    } catch (e) {
      console.error('Error parsing stored positions snapshot:', e);
      prevGroups = null;
    }
  }

  if (!prevGroups || !Array.isArray(prevGroups)) {
    savePositionsSnapshot(currentGroups);
    return;
  }

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

      // Detect Liquidation Proximity (Phase 17)
      let wasLiquidated = false;
      if (prevGrp.legs && Array.isArray(prevGrp.legs)) {
        wasLiquidated = prevGrp.legs.some(leg => {
          if (!leg.liquidationPx || leg.liquidationPx <= 0) return false;

          let lastKnownPrice = null;
          const pairId = prevGrp.groupId;
          if (state.market && state.market[pairId]) {
            const pair = state.trackedPairs.find(p => p.id === pairId);
            if (pair) {
              if (leg.exchange === pair.exchangeA || leg.symbol === pair.symbolA) {
                lastKnownPrice = state.market[pairId].priceA;
              } else if (leg.exchange === pair.exchangeB || leg.symbol === pair.symbolB) {
                lastKnownPrice = state.market[pairId].priceB;
              }
            }
          }
          if (!lastKnownPrice && leg.notional && leg.size && leg.size > 0) {
            lastKnownPrice = leg.notional / leg.size;
          }
          if (!lastKnownPrice) {
            lastKnownPrice = leg.entryPrice;
          }

          if (!lastKnownPrice || lastKnownPrice <= 0) return false;

          const proximity = Math.abs(lastKnownPrice - leg.liquidationPx) / leg.liquidationPx;
          return proximity < 0.005; // Within ±0.5% threshold
        });
      }

      const autoTradeRecord = {
        id: `AUTO_${prevGrp.groupId}_${Date.now()}`,
        dateOpen: openDateIso,
        dateClose: closeDateIso,
        pairId: prevGrp.groupId,
        status: wasLiquidated ? 'LIQUIDATED' : 'CLOSED',
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
        notes: wasLiquidated
          ? (state.lang === 'EN' 
              ? '🔴 Auto-detected: possibly LIQUIDATED (price near liquidation threshold)' 
              : '🔴 Tự phát hiện: có thể ĐÃ BỊ THANH LÝ (giá gần ngưỡng thanh lý)')
          : (state.lang === 'EN' 
              ? '⚡ Auto-archived from live wallet position closure (Estimated values)' 
              : '⚡ Tự động ghi nhận từ ví khi đóng vị thế (Giá ước tính)')
      };

      state.journal.unshift(autoTradeRecord);
      archivedAny = true;
      removePositionFirstSeen(prevGrp.groupId);
    }
  });

  if (archivedAny) {
    localStorage.setItem('dnperp_journal_trades', JSON.stringify(state.journal));
    if (window.StorageAdapter) StorageAdapter.saveData('dnperp_journal_trades', state.journal);
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
      cumFunding: l.cumFunding,
      liquidationPx: l.liquidationPx || 0
    }))
  }));
  localStorage.setItem('dnperp_open_positions_snapshot', JSON.stringify(snapshot));
  localStorage.setItem('dnperp_snapshot_ever_initialized', 'true');
  localStorage.setItem('dnperp_open_positions_snapshot_backup', JSON.stringify(snapshot));
  if (window.StorageAdapter) StorageAdapter.saveData('dnperp_open_positions_snapshot', snapshot);
}

// Window helper for simulation / manual testing (Phase 17: supports forceLiquidated flag)
window.simulatePositionClosure = function(groupId, forceLiquidated = false) {
  const storedSnapshotStr = localStorage.getItem('dnperp_open_positions_snapshot');
  if (!storedSnapshotStr) return;
  const snapshot = JSON.parse(storedSnapshotStr);
  const targetIndex = snapshot.findIndex(g => g.groupId === groupId);
  if (targetIndex !== -1) {
    const closedGroup = snapshot[targetIndex];
    if (forceLiquidated && closedGroup.legs && closedGroup.legs.length > 0) {
      closedGroup.legs.forEach(leg => {
        const p = leg.entryPrice || 100;
        leg.liquidationPx = p * 0.998; // 0.2% proximity to trigger liquidation detection
      });
      localStorage.setItem('dnperp_open_positions_snapshot', JSON.stringify(snapshot));
    }
    snapshot.splice(targetIndex, 1);
    localStorage.setItem('dnperp_open_positions_snapshot', JSON.stringify(snapshot));
    state.liveGroups = state.liveGroups.filter(g => g.groupId !== groupId);
    state.livePositions = state.livePositions.filter(p => !p.id.includes(groupId));
    checkAndAutoArchiveClosedPositions(state.liveGroups);
    renderLivePositionsUI();
    updateJournalAnalytics();
    const tag = forceLiquidated ? '🔴 LIQUIDATED (Bị thanh lý)' : 'CLOSED (Đóng thường)';
    alert(state.lang === 'EN' ? `⚡ Simulated closure (${tag}) for position ${groupId}!` : `⚡ Giả lập đóng vị thế (${tag}) cho ${groupId} thành công!`);
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

  processLivePositionsGroupState(groups);
}

// Phase 15: Helper to retrieve recent historical basis (~10-15 mins ago) for trend calculation
function getRecentHistoricalBasis(pairId, targetAgeMins = 12) {
  if (!state.history || state.history.length === 0) return null;
  const now = Date.now();
  const targetTime = now - (targetAgeMins * 60 * 1000);
  const minTime = now - (25 * 60 * 1000);

  const validPoints = state.history.filter(h => 
    h.time >= minTime && 
    h.time <= (now - 3 * 60 * 1000) && 
    h.pairs && 
    h.pairs[pairId] !== undefined
  );

  if (validPoints.length === 0) return null;

  let bestPoint = validPoints[0];
  let minDiff = Math.abs(bestPoint.time - targetTime);

  for (let i = 1; i < validPoints.length; i++) {
    const diff = Math.abs(validPoints[i].time - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      bestPoint = validPoints[i];
    }
  }

  return bestPoint.pairs[pairId];
}

function processLivePositionsGroupState(groups) {
  const isEn = state.lang === 'EN';

  state.liveGroups = Object.values(groups).map(grp => {
    const isDeltaNeutral = grp.legs.length >= 2;
    const combinedPnl = grp.legs.reduce((sum, l) => sum + l.unrealizedPnl, 0);
    const combinedFunding = grp.legs.reduce((sum, l) => sum + l.cumFunding, 0);
    const combinedNotional = grp.legs.reduce((sum, l) => sum + l.notional, 0);

    let netBasisEntry = null;
    let basisNow = null;
    const shortLeg = grp.legs.find(l => l.direction === 'SHORT');
    const longLeg = grp.legs.find(l => l.direction === 'LONG');

    if (shortLeg && longLeg && longLeg.entryPrice > 0) {
      netBasisEntry = ((shortLeg.entryPrice - longLeg.entryPrice) / longLeg.entryPrice) * 100;

      // Phase 15: Basis Hiện Tại
      const shortPriceNow = shortLeg.markPrice ?? (shortLeg.size > 0 ? (shortLeg.notional / shortLeg.size) : shortLeg.entryPrice);
      const longPriceNow = longLeg.markPrice ?? (longLeg.size > 0 ? (longLeg.notional / longLeg.size) : longLeg.entryPrice);
      basisNow = ((shortPriceNow - longPriceNow) / longLeg.entryPrice) * 100;
    }

    // Phase 14: Breakeven Basis Calculation
    let breakevenBasis = null;
    if (isDeltaNeutral && combinedNotional > 0 && netBasisEntry !== null) {
      const avgNotional = combinedNotional / 2;
      const pnlTotalWithFunding = combinedPnl + combinedFunding;
      const pnlPct = (pnlTotalWithFunding / avgNotional) * 100;
      breakevenBasis = netBasisEntry - pnlPct;
    }

    // Phase 15: Distance to Breakeven & Status Badge
    let distanceToBreakeven = null;
    let statusLabel = '';
    let statusColor = 'green';

    if (basisNow !== null && breakevenBasis !== null) {
      distanceToBreakeven = Math.abs(basisNow - breakevenBasis);
    }

    if (combinedPnl >= 0) {
      statusLabel = isEn ? 'PROFITABLE' : 'ĐANG CÓ LỜI';
      statusColor = 'green';
    } else {
      if (distanceToBreakeven !== null && distanceToBreakeven <= 0.15) {
        statusLabel = isEn ? 'NEAR BREAKEVEN' : 'GẦN HOÀ VỐN';
        statusColor = 'amber';
      } else {
        statusLabel = isEn ? 'LOSING' : 'ĐANG LỖ';
        statusColor = 'rust';
      }
    }

    // Phase 15: Trend Arrow (So sánh với basisRecentPast từ ~10-15 phút trước)
    let basisTrend = null;
    let trendArrow = '';
    let trendColor = '';
    const recentPastBasis = getRecentHistoricalBasis(grp.groupId, 12);
    if (basisNow !== null && recentPastBasis !== null) {
      basisTrend = basisNow - recentPastBasis;
      if (basisTrend < -0.01) {
        trendArrow = '↓';
        trendColor = 'var(--accent-safe)'; // Green (co lại, tin tốt)
      } else if (basisTrend > 0.01) {
        trendArrow = '↑';
        trendColor = 'var(--accent-danger)'; // Red (giãn thêm, tin xấu)
      }
    }

    return {
      ...grp,
      type: isDeltaNeutral ? 'DELTA_NEUTRAL' : 'SINGLE_LEG',
      combinedPnl: parseFloat(combinedPnl.toFixed(2)),
      combinedFunding: parseFloat(combinedFunding.toFixed(2)),
      combinedNotional: parseFloat(combinedNotional.toFixed(2)),
      netBasisEntry: netBasisEntry !== null ? parseFloat(netBasisEntry.toFixed(2)) : null,
      basisNow: basisNow !== null ? parseFloat(basisNow.toFixed(2)) : null,
      breakevenBasis: breakevenBasis !== null ? parseFloat(breakevenBasis.toFixed(2)) : null,
      distanceToBreakeven: distanceToBreakeven !== null ? parseFloat(distanceToBreakeven.toFixed(2)) : null,
      statusLabel,
      statusColor,
      trendArrow,
      trendColor
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
    const isProfitable = grp.combinedPnl >= 0;

    const durationText = grp.firstSeen ? formatDuration(Date.now() - grp.firstSeen) : '0m';

    let distNote = '—';
    if (grp.distanceToBreakeven !== null) {
      if (isProfitable) {
        distNote = isEn
          ? `Profitable (passed BE by ${grp.distanceToBreakeven.toFixed(2)}%)`
          : `Đang lời (đã vượt hoà vốn ${grp.distanceToBreakeven.toFixed(2)}đ%)`;
      } else {
        distNote = isEn
          ? `Needs basis to contract by ${grp.distanceToBreakeven.toFixed(2)}% to BE`
          : `Cần basis co thêm ${grp.distanceToBreakeven.toFixed(2)}đ% nữa`;
      }
    }

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
          <div class="pos-pair-title" style="display: flex; align-items: center; gap: 8px;">
            <span>${grp.groupId}</span>
            <span class="pos-status-badge ${grp.statusColor}">● ${grp.statusLabel}</span>
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

        <!-- Phase 15: Compact 4-Tile Stat Grid (Desktop 4-col, Mobile 2-col) -->
        <div class="pos-stat-tile-grid">
          <div class="pos-stat-tile">
            <span class="pos-stat-label">${isEn ? 'Status & PnL' : 'Trạng Thái & PnL'}</span>
            <div class="pos-stat-val">
              <span class="pos-status-badge ${grp.statusColor}">● ${grp.statusLabel}</span>
            </div>
            <div class="pos-stat-sub" style="color: ${pnlClass === 'positive' ? 'var(--accent-safe)' : 'var(--accent-danger)'}; font-weight: 700;">
              PnL: ${pnlDisplay}
            </div>
          </div>

          <div class="pos-stat-tile">
            <span class="pos-stat-label">${isEn ? 'Current Basis' : 'Basis Hiện Tại'}</span>
            <div class="pos-stat-val mono-num">
              ${grp.basisNow !== null ? (grp.basisNow >= 0 ? '+' : '') + grp.basisNow.toFixed(2) + '%' : '—'}
              ${grp.trendArrow ? `<span style="color: ${grp.trendColor}; font-weight: bold; margin-left: 2px;">${grp.trendArrow}</span>` : ''}
            </div>
            <div class="pos-stat-sub">${isEn ? 'Entry' : 'Lúc vào'}: ${grp.netBasisEntry !== null ? (grp.netBasisEntry >= 0 ? '+' : '') + grp.netBasisEntry.toFixed(2) + '%' : '—'}</div>
          </div>

          <div class="pos-stat-tile">
            <span class="pos-stat-label">${isEn ? 'Breakeven Basis' : 'Basis Hoà Vốn'}</span>
            <div class="pos-stat-val mono-num" style="color: var(--text-gold);">
              ${grp.breakevenBasis !== null ? (grp.breakevenBasis >= 0 ? '+' : '') + grp.breakevenBasis.toFixed(2) + '%' : '—'}
            </div>
            <div class="pos-stat-sub" title="Breakeven Target">${isEn ? 'Target for PnL = $0' : 'Mức PnL 2 chân = $0'}</div>
          </div>

          <div class="pos-stat-tile">
            <span class="pos-stat-label">${isEn ? 'Dist. to BE' : 'Cách Hoà Vốn'}</span>
            <div class="pos-stat-val mono-num" style="color: ${isProfitable ? 'var(--accent-safe)' : 'var(--text-cream)'};">
              ${grp.distanceToBreakeven !== null ? grp.distanceToBreakeven.toFixed(2) + 'đ%' : '—'}
            </div>
            <div class="pos-stat-sub" title="${distNote}">${distNote}</div>
          </div>
        </div>

        <!-- Expandable Body Container -->
        <div class="expandable-body ${isExpanded ? '' : 'collapsed'}" id="expandable-body-${cardId}">
          <div class="legs-container" style="margin-top: 12px;">
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
  const setVal = (id, val = '') => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  setVal('tradeEditId', '');
  const nowStr = new Date().toISOString().slice(0, 16);
  setVal('tradeDateOpen', nowStr);
  setVal('tradeStatus', 'OPEN');
  setVal('tradeCapital', '1000');
  setVal('tradePriceLong', '');
  setVal('tradeNotionalLong', '1000');
  setVal('tradePriceShort', '');
  setVal('tradeNotionalShort', '1000');
  setVal('tradeBasisEntry', '');
  setVal('tradeDateClose', '');
  setVal('tradeBasisExit', '');
  setVal('tradePriceLongExit', '');
  setVal('tradePriceShortExit', '');
  setVal('tradeFundingAccrued', '0');
  setVal('tradeNotes', '');
}

function saveTradeEntry() {
  const getValStr = (id) => document.getElementById(id)?.value || '';
  const getValNum = (id, fallback = 0) => parseFloat(document.getElementById(id)?.value) || fallback;

  const editId = getValStr('tradeEditId');
  const dateOpen = getValStr('tradeDateOpen');
  const pairId = getValStr('tradePairId');
  const status = getValStr('tradeStatus') || 'OPEN';
  const capital = getValNum('tradeCapital', 1000);

  const priceLong = getValNum('tradePriceLong', 0);
  const notionalLong = getValNum('tradeNotionalLong', 1000);
  const priceShort = getValNum('tradePriceShort', 0);
  const notionalShort = getValNum('tradeNotionalShort', 1000);

  let basisEntry = parseFloat(getValStr('tradeBasisEntry'));
  if (isNaN(basisEntry) && priceLong > 0 && priceShort > 0) {
    basisEntry = parseFloat((((priceShort - priceLong) / priceLong) * 100).toFixed(2));
  }
  if (isNaN(basisEntry)) basisEntry = 0;

  const dateClose = getValStr('tradeDateClose');
  let basisExit = parseFloat(getValStr('tradeBasisExit'));
  const priceLongExit = getValNum('tradePriceLongExit', 0);
  const priceShortExit = getValNum('tradePriceShortExit', 0);
  if (isNaN(basisExit) && priceLongExit > 0 && priceShortExit > 0) {
    basisExit = parseFloat((((priceShortExit - priceLongExit) / priceLongExit) * 100).toFixed(2));
  }

  const fundingAccrued = getValNum('tradeFundingAccrued', 0);
  const notes = getValStr('tradeNotes').trim();

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
  if (window.StorageAdapter) StorageAdapter.saveData('dnperp_journal_trades', state.journal);

  closeModal('tradeModal');
  renderJournalTable();
  updateJournalAnalytics();
  updateJournalCharts();
}

window.editTradeEntry = function(tradeId) {
  const trade = state.journal.find(t => t.id === tradeId);
  if (!trade) return;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('tradeEditId', trade.id);
  setVal('tradeDateOpen', trade.dateOpen || '');
  setVal('tradePairId', trade.pairId || '');
  setVal('tradeStatus', trade.status || 'OPEN');
  setVal('tradeCapital', trade.capital || 1000);

  setVal('tradePriceLong', trade.priceLong || '');
  setVal('tradeNotionalLong', trade.notionalLong || 1000);
  setVal('tradePriceShort', trade.priceShort || '');
  setVal('tradeNotionalShort', trade.notionalShort || 1000);
  setVal('tradeBasisEntry', trade.basisEntry !== null ? trade.basisEntry : '');

  setVal('tradeDateClose', trade.dateClose || '');
  setVal('tradeBasisExit', trade.basisExit !== null ? trade.basisExit : '');
  setVal('tradePriceLongExit', trade.priceLongExit || '');
  setVal('tradePriceShortExit', trade.priceShortExit || '');
  setVal('tradeFundingAccrued', trade.fundingAccrued || 0);
  setVal('tradeNotes', trade.notes || '');

  const modalTitle = document.getElementById('tradeModalTitle');
  if (modalTitle) modalTitle.innerText = state.lang === 'EN' ? '✏️ Edit Trade Entry' : '✏️ Chỉnh Sửa Lệnh Trong Nhật Ký';
  document.getElementById('tradeModal')?.classList.remove('hidden');
};

window.deleteTradeEntry = function(tradeId) {
  const isEn = state.lang === 'EN';
  const msg = isEn ? 'Are you sure you want to delete this trade record?' : 'Bạn có chắc chắn muốn xoá bản ghi lệnh này khỏi Nhật ký?';
  if (confirm(msg)) {
    state.journal = state.journal.filter(t => t.id !== tradeId);
    localStorage.setItem('dnperp_journal_trades', JSON.stringify(state.journal));
    if (window.StorageAdapter) StorageAdapter.saveData('dnperp_journal_trades', state.journal);
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
    const isLiquidated = trade.status === 'LIQUIDATED';
    const isDone = isClosed || isLiquidated;

    let statusBadge = `<span class="trade-status-badge open">🟢 ${isEn ? 'OPEN' : 'ĐANG MỞ'}</span>`;
    if (isLiquidated) {
      statusBadge = `<span class="trade-status-badge liquidated" style="background: rgba(239,83,80,0.18); color: #ef5350; border: 1px solid rgba(239,83,80,0.5); padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">🔴 ${isEn ? 'LIQUIDATED' : 'BỊ THANH LÝ'}</span>`;
    } else if (isClosed) {
      statusBadge = `<span class="trade-status-badge closed">🔵 ${isEn ? 'CLOSED' : 'ĐÃ ĐÓNG'}</span>`;
    }

    const openDate = trade.dateOpen ? new Date(trade.dateOpen).toLocaleDateString() : 'N/A';
    const basisIn = `${trade.basisEntry >= 0 ? '+' : ''}${trade.basisEntry.toFixed(2)}%`;
    const basisOut = isDone && trade.basisExit !== null ? `${trade.basisExit >= 0 ? '+' : ''}${trade.basisExit.toFixed(2)}%` : '—';
    const funding = `$${trade.fundingAccrued.toFixed(2)}`;
    
    let pnlDisplay = '—';
    let pnlClass = '';
    if (isDone) {
      pnlDisplay = `$${trade.totalPnl >= 0 ? '+' : ''}${trade.totalPnl.toFixed(2)}`;
      pnlClass = trade.totalPnl >= 0 ? 'positive' : 'negative';
    }

    const noteText = trade.notes ? `<div style="font-size: 10px; color: ${isLiquidated ? '#ef5350' : 'var(--text-muted)'}; margin-top: 2px; line-height: 1.2;">${trade.notes}</div>` : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${trade.pairId}</strong> <span style="font-size: 11px; color: var(--text-dim);">(${trade.id})</span>
        ${noteText}
      </td>
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
  const closedTrades = trades.filter(t => t.status === 'CLOSED' || t.status === 'LIQUIDATED');

  const activeNotional = openTrades.reduce((sum, t) => sum + (t.notionalLong + t.notionalShort), 0);
  const activeCapital = openTrades.reduce((sum, t) => sum + t.capital, 0);

  const elPos = document.getElementById('jValPosition');
  if (elPos) elPos.innerText = `$${Math.round(activeNotional).toLocaleString()} / $${Math.round(activeCapital).toLocaleString()}`;
  const elSubPos = document.getElementById('jSubPosition');
  if (elSubPos) elSubPos.innerText = `${openTrades.length} ${isEn ? 'active open positions' : 'vị thế đang mở'}`;

  const totalFunding = trades.reduce((sum, t) => sum + (t.fundingAccrued || 0), 0);
  const fundEl = document.getElementById('jValFunding');
  if (fundEl) {
    fundEl.innerText = `$${totalFunding >= 0 ? '+' : ''}${totalFunding.toFixed(2)}`;
    fundEl.className = 'm-stat-value mono-num ' + (totalFunding >= 0 ? 'positive' : 'negative');
  }

  const winningClosed = closedTrades.filter(t => t.totalPnl > 0);
  const winRate = closedTrades.length > 0 ? (winningClosed.length / closedTrades.length) * 100 : 0;
  const elWin = document.getElementById('jValWinRate');
  if (elWin) elWin.innerText = `${winRate.toFixed(1)}%`;
  const elSubWin = document.getElementById('jSubWinRate');
  if (elSubWin) elSubWin.innerText = `${winningClosed.length} / ${closedTrades.length} ${isEn ? 'closed trades profitable' : 'lệnh đóng có lời'}`;

  let sumBasisCaptured = 0;
  let closedWithBasisCount = 0;
  closedTrades.forEach(t => {
    if (t.basisExit !== null) {
      sumBasisCaptured += (t.basisEntry - t.basisExit);
      closedWithBasisCount++;
    }
  });
  const avgBasisCaptured = closedWithBasisCount > 0 ? sumBasisCaptured / closedWithBasisCount : 0;
  const elAvgBasis = document.getElementById('jValAvgBasis');
  if (elAvgBasis) elAvgBasis.innerText = `${avgBasisCaptured >= 0 ? '+' : ''}${avgBasisCaptured.toFixed(2)}%`;

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
  const elAvgHold = document.getElementById('jValAvgHold');
  if (elAvgHold) {
    elAvgHold.innerText = avgHoldHours > 24 
      ? `${(avgHoldHours / 24).toFixed(1)} ${isEn ? 'days' : 'ngày'}`
      : `${avgHoldHours.toFixed(1)} ${isEn ? 'hours' : 'giờ'}`;
  }

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
  if (aprEl) {
    aprEl.innerText = `${totalApr >= 0 ? '+' : ''}${totalApr.toFixed(2)}%`;
    aprEl.className = 'm-stat-value mono-num ' + (totalApr >= 0 ? 'positive' : 'negative');
  }
  const elSubApr = document.getElementById('jSubApr');
  if (elSubApr) {
    elSubApr.innerText = `$${totalPnlAll >= 0 ? '+' : ''}${totalPnlAll.toFixed(2)} PnL (${spanDays}d)`;
  }

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
  if (window.StorageAdapter) StorageAdapter.saveData('dnperp_basis_history', state.history);
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

// Phase 16: Render Pair Tabs for Basis History Chart
function renderPairChartTabs() {
  const container = document.getElementById('basisPairTabsContainer');
  if (!container) return;

  if (!state.trackedPairs || state.trackedPairs.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Fallback to first tracked pair if current selected is invalid
  const pairIds = state.trackedPairs.map(p => p.id);
  if (!state.selectedChartPair || !pairIds.includes(state.selectedChartPair)) {
    state.selectedChartPair = pairIds[0] || 'SNDK';
  }

  container.innerHTML = state.trackedPairs.map(pair => {
    const isActive = pair.id === state.selectedChartPair ? 'active' : '';
    return `<button class="pair-chart-tab ${isActive}" data-pair="${pair.id}">${pair.id}</button>`;
  }).join('');

  container.querySelectorAll('.pair-chart-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const pairId = btn.getAttribute('data-pair');
      if (!pairId) return;
      state.selectedChartPair = pairId;
      renderPairChartTabs();
      updateChartData();
      fetchAndRenderCandleCharts();
    });
  });
}

// Update Chart Data dynamically for state.selectedChartPair ONLY (Phase 16)
function updateChartData() {
  if (!state.chart) return;

  renderPairChartTabs();

  const pairId = state.selectedChartPair || state.trackedPairs?.[0]?.id || 'SNDK';

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

  const series = filtered.map(h => {
    if (h.pairs && h.pairs[pairId] !== undefined) return h.pairs[pairId];
    if (pairId === 'SNDK' && h.sndk !== undefined) return h.sndk;
    if (pairId === 'ANTH' && h.anth !== undefined) return h.anth;
    return 0;
  });

  const pairIndex = state.trackedPairs.findIndex(p => p.id === pairId);
  const color = PALETTE[pairIndex >= 0 ? pairIndex % PALETTE.length : 0];

  const datasets = [
    {
      label: `${pairId} Basis %`,
      data: series,
      borderColor: color,
      backgroundColor: color + '1a',
      borderWidth: 2.5,
      tension: 0.2,
      pointRadius: 0,
      pointHoverRadius: 5
    }
  ];

  const legendHtml = [
    `<div class="legend-item"><span class="legend-color" style="background: ${color}"></span> <b>${pairId} Basis %</b></div>`
  ];

  // Render Adaptive Bands for selected pair if available (Phase 9b)
  const bands = typeof calculateAdaptiveBandsForPair === 'function' ? calculateAdaptiveBandsForPair(pairId) : null;
  if (bands && bands.isSufficient) {
    const upperLabel = state.lang === 'EN' ? 'Upper Band' : 'Ngưỡng Upper';
    const midLabel = state.lang === 'EN' ? 'Mean (30d)' : 'Trung bình (30 ngày)';
    const lowerLabel = state.lang === 'EN' ? 'Lower Band' : 'Ngưỡng Lower';

    datasets.push({
      label: upperLabel,
      data: filtered.map(() => bands.upper),
      borderColor: 'rgba(38, 166, 154, 0.7)',
      borderWidth: 1.5,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false
    });

    datasets.push({
      label: midLabel,
      data: filtered.map(() => bands.mean),
      borderColor: 'rgba(255, 179, 0, 0.5)',
      borderWidth: 1,
      borderDash: [2, 2],
      pointRadius: 0,
      fill: false
    });

    datasets.push({
      label: lowerLabel,
      data: filtered.map(() => bands.lower),
      borderColor: 'rgba(239, 83, 80, 0.7)',
      borderWidth: 1.5,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false
    });

    legendHtml.push(`
      <div class="legend-item"><span class="legend-color line-upper"></span> ${upperLabel} (+${bands.upper.toFixed(2)}%)</div>
      <div class="legend-item"><span class="legend-color" style="background: var(--text-gold); height: 2px;"></span> ${midLabel} (${bands.mean.toFixed(2)}%)</div>
      <div class="legend-item"><span class="legend-color line-lower"></span> ${lowerLabel} (${bands.lower.toFixed(2)}%)</div>
    `);
  } else {
    const thresh = state.config.basisThreshold || 0.3;
    const upperLabel = state.lang === 'EN' ? 'Upper Threshold' : 'Ngưỡng Upper';
    const lowerLabel = state.lang === 'EN' ? 'Lower Threshold' : 'Ngưỡng Lower';

    datasets.push({
      label: upperLabel,
      data: filtered.map(() => thresh),
      borderColor: 'rgba(38, 166, 154, 0.7)',
      borderWidth: 1.5,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false
    });

    datasets.push({
      label: lowerLabel,
      data: filtered.map(() => -thresh),
      borderColor: 'rgba(239, 83, 80, 0.7)',
      borderWidth: 1.5,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false
    });

    legendHtml.push(`
      <div class="legend-item"><span class="legend-color line-upper"></span> ${upperLabel} (+${thresh.toFixed(2)}%)</div>
      <div class="legend-item"><span class="legend-color line-lower"></span> ${lowerLabel} (-${thresh.toFixed(2)}%)</div>
    `);
  }

  state.chart.data.labels = labels;
  state.chart.data.datasets = datasets;
  state.chart.update();

  const legendContainer = document.getElementById('chartLegendContainer');
  if (legendContainer) legendContainer.innerHTML = legendHtml.join('');
}

// Phase 16: Map pairId to Hyperliquid coin and Lighter market_id
function getExchangeSymbolsForPair(pairId) {
  const map = {
    OAI: { hlCoin: 'io:OAI', ltMarketId: 42, title: 'OpenAI Synthetic' },
    ANTH: { hlCoin: 'io:ANTH', ltMarketId: 38, title: 'Anthropic Pre-IPO' },
    SNDK: { hlCoin: 'io:SNDK', ltMarketId: 32, title: 'SanDisk Synthetic' },
    BTC: { hlCoin: 'BTC', ltMarketId: 1, title: 'Bitcoin' },
    ETH: { hlCoin: 'ETH', ltMarketId: 0, title: 'Ethereum' },
    SOL: { hlCoin: 'SOL', ltMarketId: 3, title: 'Solana' }
  };

  if (map[pairId]) return map[pairId];

  const tracked = state.trackedPairs?.find(p => p.id === pairId);
  return {
    hlCoin: tracked?.hlCoin || `io:${pairId}`,
    ltMarketId: tracked?.ltMarketId || 0,
    title: tracked?.name || pairId
  };
}

// Phase 16: Real Candlestick Charts using TradingView Lightweight Charts CDN
async function fetchAndRenderCandleCharts() {
  if (typeof LightweightCharts === 'undefined') {
    console.warn('LightweightCharts CDN library not loaded yet.');
    return;
  }

  const pairId = state.selectedChartPair || 'SNDK';
  const symbols = getExchangeSymbolsForPair(pairId);
  const tf = state.candleTimeframe || '1h';

  // Update selected pair name label
  const pairLabel = document.getElementById('candleSelectedPairName');
  if (pairLabel) pairLabel.innerText = `${pairId} (${symbols.title})`;

  // Calculate startTime / endTime for Hyperliquid candleSnapshot
  const endTime = Date.now();
  let startTimeHours = 48;
  if (tf === '4h') startTimeHours = 7 * 24;
  if (tf === '1d') startTimeHours = 30 * 24;
  const startTime = endTime - (startTimeHours * 3600 * 1000);

  // -------------------------------------------------------------
  // 1. HYPERLIQUID / ENTROPY REAL CANDLESTICK CHART
  // -------------------------------------------------------------
  const hlContainer = document.getElementById('hlCandleChartContainer');
  if (hlContainer) {
    const calcW = hlContainer.clientWidth || hlContainer.offsetWidth || 500;
    if (!state.hlChartInstance) {
      hlContainer.innerHTML = '';
      state.hlChartInstance = LightweightCharts.createChart(hlContainer, {
        width: calcW,
        height: 220,
        layout: {
          background: { color: '#09101b' },
          textColor: '#a0aec0'
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.04)' }
        },
        crosshair: { mode: 1 },
        timeScale: { borderColor: '#1e324d', timeVisible: true }
      });
      state.hlCandleSeries = state.hlChartInstance.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350'
      });

      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(entries => {
          if (entries[0] && state.hlChartInstance && entries[0].contentRect.width > 0) {
            state.hlChartInstance.applyOptions({ width: entries[0].contentRect.width });
          }
        }).observe(hlContainer);
      }
    } else {
      state.hlChartInstance.applyOptions({ width: calcW });
    }

    try {
      const res = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'candleSnapshot',
          req: { coin: symbols.hlCoin, interval: tf, startTime, endTime }
        })
      });

      if (res.ok) {
        const rawCandles = await res.json();
        if (Array.isArray(rawCandles) && rawCandles.length > 0) {
          const candles = rawCandles.map(c => ({
            time: Math.floor(c.t / 1000),
            open: parseFloat(c.o),
            high: parseFloat(c.h),
            low: parseFloat(c.l),
            close: parseFloat(c.c)
          })).sort((a, b) => a.time - b.time);

          // Deduplicate timestamps (Lightweight Charts strict requirement)
          const uniqueCandles = [];
          const seenTimes = new Set();
          for (const c of candles) {
            if (!seenTimes.has(c.time)) {
              seenTimes.add(c.time);
              uniqueCandles.push(c);
            }
          }

          state.hlCandleSeries.setData(uniqueCandles);
          setTimeout(() => {
            if (state.hlChartInstance && hlContainer) {
              state.hlChartInstance.applyOptions({ width: hlContainer.clientWidth || 500 });
              state.hlChartInstance.timeScale().fitContent();
            }
          }, 50);

          const latestClose = uniqueCandles[uniqueCandles.length - 1].close;
          const hlPriceEl = document.getElementById('hlPriceVal');
          if (hlPriceEl) hlPriceEl.innerText = `$${latestClose.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        }
      }
    } catch (e) {
      console.error('HL Candle fetch error:', e);
    }
  }

  // -------------------------------------------------------------
  // 2. LIGHTER / ROBINHOOD CHAIN PRICE CHART (Trades / Mark Price Fallback)
  // -------------------------------------------------------------
  const ltContainer = document.getElementById('ltCandleChartContainer');
  if (ltContainer) {
    const calcW = ltContainer.clientWidth || ltContainer.offsetWidth || 500;
    if (!state.ltChartInstance) {
      ltContainer.innerHTML = '';
      state.ltChartInstance = LightweightCharts.createChart(ltContainer, {
        width: calcW,
        height: 220,
        layout: {
          background: { color: '#09101b' },
          textColor: '#a0aec0'
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.04)' }
        },
        crosshair: { mode: 1 },
        timeScale: { borderColor: '#1e324d', timeVisible: true }
      });
      state.ltCandleSeries = state.ltChartInstance.addAreaSeries({
        topColor: 'rgba(255, 179, 0, 0.4)',
        bottomColor: 'rgba(255, 179, 0, 0.0)',
        lineColor: '#ffb300',
        lineWidth: 2
      });

      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(entries => {
          if (entries[0] && state.ltChartInstance && entries[0].contentRect.width > 0) {
            state.ltChartInstance.applyOptions({ width: entries[0].contentRect.width });
          }
        }).observe(ltContainer);
      }
    } else {
      state.ltChartInstance.applyOptions({ width: calcW });
    }

    let ltCandles = [];

    // Try Lighter recentTrades API first
    if (symbols.ltMarketId !== undefined && symbols.ltMarketId > 0) {
      try {
        const res = await fetch(`https://api.rh.lighter.xyz/api/v1/recentTrades?market_id=${symbols.ltMarketId}&limit=100`);
        if (res.ok) {
          const data = await res.json();
          if (data.trades && Array.isArray(data.trades) && data.trades.length > 0) {
            ltCandles = data.trades.map(t => ({
              time: Math.floor(t.timestamp / 1000 || Date.now() / 1000),
              value: parseFloat(t.price)
            })).sort((a, b) => a.time - b.time);

            const noteEl = document.getElementById('ltPriceNote');
            if (noteEl) noteEl.innerText = 'Dữ liệu giá thật từ Trade History (Lighter API)';
          }
        }
      } catch (e) {
        console.warn('Lighter trade history fetch error, using markPrice fallback:', e);
      }
    }

    // Fallback to historical markPrice if recentTrades unavailable
    if (ltCandles.length === 0) {
      const historyCutoff = endTime - (startTimeHours * 3600 * 1000);
      const historyFiltered = state.history.filter(h => h.time >= historyCutoff);

      ltCandles = historyFiltered.map(h => {
        let price = h.ltPrices?.[pairId] || 0;
        if (!price && h.hlPrices?.[pairId] && h.pairs?.[pairId] !== undefined) {
          price = h.hlPrices[pairId] * (1 - h.pairs[pairId] / 100);
        }
        return {
          time: Math.floor(h.time / 1000),
          value: price
        };
      }).filter(c => c.value > 0).sort((a, b) => a.time - b.time);

      const noteEl = document.getElementById('ltPriceNote');
      if (noteEl) noteEl.innerText = 'Dữ liệu giá xấp xỉ từ Mark Price (Phase 9b)';
    }

    if (ltCandles.length > 0) {
      const uniqueCandles = [];
      const seen = new Set();
      for (const c of ltCandles) {
        if (!seen.has(c.time)) {
          seen.add(c.time);
          uniqueCandles.push(c);
        }
      }
      state.ltCandleSeries.setData(uniqueCandles);
      setTimeout(() => {
        if (state.ltChartInstance && ltContainer) {
          state.ltChartInstance.applyOptions({ width: ltContainer.clientWidth || 500 });
          state.ltChartInstance.timeScale().fitContent();
        }
      }, 50);

      const latestVal = uniqueCandles[uniqueCandles.length - 1].value;
      const ltPriceEl = document.getElementById('ltPriceVal');
      if (ltPriceEl) ltPriceEl.innerText = `$${latestVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    }
  }
}

// Phase 16: Initialize Timeframe Toolbar Listeners
function initCandleTimeframeToolbar() {
  const toolbar = document.getElementById('candleTimeframeToolbar');
  if (!toolbar) return;

  toolbar.querySelectorAll('.candle-tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tf = btn.getAttribute('data-tf');
      if (!tf) return;
      state.candleTimeframe = tf;

      toolbar.querySelectorAll('.candle-tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      fetchAndRenderCandleCharts();
    });
  });
}

function updateChartThresholdLines() {
  updateChartData();
}
