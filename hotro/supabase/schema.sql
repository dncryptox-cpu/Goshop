-- Hỗ trợ khách (godnc.com/hotro) + Ticketbox (godnc.com/ticketbox)
-- Dùng chung project Supabase với Trading OS (đăng nhập admin = tài khoản Dnc, hàm public.is_admin()).
-- Chạy 1 lần trong SQL Editor. Chạy lại vẫn an toàn.

create table if not exists public.support_tickets (
  id           uuid primary key default gen_random_uuid(),
  token        text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), -- khoá riêng của khách để đọc lại đoạn chat
  email        text not null,
  status       text not null default 'bot' check (status in ('bot', 'cho_nguoi', 'dong')),
  ly_do        text not null default '',        -- vì sao bot chuyển người
  ctv          text not null default '',
  last_text    text not null default '',
  admin_unread boolean not null default false,
  deleted      boolean not null default false,  -- xoá mềm, hoàn tác được
  msg_count    int not null default 0,
  notified_at  timestamptz,
  kh           jsonb,                           -- kết quả tra cứu gần nhất
  kh_at        timestamptz,
  verified     text,                            -- ok | not_found
  busy_at      timestamptz,                     -- bot đang xử lý tin                     -- lần cuối báo Telegram (chống báo dồn)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists support_tickets_upd on public.support_tickets (updated_at desc);
create index if not exists support_tickets_email on public.support_tickets (email);

create table if not exists public.support_messages (
  id         bigint generated always as identity primary key,
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  role       text not null check (role in ('khach', 'bot', 'admin', 'he_thong')),
  body       text not null,
  image      text,                 -- đường dẫn ảnh trong bucket "support"
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket on public.support_messages (ticket_id, id);

-- Mỗi tin mới: cập nhật ticket (tin cuối, đếm, chưa đọc)
create or replace function public.support_msg_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.support_tickets set
    last_text    = left(case when coalesce(new.body, '') = '' and new.image is not null then '[Ảnh]' else new.body end, 200),
    msg_count    = msg_count + 1,
    updated_at   = now(),
    admin_unread = case when new.role = 'admin' then false when new.role = 'khach' then true else admin_unread end
  where id = new.ticket_id;
  return new;
end $$;
drop trigger if exists support_msg_touch on public.support_messages;
create trigger support_msg_touch after insert on public.support_messages for each row execute function public.support_msg_touch();

-- Khách không đọc/ghi thẳng: mọi thứ đi qua Edge Function "support-bot" (service role).
-- Admin (is_admin) toàn quyền, để trang Ticketbox đọc realtime và trả lời.
alter table public.support_tickets  enable row level security;
alter table public.support_messages enable row level security;
grant select, insert, update on public.support_tickets  to authenticated;
grant select, insert         on public.support_messages to authenticated;
drop policy if exists "support tickets admin"  on public.support_tickets;
drop policy if exists "support messages admin" on public.support_messages;
create policy "support tickets admin"  on public.support_tickets  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "support messages admin" on public.support_messages for all to authenticated using (public.is_admin()) with check (public.is_admin() and role = 'admin');

-- Realtime cho Ticketbox
do $$ begin
  begin alter publication supabase_realtime add table public.support_tickets;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.support_messages; exception when duplicate_object then null; end;
end $$;

-- Kiến thức của bot: admin sửa trong Ticketbox, Edge Function đọc bằng service role (khách không đọc được)
insert into public.site_settings (key, value) values ('support_kb', jsonb_build_object('text', $kb$
SHOP
- Bán YouTube Premium dạng nhóm gia đình Google (khách được mời vào nhóm bằng email riêng của khách), Netflix dùng chung hộ gia đình, ChatGPT tài khoản dùng chung.
- Liên hệ shop: Zalo 0398057191.
- Trang tự xử lý YouTube của khách (có hướng dẫn từng bước, mượn tài khoản tạm, đổi sang email khác): https://godnc.com/fixytb/?email=EMAIL_CUA_KHACH (tra_cuu trả sẵn link_huong_dan).

CÁCH NHÓM YOUTUBE HOẠT ĐỘNG (để giải thích khi khách hỏi)
- Mỗi nhóm (fam) có 1 chủ nhóm và tối đa 5 thành viên. Nhóm chạy theo tháng; khi nhóm lỗi hoặc đến hạn, shop thay nhóm mới và mời khách còn hạn vào lại.
- Khách hết hạn thì không được mời vào nhóm mới cho tới khi gia hạn.
- Google khoá đổi nhóm 12 tháng nếu khách rời một nhóm vẫn đang hoạt động. Vì vậy CHỈ rời nhóm cũ khi trang Gia đình báo "không hoạt động".
- Trang Gia đình của Google: https://myaccount.google.com/family/details

XỬ LÝ THEO trang_thai (sau khi tra_cuu)
- binh_thuong: nhóm đang chạy, không có sự cố. Nếu khách vẫn mất Premium: nhờ khách mở trang Gia đình rồi chọn
  [[Nhóm vẫn hiện bình thường|Báo không hoạt động]]
  → gọi bao_loi (nhom_hoat_dong = true nếu "vẫn hiện bình thường", false nếu "không hoạt động").
  Khách gửi ảnh trang Gia đình thì tự đọc ảnh, không cần hỏi lại.
- dang_kiem_tra: đã nhận báo lỗi, nhóm vẫn hiện bình thường. Kỹ thuật đang kiểm tra, thường 15–60 phút. Dặn rõ: ĐỪNG rời nhóm.
- dang_xu_ly: nhóm đang được thay mới (đến hạn hoặc đã báo lỗi). Khách chưa cần làm gì; khi có lời mời, khung chat này và trang hướng dẫn sẽ báo. Nếu khách cần dùng ngay: gửi link_huong_dan, mục "Mượn tài khoản tạm".
- da_moi: khách đã được mời vào nhóm mới. Hướng dẫn 3 bước:
  1. Mở trang Gia đình. Nhóm cũ báo "không hoạt động" thì bấm Rời khỏi nhóm gia đình (nhóm cũ vẫn bình thường thì KHÔNG rời).
  2. Đợi 30 giây, mở lại trang Gia đình hoặc Gmail, bấm Tham gia ở lời mời.
  3. Mở YouTube, bấm ảnh đại diện, thấy chữ Premium là xong.
  Kèm link_huong_dan (có hình minh hoạ). Cuối tin cho chọn:
  [[Đã dùng được Premium|Không thấy lời mời|Bấm tham gia bị lỗi|Nhóm cũ vẫn hoạt động]]
  → "Đã dùng được Premium": gọi xac_nhan_da_vao. 3 lựa chọn còn lại: gọi yeu_cau_moi_lai với đúng lý do đó. Trước khi gọi với "Không thấy lời mời", nhắc khách xem cả mục Quảng cáo/Spam trong Gmail.
- cho_moi_lai: đang gửi lại lời mời, thường 15–30 phút. Khách không cần báo lại.
- het_han: nhóm đã thay mới nhưng gói của khách hết hạn (han_su_dung) nên chưa được mời. Gia hạn xong sẽ được mời. Làm theo mục GIA HẠN.
- da_vao_nhom: khách đã vào nhóm mới, mọi thứ ổn.
- can_nguoi: nhóm đang lỗi mà chưa có nhóm mới. Nói thật, dặn chưa rời nhóm cũ, hệ thống đã tự chuyển người phụ trách.
- tim_thay = false: email chưa có trong hệ thống. Hỏi khách có dùng email khác để mua không; có thì bấm nút làm mới (góc trên) để chat bằng email đó. Nếu khách chắc chắn đúng email → chuyen_nguoi.

ĐỔI SANG EMAIL KHÁC
- Khách muốn dùng email khác (email cũ bị lỗi, bị khoá đổi nhóm 12 tháng…): gửi link_huong_dan, mục "Đổi sang email khác". Hạn sử dụng giữ nguyên.

GIA HẠN YOUTUBE PREMIUM
- Tra cứu trước để biết han_su_dung và ctv.
- Nếu ctv có và khác "Dnc": khách mua qua cộng tác viên đó, nhờ khách nhắn người đã bán cho mình để gia hạn (giá có thể khác).
- Còn lại báo giá của shop:
  1 tháng 30k · 3 tháng 80k · 6 tháng 150k · 12 tháng 280k
  rồi hỏi khách chọn gói: [[1 tháng|3 tháng|6 tháng|12 tháng]]
  Khách chọn xong → chuyen_nguoi (ghi rõ gói khách chọn) để người phụ trách gửi thông tin chuyển khoản. Hạn mới cộng nối tiếp hạn cũ.

NETFLIX
- Báo "xác minh hộ gia đình", "truy cập tạm thời" hoặc cần mã đăng nhập: vào https://godnc.com/vnetflix để tự lấy mã.
- Lỗi khác, gia hạn, giá Netflix → chuyen_nguoi.

CHATGPT
- Đăng nhập bị hỏi mã 2FA: vào https://godnc.com/vgpt lấy mã 6 số (mã đổi mỗi 30 giây, nhập ngay).
- Lỗi khác, gia hạn, giá ChatGPT → chuyen_nguoi.

MENU KHI KHÁCH CHƯA NÓI RÕ
[[Mất YouTube Premium|Không vào được nhóm mới|Gia hạn / hỏi giá|Netflix hoặc ChatGPT]]
$kb$))
on conflict (key) do nothing;
-- Bucket riêng tư: khách đi qua Edge Function (service role), admin đọc/ghi trực tiếp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support', 'support', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "support images admin read"  on storage.objects;
drop policy if exists "support images admin write" on storage.objects;
create policy "support images admin read"  on storage.objects for select to authenticated using (bucket_id = 'support' and public.is_admin());
create policy "support images admin write" on storage.objects for insert to authenticated with check (bucket_id = 'support' and public.is_admin());
