-- ============================================================
-- Profile Table Extended Fields
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone            text,
  ADD COLUMN IF NOT EXISTS bio              text,
  ADD COLUMN IF NOT EXISTS office_location  text,
  ADD COLUMN IF NOT EXISTS department       text,
  ADD COLUMN IF NOT EXISTS academic_title   text,
  ADD COLUMN IF NOT EXISTS avatar_url       text,
  ADD COLUMN IF NOT EXISTS city             text,
  ADD COLUMN IF NOT EXISTS country          text,
  ADD COLUMN IF NOT EXISTS specialization   text,
  ADD COLUMN IF NOT EXISTS status           text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_login_at    timestamptz;

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_profile_updated_at();

-- Update last_login_at when user signs in (call from app or via auth hook)
-- This can be called manually: UPDATE profiles SET last_login_at = now() WHERE id = auth.uid();

-- RLS: users can read+update their own profile
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'users_read_own_profile') THEN
    CREATE POLICY "users_read_own_profile" ON profiles
      FOR SELECT TO authenticated USING (id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'users_update_own_profile') THEN
    CREATE POLICY "users_update_own_profile" ON profiles
      FOR UPDATE TO authenticated
      USING (id = auth.uid()) WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- Admins can read all profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'admin_read_all_profiles') THEN
    CREATE POLICY "admin_read_all_profiles" ON profiles
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'administrator'));
  END IF;
END $$;
