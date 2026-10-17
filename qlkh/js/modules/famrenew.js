// famrenew.js — tách từ admin/index.html (logic giữ nguyên, đã chỉnh trong qlkh)
QLKH.define('famrenew', {
    famRenewList: [],

    famRenewSearchQuery: '',

    famRenewFilterStatus: 'all',

    famRenewShowUrgentOnly: false,

    famRenewConfirm: { show: false, item: null, newStatus: '', activationDate: '', expiryDate: '', notes: '' },

    famRenewView: 'bulk_tool',

    famRenewPairings: {},

    khoRenewList: [],

    soluongRNList: [],

    selectedRNDate: null,

    selectedRNQty: 0,

    bulkRequestCount: 5,

    loiFilter: 'all',

    loiNotes: JSON.parse(localStorage.getItem('fam_loi_notes') || '[]'),

    showLoiNoteForm: false,

    loiNoteForm: { email: '', loai: '', xu_ly: '' },

    loiLastRefreshed: null,

    loiAutoRefreshTimer: null,

    get groupedRenewDates() {
        const groups = {};
        this.famRenewList.forEach(f => {
            const status = String(f.status || '').toLowerCase();
            // Bỏ qua các fam đã thay
            if (f.expiryDate && status !== 'hết hạn - đã thay' && !status.includes('đã thay')) {
                if (!groups[f.expiryDate]) groups[f.expiryDate] = [];
                groups[f.expiryDate].push(f);
            }
        });
        return Object.keys(groups).map(date => ({
            date,
            fams: groups[date],
            count: groups[date].length
        })).sort((a, b) => {
            const da = this.parseDateDMY(a.date);
            const db = this.parseDateDMY(b.date);
            return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
        });
    },

    requestedFams: [],

    khoRenewSearchQuery: '',

    khoRenewFilterDate: 'all',

    editingKhoEmail: null,

    editingKhoTwofa: '',

    editingKhoRenewDate: '',

    editingKhoStatus: '',

    editingKhoNotes: '',

    isSavingKhoItem: false,

    selectedBulkRenewDate: '',

    bulkEmailInput: '',

    bulkActionType: 'replace',

    bulkStatusTarget: 'Banned',

    bulkActionResults: [],

    rnTrackingList: [],

    renewList: [],

    isFetchingRnTracking: false,

    rnTrackingSearchQuery: '',

    rnTrackingFilterType: 'all',

    replaceHistoryList: [],

    statusHistoryList: [],

    isExecutingBulkAction: false,

    isFetchingHistory: false,

    isFetchingStatusHistory: false,

    expiryCalculationMethod: 'accumulate',

    editingHistoryRow: null,

    showHistoryEditModal: false,

    copyFamRenewTwofaCode(item) {
        this.showToast('Đang lấy mã 2FA...');
        try {
            let cleanKey = item.twofa.replace(/\s+/g, '').toUpperCase();
            if (cleanKey.includes('OTPAUTH://')) {
                 const url = new URL(item.twofa.replace(/\s+/g, ''));
                 cleanKey = url.searchParams.get('secret') || '';
            } else if (cleanKey.includes('?SECRET=')) {
                 cleanKey = cleanKey.split('?SECRET=').pop().split('&')[0];
            }
            
            if (!cleanKey) throw new Error('Invalid key');
            
            let totp = new OTPAuth.TOTP({
                issuer: "Go Shop",
                label: "2FA",
                algorithm: "SHA1",
                digits: 6,
                period: 30,
                secret: OTPAuth.Secret.fromBase32(cleanKey)
            });
            
            const token = totp.generate();
            navigator.clipboard.writeText(token);
            this.showToast('Đã lấy và Copy mã 2FA thành công: ' + token);
        } catch (e) {
            this.showToast('Không thể lấy mã 2FA. Vui lòng kiểm tra Secret Key.');
        }
    },

    getLoiCount(st) {
        const today = new Date(); today.setHours(0,0,0,0);
        return this.khoRenewList.filter(f => {
            if ((f.status||'').trim() !== st) return false;
            if (!f.renewDate) return true;
            const parts = f.renewDate.split('/');
            if (parts.length !== 3) return true;
            const d = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
            return d >= today;
        }).length;
    },

    loiDaysLeft(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        const d = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
        return Math.round((d - new Date()) / 86400000);
    },

    async addLoiNote() {
        if (!this.loiNoteForm.email) return;
        
        const operator = localStorage.getItem('go_operator') || 'Admin';
        const email = this.loiNoteForm.email;
        const loai = this.loiNoteForm.loai; // new status
        const xu_ly = this.loiNoteForm.xu_ly;
        
        // Optimistic update in frontend list
        const item = this.khoRenewList.find(f => f.email === email);
        const oldStatus = item ? item.status : '';
        if (item) {
            item.status = loai;
        }

        // Backend request
        try {
            const res = await fetch(this.CONFIG.WEBAPP_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'update_kho_renew_status',
                    email: email,
                    status: loai,
                    notes: xu_ly,
                    operator: operator
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                this.showToast('✅ Đã cập nhật & lưu ghi chú');
            } else {
                if (item) item.status = oldStatus;
                this.showToast('❌ Lỗi cập nhật');
            }
        } catch(e) {
            if (item) item.status = oldStatus;
            this.showToast('❌ Lỗi kết nối');
        }

        // Add to local log
        this.loiNotes.unshift({
            id: Date.now(),
            email: email,
            loai: loai,
            xu_ly: xu_ly,
            nguoi_lam: operator,
            date: new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'}) + ' ' + new Date().toLocaleDateString('vi-VN')
        });
        localStorage.setItem('fam_loi_notes', JSON.stringify(this.loiNotes));
        if (this.fetchNhatKyXuLy) {
            this.fetchNhatKyXuLy();
        }
        
        this.loiNoteForm = { email: '', loai: '', xu_ly: '' };
        this.showLoiNoteForm = false;
    },

    removeLoiNote(id) {
        this.loiNotes = this.loiNotes.filter(n => n.id !== id);
        localStorage.setItem('fam_loi_notes', JSON.stringify(this.loiNotes));
    },

    startLoiAutoRefresh() {
        // Tự làm mới dữ liệu FamRenew mỗi 2 phút, chỉ khi đang mở FamRenew và tab trình duyệt đang hiển thị.
        if (this.loiAutoRefreshTimer) clearInterval(this.loiAutoRefreshTimer);
        const stamp = () => { this.loiLastRefreshed = new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit',second:'2-digit'}); };
        this.loiAutoRefreshTimer = setInterval(() => {
            if (this.activeModule !== 'fam_renew') { clearInterval(this.loiAutoRefreshTimer); this.loiAutoRefreshTimer = null; return; }
            if (document.visibilityState !== 'visible') return;
            this.loadDataset('famrenew', true).then(stamp);
        }, 120000);
        stamp();
    },

    parseDateDMY(str) {
        if (!str) return null;
        // Handle Google Sheets date format: M/D/YYYY or D/M/YYYY
        const parts = String(str).trim().split('/');
        if (parts.length < 2) return null;
        // Sheet shows C col as "9/6/2026" → M/D/YYYY (US format from GViz)
        const m = parseInt(parts[0]) - 1;
        const d = parseInt(parts[1]);
        const y = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();
        const date = new Date(y, m, d);
        date.setHours(0, 0, 0, 0);
        return date;
    },

    getFamRenewAlert(item) {
        const now = new Date(); now.setHours(0,0,0,0);
        let isWarrantyUrgent = false, isExpiryUrgent = false, text = '', alertClass = '';

        // Kiểm tra BH 3 ngày từ Ngày mua (chỉ với acc Mới / chưa kích hoạt)
        const isNew = !item.status || item.status === 'Mới' || item.status === '';
        if (isNew && item.buyDate) {
            const buyDate = this.parseDateDMY(item.buyDate);
            if (buyDate) {
                const daysSinceBuy = Math.floor((now - buyDate) / 86400000);
                const daysLeft = 3 - daysSinceBuy;
                if (daysLeft > 0) {
                    isWarrantyUrgent = true;
                    text = daysLeft === 1 ? `⚠️ Hết BH Ngày Mai` : `🔴 Còn ${daysLeft} ngày BH`;
                    alertClass = daysLeft <= 1 ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-red-50 border-red-200 text-red-700';
                } else if (daysLeft <= 0) {
                    text = '⚠️ Hết Hạn BH'; alertClass = 'bg-gray-100 border-gray-300 text-gray-500';
                }
            }
        }

        // Kiểm tra hết hạn gói 30 ngày từ Ngày hết hạn (chỉ với acc Đang dùng)
        if (item.status === 'Đang dùng' && item.expiryDate) {
            const expiry = this.parseDateDMY(item.expiryDate);
            if (expiry) {
                const daysLeft = Math.floor((expiry - now) / 86400000);
                if (daysLeft <= 1 && daysLeft >= 0) {
                    isExpiryUrgent = true;
                    text = daysLeft === 0 ? '🔴 Hết hạn HÔM NAY!' : '🟠 Hết hạn ngày mai!';
                    alertClass = 'bg-orange-50 border-orange-200 text-orange-700';
                } else if (daysLeft < 0) {
                    isExpiryUrgent = true;
                    text = `❌ Quá hạn ${Math.abs(daysLeft)} ngày`;
                    alertClass = 'bg-red-50 border-red-200 text-red-600';
                } else if (daysLeft <= 5) {
                    text = `⏳ Còn ${daysLeft} ngày`;
                    alertClass = 'bg-yellow-50 border-yellow-200 text-yellow-700';
                }
            }
        }

        return { text, alertClass, isWarrantyUrgent, isExpiryUrgent };
    },

    openFamRenewConfirm(item, newStatus) {
        let activationDate = '', expiryDate = '';
        // Nếu chuyển sang "Đang dùng" hoặc thay thế Fam mới thành công
        if (newStatus === 'Đang dùng' || (newStatus === 'Hết hạn - đã thay' && this.famRenewPairings[item.stt])) {
            const today = new Date();
            const dd = String(today.getDate()).padStart(2,'0');
            const mm = String(today.getMonth()+1).padStart(2,'0');
            const yyyy = today.getFullYear();
            activationDate = `${dd}/${mm}/${yyyy}`;
            const expiry = new Date(today);
            expiry.setDate(expiry.getDate() + 30);
            const ed = String(expiry.getDate()).padStart(2,'0');
            const em = String(expiry.getMonth()+1).padStart(2,'0');
            const ey = expiry.getFullYear();
            expiryDate = `${ed}/${em}/${ey}`;
        }
        this.famRenewConfirm = { show: true, item, newStatus, activationDate, expiryDate, notes: item.source || '' };
    },

    async confirmFamRenewStatus() {
        const { item, newStatus, activationDate, expiryDate } = this.famRenewConfirm;
        this.famRenewConfirm.show = false;
        this.showToast(`Đang cập nhật ${item.email || ('STT #' + item.stt)}...`);
        try {
            if (newStatus === 'Hết hạn - đã thay' && this.famRenewPairings[item.stt]) {
                const pairing = this.famRenewPairings[item.stt];
                await fetch(this.CONFIG.WEBAPP_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'renew_fam_slot',
                        stt: String(item.stt),
                        expiryDate
                    })
                });
                
                // Cập nhật local state ngay lập tức
                item.email = pairing.nextFamEmail;
                item.pass = pairing.nextFamPass;
                item.recoveryEmail = pairing.nextFamMkp;
                item.twofa = pairing.nextFam2fa;
                item.status = 'Đang dùng'; // Đưa lại về Đang dùng
                if (expiryDate) item.expiryDate = expiryDate;
                
                // Cập nhật kho dự phòng local
                const candidate = this.khoRenewList.find(c => c.email.toLowerCase() === pairing.nextFamEmail.toLowerCase());
                if (candidate) {
                    candidate.status = 'Đã dùng';
                    candidate.famFollow = '';
                }
                
                // Xóa pairing local
                delete this.famRenewPairings[item.stt];
                this.showToast(`✅ Đã thay thế Fam mới thành công cho STT #${item.stt}!`);
            } else {
                await fetch(this.CONFIG.WEBAPP_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'update_fam_renew_status',
                        email: item.email,
                        status: newStatus,
                        activationDate,
                        expiryDate,
                        notes: this.famRenewConfirm.notes || ''
                    })
                });
                // Cập nhật local ngay lập tức
                item.status = newStatus;
                item.source = this.famRenewConfirm.notes || '';
                if (activationDate) item.activationDate = activationDate;
                if (expiryDate) item.expiryDate = expiryDate;
                this.showToast(`✅ Đã cập nhật: ${newStatus}` + (expiryDate ? ` → HH: ${expiryDate}` : ''));
            }
        } catch (e) {
            this.showToast('Lỗi khi cập nhật trạng thái.');
        }
    },

    copyWarrantyReport() {
        const errorItems = this.famRenewList.filter(i => i.status === 'Lỗi BH');
        if (errorItems.length === 0) {
            this.showToast('Không có tài khoản Lỗi BH nào!');
            return;
        }
        const text = errorItems.map(i => `${i.email}|${i.pass}`).join('\n');
        navigator.clipboard.writeText(text);
        this.showToast(`Đã copy ${errorItems.length} tài khoản lỗi BH!`);
    },

    async loadFamPairings() {
        try {
            const pairingsUrl = `https://docs.google.com/spreadsheets/d/${this.CONFIG.FAM_RENEW_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=PAIRINGS&t=${Date.now()}`;
            const pRes = await fetch(pairingsUrl);
            if (pRes.ok) {
                const pText = await pRes.text();
                const pData = this.parseCSV(pText);
                const pairingsObj = {};
                pData.forEach(row => {
                    const keys = Object.keys(row);
                    const sttKey = keys.find(k => k.toLowerCase().includes('stt') || k.toLowerCase().includes('fam')) || keys[0];
                    const nextSttKey = keys.find(k => k.toLowerCase().includes('nextfamstt')) || keys[1];
                    const nextEmailKey = keys.find(k => k.toLowerCase().includes('nextfamemail')) || keys[2];
                    const nextPassKey = keys.find(k => k.toLowerCase().includes('nextfampass')) || keys[3];
                    const nextMkpKey = keys.find(k => k.toLowerCase().includes('nextfammkp')) || keys[4];
                    const next2faKey = keys.find(k => k.toLowerCase().includes('nextfam2fa')) || keys[5];
                    const dateKey = keys.find(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('ngày')) || keys[6];
                    const verKey = keys.find(k => k.toLowerCase().includes('ver') || k.toLowerCase().includes('status')) || keys[7];

                    const sttVal = String(row[sttKey] || '').trim();
                    if (sttVal) {
                        pairingsObj[sttVal] = {
                            nextFamStt: String(row[nextSttKey] || '').trim(),
                            nextFamEmail: String(row[nextEmailKey] || '').trim(),
                            nextFamPass: String(row[nextPassKey] || '').trim(),
                            nextFamMkp: String(row[nextMkpKey] || '').trim(),
                            nextFam2fa: String(row[next2faKey] || '').trim(),
                            pairedDate: String(row[dateKey] || '').trim(),
                            verStatus: String(row[verKey] || '').trim()
                        };
                    }
                });
                this.famRenewPairings = pairingsObj;

                // Tự động kiểm tra và dọn dẹp các cặp đã hoàn tất thay thế
                let hasAutoCleanup = false;
                Object.keys(this.famRenewPairings).forEach(stt => {
                    const item = this.famRenewList.find(i => String(i.stt) === String(stt));
                    if (item) {
                        const pairing = this.famRenewPairings[stt];
                        if (pairing.nextFamEmail && item.email.toLowerCase() === pairing.nextFamEmail.toLowerCase()) {
                            this.unpairFam(stt, true, true); // silent = true, markAsUsed = true
                            hasAutoCleanup = true;
                        }
                    }
                });
                if (hasAutoCleanup) {
                    this.showToast("Đã tự động hoàn tất và dọn dẹp các Fam đã thay thế xong!");
                }
            }
        } catch (e) {
            console.error('Error fetching pairings:', e);
        }
    },

    async unpairFam(stt, silent = false, markAsUsed = false) {
        if (!silent) this.showToast(`Đang hủy ghép cặp Fam #${stt}...`);
        const pairedEmail = this.famRenewPairings[stt]?.nextFamEmail;
        try {
            await fetch(this.CONFIG.WEBAPP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'unpair_fam',
                    stt: String(stt),
                    markAsUsed: markAsUsed
                })
            });
            
            if (pairedEmail) {
                const candidate = this.khoRenewList.find(c => c.email.toLowerCase() === pairedEmail.toLowerCase());
                if (candidate) {
                    candidate.status = markAsUsed ? 'Đã dùng' : 'Sẵn sàng';
                    candidate.famFollow = '';
                }
            }
            
            delete this.famRenewPairings[stt];
            if (!silent) this.showToast(`✅ Đã hủy ghép cặp.`);
        } catch (e) {
            if (!silent) this.showToast("Lỗi khi hủy ghép cặp.");
        }
    },

    fetchBulkFams() {
        const parseDateDMY = (dateStr) => {
            if (!dateStr) return new Date(0);
            const parts = String(dateStr).split('/');
            if (parts.length !== 3) return new Date(0);
            return new Date(parts[2], parts[1] - 1, parts[0]);
        };

        let expiringFams = [];
        const seenStt = new Set();
        
        if (this.selectedRNDate) {
            this.famRenewList.forEach(f => {
                if (f.expiryDate !== this.selectedRNDate) return;
                if (String(f.status || '').toLowerCase() === 'hết hạn - đã thay' || String(f.status || '').toLowerCase().includes('đã thay')) return;
                
                // Kiểm tra xem STT này đã được gia hạn ở một dòng khác chưa
                const myDate = parseDateDMY(f.expiryDate);
                const hasBeenRenewed = this.famRenewList.some(other => {
                    if (String(other.stt) !== String(f.stt)) return false;
                    const otherDate = parseDateDMY(other.expiryDate);
                    return otherDate > myDate;
                });
                if (hasBeenRenewed) return;

                if (!seenStt.has(f.stt)) {
                    seenStt.add(f.stt);
                    expiringFams.push(f);
                }
            });
            
            // Cập nhật lại số lượng yêu cầu thực tế để khớp số lượng STT chưa gia hạn
            this.bulkRequestCount = expiringFams.length;
        } else {
            // Tự động tìm các STT hết hạn hoặc lỗi chưa được gia hạn
            this.famRenewList.forEach(f => {
                if (f.status !== 'Hết hạn' && f.status !== 'Lỗi') return;
                
                const myDate = parseDateDMY(f.expiryDate);
                const hasBeenRenewed = this.famRenewList.some(other => {
                    if (String(other.stt) !== String(f.stt)) return false;
                    const otherDate = parseDateDMY(other.expiryDate);
                    return otherDate > myDate;
                });
                if (hasBeenRenewed) return;

                if (!seenStt.has(f.stt)) {
                    seenStt.add(f.stt);
                    expiringFams.push(f);
                }
            });
        }

        const count = parseInt(this.bulkRequestCount);
        if (isNaN(count) || count <= 0) {
            this.showToast("Không có STT nào cần thay thế hoặc số lượng không hợp lệ.");
            this.requestedFams = [];
            return;
        }

        const available = this.khoRenewList.filter(c => c.status === 'Sẵn sàng');
        if (available.length === 0) {
            this.showToast("Kho Renew hiện không còn Fam nào ở trạng thái Sẵn sàng.");
            this.requestedFams = [];
            return;
        }

        // Map từng Fam dự phòng với một Slot cũ
        const sliceFams = available.slice(0, count);
        this.requestedFams = sliceFams.map((backupFam, index) => {
            const oldFam = expiringFams[index];
            return {
                stt: oldFam ? oldFam.stt : '',
                oldEmail: oldFam ? oldFam.email : '',
                email: backupFam.email,
                pass: backupFam.pass,
                recoveryEmail: backupFam.recoveryEmail,
                twofa: backupFam.twofa,
                renewDate: backupFam.renewDate
            };
        });
        
        this.showToast(`✅ Đã lấy ${this.requestedFams.length} Fam từ Kho và gán cho các STT cần thay.`);
    },

    updateOldEmailForReplacements(f) {
        if (f.stt) {
            const matched = this.famRenewList.find(item => String(item.stt) === String(f.stt));
            f.oldEmail = matched ? matched.email : '';
        } else {
            f.oldEmail = '';
        }
    },

    copyRequestedFams() {
        if (this.requestedFams.length === 0) return;
        const rows = this.requestedFams.map(f => {
            return `${f.email}\t${f.pass}\t${f.recoveryEmail}\t${f.twofa}\t${f.renewDate || ''}`;
        }).join('\n');
        
        navigator.clipboard.writeText(rows).then(() => {
            this.showToast("📋 Đã copy bảng dữ liệu vào clipboard!");
        }).catch(() => {
            this.showToast("Lỗi khi copy vào clipboard.");
        });
    },

    async confirmBulkFams() {
        if (this.requestedFams.length === 0) return;

        // Lọc ra các cặp có gán STT FAM để thay thế tự động
        const replacements = this.requestedFams.filter(f => f.stt);
        if (replacements.length > 0) {
            this.showToast(`Đang thay thế tự động ${replacements.length} Fam...`);
            
            const today = new Date();
            const expiry = new Date(today);
            expiry.setDate(expiry.getDate() + 30);
            const ed = String(expiry.getDate()).padStart(2,'0');
            const em = String(expiry.getMonth()+1).padStart(2,'0');
            const ey = expiry.getFullYear();
            const newExpiryDate = `${ed}/${em}/${ey}`;

            const payloadReplacements = replacements.map(f => {
                return {
                    stt: f.stt,
                    nextFamEmail: f.email,
                    nextFamPass: f.pass,
                    nextFamMkp: f.recoveryEmail,
                    nextFam2fa: f.twofa
                };
            });

            try {
                await fetch(this.CONFIG.WEBAPP_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'bulk_renew_fam_slots',
                        replacements: payloadReplacements,
                        expiryDate: newExpiryDate
                    })
                });

                // Cập nhật local state ngay lập tức để giao diện tự động nhảy số
                replacements.forEach(f => {
                    const oldFam = this.famRenewList.find(item => String(item.stt) === String(f.stt));
                    if (oldFam) {
                        oldFam.email = f.email;
                        oldFam.pass = f.pass;
                        oldFam.recoveryEmail = f.recoveryEmail;
                        oldFam.twofa = f.twofa;
                        oldFam.status = 'Đang dùng';
                        oldFam.expiryDate = newExpiryDate;
                    }

                    const candidate = this.khoRenewList.find(c => c.email.toLowerCase() === f.email.toLowerCase());
                    if (candidate) {
                        candidate.status = 'Đã dùng';
                        candidate.famFollow = f.stt; // Ghi nhớ ID slot cũ vào FamFollow
                    }
                });

                this.showToast(`✅ Đã thay thế hàng loạt tự động thành công cho ${replacements.length} Fam!`);
                this.requestedFams = [];
                this.selectedRNDate = null;
                this.selectedRNQty = 0;
                return;
            } catch (e) {
                this.showToast("Lỗi khi gửi yêu cầu thay thế hàng loạt.");
                return;
            }
        }

        // Nếu không có slot nào được gán STT, chỉ đánh dấu Đã dùng
        this.showToast(`Đang đánh dấu đã dùng cho ${this.requestedFams.length} Fam...`);
        try {
            const emails = this.requestedFams.map(f => f.email);
            await fetch(this.CONFIG.WEBAPP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'mark_fams_as_used',
                    emails: emails
                })
            });
            
            // Update local status to Đã dùng
            this.requestedFams.forEach(f => {
                const found = this.khoRenewList.find(c => c.email.toLowerCase() === f.email.toLowerCase());
                if (found) {
                    found.status = 'Đã dùng';
                }
            });
            
            this.showToast("✅ Đã cập nhật trạng thái Đã Dùng thành công!");
            this.requestedFams = [];
        } catch (e) {
            this.showToast("Lỗi khi xác nhận lấy Fam.");
        }
    },

    startEditKho(c) {
        this.editingKhoEmail = c.email;
        this.editingKhoTwofa = c.twofa || '';
        
        // Parse date from sheet format to browser date input format yyyy-mm-dd
        let rawDate = c.renewDate || '';
        let inputDate = '';
        if (rawDate) {
            const ddmmyyyy = String(rawDate).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (ddmmyyyy) {
                const d = ddmmyyyy[1].padStart(2, '0');
                const m = ddmmyyyy[2].padStart(2, '0');
                const y = ddmmyyyy[3];
                inputDate = `${y}-${m}-${d}`;
            } else if (String(rawDate).trim().match(/^\d{4}-\d{2}-\d{2}$/)) {
                inputDate = String(rawDate).trim();
            } else if (String(rawDate).trim().match(/^\d{1,2}$/)) {
                const now = new Date();
                const d = String(rawDate).trim().padStart(2, '0');
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const y = now.getFullYear();
                inputDate = `${y}-${m}-${d}`;
            }
        }
        this.editingKhoRenewDate = inputDate;
        this.editingKhoStatus = c.status || 'Sẵn sàng';
        this.editingKhoNotes = c.notes || '';
    },

    cancelEditKho() {
        this.editingKhoEmail = null;
        this.editingKhoTwofa = '';
        this.editingKhoRenewDate = '';
        this.editingKhoStatus = '';
        this.editingKhoNotes = '';
    },

    async saveKhoItem(c) {
        if (this.isSavingKhoItem) return;

        const emailVal = String(c.email || '').trim();
        const passVal = String(c.pass || '').trim();
        const mkpVal = String(c.recoveryEmail || '').trim();
        const twofaVal = String(this.editingKhoTwofa || '').trim();

        const errorStatuses = ['Chưa sẵn sàng', 'Ver lần 1', 'Ver lần 2', 'Banned', 'ko có Trail', 'Ver khi chưa dùng', 'Lỗi Pay'];

        // Prompt for notes if an error/special status is chosen and notes are empty
        if (errorStatuses.includes(this.editingKhoStatus) && !this.editingKhoNotes.trim()) {
            const noteVal = prompt(`⚠️ Bạn đã chọn trạng thái lỗi/đặc biệt "${this.editingKhoStatus}".\nVui lòng nhập lý do hoặc ghi chú cụ thể:`);
            if (noteVal !== null && noteVal.trim()) {
                this.editingKhoNotes = noteVal.trim();
            }
        }

        // Auto status transition to Sẵn sàng if Email, Pass, MKP, and 2FA are all filled and status is not an error status
        if (emailVal && passVal && mkpVal && twofaVal && !errorStatuses.includes(this.editingKhoStatus)) {
            this.editingKhoStatus = 'Sẵn sàng';
        }

        this.isSavingKhoItem = true;
        
        // Convert yyyy-mm-dd back to dd/mm/yyyy for Google Sheets
        let sheetDate = this.editingKhoRenewDate || '';
        if (sheetDate) {
            const parts = sheetDate.split('-');
            if (parts.length === 3) {
                sheetDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }
        
        this.showToast(`Đang cập nhật tài khoản ${c.email}...`);
        try {
            await fetch(this.CONFIG.WEBAPP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_kho_renew_item',
                    email: c.email,
                    twofa: this.editingKhoTwofa,
                    renewDate: sheetDate,
                    status: this.editingKhoStatus,
                    notes: this.editingKhoNotes
                })
            });
            
            // Update local object
            c.twofa = this.editingKhoTwofa;
            c.renewDate = sheetDate;
            c.status = this.editingKhoStatus;
            c.notes = this.editingKhoNotes;
            
            this.showToast(`✅ Đã cập nhật thành công!`);
            this.cancelEditKho();
        } catch (e) {
            this.showToast(`Lỗi khi cập nhật tài khoản: ${e.message}`);
        } finally {
            this.isSavingKhoItem = false;
        }
    },

    getKhoStatusBadgeClass(status) {
        status = status || 'Sẵn sàng';
        switch (status) {
            case 'Sẵn sàng':
                return 'bg-green-50 text-green-700 border border-green-200';
            case 'Chưa sẵn sàng':
                return 'bg-lime-50 text-lime-700 border border-lime-200';
            case 'Đã dùng':
                return 'bg-blue-50 text-blue-700 border border-blue-200';
            case 'Ver lần 1':
                return 'bg-orange-50 text-orange-700 border border-orange-200';
            case 'Ver lần 2':
                return 'bg-purple-50 text-purple-700 border border-purple-200';
            case 'Banned':
                return 'bg-red-50 text-red-700 border border-red-200';
            case 'ko có Trail':
                return 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200';
            case 'Ver khi chưa dùng':
                return 'bg-violet-50 text-violet-700 border border-violet-200';
            case 'Lỗi Pay':
                return 'bg-amber-50 text-amber-700 border border-amber-200';
            case 'Lỗi BH':
                return 'bg-pink-50 text-pink-700 border border-pink-200';
            case 'Hủy (ver 2)':
                return 'bg-stone-50 text-stone-700 border border-stone-200';
            default:
                return 'bg-gray-50 text-gray-700 border border-gray-200';
        }
    },

    updateSelectedBackupEmail(row, newEmail) {
        row.newFamEmail = newEmail;
        const backup = this.khoRenewList.find(c => c.email.toLowerCase() === newEmail.toLowerCase());
        if (backup) {
            row.newFamPass = backup.pass;
            row.newFam2fa = backup.twofa;
            row.newFamMkp = backup.recoveryEmail;
            row.expiryDate = backup.renewDate || '';
        } else {
            row.newFamPass = '';
            row.newFam2fa = '';
            row.newFamMkp = '';
            row.expiryDate = '';
        }
    },

    fillEmailsByRenewDate() {
        if (!this.selectedBulkRenewDate) {
            this.showToast("Vui lòng chọn ngày cần thay.");
            return;
        }
        const group = this.groupedRenewDates.find(item => item.date === this.selectedBulkRenewDate);
        if (!group || group.fams.length === 0) {
            this.showToast("Không tìm thấy Fam nào cần thay thế vào ngày này.");
            return;
        }
        const emails = group.fams.map(f => f.email).filter(Boolean);
        this.bulkEmailInput = emails.join('\n');
        this.showToast(`✅ Đã lấy ${emails.length} email cho ngày ${this.selectedBulkRenewDate}`);
        this.analyzeBulkEmails();
    },

    copyBulkNewAccounts() {
        if (this.bulkActionResults.length === 0) {
            this.showToast("Không có dữ liệu để copy.");
            return;
        }
        const lines = this.bulkActionResults.map(row => {
            const email = row.newFamEmail || '';
            const pass = row.newFamPass || '';
            const mkp = row.newFamMkp || '';
            const twofa = row.newFam2fa || '';
            const exp = row.expiryDate || '';
            return `${email}\t${pass}\t${mkp}\t${twofa}\t${exp}`;
        });
        const textToCopy = lines.join('\n');
        this.copyToClipboard(textToCopy, "Email\tPass\tMKP\t2fa\tNgày Renew");
    },

    analyzeBulkEmails() {
        if (!this.bulkEmailInput || !this.bulkEmailInput.trim()) {
            this.showToast("Vui lòng nhập danh sách email.");
            this.bulkActionResults = [];
            return;
        }

        const emails = this.bulkEmailInput.split(/[\n,;]+/)
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);

        const results = [];
        // Lấy tất cả các tài khoản sẵn sàng trong kho
        let availableBackup = this.khoRenewList.filter(c => c.status === 'Sẵn sàng');
        
        // Loại trừ các tài khoản đã được gán cặp chờ xử lý
        const pairedEmails = new Set(Object.values(this.famRenewPairings).map(p => (p.nextFamEmail || '').toLowerCase()));
        availableBackup = availableBackup.filter(c => !pairedEmails.has(c.email.toLowerCase()));

        let backupIndex = 0;
        const todayObj = new Date();
        todayObj.setHours(0,0,0,0);

        emails.forEach(email => {
            const activeMatch = this.famRenewList.find(f => (f.email || '').toLowerCase() === email);
            const warehouseMatch = this.khoRenewList.find(c => (c.email || '').toLowerCase() === email);

            let foundIn = 'NOT_FOUND';
            if (activeMatch && warehouseMatch) {
                foundIn = 'BOTH';
            } else if (activeMatch) {
                foundIn = 'RENEW';
            } else if (warehouseMatch) {
                foundIn = 'KHO_RENEW';
            }

            let currentStatus = '-';
            if (activeMatch) currentStatus = activeMatch.status || 'Mới';
            else if (warehouseMatch) currentStatus = warehouseMatch.status || 'Sẵn sàng';

            let stt = activeMatch ? activeMatch.stt : '';
            let oldExpiry = activeMatch ? activeMatch.expiryDate : '';
            let daysRemaining = null;

            if (oldExpiry) {
                const parts = String(oldExpiry).trim().split('/');
                if (parts.length === 3) {
                    const expDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                    expDate.setHours(0,0,0,0);
                    if (expDate.getTime() > 0) {
                        const diff = expDate.getTime() - todayObj.getTime();
                        daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    }
                }
            }

            let targetItem = {
                email: email,
                foundIn: foundIn,
                currentStatus: currentStatus,
                stt: stt,
                oldExpiry: oldExpiry,
                daysRemaining: daysRemaining,
                newFamEmail: '',
                newFamPass: '',
                newFam2fa: '',
                newFamMkp: '',
                expiryDate: '',
                notes: ''
            };

            if (this.bulkActionType === 'replace') {
                if (backupIndex < availableBackup.length) {
                    const backup = availableBackup[backupIndex];
                    targetItem.newFamEmail = backup.email;
                    targetItem.newFamPass = backup.pass;
                    targetItem.newFam2fa = backup.twofa;
                    targetItem.newFamMkp = backup.recoveryEmail;
                    targetItem.expiryDate = backup.renewDate || '';
                    backupIndex++;
                } else {
                    targetItem.newFamEmail = 'HẾT ACC SẴN SÀNG';
                }
            }

            results.push(targetItem);
        });

        this.bulkActionResults = results;
        this.showToast(`📊 Đã đối chiếu xong ${results.length} email.`);
    },

    async executeBulkAction() {
        if (this.isExecutingBulkAction) return;
        if (this.bulkActionResults.length === 0) {
            this.showToast("Chưa có danh sách đối chiếu.");
            return;
        }

        this.isExecutingBulkAction = true;
        this.showToast("Đang thực hiện yêu cầu lên hệ thống...");

        try {
            if (this.bulkActionType === 'status' || this.bulkActionType === 'banned') {
                const emails = this.bulkActionResults.map(r => r.email);
                const targetStatus = this.bulkActionType === 'banned' ? 'Banned' : this.bulkStatusTarget;
                const notesVal = prompt(`Nhập ghi chú cho việc cập nhật Trạng thái sang "${targetStatus}" (nếu có):`) || `${targetStatus} hàng loạt`;
                
                let staffVal = this.currentUsername;
                if (!staffVal) {
                    staffVal = (this.currentUserRole === 'staff') ? 'goshop1' : 'DNC';
                }
                if (staffVal.toLowerCase() === 'goshop1' || staffVal.toLowerCase() === 'staff') {
                    staffVal = 'Lộc';
                } else if (staffVal.toLowerCase() === 'admin' || staffVal.toLowerCase() === 'dnc operator' || staffVal.toLowerCase() === 'dnc') {
                    staffVal = 'DNC';
                }

                const res = await fetch(this.CONFIG.WEBAPP_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'bulk_update_status',
                        emails: emails,
                        status: targetStatus,
                        notes: notesVal,
                        staff: staffVal
                    })
                });
                const result = await res.json();
                if (result.status === 'success') {
                    this.showToast(`✅ Đã cập nhật trạng thái "${targetStatus}" thành công cho ${result.updatedCount} tài khoản!`);
                    this.bulkEmailInput = '';
                    this.bulkActionResults = [];
                    await this.fetchSheetData();
                } else {
                    this.showToast("❌ Lỗi: " + result.message);
                }
            } else {
                // Thay thế Fam mới
                const validReps = this.bulkActionResults.filter(r => r.stt && r.newFamEmail && r.newFamEmail !== 'HẾT ACC SẴN SÀNG');
                if (validReps.length === 0) {
                    this.showToast("Không có email nào đủ điều kiện thay thế (cần khớp STT Fam và có Acc sẵn sàng).");
                    this.isExecutingBulkAction = false;
                    return;
                }

                const payloadReps = validReps.map(r => ({
                    stt: r.stt,
                    oldEmail: r.email,
                    nextFamEmail: r.newFamEmail,
                    nextFamPass: r.newFamPass,
                    nextFamMkp: r.newFamMkp,
                    nextFam2fa: r.newFam2fa,
                    expiryDate: r.expiryDate,
                    notes: r.notes || ''
                }));

                let staffVal = this.currentUsername;
                if (!staffVal) {
                    staffVal = (this.currentUserRole === 'staff') ? 'goshop1' : 'DNC';
                }
                if (staffVal.toLowerCase() === 'goshop1' || staffVal.toLowerCase() === 'staff') {
                    staffVal = 'Lộc';
                } else if (staffVal.toLowerCase() === 'admin' || staffVal.toLowerCase() === 'dnc operator' || staffVal.toLowerCase() === 'dnc') {
                    staffVal = 'DNC';
                }

                const res = await fetch(this.CONFIG.WEBAPP_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'bulk_replace_fams_with_history',
                        replacements: payloadReps,
                        staff: staffVal
                    })
                });
                const result = await res.json();
                if (result.status === 'success') {
                    this.showToast(`✅ Đã thay thế thành công ${payloadReps.length} Fam!`);
                    this.bulkEmailInput = '';
                    this.bulkActionResults = [];
                    await this.fetchSheetData();
                } else {
                    this.showToast("❌ Lỗi: " + result.message);
                }
            }
        } catch (e) {
            console.error(e);
            this.showToast("❌ Lỗi kết nối khi gửi yêu cầu!");
        } finally {
            this.isExecutingBulkAction = false;
        }
    },

    getMailSttFam(email) {
        if (!email || email === '-') return '';
        const cleanEmail = String(email).trim().toLowerCase();
        const found = (this.khoRenewList || []).find(c => String(c.email).trim().toLowerCase() === cleanEmail);
        if (found && found.sttFam) {
            return `(STT: ${found.sttFam})`;
        }
        return '';
    },

    cleanDateDisplay(val) {
        if (!val || val === '-' || val === '') return '';
        const str = String(val).trim();
        if (str.includes('GMT') || str.includes('Indochina') || str.includes('00:00:00') || str.match(/^[a-zA-Z]{3} [a-zA-Z]{3} \d{2} \d{4}/) || str.match(/^\d{4}-\d{2}-\d{2}/)) {
            try {
                const d = new Date(str);
                if (!isNaN(d.getTime())) {
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    return `${day}/${month}/${year}`;
                }
            } catch(e) {}
        }
        return str.split(' ')[0];
    },

    getKhoRenewInfo(email) {
        if (!email || email === '-') return { sttFam: '', renewDate: '', importDate: '' };
        const cleanEmail = String(email).trim().toLowerCase();
        const found = (this.khoRenewList || []).find(c => String(c.email).trim().toLowerCase() === cleanEmail);
        if (found) {
            return {
                sttFam: found.sttFam || '',
                renewDate: this.cleanDateDisplay(found.renewDate || ''),
                importDate: this.cleanDateDisplay(found.importDate || '')
            };
        }
        return { sttFam: '', renewDate: '', importDate: '' };
    },

    parseTimestampMs(s) {
        try {
            if (!s || s === '-' || s === 'Ban đầu / Hiện tại') return 0;
            const str = String(s).trim();
            const p = str.split(' ');
            const dp = p[0].split('/');
            const tp = (p[1] || '00:00:00').split(':');
            if (dp.length === 3) {
                return new Date(dp[2], dp[1]-1, dp[0], tp[0]||0, tp[1]||0, tp[2]||0).getTime();
            }
            const d = new Date(str);
            if (!isNaN(d.getTime())) return d.getTime();
        } catch(e){}
        return 0;
    },

    async fetchReplaceHistory() {
        this.isFetchingHistory = true;
        try {
            const res = await fetch(this.CONFIG.WEBAPP_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'get_replace_history' })
            });
            const result = await res.json();
            if (result.status === 'success' && result.data) {
                this.replaceHistoryList = result.data.slice().sort((a, b) => this.parseTimestampMs(b.timestamp) - this.parseTimestampMs(a.timestamp));
            }
        } catch (e) {
            console.error("Failed to fetch history:", e);
        } finally {
            this.isFetchingHistory = false;
        }
    },

    async fetchStatusHistory() {
        this.isFetchingStatusHistory = true;
        try {
            const res = await fetch(this.CONFIG.WEBAPP_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'get_status_history' })
            });
            const result = await res.json();
            if (result.status === 'success' && result.data) {
                this.statusHistoryList = result.data.map(item => ({
                    ...item,
                    renewDate: this.cleanDateDisplay(item.renewDate || ''),
                    importDate: this.cleanDateDisplay(item.importDate || '')
                })).slice().sort((a, b) => this.parseTimestampMs(b.timestamp) - this.parseTimestampMs(a.timestamp));
            }
        } catch (e) {
            console.error("Failed to fetch status history:", e);
        } finally {
            this.isFetchingStatusHistory = false;
        }
    },

    async fetchNhatKyXuLy() {
        try {
            const res = await fetch(this.CONFIG.WEBAPP_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'get_nhat_ky_xu_ly' })
            });
            const result = await res.json();
            if (result.status === 'success' && result.data && result.data.length > 0) {
                this.loiNotes = result.data;
                localStorage.setItem('fam_loi_notes', JSON.stringify(this.loiNotes));
            }
        } catch (e) {
            console.error("Failed to fetch nhat ky xu ly:", e);
        }
    },

    async fetchRnTracking() {
        this.isFetchingRnTracking = true;
        try {
            const res = await fetch(this.CONFIG.WEBAPP_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'get_kiem_soat_rn' })
            });
            const result = await res.json();
            if (result.status === 'success') {
                if (result.data) this.rnTrackingList = result.data.slice().sort((a, b) => this.parseTimestampMs(b.timestamp) - this.parseTimestampMs(a.timestamp));
                if (result.renewList) this.renewList = result.renewList;
                this.$nextTick(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); });
            }
        } catch (e) {
            console.error("Failed to fetch rn tracking:", e);
        } finally {
            this.isFetchingRnTracking = false;
        }
    },

    get groupedRnTrackingList() {
        const query = (this.rnTrackingSearchQuery || '').trim().toLowerCase();
        const filter = this.rnTrackingFilterType || 'all';
        
        const groups = {};
        // 1. Lấy danh sách gốc từ sheet RENEW (Cột B định danh cố định, cột D Email hiện tại do hàm)
        (this.renewList || []).forEach(item => {
            const rnKey = (item.rn || 'N/A').toString().trim();
            if (rnKey && !groups[rnKey]) {
                groups[rnKey] = {
                    rn: rnKey,
                    events: [],
                    latestStatus: item.status || 'Đang dùng',
                    latestEmail: item.email || '-',
                    latestTime: '-',
                    expiryDate: item.expiryDate || '-',
                    totalEvents: 0,
                    hasError: false,
                    isFromRenew: true
                };
            }
        });
        
        // 2. Gom các sự kiện theo dõi trong KIEM_SOAT_RN vào từng định danh RN
        this.rnTrackingList.forEach(item => {
            const rnKey = (item.rn || 'N/A').toString().trim();
            if (!groups[rnKey]) {
                groups[rnKey] = {
                    rn: rnKey,
                    events: [],
                    latestStatus: '-',
                    latestEmail: '-',
                    latestTime: '-',
                    expiryDate: '-',
                    totalEvents: 0,
                    hasError: false,
                    isFromRenew: false
                };
            }
            groups[rnKey].events.push(item);
        });
        
        // 3. Sắp xếp timeline và tổng hợp trạng thái mới nhất
        const resultList = Object.values(groups).map(g => {
            g.events.sort((a, b) => {
                return this.parseTimestampMs(a.timestamp) - this.parseTimestampMs(b.timestamp);
            });
            
            const formatCleanVal = (val) => {
                if (!val || val === '-') return val;
                const s = String(val).trim();
                if (s.includes('GMT+') || s.includes('Indochina Time') || s.match(/^[a-zA-Z]{3} [a-zA-Z]{3} \d{2} \d{4}/)) {
                    try {
                        const d = new Date(s);
                        if (!isNaN(d.getTime())) {
                            const dd = String(d.getDate()).padStart(2, '0');
                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                            const yyyy = d.getFullYear();
                            return `${dd}/${mm}/${yyyy}`;
                        }
                    } catch(e){}
                }
                return s;
            };
            
            g.expiryDate = formatCleanVal(g.expiryDate);
            g.latestEmail = formatCleanVal(g.latestEmail);
            g.events.forEach(ev => {
                ev.expiryDate = formatCleanVal(ev.expiryDate);
                ev.oldEmail = formatCleanVal(ev.oldEmail);
                ev.newEmail = formatCleanVal(ev.newEmail);
            });

            g.totalEvents = g.events.length;
            if (g.events.length > 0) {
                const latest = g.events[g.events.length - 1];
                g.latestStatus = latest.status || g.latestStatus || '-';
                g.latestEmail = formatCleanVal(latest.newEmail || latest.oldEmail || g.latestEmail || '-');
                g.latestTime = formatCleanVal(latest.timestamp || '-');
                if (latest.expiryDate && latest.expiryDate !== '-') {
                    g.expiryDate = formatCleanVal(latest.expiryDate);
                }
            } else if (g.isFromRenew) {
                // Tạo step hiển thị trạng thái gốc hiện tại ở cột D sheet RENEW
                g.events.push({
                    timestamp: 'Ban đầu / Hiện tại',
                    eventType: 'Ghi nhận từ RENEW',
                    oldEmail: '',
                    newEmail: g.latestEmail,
                    status: g.latestStatus,
                    expiryDate: g.expiryDate,
                    staff: 'Hệ thống / Hàm',
                    notes: 'Định danh RN theo cột B, email hiện tại theo cột D sheet RENEW'
                });
                g.totalEvents = 1;
            }
            
            const errWords = ['ver', 'lỗi', 'banned', 'ko có trail', 'chưa sẵn sàng'];
            g.hasError = g.events.some(e => {
                const st = (e.status || '').toLowerCase();
                return errWords.some(w => st.includes(w));
            });
            
            return g;
        });
        
        return resultList.filter(g => {
            if (query) {
                const matchRn = g.rn.toLowerCase().includes(query);
                const matchEmail = g.events.some(e => (e.oldEmail||'').toLowerCase().includes(query) || (e.newEmail||'').toLowerCase().includes(query));
                const matchNote = g.events.some(e => (e.notes||'').toLowerCase().includes(query));
                if (!matchRn && !matchEmail && !matchNote) return false;
            }
            if (filter === 'errors') {
                if (!g.hasError) return false;
            } else if (filter === 'multiple') {
                if (g.totalEvents <= 1) return false;
            }
            return true;
        }).sort((a, b) => {
            const timeA = this.parseTimestampMs(a.latestTime);
            const timeB = this.parseTimestampMs(b.latestTime);
            if (timeB !== timeA) return timeB - timeA;
            return b.totalEvents - a.totalEvents;
        });
    },

    async revertHistoryItem(item) {
        if (!confirm(`Bạn có chắc chắn muốn hoàn tác (revert) thay thế cho STT ${item.stt}?\nTài khoản sẽ được đổi về: ${item.oldEmail}\nTài khoản mới ${item.newEmail} sẽ được trả về trạng thái Sẵn sàng.`)) {
            return;
        }

        this.showToast("Đang thực hiện hoàn tác...");
        try {
            const res = await fetch(this.CONFIG.WEBAPP_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'revert_replacement',
                    timestamp: item.timestamp,
                    stt: item.stt
                })
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.showToast("✅ Đã hoàn tác thay thế thành công!");
                await this.fetchSheetData();
            } else {
                this.showToast("❌ Lỗi: " + result.message);
            }
        } catch (e) {
            console.error(e);
            this.showToast("❌ Lỗi kết nối!");
        }
    },

    startEditHistory(item) {
        this.editingHistoryRow = { ...item };
        this.showHistoryEditModal = true;
    },

    async saveHistoryEdit() {
        if (!this.editingHistoryRow) return;
        this.showToast("Đang lưu chỉnh sửa lịch sử...");
        try {
            const res = await fetch(this.CONFIG.WEBAPP_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'update_history_item',
                    timestamp: this.editingHistoryRow.timestamp,
                    stt: this.editingHistoryRow.stt,
                    newEmail: this.editingHistoryRow.newEmail,
                    newPass: this.editingHistoryRow.newPass,
                    newMkp: this.editingHistoryRow.newMkp,
                    new2fa: this.editingHistoryRow.new2fa,
                    expiryDate: this.editingHistoryRow.expiryDate,
                    notes: this.editingHistoryRow.notes
                })
            });
            const result = await res.json();
            if (result.status === 'success') {
                this.showToast("✅ Đã cập nhật thành công!");
                this.editingHistoryRow = null;
                this.showHistoryEditModal = false;
                await this.fetchSheetData();
            } else {
                this.showToast("❌ Lỗi: " + result.message);
            }
        } catch (e) {
            console.error(e);
            this.showToast("❌ Lỗi kết nối!");
        }
    },

    cancelEditHistory() {
        this.editingHistoryRow = null;
        this.showHistoryEditModal = false;
    },

    // Markup FamRenew dùng các tên dưới đây nhưng bản cũ lại đặt tên khác (getFilteredFamRenew()...),
    // nên các tab "Yêu cầu", "Bảng", "Theo dõi lỗi" và "Kho dự phòng" không hiện dữ liệu. Khôi phục dưới dạng getter.
    get filteredFamRenew() {
        let res = this.famRenewList;
        if (this.famRenewFilterStatus !== 'all') {
            res = res.filter(i => i.status === this.famRenewFilterStatus);
        }
        if (this.famRenewShowUrgentOnly) {
            res = res.filter(i => {
                const a = this.getFamRenewAlert(i);
                return a.isWarrantyUrgent || a.isExpiryUrgent || i.status === 'Quét ver 1';
            });
        }
        if (this.famRenewSearchQuery) {
            const q = this.famRenewSearchQuery.toLowerCase();
            res = res.filter(i =>
                i.email.toLowerCase().includes(q) ||
                (i.pass || '').toLowerCase().includes(q) ||
                (i.recoveryEmail || '').toLowerCase().includes(q) ||
                (i.status || '').toLowerCase().includes(q) ||
                (i.type || '').toLowerCase().includes(q) ||
                (i.source || '').toLowerCase().includes(q)
            );
        }
        // Sắp xếp ưu tiên:
        // Cột A (slots) cái nào dưới 5 thì ưu tiên đưa lên đầu
        return [...res].sort((a, b) => {
            const getScore = (item) => {
                const slots = parseInt(item.slots);
                if (!isNaN(slots) && slots < 5 && slots > 0) {
                    return 1; // Ưu tiên lên đầu
                }
                return 0;
            };
            return getScore(b) - getScore(a);
        });
    },

    get famRenewStatuses() {
        const fixed = ['Mới', 'Đang dùng', 'Quét ver 1', 'Lỗi BH', 'Hết hạn - đã thay', 'Hủy (ver 2)'];
        const fromData = new Set(this.famRenewList.map(i => i.status).filter(Boolean));
        fixed.forEach(s => fromData.delete(s));
        return [...Array.from(fromData)];
    },

    get loiStatuses() {
        return ['Ver lần 1', 'Lỗi Pay', 'Banned', 'Lỗi BH', 'Hủy (ver 2)', 'Ver lần 2'];
    },

    get loiFams() {
        const today = new Date(); today.setHours(0,0,0,0);
        const statuses = this.loiStatuses;
        return this.khoRenewList.filter(f => {
            const st = (f.status || '').trim();
            if (!statuses.includes(st)) return false;
            if (this.loiFilter !== 'all' && st !== this.loiFilter) return false;
            if (!f.renewDate) return true;
            const parts = f.renewDate.split('/');
            if (parts.length !== 3) return true;
            const d = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
            return d >= today;
        });
    },

    get uniqueKhoRenewDates() {
        const dates = new Set();
        this.khoRenewList.forEach(c => {
            if (c.renewDate) dates.add(c.renewDate);
        });
        return Array.from(dates).sort((a, b) => {
            const parseDate = (dStr) => {
                const parts = dStr.split('/');
                if (parts.length === 3) return new Date(parts[2], parts[1]-1, parts[0]);
                return new Date(0);
            };
            return parseDate(a) - parseDate(b);
        });
    },

    get filteredKhoRenewList() {
        let list = this.khoRenewList.slice();
        if (this.khoRenewFilterDate && this.khoRenewFilterDate !== 'all') {
            list = list.filter(c => c.renewDate === this.khoRenewFilterDate);
        }
        return list.sort((a, b) => {
            const getWeight = (status) => {
                status = status || 'Sẵn sàng';
                switch (status) {
                    case 'Sẵn sàng': return 1;
                    case 'Chưa sẵn sàng': return 2;
                    case 'Ver lần 1': return 3;
                    case 'Ver lần 2': return 4;
                    case 'Ver khi chưa dùng': return 5;
                    case 'ko có Trail': return 6;
                    case 'Lỗi Pay': return 6.5;
                    case 'Đã dùng': return 7;
                    case 'Lỗi BH': return 7.5;
                    case 'Hủy (ver 2)': return 7.8;
                    case 'Banned': return 8;
                    default: return 9;
                }
            };
            return getWeight(a.status) - getWeight(b.status);
        });
    },
});
