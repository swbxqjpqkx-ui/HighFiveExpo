-- ============================================================
-- High Five — Complete Assignment & Data Fix
-- Safe to run multiple times (idempotent).
-- Run in Supabase SQL Editor.
--
-- What this does:
--   1.  Ensures is_admin_user() helper exists
--   2.  Adds teacher_id to courses if missing
--   3.  Assigns Azaliia Ibragimova to 5 courses
--       (both courses.teacher_id AND course_teachers junction)
--   4.  Ensures students exist and are enrolled in all 5 courses
--   5.  Backfills risk_warnings.professor_id where NULL
--   6.  Runs verification queries
-- ============================================================


-- ── 1. Helper function ────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator'
  );
$$;


-- ── 2. Ensure courses.teacher_id column exists ────────────────
ALTER TABLE courses ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES profiles(id);


-- ── 3. Ensure course_teachers junction table exists ───────────
CREATE TABLE IF NOT EXISTS course_teachers (
  course_id  uuid NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, teacher_id)
);

ALTER TABLE course_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_teachers_select_authenticated" ON course_teachers;
CREATE POLICY "course_teachers_select_authenticated" ON course_teachers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "course_teachers_write_admin" ON course_teachers;
CREATE POLICY "course_teachers_write_admin" ON course_teachers
  FOR ALL TO authenticated
  USING (is_admin_user()) WITH CHECK (is_admin_user());


-- ── 4. Assign Azaliia Ibragimova to 5 courses ─────────────────
DO $$
DECLARE
  prof_id uuid;
  cid     uuid;
  cnames  text[] := ARRAY[
    'Macroeconomics',
    'Microeconomics',
    'Financial Accounting',
    'Business Mathematics',
    'Introduction to Business'
  ];
  cname   text;
BEGIN
  -- Find professor
  SELECT id INTO prof_id
  FROM profiles
  WHERE full_name ILIKE '%Azaliia%Ibragimova%'
  LIMIT 1;

  IF prof_id IS NULL THEN
    RAISE EXCEPTION
      'Azaliia Ibragimova not found in profiles. '
      'Check the full_name column: SELECT id, full_name, role FROM profiles;';
  END IF;

  -- Ensure role is professor
  UPDATE profiles
  SET role = 'professor'
  WHERE id = prof_id AND (role IS NULL OR role NOT IN ('professor','administrator'));

  RAISE NOTICE 'Professor found: % (id = %)', 'Azaliia Ibragimova', prof_id;

  -- Assign each course
  FOREACH cname IN ARRAY cnames LOOP
    SELECT id INTO cid
    FROM courses
    WHERE name ILIKE '%' || cname || '%'
    LIMIT 1;

    IF cid IS NULL THEN
      RAISE WARNING 'Course "%" not found — skipping.', cname;
      CONTINUE;
    END IF;

    -- Set courses.teacher_id (primary field used by getCoursesByTeacher)
    UPDATE courses SET teacher_id = prof_id WHERE id = cid;

    -- Insert into junction table (used by getStudentsByTeacher & runRiskDetection)
    INSERT INTO course_teachers (course_id, teacher_id)
    VALUES (cid, prof_id)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Assigned: % (course_id = %)', cname, cid;
  END LOOP;

  RAISE NOTICE '✓ All 5 courses assigned to Azaliia Ibragimova';
END;
$$;


-- ── 5. Ensure students exist ──────────────────────────────────
INSERT INTO students (full_name, email)
VALUES
  ('Sophie Laurent',    'sophie.laurent@student.edu'),
  ('Luca Bianchi',     'luca.bianchi@student.edu'),
  ('Emma Wilson',      'emma.wilson@student.edu'),
  ('James Chen',       'james.chen@student.edu'),
  ('Maria Rodriguez',  'maria.rodriguez@student.edu'),
  ('Thomas Müller',    'thomas.muller@student.edu'),
  ('Isabella Santos',  'isabella.santos@student.edu'),
  ('Oliver Johansson', 'oliver.johansson@student.edu'),
  ('Amelia Kowalski',  'amelia.kowalski@student.edu'),
  ('Noah Williams',    'noah.williams@student.edu'),
  ('Zara Ahmed',       'zara.ahmed@student.edu'),
  ('Felipe García',    'felipe.garcia@student.edu'),
  ('Yuki Tanaka',      'yuki.tanaka@student.edu'),
  ('Leila Moreira',    'leila.moreira@student.edu'),
  ('Daniel Kim',       'daniel.kim@student.edu')
ON CONFLICT (email) DO NOTHING;


-- ── 6. Add skipped_classes column if missing ──────────────────
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS skipped_classes integer NOT NULL DEFAULT 0;


-- ── 7. Enroll students in all 5 courses (upsert) ─────────────
-- Risk thresholds: grade < 60 OR missed_classes >= 3
-- Students deliberately at-risk:
--   Luca Bianchi       Macroeconomics   grade 45, missed 4   → both
--   Maria Rodriguez    Macroeconomics   grade 55, missed 2   → grade
--   Oliver Johansson   Macroeconomics   grade 51, missed 1   → grade
--   Oliver Johansson   Microeconomics   grade 47, missed 5   → both
--   Thomas Müller      Microeconomics   grade 64, missed 3   → absence
--   Zara Ahmed         Financial Acc.   grade 58, missed 4   → both
--   Leila Moreira      Financial Acc.   grade 42, missed 3   → both
--   Daniel Kim         Business Math    grade 55, missed 1   → grade
DO $$
DECLARE
  c_macro   uuid; c_micro  uuid; c_finacc  uuid;
  c_bizmath uuid; c_intbiz uuid;
  s_sophie   uuid; s_luca    uuid; s_emma    uuid;
  s_james    uuid; s_maria   uuid; s_thomas  uuid;
  s_isabella uuid; s_oliver  uuid; s_amelia  uuid;
  s_noah     uuid; s_zara    uuid; s_felipe  uuid;
  s_yuki     uuid; s_leila   uuid; s_daniel  uuid;
BEGIN
  -- Courses
  SELECT id INTO c_macro   FROM courses WHERE name ILIKE '%Macroeconomics%'          LIMIT 1;
  SELECT id INTO c_micro   FROM courses WHERE name ILIKE '%Microeconomics%'          LIMIT 1;
  SELECT id INTO c_finacc  FROM courses WHERE name ILIKE '%Financial Accounting%'    LIMIT 1;
  SELECT id INTO c_bizmath FROM courses WHERE name ILIKE '%Business Mathematics%'    LIMIT 1;
  SELECT id INTO c_intbiz  FROM courses WHERE name ILIKE '%Introduction to Business%' LIMIT 1;

  -- Students
  SELECT id INTO s_sophie   FROM students WHERE email = 'sophie.laurent@student.edu';
  SELECT id INTO s_luca     FROM students WHERE email = 'luca.bianchi@student.edu';
  SELECT id INTO s_emma     FROM students WHERE email = 'emma.wilson@student.edu';
  SELECT id INTO s_james    FROM students WHERE email = 'james.chen@student.edu';
  SELECT id INTO s_maria    FROM students WHERE email = 'maria.rodriguez@student.edu';
  SELECT id INTO s_thomas   FROM students WHERE email = 'thomas.muller@student.edu';
  SELECT id INTO s_isabella FROM students WHERE email = 'isabella.santos@student.edu';
  SELECT id INTO s_oliver   FROM students WHERE email = 'oliver.johansson@student.edu';
  SELECT id INTO s_amelia   FROM students WHERE email = 'amelia.kowalski@student.edu';
  SELECT id INTO s_noah     FROM students WHERE email = 'noah.williams@student.edu';
  SELECT id INTO s_zara     FROM students WHERE email = 'zara.ahmed@student.edu';
  SELECT id INTO s_felipe   FROM students WHERE email = 'felipe.garcia@student.edu';
  SELECT id INTO s_yuki     FROM students WHERE email = 'yuki.tanaka@student.edu';
  SELECT id INTO s_leila    FROM students WHERE email = 'leila.moreira@student.edu';
  SELECT id INTO s_daniel   FROM students WHERE email = 'daniel.kim@student.edu';

  -- Macroeconomics
  IF c_macro IS NOT NULL THEN
    INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes)
    VALUES
      (s_sophie,  c_macro, 72, 1, 0),
      (s_luca,    c_macro, 45, 4, 2),
      (s_maria,   c_macro, 55, 2, 1),
      (s_oliver,  c_macro, 51, 1, 0),
      (s_noah,    c_macro, 76, 2, 0),
      (s_yuki,    c_macro, 72, 0, 0),
      (s_daniel,  c_macro, 79, 0, 0)
    ON CONFLICT (student_id, course_id) DO UPDATE SET
      grade = EXCLUDED.grade, missed_classes = EXCLUDED.missed_classes,
      skipped_classes = EXCLUDED.skipped_classes, updated_at = now();
  END IF;

  -- Microeconomics
  IF c_micro IS NOT NULL THEN
    INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes)
    VALUES
      (s_sophie,  c_micro, 68, 2, 1),
      (s_emma,    c_micro, 85, 0, 0),
      (s_thomas,  c_micro, 64, 3, 0),
      (s_oliver,  c_micro, 47, 5, 3),
      (s_noah,    c_micro, 69, 1, 0),
      (s_felipe,  c_micro, 83, 0, 0),
      (s_daniel,  c_micro, 65, 2, 0)
    ON CONFLICT (student_id, course_id) DO UPDATE SET
      grade = EXCLUDED.grade, missed_classes = EXCLUDED.missed_classes,
      skipped_classes = EXCLUDED.skipped_classes, updated_at = now();
  END IF;

  -- Financial Accounting
  IF c_finacc IS NOT NULL THEN
    INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes)
    VALUES
      (s_james,    c_finacc, 91, 0, 0),
      (s_maria,    c_finacc, 71, 1, 0),
      (s_isabella, c_finacc, 77, 2, 0),
      (s_amelia,   c_finacc, 88, 0, 0),
      (s_zara,     c_finacc, 58, 4, 2),
      (s_leila,    c_finacc, 42, 3, 1)
    ON CONFLICT (student_id, course_id) DO UPDATE SET
      grade = EXCLUDED.grade, missed_classes = EXCLUDED.missed_classes,
      skipped_classes = EXCLUDED.skipped_classes, updated_at = now();
  END IF;

  -- Business Mathematics
  IF c_bizmath IS NOT NULL THEN
    INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes)
    VALUES
      (s_luca,     c_bizmath, 73, 1, 0),
      (s_james,    c_bizmath, 88, 0, 0),
      (s_isabella, c_bizmath, 82, 1, 0),
      (s_noah,     c_bizmath, 74, 0, 0),
      (s_yuki,     c_bizmath, 67, 1, 0),
      (s_daniel,   c_bizmath, 55, 1, 0)
    ON CONFLICT (student_id, course_id) DO UPDATE SET
      grade = EXCLUDED.grade, missed_classes = EXCLUDED.missed_classes,
      skipped_classes = EXCLUDED.skipped_classes, updated_at = now();
  END IF;

  -- Introduction to Business
  IF c_intbiz IS NOT NULL THEN
    INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes)
    VALUES
      (s_emma,    c_intbiz, 78, 1, 0),
      (s_thomas,  c_intbiz, 79, 1, 0),
      (s_amelia,  c_intbiz, 93, 0, 0),
      (s_leila,   c_intbiz, 88, 0, 0),
      (s_felipe,  c_intbiz, 76, 2, 0)
    ON CONFLICT (student_id, course_id) DO UPDATE SET
      grade = EXCLUDED.grade, missed_classes = EXCLUDED.missed_classes,
      skipped_classes = EXCLUDED.skipped_classes, updated_at = now();
  END IF;

  RAISE NOTICE '✓ All enrollments inserted/updated';
END;
$$;


-- ── 8. Backfill risk_warnings.professor_id ────────────────────
-- Updates any warning that has professor_id = NULL but whose course
-- now has a teacher_id set. Safe: only touches NULL rows.
UPDATE risk_warnings rw
SET
  professor_id = c.teacher_id,
  updated_at   = now()
FROM courses c
WHERE c.id           = rw.course_id
  AND rw.professor_id IS NULL
  AND c.teacher_id   IS NOT NULL;

-- Also sync courses.teacher_id from course_teachers for any course
-- where teacher_id is still null but a junction row exists.
UPDATE courses c
SET teacher_id = ct.teacher_id
FROM course_teachers ct
WHERE ct.course_id = c.id
  AND c.teacher_id IS NULL;


-- ── 9. Verification ───────────────────────────────────────────

-- A) Azaliia's 5 courses with student counts
SELECT
  c.name        AS course,
  c.program,
  c.semester,
  p.full_name   AS professor,
  c.teacher_id  IS NOT NULL AS teacher_set,
  COUNT(ce.id)  AS enrolled_students
FROM course_teachers ct
JOIN courses           c  ON c.id = ct.course_id
JOIN profiles          p  ON p.id = ct.teacher_id
LEFT JOIN course_enrollments ce ON ce.course_id = c.id
WHERE p.full_name ILIKE '%Azaliia%'
GROUP BY c.name, c.program, c.semester, p.full_name, c.teacher_id
ORDER BY c.name;

-- B) Risk warnings with professor names
SELECT
  rw.status,
  s.full_name   AS student,
  c.name        AS course,
  p.full_name   AS professor,
  rw.grade_percentage,
  rw.missed_classes_count,
  rw.risk_reason
FROM risk_warnings rw
JOIN  students   s ON s.id = rw.student_id
JOIN  courses    c ON c.id = rw.course_id
LEFT JOIN profiles p ON p.id = rw.professor_id
ORDER BY rw.created_at DESC
LIMIT 30;

-- C) Sanity check: how many warnings still have NULL professor_id?
SELECT
  COUNT(*) FILTER (WHERE professor_id IS NULL) AS missing_professor,
  COUNT(*) FILTER (WHERE professor_id IS NOT NULL) AS has_professor,
  COUNT(*) AS total
FROM risk_warnings;
