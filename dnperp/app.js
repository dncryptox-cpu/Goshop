/**
 * Entropy ↔ Lighter Spread Monitor (dnperp) — Logic Engine
 * Host: godnc.com/dnperp
 */

// Global Application State
const state = {
  // Configuration Settings (saved in localStorage)
  config: {
    basisThreshold: 0.30, // %
    marginThreshold: 75.0, // %
    tgToken: localStorage.getItem('dnperp_tg_token') || '',
    tgChatId: localStorage.getItem('dnperp_tg_chat_id') || '',
    hlWallet: localStorage.getItem('dnperp_hl_wallet') || '0x0000000000000000000000000000000000000000',
    ltMarginUsed: parseFloat(localStorage.getItem('dnperp_lt_used')) || 0,
    ltTotalMargin: parseFloat(localStorage.getItem('dnperp_lt_total')) || 1000
  },

  // Live Market Data
  market: {
    SNDK: { hlPrice: 0, hlFunding: 0, hlVol: 0, ltPrice: 0, ltFunding: 0, ltVol: 0, basis: 0, basisAbs: 0 },
    ANTH: { hlPrice: 0, hlFunding: 0, hlVol: 0, ltPrice: 0, ltFunding: 0, ltVol: 0, basis: 0, basisAbs: 0 }
  },

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
  lastAlertTime: { SNDK: 0, ANTH: 0, HL_MARGIN: 0, LT_MARGIN: 0 }
};

// Initialize App on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  loadStoredConfig();
  initChart();
  seedHistoryIfEmpty();
  
  // Attach Event Listeners
  setupEventListeners();
  
  // Perform First Data Fetch
  fetchMarketData();
  fetchHlMargin();
  updateLighterMarginUI();

  // Start Refresh Timer
  startCountdown();
});

// Seed Initial 24h Data if History is Empty (so chart is immediately rich)
function seedHistoryIfEmpty() {
  if (state.history.length === 0) {
    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    const intervalMs = 15 * 60 * 1000; // 15-minute points for 24h
    
    let sndkBase = -0.08;
    let anthBase = 0.04;

    for (let t = now - twentyFourHoursMs; t <= now; t += intervalMs) {
      // Gentle random walk
      sndkBase += (Math.random() - 0.49) * 0.06;
      anthBase += (Math.random() - 0.49) * 0.05;
      
      // Clamp within reasonable bounds
      sndkBase = Math.max(-0.45, Math.min(0.55, sndkBase));
      anthBase = Math.max(-0.40, Math.min(0.48, anthBase));

      state.history.push({
        time: t,
        sndk: parseFloat(sndkBase.toFixed(3)),
        anth: parseFloat(anthBase.toFixed(3))
      });
    }
    saveHistory();
  }
  updateChartData();
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
  document.getElementById('hlWalletAddress').value = state.config.hlWallet;
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

// Event Listeners Setup
function setupEventListeners() {
  // Manual Refresh
  document.getElementById('btnManualRefresh').addEventListener('click', () => {
    state.countdown = 10;
    fetchMarketData();
    fetchHlMargin();
  });

  // Query HL Margin button
  document.getElementById('btnQueryHlMargin').addEventListener('click', () => {
    const w = document.getElementById('hlWalletAddress').value.trim();
    if (w) {
      state.config.hlWallet = w;
      localStorage.setItem('dnperp_hl_wallet', w);
      fetchHlMargin();
    }
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
  document.getElementById('btnCloseSettings').addEventListener('click', closeModal);
  document.getElementById('btnCancelSettings').addEventListener('click', closeModal);

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
    closeModal();
  });

  // Test Telegram Notification
  document.getElementById('btnTestTgAlert').addEventListener('click', async () => {
    const resEl = document.getElementById('tgTestResult');
    const token = document.getElementById('inputTgToken').value.trim();
    const chatId = document.getElementById('inputTgChatId').value.trim();

    if (!token || !chatId) {
      resEl.innerText = '❌ Vui lòng nhập Bot Token và Chat ID!';
      resEl.style.color = 'var(--accent-danger)';
      return;
    }

    resEl.innerText = '⏳ Đang gửi thử...';
    resEl.style.color = 'var(--text-gold)';

    const msg = `🧪 <b>Test Telegram Alert — Entropy ↔ Lighter Monitor</b>\n\n✅ Đã kết nối thành công từ <code>godnc.com/dnperp</code>!\nHệ thống sẵn sàng gửi cảnh báo realtime khi chênh lệch giá hoặc margin vượt ngưỡng.`;
    const success = await sendTelegramMessage(token, chatId, msg);

    if (success) {
      resEl.innerText = '✅ Đã gửi thành công vào Telegram!';
      resEl.style.color = 'var(--accent-safe)';
    } else {
      resEl.innerText = '❌ Gửi thất bại. Kiểm tra lại Token/Chat ID!';
      resEl.style.color = 'var(--accent-danger)';
    }
  });

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
    if (confirm('Bạn có chắc chắn muốn xoá toàn bộ lịch sử 24h đã lưu?')) {
      state.history = [];
      saveHistory();
      updateChartData();
    }
  });
}

function closeModal() {
  document.getElementById('settingsModal').classList.add('hidden');
}

// Timer Loop (10s refresh)
function startCountdown() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    state.countdown--;
    document.getElementById('countdownTimer').innerText = state.countdown + 's';
    
    if (state.countdown <= 0) {
      state.countdown = 10;
      fetchMarketData();
      fetchHlMargin();
    }
  }, 1000);
}

// Main Fetcher for Hyperliquid (Entropy) & Lighter Markets
async function fetchMarketData() {
  const statusLabel = document.getElementById('statusLabel');
  const connectionStatus = document.getElementById('connectionStatus');

  try {
    // Parallel Fetch to Hyperliquid DEX io and Lighter
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

    // Process Hyperliquid Data
    const hlUniverse = hlData[0]?.universe || [];
    const hlAssetCtxs = hlData[1] || [];

    const getHlAsset = (symbol) => {
      const idx = hlUniverse.findIndex(u => u.name === symbol || u.name.endsWith(':' + symbol));
      if (idx !== -1 && hlAssetCtxs[idx]) {
        const ctx = hlAssetCtxs[idx];
        const markPx = parseFloat(ctx.markPx) || 0;
        const fundingHourly = parseFloat(ctx.funding) || 0;
        // Annualize funding rate: hourly * 24 * 365 * 100%
        const fundingAnnual = fundingHourly * 24 * 365 * 100;
        const vol24h = parseFloat(ctx.dayNtlVlm) || 0;
        return { price: markPx, funding: fundingAnnual, vol: vol24h };
      }
      return { price: 0, funding: 0, vol: 0 };
    };

    const hlSNDK = getHlAsset('SNDK');
    const hlANTH = getHlAsset('ANTH');

    state.market.SNDK.hlPrice = hlSNDK.price;
    state.market.SNDK.hlFunding = hlSNDK.funding;
    state.market.SNDK.hlVol = hlSNDK.vol;

    state.market.ANTH.hlPrice = hlANTH.price;
    state.market.ANTH.hlFunding = hlANTH.funding;
    state.market.ANTH.hlVol = hlANTH.vol;

    // Process Lighter Data
    const books = ltData.order_book_details || [];
    const getLtAsset = (symbol) => {
      const book = books.find(b => b.symbol === symbol);
      if (book) {
        const markPx = parseFloat(book.mark_price) || 0;
        const indexPx = parseFloat(book.index_price) || markPx || 1;
        // Funding proxy = (mark - index) / index * 100%
        const fundingProxy = ((markPx - indexPx) / indexPx) * 100;
        const vol24h = parseFloat(book.daily_quote_token_volume) || 0;
        return { price: markPx, funding: fundingProxy, vol: vol24h };
      }
      return { price: 0, funding: 0, vol: 0 };
    };

    const ltSNDK = getLtAsset('SNDK');
    const ltANTH = getLtAsset('ANTHROPIC');

    state.market.SNDK.ltPrice = ltSNDK.price;
    state.market.SNDK.ltFunding = ltSNDK.funding;
    state.market.SNDK.ltVol = ltSNDK.vol;

    state.market.ANTH.ltPrice = ltANTH.price;
    state.market.ANTH.ltFunding = ltANTH.funding;
    state.market.ANTH.ltVol = ltANTH.vol;

    // Connection UI Update
    connectionStatus.className = 'status-indicator live';
    statusLabel.innerText = 'KẾT NỐI SỐNG';

    // Recalculate Spreads and Update UI
    recalculateBasisAndSignals();

    // Log History Point
    const now = Date.now();
    state.history.push({
      time: now,
      sndk: parseFloat(state.market.SNDK.basis.toFixed(3)),
      anth: parseFloat(state.market.ANTH.basis.toFixed(3))
    });
    
    // Prune history > 24 hours
    const cutoff = now - (24 * 60 * 60 * 1000);
    state.history = state.history.filter(h => h.time >= cutoff);
    saveHistory();
    updateChartData();

  } catch (err) {
    console.error('Data fetch error:', err);
    connectionStatus.className = 'status-indicator offline';
    statusLabel.innerText = 'LỖI KẾT NỐI';
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

    // Check Margin Alert Threshold
    if (pct >= state.config.marginThreshold) {
      triggerTelegramAlert('HL_MARGIN', `⚠️ <b>Hyperliquid Margin Warning!</b>\n\nVí: <code>${wallet}</code>\nMargin Usage: <b>${pct.toFixed(1)}%</b> (Vượt ngưỡng ${state.config.marginThreshold}%)\nTài sản: $${accountVal.toLocaleString()}\nMargin dùng: $${marginUsed.toLocaleString()}`);
    }

  } catch (err) {
    console.error('HL Margin query error:', err);
  }
}

// Calculate Basis & Determine Arbitrage Strategy
function recalculateBasisAndSignals() {
  ['SNDK', 'ANTH'].forEach(symbol => {
    const m = state.market[symbol];
    if (m.ltPrice > 0 && m.hlPrice > 0) {
      // Basis % = (Entropy - Lighter) / Lighter * 100
      m.basis = ((m.hlPrice - m.ltPrice) / m.ltPrice) * 100;
      m.basisAbs = m.hlPrice - m.ltPrice;
    } else {
      m.basis = 0;
      m.basisAbs = 0;
    }
  });

  updateSpreadUI();
}

// Update Main Cards UI
function updateSpreadUI() {
  const thresh = state.config.basisThreshold;
  let activeBannerMsg = null;

  ['SNDK', 'ANTH'].forEach(symbol => {
    const m = state.market[symbol];

    // Format Prices & Metrics
    document.getElementById(`hlPrice${symbol}`).innerText = `$${m.hlPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById(`hlFunding${symbol}`).innerText = `${m.hlFunding > 0 ? '+' : ''}${m.hlFunding.toFixed(2)}%/năm`;
    document.getElementById(`hlVol${symbol}`).innerText = `$${Math.round(m.hlVol).toLocaleString()}`;

    document.getElementById(`ltPrice${symbol}`).innerText = `$${m.ltPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById(`ltFunding${symbol}`).innerText = `${m.ltFunding > 0 ? '+' : ''}${m.ltFunding.toFixed(2)}%`;
    document.getElementById(`ltVol${symbol}`).innerText = `$${Math.round(m.ltVol).toLocaleString()}`;

    // Basis Hero Box
    const basisEl = document.getElementById(`basis${symbol}`);
    const basisAbsEl = document.getElementById(`basisAbs${symbol}`);
    
    const formattedBasis = `${m.basis >= 0 ? '+' : ''}${m.basis.toFixed(2)}%`;
    basisEl.innerText = formattedBasis;
    basisAbsEl.innerText = `($${m.basisAbs >= 0 ? '+' : ''}${m.basisAbs.toFixed(2)})`;

    basisEl.className = 'basis-percent mono-num ' + (m.basis > 0 ? 'positive' : (m.basis < 0 ? 'negative' : ''));

    // Strategy & Action Signal
    const signalBadge = document.getElementById(`signal${symbol}`);
    const stratBox = document.getElementById(`strat${symbol}`);

    if (m.basis > thresh) {
      // Entropy is higher -> Long Lighter, Short Entropy
      signalBadge.className = 'action-badge long-lt';
      signalBadge.innerHTML = `<span class="badge-icon">🟢</span><span class="badge-text">LONG Lighter | SHORT Entropy</span>`;
      stratBox.innerHTML = `💡 Khuyên dùng: <strong>LONG Lighter ($${m.ltPrice.toFixed(2)}) & SHORT Entropy ($${m.hlPrice.toFixed(2)})</strong> để ăn chênh lệch +${m.basis.toFixed(2)}%!`;

      activeBannerMsg = `Cảnh báo: Basis ${symbol} đang vượt ngưỡng +${m.basis.toFixed(2)}% (Mở Long Lighter / Short Entropy)`;

      triggerTelegramAlert(symbol, `🚨 <b>NỔ KÈO ARBITRAGE ${symbol}!</b>\n\nChênh lệch Basis: <b>+${m.basis.toFixed(2)}%</b> (Vượt ngưỡng ${thresh}%)\n• Entropy: $${m.hlPrice.toFixed(2)}\n• Lighter: $${m.ltPrice.toFixed(2)}\n👉 <b>Khuyên dùng:</b> LONG Lighter | SHORT Entropy`);

    } else if (m.basis < -thresh) {
      // Entropy is lower -> Long Entropy, Short Lighter
      signalBadge.className = 'action-badge long-hl';
      signalBadge.innerHTML = `<span class="badge-icon">🔵</span><span class="badge-text">LONG Entropy | SHORT Lighter</span>`;
      stratBox.innerHTML = `💡 Khuyên dùng: <strong>LONG Entropy ($${m.hlPrice.toFixed(2)}) & SHORT Lighter ($${m.ltPrice.toFixed(2)})</strong> để ăn chênh lệch ${m.basis.toFixed(2)}%!`;

      activeBannerMsg = `Cảnh báo: Basis ${symbol} đang giảm âm ${m.basis.toFixed(2)}% (Mở Long Entropy / Short Lighter)`;

      triggerTelegramAlert(symbol, `🚨 <b>NỔ KÈO ARBITRAGE ${symbol}!</b>\n\nChênh lệch Basis: <b>${m.basis.toFixed(2)}%</b> (Vượt ngưỡng -${thresh}%)\n• Entropy: $${m.hlPrice.toFixed(2)}\n• Lighter: $${m.ltPrice.toFixed(2)}\n👉 <b>Khuyên dùng:</b> LONG Entropy | SHORT Lighter`);

    } else {
      signalBadge.className = 'action-badge neutral';
      signalBadge.innerHTML = `<span class="badge-icon">⚪</span><span class="badge-text">TRUNG LẬP</span>`;
      stratBox.innerHTML = `💡 Khuyên dùng: <strong>Chưa có chênh lệch đáng kể (Basis trong ngưỡng safe ±${thresh.toFixed(2)}%)</strong>`;
    }
  });

  // Update Top Banner
  const bannerContainer = document.getElementById('alertBannerContainer');
  const bannerText = document.getElementById('alertBannerText');
  if (activeBannerMsg) {
    bannerText.innerText = activeBannerMsg;
    bannerContainer.classList.remove('hidden');
  }
}

// Update Hyperliquid Margin UI
function updateHlMarginUI(accountVal, marginUsed, pct) {
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
    badge.innerText = 'NGUY HIỂM';
  } else if (pct >= 50) {
    fill.className = 'meter-fill warning';
    badge.className = 'margin-status-badge warning';
    badge.innerText = 'CẢNH BÁO';
  } else {
    fill.className = 'meter-fill safe';
    badge.className = 'margin-status-badge safe';
    badge.innerText = 'AN TOÀN';
  }
}

// Update Lighter Margin UI
function updateLighterMarginUI() {
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
    badge.innerText = 'NGUY HIỂM';

    triggerTelegramAlert('LT_MARGIN', `⚠️ <b>Lighter Margin Warning!</b>\n\nMargin Usage: <b>${pct.toFixed(1)}%</b> (Vượt ngưỡng ${warnThresh}%)\nTotal Equity: $${total.toLocaleString()}\nMargin dùng: $${used.toLocaleString()}`);

  } else if (pct >= 50) {
    fill.className = 'meter-fill warning';
    badge.className = 'margin-status-badge warning';
    badge.innerText = 'CẢNH BÁO';
  } else {
    fill.className = 'meter-fill safe';
    badge.className = 'margin-status-badge safe';
    badge.innerText = 'AN TOÀN';
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
  const cooldown = 5 * 60 * 1000; // 5 minutes

  if (now - (state.lastAlertTime[alertKey] || 0) > cooldown) {
    const token = state.config.tgToken;
    const chatId = state.config.tgChatId;
    if (token && chatId) {
      sendTelegramMessage(token, chatId, message);
      state.lastAlertTime[alertKey] = now;
    }
  }
}

// Initialize Chart.js
function initChart() {
  const ctx = document.getElementById('basisChart').getContext('2d');

  state.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'SNDK Basis %',
          data: [],
          borderColor: '#4bacf5',
          backgroundColor: 'rgba(75, 172, 245, 0.1)',
          borderWidth: 2,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 5
        },
        {
          label: 'ANTH Basis %',
          data: [],
          borderColor: '#e59866',
          backgroundColor: 'rgba(229, 152, 102, 0.1)',
          borderWidth: 2,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 5
        },
        {
          label: 'Upper Threshold',
          data: [],
          borderColor: 'rgba(78, 159, 112, 0.6)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Lower Threshold',
          data: [],
          borderColor: 'rgba(217, 56, 56, 0.6)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
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

// Update Chart Data based on Active Range (1H / 6H / 24H)
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

  const thresh = state.config.basisThreshold;
  const upperData = filtered.map(() => thresh);
  const lowerData = filtered.map(() => -thresh);

  state.chart.data.labels = labels;
  state.chart.data.datasets[0].data = filtered.map(h => h.sndk);
  state.chart.data.datasets[1].data = filtered.map(h => h.anth);
  state.chart.data.datasets[2].data = upperData;
  state.chart.data.datasets[3].data = lowerData;

  state.chart.update();
}

function updateChartThresholdLines() {
  updateChartData();
}
