-- ==============================================================================
-- KCK Organizacija Nedelje - Supabase PostgreSQL Schema & RLS Setup
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES / PEOPLE TABLE (Church Volunteers & Members)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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

-- 2. MINISTRIES TABLE (Service Metadata & Categories)
CREATE TABLE IF NOT EXISTS public.ministries (
    id TEXT PRIMARY KEY,
    name_sl TEXT NOT NULL,
    name_en TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other', -- 'service_running' | 'hospitality' | 'word_prayer' | 'av_tech' | 'kids' | 'facilities' | 'other'
    color TEXT NOT NULL DEFAULT 'indigo',
    required_count INTEGER NOT NULL DEFAULT 1,
    default_leader TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SERVICE SUNDAYS TABLE
CREATE TABLE IF NOT EXISTS public.service_sundays (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL, -- e.g. "30. 8. 26" or "6. 9. 26"
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

-- 4. SUNDAY ASSIGNMENTS TABLE (Relational Assignments & Confirmation Tokens)
CREATE TABLE IF NOT EXISTS public.sunday_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sunday_id TEXT NOT NULL REFERENCES public.service_sundays(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_assignments_sunday_id ON public.sunday_assignments(sunday_id);
CREATE INDEX IF NOT EXISTS idx_assignments_token ON public.sunday_assignments(confirmation_token);
CREATE INDEX IF NOT EXISTS idx_assignments_person ON public.sunday_assignments(person_name);

-- 5. BLACKOUT DATES / VACATION PLANNER TABLE
CREATE TABLE IF NOT EXISTS public.blackout_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_name TEXT NOT NULL,
    person_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blackouts_person ON public.blackout_dates(person_name);

-- 6. SHIFT SWAPS TABLE
CREATE TABLE IF NOT EXISTS public.shift_swaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sunday_id TEXT REFERENCES public.service_sundays(id) ON DELETE CASCADE,
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

-- 7. WORSHIP ROSTER & SCHEDULES TABLE
CREATE TABLE IF NOT EXISTS public.worship_schedules (
    id TEXT PRIMARY KEY,
    sunday_id TEXT REFERENCES public.service_sundays(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    worship_leader TEXT,
    band_members JSONB DEFAULT '[]'::jsonb,
    vocalists JSONB DEFAULT '[]'::jsonb,
    setlist JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SUNDAY SCHOOL LESSONS TABLE
CREATE TABLE IF NOT EXISTS public.sunday_school_lessons (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    topic_sl TEXT DEFAULT '',
    topic_en TEXT DEFAULT '',
    teachers_younger TEXT[] DEFAULT '{}',
    teachers_older TEXT[] DEFAULT '{}',
    materials_needed TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SUNDAY SCHOOL SUPPLIES TABLE
CREATE TABLE IF NOT EXISTS public.sunday_school_supplies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quantity TEXT,
    requested_by TEXT,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. VISITOR CONNECTIONS & HOSPITALITY TABLE
CREATE TABLE IF NOT EXISTS public.visitor_connections (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    contact_info TEXT,
    notes TEXT,
    visited_date TEXT,
    status TEXT DEFAULT 'new', -- 'new' | 'contacted' | 'connected' | 'archived'
    assigned_to TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. FACILITY INSPECTION CHECKLISTS TABLE
CREATE TABLE IF NOT EXISTS public.facility_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sunday_id TEXT REFERENCES public.service_sundays(id) ON DELETE SET NULL,
    sunday_date TEXT NOT NULL,
    category TEXT NOT NULL, -- 'coffee_upper_hall' | 'tech_stage' | 'kids_classrooms' | 'general_cleaning'
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
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_sundays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunday_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blackout_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worship_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunday_school_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunday_school_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_inspections ENABLE ROW LEVEL SECURITY;

-- 1. Read access for all users (public / authenticated)
CREATE POLICY "Public read access for service_sundays" ON public.service_sundays FOR SELECT USING (true);
CREATE POLICY "Public read access for ministries" ON public.ministries FOR SELECT USING (true);
CREATE POLICY "Public read access for profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public read access for sunday_assignments" ON public.sunday_assignments FOR SELECT USING (true);
CREATE POLICY "Public read access for blackout_dates" ON public.blackout_dates FOR SELECT USING (true);
CREATE POLICY "Public read access for shift_swaps" ON public.shift_swaps FOR SELECT USING (true);
CREATE POLICY "Public read access for worship_schedules" ON public.worship_schedules FOR SELECT USING (true);
CREATE POLICY "Public read access for sunday_school_lessons" ON public.sunday_school_lessons FOR SELECT USING (true);
CREATE POLICY "Public read access for sunday_school_supplies" ON public.sunday_school_supplies FOR SELECT USING (true);
CREATE POLICY "Public read access for visitor_connections" ON public.visitor_connections FOR SELECT USING (true);
CREATE POLICY "Public read access for facility_inspections" ON public.facility_inspections FOR SELECT USING (true);

-- 2. Write / Mutation access for authenticated users & leaders
CREATE POLICY "Authenticated users full access service_sundays" ON public.service_sundays FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access ministries" ON public.ministries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access sunday_assignments" ON public.sunday_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access blackout_dates" ON public.blackout_dates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access shift_swaps" ON public.shift_swaps FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access worship_schedules" ON public.worship_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access sunday_school_lessons" ON public.sunday_school_lessons FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access sunday_school_supplies" ON public.sunday_school_supplies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access visitor_connections" ON public.visitor_connections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access facility_inspections" ON public.facility_inspections FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Public token confirmation updates for /potrdi landing page
CREATE POLICY "Public token updates on sunday_assignments" ON public.sunday_assignments
    FOR UPDATE
    USING (confirmation_token IS NOT NULL)
    WITH CHECK (confirmation_token IS NOT NULL);

-- ==============================================================================
-- REALTIME ENABLEMENT
-- ==============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.service_sundays;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sunday_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blackout_dates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_swaps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.worship_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sunday_school_lessons;
ALTER PUBLICATION supabase_realtime ADD TABLE public.visitor_connections;
