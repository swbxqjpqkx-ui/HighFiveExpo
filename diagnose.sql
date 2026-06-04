-- ============================================================
-- DIAGNOSTIC — Run this in Supabase SQL Editor and share the output
-- ============================================================

-- 1. Azaliia's profile
SELECT id, full_name, role FROM profiles WHERE full_name ILIKE '%Azaliia%';

-- 2. How many courses exist, and how many have teacher_id set
SELECT
  COUNT(*)                                          AS total_courses,
  COUNT(*) FILTER (WHERE teacher_id IS NOT NULL)   AS courses_with_teacher
FROM courses;

-- 3. Azaliia's courses via courses.teacher_id
SELECT id, name, program, semester, teacher_id
FROM courses
WHERE teacher_id = (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%' LIMIT 1);

-- 4. Azaliia's courses via course_teachers junction
SELECT ct.course_id, c.name, ct.teacher_id
FROM course_teachers ct
JOIN courses c ON c.id = ct.course_id
WHERE ct.teacher_id = (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%' LIMIT 1);

-- 5. How many students and enrollments exist
SELECT COUNT(*) AS total_students FROM students;
SELECT COUNT(*) AS total_enrollments FROM course_enrollments;

-- 6. Enrollments for Azaliia's courses specifically
SELECT c.name AS course, COUNT(ce.id) AS enrolled_students
FROM courses c
LEFT JOIN course_enrollments ce ON ce.course_id = c.id
WHERE c.teacher_id = (SELECT id FROM profiles WHERE full_name ILIKE '%Azaliia%' LIMIT 1)
GROUP BY c.name
ORDER BY c.name;

-- 7. Columns that actually exist in course_enrollments
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'course_enrollments'
ORDER BY ordinal_position;

-- 8. Unique constraints on course_enrollments
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'course_enrollments'::regclass;
