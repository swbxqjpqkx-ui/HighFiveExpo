-- ============================================================
-- High Five — Complete Risk System Migration
-- Run ONCE in Supabase SQL Editor (safe to re-run)
--
-- This script ensures ALL tables required by the Student Risk
-- system exist with the correct columns and RLS policies.
-- ============================================================


-- ── 1. profiles ───────────────────────────────────────────────
-- profiles is created by Supabase Auth trigger. We only add
-- columns the risk system reads.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role       text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name  text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email      text;

-- RLS: every authenticated user can read profiles
-- (needed so risk joins work for both admin and professor)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_authenticated" ON profiles;
CREATE POLICY "profiles_read_authenticated" ON profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_write_own" ON profiles;
CREATE POLICY "profiles_write_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());


-- ── 2. students ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS students (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name  text        NOT NULL,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_read_authenticated" ON students;
CREATE POLICY "students_read_authenticated" ON students
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "students_write_admin" ON students;
CREATE POLICY "students_write_admin" ON students
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );


-- ── 3. courses ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS courses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  program     text,
  semester    text,
  teacher_id  uuid        REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Add teacher_id if the table already exists without it
ALTER TABLE courses ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES profiles(id);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS program    text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS semester   text;

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courses_read_authenticated" ON courses;
CREATE POLICY "courses_read_authenticated" ON courses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "courses_write_admin" ON courses;
CREATE POLICY "courses_write_admin" ON courses
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );

DROP POLICY IF EXISTS "courses_update_professor" ON courses;
CREATE POLICY "courses_update_professor" ON courses
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());


-- ── 4. course_enrollments ─────────────────────────────────────
-- This is the source of truth for grades and absences.
-- riskService reads: student_id, course_id, grade, missed_classes

CREATE TABLE IF NOT EXISTS course_enrollments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id      uuid        NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
  grade          numeric     CHECK (grade BETWEEN 0 AND 100),
  missed_classes integer     NOT NULL DEFAULT 0 CHECK (missed_classes >= 0),
  enrolled_at    timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

-- Add missing columns if table already exists
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS grade          numeric  CHECK (grade BETWEEN 0 AND 100);
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS missed_classes integer  NOT NULL DEFAULT 0;
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS enrolled_at    timestamptz NOT NULL DEFAULT now();
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();

ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read enrollments (professors need to see their students)
DROP POLICY IF EXISTS "enrollments_read_authenticated" ON course_enrollments;
CREATE POLICY "enrollments_read_authenticated" ON course_enrollments
  FOR SELECT TO authenticated USING (true);

-- Admin can write all enrollments
DROP POLICY IF EXISTS "enrollments_write_admin" ON course_enrollments;
CREATE POLICY "enrollments_write_admin" ON course_enrollments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );

-- Professor can update grade/absences for students in their own courses
DROP POLICY IF EXISTS "enrollments_update_professor" ON course_enrollments;
CREATE POLICY "enrollments_update_professor" ON course_enrollments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_enrollments.course_id
        AND courses.teacher_id = auth.uid()
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_enrollment_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_enrollment_updated ON course_enrollments;
CREATE TRIGGER trg_enrollment_updated
  BEFORE UPDATE ON course_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_enrollment_updated_at();


-- ── 5. risk_settings ─────────────────────────────────────────
-- One school-wide row. Admin sets grade and absence limits.

CREATE TABLE IF NOT EXISTS risk_settings (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_limit_percentage numeric     NOT NULL DEFAULT 60,
  absence_limit_count    integer     NOT NULL DEFAULT 3,
  created_by             uuid        REFERENCES profiles(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Enforce singleton (only one settings row allowed)
CREATE UNIQUE INDEX IF NOT EXISTS risk_settings_singleton ON risk_settings ((true));

ALTER TABLE risk_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "risk_settings_read" ON risk_settings;
CREATE POLICY "risk_settings_read" ON risk_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "risk_settings_write" ON risk_settings;
CREATE POLICY "risk_settings_write" ON risk_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );

-- Insert default settings if none exist yet
-- Default: warn if grade < 60% OR missed_classes >= 3
INSERT INTO risk_settings (grade_limit_percentage, absence_limit_count)
SELECT 60, 3
WHERE NOT EXISTS (SELECT 1 FROM risk_settings LIMIT 1);


-- ── 6. risk_warnings ─────────────────────────────────────────
-- Auto-generated when a student's grade or absences cross the
-- school-wide limits. One row per student+course pair (upserted).

CREATE TABLE IF NOT EXISTS risk_warnings (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id                 uuid        NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
  professor_id              uuid        REFERENCES profiles(id),
  program                   text,
  semester                  text,
  grade_percentage          numeric,
  missed_classes_count      integer,
  risk_reason               text        NOT NULL,
  status                    text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'resolved')),
  course_help_email_sent    boolean     NOT NULL DEFAULT false,
  absence_policy_email_sent boolean     NOT NULL DEFAULT false,
  last_email_sent_at        timestamptz,
  resolved_by               uuid        REFERENCES profiles(id),
  resolved_at               timestamptz,
  resolution_note           text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

CREATE INDEX IF NOT EXISTS risk_warnings_professor_idx ON risk_warnings (professor_id);
CREATE INDEX IF NOT EXISTS risk_warnings_status_idx    ON risk_warnings (status);
CREATE INDEX IF NOT EXISTS risk_warnings_student_idx   ON risk_warnings (student_id);

ALTER TABLE risk_warnings ENABLE ROW LEVEL SECURITY;

-- Professors see warnings for their own courses; admins see all
DROP POLICY IF EXISTS "risk_warnings_select" ON risk_warnings;
CREATE POLICY "risk_warnings_select" ON risk_warnings
  FOR SELECT TO authenticated
  USING (
    professor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );

-- Any authenticated user can insert (risk detection runs as the logged-in user)
DROP POLICY IF EXISTS "risk_warnings_insert" ON risk_warnings;
CREATE POLICY "risk_warnings_insert" ON risk_warnings
  FOR INSERT TO authenticated WITH CHECK (true);

-- Professors can update their own warnings; admins can update all
DROP POLICY IF EXISTS "risk_warnings_update" ON risk_warnings;
CREATE POLICY "risk_warnings_update" ON risk_warnings
  FOR UPDATE TO authenticated
  USING (
    professor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_risk_warnings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_risk_warnings_updated ON risk_warnings;
CREATE TRIGGER trg_risk_warnings_updated
  BEFORE UPDATE ON risk_warnings
  FOR EACH ROW EXECUTE FUNCTION update_risk_warnings_updated_at();


-- ── 7. Helper: assign logged-in professor to unassigned courses ─
-- After running this migration, run this block while logged in
-- as a professor to assign yourself to courses that have no teacher:
--
--   UPDATE courses
--   SET teacher_id = auth.uid()
--   WHERE teacher_id IS NULL
--     AND program = 'Business Administration'   -- change to your program
--   LIMIT 5;                                    -- assign as many as needed
--
-- Or assign a specific professor by their profile UUID:
--
--   UPDATE courses
--   SET teacher_id = '<professor-profile-uuid>'
--   WHERE teacher_id IS NULL;
-- ─────────────────────────────────────────────────────────────
