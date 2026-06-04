-- ============================================================
-- Profile Terms Acceptance Fields
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS accepted_terms    boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version     text;

-- Make sure the view used by getProfile includes these fields
-- If you have a profiles_with_email view, recreate it to include them:
-- (Skip this block if your view already uses SELECT * from profiles)

-- Check existing view definition first:
-- SELECT definition FROM pg_views WHERE viewname = 'profiles_with_email';

-- If you need to recreate it, drop and re-create:
-- DROP VIEW IF EXISTS profiles_with_email;
-- CREATE VIEW profiles_with_email AS
--   SELECT p.*, u.email
--   FROM profiles p
--   JOIN auth.users u ON u.id = p.id;

-- RLS: users can update their own terms acceptance
-- (already covered by existing "users_update_own_profile" policy)
-- No new policy needed.
