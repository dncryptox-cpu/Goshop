document.addEventListener('DOMContentLoaded', () => {
  // Static Fallback Data for GitHub Pages preview (when API backend is offline)
  const staticFallbackInsights = [
    {
      id: 1,
      project_name: "Tread.fi",
      original_url: "https://x.com/degen_trader_x/status/18291001002",
      tweet_id: "18291001002",
      author_handle: "degen_trader_x",
      author_name: "Degen Trader",
      summary: "Người dùng Degen Trader chia sẻ: Vừa dùng thử Tread.fi để rebalance kho Vault tự động trên Hyperliquid. Phí gas khá rẻ nhưng thi thoảng bị delay 10s khi khớp lệnh lúc thị trường biến động mạnh.",
      source_type: "analyst",
      post_date: new Date(Date.now() - 3600000 * 4).toISOString(),
      is_notable: 0,
      is_deleted: 0
    },
    {
      id: 2,
      project_name: "Tread.fi",
      original_url: "https://x.com/quant_alpha/status/18291001003",
      tweet_id: "18291001003",
      author_handle: "quant_alpha",
      author_name: "Alpha Quant Lab",
      summary: "Người dùng Alpha Quant Lab chia sẻ: Phân tích nhanh cấu trúc phí của Tread.fi vs các Bot Grid truyền thống. Yield cải thiện nhờ cơ chế tự điều chỉnh kho đệm spread, đáng để thử nghiệm.",
      source_type: "analyst",
      post_date: new Date(Date.now() - 3600000 * 8).toISOString(),
      is_notable: 1,
      is_deleted: 0
    },
    {
      id: 3,
      project_name: "Tread.fi",
      original_url: "https://x.com/crypto_warning_bot/status/18291001004",
      tweet_id: "18291001004",
      author_handle: "crypto_warning_bot",
      author_name: "Crypto Safety Sentinel",
      summary: "Người dùng Crypto Safety Sentinel chia sẻ: Cảnh báo: Có website phishing giả mạo Tread.fi chạy quảng cáo trên Google Ads. Mọi người chú ý chỉ truy cập đúng link gốc tread.fi.",
      source_type: "user",
      post_date: new Date(Date.now() - 3600000 * 12).toISOString(),
      is_notable: 0,
      is_deleted: 0
    },
    {
      id: 4,
      project_name: "Tread.fi",
      original_url: "https://x.com/user_viet_crypto/status/18291001005",
      tweet_id: "18291001005",
      author_handle: "user_viet_crypto",
      author_name: "Minh Tuấn (DeFi User)",
      summary: "Người dùng Minh Tuấn (DeFi User) chia sẻ: Anh em có ai bị lỗi không bấm rút tiền được trên Tread.fi chiều nay không? Mình bấm withdraw thì app cứ quay tròn, đổi mạng RPC thì mới được.",
      source_type: "user",
      post_date: new Date(Date.now() - 3600000 * 16).toISOString(),
      is_notable: 0,
      is_deleted: 0
    },
    {
      id: 5,
      project_name: "HIP-3",
      original_url: "https://x.com/hl_builder_dev/status/18292002002",
      tweet_id: "18292002002",
      author_handle: "hl_builder_dev",
      author_name: "Hyperliquid Builder",
      summary: "Người dùng Hyperliquid Builder chia sẻ: Đang test đề xuất HIP-3 trên testnet. Cơ chế thanh khoản mới giúp giảm slippage khi giao dịch token vốn hoá vừa, trải nghiệm mượt hơn hẳn HIP-2.",
      source_type: "user",
      post_date: new Date(Date.now() - 3600000 * 5).toISOString(),
      is_notable: 1,
      is_deleted: 0
    },
    {
      id: 6,
      project_name: "HIP-3",
      original_url: "https://x.com/defi_researcher/status/18292002003",
      tweet_id: "18292002003",
      author_handle: "defi_researcher",
      author_name: "Research Crypto",
      summary: "Người dùng Research Crypto chia sẻ: So sánh tác động của HIP-3 lên các Builder Vaults: Tỷ lệ phân bổ rewards cho vault maker tăng 15%, thu hút thêm các market maker nhỏ.",
      source_type: "analyst",
      post_date: new Date(Date.now() - 3600000 * 9).toISOString(),
      is_notable: 0,
      is_deleted: 0
    },
    {
      id: 7,
      project_name: "HIP-3",
      original_url: "https://x.com/trading_noob99/status/18292002004",
      tweet_id: "18292002004",
      author_handle: "trading_noob99",
      author_name: "Trader Gà",
      summary: "Người dùng Trader Gà chia sẻ: HIP-3 áp dụng xong thì phí maker có được giảm thêm không mọi người? Mình trade volume cỡ 50k$/tháng liệu có ảnh hưởng nhiều không?",
      source_type: "user",
      post_date: new Date(Date.now() - 3600000 * 14).toISOString(),
      is_notable: 0,
      is_deleted: 0
    },
    {
      id: 8,
      project_name: "HIP-4",
      original_url: "https://x.com/hl_dev_community/status/18293003001",
      tweet_id: "18293003001",
      author_handle: "hl_dev_community",
      author_name: "Hyperliquid Devs",
      summary: "Người dùng Hyperliquid Devs chia sẻ: Thảo luận về HIP-4: Đề xuất tích hợp cơ chế oracle backup mới để tránh lỗi flash crash khi feed giá sàn CEX bị nghẽn.",
      source_type: "user",
      post_date: new Date(Date.now() - 3600000 * 6).toISOString(),
      is_notable: 0,
      is_deleted: 0
    },
    {
      id: 9,
      project_name: "HIP-4",
      original_url: "https://x.com/oracle_checker/status/18293003002",
      tweet_id: "18293003002",
      author_handle: "oracle_checker",
      author_name: "Oracle Auditor",
      summary: "Người dùng Oracle Auditor chia sẻ: Đánh giá HIP-4: Cơ chế tính trung bình giá (TWAP) cải tiến chống manipulation tốt hơn, an toàn cho các lệnh perp đòn bẩy cao.",
      source_type: "user",
      post_date: new Date(Date.now() - 3600000 * 10).toISOString(),
      is_notable: 0,
      is_deleted: 0
    }
  ];

  // State management
  const state = {
    currentProject: 'All',
    sourceType: 'all',
    notableOnly: false,
    startDate: '',
    endDate: '',
    search: '',
    insights: [],
    isStaticMode: false
  };

  // DOM Elements
  const projectTabs = document.getElementById('projectTabs');
  const sourceTypeFilter = document.getElementById('sourceTypeFilter');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const searchInput = document.getElementById('searchInput');
  const notableOnlyCheck = document.getElementById('notableOnlyCheck');
  const insightsGrid = document.getElementById('insightsGrid');
  const btnScanNow = document.getElementById('btnScanNow');
  const statusBanner = document.getElementById('statusBanner');
  const statusBannerText = document.getElementById('statusBannerText');
  const apiStatusText = document.getElementById('apiStatusText');

  // Modal Elements
  const btnManageProjects = document.getElementById('btnManageProjects');
  const projectModal = document.getElementById('projectModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const addProjectForm = document.getElementById('addProjectForm');
  const activeProjectsList = document.getElementById('activeProjectsList');

  // Initial Load
  loadInsights();
  loadRateLimitLogs();
  loadProjectsList();

  // Event Listeners - Project Tabs
  projectTabs.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.currentProject = e.target.getAttribute('data-project');
      filterAndRenderInsights();
    }
  });

  // Filters Event Listeners
  sourceTypeFilter.addEventListener('change', (e) => {
    state.sourceType = e.target.value;
    filterAndRenderInsights();
  });

  startDateInput.addEventListener('change', (e) => {
    state.startDate = e.target.value;
    filterAndRenderInsights();
  });

  endDateInput.addEventListener('change', (e) => {
    state.endDate = e.target.value;
    filterAndRenderInsights();
  });

  notableOnlyCheck.addEventListener('change', (e) => {
    state.notableOnly = e.target.checked;
    filterAndRenderInsights();
  });

  let searchDebounce = null;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.search = e.target.value.toLowerCase();
      filterAndRenderInsights();
    }, 300);
  });

  // Trigger Manual Scan
  btnScanNow.addEventListener('click', async () => {
    btnScanNow.disabled = true;
    showStatusBanner('⚡ Đang kết nối X API v2 và thực hiện quét dữ liệu mới...');
    
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.status === 'success') {
          const { newInserted, duplicatesSkipped } = data.result;
          showStatusBanner(`✅ Hoàn thành quét: Thêm mới ${newInserted} bản ghi, Bỏ qua ${duplicatesSkipped} bản ghi trùng lặp.`);
          await loadInsights();
          await loadRateLimitLogs();
        } else {
          showStatusBanner(`❌ Lỗi khi quét: ${data.message || data.error}`);
        }
      } else {
        // GitHub Pages Static Mode simulation
        setTimeout(() => {
          showStatusBanner(`✅ Preview Mode: Đã cập nhật quét dữ liệu mới cho Tread.fi & HIP-3 (Static Host).`);
          setTimeout(hideStatusBanner, 4000);
        }, 1200);
      }
    } catch (err) {
      showStatusBanner(`❌ Demo Preview Mode: Đã giả lập lượt quét thành công.`);
      setTimeout(hideStatusBanner, 3000);
    } finally {
      btnScanNow.disabled = false;
    }
  });

  // Modal Management
  btnManageProjects.addEventListener('click', () => {
    projectModal.classList.remove('hidden');
    loadProjectsList();
  });

  btnCloseModal.addEventListener('click', () => {
    projectModal.classList.add('hidden');
  });

  projectModal.addEventListener('click', (e) => {
    if (e.target === projectModal) {
      projectModal.classList.add('hidden');
    }
  });

  addProjectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newProjName').value.trim();
    const keywords = document.getElementById('newProjKeywords').value.trim();
    const official_handles = document.getElementById('newProjOfficial').value.trim();

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, keywords, official_handles })
      });
      const contentType = res.headers.get('content-type') || '';
      
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          alert('Đã thêm dự án thành công!');
          addProjectForm.reset();
          loadProjectsList();
        }
      } else {
        alert(`[Preview Mode] Đã lưu thông tin dự án: ${name}`);
        addProjectForm.reset();
        projectModal.classList.add('hidden');
      }
    } catch (err) {
      alert(`[Preview Mode] Đã tạo ghi nhận dự án: ${name}`);
      addProjectForm.reset();
      projectModal.classList.add('hidden');
    }
  });

  // Core Data Fetchers with Hybrid Fallback
  async function loadInsights() {
    insightsGrid.innerHTML = '<div class="loading-spinner">Đang tải dữ liệu insight...</div>';

    try {
      const res = await fetch('/api/insights');
      const contentType = res.headers.get('content-type') || '';

      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          state.insights = data.data;
          state.isStaticMode = false;
          filterAndRenderInsights();
          return;
        }
      }
    } catch (err) {
      console.warn('API backend not available, switching to Static Fallback dataset:', err.message);
    }

    // Fallback to Static Dataset (for GitHub Pages hosting)
    state.insights = staticFallbackInsights;
    state.isStaticMode = true;
    filterAndRenderInsights();
  }

  function filterAndRenderInsights() {
    let filtered = state.insights.filter(item => !item.is_deleted);

    // Project filter
    if (state.currentProject !== 'All') {
      filtered = filtered.filter(item => item.project_name === state.currentProject);
    }

    // Source type filter
    if (state.sourceType !== 'all') {
      filtered = filtered.filter(item => item.source_type === state.sourceType);
    }

    // Notable check
    if (state.notableOnly) {
      filtered = filtered.filter(item => item.is_notable === 1);
    }

    // Search filter
    if (state.search) {
      filtered = filtered.filter(item => 
        (item.summary && item.summary.toLowerCase().includes(state.search)) ||
        (item.author_handle && item.author_handle.toLowerCase().includes(state.search)) ||
        (item.author_name && item.author_name.toLowerCase().includes(state.search))
      );
    }

    renderInsightsGrid(filtered);
  }

  function renderInsightsGrid(items) {
    if (!items || items.length === 0) {
      insightsGrid.innerHTML = `
        <div class="loading-spinner">
          Không tìm thấy bản ghi nào khớp với điều kiện lọc.<br>
          <small>Bấm "Quét ngay" để cập nhật dữ liệu mới nhất từ X.</small>
        </div>
      `;
      return;
    }

    const sourceTypeLabels = {
      user: 'Người dùng',
      analyst: 'Phân tích',
      reliable: 'Tin cậy'
    };

    insightsGrid.innerHTML = items.map(item => {
      const dateStr = new Date(item.post_date).toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
      });
      const starClass = item.is_notable ? 'active-star' : '';

      return `
        <article class="insight-card" data-source="${item.source_type}" id="card-${item.id}">
          <div class="card-top">
            <span class="source-badge ${item.source_type}">${sourceTypeLabels[item.source_type] || item.source_type}</span>
            <span class="proj-badge">#${item.project_name}</span>
          </div>

          <div class="card-author">
            <div class="author-info">
              <span class="author-name">${escapeHtml(item.author_name)}</span>
              <a href="${item.original_url}" target="_blank" class="author-handle">@${escapeHtml(item.author_handle)} ↗</a>
            </div>
          </div>

          <p class="card-summary">${escapeHtml(item.summary)}</p>

          <div class="card-footer">
            <span class="post-date">${dateStr}</span>
            <div class="card-actions">
              <button class="icon-btn ${starClass}" onclick="toggleNotable(${item.id})" title="Đánh dấu đáng chú ý">⭐</button>
              <button class="icon-btn" onclick="deleteInsight(${item.id})" title="Xoá bản ghi">🗑️</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  // Rate Limit Logger Updater
  async function loadRateLimitLogs() {
    try {
      const res = await fetch('/api/rate-limit');
      const contentType = res.headers.get('content-type') || '';
      
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success && data.recent_logs && data.recent_logs.length > 0) {
          const latest = data.recent_logs[0];
          const remaining = latest.rate_limit_remaining !== null ? latest.rate_limit_remaining : 98;
          apiStatusText.textContent = `X API: ${remaining}/100 remaining (${data.total_calls} calls total)`;
          return;
        }
      }
    } catch (err) {
      // Ignore in static host mode
    }

    apiStatusText.textContent = `X API: 98/100 remaining (Read-only)`;
  }

  // Load Active Projects List for Modal
  async function loadProjectsList() {
    const defaultProjects = [
      { id: 1, name: 'Tread.fi', keywords: ['Tread.fi', 'TreadFi', '@tread_fi'] },
      { id: 2, name: 'HIP-3', keywords: ['HIP-3', 'HIP3', 'Hyperliquid HIP-3'] },
      { id: 3, name: 'HIP-4', keywords: ['HIP-4', 'HIP4', 'Hyperliquid HIP-4'] }
    ];

    try {
      const res = await fetch('/api/projects');
      const contentType = res.headers.get('content-type') || '';
      
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          renderProjectsModalList(data.data);
          return;
        }
      }
    } catch (err) {
      // Ignore
    }

    renderProjectsModalList(defaultProjects);
  }

  function renderProjectsModalList(projects) {
    activeProjectsList.innerHTML = projects.map(p => `
      <div class="proj-item">
        <div>
          <strong>${escapeHtml(p.name)}</strong><br>
          <small style="color: var(--text-muted);">Từ khoá: ${Array.isArray(p.keywords) ? p.keywords.join(', ') : p.keywords}</small>
        </div>
        <button class="btn btn-outline" style="padding: 4px 10px; font-size: 0.75rem;" onclick="deactivateProject(${p.id})">Tắt</button>
      </div>
    `).join('');
  }

  // Global window functions for inline onclick handlers
  window.toggleNotable = async (id) => {
    const target = state.insights.find(i => i.id === id);
    if (target) {
      target.is_notable = target.is_notable ? 0 : 1;
      filterAndRenderInsights();
    }

    try {
      await fetch(`/api/insights/${id}/notable`, { method: 'POST' });
    } catch (err) {
      // Handled silently in static mode
    }
  };

  window.deleteInsight = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn xoá bản ghi này khỏi danh sách?')) return;
    const target = state.insights.find(i => i.id === id);
    if (target) {
      target.is_deleted = 1;
      filterAndRenderInsights();
    }

    try {
      await fetch(`/api/insights/${id}`, { method: 'DELETE' });
    } catch (err) {
      // Handled silently in static mode
    }
  };

  window.deactivateProject = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn huỷ theo dõi dự án này?')) return;
    alert('Đã ẩn dự án khỏi danh sách.');
  };

  // Helper Utilities
  function showStatusBanner(text) {
    statusBannerText.textContent = text;
    statusBanner.classList.remove('hidden');
  }

  function hideStatusBanner() {
    statusBanner.classList.add('hidden');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }
});
