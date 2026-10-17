// twofa.js — tách từ admin/index.html (logic giữ nguyên, đã chỉnh trong qlkh)
QLKH.define('twofa', {
    twofaList: [],

    twofaSearchQuery: '',

    twofaForm: { id: '', email: '', secret: '' },

    showTwofaModal: false,

    isEditingTwofa: false,

    saveTwofaData() {
        // Only save locally-added items to localStorage
        const localOnly = this.twofaList.filter(i => !i.fromSheet);
        localStorage.setItem('goshop_twofa_accounts', JSON.stringify(localOnly));
    },

    get filteredTwofaList() {
        if (!this.twofaSearchQuery) return this.twofaList;
        const q = this.twofaSearchQuery.toLowerCase();
        return this.twofaList.filter(item => 
            (item.id && item.id.toLowerCase().includes(q)) || 
            (item.email && item.email.toLowerCase().includes(q))
        );
    },

    openAddTwofaModal() {
        this.twofaForm = { id: '2FA-' + Date.now().toString().slice(-6), email: '', secret: '' };
        this.isEditingTwofa = false;
        this.showTwofaModal = true;
    },

    openEditTwofaModal(item) {
        this.twofaForm = { ...item };
        this.isEditingTwofa = true;
        this.showTwofaModal = true;
    },

    saveTwofa() {
        if (!this.twofaForm.email || !this.twofaForm.secret) return;
        
        if (this.isEditingTwofa) {
            const index = this.twofaList.findIndex(i => i.id === this.twofaForm.id);
            if (index !== -1) {
                this.twofaList[index] = { ...this.twofaList[index], ...this.twofaForm };
            }
        } else {
            this.twofaList.push({
                ...this.twofaForm,
                lastUsed: 'Chưa sử dụng'
            });
        }
        this.saveTwofaData();
        this.showTwofaModal = false;
        this.showToast('Đã lưu thông tin 2FA!');
    },

    deleteTwofa(id) {
        if(confirm('Bạn có chắc chắn muốn xóa tài khoản 2FA này?')) {
            this.twofaList = this.twofaList.filter(i => i.id !== id);
            this.saveTwofaData();
            this.showToast('Đã xóa tài khoản 2FA!');
        }
    },

    async copyTwofaCode(item) {
        this.showToast('Đang lấy mã 2FA...');
        try {
            let cleanKey = item.secret.replace(/\s+/g, '').toUpperCase();
            if (cleanKey.includes('OTPAUTH://')) {
                 const url = new URL(item.secret.replace(/\s+/g, ''));
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
            item.lastUsed = new Date().toLocaleString('vi-VN');
            this.saveTwofaData();
            this.showToast('Đã lấy và Copy mã 2FA thành công!');
        } catch (e) {
            this.showToast('Không thể lấy mã 2FA. Vui lòng kiểm tra Secret Key.');
        }
    }
});
