-- ==============================================================================
-- 05_preserve_roles_and_link_auth.sql
-- 1. Ensures required columns exist safely (auth_user_id, full_name, name, role)
-- 2. Specifically restores Nina Čižič and Doroteja Kolar back to Leader
-- 3. Consolidates duplicate profiles and links auth_user_id cleanly
-- 4. Updates handle_new_user() trigger to preserve assigned roles (Leader/Servant)
--    and ONLY assign 'Viewer' to truly new users
-- ==============================================================================

-- 1. Ensure required columns exist on public.profiles without error
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'name') THEN
    ALTER TABLE public.profiles ADD COLUMN name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name') THEN
    ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'auth_user_id') THEN
    ALTER TABLE public.profiles ADD COLUMN auth_user_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'Viewer';
  END IF;
END $$;

-- 2. Specifically restore Nina Čižič and Doroteja Kolar to Leader
UPDATE public.profiles
SET 
  role = 'Leader',
  name = COALESCE(name, full_name, 'Nina Čižič'),
  full_name = COALESCE(full_name, name, 'Nina Čižič'),
  updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(full_name, ''))) IN ('nina čižič', 'nina cizic')
   OR LOWER(TRIM(COALESCE(email, ''))) = 'nina.cizic@gmail.com'
   OR id = 'p-nina_cizic';

UPDATE public.profiles
SET 
  role = 'Leader',
  name = COALESCE(name, full_name, 'Doroteja Kolar'),
  full_name = COALESCE(full_name, name, 'Doroteja Kolar'),
  updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(full_name, ''))) IN ('doroteja kolar')
   OR LOWER(TRIM(COALESCE(email, ''))) IN ('dkolar@drustvovec.si', 'doroteja.kolar@gmail.com')
   OR id = 'p-doroteja_kolar';

-- 3. Clean up duplicate profile rows where a UUID row was created with 'Viewer'
--    while a canonical 'p-*' profile already existed with an assigned role
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN 
    SELECT 
      p_canon.id AS canon_id, 
      p_dup.id AS dup_id, 
      p_dup.auth_user_id AS auth_id, 
      p_canon.role AS canon_role
    FROM public.profiles p_canon
    JOIN public.profiles p_dup ON LOWER(TRIM(p_canon.email)) = LOWER(TRIM(p_dup.email))
    WHERE p_canon.id != p_dup.id 
      AND p_canon.id LIKE 'p-%'
      AND p_dup.id NOT LIKE 'p-%'
      AND p_dup.auth_user_id IS NOT NULL
  LOOP
    -- Copy auth_user_id to canonical profile and preserve its assigned role
    UPDATE public.profiles
    SET 
      auth_user_id = dup.auth_id, 
      updated_at = NOW()
    WHERE id = dup.canon_id;

    -- Delete the duplicate row
    DELETE FROM public.profiles WHERE id = dup.dup_id;
  END LOOP;
END $$;

-- 4. Robust trigger: Preserve assigned Leader/Servant/Admin role when matching user signs in
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  matching_profile_id TEXT;
  existing_role TEXT;
  user_display_name TEXT;
BEGIN
  user_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Look for an existing profile with the same email, prioritizing assigned roles & canonical IDs
  SELECT id::text, role INTO matching_profile_id, existing_role
  FROM public.profiles
  WHERE email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
  ORDER BY 
    CASE 
      WHEN role = 'Admin' THEN 1
      WHEN role = 'Leader' THEN 2
      WHEN role = 'Servant' THEN 3
      ELSE 4
    END,
    CASE WHEN id LIKE 'p-%' THEN 1 ELSE 2 END
  LIMIT 1;

  IF matching_profile_id IS NOT NULL THEN
    -- Match found! Attach auth_user_id and DO NOT overwrite their role!
    UPDATE public.profiles
    SET 
      auth_user_id = NEW.id,
      email = COALESCE(email, NEW.email),
      full_name = COALESCE(full_name, user_display_name),
      name = COALESCE(name, user_display_name),
      updated_at = NOW()
    WHERE id::text = matching_profile_id;

    -- Clean up any secondary row created with the auth UUID
    IF matching_profile_id != NEW.id::text THEN
      DELETE FROM public.profiles WHERE id::text = NEW.id::text;
    END IF;
  ELSE
    -- Brand new user without an existing roster profile: assign default 'Viewer'
    INSERT INTO public.profiles (
      id,
      auth_user_id,
      full_name,
      name,
      email,
      role
    )
    VALUES (
      NEW.id::text,
      NEW.id,
      user_display_name,
      user_display_name,
      NEW.email,
      'Viewer'
    )
    ON CONFLICT (id) DO UPDATE SET
      auth_user_id = EXCLUDED.auth_user_id,
      email = EXCLUDED.email,
      full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
      name = COALESCE(public.profiles.name, EXCLUDED.name);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
