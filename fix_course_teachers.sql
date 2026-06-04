-- ============================================================
-- Fix: Restore professor course visibility
-- Run in Supabase SQL Editor
--
-- Problem: getCoursesByTeacher queries course_teachers first.
-- If RLS is blocking reads or data is missing, courses show
-- as empty. This script fixes both issues.
-- ============================================================


-- ── Step 1: Ensure course_teachers is readable ────────────────
-- If RLS is enabled on course_teachers without a SELECT policy,
-- professors can't read their own assignments → empty courses.

ALTER TABLE course_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_teachers_select_authenticated" ON course_teachers;
CREATE POLICY "course_teachers_select_authenticated" ON course_teachers
  FOR SELECT TO authenticated USING (true);

-- Preserve admin write access
DROP POLICY IF EXISTS "course_teachers_all_admin" ON course_teachers;
CREATE POLICY "course_teachers_all_admin" ON course_teachers
  FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());


-- ── Step 2: Re-sync course_teachers from courses.teacher_id ───
-- If course_teachers rows are missing for courses that have
-- teacher_id set, re-insert them.

INSERT INTO course_teachers (course_id, teacher_id)
SELECT id, teacher_id
FROM courses
WHERE teacher_id IS NOT NULL
ON CONFLICT DO NOTHING;


-- ── Step 3: Verify ────────────────────────────────────────────

DO $$
DECLARE
  ct_count integer;
  courses_with_teacher integer;
BEGIN
  SELECT COUNT(*) INTO ct_count FROM course_teachers;
  SELECT COUNT(*) INTO courses_with_teacher FROM courses WHERE teacher_id IS NOT NULL;

  RAISE NOTICE '=== Fix Verification ===';
  RAISE NOTICE 'course_teachers rows: %', ct_count;
  RAISE NOTICE 'courses with teacher_id set: %', courses_with_teacher;
  RAISE NOTICE 'Reload the app — courses should now be visible.';
END;
$$;
