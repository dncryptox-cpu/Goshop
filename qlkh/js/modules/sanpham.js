// sanpham.js — tab "Sản Phẩm": tổng quan bán hàng theo sản phẩm (mặc định tất cả, lọc từng sản phẩm),
// khách cần nhắn, danh sách khách, giá đang bán; riêng CapCut có thêm kho tài khoản (tab Stock CC).
// Nguồn: DATA(YTB) + DATA(GCC) (dùng chung llAllRows).
(() => {
const memo = { src: null, due: null, product: null, out: [] }; // ngoài Alpine, tính lại khi dữ liệu đổi
QLKH.define('sanpham', {
    ccProduct: 'all',        // 'all' hoặc tên sản phẩm (CapCut, YouTube, ChatGPT…)
    ccView: 'todo',          // todo | customers | stock (stock chỉ có với CapCut)
    ccSearch: '',
    ccStatus: 'all',         // all | active | due | lapsed | lost
    ccOpen: null,            // khách đang mở lịch sử
    ccStock: [],             // tài khoản kho (không giữ mật khẩu)
    ccDueDays: 14,

    get ccRows() { return this.ccProduct === 'all' ? this.llAllRows : this.llAllRows.filter(r => r.family === this.ccProduct); },

    // Tên hiển thị trong tin nhắn cho khách
    PRODUCT_NAMES: { CapCut: 'CapCut Pro', YouTube: 'YouTube Premium', ChatGPT: 'ChatGPT Plus', Canva: 'Canva Pro', 'Google One': 'Google One', Spotify: 'Spotify Premium', Netflix: 'Netflix', Adobe: 'Adobe' },

    ccSetProduct(p) {
        this.ccProduct = p;
        this.ccOpen = null;
        if (this.ccView === 'stock' && p !== 'CapCut') this.ccView = 'todo';
        if (p === 'CapCut') this.ensureData(['stockcc']);
        this.$nextTick(() => this.renderProductChart());
    },

    ccToday() { const t = new Date(); t.setHours(0, 0, 0, 0); return t; },
    ccDays(iso) { if (!iso) return null; const d = new Date(iso + 'T00:00:00'); return Math.round((d - this.ccToday()) / 86400000); },
    ccFmtDate(iso) { return iso ? iso.split('-').reverse().join('/') : '—'; },

    // Khách = email (lấy từ cột Email kể cả khi lẫn ghi chú), không có email thì dùng tên/mã ở cột B.
    ccKey(r) {
        const m = String(r.customer).match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/);
        if (m) return { key: m[0].toLowerCase(), label: m[0], hasEmail: true };
        const name = r.idName && !/^\d+$/.test(r.idName) ? r.idName : (r.customer || r.idName || r.ref);
        return { key: 'n:' + name.toLowerCase(), label: name, hasEmail: false };
    },

    get ccCustomers() {
        const src = this.llAllRows;
        if (memo.src === src && memo.due === this.ccDueDays && memo.product === this.ccProduct) return memo.out;
        const map = new Map();
        for (const r of this.ccRows) {
            const id = this.ccKey(r);
            const key = r.family + '|' + id.key;
            if (!map.has(key)) map.set(key, { key, person: id.key, label: id.label, hasEmail: id.hasEmail, family: r.family, orders: [] });
            map.get(key).orders.push(r);
        }
        const out = [...map.values()].map(c => {
            c.orders.sort((a, b) => a.date.localeCompare(b.date));
            const last = c.orders[c.orders.length - 1];
            const expiry = c.orders.reduce((m, o) => (o.expiry && o.expiry > m ? o.expiry : m), '');
            const daysLeft = this.ccDays(expiry);
            const status = daysLeft === null ? 'unknown' : daysLeft > this.ccDueDays ? 'active' : daysLeft >= 0 ? 'due' : daysLeft >= -30 ? 'lapsed' : 'lost';
            return {
                ...c, last, expiry, daysLeft, status,
                first: c.orders[0].date, count: c.orders.length,
                spent: c.orders.reduce((a, o) => a + o.price, 0),
                profit: c.orders.reduce((a, o) => a + o.profit, 0),
                sku: last.sku, ctv: last.ctv,
            };
        });
        memo.src = src; memo.due = this.ccDueDays; memo.product = this.ccProduct; memo.out = out;
        return out;
    },

    get ccStats() {
        const rows = this.ccRows, cs = this.ccCustomers, t = this.ccToday().getTime();
        const inRange = (r, from, to) => { const d = new Date(r.date + 'T00:00:00').getTime(); return d > t - from * 864e5 && d <= t - to * 864e5; };
        const sum = (list, f) => list.reduce((a, r) => a + r[f], 0);
        const cur = rows.filter(r => inRange(r, 30, -1)), prev = rows.filter(r => inRange(r, 60, 30));
        const matured = cs.filter(c => this.ccDays(c.orders[0].expiry) !== null && this.ccDays(c.orders[0].expiry) < 0);
        return {
            customers: new Set(cs.map(c => c.person)).size,
            subscriptions: cs.length,
            active: cs.filter(c => c.status === 'active' || c.status === 'due').length,
            due: cs.filter(c => c.status === 'due').length,
            lapsed: cs.filter(c => c.status === 'lapsed').length,
            lost: cs.filter(c => c.status === 'lost').length,
            orders30: cur.length, ordersPrev: prev.length,
            revenue30: sum(cur, 'price'), revenuePrev: sum(prev, 'price'),
            profit30: sum(cur, 'profit'), profitPrev: sum(prev, 'profit'),
            totalRevenue: sum(rows, 'price'), totalProfit: sum(rows, 'profit'),
            repeatRate: matured.length ? matured.filter(c => c.count > 1).length / matured.length : null,
            matured: matured.length,
            noEmail: cs.filter(c => !c.hasEmail).length,
        };
    },

    ccDelta(cur, prev) {
        if (!prev) return cur ? 'mới có' : '';
        const p = Math.round((cur - prev) / prev * 100);
        return (p > 0 ? '+' : '') + p + '% so với 30 ngày trước';
    },

    // Việc cần làm: sắp hết hạn trước, rồi vừa hết hạn (còn cứu được)
    get ccTodo() {
        return this.ccCustomers
            .filter(c => c.status === 'due' || c.status === 'lapsed')
            .sort((a, b) => (a.daysLeft >= 0 ? a.daysLeft : 1000 - a.daysLeft) - (b.daysLeft >= 0 ? b.daysLeft : 1000 - b.daysLeft));
    },

    get ccCustomerList() {
        const q = this.ccSearch.trim().toLowerCase();
        return this.ccCustomers
            .filter(c => this.ccStatus === 'all' || c.status === this.ccStatus || (this.ccStatus === 'active' && c.status === 'due'))
            .filter(c => !q || [c.label, c.sku, c.ctv, c.family, ...c.orders.map(o => o.customer)].join(' ').toLowerCase().includes(q))
            .sort((a, b) => (b.expiry || '').localeCompare(a.expiry || ''));
    },

    // Giá đang bán: lấy từ đơn gần nhất của từng gói
    get ccPrices() {
        const m = new Map();
        [...this.ccRows].sort((a, b) => a.date.localeCompare(b.date)).forEach(r => {
            const x = m.get(r.sku) || { sku: r.sku, family: r.family, orders: 0, active: 0 };
            x.orders++; x.price = r.price; x.cost = r.cost; x.profit = r.profit; x.date = r.date;
            m.set(r.sku, x);
        });
        this.ccCustomers.forEach(c => { if ((c.status === 'active' || c.status === 'due') && m.has(c.sku)) m.get(c.sku).active++; });
        // gói còn khách dùng lên trước, rồi gói bán nhiều
        return [...m.values()].sort((a, b) => b.active - a.active || b.orders - a.orders);
    },

    // Khi xem tất cả: từng sản phẩm đóng góp bao nhiêu
    get ccByProduct() {
        const m = new Map();
        const t = this.ccToday().getTime();
        this.llAllRows.forEach(r => {
            const x = m.get(r.family) || { family: r.family, orders: 0, revenue: 0, profit: 0, profit30: 0 };
            x.orders++; x.revenue += r.price; x.profit += r.profit;
            if (new Date(r.date + 'T00:00:00').getTime() > t - 30 * 864e5) x.profit30 += r.profit;
            m.set(r.family, x);
        });
        return [...m.values()].sort((a, b) => b.profit - a.profit);
    },

    get ccMonthly() {
        const m = new Map();
        this.ccRows.forEach(r => {
            const x = m.get(r.month) || { month: r.month, isNew: 0, renew: 0, revenue: 0, profit: 0 };
            if (/gia h/i.test(r.type)) x.renew++; else x.isNew++;
            x.revenue += r.price; x.profit += r.profit;
            m.set(r.month, x);
        });
        return [...m.values()].sort((a, b) => a.month.localeCompare(b.month));
    },

    renderProductChart() {
        const el = document.getElementById('ccChart');
        if (!el || !window.Chart) return;
        const data = this.ccMonthly;
        if (window._qlkhCcChart) window._qlkhCcChart.destroy();
        window._qlkhCcChart = new Chart(el, {
            data: {
                labels: data.map(x => this.llMonthLabel(x.month)),
                datasets: [
                    { type: 'bar', label: 'Đơn mới', data: data.map(x => x.isNew), backgroundColor: '#6366f1', stack: 'o', yAxisID: 'y', borderRadius: 3, maxBarThickness: 32 },
                    { type: 'bar', label: 'Gia hạn', data: data.map(x => x.renew), backgroundColor: '#a5b4fc', stack: 'o', yAxisID: 'y', borderRadius: 3, maxBarThickness: 32 },
                    { type: 'line', label: 'Lãi', data: data.map(x => x.profit), borderColor: '#10b981', backgroundColor: '#10b981', yAxisID: 'y1', tension: 0, pointRadius: 3 },
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } },
                    tooltip: { callbacks: { label: c => c.dataset.label + ': ' + (c.dataset.yAxisID === 'y1' ? Math.round(c.parsed.y).toLocaleString('vi-VN') + 'đ' : c.parsed.y + ' đơn') } } },
                scales: {
                    y: { beginAtZero: true, stacked: true, ticks: { precision: 0 }, title: { display: true, text: 'Đơn' } },
                    y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { callback: v => v >= 1e6 ? (v / 1e6) + 'tr' : (v / 1e3) + 'k' } },
                    x: { stacked: true }
                }
            }
        });
    },

    // Tin nhắn nhắc gia hạn: giá theo đơn gần nhất của đúng gói khách đang dùng
    ccMessage(c) {
        const p = this.ccPrices.find(x => x.sku === c.sku);
        const months = (c.sku.match(/-(\d+)$/) || [])[1];
        const name = this.PRODUCT_NAMES[c.family] || c.family;
        const when = c.daysLeft > 0 ? `sẽ hết hạn sau ${c.daysLeft} ngày (${this.ccFmtDate(c.expiry)})`
            : c.daysLeft === 0 ? `hết hạn hôm nay (${this.ccFmtDate(c.expiry)})` : `đã hết hạn từ ${this.ccFmtDate(c.expiry)}`;
        const price = p && p.price ? ` Phí gia hạn ${months ? months + ' tháng' : ''}: ${Math.round(p.price).toLocaleString('vi-VN')}đ.` : '';
        return `Chào bạn, gói ${name} của bạn ${when}.${price} Bạn muốn gia hạn tiếp thì nhắn mình để giữ nguyên tài khoản nhé!`;
    },

    async ccCopyMessage(c) {
        await this.copyToClipboard(this.ccMessage(c), 'tin nhắn');
    },

    // Kho tài khoản CapCut (tab Stock CC). Chỉ giữ thông tin cần thống kê, không giữ mật khẩu.
    async loadCapcutStock() {
        const rows = await this.gvizCsv(this.CONFIG.TRANSACTION_SHEET_ID, 'Stock CC');
        this.ccStock = rows.map(r => {
            const v = r._rawVals || [];
            const acc = String(v[2] || '').trim();
            if (!/@/.test(acc)) return null;
            const hsd = (String(v[9] || '').match(/(\d{4})-(\d{2})-(\d{2})/) || [])[0] || '';
            return {
                stt: String(v[0] || '').trim(),
                account: acc.replace(/^(.{3}).*(@.*)$/, '$1***$2'),
                customer: String(v[4] || '').trim(),
                hsd,
                devices: parseInt(v[10]) || 0,
                shareCustomer: String(v[13] || '').trim(),
                sharePaid: String(v[15] || '').trim().toUpperCase() === 'TRUE',
            };
        }).filter(Boolean);
    },

    get ccStockStats() {
        const s = this.ccStock;
        const exp = s.filter(x => x.hsd && this.ccDays(x.hsd) < 0).length;
        const soon = s.filter(x => x.hsd && this.ccDays(x.hsd) >= 0 && this.ccDays(x.hsd) <= 14).length;
        return {
            total: s.length,
            assigned: s.filter(x => x.customer).length,
            free: s.filter(x => !x.customer).length,
            expired: exp, soon,
            shareUnpaid: s.filter(x => x.shareCustomer && !x.sharePaid).length,
        };
    },

    ccStatusLabel(s) {
        return { active: 'Đang dùng', due: 'Sắp hết hạn', lapsed: 'Vừa hết hạn', lost: 'Đã rời', unknown: 'Không rõ HSD' }[s] || s;
    },
    ccStatusClass(s) {
        return { active: 'bg-emerald-50 text-emerald-700', due: 'bg-amber-50 text-amber-700', lapsed: 'bg-red-50 text-red-700', lost: 'bg-gray-100 text-gray-500', unknown: 'bg-gray-100 text-gray-500' }[s] || '';
    }
});
})();
