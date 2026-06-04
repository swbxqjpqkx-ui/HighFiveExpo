-- ============================================================
-- Fix: infinite recursion in profiles RLS policies
-- Error: 42P17 - infinite recursion detected in policy for "profiles"
--
-- Root cause: policies on `profiles` that query `profiles` itself
-- (e.g. EXISTS (SELECT 1 FROM profiles WHERE role = 'administrator'))
-- cause infinite recursion when any query touches the profiles table.
--
-- Fix:
--   1. Create is_admin_user() as SECURITY DEFINER — bypasses RLS,
--      so it can query profiles without triggering policies.
--   2. Replace all recursive profiles policies with clean ones.
--   3. Replace recursive policies on other tables too.
-- ============================================================


-- ── Step 1: SECURITY DEFINER admin check (no recursion) ──────
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator'
  );
$$;


-- ── Step 2: Fix profiles table ────────────────────────────────
-- Drop every existing SELECT/UPDATE policy — some cause recursion

DROP POLICY IF EXISTS "admins_read_all_profiles"            ON profiles;
DROP POLICY IF EXISTS "admin_read_all_profiles"             ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"        ON profiles;
DROP POLICY IF EXISTS "Enable users to view their own data only" ON profiles;
DROP POLICY IF EXISTS "users_read_own_profile"              ON profiles;
DROP POLICY IF EXISTS "profiles_read_authenticated"         ON profiles;
DROP POLICY IF EXISTS "profiles_write_own"                  ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile"  ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile"            ON profiles;

-- Clean replacement: any signed-in user can read any profile
-- (needed for joins in risk_warnings, course queries, etc.)
CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT TO authenticated USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());


-- ── Step 3: Fix courses ───────────────────────────────────────
-- Old admin policies likely used EXISTS(SELECT FROM profiles...) — recursive

DROP POLICY IF EXISTS "admins_read_all_courses"  ON courses;
DROP POLICY IF EXISTS "courses_write_admin"       ON courses;
DROP POLICY IF EXISTS "Admins can insert courses" ON courses;
DROP POLICY IF EXISTS "Admins can update courses" ON courses;
DROP POLICY IF EXISTS "courses_update_professor"  ON courses;

CREATE POLICY "courses_write_admin" ON courses
  FOR ALL TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE POLICY "courses_update_professor" ON courses
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());


-- ── Step 4: Fix students ──────────────────────────────────────

DROP POLICY IF EXISTS "admins_read_all_students"               ON students;
DROP POLICY IF EXISTS "Admins can view all students"           ON students;
DROP POLICY IF EXISTS "students_write_admin"                   ON students;
DROP POLICY IF EXISTS "Teachers can insert students"           ON students;
DROP POLICY IF EXISTS "Teachers can view students in their courses" ON students;

CREATE POLICY "students_write_admin" ON students
  FOR ALL TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());


-- ── Step 5: Fix course_enrollments ───────────────────────────

DROP POLICY IF EXISTS "admins_read_all_enrollments"                    ON course_enrollments;
DROP POLICY IF EXISTS "Teachers can view their course enrollments"     ON course_enrollments;
DROP POLICY IF EXISTS "enrollments_write_admin"                        ON course_enrollments;
DROP POLICY IF EXISTS "Teachers can insert enrollments for their courses" ON course_enrollments;
DROP POLICY IF EXISTS "enrollments_update_professor"                   ON course_enrollments;

CREATE POLICY "enrollments_write_admin" ON course_enrollments
  FOR ALL TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE POLICY "enrollments_update_professor" ON course_enrollments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_enrollments.course_id
        AND courses.teacher_id = auth.uid()
    )
  );


-- ── Step 6: Fix course_teachers ───────────────────────────────

DROP POLICY IF EXISTS "course_teachers_write_admin"          ON course_teachers;
DROP POLICY IF EXISTS "Admins can delete course assignments" ON course_teachers;
DROP POLICY IF EXISTS "Admins can insert course assignments" ON course_teachers;

CREATE POLICY "course_teachers_write_admin" ON course_teachers
  FOR ALL TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());


-- ── Step 7: Fix risk_settings + risk_warnings ─────────────────

DROP POLICY IF EXISTS "risk_settings_write" ON risk_settings;
CREATE POLICY "risk_settings_write" ON risk_settings
  FOR ALL TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "risk_warnings_select" ON risk_warnings;
CREATE POLICY "risk_warnings_select" ON risk_warnings
  FOR SELECT TO authenticated
  USING (professor_id = auth.uid() OR is_admin_user());

DROP POLICY IF EXISTS "risk_warnings_update" ON risk_warnings;
CREATE POLICY "risk_warnings_update" ON risk_warnings
  FOR UPDATE TO authenticated
  USING (professor_id = auth.uid() OR is_admin_user());


-- ── Verify: no recursive policies remain ─────────────────────
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN (
  'profiles','courses','students',
  'course_enrollments','course_teachers','risk_settings','risk_warnings'
)
ORDER BY tablename, cmd;
