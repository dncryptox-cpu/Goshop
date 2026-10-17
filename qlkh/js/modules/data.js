// data.js — nạp dữ liệu từ Google Sheets (gviz) theo từng nhóm, chỉ khi module cần.
// Giữ nguyên nguồn dữ liệu và cách đọc cột như bản admin cũ.
QLKH.define('data', {
    CONFIG: {
        SHEET_ID: '1sdL8wF3pLDZ6V_mUqG2aVmI5f60foDzD0ZA0CmC6m3c',
        FAM_RENEW_SHEET_ID: '1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc',
        TRANSACTION_SHEET_ID: '1-EgeNWztGQsY2rmLYp00yKDjgHR5WYoqzzhAkSnvJjc',
        WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbxzXvVjASViAK--nYwzfJ_iTbK8e7Ilfd9xjbDdzS3SdXPTgdPRVSd9M4ORimanRWZN/exec',
        FINANCIAL_WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbxoBHLdCgValY0h2LtV5jDo1hhidv0nW_QXZ9rDf0RM0bl2ktpHpL38Utk2NbHos4PF/exec',
        CHATGPT_WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbySu9evgLmqMVKSc-Z1cKUIzcfqJH9_pEFDdzOERQ1yP8uLy1hvLqJgNRkOlwDJEOba/exec',
        // Backend cũ vẫn kiểm tra khoá này — giữ nguyên để không phải sửa Apps Script.
        CHATGPT_API_KEY: 'c74391ab-gpt-sec-2026',
        TABS: ['APP_DATA', 'UPSALE', 'STOCK', 'PNL', 'Spot']
    },

    // Dữ liệu thô lưu ngoài Alpine (không reactive) để không bọc Proxy hàng nghìn dòng.
    _dbVersion: 0,
    get db() { void this._dbVersion; return window._rawDb; },
    set db(val) { window._rawDb = val; this._dbVersion++; },

    // Module nào cần nhóm dữ liệu nào.
    MODULE_DATA: {
        dashboard: ['datagoc', 'sheets', 'transactions'],
        today: ['datagoc', 'products', 'famrenew', 'transactions'],
        pnl_calculator: ['sheets', 'transactions'],
        lai_lo: ['transactions'],
        manual_other_orders: ['sheets', 'datagoc'],
        data_goc: ['datagoc', 'sheets'],
        fam_spot: ['sheets'],
        fam_renew: ['famrenew'],
        twofa: ['twofa'],
        account: ['accounts'],
    },
    ADMIN_ONLY_DATA: ['sheets', 'transactions'],

    _dataState: {},      // name -> 'loading' | 'ready' | 'error'
    _dataPromises: {},   // name -> Promise đang chạy (chống gọi trùng)
    _dataLoadedAt: {},   // name -> timestamp

    dataStatus(name) { return this._dataState[name] || 'idle'; },
    get isLoadingAny() { return Object.values(this._dataState).includes('loading'); },

    ensureData(names, force) {
        const list = (names || []).filter(n => this.currentUserRole === 'admin' || !this.ADMIN_ONLY_DATA.includes(n));
        return Promise.all(list.map(n => this.loadDataset(n, force)));
    },

    loadDataset(name, force) {
        if (!force && this._dataPromises[name]) return this._dataPromises[name];
        const loaders = {
            sheets: () => this.loadSheetTabs(),
            transactions: () => this.loadTransactions(),
            famrenew: () => this.loadFamRenewData(),
            twofa: () => this.loadTwofaSheet(),
            datagoc: () => this.fetchDataGoc(!!force),
            accounts: () => this.fetchLoginAccounts(true),
            products: () => this.loadProductItems(),
        };
        if (!loaders[name]) return Promise.resolve();
        this._dataState = { ...this._dataState, [name]: 'loading' };
        const p = Promise.resolve()
            .then(loaders[name])
            .then(() => {
                this._dataState = { ...this._dataState, [name]: 'ready' };
                this._dataLoadedAt[name] = Date.now();
            })
            .catch(e => {
                console.error('Lỗi tải dữ liệu', name, e);
                this._dataState = { ...this._dataState, [name]: 'error' };
                delete this._dataPromises[name];
            });
        this._dataPromises[name] = p;
        return p;
    },

    // Nút "Làm mới": tải lại đúng các nhóm dữ liệu của module đang mở.
    async refreshCurrentModule() {
        const names = this.MODULE_DATA[this.activeModule] || [];
        this.isLoading = true;
        try { await this.ensureData(names, true); }
        finally { this.isLoading = false; this.invalidateCaches(); }
    },

    // Giữ tên cũ: các nút trong module cũ gọi fetchSheetData() để tải lại bảng tính.
    fetchSheetData() { return this.refreshCurrentModule(); },

    invalidateCaches() {
        this._dbVersion++;
    },

    // ---------- Helpers đọc Google Sheets ----------
    gvizUrl(sheetId, tab, out) {
        return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:${out || 'csv'}&sheet=${encodeURIComponent(tab)}&t=${Date.now()}`;
    },
    async gvizCsv(sheetId, tab) {
        const res = await fetch(this.gvizUrl(sheetId, tab, 'csv'));
        if (!res.ok) throw new Error(`HTTP ${res.status} (${tab})`);
        return this.parseCSV(await res.text());
    },
    async gvizJson(sheetId, tab) {
        const res = await fetch(this.gvizUrl(sheetId, tab, 'json'));
        const text = await res.text();
        return JSON.parse(text.substring(text.indexOf('({') + 1, text.lastIndexOf('})') + 1));
    },

    // CSV parser chuẩn: hỗ trợ ô có dấu phẩy, ngoặc kép và XUỐNG DÒNG bên trong ô
    // (bản cũ cắt theo dòng trước nên ô ghi chú nhiều dòng làm lệch cả hàng).
    parseCSV(csv) {
        if (!csv || /^\s*</.test(csv)) return []; // trang HTML lỗi / chưa share
        const rows = [];
        let row = [], cell = '', inQuote = false, line = 1;
        for (let i = 0; i < csv.length; i++) {
            const c = csv[i];
            if (inQuote) {
                if (c === '"') {
                    if (csv[i + 1] === '"') { cell += '"'; i++; } else inQuote = false;
                } else cell += c;
            } else if (c === '"') inQuote = true;
            else if (c === ',') { row.push(cell.trim()); cell = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && csv[i + 1] === '\n') i++;
                row.push(cell.trim()); cell = '';
                if (row.some(v => v !== '')) { row._line = line; rows.push(row); }
                row = []; line++;
            } else cell += c;
        }
        row.push(cell.trim());
        if (row.some(v => v !== '')) { row._line = line; rows.push(row); }
        if (rows.length < 2) return [];

        // Một số tab có dòng tiêu đề ở hàng 2: chọn hàng có nhiều từ khoá tiêu đề hơn.
        const keywords = ['slot', 'stt', 'trạng thái', 'status', 'mail', 'email', 'pass', '2fa', 'hạn', 'date', 'renew'];
        const score = vals => vals.reduce((s, v) => s + (keywords.some(k => String(v).toLowerCase().includes(k)) ? 1 : 0), 0);
        // Hàng dữ liệu (có email / ngày dd/mm/yyyy) không bao giờ được coi là tiêu đề.
        const looksLikeData = vals => vals.some(v => /@/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v));
        const headerIndex = (score(rows[1]) > score(rows[0]) && !looksLikeData(rows[1])) ? 1 : 0;

        const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
        const headers = [];
        const seen = new Set();
        for (let i = 0; i < maxCols; i++) {
            let h = rows[headerIndex][i] || '';
            h = h === '' ? `Col_${i}` : h;
            if (seen.has(h)) h = `${h}_${i}`;
            seen.add(h);
            headers.push(h);
        }
        const result = [];
        for (let r = headerIndex + 1; r < rows.length; r++) {
            const values = rows[r];
            const obj = {};
            let hasData = false;
            for (let i = 0; i < headers.length; i++) {
                const v = values[i] || '';
                obj[headers[i]] = v;
                if (v !== '' && !headers[i].startsWith('Col_')) hasData = true;
            }
            // không liệt kê trong Object.keys(): nhiều chỗ đọc cột theo vị trí keys[i]
            Object.defineProperty(obj, '_rawVals', { value: values, enumerable: false });
            Object.defineProperty(obj, '_line', { value: values._line, enumerable: false });
            if (hasData) result.push(obj);
        }
        return result;
    },

    escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    // ---------- Nhóm dữ liệu ----------
    // Bộ nhớ đệm cục bộ: hiện dữ liệu cũ ngay, rồi thay bằng dữ liệu mới khi tải xong.
    CACHE_KEY: 'qlkh_cache_v1',
    readCache() {
        try { return JSON.parse(localStorage.getItem(this.CACHE_KEY) || '{}'); } catch (e) { return {}; }
    },
    writeCache(part) {
        try { localStorage.setItem(this.CACHE_KEY, JSON.stringify({ ...this.readCache(), ...part })); }
        catch (e) { /* vượt quota: bỏ qua cache */ }
    },
    hydrateFromCache() {
        if (this.currentUserRole !== 'admin') return;
        const c = this.readCache();
        let touched = false;
        this.CONFIG.TABS.forEach(t => { if (Array.isArray(c[t]) && !window._rawDb[t].length) { window._rawDb[t] = c[t]; touched = true; } });
        if (Array.isArray(c.DATA_YTB) && !window._rawDb.DATA_YTB.length) { window._rawDb.DATA_YTB = c.DATA_YTB; touched = true; }
        if (touched) { this.mapData(); this.invalidateCaches(); }
    },

    async loadSheetTabs() {
        const out = {};
        await Promise.all(this.CONFIG.TABS.map(async tab => {
            try { out[tab] = await this.gvizCsv(this.CONFIG.SHEET_ID, tab); }
            catch (e) { console.error(`Lỗi tải tab ${tab}:`, e); }
        }));
        Object.assign(window._rawDb, out);
        this.mapData();
        this.writeCache(out);
        this.invalidateCaches();
    },

    async loadTransactions() {
        const [ytb, gcc] = await Promise.all([
            this.gvizCsv(this.CONFIG.TRANSACTION_SHEET_ID, 'DATA(YTB)'),
            this.gvizCsv(this.CONFIG.TRANSACTION_SHEET_ID, 'DATA(GCC)')
        ]);
        const tag = (list, tab) => list.forEach(r => Object.defineProperty(r, '_tab', { value: tab, enumerable: false }));
        tag(ytb, 'DATA(YTB)'); tag(gcc, 'DATA(GCC)');
        window._rawDb.DATA_YTB = [...ytb, ...gcc];
        this.calculateGlobalProfit();
        this.syncNotificationsFromTransactions();
        if (this.activeModule === 'pnl_calculator') this.$nextTick(() => this.renderProfitChart());
        this.writeCache({ DATA_YTB: window._rawDb.DATA_YTB });
        this.invalidateCaches();
    },

    async loadTwofaSheet() {
        const tfData = await this.gvizCsv(this.CONFIG.SHEET_ID, '2FA');
        if (!tfData.length) return;
        const sheetItems = tfData.map((row, idx) => {
            const keys = Object.keys(row);
            const kMail = keys.find(k => k.toLowerCase() === 'mail' || k.toLowerCase() === 'email') || keys[0] || '';
            const kSecret = keys.find(k => k.toLowerCase() === '2fa' || k.toLowerCase().includes('secret')) || keys[1] || '';
            const email = String(row[kMail] || '').trim();
            const secret = String(row[kSecret] || '').trim();
            if (!email || !secret) return null;
            return { id: '2FA-SHEET-' + (idx + 1), email, secret, lastUsed: 'Chưa sử dụng', fromSheet: true };
        }).filter(Boolean);
        const sheetEmails = new Set(sheetItems.map(i => i.email.toLowerCase()));
        const localOnly = this.twofaList.filter(i => !i.fromSheet && !sheetEmails.has(i.email.toLowerCase()));
        this.twofaList = [...sheetItems, ...localOnly];
    },

    // FamRenew: RENEW (+ RENEW_MODIFIED đè lên), PAIRINGS, KHO_RENEW, nhật ký, SoluongRN, lịch sử.
    async loadFamRenewData() {
        const FR = this.CONFIG.FAM_RENEW_SHEET_ID;
        const pick = (keys, fns, fallback) => keys.find(k => fns.some(f => f(k.toLowerCase()))) || fallback;
        const renewCols = keys => ({
            kSlot: pick(keys, [k => k === 'slot', k => k.includes('slot')], keys[0]),
            kStt: pick(keys, [k => k.includes('stt'), k => k.includes('fam')], keys[1]),
            kStatus: pick(keys, [k => k.includes('trạng thái'), k => k.includes('status')], keys[2]),
            kEmail: pick(keys, [k => k.includes('stock'), k => k.includes('mail'), k => k.includes('email')], keys[3]),
            kPass: pick(keys, [k => k === 'pass', k => k.includes('mật khẩu')], keys[4]),
            kRecovery: pick(keys, [k => k === 'mkp', k => k.includes('khôi phục'), k => k.includes('phục')], keys[5]),
            k2fa: pick(keys, [k => k === '2fa', k => k.includes('2fa')], keys[6]),
            kExpiry: pick(keys, [k => k.includes('ngày renew'), k => k.includes('renew'), k => k.includes('hết hạn')], keys[7]),
            kNotes: pick(keys, [k => k.includes('thay thế'), k => k.includes('thay the'), k => k.includes('ghi chú')], keys[8]),
        });
        const val = (row, k) => String(row[k] || '').trim();

        const loadRenew = async () => {
            try {
                const frData = await this.gvizCsv(FR, 'RENEW');
                const list = frData.map((row, idx) => {
                    const c = renewCols(Object.keys(row));
                    const emailVal = val(row, c.kEmail), statusVal = val(row, c.kStatus), slotsVal = val(row, c.kSlot);
                    if (emailVal.toLowerCase() === 'stockrenew' || statusVal.toLowerCase() === 'trạng thái') return null;
                    return {
                        rowIndex: idx + 2,
                        id: 'fr_' + idx + '_' + Math.random().toString(36).substr(2, 5),
                        stt: val(row, c.kStt), status: statusVal, slots: slotsVal,
                        buyDate: '', activationDate: '',
                        email: emailVal, pass: val(row, c.kPass), recoveryEmail: val(row, c.kRecovery),
                        twofa: val(row, c.k2fa), expiryDate: val(row, c.kExpiry),
                        type: slotsVal ? `Slot: ${slotsVal}` : '', source: val(row, c.kNotes)
                    };
                }).filter(item => item && item.email);
                try {
                    const modData = await this.gvizCsv(FR, 'RENEW_MODIFIED');
                    const modMap = {};
                    modData.forEach(row => {
                        const c = renewCols(Object.keys(row));
                        const stt = val(row, c.kStt);
                        if (stt) modMap[stt] = {
                            status: val(row, c.kStatus), email: val(row, c.kEmail), pass: val(row, c.kPass),
                            recoveryEmail: val(row, c.kRecovery), twofa: val(row, c.k2fa),
                            expiryDate: val(row, c.kExpiry), source: val(row, c.kNotes)
                        };
                    });
                    list.forEach(item => { if (modMap[item.stt]) Object.assign(item, modMap[item.stt]); });
                } catch (eMod) { console.warn('Không đọc được RENEW_MODIFIED:', eMod); }
                this.famRenewList = list;
            } catch (e) { console.error('Lỗi tải RENEW:', e); this.famRenewList = []; }
        };

        const loadKho = async () => {
            try {
                const krData = await this.gvizCsv(FR, 'KHO_RENEW');
                this.khoRenewList = krData.map(row => {
                    const keys = Object.keys(row);
                    const kEmail = pick(keys, [k => k.includes('mail'), k => k.includes('email')], keys[0]);
                    const kPass = pick(keys, [k => k === 'pass', k => k.includes('mật khẩu')], keys[1]);
                    const kMkp = pick(keys, [k => k === 'mkp', k => k.includes('khôi phục')], keys[2]);
                    const k2fa = pick(keys, [k => k === '2fa', k => k.includes('2fa')], keys[3]);
                    const kRenewDate = pick(keys, [k => k.includes('renew')], keys[4]);
                    const kImportDate = pick(keys, [k => k.includes('nhập')], keys[5]);
                    const kStatus = pick(keys, [k => k.includes('trạng thái'), k => k.includes('status')], keys[6]);
                    const kFamFollow = pick(keys, [k => k.includes('fam hiện tại'), k => k.includes('fam hien tai'), k => k.includes('famfollow'), k => k.includes('follow')], keys[7]);
                    const kNotes = pick(keys, [k => k.includes('ghi chú'), k => k.includes('note')], keys[8]);
                    const kSttFam = pick(keys, [k => k === 'stt', k => k.includes('stt fam'), k => k.includes('stt kho'), k => k.includes('số thứ tự'), k => k.includes('stt')], keys[10] || '');
                    return {
                        email: val(row, kEmail), pass: val(row, kPass), recoveryEmail: val(row, kMkp), twofa: val(row, k2fa),
                        renewDate: this.cleanDateDisplay(val(row, kRenewDate)),
                        importDate: this.cleanDateDisplay(val(row, kImportDate)),
                        status: String(row[kStatus] || 'Sẵn sàng').trim(),
                        famFollow: val(row, kFamFollow), notes: val(row, kNotes),
                        sttFam: kSttFam ? val(row, kSttFam) : ''
                    };
                }).filter(item => item && item.email);
            } catch (e) { console.error('Lỗi tải KHO_RENEW:', e); this.khoRenewList = []; }
        };

        const loadSoluong = async () => {
            try {
                const srData = await this.gvizCsv(FR, 'SoluongRN');
                this.soluongRNList = srData.map(row => {
                    const keys = Object.keys(row);
                    const kDate = pick(keys, [k => k.includes('date'), k => k.includes('ngày')], keys[0] || '');
                    const kQty = pick(keys, [k => k.includes('lượng'), k => k.includes('qty'), k => k.includes('số')], keys[1] || '');
                    const dateVal = val(row, kDate);
                    const qtyVal = parseInt(row[kQty]) || 0;
                    if (!dateVal || qtyVal <= 0) return null;
                    return { date: dateVal, quantity: qtyVal };
                }).filter(Boolean);
            } catch (e) { console.error('Lỗi tải SoluongRN:', e); this.soluongRNList = []; }
        };

        await Promise.all([loadRenew(), loadKho(), loadSoluong(), this.loadFamPairings(), this.fetchNhatKyXuLy()]);
        // Lịch sử tải sau, không chặn giao diện.
        Promise.all([this.fetchReplaceHistory(), this.fetchStatusHistory()]).catch(e => console.warn('Lỗi tải lịch sử:', e));
        this.invalidateCaches();
    },

    // Thông báo ở chuông: 100 giao dịch mới nhất từ DATA(YTB)/DATA(GCC).
    syncNotificationsFromTransactions() {
        const data = this.db.DATA_YTB || [];
        if (!data.length) return;
        const esc = s => this.escapeHtml(s);
        const d = new Date();
        const today1 = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        const today2 = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
        const keys = Object.keys(data[0] || {});
        const parseSheetDate = s => {
            const p = String(s || '').trim().split('/');
            if (p.length < 3) return 0;
            let y = parseInt(p[2]); if (y < 100) y += 2000;
            return new Date(y, parseInt(p[1]) - 1, parseInt(p[0])).getTime();
        };
        const relLabel = s => {
            const ds = String(s).trim();
            if (ds === today1 || ds === today2) return 'Hôm nay (Từ Sheet)';
            const p = ds.split('/');
            return p.length >= 2 ? `${p[0]}/${p[1]} (Từ Sheet)` : `${ds} (Từ Sheet)`;
        };
        let staffKey = keys.find(k => { const kl = k.toLowerCase(); return kl === 'ctv' || kl.includes('người bán') || kl.includes('nhân sự') || kl === 'staff'; });
        const sig = n => String(n.email || '') + '|' + String(n.key || n.message) + '|' + (n.timestamp || 0);
        const existing = new Set(this.notifications.map(sig));
        data.slice(-100).reverse().forEach(row => {
            const dateStr = String(row[keys[0]] || '').trim();
            if (!dateStr) return;
            const tType = String(row[keys[2]] || '').trim();
            const email = String(row[keys[3]] || '').trim();
            const product = String(row[keys[4]] || '').trim();
            let sk = staffKey;
            if (!sk) sk = keys.find(k => ['dnc', 'tuan', 'vuong', 'loc', 'admin'].includes(String(row[k] || '').toLowerCase().trim()));
            const staff = sk ? String(row[sk] || '?').trim() : '?';
            let months = '?', pName = product;
            if (product.includes('-')) { const parts = product.split('-'); months = parts.pop().trim(); pName = parts.join('-').trim(); }
            const tl = tType.toLowerCase();
            const typeText = tl.includes('new') || tl === 'mới' ? 'Mới' : (tl.includes('gia') ? 'Gia hạn' : tType);
            const n = {
                key: [staff, typeText, pName, months].join('|'),
                message: `CTV <b class="text-indigo-600">${esc(staff)}</b> vừa ghi nhận đơn <b class="text-emerald-600">${esc(typeText)}</b> - <span class="text-orange-600 font-bold">${esc(pName)}</span> - <b>${esc(email)}</b> (${esc(months)} tháng)`,
                time: relLabel(dateStr), timestamp: parseSheetDate(dateStr), email
            };
            if (!existing.has(sig(n))) { existing.add(sig(n)); this.notifications.push(n); }
        });
        this.notifications.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        if (this.notifications.length > 100) this.notifications = this.notifications.slice(0, 100);
        try { localStorage.setItem('qlkh_notifications', JSON.stringify(this.notifications)); } catch (e) {}
    },

    mapData() {
        // Reset global costs to prevent accumulation bug (from KI)
        this.globalStaffCost = 0;
        this.globalMiscCost = 0;
        
        const appData = this.db.APP_DATA || [];
        const upsaleData = this.db.UPSALE || [];

        // Auto-parse Product Catalog & Global Metrics from PNL sheet
        if (this.db.PNL && this.db.PNL.length > 0) {
            const keys = Object.keys(this.db.PNL[0]);
            const newCatalog = [];
            
            this.db.PNL.forEach(row => {
                // Parse Product Catalog (Cols A to E)
                const productName = row[keys[0]] || '';
                if (productName.toString().trim() !== '') {
                    const duration = parseInt(row[keys[1]]) || 1;
                    const price = parseFloat(String(row[keys[2]]).replace(/[^0-9.-]+/g,"")) || 0;
                    const cost = parseFloat(String(row[keys[3]]).replace(/[^0-9.-]+/g,"")) || 0;
                    const commission = parseFloat(String(row[keys[4]]).replace(/[^0-9.-]+/g,"")) || 0;
                    
                    newCatalog.push({
                        product: productName.toString().trim(),
                        duration: duration,
                        price: price,
                        cost: cost,
                        defaultCommission: commission,
                        key: productName.toString().trim() + '-' + duration
                    });
                }

                // Parse Global Metrics (Cols F to G) - Re-enabled and fixed
                if (keys.length >= 7) {
                    const name = (row[keys[5]] || '').toLowerCase(); // Cột F: Thông số
                    const val = parseFloat(String(row[keys[6]]).replace(/[^0-9.-]+/g,"")) || 0; // Cột G: Giá trị
                    if (name.includes('nhân viên') || name.includes('staff') || name.includes('lương')) this.globalStaffCost += val;
                    if (name.includes('phát sinh') || name.includes('misc') || name.includes('khác')) this.globalMiscCost += val;
                }
            });

            if (newCatalog.length > 0) {
                this.productCatalog = newCatalog;
            }
        }
        // Calculate Global Profit on init
        this.calculateGlobalProfit();
        
        // Parse Fam Spot
        if (this.db.Spot && this.db.Spot.length > 0) {
            const sKeys = Object.keys(this.db.Spot[0] || {});
            let parsedFams = [];
            
            const parseVietnameseDate = (dateStr) => {
                if (!dateStr || dateStr.trim() === '' || dateStr === '-') return new Date(9999, 11, 31).getTime();
                const parts = dateStr.trim().split('/');
                if (parts.length >= 3) {
                    let y = parseInt(parts[2]);
                    if (y < 100) y += 2000;
                    return new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
                }
                return new Date(9999, 11, 31).getTime();
            };
            
            const today = new Date();
            today.setHours(0,0,0,0);
            const now = today.getTime();
            
            // Fuzzy key finder: search all headers for a partial match, fallback to positional index
            const findKey = (...patterns) => {
                for (const h of sKeys) {
                    const lower = h.toLowerCase().trim();
                    for (const p of patterns) {
                        if (lower.includes(p.toLowerCase())) return h;
                    }
                }
                return null;
            };
            
            // Map columns by searching headers (handles trailing spaces, Unicode, etc.)
            const kDateGh  = findKey('date gh', 'date gia') || sKeys[1] || '';
            const kStatus  = findKey('trạng thái', 'trang thai', 'status') || sKeys[2] || '';
            const kChuFam  = findKey('chủ fam', 'chu fam', 'owner') || sKeys[3] || '';
            const kCheck   = findKey('col_4') || sKeys[4] || '';
            const kEmail   = findKey('thành viên', 'thanh vien', 'email', 'member') || sKeys[5] || '';
            const kNgayMua = findKey('ngày mua', 'ngay mua') || sKeys[6] || '';
            const kDuration= findKey('số tháng', 'so thang', 'gia hạn') || sKeys[7] || '';
            const kHSD     = findKey('hsd', 'hạn sử dụng') || sKeys[8] || '';
            const kNote    = findKey('note', 'ghi chú') || sKeys[9] || '';
            const kCTV     = findKey('ctv', 'người bán') || sKeys[10] || '';

            // Each family is exactly a 6-row block in the sheet.
            for (let i = 0; i < this.db.Spot.length; i += 6) {
                const famRow = this.db.Spot[i];
                if (!famRow) break;
                
                const dateGh = String(famRow[kDateGh] || '').trim();
                const status = String(famRow[kStatus] || '').trim();
                const chuFam = String(famRow[kChuFam] || '').trim();
                const isRenewed = String(famRow[kCheck] || '').toUpperCase() === 'TRUE';
                
                let currentFam = {
                    dateGh,
                    status,
                    chuFam,
                    isRenewed,
                    members: [],
                    minDate: new Date(9999, 11, 31).getTime()
                };
                
                for (let j = 0; j < 6; j++) {
                    const memberRow = this.db.Spot[i + j];
                    if (!memberRow) continue;
                    
                    const email = String(memberRow[kEmail] || '').trim();
                    const purchaseDate = String(memberRow[kNgayMua] || '').trim();
                    const duration = String(memberRow[kDuration] || '').trim();
                    const hsd = String(memberRow[kHSD] || '').trim();
                    const note = String(memberRow[kNote] || '').trim();
                    const ctv = String(memberRow[kCTV] || '').trim();
                    
                    if (email || purchaseDate || hsd || duration || note || ctv) {
                        const hsdTime = parseVietnameseDate(hsd);
                        if (hsdTime < currentFam.minDate && hsdTime !== new Date(9999, 11, 31).getTime()) {
                            currentFam.minDate = hsdTime;
                        }
                        
                        currentFam.members.push({
                            email, purchaseDate, duration, hsd, note, ctv,
                            isExpired: hsdTime < now && hsd.trim() !== ''
                        });
                    }
                }
                
                currentFam.isExpired = currentFam.members.some(m => m.isExpired);
                
                if (currentFam.chuFam || currentFam.members.length > 0) {
                    parsedFams.push(currentFam);
                }
            }
            
            parsedFams.sort((a, b) => {
                if (a.isExpired && !b.isExpired) return -1;
                if (!a.isExpired && b.isExpired) return 1;
                return a.minDate - b.minDate;
            });
            
            this.familiesSpot = parsedFams;
        }

        if (this.activeModule === 'pnl_calculator') this.$nextTick(() => this.renderProfitChart());

        // 1. Map APP_DATA to Customers
        const upsaleMap = new Map();
        upsaleData.forEach(u => {
            const em = (u['Email khách'] || '').trim().toLowerCase();
            if (em) upsaleMap.set(em, u);
        });
        const customerMap = {};
        appData.forEach((r, index) => {
            const email = r['Email khách'];
            if(!email) return;
            
            // Find matching ID from UPSALE
            const matchingUpsale = upsaleMap.get(email.toLowerCase());
            const customerId = matchingUpsale ? (matchingUpsale['ID Khách'] || matchingUpsale['ID Khach'] || matchingUpsale['ID'] || `CUS-${1000 + index}`) : `CUS-${1000 + index}`;
            
            const days = parseInt(r['Số ngày còn lại']) || 0;
            if (!customerMap[email] || days > customerMap[email].days) {
                customerMap[email] = {
                    id: customerId,
                    email: email,
                    plan: r['Phân loại'] || '--',
                    expiry: r['Date'] || r['HSD'] || r['Hạn sử dụng'] || '--',
                    purchaseDate: r['Ngày mua'] || r['Ngày đăng ký'] || r['Ngày đk'] || '--',
                    days: days,
                    staff: r['CTV'] || 'Unassigned',
                    status: this.getStatus(r),
                    renewalStatus: this.ytbRenewalStatuses[email] || 'Chờ GH',
                    secondaryEmail: r['Mail phụ'] || '',
                    notes: r['Ghi chú'] || r['Ghi chu'] || r['Notes'] || '',
                    historyCount: (customerMap[email]?.historyCount || 0) + 1
                };
            } else {
                customerMap[email].historyCount++;
            }
        });
        this.customers = Object.values(customerMap);

        // 2. Map UPSALE
        this.upsales = upsaleData.map(u => ({
            id: u['ID Khách'] || '',
            name: u['Tên khách'] || 'Unknown',
            email: u['Email khách'] || 'No Email',
            staff: u['CTV'] || 'Unassigned',
            Youtube: u['Youtube']?.toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE',
            Canva: u['Canva']?.toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE',
            Capcut: u['Capcut']?.toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE',
            Spotify: u['Spotify']?.toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE',
            Adobe: u['Adobe']?.toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE'
        }));

        // Map Upsales back to Customers for the modal
        const mappedUpsaleMap = new Map();
        this.upsales.forEach(u => {
            if (u.email && u.email !== 'No Email') {
                mappedUpsaleMap.set(u.email.toLowerCase(), u);
            }
        });
        this.customers.forEach(c => {
            c.upsale = mappedUpsaleMap.get((c.email || '').toLowerCase()) || null;
        });

        // Update Stats
        const totalCustomers = this.customers.length;
        const expiringSoon = this.customers.filter(c => c.days > 0 && c.days <= 7).length;
        const availableSlots = appData.filter(r => r['Phân loại'] === 'Còn slot').length;
        const expired = this.customers.filter(c => c.days < 0).length;

        this.stats[0].value = totalCustomers.toLocaleString();
        this.stats[1].value = expiringSoon;
        this.stats[2].value = availableSlots;
        this.stats[3].value = expired;

        // Staff Performance
        const staffMap = {};
        this.customers.forEach(c => {
            if (c.staff !== 'Unassigned') {
                staffMap[c.staff] = (staffMap[c.staff] || 0) + 1;
            }
        });
        const totalStaffSales = Object.values(staffMap).reduce((a, b) => a + b, 0);
        this.staffPerformance = Object.entries(staffMap)
            .map(([name, sales]) => ({
                name,
                sales,
                percent: totalStaffSales > 0 ? Math.round((sales / totalStaffSales) * 100) : 0
            }))
            .sort((a, b) => b.sales - a.sales);
        this.calculateAppDataDiff();
    },
});
