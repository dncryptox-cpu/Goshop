-- Create a table for public profiles
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text not null,
  display_name text,
  plan text default 'unassigned',
  created_at timestamp with time zone default now()
);

-- Set up Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Policy 1: Users can read their own profile
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

-- Policy 2: Users can update their own profile
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Policy 3: Admin (dncryptox@gmail.com) can read/update all profiles
create policy "Admin has full access" on profiles
  for all using (
    auth.jwt() ->> 'email' = 'dncryptox@gmail.com'
  );

-- This trigger automatically creates a profile entry when a new user signs up via Supabase Auth.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'display_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
