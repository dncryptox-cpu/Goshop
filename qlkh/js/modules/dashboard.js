// dashboard.js — tách từ admin/index.html (logic giữ nguyên, đã chỉnh trong qlkh)
QLKH.define('dashboard', {
    showDashboardFinance: localStorage.getItem('goshop_show_dashboard_finance') !== 'false',

    dashboardCustomerSearch: '',

    dashboardCustomerStatus: 'all',

    get dashboardFilteredCustomers() {
        let list = [...(this.dataGocList || [])];
        if (this.dashboardCustomerStatus === 'active') {
            list = list.filter(item => item.daysLeft !== null && item.daysLeft > 15);
        } else if (this.dashboardCustomerStatus === 'warning') {
            list = list.filter(item => item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= 15);
        } else if (this.dashboardCustomerStatus === 'expired') {
            list = list.filter(item => item.daysLeft !== null && item.daysLeft < 0);
        }
        const q = (this.dashboardCustomerSearch || '').trim().toLowerCase();
        if (q) {
            list = list.filter(item => 
                String(item.email || '').toLowerCase().includes(q) ||
                String(item.subEmail || '').toLowerCase().includes(q) ||
                String(item.product || '').toLowerCase().includes(q) ||
                String(item.staff || '').toLowerCase().includes(q)
            );
        }
        if (this.dashboardCustomerStatus === 'all') {
            list.sort((a, b) => {
                const da = a.daysLeft !== null ? a.daysLeft : 9999;
                const db = b.daysLeft !== null ? b.daysLeft : 9999;
                return da - db;
            });
        }
        return list.slice(0, 20);
    }
});
