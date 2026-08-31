document.addEventListener('DOMContentLoaded', () => {
  // State management
  const state = {
    currentProject: 'All',
    sourceType: 'all',
    notableOnly: false,
    startDate: '',
    endDate: '',
    search: '',
    insights: []
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
      loadInsights();
    }
  });

  // Filters Event Listeners
  sourceTypeFilter.addEventListener('change', (e) => {
    state.sourceType = e.target.value;
    loadInsights();
  });

  startDateInput.addEventListener('change', (e) => {
    state.startDate = e.target.value;
    loadInsights();
  });

  endDateInput.addEventListener('change', (e) => {
    state.endDate = e.target.value;
    loadInsights();
  });

  notableOnlyCheck.addEventListener('change', (e) => {
    state.notableOnly = e.target.checked;
    loadInsights();
  });

  let searchDebounce = null;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.search = e.target.value;
      loadInsights();
    }, 300);
  });

  // Trigger Manual Scan
  btnScanNow.addEventListener('click', async () => {
    btnScanNow.disabled = true;
    showStatusBanner('⚡ Đang kết nối X API v2 và thực hiện quét dữ liệu mới...');
    
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      const data = await res.json();
      
      if (data.status === 'success') {
        const { newInserted, duplicatesSkipped } = data.result;
        showStatusBanner(`✅ Hoàn thành quét: Thêm mới ${newInserted} bản ghi, Bỏ qua ${duplicatesSkipped} bản ghi trùng lặp.`);
        await loadInsights();
        await loadRateLimitLogs();
      } else {
        showStatusBanner(`❌ Lỗi khi quét: ${data.message || data.error}`);
      }
    } catch (err) {
      showStatusBanner(`❌ Lỗi kết nối máy chủ: ${err.message}`);
    } finally {
      btnScanNow.disabled = false;
      setTimeout(hideStatusBanner, 5000);
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
      const data = await res.json();
      if (data.success) {
        alert('Đã thêm dự án thành công!');
        addProjectForm.reset();
        loadProjectsList();
        loadDynamicTabs();
      } else {
        alert('Lỗi: ' + data.message);
      }
    } catch (err) {
      alert('Lỗi kết nối: ' + err.message);
    }
  });

  // Core Data Fetchers
  async function loadInsights() {
    insightsGrid.innerHTML = '<div class="loading-spinner">Đang tải dữ liệu...</div>';
    
    const params = new URLSearchParams({
      project: state.currentProject,
      sourceType: state.sourceType,
      notableOnly: state.notableOnly,
      search: state.search,
      startDate: state.startDate,
      endDate: state.endDate
    });

    try {
      const res = await fetch(`/api/insights?${params.toString()}`);
      const data = await res.json();
      
      if (!data.success) {
        insightsGrid.innerHTML = `<div class="loading-spinner">Lỗi: ${data.error}</div>`;
        return;
      }

      state.insights = data.data;
      renderInsightsGrid(data.data);
    } catch (err) {
      insightsGrid.innerHTML = `<div class="loading-spinner">Không thể tải dữ liệu: ${err.message}</div>`;
    }
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
      const data = await res.json();
      if (data.success && data.recent_logs && data.recent_logs.length > 0) {
        const latest = data.recent_logs[0];
        const remaining = latest.rate_limit_remaining !== null ? latest.rate_limit_remaining : 98;
        apiStatusText.textContent = `X API: ${remaining}/100 remaining (${data.total_calls} calls total)`;
      }
    } catch (err) {
      console.warn('Could not load rate limit log:', err);
    }
  }

  // Load Active Projects List for Modal & Tabs
  async function loadProjectsList() {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) {
        renderProjectsModalList(data.data);
      }
    } catch (err) {
      console.warn('Error loading projects list:', err);
    }
  }

  function renderProjectsModalList(projects) {
    activeProjectsList.innerHTML = projects.map(p => `
      <div class="proj-item">
        <div>
          <strong>${escapeHtml(p.name)}</strong><br>
          <small style="color: var(--text-muted);">Từ khoá: ${p.keywords.join(', ')}</small>
        </div>
        <button class="btn btn-outline" style="padding: 4px 10px; font-size: 0.75rem;" onclick="deactivateProject(${p.id})">Tắt</button>
      </div>
    `).join('');
  }

  // Dynamic Tabs generator
  async function loadDynamicTabs() {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) {
        const activeProj = state.currentProject;
        let html = `<button class="tab-btn ${activeProj === 'All' ? 'active' : ''}" data-project="All">Tất cả dự án</button>`;
        data.data.forEach(p => {
          html += `<button class="tab-btn ${activeProj === p.name ? 'active' : ''}" data-project="${escapeHtml(p.name)}">${escapeHtml(p.name)}</button>`;
        });
        projectTabs.innerHTML = html;
      }
    } catch (err) {
      console.warn('Error generating tabs:', err);
    }
  }

  // Global window functions for inline onclick handlers
  window.toggleNotable = async (id) => {
    try {
      const res = await fetch(`/api/insights/${id}/notable`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        loadInsights();
      }
    } catch (err) {
      alert('Lỗi toggle notable: ' + err.message);
    }
  };

  window.deleteInsight = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn xoá bản ghi này khỏi danh sách?')) return;
    try {
      const res = await fetch(`/api/insights/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadInsights();
      }
    } catch (err) {
      alert('Lỗi xoá bản ghi: ' + err.message);
    }
  };

  window.deactivateProject = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn huỷ theo dõi dự án này?')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadProjectsList();
        loadDynamicTabs();
      }
    } catch (err) {
      alert('Lỗi tắt dự án: ' + err.message);
    }
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
