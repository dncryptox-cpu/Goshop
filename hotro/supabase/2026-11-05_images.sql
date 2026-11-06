-- Gửi ảnh trong chat (khách + admin). Chạy 1 lần, chạy lại vẫn an toàn.
alter table public.support_messages add column if not exists image text;  -- đường dẫn trong bucket "support"

-- Tin chỉ có ảnh: hiện "[Ảnh]" ở danh sách Ticketbox
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

-- Bucket riêng tư: khách đi qua Edge Function (service role), admin đọc/ghi trực tiếp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support', 'support', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "support images admin read"  on storage.objects;
drop policy if exists "support images admin write" on storage.objects;
create policy "support images admin read"  on storage.objects for select to authenticated using (bucket_id = 'support' and public.is_admin());
create policy "support images admin write" on storage.objects for insert to authenticated with check (bucket_id = 'support' and public.is_admin());
