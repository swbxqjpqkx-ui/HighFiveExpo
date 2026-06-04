-- ============================================================
-- Extend student_warnings table
-- Run in Supabase SQL Editor
-- ============================================================

-- Add contacted_at timestamp (set when professor sends an email)
ALTER TABLE student_warnings ADD COLUMN IF NOT EXISTS contacted_at timestamptz;

-- Ensure RLS policies are correct:
-- Professors see only their own warnings; admins see all.

-- Drop and recreate to ensure correct definitions
DROP POLICY IF EXISTS "professors_manage_own_warnings" ON student_warnings;
CREATE POLICY "professors_manage_own_warnings"
  ON student_warnings FOR ALL TO authenticated
  USING    (professor_id = auth.uid())
  WITH CHECK (professor_id = auth.uid());

DROP POLICY IF EXISTS "admins_manage_all_warnings" ON student_warnings;
CREATE POLICY "admins_manage_all_warnings"
  ON student_warnings FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );
