-- ========================================================
-- GOAGENTS SUPABASE DATABASE SCHEMA (PHASE 1 MVP)
-- ========================================================

-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. Danh mục sản phẩm
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Sản phẩm
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  image_url text,
  duration_days int, -- 30, 90, 180, 365
  price_original numeric(12,0) not null,
  price_sale numeric(12,0) not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 3. Đơn hàng
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id),
  customer_name text not null,
  contact_channel text not null default 'zalo',   -- 'zalo' | 'phone' | 'facebook'
  contact_value text not null,
  quantity int not null default 1,
  unit_price numeric(12,0) not null,
  total_price numeric(12,0) not null,
  note text,
  status text not null default 'pending', -- pending | contacted | paid | fulfilled | cancelled
  created_at timestamptz not null default now()
);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================

alter table categories enable row level security;
alter table products enable row level security;
alter table orders enable row level security;

-- Clean existing policies if re-running
drop policy if exists "public read categories" on categories;
drop policy if exists "public read active products" on products;
drop policy if exists "public insert orders" on orders;

-- Public read access for categories
create policy "public read categories" on categories 
  for select using (true);

-- Public read access for active products
create policy "public read active products" on products 
  for select using (is_active = true);

-- Public insert access for orders (anyone can place an order)
create policy "public insert orders" on orders 
  for insert with check (true);

-- ========================================================
-- SEED DATA (DỮ LIỆU MẪU SẢN PHẨM PHỔ BIẾN)
-- ========================================================

-- Seed Categories
insert into categories (id, name, slug, sort_order) values
  ('c1000000-0000-0000-0000-000000000001', 'Công cụ AI', 'ai-tools', 1),
  ('c1000000-0000-0000-0000-000000000002', 'Giải trí & Streaming', 'streaming', 2),
  ('c1000000-0000-0000-0000-000000000003', 'Đồ họa & Thiết kế', 'design-editing', 3),
  ('c1000000-0000-0000-0000-000000000004', 'Lưu trữ & Làm việc', 'productivity', 4)
on conflict (slug) do update set 
  name = excluded.name, 
  sort_order = excluded.sort_order;

-- Seed Products
insert into products (id, category_id, name, slug, short_description, description, image_url, duration_days, price_original, price_sale, is_active, sort_order) values
  (
    'p1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'ChatGPT Plus Official (1 Tháng)',
    'chatgpt-plus-1m',
    'Tài khoản ChatGPT Plus chính chủ GPT-4o, DALL-E 3, Sora access, tốc độ xử lý ưu tiên.',
    'Sử dụng đầy đủ tính năng mạnh mẽ nhất của OpenAI:\n- Truy cập mô hình GPT-4o, GPT-4 Turbo không giới hạn tốc độ.\n- Phân tích dữ liệu nâng cao (Advanced Data Analysis), đọc file PDF/Excel.\n- Tạo ảnh nghệ thuật với DALL-E 3 cực sắc nét.\n- Truy cập GPTs Custom Store & tạo bot riêng.\n- Bảo hành 1 đổi 1 trong suốt 30 ngày sử dụng.',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&auto=format&fit=crop&q=80',
    30,
    490000,
    199000,
    true,
    1
  ),
  (
    'p1000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000001',
    'Claude Pro 3.5 Sonnet (1 Tháng)',
    'claude-pro-1m',
    'AI lập trình & viết lách đỉnh nhất hiện nay với Claude 3.5 Sonnet & Artifacts.',
    'Bản nâng cấp Claude Pro từ Anthropic:\n- Context window khủng 200K tokens (đọc tài liệu hàng trăm trang).\n- Khả năng coding & xử lý logic vượt trội so với các AI khác.\n- Hỗ trợ tính năng Artifacts xem code / UI trực quan ngay lập tức.\n- Ưu tiên băng thông giờ cao điểm.\n- Bảo hành 100% full 30 ngày.',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    30,
    550000,
    220000,
    true,
    2
  ),
  (
    'p1000000-0000-0000-0000-000000000003',
    'c1000000-0000-0000-0000-000000000001',
    'Cursor Pro Code Editor (1 Tháng)',
    'cursor-pro-1m',
    'Trình soạn thảo code AI đỉnh cao cho Lập trình viên, autocomplete siêu tốc.',
    'Cursor Pro - công cụ không thể thiếu cho Developer chuyên nghiệp:\n- Sử dụng không giới hạn GPT-4o, Claude 3.5 Sonnet trong IDE.\n- Tính năng Agent tự động refactor & fix bug trong toàn bộ codebase.\n- Autocomplete thông minh gợi ý nhiều dòng code theo ngữ cảnh.\n- Tích hợp Git, Terminal & Extension VS Code sẵn có.\n- Bảo hành uy tín 1:1 suốt thời hạn.',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
    30,
    590000,
    250000,
    true,
    3
  ),
  (
    'p1000000-0000-0000-0000-000000000004',
    'c1000000-0000-0000-0000-000000000002',
    'YouTube Premium Chính Chủ (1 Năm)',
    'youtube-premium-1y',
    'Xem video không quảng cáo, nghe nhạc background YouTube Music HD.',
    'Nâng cấp chính chủ email cá nhân của bạn:\n- Xem video mượt mà không bị làm phiền bởi quảng cáo.\n- Tải video ngoại tuyến về điện thoại/máy tính bảng.\n- Phát nhạc chạy nền khi tắt màn hình.\n- Miễn phí YouTube Music Premium kho nhạc số lớn nhất thế giới.\n- Nâng cấp trực tiếp trên Email cá nhân, bảo hành trọn vẹn 12 tháng.',
    'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=600&auto=format&fit=crop&q=80',
    365,
    890000,
    349000,
    true,
    4
  ),
  (
    'p1000000-0000-0000-0000-000000000005',
    'c1000000-0000-0000-0000-000000000002',
    'Netflix Extra Member 4K Ultra HD (1 Tháng)',
    'netflix-4k-1m',
    'Gói Netflix xem phim 4K HDR nét căng, sub TV/Điện thoại riêng biệt.',
    'Tài khoản xem phim chất lượng đỉnh cao nhất:\n- Độ phân giải Ultra HD 4K + âm thanh Spatial Audio.\n- Có PIN khóa profile riêng tư, lưu lịch sử xem phim chuẩn xác.\n- Xem ổn định trên Smart TV, Laptop, Điện thoại, Tablet.\n- Không bị giới hạn hộ gia đình (Household lock).\n- Hỗ trợ đổi mới lập tức nếu gặp sự cố.',
    'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop&q=80',
    30,
    220000,
    89000,
    true,
    5
  ),
  (
    'p1000000-0000-0000-0000-000000000006',
    'c1000000-0000-0000-0000-000000000002',
    'Spotify Premium Chính Chủ (1 Năm)',
    'spotify-premium-1y',
    'Nghe nhạc chất lượng cao Very High, không quảng cáo, chuyển bài không giới hạn.',
    'Nâng cấp chính chủ account Spotify cá nhân:\n- Nghe nhạc chuẩn Lossless 320kbps cực hay.\n- Tải nhạc offline nghe khi đi máy bay/xe buýt.\n- Không bị dính quảng cáo xen giữa các bài hát.\n- Giữ nguyên toàn bộ Playlist nhạc yêu thích của bạn.\n- Bảo hành trọn 365 ngày.',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    365,
    590000,
    239000,
    true,
    6
  ),
  (
    'p1000000-0000-0000-0000-000000000007',
    'c1000000-0000-0000-0000-000000000003',
    'CapCut Pro PC & Mobile (1 Năm)',
    'capcut-pro-1y',
    'Dùng đầy đủ mẫu template Pro, hiệu ứng AI, xóa phông tự động & xuất 4K.',
    'Bản quyền phần mềm dựng video ngắn hot nhất cho TikTok/Reels:\n- Mở khóa toàn bộ hiệu ứng transition, filter VIP.\n- Tính năng AI Auto-Caption đọc phụ đề tiếng Việt chính xác 99%.\n- Xóa phông nền, nịnh mặt AI, chỉnh giọng nói đỉnh cao.\n- Xuất video chuẩn 4K 60fps không dính watermark.\n- Dùng chung PC & Smartphone tiện lợi.',
    'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&auto=format&fit=crop&q=80',
    365,
    990000,
    390000,
    true,
    7
  ),
  (
    'p1000000-0000-0000-0000-000000000008',
    'c1000000-0000-0000-0000-000000000003',
    'Canva Pro Chính Chủ (1 Năm)',
    'canva-pro-1y',
    'Mở khóa 100M+ hình ảnh kho mẫu cao cấp, Magic Studio AI & Brand Kit.',
    'Nâng cấp tài khoản Canva cá nhân lên Pro:\n- Tự do sử dụng hơn 100 triệu kho ảnh stock, video, icon bản quyền.\n- Công cụ Magic Eraser xóa vật thể thừa, Magic Expand mở rộng ảnh AI.\n- Xóa nền ảnh trong 1 cú click chuột (Background Remover).\n- Tải xuống định dạng PNG trong suốt, SVG chất lượng cao.\n- Bảo hành uy tín 1 năm.',
    'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600&auto=format&fit=crop&q=80',
    365,
    650000,
    240000,
    true,
    8
  ),
  (
    'p1000000-0000-0000-0000-000000000009',
    'c1000000-0000-0000-0000-000000000004',
    'Google One 2TB (Gia Đình / 1 Năm)',
    'google-one-2tb-1y',
    'Bộ nhớ khủng 2000GB cho Google Photos, Drive, Gmail & Gemini Advanced.',
    'Dung lượng lưu trữ thoải mái cho cá nhân & gia đình:\n- 2,000GB dung lượng lưu trữ an toàn trên đám mây Google.\n- Tự động sao lưu ảnh/video 4K từ điện thoại Android/iPhone.\n- Tích hợp các tính năng chỉnh sửa ảnh cao cấp Google Photos (Magic Eraser, Portrait Light).\n- Chia sẻ dung lượng tối đa cho 5 thành viên gia đình.\n- Nâng cấp chính chủ bảo mật tuyệt đối.',
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&auto=format&fit=crop&q=80',
    365,
    1650000,
    650000,
    true,
    9
  )
on conflict (slug) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  short_description = excluded.short_description,
  description = excluded.description,
  image_url = excluded.image_url,
  duration_days = excluded.duration_days,
  price_original = excluded.price_original,
  price_sale = excluded.price_sale,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
