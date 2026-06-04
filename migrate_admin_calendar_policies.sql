-- ============================================================================
-- migrate_admin_calendar_policies.sql
-- OPTIONAL: run this AFTER admin_calendar exists with RLS enabled
-- (i.e. after you chose "Run and enable RLS").
--
-- These policies grant access to LOGGED-IN users only (the `authenticated`
-- role). They do NOT touch any other table, auth rules, or existing policies.
-- Review before running. Adjust if you want to restrict to admins only.
-- ============================================================================

-- (Safe no-op if RLS is already on.)
ALTER TABLE admin_calendar ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can read calendar events.
CREATE POLICY "admin_calendar_select_authenticated"
  ON admin_calendar FOR SELECT
  TO authenticated
  USING (true);

-- Any signed-in user can add an event (the app only exposes this in the
-- admin UI). created_by must match the inserter.
CREATE POLICY "admin_calendar_insert_authenticated"
  ON admin_calendar FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());
