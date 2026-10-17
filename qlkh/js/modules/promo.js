// promo.js — tách từ admin/index.html (logic giữ nguyên, đã chỉnh trong qlkh)
QLKH.define('promo', {
    promoCodes: {},

    promoList: [],

    promoSearch: '',

    showPromoModal: false,

    promoForm: {
        isEdit: false,
        oldCode: '',
        code: '',
        discount: 0
    },

    loadPromoCodes() {
        const defaultCodes = {
            'GOSHOP50': 50000,
            'DNC': 20000,
            'KHACHVIP': 30000,
            'GIAM10K': 10000
        };
        const existing = localStorage.getItem('goshop_promo_codes');
        if (existing) {
            try {
                this.promoCodes = JSON.parse(existing);
            } catch (e) {
                this.promoCodes = defaultCodes;
                localStorage.setItem('goshop_promo_codes', JSON.stringify(defaultCodes));
            }
        } else {
            this.promoCodes = defaultCodes;
            localStorage.setItem('goshop_promo_codes', JSON.stringify(defaultCodes));
        }
        this.updatePromoList();
    },

    updatePromoList() {
        this.promoList = Object.entries(this.promoCodes).map(([code, discount]) => ({
            code,
            discount
        }));
    },

    savePromoCodes() {
        localStorage.setItem('goshop_promo_codes', JSON.stringify(this.promoCodes));
        this.updatePromoList();
    },

    openAddPromoModal() {
        this.promoForm = {
            isEdit: false,
            oldCode: '',
            code: '',
            discount: 0
        };
        this.showPromoModal = true;
        this.$nextTick(() => lucide.createIcons());
    },

    openEditPromoModal(promo) {
        this.promoForm = {
            isEdit: true,
            oldCode: promo.code,
            code: promo.code,
            discount: promo.discount
        };
        this.showPromoModal = true;
        this.$nextTick(() => lucide.createIcons());
    },

    submitPromoForm() {
        const code = this.promoForm.code.trim().toUpperCase();
        if (!code) {
            this.showToast('Tên mã không được để trống!');
            return;
        }
        if (this.promoForm.discount <= 0) {
            this.showToast('Số tiền giảm phải lớn hơn 0!');
            return;
        }

        if (this.promoForm.isEdit) {
            if (this.promoForm.oldCode !== code) {
                delete this.promoCodes[this.promoForm.oldCode];
            }
            this.promoCodes[code] = parseInt(this.promoForm.discount);
            this.showToast(`Đã cập nhật mã ${code} thành công!`);
        } else {
            if (this.promoCodes[code] !== undefined) {
                this.showToast('Mã giảm giá này đã tồn tại!');
                return;
            }
            this.promoCodes[code] = parseInt(this.promoForm.discount);
            this.showToast(`Đã thêm mã ${code} thành công!`);
        }

        this.savePromoCodes();
        this.showPromoModal = false;
    },

    deletePromoCode(code) {
        if (confirm(`Bạn có chắc chắn muốn xóa mã giảm giá ${code}?`)) {
            delete this.promoCodes[code];
            this.savePromoCodes();
            this.showToast(`Đã xóa mã ${code}!`);
        }
    }
});
