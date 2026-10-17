// datagoc.js — tách từ admin/index.html (logic giữ nguyên, đã chỉnh trong qlkh)
QLKH.define('datagoc', {
    dataGocList: [],

    dataGocSearchQuery: '',

    dataGocFilterProduct: 'all',

    dataGocFilterCategory: 'all',

    dataGocFilterStaff: 'all',

    dataGocFilterStatus: 'all',

    isFetchingDataGoc: false,

    isUpdatingDataGoc: false,

    dataGocAiInput: '',

    dataGocMode: 'renew',

    dataGocPreview: null,

    dataGocActiveTab: 'list',

    dataGocViewMode: 'table',

    dataGocBulkInput: '',

    dataGocBulkList: [],

    isUpdatingBulk: false,

    bulkAutoOverwrite: true,

    appDataDiffList: [],

    appDataDiffFilter: 'all_changes',

    appDataDiffSearch: '',

    isSyncingAppDataToGoc: false,

    get filteredAppDataDiffList() {
        let list = this.appDataDiffList || [];
        if (this.appDataDiffFilter === 'all_changes') {
            list = list.filter(item => item.status === 'new' || item.status === 'modified');
        } else if (this.appDataDiffFilter !== 'all') {
            list = list.filter(item => item.status === this.appDataDiffFilter);
        }
        if (this.appDataDiffSearch.trim()) {
            const q = this.appDataDiffSearch.trim().toLowerCase();
            list = list.filter(item => (item.email && item.email.toLowerCase().includes(q)) || (item.subEmail && item.subEmail.toLowerCase().includes(q)));
        }
        return list;
    },

    get filteredDataGocList() {
        let list = this.dataGocList || [];
        const q = (this.dataGocSearchQuery || '').trim().toLowerCase();
        if (q) {
            list = list.filter(item => 
                String(item.email || '').toLowerCase().includes(q) ||
                String(item.subEmail || '').toLowerCase().includes(q) ||
                String(item.product || '').toLowerCase().includes(q) ||
                String(item.staff || '').toLowerCase().includes(q)
            );
        }
        if (this.dataGocFilterProduct !== 'all') {
            list = list.filter(item => String(item.product || '').toLowerCase() === String(this.dataGocFilterProduct).toLowerCase());
        }
        if (this.dataGocFilterCategory !== 'all') {
            list = list.filter(item => String(item.category || '').toLowerCase() === String(this.dataGocFilterCategory).toLowerCase());
        }
        if (this.dataGocFilterStaff !== 'all') {
            list = list.filter(item => String(item.staff || '').toLowerCase() === String(this.dataGocFilterStaff).toLowerCase());
        }
        if (this.dataGocFilterStatus !== 'all') {
            if (this.dataGocFilterStatus === 'active') {
                list = list.filter(item => item.daysLeft !== null && item.daysLeft > 15);
            } else if (this.dataGocFilterStatus === 'warning') {
                list = list.filter(item => item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= 15);
            } else if (this.dataGocFilterStatus === 'expired') {
                list = list.filter(item => item.daysLeft !== null && item.daysLeft < 0);
            }
        }
        return list;
    },

    dataGocDisplayLimit: 25,

    get paginatedDataGocList() {
        return this.filteredDataGocList.slice(0, this.dataGocDisplayLimit);
    },

    async fetchDataGoc(forceRefresh = false) {
        if (this.isFetchingDataGoc && !forceRefresh) return;
        if (!forceRefresh) {
            try {
                const cached = localStorage.getItem('goshop_cached_datagoc');
                if (cached) {
                    this.dataGocList = JSON.parse(cached);
                }
            } catch(err) {}
        }
        this.isFetchingDataGoc = true;
        try {
            const csvUrl = `https://docs.google.com/spreadsheets/d/${this.CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=DATAGoc&t=${Date.now()}`;
            const res = await fetch(csvUrl);
            if (res.ok) {
                const text = await res.text();
                const data = this.parseCSV(text);
                this.dataGocList = data.map((row, idx) => {
                    const keys = Object.keys(row);
                    const kProduct = keys.find(k => k.toLowerCase().includes('sản phẩm') || k.toLowerCase().includes('san pham') || k.toLowerCase().includes('product')) || keys[0];
                    const kCategory = keys.find(k => k.toLowerCase().includes('phân loại') || k.toLowerCase().includes('phan loai') || k.toLowerCase().includes('category')) || keys[1];
                    const kEmail = keys.find(k => k.toLowerCase().includes('mail') || k.toLowerCase().includes('email')) || keys[2];
                    const kPurchaseDate = keys.find(k => k.toLowerCase().includes('ngày mua') || k.toLowerCase().includes('ngay mua')) || keys[3];
                    const kMonths = keys.find(k => k.toLowerCase().includes('số tháng') || k.toLowerCase().includes('so thang') || k.toLowerCase().includes('month')) || keys[4];
                    const kExpiry = keys.find(k => k.toLowerCase() === 'hsd' || k.toLowerCase().includes('hạn sử dụng') || k.toLowerCase().includes('expiry')) || keys[5];
                    const kSubEmail = keys.find(k => k.toLowerCase().includes('mail phụ') || k.toLowerCase().includes('mail phu') || k.toLowerCase().includes('sub')) || keys[6];
                    const kStaff = keys.find(k => k.toLowerCase() === 'ctv' || k.toLowerCase().includes('nhân viên') || k.toLowerCase().includes('staff')) || keys[7];
                    const kDaysLeft = keys.find(k => k.toLowerCase().includes('ngày còn lại') || k.toLowerCase().includes('ngay con lai') || k.toLowerCase().includes('days')) || keys[8];

                    const emailVal = String(row[kEmail] || '').trim();
                    if (!emailVal || !emailVal.includes('@')) return null;

                    const expStr = this.cleanDateDisplay(row[kExpiry] || '');
                    let calcDays = row[kDaysLeft] !== undefined && row[kDaysLeft] !== '' ? parseInt(row[kDaysLeft]) : null;
                    if (isNaN(calcDays) || calcDays === null) {
                        if (expStr) {
                            const parts = expStr.split('/');
                            if (parts.length === 3) {
                                const expDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                                if (!isNaN(expDate.getTime())) {
                                    calcDays = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 3600 * 24));
                                }
                            }
                        }
                    }

                    return {
                        row: idx + 2,
                        product: String(row[kProduct] || 'YTB').trim(),
                        category: String(row[kCategory] || 'FULL').trim(),
                        email: emailVal,
                        purchaseDate: this.cleanDateDisplay(row[kPurchaseDate] || ''),
                        months: String(row[kMonths] || '').trim(),
                        expiryDate: expStr,
                        subEmail: String(row[kSubEmail] || '').trim(),
                        staff: String(row[kStaff] || 'Dnc').trim(),
                        daysLeft: calcDays
                    };
                }).filter(Boolean);
                try {
                    localStorage.setItem('goshop_cached_datagoc', JSON.stringify(this.dataGocList));
                } catch(e) {}
            } else {
                const apiRes = await fetch(this.CONFIG.WEBAPP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'get_data_goc' })
                });
                const apiResult = await apiRes.json();
                if (apiResult.status === 'success' && apiResult.data) {
                    this.dataGocList = apiResult.data;
                    try {
                        localStorage.setItem('goshop_cached_datagoc', JSON.stringify(this.dataGocList));
                    } catch(e) {}
                }
            }
        } catch (e) {
            console.error("Lỗi khi tải DATAGoc:", e);
        } finally {
            this.isFetchingDataGoc = false;
            if (this.currentUserRole === 'admin') {
                this.calculateAppDataDiff();
            }
            this.$nextTick(() => { if (window.lucide) window.lucide.createIcons(); });
        }
    },

    calculateAppDataDiff() {
        const gocMap = {};
        (this.dataGocList || []).forEach(g => {
            if (g.email) gocMap[g.email.toLowerCase().trim()] = g;
        });

        const appDataLatest = {};
        (this.db.APP_DATA || []).forEach(r => {
            const email = (r['Email khách'] || '').trim().toLowerCase();
            if (!email || !email.includes('@')) return;
            appDataLatest[email] = r;
        });

        const diffs = [];
        Object.keys(appDataLatest).forEach(emailKey => {
            const r = appDataLatest[emailKey];
            const g = gocMap[emailKey];
            const email = r['Email khách'] || emailKey;
            const newExpiry = String(r['Date'] || r['HSD'] || r['Hạn sử dụng'] || '').trim();
            const newSubEmail = String(r['Mail phụ'] || '').trim();
            const newStaff = String(r['CTV'] || 'Dnc').trim();
            const newProduct = String(r['Phân loại'] || r['Gói'] || 'YTB').trim();
            const newDaysLeft = String(r['Số ngày còn lại'] || '').trim();
            const newPurchaseDate = String(r['Ngày mua'] || r['Ngày đăng ký'] || '').trim();
            const newMonths = String(r['Số tháng'] || r['Tháng'] || r['Thời hạn'] || '').trim();
            const newOrderCode = String(r['Mã đơn'] || r['Mã đơn hàng'] || '').trim();

            if (!g) {
                diffs.push({
                    email: email,
                    status: 'new',
                    product: newProduct,
                    category: 'FULL',
                    expiryDate: newExpiry,
                    purchaseDate: newPurchaseDate,
                    months: newMonths || '0',
                    daysLeft: newDaysLeft,
                    subEmail: newSubEmail,
                    staff: newStaff,
                    orderCode: newOrderCode,
                    oldExpiryDate: '--',
                    oldSubEmail: '--',
                    oldStaff: '--',
                    oldProduct: '--',
                    diffReasons: ['🆕 Khách hàng mới có trong APP_DATA (chưa có trong DATAGoc)']
                });
            } else {
                const diffReasons = [];
                const cleanNewExp = newExpiry.replace(/\s+/g, '');
                const cleanOldExp = String(g.expiryDate || '').replace(/\s+/g, '');
                if (cleanNewExp && cleanOldExp && cleanNewExp !== cleanOldExp) {
                    diffReasons.push(`📅 HSD: ${g.expiryDate || '--'} ➔ ${newExpiry}`);
                }
                if (newMonths && String(g.months || '').trim() !== newMonths) {
                    diffReasons.push(`⏳ Số tháng: ${g.months || '--'} ➔ ${newMonths}`);
                }
                // Không đưa thay đổi Gói hay Mail phụ vào danh sách khác biệt theo yêu cầu (chỉ theo dõi thay đổi tháng/HSD & khách mới)

                const status = diffReasons.length > 0 ? 'modified' : 'unchanged';
                diffs.push({
                    email: email,
                    status: status,
                    product: newProduct || g.product,
                    category: g.category || 'FULL',
                    expiryDate: newExpiry || g.expiryDate,
                    purchaseDate: newPurchaseDate || g.purchaseDate,
                    months: newMonths || g.months || '0',
                    daysLeft: newDaysLeft || g.daysLeft,
                    subEmail: newSubEmail || g.subEmail,
                    staff: newStaff || g.staff,
                    orderCode: newOrderCode || g.orderCode,
                    oldExpiryDate: g.expiryDate || '--',
                    oldSubEmail: g.subEmail || '--',
                    oldStaff: g.staff || '--',
                    oldProduct: g.product || '--',
                    diffReasons: diffReasons
                });
            }
        });

        this.appDataDiffList = diffs;
    },

    async syncSingleAppDataDiff(item) {
        if (!confirm(`Xác nhận duyệt & cập nhật khách hàng "${item.email}" (HSD: ${item.expiryDate}) lên DATAGoc?`)) return;
        await this.executeSyncAppDataToGoc([item]);
    },

    async syncBulkAppDataDiff() {
        const list = (this.appDataDiffList || []).filter(i => i.status === 'new' || i.status === 'modified');
        if (list.length === 0) {
            alert("Không có thay đổi nào cần cập nhật lên DATAGoc.");
            return;
        }
        if (!confirm(`🚀 Xác nhận đồng bộ ${list.length} thay đổi từ APP_DATA lên DATAGoc và lưu nhật ký hệ thống?`)) return;
        await this.executeSyncAppDataToGoc(list);
    },

    async executeSyncAppDataToGoc(items) {
        this.isSyncingAppDataToGoc = true;
        try {
            const payload = {
                action: 'sync_appdata_to_datagoc',
                items: items,
                operator: 'Admin DNC'
            };
            const res = await fetch(this.CONFIG.WEBAPP_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (result.status === 'success') {
                alert(`✅ ${result.message}`);
                await this.fetchDataGoc(true);
                this.calculateAppDataDiff();
            } else {
                alert(`❌ Lỗi đồng bộ: ${result.message}`);
            }
        } catch (error) {
            alert(`❌ Lỗi kết nối: ${error.message}`);
        } finally {
            this.isSyncingAppDataToGoc = false;
        }
    },

    parseDataGocAiInput() {
        const text = (this.dataGocAiInput || '').trim();
        if (!text) {
            this.dataGocPreview = null;
            return;
        }

        const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
        const email = emailMatch ? emailMatch[1].toLowerCase() : '';

        if (!email) {
            this.dataGocPreview = { error: 'Không tìm thấy địa chỉ email hợp lệ trong câu lệnh hoặc tin nhắn vừa dán.' };
            return;
        }

        const currentInfo = this.dataGocList.find(c => c.email.toLowerCase() === email) || null;

        let months = '';
        const monthMatch = text.match(/(\d+)\s*(th|tháng|thang|month|m\b)/i) || text.match(/gh\s*(\d+)/i) || text.match(/(\d+)\s*(t\b|thg)/i);
        if (monthMatch) {
            months = monthMatch[1];
        } else if (currentInfo && currentInfo.months) {
            months = currentInfo.months;
        } else {
            months = '6';
        }

        let product = currentInfo ? currentInfo.product : 'YTB';
        const lower = text.toLowerCase();
        if (lower.includes('ytb') || lower.includes('youtube')) product = 'YTB';
        else if (lower.includes('gpt') || lower.includes('chatgpt')) product = 'ChatGPT';
        else if (lower.includes('netflix')) product = 'Netflix';
        else if (lower.includes('canva')) product = 'Canva';
        else if (lower.includes('gg') || lower.includes('google') || lower.includes('one') || lower.includes('drive')) product = 'Google One';
        else if (lower.includes('spotify')) product = 'Spotify';
        else if (lower.includes('office') || lower.includes('365')) product = 'Office 365';

        if (lower.includes('đơn mới') || lower.includes('don moi') || lower.includes('new order') || lower.includes('mới ') || lower.endsWith('mới')) {
            this.dataGocMode = 'new';
        } else if (lower.includes('gia hạn') || lower.includes('gia han') || lower.includes('gh ') || lower.startsWith('gh')) {
            this.dataGocMode = 'renew';
        }

        let category = currentInfo ? currentInfo.category : 'FULL';
        if (lower.includes('plus')) category = 'PLUS';
        else if (lower.includes('thường') || lower.includes('thuong') || lower.includes('nom')) category = 'NOM';
        else if (lower.includes('full')) category = 'FULL';

        const dateMatches = text.match(/(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/g);
        let purchaseDate = '';
        let expiryDate = '';

        const formatStrDate = (dStr) => {
            const p = dStr.replace(/[\.\-]/g, '/').split('/');
            const dd = String(parseInt(p[0])).padStart(2, '0');
            const mm = String(parseInt(p[1])).padStart(2, '0');
            let yy = String(p[2]);
            if (yy.length === 2) yy = '20' + yy;
            return `${dd}/${mm}/${yy}`;
        };

        if (dateMatches && dateMatches.length >= 2) {
            purchaseDate = formatStrDate(dateMatches[0]);
            expiryDate = formatStrDate(dateMatches[1]);
        } else if (dateMatches && dateMatches.length === 1) {
            purchaseDate = formatStrDate(dateMatches[0]);
            const pParts = purchaseDate.split('/');
            const dObj = new Date(parseInt(pParts[2]), parseInt(pParts[1]) - 1, parseInt(pParts[0]));
            dObj.setMonth(dObj.getMonth() + parseInt(months || 0));
            expiryDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
        } else if (currentInfo && currentInfo.expiryDate) {
            const pParts = currentInfo.expiryDate.replace(/[\.\-]/g, '/').split('/');
            let baseDate = new Date();
            if (pParts.length === 3) {
                const expObj = new Date(parseInt(pParts[2]), parseInt(pParts[1]) - 1, parseInt(pParts[0]));
                if (!isNaN(expObj.getTime())) {
                    baseDate = expObj; // Khách có HSD -> luôn lấy HSD hiện tại làm mốc cộng dồn
                }
            }
            purchaseDate = currentInfo.purchaseDate || `${String(baseDate.getDate()).padStart(2, '0')}/${String(baseDate.getMonth() + 1).padStart(2, '0')}/${baseDate.getFullYear()}`;
            const dObj = new Date(baseDate.getTime());
            dObj.setMonth(dObj.getMonth() + parseInt(months || 0));
            expiryDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
        } else {
            const now = new Date();
            purchaseDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            const dObj = new Date();
            dObj.setMonth(dObj.getMonth() + parseInt(months || 0));
            expiryDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
        }

        const operator = this.operatorName;

        this.dataGocPreview = {
            email: email,
            product: product,
            category: category,
            purchaseDate: purchaseDate,
            months: months,
            expiryDate: expiryDate,
            operator: operator,
            currentInfo: currentInfo,
            isNew: !currentInfo,
            warning: (this.dataGocMode === 'new' && currentInfo) ? ('⚠️ CẢNH BÁO: Email này đã tồn tại trong DATAGoc (HSD: ' + currentInfo.expiryDate + '). Bạn đang chọn chế độ "Đơn Mới", vui lòng kiểm tra lại xem đây là Gia Hạn hay Đơn Mới!') : null
        };
    },

    recalcDataGocExpiry() {
        if (!this.dataGocPreview || this.dataGocPreview.error) return;
        const months = parseInt(this.dataGocPreview.months || 0);
        const email = (this.dataGocPreview.email || '').toLowerCase();
        const currentInfo = this.dataGocList.find(c => (c.email || '').toLowerCase() === email);
        
        let baseDateStr = this.dataGocPreview.purchaseDate;
        if (currentInfo && currentInfo.expiryDate) {
            const pParts = currentInfo.expiryDate.replace(/[\.\-]/g, '/').split('/');
            if (pParts.length === 3) {
                const expObj = new Date(parseInt(pParts[2]), parseInt(pParts[1]) - 1, parseInt(pParts[0]));
                if (!isNaN(expObj.getTime())) {
                    baseDateStr = currentInfo.expiryDate;
                }
            }
        }
        
        const parts = (baseDateStr || '').replace(/[\.\-]/g, '/').split('/');
        if (parts.length === 3) {
            const dObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            if (!isNaN(dObj.getTime())) {
                dObj.setMonth(dObj.getMonth() + months);
                this.dataGocPreview.expiryDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
            }
        }
    },

    async submitDataGocRenew() {
        if (!this.dataGocPreview || this.dataGocPreview.error) return;
        if (this.dataGocMode === 'new' && this.dataGocPreview.currentInfo) {
            if (!confirm(`⚠️ CẢNH BÁO TRÙNG LẶP EMAIL:\n\nEmail "${this.dataGocPreview.email}" ĐÃ TỒN TẠI trong hệ thống DATAGoc với HSD: ${this.dataGocPreview.currentInfo.expiryDate}!\n\nBạn đang ở chế độ "Đơn Mới". Bạn có chắc chắn muốn tiếp tục cập nhật/cộng dồn cho email này không? Nếu đây là đơn Gia Hạn, vui lòng chọn chế độ Gia Hạn.`)) {
                return;
            }
        }
        this.isUpdatingDataGoc = true;
        try {
            const payload = {
                action: 'update_data_goc_renew',
                email: this.dataGocPreview.email,
                product: this.dataGocPreview.product,
                category: this.dataGocPreview.category,
                purchaseDate: this.dataGocPreview.purchaseDate,
                months: this.dataGocPreview.months,
                expiryDate: this.dataGocPreview.expiryDate,
                operator: this.dataGocPreview.operator,
                isNewOrder: this.dataGocMode === 'new',
                createIfNotFound: true
            };
            const res = await fetch(this.CONFIG.WEBAPP_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (result.status === 'success') {
                alert(result.message || 'Gia hạn DATAGoc thành công!');
                this.dataGocAiInput = '';
                this.dataGocPreview = null;
                await this.fetchDataGoc(true);
                if (this.fetchStatusHistory) this.fetchStatusHistory();
            } else if (result.status === 'already_exists') {
                if (confirm(result.message)) {
                    payload.forceOverwrite = true;
                    const res2 = await fetch(this.CONFIG.WEBAPP_URL, { method: 'POST', body: JSON.stringify(payload) });
                    const result2 = await res2.json();
                    if (result2.status === 'success') {
                        alert(result2.message || 'Cập nhật DATAGoc thành công!');
                        this.dataGocAiInput = '';
                        this.dataGocPreview = null;
                        await this.fetchDataGoc(true);
                        if (this.fetchStatusHistory) this.fetchStatusHistory();
                    } else {
                        alert('Lỗi: ' + (result2.message || 'Không thể cập nhật'));
                    }
                }
            } else if (result.status === 'not_found') {
                if (confirm(result.message + "\n\nBạn có muốn tự động tạo mới dòng này trong DATAGoc không?")) {
                    payload.createIfNotFound = true;
                    const res2 = await fetch(this.CONFIG.WEBAPP_URL, { method: 'POST', body: JSON.stringify(payload) });
                    const result2 = await res2.json();
                    if (result2.status === 'success') {
                        alert(result2.message);
                        this.dataGocAiInput = '';
                        this.dataGocPreview = null;
                        await this.fetchDataGoc(true);
                    } else {
                        alert('Lỗi: ' + result2.message);
                    }
                }
            } else {
                alert('Lỗi cập nhật: ' + result.message);
            }
        } catch (e) {
            alert('Lỗi kết nối tới server: ' + e.message);
        } finally {
            this.isUpdatingDataGoc = false;
        }
    },

    parseDataGocBulkInput() {
        const text = (this.dataGocBulkInput || '').trim();
        if (!text) {
            this.dataGocBulkList = [];
            return;
        }
        const lines = text.split(/\r?\n/);
        const list = [];
        
        const formatStrDate = (dStr) => {
            const p = dStr.replace(/[\.\-]/g, '/').split('/');
            if (p.length < 3) return dStr;
            const dd = String(parseInt(p[0])).padStart(2, '0');
            const mm = String(parseInt(p[1])).padStart(2, '0');
            let yy = String(p[2]);
            if (yy.length === 2) yy = '20' + yy;
            return `${dd}/${mm}/${yy}`;
        };

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            
            const parts = line.split(/\t+/).map(p => p.trim()).filter(p => p !== '');
            if (parts.length === 0) continue;
            
            // Extract all emails from line
            const emails = line.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi) || [];
            if (emails.length === 0) continue;
            
            // Filter out known agent/reseller emails (e.g. dncryptox, baomap, admin)
            let targetEmail = '';
            const filteredEmails = emails.filter(e => {
                const le = e.toLowerCase();
                return !le.includes('dncryptox@') && !le.includes('baomap') && !le.includes('admin@');
            });
            
            if (filteredEmails.length > 0) {
                targetEmail = filteredEmails[filteredEmails.length - 1].toLowerCase();
            } else {
                targetEmail = emails[emails.length - 1].toLowerCase();
            }
            
            const currentInfo = this.dataGocList.find(c => (c.email || '').toLowerCase() === targetEmail);
            
            // Order Code (Mã đơn / NTT): In 4-column copy, it's usually parts[0]
            let orderCode = '';
            if (parts.length >= 3) {
                const p0 = parts[0];
                if (p0.toLowerCase() !== targetEmail) {
                    orderCode = p0;
                }
            }
            if (!orderCode) {
                const ordMatch = line.match(/(ORD\d+)/i);
                if (ordMatch) orderCode = ordMatch[1];
            }

            // Mode: Gia han vs New
            const lower = line.toLowerCase();
            let mode = 'renew';
            if (lower.includes('\tnew\t') || lower.includes('\tmới\t') || lower.includes('don moi') || lower.includes('\tnew') || lower.includes('đơn mới') || parts.some(p => p.toLowerCase() === 'new' || p.toLowerCase() === 'mới')) {
                mode = 'new';
            } else if (lower.includes('\tgia hạn') || lower.includes('\tgia han') || lower.includes('gh') || parts.some(p => p.toLowerCase() === 'gia hạn' || p.toLowerCase() === 'gia han')) {
                mode = 'renew';
            } else if (!currentInfo) {
                mode = 'new';
            }
            
            // Product & Months: In 4-column copy, it's usually parts[3] (e.g. "Lưu trữ đám mây 2TB-12", "Youtube-3")
            let productStr = '';
            let months = '6';
            
            // Find part containing product string
            const prodPart = [...parts].reverse().find(p => {
                const lp = p.toLowerCase();
                return lp.includes('youtube') || lp.includes('ytb') || lp.includes('lưu trữ') || lp.includes('đám mây') || lp.includes('văn phòng') || lp.includes('365') || lp.includes('gpt') || lp.includes('canva') || lp.includes('spotify') || lp.includes('netflix') || lp.includes('drive') || lp.includes('one') || lp.includes('2tb') || lp.includes('5tb');
            });
            
            if (prodPart) {
                productStr = prodPart;
                const mMatch = prodPart.match(/(?:-|\s+)(\d+)\s*(?:th|tháng|thg|month|m\b)?\s*$/i);
                if (mMatch && ['1', '2', '3', '6', '9', '12', '18', '24', '36'].includes(mMatch[1])) {
                    months = mMatch[1];
                }
            } else {
                // fallback month checking
                const tabParts = line.split('\t');
                for (let p of tabParts) {
                    const cleanP = p.trim();
                    if (['1', '2', '3', '6', '9', '12', '18', '24', '36'].includes(cleanP)) {
                        months = cleanP;
                        break;
                    }
                }
            }

            // Map standard product
            let product = currentInfo ? currentInfo.product : 'YTB';
            const lpStr = (productStr || lower).toLowerCase();
            if (lpStr.includes('ytb') || lpStr.includes('youtube')) product = 'YTB';
            else if (lpStr.includes('gpt') || lpStr.includes('chatgpt')) product = 'ChatGPT';
            else if (lpStr.includes('netflix')) product = 'Netflix';
            else if (lpStr.includes('canva')) product = 'Canva';
            else if (lpStr.includes('gg') || lpStr.includes('google') || lpStr.includes('one') || lpStr.includes('drive') || lpStr.includes('lưu trữ') || lpStr.includes('đám mây') || lpStr.includes('5tb') || lpStr.includes('2tb')) product = 'Google One';
            else if (lpStr.includes('spotify') || lpStr.includes('nhạc')) product = 'Spotify';
            else if (lpStr.includes('office') || lpStr.includes('365') || lpStr.includes('văn phòng')) product = 'Office 365';
            
            // Category
            let category = currentInfo ? currentInfo.category : 'FULL';
            if (lpStr.includes('plus') || lower.includes('plus')) category = 'PLUS';
            else if (lpStr.includes('thường') || lpStr.includes('thuong') || lpStr.includes('nom') || lower.includes('nom')) category = 'NOM';
            else if (lpStr.includes('full') || lower.includes('full')) category = 'FULL';
            
            // Purchase date & Expiry date
            const dateMatches = line.match(/(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/g);
            let purchaseDate = '';
            let expiryDate = '';
            
            if (currentInfo && currentInfo.expiryDate) {
                const pParts = currentInfo.expiryDate.replace(/[\.\-]/g, '/').split('/');
                let baseDate = new Date();
                if (pParts.length === 3) {
                    const expObj = new Date(parseInt(pParts[2]), parseInt(pParts[1]) - 1, parseInt(pParts[0]));
                    if (!isNaN(expObj.getTime())) baseDate = expObj;
                }
                purchaseDate = currentInfo.purchaseDate || `${String(baseDate.getDate()).padStart(2, '0')}/${String(baseDate.getMonth() + 1).padStart(2, '0')}/${baseDate.getFullYear()}`;
                const dObj = new Date(baseDate.getTime());
                dObj.setMonth(dObj.getMonth() + parseInt(months || 0));
                expiryDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
            } else if (dateMatches && dateMatches.length >= 1) {
                purchaseDate = formatStrDate(dateMatches[0]);
                const pParts = purchaseDate.split('/');
                const dObj = new Date(parseInt(pParts[2]), parseInt(pParts[1]) - 1, parseInt(pParts[0]));
                dObj.setMonth(dObj.getMonth() + parseInt(months || 0));
                expiryDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
            } else {
                const now = new Date();
                purchaseDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
                const dObj = new Date();
                dObj.setMonth(dObj.getMonth() + parseInt(months || 0));
                expiryDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
            }
            
            const operator = this.operatorName;
            const warning = (mode === 'new' && currentInfo) ? `⚠️ Email đã có trong DATAGoc (HSD: ${currentInfo.expiryDate})` : null;
            
            list.push({
                orderCode: orderCode,
                email: targetEmail,
                product: product,
                category: category,
                purchaseDate: purchaseDate,
                months: months,
                expiryDate: expiryDate,
                mode: mode,
                operator: operator,
                warning: warning,
                status: 'pending',
                errorMsg: '',
                currentInfo: currentInfo
            });
        }
        
        this.dataGocBulkList = list;
        this.$nextTick(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); });
    },

    recalcBulkRow(row) {
        const months = parseInt(row.months || 0);
        const email = (row.email || '').toLowerCase();
        const currentInfo = this.dataGocList.find(c => (c.email || '').toLowerCase() === email);
        row.currentInfo = currentInfo;
        
        let baseDateStr = row.purchaseDate;
        if (currentInfo && currentInfo.expiryDate) {
            const pParts = currentInfo.expiryDate.replace(/[\.\-]/g, '/').split('/');
            if (pParts.length === 3) {
                const expObj = new Date(parseInt(pParts[2]), parseInt(pParts[1]) - 1, parseInt(pParts[0]));
                if (!isNaN(expObj.getTime())) baseDateStr = currentInfo.expiryDate;
            }
        }
        const parts = (baseDateStr || '').replace(/[\.\-]/g, '/').split('/');
        if (parts.length === 3) {
            const dObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            if (!isNaN(dObj.getTime())) {
                dObj.setMonth(dObj.getMonth() + months);
                row.expiryDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
            }
        }
        row.warning = (row.mode === 'new' && currentInfo) ? `⚠️ Email đã có trong DATAGoc (HSD: ${currentInfo.expiryDate})` : null;
    },

    async submitDataGocBulk() {
        if (this.dataGocBulkList.length === 0) return;
        if (!confirm(`🚀 Bạn có chắc chắn muốn đồng bộ hàng loạt ${this.dataGocBulkList.length} dòng này vào DATAGoc?`)) return;
        
        this.isUpdatingBulk = true;
        let successCount = 0;
        
        try {
            for (let i = 0; i < this.dataGocBulkList.length; i++) {
                const row = this.dataGocBulkList[i];
                if (row.status === 'success') continue;
                
                row.status = 'processing';
                const payload = {
                    action: 'update_data_goc_renew',
                    email: row.email,
                    product: row.product,
                    category: row.category,
                    purchaseDate: row.purchaseDate,
                    months: row.months,
                    expiryDate: row.expiryDate,
                    operator: row.operator,
                    orderCode: row.orderCode,
                    isNewOrder: row.mode === 'new',
                    forceOverwrite: this.bulkAutoOverwrite,
                    createIfNotFound: true
                };
                
                try {
                    const res = await fetch(this.CONFIG.WEBAPP_URL, {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    const result = await res.json();
                    if (result.status === 'success') {
                        row.status = 'success';
                        successCount++;
                    } else if (result.status === 'already_exists') {
                        if (this.bulkAutoOverwrite) {
                            payload.forceOverwrite = true;
                            const res2 = await fetch(this.CONFIG.WEBAPP_URL, { method: 'POST', body: JSON.stringify(payload) });
                            const result2 = await res2.json();
                            if (result2.status === 'success') {
                                row.status = 'success';
                                successCount++;
                            } else {
                                row.status = 'error';
                                row.errorMsg = result2.message || 'Lỗi cập nhật';
                            }
                        } else {
                            row.status = 'error';
                            row.errorMsg = 'Trùng email (chưa ghi đè)';
                        }
                    } else if (result.status === 'not_found') {
                        payload.createIfNotFound = true;
                        const res2 = await fetch(this.CONFIG.WEBAPP_URL, { method: 'POST', body: JSON.stringify(payload) });
                        const result2 = await res2.json();
                        if (result2.status === 'success') {
                            row.status = 'success';
                            successCount++;
                        } else {
                            row.status = 'error';
                            row.errorMsg = result2.message || 'Lỗi thêm mới';
                        }
                    } else {
                        row.status = 'error';
                        row.errorMsg = result.message || 'Lỗi không xác định';
                    }
                } catch (err) {
                    row.status = 'error';
                    row.errorMsg = 'Lỗi kết nối';
                }
                this.$nextTick(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); });
            }
            
            alert(`🎉 Đã hoàn tất đồng bộ hàng loạt!\n✅ Thành công: ${successCount} / ${this.dataGocBulkList.length} khách hàng.`);
            await this.fetchDataGoc(true);
            if (this.fetchStatusHistory) this.fetchStatusHistory();
        } finally {
            this.isUpdatingBulk = false;
            this.$nextTick(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); });
        }
    }
});
