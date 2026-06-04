-- ============================================================
-- Fix: Professor Warnings page access
-- Safe to run multiple times. DOES NOT remove any admin policies.
-- Only refreshes the 5 policies that already existed in
-- migrate_complete_risk_system.sql, plus inserts default
-- risk_settings if the table is empty.
-- ============================================================

-- ── 1. risk_settings: read access + default row ───────────────
-- Professors need to read this to see the grade/absence limits.

DROP POLICY IF EXISTS "risk_settings_read" ON risk_settings;
CREATE POLICY "risk_settings_read" ON risk_settings
  FOR SELECT TO authenticated USING (true);

-- Insert defaults (grade < 60%, absences >= 3) if no row exists yet
INSERT INTO risk_settings (grade_limit_percentage, absence_limit_count)
SELECT 60, 3
WHERE NOT EXISTS (SELECT 1 FROM risk_settings LIMIT 1);

-- ── 2. risk_warnings: read access ────────────────────────────
-- Expand SELECT to also cover course assignment (not just professor_id)
-- so the auto-resolve step in fetchProfessorAtRiskStudents works.

DROP POLICY IF EXISTS "risk_warnings_select" ON risk_warnings;
CREATE POLICY "risk_warnings_select" ON risk_warnings
  FOR SELECT TO authenticated
  USING (
    professor_id = auth.uid()
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
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'administrator'
    )
  );

-- Professors (and admin) can insert new warnings
DROP POLICY IF EXISTS "risk_warnings_insert" ON risk_warnings;
CREATE POLICY "risk_warnings_insert" ON risk_warnings
  FOR INSERT TO authenticated WITH CHECK (true);

-- Professors can update their own warnings; admins can update all
DROP POLICY IF EXISTS "risk_warnings_update" ON risk_warnings;
CREATE POLICY "risk_warnings_update" ON risk_warnings
  FOR UPDATE TO authenticated
  USING (
    professor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'administrator'
    )
  );

-- ── 3. course_enrollments: professor read ─────────────────────
-- Professors must read enrollments to compute at-risk students.

DROP POLICY IF EXISTS "enrollments_read_authenticated" ON course_enrollments;
CREATE POLICY "enrollments_read_authenticated" ON course_enrollments
  FOR SELECT TO authenticated USING (true);

-- ── 4. students: all authenticated can read ───────────────────

DROP POLICY IF EXISTS "students_read_authenticated" ON students;
CREATE POLICY "students_read_authenticated" ON students
  FOR SELECT TO authenticated USING (true);

-- ── Verify ────────────────────────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('risk_settings', 'risk_warnings', 'course_enrollments', 'students')
ORDER BY tablename, cmd;

SELECT grade_limit_percentage, absence_limit_count FROM risk_settings LIMIT 1;
