/**
 * CONNECTOR TEMPLATE — Hướng Dẫn Kỹ Thuật Thêm Sàn/Exchange Mới
 * ============================================================================
 * Muốn kết nối thêm 1 sàn/DEX thứ 3 trong tương lai (Ví dụ: Binance, Bybit, Vertex, dYdX...):
 * 
 * BƯỚC 1: Tạo file connectors/ten_san_moi.js (Ví dụ: connectors/binance.js)
 * 
 * BƯỚC 2: Định nghĩa đối tượng Connector chuẩn theo khuôn giao ước (Interface) dưới đây:
 * 
 * window.TenSanMoiConnector = {
 *   id: 'ten_san_moi',             // Unique ID thường chữ thường (VD: 'binance', 'bybit')
 *   name: 'Tên Sàn Mới (Hiển Thị)', // Tên đầy đủ hiển thị trong dropdown Quản Lý Cặp
 *   
 *   /**
 *    * Hàm quy chuẩn bắt buộc (Contract Interface):
 *    * @param {string} symbol - Mã ticker sản phẩm (VD: 'BTCUSDT', 'ETH-PERP')
 *    * @param {object} options - Tham số tùy chọn cấu hình API nếu có
 *    * @returns {Promise<{price: number, funding: number|null, volume24h: number, priceSource: string}>}
 *    *\/
 *   async fetchAssetData(symbol, options = {}) {
 *     // 1. Gọi REST API của sàn mới
 *     const res = await fetch(`https://api.tensanmoi.com/v1/ticker?symbol=${symbol}`);
 *     if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
 *     const data = await res.json();
 *     
 *     // 2. Ép kiểu và chuẩn hoá định dạng trả về ĐÚNG HỢP ĐỒNG:
 *     return {
 *       price: parseFloat(data.price),         // Giá sống (Mark Price / Index Price / Last Trade)
 *       funding: parseFloat(data.fundingRate), // Funding Rate % năm (null nếu sàn không có funding)
 *       volume24h: parseFloat(data.volume24h), // Volume giao dịch 24h quy đổi sang USD
 *       priceSource: 'mark_price'              // 'mark_price' | 'index_price' | 'last_trade'
 *     };
 *   }
 * };
 * 
 * BƯỚC 3: Nhúng file script vào index.html TRƯỚC file app.js:
 *   <script src="connectors/ten_san_moi.js"></script>
 * 
 * BƯỚC 4: Đăng ký connector mới vào ConnectorRegistry trong app.js (hoặc file connector tự đăng ký):
 *   ConnectorRegistry.register(window.TenSanMoiConnector);
 * 
 * ============================================================================
 * Hệ thống sẽ tự động nhận diện sàn mới trong Dropdown Quản Lý Cặp mà KHÔNG CẦN sửa code phần lõi!
 */
