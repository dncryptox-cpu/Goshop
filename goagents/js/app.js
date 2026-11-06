/**
 * Goagents Global Application Logic & Alpine Stores
 */

// Helper utility for VND formatting
window.formatVND = function(amount) {
  if (!amount && amount !== 0) return '0đ';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
    .format(amount)
    .replace('₫', 'đ');
};

document.addEventListener('alpine:init', () => {
  // Global Shop Store & Modal State
  Alpine.store('shop', {
    config: window.GOAGENTS_CONFIG || {},
    mobileMenuOpen: false,
    
    // Order Modal State
    orderModalOpen: false,
    orderSubmitting: false,
    orderSuccess: false,
    orderError: null,
    orderResult: null,

    // Current Selected Product for Order
    selectedProduct: null,
    selectedPackage: null,
    quantity: 1,

    // Form inputs
    customerName: '',
    contactChannel: 'zalo',
    contactValue: '',
    note: '',

    openOrderModal(product, pkgOption = null) {
      this.selectedProduct = product;
      this.selectedPackage = pkgOption || {
        durationDays: product.duration_days || 30,
        priceSale: product.price_sale,
        priceOriginal: product.price_original,
        label: product.duration_days ? `${product.duration_days} Ngày` : 'Gói chuẩn'
      };
      this.quantity = 1;
      this.customerName = '';
      this.contactChannel = 'zalo';
      this.contactValue = '';
      this.note = '';
      this.orderSubmitting = false;
      this.orderSuccess = false;
      this.orderError = null;
      this.orderModalOpen = true;
    },

    closeOrderModal() {
      this.orderModalOpen = false;
    },

    get unitPrice() {
      if (this.selectedPackage && this.selectedPackage.priceSale) {
        return this.selectedPackage.priceSale;
      }
      return this.selectedProduct ? this.selectedProduct.price_sale : 0;
    },

    get totalPrice() {
      return this.unitPrice * (parseInt(this.quantity) || 1);
    },

    async submitOrder() {
      if (!this.customerName.trim()) {
        this.orderError = 'Vui lòng nhập Họ tên của bạn';
        return;
      }
      if (!this.contactValue.trim()) {
        this.orderError = 'Vui lòng nhập Zalo hoặc Số điện thoại liên hệ';
        return;
      }

      this.orderSubmitting = true;
      this.orderError = null;

      const payload = {
        product_id: this.selectedProduct.id,
        customer_name: this.customerName.trim(),
        contact_channel: this.contactChannel,
        contact_value: this.contactValue.trim(),
        quantity: parseInt(this.quantity) || 1,
        unit_price: this.unitPrice,
        total_price: this.totalPrice,
        note: this.note.trim() ? `[${this.selectedPackage.label}] ${this.note.trim()}` : `[${this.selectedPackage.label}]`,
        status: 'pending'
      };

      try {
        const res = await window.GoagentsData.createOrder(payload);
        if (res && res.success) {
          this.orderResult = res;
          this.orderSuccess = true;
        } else {
          this.orderError = 'Không thể gửi đơn hàng. Vui lòng thử lại!';
        }
      } catch (err) {
        console.error("Submit order error:", err);
        this.orderError = 'Đã có lỗi xảy ra. Vui lòng liên hệ trực tiếp qua Zalo!';
      } finally {
        this.orderSubmitting = false;
      }
    }
  });
});

// Global trigger helper
window.openOrderModal = function(product, pkgOption) {
  if (window.Alpine) {
    Alpine.store('shop').openOrderModal(product, pkgOption);
  }
};
