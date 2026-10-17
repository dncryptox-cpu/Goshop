// auth.js — đăng nhập bằng tài khoản ở tab "Login" (sheet SHEET_ID).
// Không còn tài khoản viết cứng trong code. Username chứa "admin" => quyền admin, còn lại => staff.
QLKH.define('auth', {
    isLoggedIn: false,
    loginForm: { username: '', password: '' },
    loginError: '',
    isLoggingIn: false,
    currentUserRole: 'staff',
    currentUsername: '',
    accountsList: [],
    _accountsPromise: null,

    STAFF_BLOCKED: ['pnl_calculator', 'lai_lo', 'global_profit', 'pricing_catalog', 'twofa', 'promocodes', 'account'],
    SESSION_KEY: 'qlkh_session',
    SESSION_DAYS: 7,

    isModuleAllowed(moduleId) {
        if (this.currentUserRole === 'admin') return true;
        return !this.STAFF_BLOCKED.includes(moduleId);
    },

    roleOf(username) {
        return String(username || '').toLowerCase().includes('admin') ? 'admin' : 'staff';
    },

    restoreSession() {
        try {
            const s = JSON.parse(localStorage.getItem(this.SESSION_KEY) || 'null');
            if (!s || !s.username || !s.ts) return false;
            if (Date.now() - s.ts > this.SESSION_DAYS * 86400000) { localStorage.removeItem(this.SESSION_KEY); return false; }
            this.currentUsername = s.username;
            this.currentUserRole = this.roleOf(s.username);
            this.isLoggedIn = true;
            return true;
        } catch (e) { return false; }
    },

    // Sau khi tải danh sách tài khoản: nếu tài khoản trong phiên đã bị xoá khỏi tab Login thì đăng xuất.
    async verifySession() {
        if (!this.isLoggedIn) return;
        await this.fetchLoginAccounts();
        if (!this.accountsList.length) return; // không tải được => giữ phiên, tránh khoá ngoài khi mạng lỗi
        const ok = this.accountsList.some(a => a.username.toLowerCase() === this.currentUsername.toLowerCase());
        if (!ok) { this.logout(); this.loginError = 'Tài khoản không còn tồn tại, vui lòng đăng nhập lại.'; }
    },

    async login() {
        const user = this.loginForm.username.trim();
        const pass = this.loginForm.password;
        this.loginError = '';
        this.isLoggingIn = true;
        try {
            if (!this.accountsList.length) await this.fetchLoginAccounts(true);
            if (!this.accountsList.length) {
                this.loginError = 'Không tải được danh sách tài khoản (tab Login). Kiểm tra mạng rồi thử lại.';
                return;
            }
            const acc = this.accountsList.find(a => a.username.toLowerCase() === user.toLowerCase() && a.password === pass);
            if (!acc) { this.loginError = 'Sai tên đăng nhập hoặc mật khẩu.'; return; }
            this.currentUsername = acc.username;
            this.currentUserRole = this.roleOf(acc.username);
            this.isLoggedIn = true;
            this.loginForm.password = '';
            localStorage.setItem(this.SESSION_KEY, JSON.stringify({ username: acc.username, ts: Date.now() }));
            if (!this.isModuleAllowed(this.activeModule)) this.activeModule = 'dashboard';
            this.showToast(`Đăng nhập thành công (${this.currentUserRole === 'admin' ? 'Quản trị viên' : 'Nhân viên'})`);
            this.onEnterModule(this.activeModule);
            this.loadBackgroundData();
        } finally {
            this.isLoggingIn = false;
        }
    },

    logout() {
        this.isLoggedIn = false;
        this.loginForm = { username: '', password: '' };
        this.currentUsername = '';
        this.currentUserRole = 'staff';
        localStorage.removeItem(this.SESSION_KEY);
    },

    async fetchLoginAccounts(force) {
        if (this._accountsPromise && !force) return this._accountsPromise;
        this._accountsPromise = (async () => {
            try {
                const data = await this.gvizJson(this.CONFIG.SHEET_ID, 'Login');
                const list = [];
                (data.table && data.table.rows || []).forEach(row => {
                    if (row.c && row.c[0] && row.c[1]) {
                        const u = String(row.c[0].v || '').trim();
                        const p = String(row.c[1].v || '').trim();
                        if (u && p && u.toLowerCase() !== 'tài khoản') list.push({ username: u, password: p });
                    }
                });
                this.accountsList = list;
            } catch (e) {
                console.error('Không tải được tab Login', e);
                this._accountsPromise = null;
            }
        })();
        return this._accountsPromise;
    },

    // Tên ghi vào nhật ký DATAGoc khi gia hạn (giữ quy ước cũ: nhân viên => Lộc, admin => Dnc).
    get operatorName() { return this.currentUserRole === 'staff' ? 'Lộc' : 'Dnc'; },

    // Chỉ dùng cho trang Tài khoản: không trả mật khẩu ra giao diện.
    get accountUsernames() {
        return this.accountsList.map(a => ({ username: a.username, role: this.roleOf(a.username) }));
    }
});
