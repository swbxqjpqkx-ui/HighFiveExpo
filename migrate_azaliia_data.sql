-- ============================================================
-- High Five — Azaliia Ibragimova Full Data Migration
-- Run ONCE in Supabase SQL Editor (safe to re-run)
--
-- What this script does:
--   1. Ensures course_teachers table exists with correct RLS
--   2. Ensures warning_settings (risk_settings) singleton exists
--   3. Assigns Azaliia Ibragimova to all 5 courses
--   4. Creates 15 realistic students
--   5. Enrolls students across courses with grades and absences
--   6. Verifies everything is wired up
-- ============================================================


-- ── 0. Helper: is_admin_user() guard ─────────────────────────
-- Create this function if it doesn't already exist (used by RLS policies)
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'administrator'
  );
$$;


-- ── 1. Ensure course_teachers junction table exists ───────────

CREATE TABLE IF NOT EXISTS course_teachers (
  course_id  uuid NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, teacher_id)
);

ALTER TABLE course_teachers ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read (professors need to see their course assignments)
DROP POLICY IF EXISTS "course_teachers_select_authenticated" ON course_teachers;
CREATE POLICY "course_teachers_select_authenticated" ON course_teachers
  FOR SELECT TO authenticated USING (true);

-- Only admins can insert/update/delete
DROP POLICY IF EXISTS "course_teachers_all_admin" ON course_teachers;
CREATE POLICY "course_teachers_all_admin" ON course_teachers
  FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());


-- ── 2. Ensure risk_settings singleton exists ──────────────────
-- (grade_limit_percentage default 60, absence_limit_count default 3)

CREATE TABLE IF NOT EXISTS risk_settings (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_limit_percentage numeric     NOT NULL DEFAULT 60,
  absence_limit_count    integer     NOT NULL DEFAULT 3,
  created_by             uuid        REFERENCES profiles(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS risk_settings_singleton ON risk_settings ((true));

ALTER TABLE risk_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "risk_settings_read" ON risk_settings;
CREATE POLICY "risk_settings_read" ON risk_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "risk_settings_write" ON risk_settings;
CREATE POLICY "risk_settings_write" ON risk_settings
  FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Seed default settings if none exist
INSERT INTO risk_settings (grade_limit_percentage, absence_limit_count)
SELECT 60, 3
WHERE NOT EXISTS (SELECT 1 FROM risk_settings LIMIT 1);


-- ── 3. Assign Azaliia Ibragimova to all 5 courses ─────────────

DO $$
DECLARE
  prof_id    uuid;
  v_course   record;
  v_courses  text[] := ARRAY[
    'Macroeconomics',
    'Microeconomics',
    'Financial Accounting',
    'Business Mathematics',
    'Introduction to Business'
  ];
  cname      text;
BEGIN
  -- Find Azaliia's profile
  SELECT id INTO prof_id
  FROM profiles
  WHERE full_name ILIKE '%Azaliia Ibragimova%'
  LIMIT 1;

  IF prof_id IS NULL THEN
    RAISE EXCEPTION 'Professor "Azaliia Ibragimova" not found in profiles table. Check the full_name column.';
  END IF;

  RAISE NOTICE 'Found professor: % (id: %)', 'Azaliia Ibragimova', prof_id;

  -- Assign each course
  FOREACH cname IN ARRAY v_courses LOOP
    SELECT id INTO v_course
    FROM courses
    WHERE name ILIKE '%' || cname || '%'
    LIMIT 1;

    IF v_course.id IS NULL THEN
      RAISE WARNING 'Course "%" not found — skipping.', cname;
      CONTINUE;
    END IF;

    -- Insert into course_teachers junction table
    INSERT INTO course_teachers (course_id, teacher_id)
    VALUES (v_course.id, prof_id)
    ON CONFLICT DO NOTHING;

    -- Keep courses.teacher_id in sync (legacy field used by risk detection)
    UPDATE courses
    SET teacher_id = prof_id
    WHERE id = v_course.id;

    RAISE NOTICE 'Assigned course: % (id: %)', cname, v_course.id;
  END LOOP;

  RAISE NOTICE '✓ All courses assigned to Azaliia Ibragimova';
END;
$$;


-- ── 4. Ensure course_enrollments has skipped_classes column ───

ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS skipped_classes integer NOT NULL DEFAULT 0;


-- ── 5. Create 15 realistic students ───────────────────────────
-- Uses WHERE NOT EXISTS so re-running is safe

INSERT INTO students (full_name, email)
SELECT 'Sophie Laurent', 'sophie.laurent@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'sophie.laurent@student.edu');

INSERT INTO students (full_name, email)
SELECT 'Luca Bianchi', 'luca.bianchi@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'luca.bianchi@student.edu');

INSERT INTO students (full_name, email)
SELECT 'Emma Wilson', 'emma.wilson@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'emma.wilson@student.edu');

INSERT INTO students (full_name, email)
SELECT 'James Chen', 'james.chen@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'james.chen@student.edu');

INSERT INTO students (full_name, email)
SELECT 'Maria Rodriguez', 'maria.rodriguez@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'maria.rodriguez@student.edu');

INSERT INTO students (full_name, email)
SELECT 'Thomas Müller', 'thomas.muller@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'thomas.muller@student.edu');

INSERT INTO students (full_name, email)
SELECT 'Isabella Santos', 'isabella.santos@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'isabella.santos@student.edu');

INSERT INTO students (full_name, email)
SELECT 'Oliver Johansson', 'oliver.johansson@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'oliver.johansson@student.edu');

INSERT INTO students (full_name, email)
SELECT 'Amelia Kowalski', 'amelia.kowalski@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'amelia.kowalski@student.edu');

INSERT INTO students (full_name, email)
SELECT 'Noah Williams', 'noah.williams@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'noah.williams@student.edu');

INSERT INTO students (full_name, email)
SELECT 'Zara Ahmed', 'zara.ahmed@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'zara.ahmed@student.edu');

INSERT INTO students (full_name, email)
SELECT 'Felipe García', 'felipe.garcia@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'felipe.garcia@student.edu');

INSERT INTO students (full_name, email)
SELECT 'Yuki Tanaka', 'yuki.tanaka@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'yuki.tanaka@student.edu');

INSERT INTO students (full_name, email)
SELECT 'Leila Moreira', 'leila.moreira@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'leila.moreira@student.edu');

INSERT INTO students (full_name, email)
SELECT 'Daniel Kim', 'daniel.kim@student.edu'
WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'daniel.kim@student.edu');


-- ── 6. Enroll students across all 5 courses ───────────────────
-- Risk limits: grade < 60 = at risk, missed_classes >= 3 = at risk
-- Students marked AT RISK below:
--   Luca Bianchi      — Macroeconomics:   grade 45, missed 4  (both)
--   Maria Rodriguez   — Macroeconomics:   grade 55, missed 2  (grade)
--   Oliver Johansson  — Macroeconomics:   grade 51, missed 1  (grade)
--   Oliver Johansson  — Microeconomics:   grade 47, missed 5  (both)
--   Thomas Müller     — Microeconomics:   grade 64, missed 3  (absence)
--   Zara Ahmed        — FinAcc:           grade 58, missed 4  (both)
--   Leila Moreira     — FinAcc:           grade 42, missed 3  (both)
--   Daniel Kim        — Business Math:    grade 55, missed 1  (grade)

DO $$
DECLARE
  -- Professor
  prof_id    uuid;

  -- Courses
  c_macro    uuid;
  c_micro    uuid;
  c_finacc   uuid;
  c_bizmath  uuid;
  c_intbiz   uuid;

  -- Students
  s_sophie   uuid;
  s_luca     uuid;
  s_emma     uuid;
  s_james    uuid;
  s_maria    uuid;
  s_thomas   uuid;
  s_isabella uuid;
  s_oliver   uuid;
  s_amelia   uuid;
  s_noah     uuid;
  s_zara     uuid;
  s_felipe   uuid;
  s_yuki     uuid;
  s_leila    uuid;
  s_daniel   uuid;

BEGIN
  -- Resolve professor
  SELECT id INTO prof_id FROM profiles WHERE full_name ILIKE '%Azaliia Ibragimova%' LIMIT 1;
  IF prof_id IS NULL THEN RAISE EXCEPTION 'Azaliia Ibragimova not found in profiles'; END IF;

  -- Resolve course IDs (must already exist)
  SELECT id INTO c_macro   FROM courses WHERE name ILIKE '%Macroeconomics%'         LIMIT 1;
  SELECT id INTO c_micro   FROM courses WHERE name ILIKE '%Microeconomics%'         LIMIT 1;
  SELECT id INTO c_finacc  FROM courses WHERE name ILIKE '%Financial Accounting%'   LIMIT 1;
  SELECT id INTO c_bizmath FROM courses WHERE name ILIKE '%Business Mathematics%'   LIMIT 1;
  SELECT id INTO c_intbiz  FROM courses WHERE name ILIKE '%Introduction to Business%' LIMIT 1;

  -- Resolve student IDs
  SELECT id INTO s_sophie   FROM students WHERE email = 'sophie.laurent@student.edu'    LIMIT 1;
  SELECT id INTO s_luca     FROM students WHERE email = 'luca.bianchi@student.edu'      LIMIT 1;
  SELECT id INTO s_emma     FROM students WHERE email = 'emma.wilson@student.edu'       LIMIT 1;
  SELECT id INTO s_james    FROM students WHERE email = 'james.chen@student.edu'        LIMIT 1;
  SELECT id INTO s_maria    FROM students WHERE email = 'maria.rodriguez@student.edu'   LIMIT 1;
  SELECT id INTO s_thomas   FROM students WHERE email = 'thomas.muller@student.edu'     LIMIT 1;
  SELECT id INTO s_isabella FROM students WHERE email = 'isabella.santos@student.edu'   LIMIT 1;
  SELECT id INTO s_oliver   FROM students WHERE email = 'oliver.johansson@student.edu'  LIMIT 1;
  SELECT id INTO s_amelia   FROM students WHERE email = 'amelia.kowalski@student.edu'   LIMIT 1;
  SELECT id INTO s_noah     FROM students WHERE email = 'noah.williams@student.edu'     LIMIT 1;
  SELECT id INTO s_zara     FROM students WHERE email = 'zara.ahmed@student.edu'        LIMIT 1;
  SELECT id INTO s_felipe   FROM students WHERE email = 'felipe.garcia@student.edu'     LIMIT 1;
  SELECT id INTO s_yuki     FROM students WHERE email = 'yuki.tanaka@student.edu'       LIMIT 1;
  SELECT id INTO s_leila    FROM students WHERE email = 'leila.moreira@student.edu'     LIMIT 1;
  SELECT id INTO s_daniel   FROM students WHERE email = 'daniel.kim@student.edu'        LIMIT 1;

  -- ── MACROECONOMICS enrollments ───────────────────────────────
  IF c_macro IS NOT NULL THEN
    INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes)
    VALUES
      (s_sophie,   c_macro, 72, 1, 0),
      (s_luca,     c_macro, 45, 4, 2),   -- AT RISK: grade + absence
      (s_maria,    c_macro, 55, 2, 1),   -- AT RISK: grade
      (s_oliver,   c_macro, 51, 1, 0),   -- AT RISK: grade
      (s_noah,     c_macro, 76, 2, 0),
      (s_yuki,     c_macro, 72, 0, 0),
      (s_daniel,   c_macro, 79, 0, 0)
    ON CONFLICT (student_id, course_id) DO UPDATE SET
      grade          = EXCLUDED.grade,
      missed_classes = EXCLUDED.missed_classes,
      skipped_classes = EXCLUDED.skipped_classes,
      updated_at     = now();
  END IF;

  -- ── MICROECONOMICS enrollments ───────────────────────────────
  IF c_micro IS NOT NULL THEN
    INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes)
    VALUES
      (s_sophie,   c_micro, 68, 2, 1),
      (s_emma,     c_micro, 85, 0, 0),
      (s_thomas,   c_micro, 64, 3, 0),   -- AT RISK: absence
      (s_oliver,   c_micro, 47, 5, 3),   -- AT RISK: grade + absence
      (s_noah,     c_micro, 69, 1, 0),
      (s_felipe,   c_micro, 83, 0, 0),
      (s_daniel,   c_micro, 65, 2, 0)
    ON CONFLICT (student_id, course_id) DO UPDATE SET
      grade          = EXCLUDED.grade,
      missed_classes = EXCLUDED.missed_classes,
      skipped_classes = EXCLUDED.skipped_classes,
      updated_at     = now();
  END IF;

  -- ── FINANCIAL ACCOUNTING enrollments ─────────────────────────
  IF c_finacc IS NOT NULL THEN
    INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes)
    VALUES
      (s_james,    c_finacc, 91, 0, 0),
      (s_maria,    c_finacc, 71, 1, 0),
      (s_isabella, c_finacc, 77, 2, 0),
      (s_amelia,   c_finacc, 88, 0, 0),
      (s_zara,     c_finacc, 58, 4, 2),  -- AT RISK: grade + absence
      (s_leila,    c_finacc, 42, 3, 1)   -- AT RISK: grade + absence
    ON CONFLICT (student_id, course_id) DO UPDATE SET
      grade          = EXCLUDED.grade,
      missed_classes = EXCLUDED.missed_classes,
      skipped_classes = EXCLUDED.skipped_classes,
      updated_at     = now();
  END IF;

  -- ── BUSINESS MATHEMATICS enrollments ─────────────────────────
  IF c_bizmath IS NOT NULL THEN
    INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes)
    VALUES
      (s_luca,     c_bizmath, 73, 1, 0),
      (s_james,    c_bizmath, 88, 0, 0),
      (s_isabella, c_bizmath, 82, 1, 0),
      (s_noah,     c_bizmath, 74, 0, 0),
      (s_yuki,     c_bizmath, 67, 1, 0),
      (s_daniel,   c_bizmath, 55, 1, 0)  -- AT RISK: grade
    ON CONFLICT (student_id, course_id) DO UPDATE SET
      grade          = EXCLUDED.grade,
      missed_classes = EXCLUDED.missed_classes,
      skipped_classes = EXCLUDED.skipped_classes,
      updated_at     = now();
  END IF;

  -- ── INTRODUCTION TO BUSINESS enrollments ─────────────────────
  IF c_intbiz IS NOT NULL THEN
    INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes)
    VALUES
      (s_emma,     c_intbiz, 78, 1, 0),
      (s_thomas,   c_intbiz, 79, 1, 0),
      (s_amelia,   c_intbiz, 93, 0, 0),
      (s_leila,    c_intbiz, 88, 0, 0),
      (s_felipe,   c_intbiz, 76, 2, 0)
    ON CONFLICT (student_id, course_id) DO UPDATE SET
      grade          = EXCLUDED.grade,
      missed_classes = EXCLUDED.missed_classes,
      skipped_classes = EXCLUDED.skipped_classes,
      updated_at     = now();
  END IF;

  RAISE NOTICE '✓ All student enrollments inserted/updated';
END;
$$;


-- ── 7. Verification queries ───────────────────────────────────

-- Confirm Azaliia's 5 courses
SELECT
  c.name          AS course,
  c.program,
  c.semester,
  p.full_name     AS professor,
  COUNT(ce.id)    AS enrolled_students
FROM course_teachers ct
JOIN courses  c  ON c.id  = ct.course_id
JOIN profiles p  ON p.id  = ct.teacher_id
LEFT JOIN course_enrollments ce ON ce.course_id = c.id
WHERE p.full_name ILIKE '%Azaliia Ibragimova%'
GROUP BY c.name, c.program, c.semester, p.full_name
ORDER BY c.name;

-- Confirm student enrollment detail for each of Azaliia's courses
SELECT
  c.name          AS course,
  s.full_name     AS student,
  s.email,
  ce.grade,
  ce.missed_classes,
  ce.skipped_classes,
  CASE
    WHEN ce.grade < 60 AND ce.missed_classes >= 3 THEN 'AT RISK: grade + absence'
    WHEN ce.grade < 60                             THEN 'AT RISK: grade'
    WHEN ce.missed_classes >= 3                    THEN 'AT RISK: absence'
    ELSE 'OK'
  END AS risk_status
FROM course_teachers ct
JOIN courses           c  ON c.id  = ct.course_id
JOIN profiles          p  ON p.id  = ct.teacher_id
JOIN course_enrollments ce ON ce.course_id = c.id
JOIN students          s  ON s.id  = ce.student_id
WHERE p.full_name ILIKE '%Azaliia Ibragimova%'
ORDER BY c.name, ce.grade;

-- Confirm risk_settings
SELECT grade_limit_percentage, absence_limit_count FROM risk_settings LIMIT 1;
