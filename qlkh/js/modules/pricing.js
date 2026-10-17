// pricing.js — tách từ admin/index.html (logic giữ nguyên, đã chỉnh trong qlkh)
QLKH.define('pricing', {
    catalogProducts: [
        { id: 'CAPCUT', name: 'CapCut Pro', icon: 'video', desc: 'Trình chỉnh sửa video chuyên nghiệp bằng AI, kho tài nguyên không giới hạn.', prices: { 30: 55000, 90: 150000, 180: 275000, 360: 495000 }, defaultDuration: 30 },
        { id: 'CAPCUT_SHARE', name: 'CapCut Pro (Share)', icon: 'users', desc: 'Sử dụng chung tài khoản CapCut Pro tiết kiệm chi phí.', prices: { 365: 250000 }, defaultDuration: 365 },
        { id: 'YTB_BASIC', name: 'Youtube Premium (Cơ bản)', icon: 'youtube', desc: 'Trải nghiệm xem video không quảng cáo, phát trong nền và tải xuống dễ dàng.', prices: { 30: 45000, 90: 110000, 180: 200000, 360: 375000 }, defaultDuration: 180 },
        { id: 'YTB_PLUS', name: 'Youtube Premium (Plus)', icon: 'youtube', desc: 'Đầy đủ quyền lợi Youtube kèm đặc quyền hỗ trợ ưu tiên, không giới hạn slot.', prices: { 180: 250000, 360: 445000 }, defaultDuration: 180 },
        { id: 'SPOTIFY', name: 'Spotify Premium', icon: 'music', desc: 'Nghe nhạc chất lượng cao, không quảng cáo, tải nhạc và nghe offline.', prices: { 180: 250000, 360: 450000 }, defaultDuration: 180 },
        { id: 'CANVA', name: 'Canva Pro', icon: 'palette', desc: 'Mở khóa toàn bộ kho tài nguyên thiết kế đồ họa cao cấp của Canva.', prices: { 365: 150000 }, defaultDuration: 365 },
        { id: 'GPT_SHARE', name: 'Chat GPT Plus (Share)', icon: 'bot', desc: 'Dùng chung tài khoản cấp GPT-4, tiết kiệm tối đa.', prices: { 30: 100000, 90: 270000 }, defaultDuration: 30 },
        { id: 'GPT_PLUS', name: 'Chat GPT Plus (Chính chủ)', icon: 'bot', desc: 'Nâng cấp GPT-4 trên chính tài khoản của bạn.', prices: { 30: 495000 }, defaultDuration: 30 },
        { id: 'GPT_GO', name: 'Chat GPT GO', icon: 'bot', desc: 'Phiên bản Chat GPT GO chuyên dụng.', prices: { 365: 495000 }, defaultDuration: 365 },
        { id: 'GG_ONE_500', name: 'Google One 500GB', icon: 'cloud', desc: 'Mở rộng không gian lưu trữ Google Drive, Photos an toàn.', prices: { 365: 150000 }, defaultDuration: 365 },
        { id: 'GG_ONE_2TB', name: 'Google One 2TB', icon: 'cloud', desc: 'Lưu trữ tẹt ga với 2TB dung lượng cao cấp từ Google.', prices: { 365: 350000 }, defaultDuration: 365 },
        { id: 'ADOBE', name: 'Adobe All Apps', icon: 'brush', desc: 'Trọn bộ ứng dụng thiết kế sáng tạo từ Adobe.', prices: { 30: 55000, 365: 550000 }, defaultDuration: 30 },
        { id: 'OFFICE_365', name: 'Office 365', icon: 'file-text', desc: 'Bộ ứng dụng văn phòng cao cấp Word, Excel, PowerPoint...', prices: { 365: 250000 }, defaultDuration: 365 }
    ],

    async loadCatalogProducts() {
        const sheetId = this.CONFIG.SHEET_ID;
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=CONFIG_PRICING`;
        try {
            const response = await fetch(url);
            const text = await response.text();
            const jsonStr = text.substring(text.indexOf('({') + 1, text.lastIndexOf('})') + 1);
            const data = JSON.parse(jsonStr);
            
            if (data.table && data.table.rows && data.table.rows.length > 0) {
                const newProducts = [];
                data.table.rows.forEach(row => {
                    const cols = row.c;
                    if (cols && cols[0] && cols[0].v) {
                        newProducts.push({
                            id: cols[0].v,
                            name: cols[1] ? cols[1].v : '',
                            icon: cols[2] ? cols[2].v : 'video',
                            desc: cols[3] ? cols[3].v : '',
                            prices: {
                                7: cols[4] ? parseInt(cols[4].v) || 0 : 0,
                                30: cols[5] ? parseInt(cols[5].v) || 0 : 0,
                                90: cols[6] ? parseInt(cols[6].v) || 0 : 0,
                                180: cols[7] ? parseInt(cols[7].v) || 0 : 0,
                                360: cols[8] ? parseInt(cols[8].v) || 0 : 0
                            },
                            defaultDuration: cols[9] ? parseInt(cols[9].v) || 30 : 30
                        });
                    }
                });
                if (newProducts.length > 0) {
                    this.catalogProducts = newProducts;
                    localStorage.setItem('goshop_catalog_products', JSON.stringify(this.catalogProducts));
                }
            }
        } catch (error) {
            console.error('Lỗi khi tải bảng giá từ Google Sheets:', error);
            const saved = localStorage.getItem('goshop_catalog_products');
            if (saved) {
                this.catalogProducts = JSON.parse(saved);
            }
        }
    }
});
