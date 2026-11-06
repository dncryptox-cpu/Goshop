-- ============================================================
-- DNPERP MONITOR — PHASE 18 SUPABASE DATABASE MIGRATION SCRIPT
-- Project URL: https://oennjovursxobufecwkd.supabase.co
-- Execute this script in Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Table: dnperp_config (Cấu hình ví, Telegram & cài đặt chung)
CREATE TABLE IF NOT EXISTS public.dnperp_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    key TEXT UNIQUE,
    value TEXT,
    wallet_address TEXT,
    position_first_seen JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dnperp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon full access on dnperp_config" ON public.dnperp_config;
CREATE POLICY "Allow anon full access on dnperp_config" 
    ON public.dnperp_config FOR ALL 
    TO anon, authenticated 
    USING (true) 
    WITH CHECK (true);


-- 2. Table: dnperp_tracked_pairs (Danh sách các cặp đang theo dõi)
CREATE TABLE IF NOT EXISTS public.dnperp_tracked_pairs (
    id TEXT PRIMARY KEY,
    data JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dnperp_tracked_pairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon full access on dnperp_tracked_pairs" ON public.dnperp_tracked_pairs;
CREATE POLICY "Allow anon full access on dnperp_tracked_pairs" 
    ON public.dnperp_tracked_pairs FOR ALL 
    TO anon, authenticated 
    USING (true) 
    WITH CHECK (true);


-- 3. Table: dnperp_basis_history (Lịch sử dao động Basis% 30 ngày)
CREATE TABLE IF NOT EXISTS public.dnperp_basis_history (
    id TEXT PRIMARY KEY,
    pair_id TEXT,
    timestamp BIGINT,
    basis_pct NUMERIC,
    data JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dnperp_basis_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon full access on dnperp_basis_history" ON public.dnperp_basis_history;
CREATE POLICY "Allow anon full access on dnperp_basis_history" 
    ON public.dnperp_basis_history FOR ALL 
    TO anon, authenticated 
    USING (true) 
    WITH CHECK (true);


-- 4. Table: dnperp_journal_trades (Lịch sử Nhật Ký Giao Dịch)
CREATE TABLE IF NOT EXISTS public.dnperp_journal_trades (
    id TEXT PRIMARY KEY,
    data JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dnperp_journal_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon full access on dnperp_journal_trades" ON public.dnperp_journal_trades;
CREATE POLICY "Allow anon full access on dnperp_journal_trades" 
    ON public.dnperp_journal_trades FOR ALL 
    TO anon, authenticated 
    USING (true) 
    WITH CHECK (true);


-- 5. Table: dnperp_position_snapshot (Mốc snapshot vị thế mở auto-archive)
CREATE TABLE IF NOT EXISTS public.dnperp_position_snapshot (
    id TEXT PRIMARY KEY DEFAULT 'default',
    snapshot_data JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dnperp_position_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon full access on dnperp_position_snapshot" ON public.dnperp_position_snapshot;
CREATE POLICY "Allow anon full access on dnperp_position_snapshot" 
    ON public.dnperp_position_snapshot FOR ALL 
    TO anon, authenticated 
    USING (true) 
    WITH CHECK (true);
