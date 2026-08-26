-- ==============================================================================
-- 03_sync_and_trigger_auth_users.sql
-- Robust sync of auth.users to public.profiles and automatic trigger
-- ==============================================================================

-- 1. Ensure required columns exist on public.profiles without errors
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'auth_user_id') THEN
    ALTER TABLE public.profiles ADD COLUMN auth_user_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name') THEN
    ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'Viewer';
  END IF;
END $$;

-- 2. Ensure RLS policies allow reading and updating profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public read access for profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Public full access profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- 3. Link all 8 existing auth.users to their profiles by matching email
UPDATE public.profiles p
SET 
  auth_user_id = u.id,
  email = COALESCE(p.email, u.email),
  updated_at = NOW()
FROM auth.users u
WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(u.email))
  AND (p.auth_user_id IS NULL OR p.auth_user_id != u.id);

-- 4. Insert any Google users from auth.users who don't have a profile yet
INSERT INTO public.profiles (
  id,
  auth_user_id,
  full_name,
  email,
  role,
  created_at,
  updated_at
)
SELECT 
  u.id::text,
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.email,
  'Viewer',
  NOW(),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.auth_user_id = u.id 
     OR (p.email IS NOT NULL AND LOWER(TRIM(p.email)) = LOWER(TRIM(u.email)))
)
ON CONFLICT (id) DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  email = COALESCE(public.profiles.email, EXCLUDED.email);

-- 5. Create automatic trigger so every future Google sign-in is auto-synced
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  matching_profile_id TEXT;
  user_display_name TEXT;
BEGIN
  user_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Check if a profile with the same email already exists
  SELECT id::text INTO matching_profile_id
  FROM public.profiles
  WHERE email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
  LIMIT 1;

  IF matching_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      auth_user_id = NEW.id,
      email = COALESCE(email, NEW.email),
      full_name = COALESCE(full_name, user_display_name),
      updated_at = NOW()
    WHERE id::text = matching_profile_id;
  ELSE
    INSERT INTO public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      role
    )
    VALUES (
      NEW.id::text,
      NEW.id,
      user_display_name,
      NEW.email,
      'Viewer'
    )
    ON CONFLICT (id) DO UPDATE SET
      auth_user_id = EXCLUDED.auth_user_id,
      email = EXCLUDED.email,
      full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger cleanly on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
