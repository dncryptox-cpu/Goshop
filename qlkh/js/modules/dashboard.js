// dashboard.js — tách từ admin/index.html (logic giữ nguyên, đã chỉnh trong qlkh)
QLKH.define('dashboard', {
    showDashboardFinance: localStorage.getItem('goshop_show_dashboard_finance') !== 'false',

    dashboardCustomerSearch: '',

    dashboardCustomerStatus: 'all',

    get dashboardFilteredCustomers() {
        let list = [...(this.dataGocList || [])];
        if (this.dashboardCustomerStatus === 'active') {
            list = list.filter(item => item.daysLeft !== null && item.daysLeft > 15);
        } else if (this.dashboardCustomerStatus === 'warning') {
            list = list.filter(item => item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= 15);
        } else if (this.dashboardCustomerStatus === 'expired') {
            list = list.filter(item => item.daysLeft !== null && item.daysLeft < 0);
        }
        const q = (this.dashboardCustomerSearch || '').trim().toLowerCase();
        if (q) {
            list = list.filter(item => 
                String(item.email || '').toLowerCase().includes(q) ||
                String(item.subEmail || '').toLowerCase().includes(q) ||
                String(item.product || '').toLowerCase().includes(q) ||
                String(item.staff || '').toLowerCase().includes(q)
            );
        }
        if (this.dashboardCustomerStatus === 'all') {
            list.sort((a, b) => {
                const da = a.daysLeft !== null ? a.daysLeft : 9999;
                const db = b.daysLeft !== null ? b.daysLeft : 9999;
                return da - db;
            });
        }
        return list.slice(0, 20);
    },

    // ---------- Khối "Hôm nay": việc cần làm + sức khoẻ shop ----------
    get today() {
        const goc = this.dataGocList || [];
        const uniq = arr => new Set(arr.map(c => String(c.email || '').toLowerCase())).size;
        const due7 = goc.filter(c => c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 7);
        const overdue7 = goc.filter(c => c.daysLeft !== null && c.daysLeft < 0 && c.daysLeft >= -7);
        const lost30 = goc.filter(c => c.daysLeft !== null && c.daysLeft < 0 && c.daysLeft >= -30);

        // Fam: lỗi (KHO_RENEW) + cần xử lý gấp (RENEW)
        const famReady = this.dataStatus('famrenew') === 'ready';
        const loi = famReady ? this.loiFams.length : null;
        const urgent = famReady ? this.famRenewList.filter(i => { const a = this.getFamRenewAlert(i); return a.isWarrantyUrgent || a.isExpiryUrgent; }).length : null;

        // Kho dự phòng: fam sẵn sàng so với số fam đến hạn renew trong 7 ngày tới
        let stockReady = null, famDue7 = null;
        if (famReady) {
            const now = new Date(); now.setHours(0, 0, 0, 0);
            const limit = now.getTime() + 7 * 86400000;
            stockReady = this.khoRenewList.filter(k => (k.status || 'Sẵn sàng') === 'Sẵn sàng').length;
            famDue7 = this.groupedRenewDates.reduce((n, g) => {
                const d = this.parseDateDMY(g.date);
                return d && d.getTime() >= now.getTime() && d.getTime() <= limit ? n + g.count : n;
            }, 0);
        }

        // Admin: nợ CTV tháng này + tỷ lệ gia hạn 30 ngày (cần sheet tài chính)
        let ctvDebt = null, ctvDebtList = [], renewRate = null, renewedCount = 0;
        const tx = this.currentUserRole === 'admin' ? (this.db.DATA_YTB || []) : [];
        if (tx.length) {
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
            const renewedEmails = new Set();
            tx.forEach(r => {
                const p = String(r[keys[0]] || '').trim().split('/');
                if (p.length < 3) return;
                const mk = `${p[1].padStart(2, '0')}/${p[2]}`;
                const staff = staffKey ? String(r[staffKey] || '').trim() : '';
                const isDnc = !staff || ['dnc', 'admin', 'mrculy'].includes(staff.toLowerCase());
                if (mk === monthKey && !isDnc) debts[staff] = (debts[staff] || 0) + money(r[keys[11]]) - money(r[keys[8]]);
                const t = new Date(+p[2], +p[1] - 1, +p[0]).getTime();
                const type = String(r[keys[2]] || '').toLowerCase();
                if (t >= since && type.includes('gia h')) renewedEmails.add(String(r[keys[3]] || '').toLowerCase().trim());
            });
            ctvDebtList = Object.entries(debts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
            ctvDebt = ctvDebtList.reduce((n, [, v]) => n + v, 0);
            renewedCount = renewedEmails.size;
            const lost = uniq(lost30);
            renewRate = renewedCount + lost > 0 ? Math.round(renewedCount * 100 / (renewedCount + lost)) : null;
        }

        return {
            due7: due7.length, due7Today: due7.filter(c => c.daysLeft === 0).length,
            overdue7: overdue7.length,
            loi, urgent, stockReady, famDue7,
            stockShort: stockReady !== null && famDue7 > stockReady,
            ctvDebt, ctvDebtList, renewRate, renewedCount, lost30: uniq(lost30),
        };
    },

    goTodayList(kind) {
        if (kind === 'due7' || kind === 'overdue7') {
            this.dataGocSearchQuery = '';
            this.dataGocFilterProduct = 'all'; this.dataGocFilterCategory = 'all'; this.dataGocFilterStaff = 'all';
            this.dataGocFilterStatus = kind;
            this.dataGocActiveTab = 'list';
            this.activeModule = 'data_goc';
        } else if (kind === 'loi') {
            this.famRenewView = 'loi_fam';
            this.activeModule = 'fam_renew';
        } else if (kind === 'stock' || kind === 'urgent') {
            this.famRenewView = kind === 'stock' ? 'requests' : 'table';
            if (kind === 'urgent') this.famRenewShowUrgentOnly = true;
            this.activeModule = 'fam_renew';
        } else if (kind === 'ctv') {
            this.activeModule = 'pnl_calculator';
        }
    }
});
