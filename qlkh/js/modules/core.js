// core.js — khung ứng dụng: điều hướng, khởi động, icon, toast, clipboard, tìm kiếm nhanh.
QLKH.define('core', {
    sidebarOpen: window.innerWidth >= 1024,
    activeModule: 'dashboard',
    isLoading: false,
    showNotifications: false,
    notifications: (() => { try { return JSON.parse(localStorage.getItem('qlkh_notifications')) || []; } catch (e) { return []; } })(),
    searchQuery: '',
    showSearchResults: false,
    isMaintenanceMode: false,
    ytbRenewalStatuses: {},

    // Dữ liệu dẫn xuất từ mapData (giữ để các module cũ dùng)
    stats: [{ value: '0' }, { value: '0' }, { value: '0' }, { value: '0' }],
    staffPerformance: [],
    customers: [],
    upsales: [],

    menuItems: [
        { id: 'dashboard', name: 'Dashboard', icon: 'layout-grid' },
        { id: 'pnl_calculator', name: 'Tính Lợi Nhuận', icon: 'calculator' },
        { id: 'refunds', name: 'Hoàn Tiền', icon: 'banknote' },
        { id: 'chatgpt_shared', name: 'Thiết Bị ChatGPT', icon: 'monitor-smartphone', href: 'chatgpt.html' },
        { id: 'netflix_module', name: 'Quản Lý Netflix', icon: 'tv-2', href: 'netflix.html' },
        { id: 'googleone_module', name: 'Quản Lý Google One', icon: 'cloud', href: 'googleone.html' },
        { id: 'spotify_module', name: 'Quản Lý Spotify', icon: 'music', href: 'spotify.html' }
    ],
    managementItems: [
        { id: 'data_goc', name: 'Tra cứu & Gia hạn (DATAGoc)', icon: 'database' },
        { id: 'fam_spot', name: 'Quản Lý Fam Spot', icon: 'users' },
        { id: 'fam_renew', name: 'FamRenew', icon: 'refresh-cw' },
        { id: 'manual_other_orders', name: 'Nhập Đơn Tay', icon: 'keyboard' },
        { id: 'pricing_catalog', name: 'Bảng Giá SP Khác', icon: 'tags' },
        { id: 'twofa', name: 'Quản Lý 2FA', icon: 'key' },
        { id: 'promocodes', name: 'Mã Giảm Giá', icon: 'ticket' },
        { id: 'account', name: 'Tài Khoản', icon: 'key-round' }
    ],

    get moduleTitle() {
        const all = [...this.menuItems, ...this.managementItems];
        return (all.find(m => m.id === this.activeModule) || {}).name || '';
    },

    async initApp() {
        window._rawDb = window._rawDb || { APP_DATA: [], UPSALE: [], STOCK: [], PNL: [], Spot: [], DATA_YTB: [] };
        try { this.ytbRenewalStatuses = JSON.parse(localStorage.getItem('goshop_ytb_renewal_statuses') || '{}'); } catch (e) {}

        this.restoreSession();
        const hash = location.hash.replace('#', '');
        if (hash && this.isKnownModule(hash)) this.activeModule = hash === 'security' ? 'account' : hash;
        if (!this.isModuleAllowed(this.activeModule)) this.activeModule = 'dashboard';

        window.addEventListener('hashchange', () => {
            const h = location.hash.replace('#', '');
            if (h && h !== this.activeModule && this.isKnownModule(h)) this.activeModule = h;
        });
        this.$watch('activeModule', val => {
            if (!this.isModuleAllowed(val)) { this.activeModule = 'dashboard'; return; }
            if (location.hash.replace('#', '') !== val) history.replaceState(null, '', '#' + val);
            if (window.innerWidth < 1024) this.sidebarOpen = false;
            this.showSearchResults = false;
            const main = document.getElementById('qlkh-main');
            if (main) main.scrollTop = 0;
            this.onEnterModule(val);
        });
        this.$watch('globalStaffCost', () => this.persistCosts());
        this.$watch('globalMiscCost', () => this.persistCosts());

        // Tải danh sách tài khoản sớm để bấm đăng nhập là vào ngay.
        this.fetchLoginAccounts();
        if (this.isLoggedIn) {
            this.verifySession();
            this.hydrateFromCache();
            this.onEnterModule(this.activeModule);
            this.loadBackgroundData();
        }
    },

    isKnownModule(id) {
        return [...this.menuItems, ...this.managementItems].some(m => m.id === id && !m.href) || id === 'security';
    },

    // Gọi khi mở một module: chỉ tải dữ liệu module đó cần (mỗi nhóm chỉ tải 1 lần, trừ khi bấm Làm mới).
    onEnterModule(id) {
        if (!this.isLoggedIn) return;
        const needs = this.MODULE_DATA[id] || [];
        this.ensureData(needs).then(() => {
            if (id === 'dashboard') this.calculateGlobalProfit();
            if (id === 'pnl_calculator') this.$nextTick(() => this.renderProfitChart());
        });
        if (id === 'fam_renew' && this.startLoiAutoRefresh) this.startLoiAutoRefresh();
    },

    // Dữ liệu nhẹ cho toàn app, tải sau khi giao diện chính đã hiện.
    loadBackgroundData() {
        this.fetchSystemConfig();
        this.loadPromoCodes();
        this.loadCatalogProducts();
        const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1500));
        idle(() => { if (this.currentUserRole === 'admin') this.ensureData(['transactions']); });
    },

    persistCosts() {
        try {
            localStorage.setItem('goshop_globalStaffCost', this.globalStaffCost || 0);
            localStorage.setItem('goshop_globalMiscCost', this.globalMiscCost || 0);
        } catch (e) {}
    },

    async fetchSystemConfig() {
        try {
            const data = await this.gvizJson(this.CONFIG.SHEET_ID, 'SYSTEM_CONFIG');
            (data.table && data.table.rows || []).forEach(row => {
                if (row.c && row.c[0] && row.c[1] && row.c[0].v === 'MAINTENANCE_MODE') {
                    const v = row.c[1].v;
                    this.isMaintenanceMode = typeof v === 'boolean' ? v : String(v).trim().toUpperCase() === 'TRUE';
                }
            });
        } catch (e) { console.error('Lỗi đọc SYSTEM_CONFIG', e); }
    },

    async toggleMaintenanceMode() {
        const next = !this.isMaintenanceMode;
        if (!confirm(next ? 'Bật chế độ BẢO TRÌ toàn hệ thống?' : 'Tắt chế độ bảo trì?')) return;
        this.isMaintenanceMode = next;
        try {
            await fetch(this.CONFIG.WEBAPP_URL, {
                method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'set_maintenance_mode', status: next })
            });
            this.showToast(next ? '⚠️ Đã bật chế độ BẢO TRÌ toàn hệ thống!' : '✅ Đã tắt chế độ bảo trì.');
        } catch (e) {
            this.isMaintenanceMode = !next;
            this.showToast('Lỗi khi đổi chế độ bảo trì: ' + e.message, 'error');
        }
    },

    // ---------- Tìm kiếm nhanh trên thanh trên cùng (dùng DATAGoc — có cho cả admin lẫn staff) ----------
    get searchResults() {
        const q = (this.searchQuery || '').trim().toLowerCase();
        if (q.length < 2) return [];
        const out = [];
        for (const c of (this.dataGocList || [])) {
            if ((c.email || '').toLowerCase().includes(q) || (c.subEmail || '').toLowerCase().includes(q) || (c.staff || '').toLowerCase().includes(q)) {
                out.push(c);
                if (out.length >= 30) break;
            }
        }
        return out;
    },
    openSearchResult(c) {
        this.searchQuery = '';
        this.showSearchResults = false;
        this.dataGocSearchQuery = c.email;
        this.dataGocActiveTab = 'list';
        this.activeModule = 'data_goc';
    },
    onSearchFocus() {
        this.showSearchResults = true;
        this.ensureData(['datagoc']);
    },

    // Nút "Gia Hạn" ở Dashboard: mở công cụ gia hạn AI của DATAGoc với email điền sẵn.
    openQuickRenewModal(c) {
        this.activeModule = 'data_goc';
        this.dataGocActiveTab = 'ai_tool';
        this.dataGocAiInput = (c.email || '') + ' ';
        this.$nextTick(() => {
            this.parseDataGocAiInput();
            const box = this.$refs.aiInputBox;
            if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
        });
    },

    // ---------- Thông báo ----------
    getNotifTimeDisplay(notif) {
        if (!notif.timestamp) return notif.time || 'N/A';
        const d = new Date(notif.timestamp);
        const datePart = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        if (String(notif.time).includes('Từ Sheet')) return `${datePart} (Từ Sheet)`;
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} - ${datePart}`;
    },
    getNotifEmail(notif) {
        if (notif.email) return notif.email;
        const m = String(notif.message).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        return m ? m[0] : null;
    },
    clearNotifications() {
        this.notifications = [];
        localStorage.removeItem('qlkh_notifications');
        this.showNotifications = false;
    },

    // ---------- Tiện ích chung ----------
    parseDateStr(dateStr) {
        if (!dateStr || dateStr === '--') return null;
        if (dateStr.includes('/')) {
            const p = dateStr.split('/');
            if (p.length === 3 && p[2].length === 4) return new Date(`${p[2]}-${p[1]}-${p[0]}T00:00:00`);
        }
        const d = new Date(dateStr);
        return isNaN(d) ? null : d;
    },

    getStatus(row) {
        const days = parseInt(row['Số ngày còn lại']);
        if (row['Phân loại'] === 'Còn slot') return 'Available';
        if (isNaN(days)) return '';
        return days < 0 ? 'Expired' : (days <= 7 ? 'Warning' : 'Active');
    },

    async copyToClipboard(text, label) {
        if (!text || text === 'No Email') return;
        try {
            await navigator.clipboard.writeText(text);
        } catch (e) {
            // Fallback cho trình duyệt chặn clipboard API (http, iframe…)
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); } finally { ta.remove(); }
        }
        this.showToast(`Đã copy ${label || ''}`.trim());
    },
    copyText(text) { return this.copyToClipboard(text, 'Email'); },

    toasts: [],
    showToast(message, type) {
        const t = String(message || '');
        const kind = type || (/lỗi|error|thất bại|không thể|❌/i.test(t) ? 'error' : (/⚠️|cảnh báo/i.test(t) ? 'warn' : 'ok'));
        const id = Date.now() + Math.random();
        this.toasts.push({ id, message: t, kind });
        setTimeout(() => { this.toasts = this.toasts.filter(x => x.id !== id); }, kind === 'error' ? 6000 : 3200);
    },

    refreshIcons() { QLKH.icons(); }
});
