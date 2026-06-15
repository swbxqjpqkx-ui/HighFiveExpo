-- ============================================================
-- Open Day Items — corrected migration
-- Run in Supabase SQL Editor (replaces the broken policy syntax
-- in migrate_open_day.sql, which used the invalid
-- `CREATE POLICY IF NOT EXISTS` and aborted before creating the
-- admin policy). This version uses the same proven pattern as
-- migrate_ambassadors.sql: DROP POLICY IF EXISTS, then CREATE.
--
-- Safe to run multiple times. Does NOT touch any other table,
-- policy, or data. Existing rows are preserved.
-- ============================================================

-- 1. Table (no-op if it already exists)
CREATE TABLE IF NOT EXISTS open_day_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid,
  title          text        NOT NULL,
  description    text,
  icon_name      text        DEFAULT '🎟️',
  linked_route   text,
  display_order  integer     DEFAULT 0,
  is_visible     boolean     DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- 2. Enable RLS (no-op if already enabled)
ALTER TABLE open_day_items ENABLE ROW LEVEL SECURITY;

-- 3. Admins can do everything (the policy the broken migration failed to create)
DROP POLICY IF EXISTS "admins_manage_open_day_items" ON open_day_items;
CREATE POLICY "admins_manage_open_day_items"
  ON open_day_items FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );

-- 4. All authenticated users can view visible items
DROP POLICY IF EXISTS "users_view_open_day_items" ON open_day_items;
CREATE POLICY "users_view_open_day_items"
  ON open_day_items FOR SELECT TO authenticated
  USING (is_visible = true);

-- 5. Optional starter items — only inserted if the table is currently empty,
--    so re-running this file never creates duplicates. Delete this block if
--    you want to start with an empty program.
INSERT INTO open_day_items (title, description, icon_name, display_order)
SELECT * FROM (VALUES
  ('Campus Tour',           'Guided walk through our campus facilities and student spaces.', '🏫', 1),
  ('Program Presentations', 'Overview of BBA, MBA, and DBA programs by department heads.',   '🎓', 2),
  ('Meet the Professors',   'Q&A sessions with faculty members across all programs.',        '👩‍🏫', 3),
  ('Student Life Panel',    'Current students share their experience and answer questions.', '💬', 4),
  ('Admissions Desk',       'One-on-one meetings with admissions officers.',                 '📋', 5),
  ('Networking Lunch',      'Join students, faculty, and staff for an informal lunch.',      '🍽️', 6)
) AS seed(title, description, icon_name, display_order)
WHERE NOT EXISTS (SELECT 1 FROM open_day_items);
