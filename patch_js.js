const fs = require('fs');
let content = fs.readFileSync('admin/index.html', 'utf8');

const oldJs = `                // Global Profit Report State
                globalStaffCost: 0,
                globalMiscCost: 0,
                globalProfitReport: {
                    month: '',
                    totalTransactions: 0,
                    totalRevenue: 0,
                    totalCost: 0,
                    totalCommission: 0,
                    totalMisc: 0,
                    netProfit: 0,
                    breakdown: []
                },
                calculateGlobalProfit() {
                    const data = this.db.DATA_YTB || [];
                    if (data.length === 0) return;

                    const monthlyData = {};
                    let latestMonth = '';

                    const keys = Object.keys(data[0] || {}); 
                    if(keys.length < 12) return; // Yêu cầu mảng đủ 12 cột từ A -> L

                    data.forEach(row => {
                        const dateStr = row[keys[0]] || '';
                        if (!dateStr || dateStr.toString().trim() === '') return;
                        
                        // Parse MM/YYYY
                        const parts = dateStr.toString().split('/');
                        if (parts.length < 3) return;
                        const monthKey = \`\${parts[1]}/\${parts[2]}\`;

                        if (!monthlyData[monthKey]) {
                            monthlyData[monthKey] = {
                                totalTransactions: 0,
                                totalRevenue: 0,
                                totalCost: 0,
                                totalCommission: 0,
                                totalMisc: 0,
                                products: {}
                            };
                            latestMonth = monthKey; // Sẽ update dần, dòng dưới cùng là tháng mới nhất
                        }

                        // L: Price (11), J: Cost (9), I: Hoa hồng (8), K: Phát sinh (10)
                        const price = parseFloat(String(row[keys[11]] || '0').replace(/[^0-9.-]+/g,"")) || 0;
                        const cost = parseFloat(String(row[keys[9]] || '0').replace(/[^0-9.-]+/g,"")) || 0;
                        const comm = parseFloat(String(row[keys[8]] || '0').replace(/[^0-9.-]+/g,"")) || 0;
                        const misc = parseFloat(String(row[keys[10]] || '0').replace(/[^0-9.-]+/g,"")) || 0;
                        
                        const productName = row[keys[4]] || 'Khác'; // E: Gói

                        const m = monthlyData[monthKey];
                        m.totalTransactions++;
                        m.totalRevenue += price;
                        m.totalCost += cost;
                        m.totalCommission += comm;
                        m.totalMisc += misc;

                        const net = price - cost - comm - misc;

                        if (!m.products[productName]) {
                            m.products[productName] = { count: 0, net: 0 };
                        }
                        m.products[productName].count++;
                        m.products[productName].net += net;
                    });

                    if (latestMonth && monthlyData[latestMonth]) {
                        const m = monthlyData[latestMonth];
                        this.globalProfitReport.month = latestMonth;
                        this.globalProfitReport.totalTransactions = m.totalTransactions;
                        this.globalProfitReport.totalRevenue = m.totalRevenue;
                        this.globalProfitReport.totalCost = m.totalCost;
                        this.globalProfitReport.totalCommission = m.totalCommission;
                        this.globalProfitReport.totalMisc = m.totalMisc;
                        
                        const globalMisc = (parseFloat(this.globalStaffCost) || 0) + (parseFloat(this.globalMiscCost) || 0);
                        const totalGross = m.totalRevenue - m.totalCost - m.totalCommission - m.totalMisc;
                        this.globalProfitReport.netProfit = totalGross - globalMisc;
                        
                        this.globalProfitReport.breakdown = Object.keys(m.products).map(k => ({
                            name: k,
                            count: m.products[k].count,
                            net: m.products[k].net
                        })).sort((a, b) => b.net - a.net);
                    }
                },`;

const newJs = `                // Global Profit Report State
                globalStaffCost: 0,
                globalMiscCost: 0,
                globalProfitFilter: {
                    type: 'month',
                    month: '',
                    startDate: '',
                    endDate: ''
                },
                availableMonths: [],
                globalProfitReport: {
                    month: '',
                    totalTransactions: 0,
                    totalRevenue: 0,
                    totalCost: 0,
                    totalCommission: 0,
                    totalMisc: 0,
                    netProfit: 0,
                    breakdown: []
                },
                calculateGlobalProfit() {
                    const data = this.db.DATA_YTB || [];
                    if (data.length === 0) return;

                    const keys = Object.keys(data[0] || {}); 
                    
                    // Lọc available months
                    const monthsSet = new Set();
                    data.forEach(row => {
                        const dateStr = row[keys[0]] || '';
                        if (!dateStr || dateStr.toString().trim() === '') return;
                        const parts = dateStr.toString().split('/');
                        if (parts.length >= 3) {
                            monthsSet.add(\`\${parts[1]}/\${parts[2]}\`);
                        }
                    });
                    
                    this.availableMonths = Array.from(monthsSet).sort((a, b) => {
                        const [m1, y1] = a.split('/');
                        const [m2, y2] = b.split('/');
                        return new Date(y2, m2 - 1) - new Date(y1, m1 - 1);
                    });

                    if (this.globalProfitFilter.type === 'month' && !this.globalProfitFilter.month && this.availableMonths.length > 0) {
                        this.globalProfitFilter.month = this.availableMonths[0]; 
                    }

                    let totalTransactions = 0;
                    let totalRevenue = 0;
                    let totalCost = 0;
                    let totalCommission = 0;
                    let totalMisc = 0;
                    let productsMap = {};

                    data.forEach(row => {
                        const dateStr = row[keys[0]] || '';
                        if (!dateStr || dateStr.toString().trim() === '') return;
                        const parts = dateStr.toString().split('/');
                        if (parts.length < 3) return;
                        
                        const rowDateStr = \`\${parts[2]}-\${parts[1]}-\${parts[0]}\`; // YYYY-MM-DD
                        const rowMonthKey = \`\${parts[1]}/\${parts[2]}\`;
                        
                        // Lọc theo filter
                        if (this.globalProfitFilter.type === 'month') {
                            if (rowMonthKey !== this.globalProfitFilter.month) return;
                        } else if (this.globalProfitFilter.type === 'custom') {
                            if (this.globalProfitFilter.startDate && rowDateStr < this.globalProfitFilter.startDate) return;
                            if (this.globalProfitFilter.endDate && rowDateStr > this.globalProfitFilter.endDate) return;
                        }

                        // Parse các cột
                        const price = parseFloat(String(keys.length > 11 ? row[keys[11]] : '0').replace(/[^0-9.-]+/g,"")) || 0;
                        const cost = parseFloat(String(keys.length > 9 ? row[keys[9]] : '0').replace(/[^0-9.-]+/g,"")) || 0;
                        const comm = parseFloat(String(keys.length > 8 ? row[keys[8]] : '0').replace(/[^0-9.-]+/g,"")) || 0;
                        const misc = parseFloat(String(keys.length > 10 ? row[keys[10]] : '0').replace(/[^0-9.-]+/g,"")) || 0;
                        
                        const productName = keys.length > 4 ? (row[keys[4]] || 'Khác') : 'Khác';

                        totalTransactions++;
                        totalRevenue += price;
                        totalCost += cost;
                        totalCommission += comm;
                        totalMisc += misc;

                        const net = price - cost - comm - misc;

                        if (!productsMap[productName]) {
                            productsMap[productName] = { count: 0, net: 0 };
                        }
                        productsMap[productName].count++;
                        productsMap[productName].net += net;
                    });

                    this.globalProfitReport.month = this.globalProfitFilter.type === 'month' ? this.globalProfitFilter.month : 'Tùy chọn';
                    this.globalProfitReport.totalTransactions = totalTransactions;
                    this.globalProfitReport.totalRevenue = totalRevenue;
                    this.globalProfitReport.totalCost = totalCost;
                    this.globalProfitReport.totalCommission = totalCommission;
                    this.globalProfitReport.totalMisc = totalMisc;
                    
                    const globalMisc = (parseFloat(this.globalStaffCost) || 0) + (parseFloat(this.globalMiscCost) || 0);
                    const totalGross = totalRevenue - totalCost - totalCommission - totalMisc;
                    this.globalProfitReport.netProfit = totalGross - globalMisc;
                    
                    this.globalProfitReport.breakdown = Object.keys(productsMap).map(k => ({
                        name: k,
                        count: productsMap[k].count,
                        net: productsMap[k].net
                    })).sort((a, b) => b.net - a.net);
                },`;

content = content.replace(oldJs, newJs);
fs.writeFileSync('admin/index.html', content);
console.log("Patched JS");
