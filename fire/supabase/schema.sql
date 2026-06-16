-- Supabase PostgreSQL Schema for Antigravity FIRE OS

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- 1. PROFILES
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  full_name text,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  target_fire_number numeric(15,2) default 0,
  target_fire_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. PORTFOLIOS
create table public.portfolios (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('crypto', 'stocks', 'cash', 'real_estate', 'custom')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. HOLDINGS
create table public.holdings (
  id uuid default uuid_generate_v4() primary key,
  portfolio_id uuid references public.portfolios(id) on delete cascade not null,
  asset_symbol text not null,
  asset_name text not null,
  amount numeric(20,8) default 0 not null,
  cost_basis numeric(15,2) default 0 not null,
  current_price numeric(15,2) default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. TRANSACTIONS
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  holding_id uuid references public.holdings(id) on delete cascade not null,
  type text not null check (type in ('buy', 'sell', 'deposit', 'withdrawal')),
  amount numeric(20,8) not null,
  price_per_unit numeric(15,2) not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. ROADMAP NODES
create table public.roadmap_nodes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  target_amount numeric(15,2) not null,
  is_completed boolean default false,
  order_index integer not null,
  estimated_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. GOALS
create table public.goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  target_amount numeric(15,2) not null,
  current_amount numeric(15,2) default 0,
  deadline date,
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. MISSIONS & ACHIEVEMENTS
create table public.missions (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text not null,
  reward_points integer default 0,
  condition_type text not null,
  condition_value numeric(15,2) not null
);

create table public.user_achievements (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  mission_id uuid references public.missions(id) on delete cascade not null,
  unlocked_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, mission_id)
);

-- 8. JOURNAL ENTRIES
create table public.journal_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  asset_symbol text,
  entry_price numeric(15,2),
  reason text not null,
  strategy text,
  outcome text,
  lessons_learned text,
  tags text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. SUBSCRIPTIONS
create table public.subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  plan_type text not null default 'free',
  status text not null default 'active',
  current_period_end timestamp with time zone,
  stripe_customer_id text,
  stripe_subscription_id text
);

-- RLS Policies
-- Enable Row Level Security on all tables
alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.holdings enable row level security;
alter table public.transactions enable row level security;
alter table public.roadmap_nodes enable row level security;
alter table public.goals enable row level security;
alter table public.journal_entries enable row level security;
alter table public.user_achievements enable row level security;
alter table public.subscriptions enable row level security;

-- Create generic policies for users to only see/edit their own data
-- Profiles
create policy "Users can view their own profile." on public.profiles for select using (auth.uid() = id);
create policy "Users can update their own profile." on public.profiles for update using (auth.uid() = id);

-- Portfolios
create policy "Users can CRUD their own portfolios." on public.portfolios for all using (auth.uid() = user_id);

-- Roadmap Nodes
create policy "Users can CRUD their own roadmap nodes." on public.roadmap_nodes for all using (auth.uid() = user_id);

-- Goals
create policy "Users can CRUD their own goals." on public.goals for all using (auth.uid() = user_id);

-- Journal
create policy "Users can CRUD their own journal entries." on public.journal_entries for all using (auth.uid() = user_id);

-- Create a function to handle new user signups
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
