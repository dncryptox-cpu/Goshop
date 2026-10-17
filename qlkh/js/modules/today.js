// today.js — tab "Hôm Nay": việc cần làm trong ngày, gom từ mọi sản phẩm.
// YouTube lấy từ DATAGoc; ChatGPT/Netflix/Google One/Spotify lấy từ Web App sản phẩm (cùng API các trang con đang dùng).
QLKH.define('today', {
    todayProduct: 'all',      // all | YTB | ChatGPT | Netflix | Google One | Spotify
    todayKind: 'all',         // all | due | overdue
    todaySearch: '',
    productItems: [],         // khách các sản phẩm khác, đã chuẩn hoá
    productLoadErrors: [],

    TODAY_PRODUCTS: ['YTB', 'ChatGPT', 'Netflix', 'Google One', 'Spotify'],
    PRODUCT_PAGES: { ChatGPT: 'chatgpt.html', Netflix: 'netflix.html', 'Google One': 'googleone.html', Spotify: 'spotify.html' },

    // Ngày dd/mm/yyyy | yyyy-mm-dd | ISO -> Date (giống parseDate ở các trang sản phẩm)
    pfParseDate(input) {
        if (!input) return null;
        const s = String(input).trim();
        let p = s.split('/');
        if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]);
        p = s.split('-');
        if (p.length === 3 && p[0].length === 4) return new Date(+p[0], +p[1] - 1, parseInt(p[2], 10));
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    },
    pfFormat(d) {
        return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '';
    },

    async loadProductItems() {
        const base = this.CONFIG.CHATGPT_WEBAPP_URL;
        const sources = [
            { product: 'ChatGPT', url: `${base}?action=list&t=${Date.now()}` },
            { product: 'Netflix', url: `${base}?module=netflix` },
            { product: 'Google One', url: `${base}?module=googleone` },
            { product: 'Spotify', url: `${base}?module=spotify` },
        ];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const errors = [];
        const lists = await Promise.all(sources.map(async src => {
            try {
                const json = await (await fetch(src.url)).json();
                if (!json || !json.success || !Array.isArray(json.data)) throw new Error(json && json.error || 'dữ liệu không hợp lệ');
                return json.data.map(item => {
                    let exp = this.pfParseDate(item.expiryDate);
                    if (!exp) {
                        const act = this.pfParseDate(item.activationDate);
                        if (act && item.duration) exp = new Date(act.getFullYear(), act.getMonth() + parseInt(item.duration, 10), act.getDate());
                    }
                    let name = item.userName || '';
                    if (!name && item.note) { const m = String(item.note).match(/\[Khách:\s*([^|]+)\|/); if (m) name = m[1].trim(); }
                    const email = item.email || '';
                    return {
                        product: src.product,
                        email,  // Netflix/GG One/Spotify không có email khách: hiện tên khách, chủ gói ở dòng phụ
                        name: name || item.userCode || '',
                        sub: src.product === 'ChatGPT' ? (item.rootEmail || '') : (item.rootEmail ? 'Chủ gói: ' + item.rootEmail : ''),
                        staff: item.ctv || '',
                        expiryDate: this.pfFormat(exp),
                        daysLeft: exp ? Math.round((new Date(exp.getFullYear(), exp.getMonth(), exp.getDate()) - today) / 86400000) : null,
                    };
                });
            } catch (e) {
                errors.push(src.product + ': ' + e.message);
                return [];
            }
        }));
        this.productItems = lists.flat();
        this.productLoadErrors = errors;
    },

    // Tất cả khách (mọi sản phẩm) đang trong cửa sổ cần xử lý: hết hạn 0..7 ngày tới, hoặc quá hạn 1..7 ngày.
    get todayAll() {
        const ytb = (this.dataGocList || []).map(c => ({
            product: 'YTB', email: c.email, name: '', sub: c.subEmail && c.subEmail !== '-' ? 'Phụ: ' + c.subEmail : '',
            staff: c.staff || '', expiryDate: c.expiryDate || '', daysLeft: c.daysLeft, raw: c
        }));
        return [...ytb, ...this.productItems].filter(c => c.daysLeft !== null && c.daysLeft >= -7 && c.daysLeft <= 7);
    },

    todayCount(product, kind) {
        return this.todayAll.filter(c =>
            (product === 'all' || c.product === product) &&
            (kind === 'all' || (kind === 'due' ? c.daysLeft >= 0 : c.daysLeft < 0))
        ).length;
    },

    get todayList() {
        const q = this.todaySearch.trim().toLowerCase();
        return this.todayAll
            .filter(c => this.todayProduct === 'all' || c.product === this.todayProduct)
            .filter(c => this.todayKind === 'all' || (this.todayKind === 'due' ? c.daysLeft >= 0 : c.daysLeft < 0))
            .filter(c => !q || [c.email, c.name, c.sub, c.staff].join(' ').toLowerCase().includes(q))
            // Hôm nay trước, rồi sắp hết hạn gần nhất, cuối cùng là quá hạn (mới quá hạn trước)
            .sort((a, b) => {
                const rank = c => c.daysLeft >= 0 ? c.daysLeft : 100 - c.daysLeft;
                return rank(a) - rank(b);
            });
    },

    todayOpen(c) {
        if (c.product === 'YTB') {
            this.dataGocSearchQuery = c.email;
            this.dataGocFilterProduct = 'all'; this.dataGocFilterCategory = 'all'; this.dataGocFilterStaff = 'all'; this.dataGocFilterStatus = 'all';
            this.dataGocActiveTab = 'list';
            this.activeModule = 'data_goc';
        } else {
            location.href = this.PRODUCT_PAGES[c.product];
        }
    },

    // Fam (YouTube) và tiền: lỗi, kho dự phòng, CTV phải nộp, tỷ lệ gia hạn
    get famHealth() {
        const ready = this.dataStatus('famrenew') === 'ready';
        if (!ready) return { ready: false };
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const limit = now.getTime() + 7 * 86400000;
        const stockReady = this.khoRenewList.filter(k => (k.status || 'Sẵn sàng') === 'Sẵn sàng').length;
        const famDue7 = this.groupedRenewDates.reduce((n, g) => {
            const d = this.parseDateDMY(g.date);
            return d && d.getTime() >= now.getTime() && d.getTime() <= limit ? n + g.count : n;
        }, 0);
        return {
            ready: true,
            loi: this.loiFams.length,
            urgent: this.famRenewList.filter(i => { const a = this.getFamRenewAlert(i); return a.isWarrantyUrgent || a.isExpiryUrgent; }).length,
            stockReady, famDue7, stockShort: famDue7 > stockReady,
        };
    },

    get moneyHealth() {
        const tx = this.currentUserRole === 'admin' ? (this.db.DATA_YTB || []) : [];
        if (!tx.length) return null;
        const keys = Object.keys(tx[0]);
        const staffKey = keys.find(k => { const kl = k.toLowerCase(); return kl === 'ctv' || kl.includes('người bán') || kl.includes('nhân sự') || kl === 'staff'; });
        const money = v => {
            let x = String(v || '').toLowerCase().replace(/\s/g, ''); if (!x) return 0;
            let mul = 1;
            if (x.endsWith('k')) { mul = 1e3; x = x.slice(0, -1); } else if (x.endsWith('m') || x.endsWith('tr')) { mul = 1e6; x = x.replace(/m|tr/g, ''); }
            return (parseFloat(x.replace(/[.,]/g, '').replace(/[^0-9-]/g, '')) || 0) * mul;
        };
        const now = new Date();
        const monthKey = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const since = Date.now() - 30 * 86400000;
        const debts = {};
        const renewed = new Set();
        tx.forEach(r => {
            const p = String(r[keys[0]] || '').trim().split('/');
            if (p.length < 3) return;
            const staff = staffKey ? String(r[staffKey] || '').trim() : '';
            const isDnc = !staff || ['dnc', 'admin', 'mrculy'].includes(staff.toLowerCase());
            if (`${p[1].padStart(2, '0')}/${p[2]}` === monthKey && !isDnc) debts[staff] = (debts[staff] || 0) + money(r[keys[11]]) - money(r[keys[8]]);
            const t = new Date(+p[2], +p[1] - 1, +p[0]).getTime();
            if (t >= since && String(r[keys[2]] || '').toLowerCase().includes('gia h')) renewed.add(String(r[keys[3]] || '').toLowerCase().trim());
        });
        const debtList = Object.entries(debts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
        const lost = new Set((this.dataGocList || []).filter(c => c.daysLeft !== null && c.daysLeft < 0 && c.daysLeft >= -30).map(c => c.email.toLowerCase())).size;
        return {
            ctvDebt: debtList.reduce((n, [, v]) => n + v, 0), debtList,
            renewed: renewed.size, lost,
            renewRate: renewed.size + lost > 0 ? Math.round(renewed.size * 100 / (renewed.size + lost)) : null,
        };
    },

    goFam(kind) {
        if (kind === 'loi') this.famRenewView = 'loi_fam';
        else if (kind === 'urgent') { this.famRenewView = 'table'; this.famRenewShowUrgentOnly = true; }
        else this.famRenewView = 'requests';
        this.activeModule = 'fam_renew';
    }
});
