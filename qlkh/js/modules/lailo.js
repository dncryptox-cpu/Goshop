// lailo.js — tab "Lãi Lỗ Từng Đơn": lãi/lỗ của từng dòng trong DATA(YTB) + DATA(GCC), theo sản phẩm.
// Cột đọc theo vị trí như phần Tính Lợi Nhuận: A ngày, C loại, D email, E sản phẩm, G SKU, H CTV,
// I hoa hồng, J giá vốn, K phát sinh, L giá bán, M lãi (Profit).
(() => {
const memo = { v: -1, len: -1, rows: [] }; // ngoài Alpine: không reactive, chỉ tính lại khi dữ liệu đổi
QLKH.define('lailo', {
    llProduct: 'CapCut',
    llMonth: 'all',
    llSearch: '',
    llOnlyFlag: false,
    llSort: { key: 'date', dir: -1 },
    llLimit: 200,

    llMoney(v) {
        let x = String(v == null ? '' : v).toLowerCase().replace(/\s|đ|₫/g, '');
        if (!x) return 0;
        let mul = 1;
        if (x.endsWith('k')) { mul = 1e3; x = x.slice(0, -1); }
        else if (/(m|tr)$/.test(x)) { mul = 1e6; x = x.replace(/m|tr/g, ''); }
        // 375.000 / 1.234.567 → bỏ dấu chấm nghìn; 1,5 → 1.5
        x = x.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
        return (parseFloat(x.replace(/[^0-9.-]/g, '')) || 0) * mul;
    },

    // Gom SKU về nhóm sản phẩm: Capcut-6, CapCutcanhan-6 → CapCut; Youtube-12, YoutubePlus-6 → YouTube…
    llFamily(sku) {
        const s = String(sku || '').replace(/-\d+(-\d+)?$/, '').toLowerCase();
        if (!s) return 'Khác';
        if (s.startsWith('capcut')) return 'CapCut';
        if (s.startsWith('youtube') || s === 'ytb') return 'YouTube';
        if (s.startsWith('gpt') || s.includes('chatgpt')) return 'ChatGPT';
        if (s.startsWith('canva')) return 'Canva';
        if (/^(\d+(gb|tb)|googleone|gg)/.test(s)) return 'Google One';
        if (s.startsWith('spotify')) return 'Spotify';
        if (s.startsWith('netflix')) return 'Netflix';
        if (s.startsWith('adobe')) return 'Adobe';
        return String(sku).replace(/-\d+(-\d+)?$/, '');
    },

    // Mọi dòng giao dịch đã chuẩn hoá (tính lại lãi để đối chiếu với cột Profit)
    get llAllRows() {
        const ver = this._dbVersion;
        const data = (this.db && this.db.DATA_YTB) || [];
        if (memo.v === ver && memo.len === data.length) return memo.rows;
        const out = [];
        for (const r of data) {
            const k = Object.keys(r);
            const d = String(r[k[0]] || '').trim().split('/');
            if (d.length !== 3) continue;
            const sku = String(r[k[6]] || r[k[4]] || '').trim();
            if (!sku) continue;
            const price = this.llMoney(r[k[11]]), cost = this.llMoney(r[k[9]]), hh = this.llMoney(r[k[8]]), ps = this.llMoney(r[k[10]]);
            const profitCell = String(r[k[12]] || '').trim();
            const profit = profitCell ? this.llMoney(profitCell) : price - cost - hh - ps;
            const calc = price - cost - hh - ps;
            const flags = [];
            if (profit < 0) flags.push('Lỗ');
            else if (profit === 0) flags.push('Lãi 0đ');
            if (price === 0) flags.push('Giá bán 0đ');
            if (cost > 0 && ps < 0 && -ps >= cost) flags.push('Phát sinh xoá giá vốn');
            if (profit > price && price > 0) flags.push('Lãi > giá bán');
            if (Math.abs(profit - calc) > 1) flags.push('Profit khác công thức (' + Math.round(calc).toLocaleString('vi-VN') + 'đ)');
            const tab = r._tab || '';
            out.push({
                ref: (tab === 'DATA(GCC)' ? 'GCC' : tab === 'DATA(YTB)' ? 'YTB' : '?') + (r._line ? '-' + r._line : ''),
                date: `${d[2]}-${d[1].padStart(2, '0')}-${d[0].padStart(2, '0')}`,
                month: `${d[2]}-${d[1].padStart(2, '0')}`,
                type: String(r[k[2]] || '').trim(),
                customer: String(r[k[3]] || '').trim(),
                sku, family: this.llFamily(sku),
                ctv: String(r[k[7]] || '').trim(),
                price, cost, hh, ps, profit,
                margin: price ? profit / price : null,
                flags
            });
        }
        memo.v = ver; memo.len = data.length; memo.rows = out;
        return out;
    },

    get llFamilies() {
        const m = {};
        this.llAllRows.forEach(r => { m[r.family] = (m[r.family] || 0) + 1; });
        return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
    },

    get llRowsOfProduct() {
        return this.llAllRows.filter(r => this.llProduct === 'all' || r.family === this.llProduct);
    },

    get llMonths() {
        return [...new Set(this.llRowsOfProduct.map(r => r.month))].sort().reverse();
    },

    get llRows() {
        const q = this.llSearch.trim().toLowerCase();
        const { key, dir } = this.llSort;
        return this.llRowsOfProduct
            .filter(r => this.llMonth === 'all' || r.month === this.llMonth)
            .filter(r => !this.llOnlyFlag || r.flags.length)
            .filter(r => !q || [r.ref, r.customer, r.sku, r.ctv, r.type, r.flags.join(' ')].join(' ').toLowerCase().includes(q))
            .sort((a, b) => {
                const va = a[key], vb = b[key];
                if (typeof va === 'number' || typeof vb === 'number') return ((va ?? -Infinity) - (vb ?? -Infinity)) * dir;
                return String(va || '').localeCompare(String(vb || '')) * dir;
            });
    },

    get llSummary() {
        const rows = this.llRowsOfProduct.filter(r => this.llMonth === 'all' || r.month === this.llMonth);
        const revenue = rows.reduce((a, r) => a + r.price, 0);
        const profit = rows.reduce((a, r) => a + r.profit, 0);
        const waived = rows.filter(r => r.flags.includes('Phát sinh xoá giá vốn'));
        return {
            orders: rows.length, revenue, profit,
            margin: revenue ? profit / revenue : null,
            avgProfit: rows.length ? profit / rows.length : 0,
            loss: rows.filter(r => r.profit < 0).length,
            zero: rows.filter(r => r.profit === 0).length,
            flagged: rows.filter(r => r.flags.length).length,
            waivedCost: waived.reduce((a, r) => a + r.cost, 0), waivedOrders: waived.length,
        };
    },

    // Theo tháng × SKU: thấy giá bán / giá vốn đổi qua từng thời điểm
    get llMonthly() {
        const g = new Map();
        this.llRowsOfProduct.forEach(r => {
            const k = r.month + '|' + r.sku;
            if (!g.has(k)) g.set(k, { month: r.month, sku: r.sku, list: [] });
            g.get(k).list.push(r);
        });
        const avg = (l, f) => l.reduce((a, r) => a + r[f], 0) / l.length;
        return [...g.values()].map(x => {
            const prices = x.list.map(r => r.price), costs = x.list.map(r => r.cost);
            return {
                key: x.month + '|' + x.sku, month: x.month, sku: x.sku, orders: x.list.length,
                minPrice: Math.min(...prices), maxPrice: Math.max(...prices), avgPrice: avg(x.list, 'price'),
                minCost: Math.min(...costs), maxCost: Math.max(...costs), avgCost: avg(x.list, 'cost'),
                avgProfit: avg(x.list, 'profit'), profit: x.list.reduce((a, r) => a + r.profit, 0),
            };
        }).sort((a, b) => b.month.localeCompare(a.month) || a.sku.localeCompare(b.sku));
    },

    llSetSort(key) {
        const numeric = ['price', 'cost', 'hh', 'ps', 'profit', 'margin'].includes(key);
        this.llSort = this.llSort.key === key ? { key, dir: -this.llSort.dir } : { key, dir: numeric ? -1 : 1 };
    },

    llVnd(v) { return (v == null || isNaN(v)) ? '—' : Math.round(v).toLocaleString('vi-VN') + 'đ'; },
    llRange(a, b) { return a === b ? this.llVnd(a) : `${Math.round(a / 1000)}k–${Math.round(b / 1000)}k`; },
    llPct(v) { return v == null ? '—' : (v * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%'; },
    llMonthLabel(m) { return m ? m.split('-').reverse().join('/') : ''; }
});
})();
