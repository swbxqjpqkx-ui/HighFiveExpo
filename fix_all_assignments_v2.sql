-- ============================================================
-- High Five — Assignment & Enrollment Fix v2
-- Safe to run multiple times. Run in Supabase SQL Editor.
--
-- Fixes from v1:
--   • Uses WHERE NOT EXISTS for student inserts (no UNIQUE
--     constraint on students.email in the current schema)
--   • Enrollment DO block guards every student variable for NULL
--   • Separate verification at end to confirm all data is present
-- ============================================================


-- ── 1. is_admin_user() helper ────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator');
$$;


-- ── 2. Ensure courses.teacher_id column exists ────────────────
ALTER TABLE courses ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES profiles(id);


-- ── 3. Ensure course_teachers table + RLS ────────────────────
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


-- ── 4. Assign Azaliia Ibragimova to the 5 courses ────────────
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
  cname text;
BEGIN
  SELECT id INTO prof_id
  FROM profiles
  WHERE full_name ILIKE '%Azaliia%Ibragimova%'
  LIMIT 1;

  IF prof_id IS NULL THEN
    RAISE EXCEPTION 'Azaliia Ibragimova not found. Run: SELECT id, full_name, role FROM profiles;';
  END IF;

  -- Ensure role is professor
  UPDATE profiles SET role = 'professor'
  WHERE id = prof_id AND (role IS NULL OR role NOT IN ('professor','administrator'));

  RAISE NOTICE 'Professor id: %', prof_id;

  FOREACH cname IN ARRAY cnames LOOP
    SELECT id INTO cid FROM courses WHERE name ILIKE '%' || cname || '%' LIMIT 1;
    IF cid IS NULL THEN
      RAISE WARNING 'Course not found: %', cname;
      CONTINUE;
    END IF;
    UPDATE courses SET teacher_id = prof_id WHERE id = cid;
    INSERT INTO course_teachers (course_id, teacher_id) VALUES (cid, prof_id) ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Assigned % (id=%)', cname, cid;
  END LOOP;
END;
$$;


-- ── 5. Ensure skipped_classes column exists ───────────────────
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS skipped_classes integer NOT NULL DEFAULT 0;


-- ── 6. Create students (WHERE NOT EXISTS — no unique constraint needed) ──
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


-- ── 7. Enroll students across all 5 courses ───────────────────
DO $$
DECLARE
  c_macro   uuid; c_micro  uuid; c_finacc  uuid;
  c_bizmath uuid; c_intbiz uuid;
  s_sophie   uuid; s_luca    uuid; s_emma     uuid;
  s_james    uuid; s_maria   uuid; s_thomas   uuid;
  s_isabella uuid; s_oliver  uuid; s_amelia   uuid;
  s_noah     uuid; s_zara    uuid; s_felipe   uuid;
  s_yuki     uuid; s_leila   uuid; s_daniel   uuid;
BEGIN
  -- Resolve courses
  SELECT id INTO c_macro   FROM courses WHERE name ILIKE '%Macroeconomics%'           LIMIT 1;
  SELECT id INTO c_micro   FROM courses WHERE name ILIKE '%Microeconomics%'           LIMIT 1;
  SELECT id INTO c_finacc  FROM courses WHERE name ILIKE '%Financial Accounting%'     LIMIT 1;
  SELECT id INTO c_bizmath FROM courses WHERE name ILIKE '%Business Mathematics%'     LIMIT 1;
  SELECT id INTO c_intbiz  FROM courses WHERE name ILIKE '%Introduction to Business%' LIMIT 1;

  -- Resolve students
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

  RAISE NOTICE 'Resolved % courses and % students',
    (CASE WHEN c_macro IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN c_micro IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN c_finacc IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN c_bizmath IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN c_intbiz IS NOT NULL THEN 1 ELSE 0 END),
    (CASE WHEN s_sophie IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN s_luca   IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN s_emma   IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN s_james  IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN s_maria  IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN s_thomas IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN s_isabella IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN s_oliver IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN s_amelia IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN s_noah   IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN s_zara   IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN s_felipe IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN s_yuki   IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN s_leila  IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN s_daniel IS NOT NULL THEN 1 ELSE 0 END);

  -- MACROECONOMICS
  IF c_macro IS NOT NULL THEN
    IF s_sophie  IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_sophie, c_macro,72,1,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_luca    IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_luca,   c_macro,45,4,2) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_maria   IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_maria,  c_macro,55,2,1) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_oliver  IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_oliver, c_macro,51,1,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_noah    IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_noah,   c_macro,76,2,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_yuki    IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_yuki,   c_macro,72,0,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_daniel  IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_daniel, c_macro,79,0,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    RAISE NOTICE 'Macroeconomics enrollments done';
  END IF;

  -- MICROECONOMICS
  IF c_micro IS NOT NULL THEN
    IF s_sophie  IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_sophie, c_micro,68,2,1) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_emma    IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_emma,   c_micro,85,0,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_thomas  IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_thomas, c_micro,64,3,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_oliver  IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_oliver, c_micro,47,5,3) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_noah    IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_noah,   c_micro,69,1,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_felipe  IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_felipe, c_micro,83,0,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_daniel  IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_daniel, c_micro,65,2,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    RAISE NOTICE 'Microeconomics enrollments done';
  END IF;

  -- FINANCIAL ACCOUNTING
  IF c_finacc IS NOT NULL THEN
    IF s_james    IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_james,   c_finacc,91,0,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_maria    IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_maria,   c_finacc,71,1,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_isabella IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_isabella,c_finacc,77,2,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_amelia   IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_amelia,  c_finacc,88,0,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_zara     IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_zara,    c_finacc,58,4,2) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_leila    IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_leila,   c_finacc,42,3,1) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    RAISE NOTICE 'Financial Accounting enrollments done';
  END IF;

  -- BUSINESS MATHEMATICS
  IF c_bizmath IS NOT NULL THEN
    IF s_luca     IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_luca,    c_bizmath,73,1,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_james    IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_james,   c_bizmath,88,0,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_isabella IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_isabella,c_bizmath,82,1,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_noah     IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_noah,    c_bizmath,74,0,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_yuki     IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_yuki,    c_bizmath,67,1,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_daniel   IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_daniel,  c_bizmath,55,1,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    RAISE NOTICE 'Business Mathematics enrollments done';
  END IF;

  -- INTRODUCTION TO BUSINESS
  IF c_intbiz IS NOT NULL THEN
    IF s_emma    IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_emma,   c_intbiz,78,1,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_thomas  IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_thomas, c_intbiz,79,1,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_amelia  IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_amelia, c_intbiz,93,0,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_leila   IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_leila,  c_intbiz,88,0,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    IF s_felipe  IS NOT NULL THEN INSERT INTO course_enrollments (student_id,course_id,grade,missed_classes,skipped_classes) VALUES (s_felipe, c_intbiz,76,2,0) ON CONFLICT (student_id,course_id) DO UPDATE SET grade=EXCLUDED.grade,missed_classes=EXCLUDED.missed_classes,updated_at=now(); END IF;
    RAISE NOTICE 'Introduction to Business enrollments done';
  END IF;

  RAISE NOTICE '✓ All enrollments complete';
END;
$$;


-- ── 8. Backfill risk_warnings.professor_id ────────────────────
UPDATE risk_warnings rw
SET professor_id = c.teacher_id, updated_at = now()
FROM courses c
WHERE c.id = rw.course_id
  AND rw.professor_id IS NULL
  AND c.teacher_id IS NOT NULL;


-- ── 9. Verification — check these all look correct ────────────

-- A) Courses with professor and student count
SELECT
  c.name        AS course,
  c.program,
  c.semester,
  p.full_name   AS professor,
  COUNT(ce.id)  AS students
FROM courses c
LEFT JOIN profiles p ON p.id = c.teacher_id
LEFT JOIN course_enrollments ce ON ce.course_id = c.id
WHERE c.teacher_id IS NOT NULL
GROUP BY c.name, c.program, c.semester, p.full_name
ORDER BY c.name;

-- B) Sample enrollments
SELECT
  c.name        AS course,
  s.full_name   AS student,
  ce.grade,
  ce.missed_classes
FROM course_enrollments ce
JOIN courses  c ON c.id = ce.course_id
JOIN students s ON s.id = ce.student_id
WHERE c.teacher_id IS NOT NULL
ORDER BY c.name, ce.grade
LIMIT 40;

-- C) Risk warnings with professor names
SELECT
  s.full_name  AS student,
  c.name       AS course,
  p.full_name  AS professor,
  rw.status,
  rw.risk_reason
FROM risk_warnings rw
JOIN students s ON s.id = rw.student_id
JOIN courses  c ON c.id = rw.course_id
LEFT JOIN profiles p ON p.id = rw.professor_id
ORDER BY rw.created_at DESC
LIMIT 20;
