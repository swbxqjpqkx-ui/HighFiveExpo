-- ============================================================
-- Fix RLS on every table the professor app needs to read
-- Run in Supabase SQL Editor
-- ============================================================

-- ── courses ───────────────────────────────────────────────────
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "courses_read_authenticated" ON courses;
CREATE POLICY "courses_read_authenticated" ON courses
  FOR SELECT TO authenticated USING (true);

-- ── course_teachers ───────────────────────────────────────────
ALTER TABLE course_teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "course_teachers_select_authenticated" ON course_teachers;
CREATE POLICY "course_teachers_select_authenticated" ON course_teachers
  FOR SELECT TO authenticated USING (true);

-- ── course_enrollments ────────────────────────────────────────
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "enrollments_read_authenticated" ON course_enrollments;
CREATE POLICY "enrollments_read_authenticated" ON course_enrollments
  FOR SELECT TO authenticated USING (true);

-- ── students ──────────────────────────────────────────────────
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "students_read_authenticated" ON students;
CREATE POLICY "students_read_authenticated" ON students
  FOR SELECT TO authenticated USING (true);

-- ── risk_settings ─────────────────────────────────────────────
ALTER TABLE risk_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "risk_settings_read" ON risk_settings;
CREATE POLICY "risk_settings_read" ON risk_settings
  FOR SELECT TO authenticated USING (true);

-- ── risk_warnings ─────────────────────────────────────────────
ALTER TABLE risk_warnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "risk_warnings_select" ON risk_warnings;
CREATE POLICY "risk_warnings_select" ON risk_warnings
  FOR SELECT TO authenticated
  USING (
    professor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );

-- ── profiles ──────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_read_authenticated" ON profiles;
CREATE POLICY "profiles_read_authenticated" ON profiles
  FOR SELECT TO authenticated USING (true);

-- ── Verify all policies are in place ─────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN (
  'courses','course_teachers','course_enrollments',
  'students','risk_settings','risk_warnings','profiles'
)
ORDER BY tablename, cmd;
