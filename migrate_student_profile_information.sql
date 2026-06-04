-- ============================================================
-- Student Profile Information
-- Structured, STUDENT-LEVEL context entries (interests, academic
-- background, learning difficulties, custom categories) added by
-- professors/admins. Keyed by the global students.id so the same
-- information appears in every course the student is enrolled in.
--
-- Run once in Supabase SQL Editor (Dashboard -> SQL Editor).
-- Safe to re-run.
--
-- NOTE: This script creates a BRAND-NEW table and its own policies.
-- It does NOT touch the students table, course_enrollments, profiles,
-- authentication, or any existing policy/RLS rule.
-- ============================================================

CREATE TABLE IF NOT EXISTS student_profile_information (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id              uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  category_type           text NOT NULL
                            CHECK (category_type IN ('interest','academic_background','learning_difficulty','custom')),
  custom_category_name    text,
  content                 text NOT NULL,
  added_by_professor_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_by_professor_name text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_profile_information_student_id_idx
  ON student_profile_information (student_id);

ALTER TABLE student_profile_information ENABLE ROW LEVEL SECURITY;

-- Read: any signed-in professor/admin can see the entries (platform-wide
-- visibility). Which student profiles a professor can actually open is still
-- gated by the existing app/course access logic, exactly like the students
-- table's own "students_read_authenticated" SELECT policy.
DROP POLICY IF EXISTS "spi_read_authenticated" ON student_profile_information;
CREATE POLICY "spi_read_authenticated"
  ON student_profile_information FOR SELECT TO authenticated
  USING (true);

-- Insert: a signed-in user may add an entry attributed to themselves.
DROP POLICY IF EXISTS "spi_insert_authenticated" ON student_profile_information;
CREATE POLICY "spi_insert_authenticated"
  ON student_profile_information FOR INSERT TO authenticated
  WITH CHECK (added_by_professor_id = auth.uid());

-- Update: signed-in professors/admins can edit shared entries.
DROP POLICY IF EXISTS "spi_update_authenticated" ON student_profile_information;
CREATE POLICY "spi_update_authenticated"
  ON student_profile_information FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Delete: signed-in professors/admins can delete shared entries.
DROP POLICY IF EXISTS "spi_delete_authenticated" ON student_profile_information;
CREATE POLICY "spi_delete_authenticated"
  ON student_profile_information FOR DELETE TO authenticated
  USING (true);
