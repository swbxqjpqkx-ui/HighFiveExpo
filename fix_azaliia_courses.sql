-- ============================================================
-- Fix: Azaliia was assigned to all 75 courses — reset to 5 only
-- Run in Supabase SQL Editor
-- ============================================================

-- Step 1: Remove ALL course_teachers rows for Azaliia
DELETE FROM course_teachers
WHERE teacher_id = '0577d941-168f-444e-9903-9694c48ccebb';

-- Step 2: Clear teacher_id on every course that had Azaliia set
UPDATE courses
SET teacher_id = NULL
WHERE teacher_id = '0577d941-168f-444e-9903-9694c48ccebb';

-- Step 3: Re-assign only the correct 5 courses
INSERT INTO course_teachers (course_id, teacher_id) VALUES
  ('0800a378-81df-4646-b229-d56b39d59159', '0577d941-168f-444e-9903-9694c48ccebb'), -- Macroeconomics
  ('72581387-8364-46ba-8e2e-460c9b9d1782', '0577d941-168f-444e-9903-9694c48ccebb'), -- Microeconomics
  ('0436ede8-af11-40af-85bb-d7a0078eb7d3', '0577d941-168f-444e-9903-9694c48ccebb'), -- Financial Accounting
  ('a40bf07f-67b6-41bc-8525-3ea5fd8bf4be', '0577d941-168f-444e-9903-9694c48ccebb'), -- Business Mathematics
  ('a709e219-4b5d-40b1-a3be-d73c17504d02', '0577d941-168f-444e-9903-9694c48ccebb'); -- Introduction to Business

-- Step 4: Sync teacher_id on those 5 courses only
UPDATE courses
SET teacher_id = '0577d941-168f-444e-9903-9694c48ccebb'
WHERE id IN (
  '0800a378-81df-4646-b229-d56b39d59159',
  '72581387-8364-46ba-8e2e-460c9b9d1782',
  '0436ede8-af11-40af-85bb-d7a0078eb7d3',
  'a40bf07f-67b6-41bc-8525-3ea5fd8bf4be',
  'a709e219-4b5d-40b1-a3be-d73c17504d02'
);

-- Step 5: Verify — must return exactly 5 rows
SELECT c.name AS course, c.program, c.semester, COUNT(ce.id) AS students
FROM course_teachers ct
JOIN courses c ON c.id = ct.course_id
LEFT JOIN course_enrollments ce ON ce.course_id = c.id
WHERE ct.teacher_id = '0577d941-168f-444e-9903-9694c48ccebb'
GROUP BY c.name, c.program, c.semester
ORDER BY c.name;
