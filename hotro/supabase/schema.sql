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
  notified_at  timestamptz,                     -- lần cuối báo Telegram (chống báo dồn)
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
SẢN PHẨM
- YouTube Premium dạng nhóm gia đình Google (khách được mời vào nhóm, dùng email riêng của khách).
- Netflix dạng hộ gia đình (dùng chung tài khoản).
- ChatGPT tài khoản dùng chung (đăng nhập có mã 2FA).

TỰ LẤY MÃ
- Netflix báo "xác minh hộ gia đình", "truy cập tạm thời" hoặc cần mã đăng nhập: vào https://godnc.com/vnetflix để tự lấy mã.
- ChatGPT hỏi mã 2FA khi đăng nhập: vào https://godnc.com/vgpt để lấy mã 6 số (mã đổi mỗi 30 giây, nhập ngay).

YOUTUBE PREMIUM — MẤT PREMIUM / NHÓM KHÔNG HOẠT ĐỘNG
- Luôn tra email trước, trả lời theo kết quả tra cứu.
- Nếu đã được mời vào nhóm mới: (1) mở https://myaccount.google.com/family/details, nếu nhóm cũ báo "không hoạt động" thì bấm Rời khỏi nhóm gia đình; (2) đợi 30 giây, mở lại trang Gia đình hoặc Gmail, bấm Tham gia ở lời mời; (3) mở YouTube, bấm ảnh đại diện, thấy chữ Premium là xong.
- QUAN TRỌNG: nếu trang Gia đình vẫn hiện người quản lý và các thành viên bình thường thì KHÔNG rời nhóm, vì Google khoá đổi nhóm 12 tháng. Trường hợp này báo lỗi để bên mình kiểm tra.
- Không thấy lời mời: kiểm tra cả mục Quảng cáo/Spam trong Gmail; vẫn không có thì gửi yêu cầu mời lại.
- Đang chờ xử lý: bên mình đã nhận, đang xếp nhóm mới, bạn chưa cần làm gì. Không hứa giờ cụ thể.

GIA HẠN, GIÁ, THANH TOÁN, HOÀN TIỀN
- Bot không báo giá, không nhận chuyển khoản, không hứa hoàn tiền: chuyển cho người phụ trách.
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
