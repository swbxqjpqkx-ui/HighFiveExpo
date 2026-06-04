-- ============================================================
-- Fix: Admin read access for Student Risk evaluation
-- Root cause: RLS policies that query `profiles` to check admin
-- role cause infinite recursion (500 error) when the profiles
-- table itself has its own RLS policy.
-- Fix: SECURITY DEFINER function bypasses RLS when checking role.
-- ============================================================

-- ── Step 1: Create a safe admin-check function ────────────────────────────────
-- SECURITY DEFINER runs as the function owner (superuser), so it
-- reads profiles WITHOUT triggering profiles' own RLS → no recursion.

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'administrator'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- ── Step 2: Add admin SELECT policies using the safe function ─────────────────

-- student_risk_rules
DROP POLICY IF EXISTS "admins_read_risk_rules" ON student_risk_rules;
CREATE POLICY "admins_read_risk_rules"
  ON student_risk_rules FOR SELECT TO authenticated
  USING (is_admin_user());

-- courses
DROP POLICY IF EXISTS "admins_read_all_courses" ON courses;
CREATE POLICY "admins_read_all_courses"
  ON courses FOR SELECT TO authenticated
  USING (is_admin_user());

-- course_enrollments
DROP POLICY IF EXISTS "admins_read_all_enrollments" ON course_enrollments;
CREATE POLICY "admins_read_all_enrollments"
  ON course_enrollments FOR SELECT TO authenticated
  USING (is_admin_user());

-- students
DROP POLICY IF EXISTS "admins_read_all_students" ON students;
CREATE POLICY "admins_read_all_students"
  ON students FOR SELECT TO authenticated
  USING (is_admin_user());

-- profiles (for professor name/email lookup)
DROP POLICY IF EXISTS "admins_read_all_profiles" ON profiles;
CREATE POLICY "admins_read_all_profiles"
  ON profiles FOR SELECT TO authenticated
  USING (is_admin_user());

-- student_warnings (read + write)
DROP POLICY IF EXISTS "admins_manage_all_warnings" ON student_warnings;
CREATE POLICY "admins_manage_all_warnings"
  ON student_warnings FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
