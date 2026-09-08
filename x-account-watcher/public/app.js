document.addEventListener('DOMContentLoaded', () => {
  // API Base URL (Connects godnc.com / GitHub Pages directly to live Vercel backend)
  const API_BASE_URL = (window.location.hostname.includes('godnc.com') || window.location.hostname.includes('github.io'))
    ? 'https://goshop-ngla.vercel.app/api'
    : '/api';

  // State Management
  const state = {
    currentAccount: 'All',
    postType: 'all',
    bookmarkedOnly: false,
    startDate: '',
    endDate: '',
    search: '',
    posts: [],
    hasXToken: false,
    hasGeminiKey: false,
    lastApiError: null
  };

  // DOM Elements
  const accountTabs = document.getElementById('accountTabs');
  const postTypeFilter = document.getElementById('postTypeFilter');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const searchInput = document.getElementById('searchInput');
  const bookmarkedOnlyCheck = document.getElementById('bookmarkedOnlyCheck');
  const postsFeed = document.getElementById('postsFeed');
  const btnScanNow = document.getElementById('btnScanNow');
  const statusBanner = document.getElementById('statusBanner');
  const statusBannerText = document.getElementById('statusBannerText');
  const configWarningBanner = document.getElementById('configWarningBanner');
  const warningBannerText = document.getElementById('warningBannerText');
  const apiStatusText = document.getElementById('apiStatusText');
  const apiDot = document.getElementById('apiDot');
  const geminiStatusText = document.getElementById('geminiStatusText');
  const geminiDot = document.getElementById('geminiDot');

  // Modal Elements
  const btnManageAccounts = document.getElementById('btnManageAccounts');
  const accountModal = document.getElementById('accountModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const addAccountForm = document.getElementById('addAccountForm');
  const activeAccountsList = document.getElementById('activeAccountsList');

  // Initialize
  initApp();

  async function initApp() {
    await checkConfigStatus();
    await loadAccountsList();
    await loadDynamicTabs();
    await loadPosts();
    await loadRateLimitLogs();
  }

  // Check API keys presence
  async function checkConfigStatus() {
    try {
      const res = await fetch(`${API_BASE_URL}/config-status`);
      const data = await res.json();
      if (data.success) {
        state.hasXToken = data.has_x_token;
        state.hasGeminiKey = data.has_gemini_key;

        // Update Header Badges
        if (!state.hasXToken) {
          apiDot.classList.add('off');
          apiStatusText.textContent = 'X API: Token chưa nhập';
          configWarningBanner.classList.remove('hidden');
          warningBannerText.textContent = '⚠️ Chưa cấu hình X_BEARER_TOKEN trong Vercel Environment Variables. Vui lòng nhập Token để bắt đầu quét dữ liệu thật.';
        } else {
          apiDot.classList.remove('off');
          apiStatusText.textContent = 'X API: Sẵn sàng';
          configWarningBanner.classList.add('hidden');
        }

        if (!state.hasGeminiKey) {
          geminiDot.classList.add('off');
          geminiStatusText.textContent = 'Gemini AI: Chưa nhập Key';
        } else {
          geminiDot.classList.remove('off');
          geminiStatusText.textContent = 'Gemini AI: Đã kết nối';
        }
      }
    } catch (err) {
      console.warn('Could not fetch config status:', err);
    }
  }

  // Event Listeners - Account Tabs
  accountTabs.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.currentAccount = e.target.getAttribute('data-account');
      loadPosts();
    }
  });

  // Filters Event Listeners
  postTypeFilter.addEventListener('change', (e) => {
    state.postType = e.target.value;
    loadPosts();
  });

  startDateInput.addEventListener('change', (e) => {
    state.startDate = e.target.value;
    loadPosts();
  });

  endDateInput.addEventListener('change', (e) => {
    state.endDate = e.target.value;
    loadPosts();
  });

  bookmarkedOnlyCheck.addEventListener('change', (e) => {
    state.bookmarkedOnly = e.target.checked;
    loadPosts();
  });

  let searchDebounce = null;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.search = e.target.value.trim();
      loadPosts();
    }, 300);
  });

  // Trigger Manual Scan
  btnScanNow.addEventListener('click', async () => {
    btnScanNow.disabled = true;
    showStatusBanner('⚡ Đang kết nối X API v2 để quét bài mới & gọi Gemini dịch tiếng Việt...');
    
    try {
      const res = await fetch(`${API_BASE_URL}/scan`, { method: 'POST' });
      const data = await res.json();
      
      if (data.status === 'success') {
        const { newInserted, duplicatesSkipped, details } = data.result;
        const errorDetail = details ? details.find(d => !d.success && d.message) : null;

        if (errorDetail) {
          state.lastApiError = errorDetail.message;
          showStatusBanner(`⚠️ Lỗi từ X API: ${errorDetail.message}`);
        } else if (newInserted === 0 && duplicatesSkipped === 0) {
          showStatusBanner(`ℹ️ Không có bài viết mới từ các tài khoản đã chọn.`);
        } else {
          showStatusBanner(`✅ Hoàn thành quét: Thêm mới ${newInserted} bài đăng, Bỏ qua ${duplicatesSkipped} bài trùng lặp.`);
        }

        await loadPosts();
        await loadRateLimitLogs();
      } else if (data.status === 'warning') {
        showStatusBanner(data.result.statusMessage || '⚠️ Cảnh báo cấu hình Token.');
      } else {
        showStatusBanner(`❌ Lỗi khi quét: ${data.message || data.error}`);
      }
    } catch (err) {
      showStatusBanner(`❌ Lỗi kết nối máy chủ: ${err.message}`);
    } finally {
      btnScanNow.disabled = false;
      setTimeout(hideStatusBanner, 8000);
    }
  });

  // Modal Management
  btnManageAccounts.addEventListener('click', () => {
    accountModal.classList.remove('hidden');
    loadAccountsList();
  });

  btnCloseModal.addEventListener('click', () => {
    accountModal.classList.add('hidden');
  });

  accountModal.addEventListener('click', (e) => {
    if (e.target === accountModal) {
      accountModal.classList.add('hidden');
    }
  });

  addAccountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputVal = document.getElementById('newAccountUsername').value.trim();
    const displayName = document.getElementById('newAccountDisplayName').value.trim();

    try {
      const res = await fetch(`${API_BASE_URL}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: inputVal, display_name: displayName })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Đã thêm tài khoản @${data.username} thành công!`);
        addAccountForm.reset();
        await loadAccountsList();
        await loadDynamicTabs();
      } else {
        alert('Lỗi: ' + data.message);
      }
    } catch (err) {
      alert('Lỗi kết nối: ' + err.message);
    }
  });

  // Core Data Fetchers
  async function loadPosts() {
    postsFeed.innerHTML = '<div class="loading-spinner">Đang tải danh sách bài viết từ máy chủ...</div>';
    
    const params = new URLSearchParams({
      account: state.currentAccount,
      postType: state.postType,
      bookmarkedOnly: state.bookmarkedOnly,
      search: state.search,
      startDate: state.startDate,
      endDate: state.endDate
    });

    try {
      const res = await fetch(`${API_BASE_URL}/posts?${params.toString()}`);
      const data = await res.json();
      
      if (!data.success) {
        postsFeed.innerHTML = `<div class="loading-spinner">Lỗi: ${data.error}</div>`;
        return;
      }

      state.posts = data.data;
      renderPostsFeed(data.data);
    } catch (err) {
      postsFeed.innerHTML = `<div class="loading-spinner">Không thể kết nối máy chủ backend: ${err.message}</div>`;
    }
  }

  // Helper to check if text contains Vietnamese diacritics
  function isVietnameseText(text) {
    if (!text) return false;
    return /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(text);
  }

  // Render UI v2 Compact Single Column Card Layout
  function renderPostsFeed(items) {
    if (!items || items.length === 0) {
      if (!state.hasXToken && !window.location.hostname.includes('godnc.com')) {
        postsFeed.innerHTML = `
          <div class="loading-spinner" style="border-color: var(--accent-warning);">
            <strong style="color: #f5b7b1;">⚠️ BÀI ĐĂNG THẬT SẼ HIỂN THỊ TẠI ĐÂY SAU KHI CẤU HÌNH X API KEY</strong><br>
            <small style="color: var(--text-secondary); display: block; margin-top: 8px;">
              Hệ thống tuân thủ nguyên tắc không tạo dữ liệu giả lập. Vui lòng nhập <code>X_BEARER_TOKEN</code> trong Vercel Environment Variables và bấm "Quét ngay".
            </small>
          </div>
        `;
      } else if (state.lastApiError) {
        postsFeed.innerHTML = `
          <div class="loading-spinner" style="border-color: #f39c12; background: rgba(243, 156, 18, 0.1);">
            <strong style="color: #f39c12;">⚠️ THÔNG BÁO TỪ X API:</strong><br>
            <span style="font-size: 0.95rem; color: #f8f3e6; display: block; margin: 10px 0;">${escapeHtml(state.lastApiError)}</span>
          </div>
        `;
      } else {
        postsFeed.innerHTML = `
          <div class="loading-spinner">
            Chưa tìm thấy bài đăng nào lưu trong cơ sở dữ liệu.<br>
            <small style="display: block; margin-top: 8px; color: var(--text-secondary);">
              Bấm "Quét ngay" ở trên để gửi yêu cầu lấy bài viết mới từ X API v2.
            </small>
          </div>
        `;
      }
      return;
    }

    postsFeed.innerHTML = items.map(item => {
      const dateStr = new Date(item.post_date).toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
      });
      const starClass = item.is_bookmarked ? 'active-star' : '';
      const typeLabel = item.post_type === 'reply' ? '💬 Reply' : '📝 Bài gốc';
      const typeClass = item.post_type === 'reply' ? 'reply' : 'tweet';

      const avatarInitial = (item.account_username || 'X').charAt(0).toUpperCase();
      const isVietnamese = item.original_lang === 'vi' || isVietnameseText(item.original_content);
      const originalHtml = escapeHtml(item.original_content);
      const translatedHtml = item.translated_content ? escapeHtml(item.translated_content) : null;

      let contentMarkup = '';

      if (isVietnamese || !translatedHtml) {
        // Vietnamese Original Post: Single Content Box (Clean, zero empty space)
        contentMarkup = `
          <div class="single-content-container">
            <div class="main-text-box vietnamese">
              <div class="content-badge vi-badge">
                <span class="badge-flag">🇻🇳</span> Nội dung gốc (Tiếng Việt)
              </div>
              <div class="text-body">${originalHtml}</div>
            </div>
          </div>
        `;
      } else {
        // English Original Post: Gemini AI Translation Primary + Accordion Toggle
        contentMarkup = `
          <div class="single-content-container">
            <div class="main-text-box translated">
              <div class="content-badge gemini-badge">
                <span class="badge-sparkle">✨</span> Bản dịch Tiếng Việt (Gemini AI)
              </div>
              <div class="text-body">${translatedHtml}</div>
            </div>

            <button class="accordion-toggle-btn" onclick="toggleAccordion(${item.id})">
              <span id="acc-label-${item.id}">🌐 Xem bản gốc tiếng Anh</span> <span id="acc-arrow-${item.id}" class="accordion-arrow">▾</span>
            </button>

            <div class="accordion-box hidden" id="acc-box-${item.id}">
              <div class="accordion-label">Nguyên văn Tiếng Anh (X):</div>
              <div class="original-en-text">${originalHtml}</div>
            </div>
          </div>
        `;
      }

      return `
        <article class="post-card" id="post-${item.id}">
          <div class="card-header">
            <div class="author-meta">
              <div class="author-avatar ${typeClass}">${avatarInitial}</div>
              <div class="author-details">
                <a href="https://x.com/${item.account_username}" target="_blank" class="author-handle">@${escapeHtml(item.account_username)}</a>
                <span class="post-type-tag ${typeClass}">${typeLabel}</span>
              </div>
            </div>
            <div class="post-date-badge">
              <span class="date-icon">🕒</span> ${dateStr}
            </div>
          </div>

          ${contentMarkup}

          <div class="card-footer">
            <a href="${item.original_url}" target="_blank" class="original-link-btn">
              <span>Xem trên X</span> <span class="link-arrow">↗</span>
            </a>
            <div class="card-actions">
              <button class="action-btn star-btn ${starClass}" onclick="toggleBookmark(${item.id})" title="Đánh dấu lưu trữ">
                <span>⭐</span> <span class="action-label">${item.is_bookmarked ? 'Đã lưu' : 'Lưu'}</span>
              </button>
              <button class="action-btn delete-btn" onclick="deletePost(${item.id})" title="Xoá bản ghi">
                <span>🗑️</span> <span class="action-label">Xoá</span>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  // Rate Limit Logger
  async function loadRateLimitLogs() {
    try {
      const res = await fetch(`${API_BASE_URL}/rate-limit`);
      const data = await res.json();
      if (data.success && data.recent_logs && data.recent_logs.length > 0) {
        const latest = data.recent_logs[0];
        const remaining = latest.rate_limit_remaining !== null ? latest.rate_limit_remaining : 100;
        apiStatusText.textContent = `X API: ${remaining}/100 remaining (${data.total_calls} calls logged)`;
      }
    } catch (err) {
      console.warn('Could not load rate limit logs:', err);
    }
  }

  // Load Accounts List
  async function loadAccountsList() {
    try {
      const res = await fetch(`${API_BASE_URL}/accounts`);
      const data = await res.json();
      if (data.success) {
        renderAccountsModalList(data.data);
      }
    } catch (err) {
      console.warn('Error loading accounts:', err);
    }
  }

  function renderAccountsModalList(accounts) {
    activeAccountsList.innerHTML = accounts.map(a => `
      <div class="acc-item">
        <div>
          <strong>@${escapeHtml(a.username)}</strong>
          ${a.display_name ? `<span style="color: var(--text-muted); font-size: 0.85rem;"> (${escapeHtml(a.display_name)})</span>` : ''}
        </div>
        <button class="btn btn-outline" style="padding: 4px 10px; font-size: 0.75rem;" onclick="deactivateAccount(${a.id})">Tắt</button>
      </div>
    `).join('');
  }

  async function loadDynamicTabs() {
    try {
      const res = await fetch(`${API_BASE_URL}/accounts`);
      const data = await res.json();
      if (data.success) {
        const activeAcc = state.currentAccount;
        let html = `<button class="tab-btn ${activeAcc === 'All' ? 'active' : ''}" data-account="All">Tất cả tài khoản</button>`;
        data.data.forEach(a => {
          html += `<button class="tab-btn ${activeAcc === a.username ? 'active' : ''}" data-account="${escapeHtml(a.username)}">@${escapeHtml(a.username)}</button>`;
        });
        accountTabs.innerHTML = html;
      }
    } catch (err) {
      console.warn('Error rendering dynamic tabs:', err);
    }
  }

  // Accordion Toggle Helper
  window.toggleAccordion = (id) => {
    const box = document.getElementById(`acc-box-${id}`);
    const label = document.getElementById(`acc-label-${id}`);
    const arrow = document.getElementById(`acc-arrow-${id}`);
    if (box) {
      const isHidden = box.classList.contains('hidden');
      if (isHidden) {
        box.classList.remove('hidden');
        if (label) label.textContent = '🌐 Thu gọn bản gốc tiếng Anh';
        if (arrow) arrow.textContent = '▴';
      } else {
        box.classList.add('hidden');
        if (label) label.textContent = '🌐 Xem bản gốc tiếng Anh';
        if (arrow) arrow.textContent = '▾';
      }
    }
  };

  // Global Window Helper Functions
  window.toggleBookmark = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/posts/${id}/bookmark`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        loadPosts();
      }
    } catch (err) {
      alert('Lỗi toggle bookmark: ' + err.message);
    }
  };

  window.deletePost = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn xoá bài viết này?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/posts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadPosts();
      }
    } catch (err) {
      alert('Lỗi xoá bài viết: ' + err.message);
    }
  };

  window.deactivateAccount = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn huỷ theo dõi tài khoản này?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/accounts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await loadAccountsList();
        await loadDynamicTabs();
      }
    } catch (err) {
      alert('Lỗi huỷ tài khoản: ' + err.message);
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
