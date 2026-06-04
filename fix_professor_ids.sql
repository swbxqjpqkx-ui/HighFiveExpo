-- ============================================================
-- Fix: Backfill professor_id on risk_warnings
-- Safe to run multiple times — only updates NULL rows.
-- Run in Supabase SQL Editor.
-- ============================================================

-- Step 1: Sync courses.teacher_id from course_teachers
--         (no-op if already set, only fills NULLs)
UPDATE courses c
SET teacher_id = ct.teacher_id
FROM course_teachers ct
WHERE ct.course_id = c.id
  AND c.teacher_id IS NULL;

-- Step 2: Backfill risk_warnings.professor_id from courses.teacher_id
--         Only touches rows where professor_id is currently NULL
UPDATE risk_warnings rw
SET professor_id = c.teacher_id,
    updated_at   = now()
FROM courses c
WHERE c.id = rw.course_id
  AND rw.professor_id IS NULL
  AND c.teacher_id IS NOT NULL;

-- Step 3: Verify — every warning should now have a professor name
SELECT
  rw.status,
  rw.risk_reason,
  s.full_name  AS student,
  c.name       AS course,
  p.full_name  AS professor,
  rw.professor_id
FROM risk_warnings rw
JOIN  courses  c ON c.id = rw.course_id
JOIN  students s ON s.id = rw.student_id
LEFT JOIN profiles p ON p.id = rw.professor_id
ORDER BY rw.created_at DESC;
