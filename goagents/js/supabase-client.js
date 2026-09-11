/**
 * Goagents Supabase Client & Data Provider (with offline/demo fallback)
 */
(function() {
  const MOCK_CATEGORIES = [
    { id: 'c1', name: 'Công cụ AI', slug: 'ai-tools', sort_order: 1 },
    { id: 'c2', name: 'Giải trí & Streaming', slug: 'streaming', sort_order: 2 },
    { id: 'c3', name: 'Đồ họa & Thiết kế', slug: 'design-editing', sort_order: 3 },
    { id: 'c4', name: 'Lưu trữ & Làm việc', slug: 'productivity', sort_order: 4 }
  ];

  const MOCK_PRODUCTS = [
    {
      id: 'p1',
      category_id: 'c1',
      name: 'ChatGPT Plus Official (1 Tháng)',
      slug: 'chatgpt-plus-1m',
      short_description: 'Tài khoản ChatGPT Plus chính chủ GPT-4o, DALL-E 3, Sora access, tốc độ xử lý ưu tiên.',
      description: `Sử dụng đầy đủ tính năng mạnh mẽ nhất của OpenAI:\n- Truy cập mô hình GPT-4o, GPT-4 Turbo không giới hạn tốc độ.\n- Phân tích dữ liệu nâng cao (Advanced Data Analysis), đọc file PDF/Excel.\n- Tạo ảnh nghệ thuật với DALL-E 3 cực sắc nét.\n- Truy cập GPTs Custom Store & tạo bot riêng.\n- Bảo hành 1 đổi 1 trong suốt 30 ngày sử dụng.`,
      image_url: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=600&auto=format&fit=crop&q=80',
      duration_days: 30,
      price_original: 490000,
      price_sale: 199000,
      is_active: true,
      sort_order: 1
    },
    {
      id: 'p2',
      category_id: 'c1',
      name: 'Claude Pro 3.5 Sonnet (1 Tháng)',
      slug: 'claude-pro-1m',
      short_description: 'AI lập trình & viết lách đỉnh nhất hiện nay với Claude 3.5 Sonnet & Artifacts.',
      description: `Bản nâng cấp Claude Pro từ Anthropic:\n- Context window khủng 200K tokens (đọc tài liệu hàng trăm trang).\n- Khả năng coding & xử lý logic vượt trội so với các AI khác.\n- Hỗ trợ tính năng Artifacts xem code / UI trực quan ngay lập tức.\n- Ưu tiên băng thông giờ cao điểm.\n- Bảo hành 100% full 30 ngày.`,
      image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
      duration_days: 30,
      price_original: 500000,
      price_sale: 220000,
      is_active: true,
      sort_order: 2
    },
    {
      id: 'p3',
      category_id: 'c1',
      name: 'Cursor Pro Code Editor (1 Tháng)',
      slug: 'cursor-pro-1m',
      short_description: 'Trình soạn thảo code AI đỉnh cao cho Lập trình viên, autocomplete siêu tốc.',
      description: `Cursor Pro - công cụ không thể thiếu cho Developer chuyên nghiệp:\n- Sử dụng không giới hạn GPT-4o, Claude 3.5 Sonnet trong IDE.\n- Tính năng Agent tự động refactor & fix bug trong toàn bộ codebase.\n- Autocomplete thông minh gợi ý nhiều dòng code theo ngữ cảnh.\n- Tích hợp Git, Terminal & Extension VS Code sẵn có.\n- Bảo hành uy tín 1:1 suốt thời hạn.`,
      image_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
      duration_days: 30,
      price_original: 500000,
      price_sale: 250000,
      is_active: true,
      sort_order: 3
    },
    {
      id: 'p4',
      category_id: 'c2',
      name: 'YouTube Premium Chính Chủ (1 Năm)',
      slug: 'youtube-premium-1y',
      short_description: 'Xem video không quảng cáo, nghe nhạc background YouTube Music HD.',
      description: `Nâng cấp chính chủ email cá nhân của bạn:\n- Xem video mượt mà không bị làm phiền bởi quảng cáo.\n- Tải video ngoại tuyến về điện thoại/máy tính bảng.\n- Phát nhạc chạy nền khi tắt màn hình.\n- Miễn phí YouTube Music Premium kho nhạc số lớn nhất thế giới.\n- Nâng cấp trực tiếp trên Email cá nhân, bảo hành trọn vẹn 12 tháng.`,
      image_url: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&auto=format&fit=crop&q=80',
      duration_days: 365,
      price_original: 950000,
      price_sale: 349000,
      is_active: true,
      sort_order: 4
    },
    {
      id: 'p5',
      category_id: 'c2',
      name: 'Netflix Extra Member 4K Ultra HD (1 Tháng)',
      slug: 'netflix-4k-1m',
      short_description: 'Gói Netflix xem phim 4K HDR nét căng, sub TV/Điện thoại riêng biệt.',
      description: `Tài khoản xem phim chất lượng đỉnh cao nhất:\n- Độ phân giải Ultra HD 4K + âm thanh Spatial Audio.\n- Có PIN khóa profile riêng tư, lưu lịch sử xem phim chuẩn xác.\n- Xem ổn định trên Smart TV, Laptop, Điện thoại, Tablet.\n- Không bị giới hạn hộ gia đình (Household lock).\n- Hỗ trợ đổi mới lập tức nếu gặp sự cố.`,
      image_url: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop&q=80',
      duration_days: 30,
      price_original: 260000,
      price_sale: 89000,
      is_active: true,
      sort_order: 5
    },
    {
      id: 'p6',
      category_id: 'c2',
      name: 'Spotify Premium Chính Chủ (1 Năm)',
      slug: 'spotify-premium-1y',
      short_description: 'Nghe nhạc chất lượng cao Very High, không quảng cáo, chuyển bài không giới hạn.',
      description: `Nâng cấp chính chủ account Spotify cá nhân:\n- Nghe nhạc chuẩn Lossless 320kbps cực hay.\n- Tải nhạc offline nghe khi đi máy bay/xe buýt.\n- Không bị dính quảng cáo xen giữa các bài hát.\n- Giữ nguyên toàn bộ Playlist nhạc yêu thích của bạn.\n- Bảo hành trọn 365 ngày.`,
      image_url: 'https://images.unsplash.com/photo-1614680376593-902f749f7edc?w=600&auto=format&fit=crop&q=80',
      duration_days: 365,
      price_original: 590000,
      price_sale: 289000,
      is_active: true,
      sort_order: 6
    },
    {
      id: 'p7',
      category_id: 'c3',
      name: 'CapCut Pro PC & Mobile (1 Năm)',
      slug: 'capcut-pro-1y',
      short_description: 'Dùng đầy đủ mẫu template Pro, hiệu ứng AI, xóa phông tự động & xuất 4K.',
      description: `Bản quyền phần mềm dựng video ngắn hot nhất cho TikTok/Reels:\n- Mở khóa toàn bộ hiệu ứng transition, filter VIP.\n- Tính năng AI Auto-Caption đọc phụ đề tiếng Việt chính xác 99%.\n- Xóa phông nền, nịnh mặt AI, chỉnh giọng nói đỉnh cao.\n- Xuất video chuẩn 4K 60fps không dính watermark.\n- Dùng chung PC & Smartphone tiện lợi.`,
      image_url: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=600&auto=format&fit=crop&q=80',
      duration_days: 365,
      price_original: 1200000,
      price_sale: 39000,
      is_active: true,
      sort_order: 7
    },
    {
      id: 'p8',
      category_id: 'c3',
      name: 'Canva Pro Chính Chủ (1 Năm)',
      slug: 'canva-pro-1y',
      short_description: 'Mở khóa 100M+ hình ảnh kho mẫu cao cấp, Magic Studio AI & Brand Kit.',
      description: `Nâng cấp tài khoản Canva cá nhân lên Pro:\n- Tự do sử dụng hơn 100 triệu kho ảnh stock, video, icon bản quyền.\n- Công cụ Magic Eraser xóa vật thể thừa, Magic Expand mở rộng ảnh AI.\n- Xóa nền ảnh trong 1 cú click chuột (Background Remover).\n- Tải xuống định dạng PNG trong suốt, SVG chất lượng cao.\n- Bảo hành uy tín 1 năm.`,
      image_url: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600&auto=format&fit=crop&q=80',
      duration_days: 365,
      price_original: 1290000,
      price_sale: 240000,
      is_active: true,
      sort_order: 8
    },
    {
      id: 'p9',
      category_id: 'c4',
      name: 'Google One 2TB (Gia Đình / 1 Năm)',
      slug: 'google-one-2tb-1y',
      short_description: 'Bộ nhớ khủng 2000GB cho Google Photos, Drive, Gmail & Gemini Advanced.',
      description: `Dung lượng lưu trữ thoải mái cho cá nhân & gia đình:\n- 2,000GB dung lượng lưu trữ an toàn trên đám mây Google.\n- Tự động sao lưu ảnh/video 4K từ điện thoại Android/iPhone.\n- Tích hợp các tính năng chỉnh sửa ảnh cao cấp Google Photos (Magic Eraser, Portrait Light).\n- Chia sẻ dung lượng tối đa cho 5 thành viên gia đình.\n- Nâng cấp chính chủ bảo mật tuyệt đối.`,
      image_url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&auto=format&fit=crop&q=80',
      duration_days: 365,
      price_original: 2250000,
      price_sale: 650000,
      is_active: true,
      sort_order: 9
    }
  ];

  let client = null;
  const config = window.GOAGENTS_CONFIG || {};

  function isSupabaseConfigured() {
    return (
      config.SUPABASE_URL && 
      config.SUPABASE_ANON_KEY && 
      !config.SUPABASE_URL.includes("your-supabase-project") && 
      !config.SUPABASE_ANON_KEY.includes("your-anon-key") &&
      window.supabase && 
      typeof window.supabase.createClient === 'function'
    );
  }

  function getClient() {
    if (!client && isSupabaseConfigured()) {
      client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    }
    return client;
  }

  window.GoagentsData = {
    isLive: false,

    async getCategories() {
      const db = getClient();
      if (db) {
        try {
          const { data, error } = await db
            .from('categories')
            .select('*')
            .order('sort_order', { ascending: true });
          if (!error && data && data.length > 0) {
            this.isLive = true;
            return data;
          }
        } catch (e) {
          console.warn("Supabase fetchCategories failed, using fallback seed data:", e);
        }
      }
      return MOCK_CATEGORIES;
    },

    async getProducts() {
      const db = getClient();
      if (db) {
        try {
          const { data, error } = await db
            .from('products')
            .select('*, categories(name, slug)')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
          if (!error && data && data.length > 0) {
            this.isLive = true;
            return data;
          }
        } catch (e) {
          console.warn("Supabase fetchProducts failed, using fallback seed data:", e);
        }
      }
      return MOCK_PRODUCTS;
    },

    async getProductBySlug(slug) {
      const db = getClient();
      if (db) {
        try {
          const { data, error } = await db
            .from('products')
            .select('*, categories(name, slug)')
            .eq('slug', slug)
            .single();
          if (!error && data) {
            return data;
          }
        } catch (e) {
          console.warn("Supabase getProductBySlug failed, checking fallback:", e);
        }
      }
      return MOCK_PRODUCTS.find(p => p.slug === slug) || null;
    },

    async createOrder(orderPayload) {
      const db = getClient();
      let recordId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
      
      if (db) {
        try {
          const { data, error } = await db
            .from('orders')
            .insert([orderPayload])
            .select();
          if (!error && data && data.length > 0) {
            return { success: true, orderId: data[0].id, live: true };
          } else if (error) {
            console.error("Supabase insert order error:", error);
          }
        } catch (e) {
          console.error("Supabase createOrder exception:", e);
        }
      }

      // Store in local storage for fallback testing
      try {
        const localOrders = JSON.parse(localStorage.getItem('goagents_orders') || '[]');
        orderPayload.id = recordId;
        orderPayload.created_at = new Date().toISOString();
        localOrders.push(orderPayload);
        localStorage.setItem('goagents_orders', JSON.stringify(localOrders));
      } catch (e) {
        console.warn("LocalStorage save order fallback warning:", e);
      }

      return { success: true, orderId: recordId, live: false };
    }
  };
})();
