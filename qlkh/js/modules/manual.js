// manual.js — tách từ admin/index.html (logic giữ nguyên, đã chỉnh trong qlkh)
QLKH.define('manual', {
    productCatalog: [],

    newProduct: {
        product: '',
        duration: 1,
        price: 0,
        cost: 0
    },

    manualOrderForm: {
        orderCode: '',
        date: new Date().toISOString().split('T')[0],
        email: '',
        productKey: '',
        price: 0,
        cost: 0,
        ctv: 'Admin',
        note: ''
    },

    manualOrderResultData: {
        orderCode: '',
        email: '',
        product: '',
        hsd: '',
        price: 0,
        note: ''
    },

    duplicateWarning: '',

    onManualProductSelect() {
        const prod = this.productCatalog.find(p => p.key === this.manualOrderForm.productKey);
        if (prod) {
            this.manualOrderForm.price = prod.price;
            this.manualOrderForm.cost = prod.cost;
        }
    },

    updateProductKey(p) {
        p.key = `${p.product}-${p.duration}`;
    },

    addNewProductToCatalog() {
        this.productCatalog.unshift({
            product: this.newProduct.product,
            duration: parseInt(this.newProduct.duration),
            price: parseInt(this.newProduct.price),
            cost: parseInt(this.newProduct.cost),
            key: `${this.newProduct.product}-${this.newProduct.duration}`
        });
        this.saveProductCatalog();
        this.newProduct.product = '';
        this.newProduct.duration = 1;
        this.newProduct.price = 0;
        this.newProduct.cost = 0;
    },

    saveProductCatalog() {
        localStorage.setItem('goshop_product_catalog', JSON.stringify(this.productCatalog));
        this.showToast('Đã lưu bảng giá thành công!');
    },

    checkDuplicateOrder() {
        this.duplicateWarning = '';
        if (!this.manualOrderForm.email || !this.manualOrderForm.productKey || !this.db.DATA_YTB) return;
        
        const inputEmail = this.manualOrderForm.email.toLowerCase().trim();
        const inputProduct = this.manualOrderForm.productKey.toLowerCase().trim();
        if (!inputEmail || this.db.DATA_YTB.length === 0) return;
        
        const keys = Object.keys(this.db.DATA_YTB[0] || {});
        if (keys.length < 5) return;
        
        // Scan the last 200 rows to find duplicates
        const recentLogs = this.db.DATA_YTB.slice(-200).reverse();
        for (let row of recentLogs) {
            const rowEmail = String(row[keys[3]] || '').toLowerCase().trim();
            const rowProduct = String(row[keys[4]] || '').toLowerCase().trim();
            const rowDate = String(row[keys[0]] || '').trim();
            
            if (rowEmail === inputEmail) {
                // Check if the product contains each other (e.g., Youtube-6 vs Youtube)
                if (rowProduct.includes(inputProduct) || inputProduct.includes(rowProduct)) {
                    this.duplicateWarning = `Đã nhập gói ${rowProduct.toUpperCase()} vào ngày ${rowDate}. Hãy cẩn thận bị double đơn!`;
                    // Also trigger lucide re-render safely
                    setTimeout(() => { if(window.lucide) window.lucide.createIcons(); }, 10);
                    return;
                }
            }
        }
    },

    calculateManualOrderHSD(dateStr, productKey) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        let date = new Date(parts[0], parts[1] - 1, parts[2]);
        if (isNaN(date.getTime())) return '';

        let months = 1;
        const prod = this.productCatalog.find(p => p.key === productKey);
        if (prod && prod.duration) {
            months = Number(prod.duration);
        } else if (productKey && productKey.match(/(\d+)\s*tháng/i)) {
            months = Number(productKey.match(/(\d+)\s*tháng/i)[1]);
        } else if (productKey && productKey.match(/(\d+)\s*năm/i)) {
            months = Number(productKey.match(/(\d+)\s*năm/i)[1]) * 12;
        }
        date.setMonth(date.getMonth() + months);

        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    },

    getPreviewManualOrderCode() {
        const d = this.manualOrderForm.date ? this.manualOrderForm.date.split('-') : ['2026', '07', '14'];
        return 'GS' + d[0].slice(-2) + d[1] + d[2] + '-AUTO';
    },

    copyManualCustomerInfo() {
        const d = this.manualOrderResultData.email ? this.manualOrderResultData : {
            orderCode: this.manualOrderForm.orderCode || this.getPreviewManualOrderCode(),
            email: this.manualOrderForm.email || 'Chưa nhập Email',
            product: this.manualOrderForm.productKey || 'Chưa chọn gói',
            hsd: this.calculateManualOrderHSD(this.manualOrderForm.date, this.manualOrderForm.productKey),
            price: this.manualOrderForm.price || 0,
            note: this.manualOrderForm.note || ''
        };
        const msg = `🎉 THÔNG TIN KÍCH HOẠT ĐƠN HÀNG GO SHOP\n━━━━━━━━━━━━━━━━━━━━\n📌 Mã đơn: ${d.orderCode}\n📧 Email: ${d.email}\n📦 Sản phẩm: ${d.product}\n⏳ Hạn sử dụng (HSD): ${d.hsd}\n💰 Số tiền thanh toán: ${Number(d.price || 0).toLocaleString('vi-VN')} đ\n📝 Ghi chú: ${d.note || 'Không có'}\n━━━━━━━━━━━━━━━━━━━━\nCảm ơn quý khách đã tin dùng dịch vụ!`;
        navigator.clipboard.writeText(msg);
        this.showToast('Đã sao chép thông tin gửi khách vào Clipboard!');
    },

    async submitManualOrder() {
        if(!this.CONFIG.FINANCIAL_WEBAPP_URL) {
            this.showToast('Lỗi: Chưa cấu hình FINANCIAL_WEBAPP_URL');
            return;
        }
        this.isLoading = true;
        try {
            const [yyyy, mm, dd] = this.manualOrderForm.date.split('-');
            const dateStr = `${dd}/${mm}/${yyyy}`;
            const orderCode = (this.manualOrderForm.orderCode || '').trim() || ('GS' + yyyy.slice(-2) + mm + dd + '-' + Math.floor(100 + Math.random() * 900));
            const hsdStr = this.calculateManualOrderHSD(this.manualOrderForm.date, this.manualOrderForm.productKey);

            await fetch(this.CONFIG.FINANCIAL_WEBAPP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'log_financial_ytb',
                    date: dateStr,
                    orderCode: orderCode,
                    email: this.manualOrderForm.email,
                    product: this.manualOrderForm.productKey,
                    ctv: this.manualOrderForm.ctv,
                    price: this.manualOrderForm.price,
                    cost: this.manualOrderForm.cost,
                    hsd: hsdStr,
                    note: `[Mã: ${orderCode} | HSD: ${hsdStr}] ${this.manualOrderForm.note}`
                })
            });
            
            this.manualOrderResultData = {
                orderCode: orderCode,
                email: this.manualOrderForm.email,
                product: this.manualOrderForm.productKey,
                hsd: hsdStr,
                price: Number(this.manualOrderForm.price) || 0,
                note: this.manualOrderForm.note
            };

            this.showToast('Đã thêm đơn hàng & tạo mẫu gửi khách thành công!');
            // Reset form partially
            this.manualOrderForm.orderCode = '';
            this.manualOrderForm.email = '';
            this.manualOrderForm.productKey = '';
            this.manualOrderForm.price = 0;
            this.manualOrderForm.cost = 0;
            this.manualOrderForm.note = '';
            this.$nextTick(() => { if(window.lucide) window.lucide.createIcons(); });
        } catch (e) {
            console.error('Submit manual order error:', e);
            this.showToast('Có lỗi xảy ra, vui lòng thử lại.');
        } finally {
            this.isLoading = false;
        }
    }
});
