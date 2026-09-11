/**
 * Goagents Products List & Filter Component Logic
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('productsCatalog', () => ({
    loading: true,
    categories: [],
    products: [],
    
    // Filter & Sort State
    searchQuery: '',
    selectedCategorySlug: 'all',
    priceRangeMax: 1000000,
    sortBy: 'newest', // 'newest' | 'price-asc' | 'price-desc'

    async init() {
      this.loading = true;
      try {
        const [cats, prods] = await Promise.all([
          window.GoagentsData.getCategories(),
          window.GoagentsData.getProducts()
        ]);
        this.categories = cats || [];
        this.products = prods || [];

        // Check URL params for pre-selected category
        const urlParams = new URLSearchParams(window.location.search);
        const catParam = urlParams.get('category');
        if (catParam) {
          this.selectedCategorySlug = catParam;
        }
      } catch (e) {
        console.error("Failed to load catalog data:", e);
      } finally {
        this.loading = false;
      }
    },

    get categoryMap() {
      const map = {};
      this.categories.forEach(c => {
        map[c.id] = c;
      });
      return map;
    },

    getCategoryName(product) {
      if (product.categories && product.categories.name) {
        return product.categories.name;
      }
      if (product.category_id && this.categoryMap[product.category_id]) {
        return this.categoryMap[product.category_id].name;
      }
      return 'Sản phẩm';
    },

    get filteredProducts() {
      let list = [...this.products];

      // 1. Search filter
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase().trim();
        list = list.filter(p => 
          p.name.toLowerCase().includes(q) || 
          (p.short_description && p.short_description.toLowerCase().includes(q))
        );
      }

      // 2. Category filter
      if (this.selectedCategorySlug !== 'all') {
        const cat = this.categories.find(c => c.slug === this.selectedCategorySlug);
        if (cat) {
          list = list.filter(p => p.category_id === cat.id || (p.categories && p.categories.slug === cat.slug));
        }
      }

      // 3. Price filter
      list = list.filter(p => p.price_sale <= this.priceRangeMax);

      // 4. Sorting
      if (this.sortBy === 'price-asc') {
        list.sort((a, b) => a.price_sale - b.price_sale);
      } else if (this.sortBy === 'price-desc') {
        list.sort((a, b) => b.price_sale - a.price_sale);
      } else {
        // newest / default sort order
        list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }

      return list;
    },

    selectCategory(slug) {
      this.selectedCategorySlug = slug;
    },

    getDiscountPercent(p) {
      if (!p.price_original || p.price_original <= p.price_sale) return 0;
      return Math.round(((p.price_original - p.price_sale) / p.price_original) * 100);
    }
  }));
});
