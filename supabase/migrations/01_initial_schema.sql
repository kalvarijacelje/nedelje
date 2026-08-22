-- ==============================================================================
-- KCK Organizacija Nedelje - Supabase PostgreSQL Schema & RLS Setup
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES / PEOPLE TABLE (Shared Church Directory & Volunteers)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'Viewer', -- 'Admin' | 'Leader' | 'Volunteer' | 'Viewer'
    preferred_ministries TEXT[] DEFAULT '{}',
    family_members TEXT[] DEFAULT '{}',
    is_exempt_from_burnout BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. NEDELJE MINISTRIES TABLE (Service Metadata & Categories)
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
    date TEXT NOT NULL, -- e.g. "30. 8. 26" or "6. 9. 26"
    service_date TEXT,
    title TEXT DEFAULT 'Nedeljsko bogoslužje',
    theme_sl TEXT DEFAULT '',
    theme_en TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'ready' | 'completed'
    guest TEXT DEFAULT '',
    absent_or_notes TEXT DEFAULT '',
    special_focus JSONB DEFAULT '{"type": "none"}'::jsonb,
    worship_setlist JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. NEDELJE ASSIGNMENTS TABLE (Relational Assignments & Confirmation Tokens)
CREATE TABLE IF NOT EXISTS public.nedelje_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sunday_id TEXT NOT NULL REFERENCES public.nedelje_services(id) ON DELETE CASCADE,
    ministry_id TEXT NOT NULL,
    person_name TEXT NOT NULL,
    person_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'declined' | 'tentative'
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

-- 5. NEDELJE BLACKOUT DATES / VACATION PLANNER TABLE
CREATE TABLE IF NOT EXISTS public.nedelje_blackout_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_name TEXT NOT NULL,
    person_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nedelje_blackouts_person ON public.nedelje_blackout_dates(person_name);

-- 6. NEDELJE SHIFT SWAPS TABLE
CREATE TABLE IF NOT EXISTS public.nedelje_shift_swaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sunday_id TEXT REFERENCES public.nedelje_services(id) ON DELETE CASCADE,
    sunday_date TEXT NOT NULL,
    ministry_id TEXT NOT NULL,
    ministry_name TEXT NOT NULL,
    requester_name TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'accepted' | 'cancelled'
    accepted_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. NEDELJE WORSHIP ROSTER & SCHEDULES TABLE
CREATE TABLE IF NOT EXISTS public.nedelje_worship_schedules (
    id TEXT PRIMARY KEY,
    sunday_id TEXT REFERENCES public.nedelje_services(id) ON DELETE CASCADE,
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

-- 9. NEDELJE SUNDAY SCHOOL SUPPLIES TABLE
CREATE TABLE IF NOT EXISTS public.nedelje_school_supplies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quantity TEXT,
    requested_by TEXT,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. NEDELJE VISITOR CONNECTIONS TABLE
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

-- 11. NEDELJE FACILITY INSPECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.nedelje_facility_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sunday_id TEXT REFERENCES public.nedelje_services(id) ON DELETE SET NULL,
    sunday_date TEXT NOT NULL,
    category TEXT NOT NULL,
    inspector_name TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    is_completed BOOLEAN DEFAULT true,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_blackout_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_shift_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_worship_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_school_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_school_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nedelje_facility_inspections ENABLE ROW LEVEL SECURITY;

-- 1. Read access for all users (public / authenticated)
CREATE POLICY "Public read access for profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public read access for nedelje_ministries" ON public.nedelje_ministries FOR SELECT USING (true);
CREATE POLICY "Public read access for nedelje_services" ON public.nedelje_services FOR SELECT USING (true);
CREATE POLICY "Public read access for nedelje_assignments" ON public.nedelje_assignments FOR SELECT USING (true);
CREATE POLICY "Public read access for nedelje_blackout_dates" ON public.nedelje_blackout_dates FOR SELECT USING (true);
CREATE POLICY "Public read access for nedelje_shift_swaps" ON public.nedelje_shift_swaps FOR SELECT USING (true);
CREATE POLICY "Public read access for nedelje_worship_schedules" ON public.nedelje_worship_schedules FOR SELECT USING (true);
CREATE POLICY "Public read access for nedelje_school_lessons" ON public.nedelje_school_lessons FOR SELECT USING (true);
CREATE POLICY "Public read access for nedelje_school_supplies" ON public.nedelje_school_supplies FOR SELECT USING (true);
CREATE POLICY "Public read access for nedelje_visitors" ON public.nedelje_visitors FOR SELECT USING (true);
CREATE POLICY "Public read access for nedelje_facility_inspections" ON public.nedelje_facility_inspections FOR SELECT USING (true);

-- 2. Write / Mutation access for authenticated users & leaders
CREATE POLICY "Authenticated users full access profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access nedelje_ministries" ON public.nedelje_ministries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access nedelje_services" ON public.nedelje_services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access nedelje_assignments" ON public.nedelje_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access nedelje_blackout_dates" ON public.nedelje_blackout_dates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access nedelje_shift_swaps" ON public.nedelje_shift_swaps FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access nedelje_worship_schedules" ON public.nedelje_worship_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access nedelje_school_lessons" ON public.nedelje_school_lessons FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access nedelje_school_supplies" ON public.nedelje_school_supplies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access nedelje_visitors" ON public.nedelje_visitors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access nedelje_facility_inspections" ON public.nedelje_facility_inspections FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Public token confirmation updates for /potrdi landing page
CREATE POLICY "Public token updates on nedelje_assignments" ON public.nedelje_assignments
    FOR UPDATE
    USING (confirmation_token IS NOT NULL)
    WITH CHECK (confirmation_token IS NOT NULL);

-- ==============================================================================
-- REALTIME ENABLEMENT
-- ==============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nedelje_services;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nedelje_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nedelje_blackout_dates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nedelje_shift_swaps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nedelje_worship_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nedelje_school_lessons;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nedelje_visitors;
