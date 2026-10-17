// pnl.js — tách từ admin/index.html (logic giữ nguyên, đã chỉnh trong qlkh)
QLKH.define('pnl', {
    quoteForm: {
        productKey: '',
        seller: 'DNC',
        commission: 0,
        qty: 1
    },

    get quoteMetrics() {
        const item = this.productCatalog.find(p => p.key === this.quoteForm.productKey);
        if (!item) return { revenue: 0, cost: 0, commissionTotal: 0, grossProfit: 0 };
        
        const qty = parseInt(this.quoteForm.qty) || 1;
        const comm = this.quoteForm.seller === 'DNC' ? 0 : (parseFloat(this.quoteForm.commission) || 0);
        
        const revenue = item.price * qty;
        const cost = item.cost * qty;
        const commissionTotal = comm * qty;
        const grossProfit = revenue - cost - commissionTotal;
        
        return { revenue, cost, commissionTotal, grossProfit };
    },

    onQuoteChange() {
        const item = this.productCatalog.find(p => p.key === this.quoteForm.productKey);
        const defaultComm = item ? (item.defaultCommission || 0) : 50000;
        
        if (this.quoteForm.seller === 'DNC') {
            this.quoteForm.commission = 0;
        } else {
            // Nếu đang chọn CTV, tự động fill mức hoa hồng từ bảng giá
            this.quoteForm.commission = defaultComm;
        }
    },

    globalStaffCost: localStorage.getItem('goshop_globalStaffCost') ? parseFloat(localStorage.getItem('goshop_globalStaffCost')) : 0,

    globalMiscCost: localStorage.getItem('goshop_globalMiscCost') ? parseFloat(localStorage.getItem('goshop_globalMiscCost')) : 0,

    _profitMonthInit: false,

    globalProfitFilter: {
        type: 'month',
        month: '',
        startDate: '',
        endDate: ''
    },

    syncedNotes: [],

    isCheckingSync: false,

    availableMonths: [],

    showCashflowModal: false,

    globalProfitReport: {
        month: '',
        totalTransactions: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalCommission: 0,
        totalMisc: 0,
        netProfit: 0,
        breakdown: [],
        cashflow: {
            dncRevenue: 0,
            totalCost: 0,
            ctvDebts: {}
        }
    },

    calculateGlobalProfit() {
        localStorage.setItem('goshop_globalStaffCost', this.globalStaffCost || 0);
        localStorage.setItem('goshop_globalMiscCost', this.globalMiscCost || 0);
        const data = this.db.DATA_YTB || [];
        if (data.length === 0) return;

        const keys = Object.keys(data[0] || {}); 
        
        // Lọc available months
        const monthsSet = new Set();
        data.forEach(row => {
            const dateStr = row[keys[0]] || '';
            if (!dateStr || dateStr.toString().trim() === '') return;
            
            // Strict date validation: DD/MM/YYYY
            const rawDate = dateStr.toString().trim();
            if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) return;
            
            const parts = rawDate.split('/');
            monthsSet.add(`${parts[1]}/${parts[2]}`);
        });
        
        this.availableMonths = Array.from(monthsSet).sort((a, b) => {
            const [m1, y1] = a.split('/');
            const [m2, y2] = b.split('/');
            return new Date(y2, m2 - 1) - new Date(y1, m1 - 1);
        });

        // Lần đầu: chọn tháng mới nhất. Sau đó "" nghĩa là "Tất cả các tháng" (bản cũ không chọn được).
        if (!this._profitMonthInit && this.globalProfitFilter.type === 'month' && !this.globalProfitFilter.month && this.availableMonths.length > 0) {
            this.globalProfitFilter.month = this.availableMonths[0];
            this._profitMonthInit = true;
        }

        let totalTransactions = 0;
        let totalNew = 0;
        let totalRenewal = 0;
        let totalRevenue = 0;
        let totalCost = 0;
        let totalCommission = 0;
        let totalMisc = 0;
        let productsMap = {};
        
        let dncRevenue = 0;
        let totalCostCF = 0;
        let ctvDebts = {};
        
        let staffKey = keys.find(k => {
            let kl = k.toLowerCase();
            return kl === 'ctv' || kl.includes('người bán') || kl.includes('nhân sự') || kl === 'staff';
        });
        
        if (!staffKey) {
            for (let i = 0; i < Math.min(50, data.length); i++) {
                for (let k of keys) {
                    let v = String(data[i][k] || '').toLowerCase().trim();
                    if (['dnc', 'tuan', 'vuong', 'loc', 'admin'].includes(v)) {
                        staffKey = k;
                        break;
                    }
                }
                if (staffKey) break;
            }
        }

        data.forEach(row => {
            const dateStr = row[keys[0]] || '';
            if (!dateStr || dateStr.toString().trim() === '') return;
            const parts = dateStr.toString().split('/');
            if (parts.length < 3) return;
            
            const rowDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
            const rowMonthKey = `${parts[1]}/${parts[2]}`;
            
            // Lọc theo filter
            if (this.globalProfitFilter.type === 'month') {
                if (this.globalProfitFilter.month && rowMonthKey !== this.globalProfitFilter.month) return;
            } else if (this.globalProfitFilter.type === 'custom') {
                if (this.globalProfitFilter.startDate && rowDateStr < this.globalProfitFilter.startDate) return;
                if (this.globalProfitFilter.endDate && rowDateStr > this.globalProfitFilter.endDate) return;
            }

            // Parse các cột
            const cleanNum = (val) => {
                let s = String(val).toLowerCase().replace(/\s/g, '');
                if (!s) return 0;
                let multiplier = 1;
                if (s.endsWith('k')) {
                    multiplier = 1000;
                    s = s.slice(0, -1);
                } else if (s.endsWith('m') || s.endsWith('tr')) {
                    multiplier = 1000000;
                    s = s.replace(/m|tr/g, '');
                }
                s = s.replace(/[.,]/g, '').replace(/[^0-9-]/g, '');
                return (parseFloat(s) || 0) * multiplier;
            };

            const price = cleanNum(keys.length > 11 ? row[keys[11]] : '0');
            const cost = cleanNum(keys.length > 9 ? row[keys[9]] : '0');
            const comm = cleanNum(keys.length > 8 ? row[keys[8]] : '0');
            const misc = cleanNum(keys.length > 10 ? row[keys[10]] : '0');
            
            const explicitNetStr = keys.length > 12 ? String(row[keys[12]] || '').trim() : '';
            const explicitNet = explicitNetStr !== '' ? cleanNum(explicitNetStr) : null;
            
            const productName = keys.length > 4 ? (row[keys[4]] || 'Khác') : 'Khác';
            const tType = keys.length > 2 ? String(row[keys[2]] || '').trim().toLowerCase() : '';

            totalTransactions++;
            if (tType === 'new') {
                totalNew++;
            } else if (tType === 'gia hạn' || tType === 'gia han') {
                totalRenewal++;
            }

            totalRevenue += price;
            totalCost += cost;
            totalCommission += comm;
            totalMisc += misc;

            // Cashflow tracking
            let staffStr = staffKey ? String(row[staffKey] || '').trim() : '';
            
            const isDnc = staffStr === '' || staffStr.toLowerCase() === 'dnc' || staffStr.toLowerCase() === 'admin' || staffStr.toLowerCase() === 'mrculy';
            
            if (isDnc) {
                dncRevenue += price;
            } else {
                if (!ctvDebts[staffStr]) ctvDebts[staffStr] = 0;
                ctvDebts[staffStr] += (price - comm);
            }
            totalCostCF += cost;

            const net = explicitNet !== null ? explicitNet : (price - cost - comm - misc);

            if (!productsMap[productName]) {
                productsMap[productName] = { count: 0, net: 0, transactions: [] };
            }
            productsMap[productName].count++;
            productsMap[productName].net += net;
            productsMap[productName].transactions.push({
                date: dateStr,
                type: keys.length > 2 ? (row[keys[2]] || '') : '',
                email: keys.length > 3 ? (row[keys[3]] || '') : '',
                price: price,
                cost: cost,
                comm: comm,
                misc: misc,
                net: net
            });
        });

        this.globalProfitReport.month = this.globalProfitFilter.type === 'month' ? (this.globalProfitFilter.month || 'Tất cả') : 'Tùy chọn';
        this.globalProfitReport.totalTransactions = totalTransactions;
        this.globalProfitReport.totalNew = totalNew;
        this.globalProfitReport.totalRenewal = totalRenewal;
        this.globalProfitReport.totalRevenue = totalRevenue;
        this.globalProfitReport.totalCost = totalCost;
        this.globalProfitReport.totalCommission = totalCommission;
        this.globalProfitReport.totalMisc = totalMisc;
        
        const globalMisc = (parseFloat(this.globalStaffCost) || 0) + (parseFloat(this.globalMiscCost) || 0);
        const totalGross = totalRevenue - totalCost - totalCommission - totalMisc;
        this.globalProfitReport.netProfit = totalGross - globalMisc;
        
        this.globalProfitReport.cashflow = {
            dncRevenue,
            totalCost: totalCostCF,
            ctvDebts
        };
        
        this.globalProfitReport.breakdown = Object.keys(productsMap).map(k => ({
            name: k,
            count: productsMap[k].count,
            net: productsMap[k].net,
            transactions: productsMap[k].transactions
        })).sort((a, b) => b.net - a.net);
        
        if (this.showCashflowModal) {
            this.checkFinanceSyncStatus();
        }
    },

    async checkFinanceSyncStatus() {
        this.isCheckingSync = true;
        try {
            const financeAPI = 'https://script.google.com/macros/s/AKfycbwNLNVPwzy5pg7M9-i_fledNhvtMQOGKFLSNmX4tp-0RDJgINEfiZuuVLzETfKVMJcs7A/exec';
            const res = await fetch(`${financeAPI}?user=admin@godnc.com`);
            const data = await res.json();
            if (data.status === 'success' && data.data) {
                this.syncedNotes = data.data.map(tx => tx.note || '');
            }
        } catch(err) {
            console.error('Failed to check sync status:', err);
        } finally {
            this.isCheckingSync = false;
        }
    },

    isSynced(note) {
        return this.syncedNotes.includes(note);
    },

    async syncSpecificCashflow(type, amount, category, note, event) {
        // Chỉ chốt sổ theo 1 tháng cụ thể, tránh ghi nhầm số liệu gộp sang Finance OS.
        if (this.globalProfitFilter.type !== 'month' || !this.globalProfitFilter.month) {
            this.showToast('⚠️ Hãy chọn 1 tháng cụ thể trước khi chốt sổ.');
            return;
        }
        if(amount === 0) {
            this.showToast('Số tiền bằng 0, không cần đồng bộ!');
            return;
        }
        
        const btn = event ? event.target.closest('button') : null;
        if (btn) btn.classList.add('opacity-50', 'pointer-events-none');
        
        this.showToast('Đang đồng bộ...');
        try {
            const d = new Date();
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const financeAPI = 'https://script.google.com/macros/s/AKfycbwNLNVPwzy5pg7M9-i_fledNhvtMQOGKFLSNmX4tp-0RDJgINEfiZuuVLzETfKVMJcs7A/exec';
            
            const payload = {
                user: 'admin@godnc.com',
                date: dateStr,
                type: type,
                amount: amount,
                category: category,
                note: note,
                sourceAccount: 'MBB01',
                destAccount: ''
            };

            const res = await fetch(financeAPI, { method: 'POST', body: JSON.stringify(payload) });
            const result = await res.json();
            if (result.status === 'success') {
                this.showToast('✅ Đã đồng bộ: ' + note);
                this.syncedNotes.push(note);
            } else {
                this.showToast('❌ Lỗi đồng bộ: ' + (result.message || 'Unknown'));
            }
        } catch(err) {
            console.error('Sync Error:', err);
            this.showToast('❌ Lỗi kết nối khi đồng bộ!');
        } finally {
            if (btn) btn.classList.remove('opacity-50', 'pointer-events-none');
        }
    },


    renderProfitChart() {
        const data = this.db.DATA_YTB || [];
        if (data.length === 0) return;
        
        const keys = Object.keys(data[0] || {});
        const monthlyData = {};
        
        data.forEach(row => {
            const dateStr = row[keys[0]] || '';
            if (!dateStr || dateStr.toString().trim() === '') return;
            
            // Strict date validation
            const rawDate = dateStr.toString().trim();
            if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) return;
            
            const parts = rawDate.split('/');
            const monthKey = `${parts[1]}/${parts[2]}`;
            
            const cleanNum = (val) => {
                let s = String(val).toLowerCase().replace(/\s/g, '');
                if (!s) return 0;
                let multiplier = 1;
                if (s.endsWith('k')) {
                    multiplier = 1000;
                    s = s.slice(0, -1);
                } else if (s.endsWith('m') || s.endsWith('tr')) {
                    multiplier = 1000000;
                    s = s.replace(/m|tr/g, '');
                }
                s = s.replace(/[.,]/g, '').replace(/[^0-9-]/g, '');
                return (parseFloat(s) || 0) * multiplier;
            };
            
            const price = cleanNum(keys.length > 11 ? row[keys[11]] : '0');
            const cost = cleanNum(keys.length > 9 ? row[keys[9]] : '0');
            const comm = cleanNum(keys.length > 8 ? row[keys[8]] : '0');
            const misc = cleanNum(keys.length > 10 ? row[keys[10]] : '0');
            
            const explicitNetStr = keys.length > 12 ? String(row[keys[12]] || '').trim() : '';
            const explicitNet = explicitNetStr !== '' ? cleanNum(explicitNetStr) : null;
            const net = explicitNet !== null ? explicitNet : (price - cost - comm - misc);
            
            const explicitMrrStr = keys.length > 13 ? String(row[keys[13]] || '').trim() : '';
            const mrr = explicitMrrStr !== '' ? cleanNum(explicitMrrStr) : null;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    label: monthKey,
                    sortKey: `${parts[2]}${parts[1]}`, 
                    revenue: 0,
                    mrr: 0,
                    hasMrrData: false,
                    net: 0
                };
            }
            
            monthlyData[monthKey].revenue += price;
            if (mrr !== null) {
                monthlyData[monthKey].mrr += mrr;
                monthlyData[monthKey].hasMrrData = true;
            }
            monthlyData[monthKey].net += net;
        });
        
        const sortedMonths = Object.values(monthlyData).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
        
        const labels = sortedMonths.map(m => m.label);
        const hasAnyMrr = sortedMonths.some(m => m.hasMrrData && m.mrr > 0);
        const lineData = sortedMonths.map(m => hasAnyMrr ? m.mrr : m.revenue);
        const netData = sortedMonths.map(m => m.net);
        
        const ctx = document.getElementById('profitChartCanvas');
        if (!ctx) return;
        
        if (window._qlkhProfitChart) {
            window._qlkhProfitChart.destroy();
        }
        
        window._qlkhProfitChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'line',
                        label: hasAnyMrr ? 'MRR' : 'Tổng Doanh Thu',
                        data: lineData,
                        borderColor: '#ef4444',
                        backgroundColor: '#ef4444',
                        borderWidth: 2,
                        tension: 0.3,
                        yAxisID: 'y'
                    },
                    {
                        type: 'bar',
                        label: 'Lợi Nhuận Tháng',
                        data: netData,
                        backgroundColor: '#3b82f6',
                        borderRadius: 4,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('vi-VN').format(context.parsed.y) + ' đ';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: {
                            callback: function(value) {
                                if (value >= 1000000) {
                                    return (value / 1000000) + 'Tr';
                                }
                                if (value >= 1000) {
                                    return (value / 1000) + 'K';
                                }
                                return value;
                            }
                        }
                    }
                }
            }
        });
    }
});
