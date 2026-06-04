-- ============================================================
-- High Five — Azaliia Ibragimova Final Migration (exact UUIDs)
-- Run in Supabase SQL Editor
--
-- Professor : Azaliia Ibragimova  0577d941-168f-444e-9903-9694c48ccebb
-- Courses   : exact IDs from courses table
-- ============================================================

-- ── 0. Constants ──────────────────────────────────────────────
DO $$
DECLARE
  prof_id  uuid := '0577d941-168f-444e-9903-9694c48ccebb';

  c_macro   uuid := '0800a378-81df-4646-b229-d56b39d59159'; -- Macroeconomics        BA Sem 2
  c_micro   uuid := '72581387-8364-46ba-8e2e-460c9b9d1782'; -- Microeconomics         BA Sem 1
  c_finacc  uuid := '0436ede8-af11-40af-85bb-d7a0078eb7d3'; -- Financial Accounting   BA Sem 2
  c_bizmath uuid := 'a40bf07f-67b6-41bc-8525-3ea5fd8bf4be'; -- Business Mathematics   BA Sem 1
  c_intbiz  uuid := 'a709e219-4b5d-40b1-a3be-d73c17504d02'; -- Introduction to Business BA Sem 1

  -- Students (resolved after insert)
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

  -- ── 1. Assign Azaliia to all 5 courses ──────────────────────
  -- course_teachers is the source of truth
  INSERT INTO course_teachers (course_id, teacher_id) VALUES
    (c_macro,   prof_id),
    (c_micro,   prof_id),
    (c_finacc,  prof_id),
    (c_bizmath, prof_id),
    (c_intbiz,  prof_id)
  ON CONFLICT DO NOTHING;

  -- Keep courses.teacher_id in sync (used by risk detection)
  UPDATE courses SET teacher_id = prof_id
  WHERE id IN (c_macro, c_micro, c_finacc, c_bizmath, c_intbiz);

  RAISE NOTICE '✓ Azaliia assigned to 5 courses';

  -- ── 2. Add skipped_classes column if missing ─────────────────
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS skipped_classes integer NOT NULL DEFAULT 0;

  -- ── 3. Create 15 students (safe to re-run) ───────────────────
  INSERT INTO students (full_name, email) VALUES ('Sophie Laurent',   'sophie.laurent@student.edu')   ON CONFLICT DO NOTHING;
  INSERT INTO students (full_name, email) VALUES ('Luca Bianchi',     'luca.bianchi@student.edu')     ON CONFLICT DO NOTHING;
  INSERT INTO students (full_name, email) VALUES ('Emma Wilson',      'emma.wilson@student.edu')      ON CONFLICT DO NOTHING;
  INSERT INTO students (full_name, email) VALUES ('James Chen',       'james.chen@student.edu')       ON CONFLICT DO NOTHING;
  INSERT INTO students (full_name, email) VALUES ('Maria Rodriguez',  'maria.rodriguez@student.edu')  ON CONFLICT DO NOTHING;
  INSERT INTO students (full_name, email) VALUES ('Thomas Müller',    'thomas.muller@student.edu')    ON CONFLICT DO NOTHING;
  INSERT INTO students (full_name, email) VALUES ('Isabella Santos',  'isabella.santos@student.edu')  ON CONFLICT DO NOTHING;
  INSERT INTO students (full_name, email) VALUES ('Oliver Johansson', 'oliver.johansson@student.edu') ON CONFLICT DO NOTHING;
  INSERT INTO students (full_name, email) VALUES ('Amelia Kowalski',  'amelia.kowalski@student.edu')  ON CONFLICT DO NOTHING;
  INSERT INTO students (full_name, email) VALUES ('Noah Williams',    'noah.williams@student.edu')    ON CONFLICT DO NOTHING;
  INSERT INTO students (full_name, email) VALUES ('Zara Ahmed',       'zara.ahmed@student.edu')       ON CONFLICT DO NOTHING;
  INSERT INTO students (full_name, email) VALUES ('Felipe García',    'felipe.garcia@student.edu')    ON CONFLICT DO NOTHING;
  INSERT INTO students (full_name, email) VALUES ('Yuki Tanaka',      'yuki.tanaka@student.edu')      ON CONFLICT DO NOTHING;
  INSERT INTO students (full_name, email) VALUES ('Leila Moreira',    'leila.moreira@student.edu')    ON CONFLICT DO NOTHING;
  INSERT INTO students (full_name, email) VALUES ('Daniel Kim',       'daniel.kim@student.edu')       ON CONFLICT DO NOTHING;

  RAISE NOTICE '✓ Students created';

  -- Resolve student IDs
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

  -- ── 4. Enroll students with grades + absences ────────────────
  -- Risk limits: grade < 60 = at risk  |  missed_classes >= 3 = at risk
  -- AT RISK rows are commented

  -- MACROECONOMICS
  INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes) VALUES
    (s_sophie,  c_macro, 72, 1, 0),
    (s_luca,    c_macro, 45, 4, 2),   -- AT RISK: grade + absence
    (s_maria,   c_macro, 55, 2, 1),   -- AT RISK: grade
    (s_oliver,  c_macro, 51, 1, 0),   -- AT RISK: grade
    (s_noah,    c_macro, 76, 2, 0),
    (s_yuki,    c_macro, 72, 0, 0),
    (s_daniel,  c_macro, 79, 0, 0)
  ON CONFLICT (student_id, course_id) DO UPDATE SET
    grade = EXCLUDED.grade, missed_classes = EXCLUDED.missed_classes,
    skipped_classes = EXCLUDED.skipped_classes, updated_at = now();

  -- MICROECONOMICS
  INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes) VALUES
    (s_sophie,  c_micro, 68, 2, 1),
    (s_emma,    c_micro, 85, 0, 0),
    (s_thomas,  c_micro, 64, 3, 0),   -- AT RISK: absence
    (s_oliver,  c_micro, 47, 5, 3),   -- AT RISK: grade + absence
    (s_noah,    c_micro, 69, 1, 0),
    (s_felipe,  c_micro, 83, 0, 0),
    (s_daniel,  c_micro, 65, 2, 0)
  ON CONFLICT (student_id, course_id) DO UPDATE SET
    grade = EXCLUDED.grade, missed_classes = EXCLUDED.missed_classes,
    skipped_classes = EXCLUDED.skipped_classes, updated_at = now();

  -- FINANCIAL ACCOUNTING
  INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes) VALUES
    (s_james,    c_finacc, 91, 0, 0),
    (s_maria,    c_finacc, 71, 1, 0),
    (s_isabella, c_finacc, 77, 2, 0),
    (s_amelia,   c_finacc, 88, 0, 0),
    (s_zara,     c_finacc, 58, 4, 2),  -- AT RISK: grade + absence
    (s_leila,    c_finacc, 42, 3, 1)   -- AT RISK: grade + absence
  ON CONFLICT (student_id, course_id) DO UPDATE SET
    grade = EXCLUDED.grade, missed_classes = EXCLUDED.missed_classes,
    skipped_classes = EXCLUDED.skipped_classes, updated_at = now();

  -- BUSINESS MATHEMATICS
  INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes) VALUES
    (s_luca,     c_bizmath, 73, 1, 0),
    (s_james,    c_bizmath, 88, 0, 0),
    (s_isabella, c_bizmath, 82, 1, 0),
    (s_noah,     c_bizmath, 74, 0, 0),
    (s_yuki,     c_bizmath, 67, 1, 0),
    (s_daniel,   c_bizmath, 55, 1, 0)  -- AT RISK: grade
  ON CONFLICT (student_id, course_id) DO UPDATE SET
    grade = EXCLUDED.grade, missed_classes = EXCLUDED.missed_classes,
    skipped_classes = EXCLUDED.skipped_classes, updated_at = now();

  -- INTRODUCTION TO BUSINESS
  INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes, skipped_classes) VALUES
    (s_emma,    c_intbiz, 78, 1, 0),
    (s_thomas,  c_intbiz, 79, 1, 0),
    (s_amelia,  c_intbiz, 93, 0, 0),
    (s_leila,   c_intbiz, 88, 0, 0),
    (s_felipe,  c_intbiz, 76, 2, 0)
  ON CONFLICT (student_id, course_id) DO UPDATE SET
    grade = EXCLUDED.grade, missed_classes = EXCLUDED.missed_classes,
    skipped_classes = EXCLUDED.skipped_classes, updated_at = now();

  RAISE NOTICE '✓ All enrollments inserted';

END;
$$;


-- ── 5. Verify ─────────────────────────────────────────────────

SELECT
  c.name              AS course,
  c.program,
  c.semester,
  COUNT(ce.id)        AS students,
  ROUND(AVG(ce.grade)) AS avg_grade
FROM course_teachers ct
JOIN courses            c  ON c.id  = ct.course_id
LEFT JOIN course_enrollments ce ON ce.course_id = c.id
WHERE ct.teacher_id = '0577d941-168f-444e-9903-9694c48ccebb'
GROUP BY c.name, c.program, c.semester
ORDER BY c.name;
