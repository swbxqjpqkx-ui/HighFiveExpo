-- ============================================================
-- Fix: Professor read/write access to risk_warnings
-- Run in Supabase SQL Editor.
-- Safe to run multiple times.
-- ============================================================

-- Professors must be able to SELECT warnings for their own courses
-- (either directly assigned via courses.teacher_id or via course_teachers).

DROP POLICY IF EXISTS "warnings_select_professor" ON risk_warnings;
CREATE POLICY "warnings_select_professor" ON risk_warnings
  FOR SELECT TO authenticated
  USING (
    is_admin_user()
    OR professor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = risk_warnings.course_id
        AND courses.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM course_teachers ct
      WHERE ct.course_id = risk_warnings.course_id
        AND ct.teacher_id = auth.uid()
    )
  );

-- Professors need to INSERT/UPDATE risk_warnings (fetchProfessorAtRiskStudents upserts)
DROP POLICY IF EXISTS "warnings_upsert_professor" ON risk_warnings;
CREATE POLICY "warnings_upsert_professor" ON risk_warnings
  FOR ALL TO authenticated
  USING (
    is_admin_user()
    OR professor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = risk_warnings.course_id
        AND courses.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM course_teachers ct
      WHERE ct.course_id = risk_warnings.course_id
        AND ct.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    is_admin_user()
    OR professor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = risk_warnings.course_id
        AND courses.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM course_teachers ct
      WHERE ct.course_id = risk_warnings.course_id
        AND ct.teacher_id = auth.uid()
    )
  );

-- Verify
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'risk_warnings'
ORDER BY cmd;
