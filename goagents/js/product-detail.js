/**
 * Goagents Single Product Detail Loader Component
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('productDetail', () => ({
    loading: true,
    product: null,
    notFound: false,
    selectedPackageIndex: 0,
    packages: [],

    async init() {
      this.loading = true;
      this.notFound = false;

      const urlParams = new URLSearchParams(window.location.search);
      const slug = urlParams.get('slug');

      if (!slug) {
        this.notFound = true;
        this.loading = false;
        return;
      }

      try {
        const item = await window.GoagentsData.getProductBySlug(slug);
        if (!item) {
          this.notFound = true;
        } else {
          this.product = item;
          this.generatePackages(item);
        }
      } catch (e) {
        console.error("Error loading product detail:", e);
        this.notFound = true;
      } finally {
        this.loading = false;
      }
    },

    generatePackages(p) {
      const baseDays = p.duration_days || 30;
      const basePrice = p.price_sale;
      const baseOriginal = p.price_original;

      if (baseDays === 365) {
        // Annual product default
        this.packages = [
          {
            durationDays: 365,
            priceSale: basePrice,
            priceOriginal: baseOriginal,
            label: '1 Năm (Chính chủ)',
            badge: 'Khuyên dùng'
          }
        ];
      } else {
        // Monthly products with multi-duration options
        this.packages = [
          {
            durationDays: 30,
            priceSale: basePrice,
            priceOriginal: baseOriginal,
            label: '1 Tháng',
            badge: null
          },
          {
            durationDays: 90,
            priceSale: Math.round((basePrice * 3) * 0.92 / 1000) * 1000,
            priceOriginal: baseOriginal * 3,
            label: '3 Tháng',
            badge: 'Tiết kiệm 8%'
          },
          {
            durationDays: 180,
            priceSale: Math.round((basePrice * 6) * 0.85 / 1000) * 1000,
            priceOriginal: baseOriginal * 6,
            label: '6 Tháng',
            badge: 'Tiết kiệm 15%'
          },
          {
            durationDays: 365,
            priceSale: Math.round((basePrice * 12) * 0.75 / 1000) * 1000,
            priceOriginal: baseOriginal * 12,
            label: '12 Tháng (1 Năm)',
            badge: 'Hot Deal -25%'
          }
        ];
      }
      this.selectedPackageIndex = 0;
    },

    get activePackage() {
      return this.packages[this.selectedPackageIndex] || {
        durationDays: this.product ? this.product.duration_days : 30,
        priceSale: this.product ? this.product.price_sale : 0,
        priceOriginal: this.product ? this.product.price_original : 0,
        label: 'Gói tiêu chuẩn'
      };
    },

    get discountPercent() {
      const pkg = this.activePackage;
      if (!pkg.priceOriginal || pkg.priceOriginal <= pkg.priceSale) return 0;
      return Math.round(((pkg.priceOriginal - pkg.priceSale) / pkg.priceOriginal) * 100);
    },

    get descriptionParagraphs() {
      if (!this.product || !this.product.description) return [];
      return this.product.description.split('\n').filter(line => line.trim().length > 0);
    },

    buyNow() {
      if (this.product) {
        window.openOrderModal(this.product, this.activePackage);
      }
    }
  }));
});
