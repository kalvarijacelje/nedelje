-- ==============================================================================
-- 02_create_missing_tables.sql
-- Consolidated Schema & Permissive RLS for KCK Nedelje
-- ==============================================================================

-- Enable UUID & PGCrypto extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES / PEOPLE TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    auth_user_id UUID,
    full_name TEXT,
    name TEXT NOT NULL DEFAULT '',
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'Viewer',
    preferred_ministries TEXT[] DEFAULT '{}',
    led_ministries TEXT[] DEFAULT '{}',
    family_members TEXT[] DEFAULT '{}',
    is_exempt_from_burnout BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure avatar_url, name, led_ministries exist if table was previously created without it
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'name') THEN
    ALTER TABLE public.profiles ADD COLUMN name TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'led_ministries') THEN
    ALTER TABLE public.profiles ADD COLUMN led_ministries TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- 2. NEDELJE MINISTRIES TABLE
CREATE TABLE IF NOT EXISTS public.nedelje_ministries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'Sparkles',
    color TEXT NOT NULL DEFAULT 'indigo',
    active BOOLEAN DEFAULT true,
    required_count INTEGER NOT NULL DEFAULT 1,
    default_leader TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. NEDELJE SERVICES / SUNDAYS TABLE
CREATE TABLE IF NOT EXISTS public.nedelje_services (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    service_date TEXT,
    title TEXT DEFAULT 'Nedeljsko bogoslužje',
    theme_sl TEXT DEFAULT '',
    theme_en TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    guest TEXT DEFAULT '',
    absent_or_notes TEXT DEFAULT '',
    special_focus JSONB DEFAULT '{"type": "none"}'::jsonb,
    worship_setlist JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. NEDELJE ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS public.nedelje_assignments (
    id TEXT PRIMARY KEY,
    sunday_id TEXT NOT NULL,
    ministry_id TEXT NOT NULL,
    person_name TEXT NOT NULL,
    person_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    decline_reason TEXT,
    notes TEXT,
    confirmation_token TEXT,
    assigned_by_id TEXT,
    assigned_by_name TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    response_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nedelje_assignments_sunday ON public.nedelje_assignments(sunday_id);
CREATE INDEX IF NOT EXISTS idx_nedelje_assignments_token ON public.nedelje_assignments(confirmation_token);
CREATE INDEX IF NOT EXISTS idx_nedelje_assignments_person ON public.nedelje_assignments(person_name);

-- 5. NEDELJE BLACKOUT DATES TABLE
CREATE TABLE IF NOT EXISTS public.nedelje_blackout_dates (
    id TEXT PRIMARY KEY,
    person_name TEXT NOT NULL,
    person_id TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nedelje_blackouts_person ON public.nedelje_blackout_dates(person_name);

-- 6. NEDELJE SHIFT SWAPS TABLE
CREATE TABLE IF NOT EXISTS public.nedelje_shift_swaps (
    id TEXT PRIMARY KEY,
    sunday_id TEXT,
    sunday_date TEXT NOT NULL,
    ministry_id TEXT NOT NULL,
    ministry_name TEXT NOT NULL,
    requester_name TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    accepted_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. NEDELJE WORSHIP ROSTER TABLE
CREATE TABLE IF NOT EXISTS public.nedelje_worship_schedules (
    id TEXT PRIMARY KEY,
    sunday_id TEXT,
    date TEXT NOT NULL,
    worship_leader TEXT,
    leader TEXT,
    acoustic TEXT,
    drums TEXT,
    bass TEXT,
    keys TEXT,
    vocals TEXT,
    sound TEXT,
    slides TEXT,
    vocal_tech_absent TEXT,
    monitors TEXT,
    sunday_school TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. NEDELJE SUNDAY SCHOOL LESSONS TABLE
CREATE TABLE IF NOT EXISTS public.nedelje_school_lessons (
    id TEXT PRIMARY KEY,
    sunday_id TEXT,
    sunday_date TEXT,
    group_name TEXT,
    topic_sl TEXT DEFAULT '',
    bible_story_sl TEXT DEFAULT '',
    memory_verse_sl TEXT DEFAULT '',
    craft_and_games_sl TEXT DEFAULT '',
    materials_needed TEXT[] DEFAULT '{}',
    google_doc_url TEXT,
    teachers TEXT[] DEFAULT '{}',
    helpers TEXT[] DEFAULT '{}',
    notes TEXT,
    status TEXT DEFAULT 'planned',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. NEDELJE VISITOR CONNECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.nedelje_visitors (
    id TEXT PRIMARY KEY,
    sunday_id TEXT,
    sunday_date TEXT,
    visitor_name TEXT NOT NULL,
    contact_info TEXT,
    invited_by TEXT,
    notes TEXT,
    interests TEXT[] DEFAULT '{}',
    assigned_follow_up_person TEXT,
    follow_up_status TEXT DEFAULT 'new',
    coffee_shop_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES (PERMISSIVE ACCESS)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_blackout_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_shift_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_worship_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_school_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_visitors ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies if present
DROP POLICY IF EXISTS "Public full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public full access nedelje_ministries" ON public.nedelje_ministries;
DROP POLICY IF EXISTS "Public full access nedelje_services" ON public.nedelje_services;
DROP POLICY IF EXISTS "Public full access nedelje_assignments" ON public.nedelje_assignments;
DROP POLICY IF EXISTS "Public full access nedelje_blackout_dates" ON public.nedelje_blackout_dates;
DROP POLICY IF EXISTS "Public full access nedelje_shift_swaps" ON public.nedelje_shift_swaps;
DROP POLICY IF EXISTS "Public full access nedelje_worship_schedules" ON public.nedelje_worship_schedules;
DROP POLICY IF EXISTS "Public full access nedelje_school_lessons" ON public.nedelje_school_lessons;
DROP POLICY IF EXISTS "Public full access nedelje_visitors" ON public.nedelje_visitors;

-- Create fully permissive policies for read and write across all tables
CREATE POLICY "Public full access profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access nedelje_ministries" ON public.nedelje_ministries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access nedelje_services" ON public.nedelje_services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access nedelje_assignments" ON public.nedelje_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access nedelje_blackout_dates" ON public.nedelje_blackout_dates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access nedelje_shift_swaps" ON public.nedelje_shift_swaps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access nedelje_worship_schedules" ON public.nedelje_worship_schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access nedelje_school_lessons" ON public.nedelje_school_lessons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access nedelje_visitors" ON public.nedelje_visitors FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- REALTIME PUBLICATIONS
-- ==============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nedelje_services;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nedelje_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nedelje_blackout_dates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nedelje_shift_swaps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nedelje_worship_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nedelje_school_lessons;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nedelje_visitors;
