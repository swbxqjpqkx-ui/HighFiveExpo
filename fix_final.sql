-- ============================================================
-- FINAL FIX — Run in Supabase SQL Editor
-- 1. Fix RLS so Azaliia can read course_teachers from the app
-- 2. Remove the 68 extra course assignments, keep only 5
-- ============================================================


-- ── Part 1: Fix RLS on course_teachers ───────────────────────
-- The SQL Editor bypasses RLS (runs as DB owner).
-- The app uses Azaliia's JWT and is blocked if no SELECT policy exists.

ALTER TABLE course_teachers ENABLE ROW LEVEL SECURITY;

-- Drop any conflicting policies first
DROP POLICY IF EXISTS "course_teachers_select_authenticated"   ON course_teachers;
DROP POLICY IF EXISTS "course_teachers_all_admin"              ON course_teachers;
DROP POLICY IF EXISTS "Allow professors to view their courses" ON course_teachers;

-- Any signed-in user can read (professors need to see their own assignments)
CREATE POLICY "course_teachers_select_authenticated" ON course_teachers
  FOR SELECT TO authenticated USING (true);

-- Only admins can write
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator'
  );
$$;

CREATE POLICY "course_teachers_write_admin" ON course_teachers
  FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());


-- ── Part 2: Reset Azaliia to exactly 5 courses ───────────────

-- Remove all 73 current assignments
DELETE FROM course_teachers
WHERE teacher_id = '0577d941-168f-444e-9903-9694c48ccebb';

-- Clear teacher_id on every course that had her set
UPDATE courses
SET teacher_id = NULL
WHERE teacher_id = '0577d941-168f-444e-9903-9694c48ccebb';

-- Insert the correct 5 only
INSERT INTO course_teachers (course_id, teacher_id) VALUES
  ('0800a378-81df-4646-b229-d56b39d59159', '0577d941-168f-444e-9903-9694c48ccebb'),
  ('72581387-8364-46ba-8e2e-460c9b9d1782', '0577d941-168f-444e-9903-9694c48ccebb'),
  ('0436ede8-af11-40af-85bb-d7a0078eb7d3', '0577d941-168f-444e-9903-9694c48ccebb'),
  ('a40bf07f-67b6-41bc-8525-3ea5fd8bf4be', '0577d941-168f-444e-9903-9694c48ccebb'),
  ('a709e219-4b5d-40b1-a3be-d73c17504d02', '0577d941-168f-444e-9903-9694c48ccebb');

-- Sync teacher_id on those 5 courses
UPDATE courses
SET teacher_id = '0577d941-168f-444e-9903-9694c48ccebb'
WHERE id IN (
  '0800a378-81df-4646-b229-d56b39d59159',
  '72581387-8364-46ba-8e2e-460c9b9d1782',
  '0436ede8-af11-40af-85bb-d7a0078eb7d3',
  'a40bf07f-67b6-41bc-8525-3ea5fd8bf4be',
  'a709e219-4b5d-40b1-a3be-d73c17504d02'
);


-- ── Verify — must show exactly 5 rows ────────────────────────
SELECT c.name AS course, c.program, c.semester
FROM course_teachers ct
JOIN courses c ON c.id = ct.course_id
WHERE ct.teacher_id = '0577d941-168f-444e-9903-9694c48ccebb'
ORDER BY c.name;
