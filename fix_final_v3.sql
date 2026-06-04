-- ============================================================
-- High Five — Final Fix v3
-- NO DO blocks. NO ON CONFLICT. NO optional columns.
-- Each statement is independent and safe to re-run.
-- Run in Supabase SQL Editor.
-- ============================================================


-- ── STEP 1: Ensure teacher_id column exists on courses ────────
ALTER TABLE courses ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES profiles(id);


-- ── STEP 2: Ensure course_teachers table exists ───────────────
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


-- ── STEP 3: Set teacher_id on the 5 courses ───────────────────
-- (uses a subquery — no variable needed)
UPDATE courses
SET teacher_id = (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%Ibragimova%' LIMIT 1)
WHERE name ILIKE '%Macroeconomics%'
  AND (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%Ibragimova%' LIMIT 1) IS NOT NULL;

UPDATE courses
SET teacher_id = (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%Ibragimova%' LIMIT 1)
WHERE name ILIKE '%Microeconomics%'
  AND (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%Ibragimova%' LIMIT 1) IS NOT NULL;

UPDATE courses
SET teacher_id = (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%Ibragimova%' LIMIT 1)
WHERE name ILIKE '%Financial Accounting%'
  AND (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%Ibragimova%' LIMIT 1) IS NOT NULL;

UPDATE courses
SET teacher_id = (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%Ibragimova%' LIMIT 1)
WHERE name ILIKE '%Business Mathematics%'
  AND (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%Ibragimova%' LIMIT 1) IS NOT NULL;

UPDATE courses
SET teacher_id = (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%Ibragimova%' LIMIT 1)
WHERE name ILIKE '%Introduction to Business%'
  AND (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%Ibragimova%' LIMIT 1) IS NOT NULL;


-- ── STEP 4: Populate course_teachers junction ─────────────────
INSERT INTO course_teachers (course_id, teacher_id)
SELECT c.id, p.id
FROM courses c, profiles p
WHERE c.name ILIKE '%Macroeconomics%'
  AND p.full_name ILIKE '%Azaliia%Ibragimova%'
  AND NOT EXISTS (SELECT 1 FROM course_teachers ct WHERE ct.course_id = c.id AND ct.teacher_id = p.id);

INSERT INTO course_teachers (course_id, teacher_id)
SELECT c.id, p.id
FROM courses c, profiles p
WHERE c.name ILIKE '%Microeconomics%'
  AND p.full_name ILIKE '%Azaliia%Ibragimova%'
  AND NOT EXISTS (SELECT 1 FROM course_teachers ct WHERE ct.course_id = c.id AND ct.teacher_id = p.id);

INSERT INTO course_teachers (course_id, teacher_id)
SELECT c.id, p.id
FROM courses c, profiles p
WHERE c.name ILIKE '%Financial Accounting%'
  AND p.full_name ILIKE '%Azaliia%Ibragimova%'
  AND NOT EXISTS (SELECT 1 FROM course_teachers ct WHERE ct.course_id = c.id AND ct.teacher_id = p.id);

INSERT INTO course_teachers (course_id, teacher_id)
SELECT c.id, p.id
FROM courses c, profiles p
WHERE c.name ILIKE '%Business Mathematics%'
  AND p.full_name ILIKE '%Azaliia%Ibragimova%'
  AND NOT EXISTS (SELECT 1 FROM course_teachers ct WHERE ct.course_id = c.id AND ct.teacher_id = p.id);

INSERT INTO course_teachers (course_id, teacher_id)
SELECT c.id, p.id
FROM courses c, profiles p
WHERE c.name ILIKE '%Introduction to Business%'
  AND p.full_name ILIKE '%Azaliia%Ibragimova%'
  AND NOT EXISTS (SELECT 1 FROM course_teachers ct WHERE ct.course_id = c.id AND ct.teacher_id = p.id);


-- ── STEP 5: Create students ───────────────────────────────────
INSERT INTO students (full_name, email) SELECT 'Sophie Laurent',    'sophie.laurent@student.edu'    WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'sophie.laurent@student.edu');
INSERT INTO students (full_name, email) SELECT 'Luca Bianchi',      'luca.bianchi@student.edu'      WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'luca.bianchi@student.edu');
INSERT INTO students (full_name, email) SELECT 'Emma Wilson',       'emma.wilson@student.edu'       WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'emma.wilson@student.edu');
INSERT INTO students (full_name, email) SELECT 'James Chen',        'james.chen@student.edu'        WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'james.chen@student.edu');
INSERT INTO students (full_name, email) SELECT 'Maria Rodriguez',   'maria.rodriguez@student.edu'   WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'maria.rodriguez@student.edu');
INSERT INTO students (full_name, email) SELECT 'Thomas Müller',     'thomas.muller@student.edu'     WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'thomas.muller@student.edu');
INSERT INTO students (full_name, email) SELECT 'Isabella Santos',   'isabella.santos@student.edu'   WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'isabella.santos@student.edu');
INSERT INTO students (full_name, email) SELECT 'Oliver Johansson',  'oliver.johansson@student.edu'  WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'oliver.johansson@student.edu');
INSERT INTO students (full_name, email) SELECT 'Amelia Kowalski',   'amelia.kowalski@student.edu'   WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'amelia.kowalski@student.edu');
INSERT INTO students (full_name, email) SELECT 'Noah Williams',     'noah.williams@student.edu'     WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'noah.williams@student.edu');
INSERT INTO students (full_name, email) SELECT 'Zara Ahmed',        'zara.ahmed@student.edu'        WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'zara.ahmed@student.edu');
INSERT INTO students (full_name, email) SELECT 'Felipe García',     'felipe.garcia@student.edu'     WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'felipe.garcia@student.edu');
INSERT INTO students (full_name, email) SELECT 'Yuki Tanaka',       'yuki.tanaka@student.edu'       WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'yuki.tanaka@student.edu');
INSERT INTO students (full_name, email) SELECT 'Leila Moreira',     'leila.moreira@student.edu'     WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'leila.moreira@student.edu');
INSERT INTO students (full_name, email) SELECT 'Daniel Kim',        'daniel.kim@student.edu'        WHERE NOT EXISTS (SELECT 1 FROM students WHERE email = 'daniel.kim@student.edu');


-- ── STEP 6: Enroll students ───────────────────────────────────
-- Uses WHERE NOT EXISTS — no UNIQUE constraint required.
-- Only inserts grade + missed_classes (guaranteed columns).

-- MACROECONOMICS
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 72, 1 FROM students s, courses c WHERE s.email='sophie.laurent@student.edu'   AND c.name ILIKE '%Macroeconomics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 45, 4 FROM students s, courses c WHERE s.email='luca.bianchi@student.edu'     AND c.name ILIKE '%Macroeconomics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 55, 2 FROM students s, courses c WHERE s.email='maria.rodriguez@student.edu'  AND c.name ILIKE '%Macroeconomics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 51, 1 FROM students s, courses c WHERE s.email='oliver.johansson@student.edu' AND c.name ILIKE '%Macroeconomics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 76, 2 FROM students s, courses c WHERE s.email='noah.williams@student.edu'    AND c.name ILIKE '%Macroeconomics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 72, 0 FROM students s, courses c WHERE s.email='yuki.tanaka@student.edu'      AND c.name ILIKE '%Macroeconomics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 79, 0 FROM students s, courses c WHERE s.email='daniel.kim@student.edu'       AND c.name ILIKE '%Macroeconomics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);

-- MICROECONOMICS
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 68, 2 FROM students s, courses c WHERE s.email='sophie.laurent@student.edu'   AND c.name ILIKE '%Microeconomics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 85, 0 FROM students s, courses c WHERE s.email='emma.wilson@student.edu'      AND c.name ILIKE '%Microeconomics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 64, 3 FROM students s, courses c WHERE s.email='thomas.muller@student.edu'    AND c.name ILIKE '%Microeconomics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 47, 5 FROM students s, courses c WHERE s.email='oliver.johansson@student.edu' AND c.name ILIKE '%Microeconomics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 69, 1 FROM students s, courses c WHERE s.email='noah.williams@student.edu'    AND c.name ILIKE '%Microeconomics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 83, 0 FROM students s, courses c WHERE s.email='felipe.garcia@student.edu'    AND c.name ILIKE '%Microeconomics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 65, 2 FROM students s, courses c WHERE s.email='daniel.kim@student.edu'       AND c.name ILIKE '%Microeconomics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);

-- FINANCIAL ACCOUNTING
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 91, 0 FROM students s, courses c WHERE s.email='james.chen@student.edu'       AND c.name ILIKE '%Financial Accounting%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 71, 1 FROM students s, courses c WHERE s.email='maria.rodriguez@student.edu'  AND c.name ILIKE '%Financial Accounting%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 77, 2 FROM students s, courses c WHERE s.email='isabella.santos@student.edu'  AND c.name ILIKE '%Financial Accounting%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 88, 0 FROM students s, courses c WHERE s.email='amelia.kowalski@student.edu'  AND c.name ILIKE '%Financial Accounting%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 58, 4 FROM students s, courses c WHERE s.email='zara.ahmed@student.edu'       AND c.name ILIKE '%Financial Accounting%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 42, 3 FROM students s, courses c WHERE s.email='leila.moreira@student.edu'    AND c.name ILIKE '%Financial Accounting%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);

-- BUSINESS MATHEMATICS
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 73, 1 FROM students s, courses c WHERE s.email='luca.bianchi@student.edu'     AND c.name ILIKE '%Business Mathematics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 88, 0 FROM students s, courses c WHERE s.email='james.chen@student.edu'       AND c.name ILIKE '%Business Mathematics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 82, 1 FROM students s, courses c WHERE s.email='isabella.santos@student.edu'  AND c.name ILIKE '%Business Mathematics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 74, 0 FROM students s, courses c WHERE s.email='noah.williams@student.edu'    AND c.name ILIKE '%Business Mathematics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 67, 1 FROM students s, courses c WHERE s.email='yuki.tanaka@student.edu'      AND c.name ILIKE '%Business Mathematics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 55, 1 FROM students s, courses c WHERE s.email='daniel.kim@student.edu'       AND c.name ILIKE '%Business Mathematics%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);

-- INTRODUCTION TO BUSINESS
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 78, 1 FROM students s, courses c WHERE s.email='emma.wilson@student.edu'      AND c.name ILIKE '%Introduction to Business%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 79, 1 FROM students s, courses c WHERE s.email='thomas.muller@student.edu'    AND c.name ILIKE '%Introduction to Business%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 93, 0 FROM students s, courses c WHERE s.email='amelia.kowalski@student.edu'  AND c.name ILIKE '%Introduction to Business%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 88, 0 FROM students s, courses c WHERE s.email='leila.moreira@student.edu'    AND c.name ILIKE '%Introduction to Business%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);
INSERT INTO course_enrollments (student_id, course_id, grade, missed_classes)
SELECT s.id, c.id, 76, 2 FROM students s, courses c WHERE s.email='felipe.garcia@student.edu'    AND c.name ILIKE '%Introduction to Business%' AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.student_id=s.id AND e.course_id=c.id);


-- ── STEP 7: Backfill risk_warnings.professor_id ───────────────
UPDATE risk_warnings rw
SET professor_id = c.teacher_id
FROM courses c
WHERE c.id = rw.course_id
  AND rw.professor_id IS NULL
  AND c.teacher_id IS NOT NULL;


-- ── VERIFICATION: Run these and confirm the numbers ───────────
SELECT 'Azaliia profile' AS check, id, full_name, role FROM profiles WHERE full_name ILIKE '%Azaliia%';
SELECT 'Courses assigned' AS check, COUNT(*) FROM courses WHERE teacher_id = (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%' LIMIT 1);
SELECT 'Students total' AS check, COUNT(*) FROM students;
SELECT 'Enrollments total' AS check, COUNT(*) FROM course_enrollments;
SELECT 'Enrollments in Azaliia courses' AS check, COUNT(*)
FROM course_enrollments ce
JOIN courses c ON c.id = ce.course_id
WHERE c.teacher_id = (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%' LIMIT 1);
