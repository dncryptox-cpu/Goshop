// refunds.js — tách từ admin/index.html (logic giữ nguyên, đã chỉnh trong qlkh)
QLKH.define('refunds', {
    refundForm: {
        email: '',
        product: '',
        amount: 0,
        months: 1,
        purchaseDate: new Date().toISOString().split('T')[0],
        refundDate: new Date().toISOString().split('T')[0],
        totalDays: 0,
        usedDays: 0,
        refundAmount: 0
    },

    refundMode: 'single',

    bulkRefunds: [],

    bulkRefundTotal: 0,

    showRefundAIModal: false,

    refundAIText: '',

    showBulkAIModal: false,

    bulkAIText: '',

    bulkRefundGlobalDate: new Date().toISOString().split('T')[0],

    calculateRefund() {
        const months = parseInt(this.refundForm.months) || 1;
        const amount = parseInt(this.refundForm.amount) || 0;
        if(amount === 0) {
            this.refundForm.refundAmount = 0;
            return;
        }
        
        const pDate = new Date(this.refundForm.purchaseDate);
        const rDate = new Date(this.refundForm.refundDate);
        
        if(isNaN(pDate.getTime()) || isNaN(rDate.getTime())) return;
        
        const totalDays = months * 30;
        const diffTime = rDate - pDate;
        const usedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        this.refundForm.totalDays = totalDays;
        this.refundForm.usedDays = usedDays > 0 ? usedDays : 0;
        
        if(this.refundForm.usedDays >= totalDays) {
            this.refundForm.refundAmount = 0;
        } else if(this.refundForm.usedDays <= 0) {
            this.refundForm.refundAmount = amount;
        } else {
            const pricePerDay = amount / totalDays;
            const remainingDays = totalDays - this.refundForm.usedDays;
            this.refundForm.refundAmount = Math.round(remainingDays * pricePerDay);
        }
    },

    parseRefundAI() {
        const text = this.refundAIText.trim();
        if(!text) {
            this.showToast('Vui lòng nhập nội dung!');
            return;
        }
        
        try {
            const lines = text.split('\n').filter(l => l.trim().length > 0);
            const parts = text.split('|').map(p => p.trim());
            
            // Try parsing with parts if it uses | separator like youtube
            if(parts.length >= 3) {
                const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
                if(emailMatch) this.refundForm.email = emailMatch[0];
                
                this.refundForm.product = parts[0].replace(/[\w.-]+@[\w.-]+\.\w+/, '').trim();
                if(!this.refundForm.product) this.refundForm.product = parts[1];
                
                // Find amount (e.g. 300k, 150.000)
                const amountMatch = text.match(/(\d+)(k|K|000)/);
                if(amountMatch) {
                    let amt = parseInt(amountMatch[1]);
                    if(amountMatch[2].toLowerCase() === 'k') amt = amt * 1000;
                    else if(amountMatch[2] === '000' && amt < 1000) amt = amt * 1000; // e.g. 150 -> 150000
                    this.refundForm.amount = amt;
                }
                
                // Find months
                const monthMatch = text.match(/(\d+)\s*(th|Th|TH|tháng|Tháng)/);
                if(monthMatch) this.refundForm.months = parseInt(monthMatch[1]);
                else if(text.toLowerCase().includes('1 năm') || text.toLowerCase().includes('12th')) this.refundForm.months = 12;
                
                // Find purchase date
                const dateMatch = text.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
                if(dateMatch) {
                    const dParts = dateMatch[0].split('/');
                    this.refundForm.purchaseDate = `${dParts[2]}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
                }
            } else {
                // Extract freely
                const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
                if(emailMatch) this.refundForm.email = emailMatch[0];
                
                const amountMatch = text.match(/(\d+)(k|K|000)/);
                if(amountMatch) {
                    let amt = parseInt(amountMatch[1]);
                    if(amountMatch[2].toLowerCase() === 'k') amt = amt * 1000;
                    else if(amountMatch[2] === '000' && amt < 1000) amt = amt * 1000;
                    this.refundForm.amount = amt;
                }
                
                const monthMatch = text.match(/(\d+)\s*(th|Th|TH|tháng|Tháng)/);
                if(monthMatch) this.refundForm.months = parseInt(monthMatch[1]);
                else if(text.toLowerCase().includes('1 năm')) this.refundForm.months = 12;
                
                const dateMatch = text.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
                if(dateMatch) {
                    const dParts = dateMatch[0].split('/');
                    this.refundForm.purchaseDate = `${dParts[2]}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
                }
                
                // Guess product
                const products = ['Youtube', 'Netflix', 'Spotify', 'Canva', 'Capcut'];
                for(let p of products) {
                    if(text.toLowerCase().includes(p.toLowerCase())) {
                        this.refundForm.product = p;
                        break;
                    }
                }
            }
            
            this.calculateRefund();
            this.showRefundAIModal = false;
            this.showToast('Đã trích xuất thông tin thành công!');
        } catch(e) {
            this.showToast('Không thể phân tích, vui lòng kiểm tra lại!');
        }
    },

    copyRefundInfo() {
        const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
        const pDateParts = this.refundForm.purchaseDate.split('-');
        const rDateParts = this.refundForm.refundDate.split('-');
        const pDateStr = `${pDateParts[2]}/${pDateParts[1]}/${pDateParts[0]}`;
        const rDateStr = `${rDateParts[2]}/${rDateParts[1]}/${rDateParts[0]}`;
        
        const info = `📋 THÔNG TIN HOÀN TIỀN
- Email khách: ${this.refundForm.email || 'Chưa xác định'}
- Sản phẩm: ${this.refundForm.product || 'Chưa xác định'}
- Tổng tiền đã mua: ${formatter.format(this.refundForm.amount)}
- Gói: ${this.refundForm.months} tháng
- Ngày mua: ${pDateStr}
- Ngày hoàn: ${rDateStr}
- Số ngày đã sử dụng: ${this.refundForm.usedDays} ngày
- Số ngày chưa sử dụng: ${this.refundForm.totalDays - this.refundForm.usedDays} ngày

💰 SỐ TIỀN HOÀN LẠI: ${formatter.format(this.refundForm.refundAmount)}`;

        navigator.clipboard.writeText(info).then(() => {
            this.showToast('Đã copy thông tin hoàn tiền!');
        });
    },

    async submitRefund() {
        this.calculateRefund();
        
        if(!this.refundForm.product || this.refundForm.amount <= 0) {
            this.showToast('Vui lòng nhập đủ thông tin Sản phẩm và Số tiền!');
            return;
        }
        
        const pDateStr = this.formatDateToDDMMYYYY(this.refundForm.purchaseDate);
        const rDateStr = this.formatDateToDDMMYYYY(this.refundForm.refundDate);
        
        // Ghi vào webhook
        if(this.CONFIG.WEBAPP_URL) {
            this.isLoading = true;
            try {
                await fetch(this.CONFIG.WEBAPP_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'log_refund',
                        refundDate: rDateStr,
                        email: this.refundForm.email || '',
                        product: this.refundForm.product,
                        purchaseDate: pDateStr,
                        months: this.refundForm.months,
                        amountPaid: this.refundForm.amount,
                        usedDays: this.refundForm.usedDays,
                        remainingDays: this.refundForm.totalDays - this.refundForm.usedDays,
                        refundAmount: this.refundForm.refundAmount,
                        customerName: "Admin",
                        customerPhone: ""
                    })
                });
                this.showToast('Đã lưu dữ liệu hoàn tiền vào Google Sheet!');
            } catch(e) {
                console.error('Error', e);
                this.showToast('Đã copy thông tin (nhưng chưa lưu được vào Sheet vì lỗi mạng)');
            }
            this.isLoading = false;
        } else {
            this.showToast('Chưa cấu hình WEBAPP_URL để lưu!');
        }
        
        this.copyRefundInfo();
    },

    parseDateLocal(dateStr) {
        if (!dateStr) return new Date();
        const s = String(dateStr).trim();
        if (s.toLowerCase() === 'hôm nay') {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d;
        }
        if (s.includes('/')) {
            const parts = s.split('/');
            if (parts.length >= 3) {
                const day = parseInt(parts[0], 10) || 1;
                const month = (parseInt(parts[1], 10) || 1) - 1;
                const year = parseInt(parts[2], 10) || 2026;
                return new Date(year, month, day, 0, 0, 0, 0);
            }
        } else if (s.includes('-')) {
            const parts = s.split('-');
            if (parts.length >= 3) {
                const year = parseInt(parts[0], 10) || 2026;
                const month = (parseInt(parts[1], 10) || 1) - 1;
                const day = parseInt(parts[2], 10) || 1;
                return new Date(year, month, day, 0, 0, 0, 0);
            }
        }
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    },

    formatDateToDDMMYYYY(dateStr) {
        if (!dateStr) return '';
        const s = String(dateStr).trim();
        if (s.includes('/')) {
            const parts = s.split('/');
            if (parts.length >= 3) {
                return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
            }
        } else if (s.includes('-')) {
            const parts = s.split('-');
            if (parts.length >= 3) {
                if (parts[0].length === 4) {
                    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
                } else {
                    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
                }
            }
        }
        return s;
    },

    recalculateRow(row) {
        if (!row.amount || !row.months) {
            row.refundAmount = 0;
            return;
        }
        
        const pDate = this.parseDateLocal(row.purchaseDateDisplay);
        const rDate = this.parseDateLocal(row.refundDate);
        
        pDate.setHours(0, 0, 0, 0);
        rDate.setHours(0, 0, 0, 0);
        
        const totalDays = (parseInt(row.months) || 1) * 30;
        const diffTime = rDate - pDate;
        let usedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (usedDays < 0) usedDays = 0;
        
        row.totalDays = totalDays;
        row.usedDays = usedDays;
        row.remainingDays = totalDays - usedDays;
        
        const amount = parseFloat(row.amount) || 0;
        if (usedDays >= totalDays) {
            row.refundAmount = 0;
        } else if (usedDays <= 0) {
            row.refundAmount = amount;
        } else {
            const pricePerDay = amount / totalDays;
            row.refundAmount = Math.round(row.remainingDays * pricePerDay);
        }
        
        this.recalculateBulkRefundTotal();
    },

    updateBulkRefundGlobalDate() {
        this.bulkRefunds.forEach(row => {
            row.refundDate = this.bulkRefundGlobalDate;
            this.recalculateRow(row);
        });
    },

    parseBulkRefundAI() {
        const text = this.bulkAIText.trim();
        if(!text) {
            this.showToast('Vui lòng dán danh sách vào!');
            return;
        }
        
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        let parsedCount = 0;
        
        lines.forEach(line => {
            let email = '', product = '', amount = 0, months = 1, purchaseDate = '';
            
            const emailMatch = line.match(/[\w.-]+@[\w.-]+\.\w+/);
            if(emailMatch) email = emailMatch[0];
            
            const amountMatch = line.match(/(\d+)(k|K|000)/);
            if(amountMatch) {
                let amt = parseInt(amountMatch[1]);
                if(amountMatch[2].toLowerCase() === 'k') amt = amt * 1000;
                else if(amountMatch[2] === '000' && amt < 1000) amt = amt * 1000;
                amount = amt;
            }
            
            const monthMatch = line.match(/(\d+)\s*(th|Th|TH|tháng|Tháng)/);
            if(monthMatch) months = parseInt(monthMatch[1]);
            else if(line.toLowerCase().includes('1 năm') || line.toLowerCase().includes('12th')) months = 12;
            
            let pDate = new Date();
            pDate.setHours(0,0,0,0);
            const dateMatch = line.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
            if(dateMatch) {
                const dParts = dateMatch[0].split('/');
                purchaseDate = `${dParts[2]}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
                pDate = new Date(parseInt(dParts[2]), parseInt(dParts[1]) - 1, parseInt(dParts[0]), 0, 0, 0, 0);
            } else {
                purchaseDate = pDate.toISOString().split('T')[0];
            }
            
            const parts = line.split('|').map(p => p.trim());
            if(parts.length >= 3) {
                product = parts[0].replace(/[\w.-]+@[\w.-]+\.\w+/, '').trim();
                if(!product) product = parts[1];
            } else {
                const products = ['Youtube', 'Netflix', 'Spotify', 'Canva', 'Capcut'];
                for(let p of products) {
                    if(line.toLowerCase().includes(p.toLowerCase())) {
                        product = p;
                        break;
                    }
                }
                if(!product) product = 'Không rõ';
            }
            
            const rDate = new Date(this.bulkRefundGlobalDate ? this.bulkRefundGlobalDate : new Date());
            rDate.setHours(0,0,0,0);
            const rDateStr = rDate.toISOString().split('T')[0];
            
            const totalDays = months * 30;
            const diffTime = rDate - pDate;
            let usedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if(usedDays < 0) usedDays = 0;
            
            let refundAmount = 0;
            if(amount > 0) {
                if(usedDays >= totalDays) {
                    refundAmount = 0;
                } else if(usedDays <= 0) {
                    refundAmount = amount;
                } else {
                    const pricePerDay = amount / totalDays;
                    const remainingDays = totalDays - usedDays;
                    refundAmount = Math.round(remainingDays * pricePerDay);
                }
            }
            
            let displayDate = 'Hôm nay';
            if (dateMatch) {
                displayDate = dateMatch[0];
            } else {
                const today = new Date();
                displayDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
            }

            this.bulkRefunds.push({
                email, product, amount, months, 
                purchaseDate, purchaseDateDisplay: displayDate,
                refundDate: rDateStr,
                totalDays, usedDays, remainingDays: totalDays - usedDays,
                refundAmount
            });
            parsedCount++;
        });
        
        this.recalculateBulkRefundTotal();
        this.$nextTick(() => { if(window.lucide) window.lucide.createIcons(); });
        this.showBulkAIModal = false;
        this.showToast(`Đã phân tích thành công ${parsedCount} tài khoản!`);
    },

    removeBulkRow(index) {
        this.bulkRefunds.splice(index, 1);
        this.recalculateBulkRefundTotal();
    },

    recalculateBulkRefundTotal() {
        this.bulkRefundTotal = this.bulkRefunds.reduce((sum, row) => sum + row.refundAmount, 0);
    },

    copyBulkRefundInfo() {
        if(this.bulkRefunds.length === 0) return;
        
        const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
        let info = `📋 BILL HOÀN TIỀN LÔ (${this.bulkRefunds.length} TÀI KHOẢN)\n\n`;
        
        this.bulkRefunds.forEach((row, i) => {
            info += `${i + 1}. ${row.email || 'Khách'} - ${row.product} - Mua: ${row.purchaseDateDisplay} (${row.months}th) - Hoàn: ${formatter.format(row.refundAmount)}\n`;
        });
        
        info += `\n💰 TỔNG TIỀN HOÀN: ${formatter.format(this.bulkRefundTotal)}`;

        navigator.clipboard.writeText(info).then(() => {
            this.showToast('Đã copy Bill Lô hoàn tiền!');
        });
    },

    async submitBulkRefund() {
        if(this.bulkRefunds.length === 0) return;
        
        if(!this.CONFIG.WEBAPP_URL) {
            this.showToast('Chưa cấu hình WEBAPP_URL để lưu!');
            return;
        }
        
        this.isLoading = true;
        let successCount = 0;
        
        try {
            for(let row of this.bulkRefunds) {
                const rDateStr = this.formatDateToDDMMYYYY(row.refundDate);
                const pDateStr = this.formatDateToDDMMYYYY(row.purchaseDateDisplay);
                
                await fetch(this.CONFIG.WEBAPP_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'log_refund',
                        refundDate: rDateStr,
                        email: row.email,
                        product: row.product,
                        purchaseDate: pDateStr,
                        months: row.months,
                        amountPaid: row.amount,
                        usedDays: row.usedDays,
                        remainingDays: row.remainingDays,
                        refundAmount: row.refundAmount,
                        customerName: "Admin",
                        customerPhone: ""
                    })
                });
                successCount++;
            }
            this.showToast(`Đã lưu thành công ${successCount} dữ liệu vào Sheet!`);
            this.copyBulkRefundInfo();
            this.bulkRefunds = []; // Xóa danh sách sau khi lưu
            this.bulkRefundTotal = 0;
        } catch(e) {
            console.error('Error', e);
            this.showToast('Có lỗi xảy ra khi lưu một số dòng. Vui lòng kiểm tra lại mạng!');
        }
        
        this.isLoading = false;
    }
});
