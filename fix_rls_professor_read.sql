-- ============================================================
-- Fix: Professor read access to enrollments + students
-- This is the root cause of "0 Students".
-- Safe to run multiple times.
-- ============================================================

-- ── course_enrollments ────────────────────────────────────────
-- fix_profiles_recursion_v2.sql dropped "enrollments_read_authenticated"
-- and only created admin-write + professor-update policies.
-- Professors could not SELECT their own course enrollments at all.

DROP POLICY IF EXISTS "enrollments_select_professor" ON course_enrollments;
CREATE POLICY "enrollments_select_professor" ON course_enrollments
  FOR SELECT TO authenticated
  USING (
    is_admin_user()
    OR EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_enrollments.course_id
        AND courses.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM course_teachers ct
      WHERE ct.course_id = course_enrollments.course_id
        AND ct.teacher_id = auth.uid()
    )
  );

-- ── students ──────────────────────────────────────────────────
-- Professors need to read students to display names/emails.
-- Re-create the open read policy that may have been lost.

DROP POLICY IF EXISTS "students_read_authenticated" ON students;
CREATE POLICY "students_read_authenticated" ON students
  FOR SELECT TO authenticated USING (true);

-- ── courses (safety net) ──────────────────────────────────────
-- Ensure professors can still SELECT courses (needed by getCoursesByTeacher).

DROP POLICY IF EXISTS "courses_read_authenticated" ON courses;
CREATE POLICY "courses_read_authenticated" ON courses
  FOR SELECT TO authenticated USING (true);

-- ── Verify active policies ────────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('course_enrollments', 'students', 'courses')
ORDER BY tablename, cmd;
