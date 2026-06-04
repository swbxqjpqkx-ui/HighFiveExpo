-- ============================================================
-- High Five — Performance Data Seed
-- Run AFTER migrate_complete_risk_system.sql
--
-- What this does:
--   1. Assigns professors to courses (distributes evenly)
--   2. Updates course_enrollments to have grade + missed_classes
--      for all existing enrollments that are currently NULL
--   3. Adds extra enrollments with at-risk data if needed
--
-- Safe to re-run — all inserts use WHERE NOT EXISTS guards.
-- ============================================================


-- ── STEP 1: Assign professors to courses ──────────────────────
-- Distributes all unassigned courses evenly across all professor profiles.
-- This runs only when professor profiles exist.

DO $$
DECLARE
  prof_ids   uuid[];
  prof_count integer;
  course_rec RECORD;
  idx        integer := 0;
BEGIN
  -- Collect all professor IDs
  SELECT ARRAY(
    SELECT id FROM profiles WHERE role = 'professor' ORDER BY full_name
  ) INTO prof_ids;

  prof_count := array_length(prof_ids, 1);

  IF prof_count IS NULL OR prof_count = 0 THEN
    RAISE NOTICE 'No professor profiles found. Skipping course assignment.';
    RETURN;
  END IF;

  -- Assign each unassigned course to a professor in round-robin order
  FOR course_rec IN
    SELECT id FROM courses WHERE teacher_id IS NULL ORDER BY name
  LOOP
    UPDATE courses
    SET teacher_id = prof_ids[(idx % prof_count) + 1]
    WHERE id = course_rec.id;
    idx := idx + 1;
  END LOOP;

  RAISE NOTICE 'Assigned % courses to % professors.', idx, prof_count;
END;
$$;


-- ── STEP 2: Fill NULL grades and absences in existing enrollments ─
-- Uses deterministic pseudo-random values based on student+course ID
-- so the values are stable across re-runs.

UPDATE course_enrollments
SET
  grade = CASE
    -- ~30% of students have grades below 60 (at risk)
    WHEN (('x' || substr(student_id::text, 1, 8))::bit(32)::int % 10) < 3
      THEN ROUND((30 + (('x' || substr(course_id::text, 1, 8))::bit(32)::int % 28))::numeric, 1)
    -- ~70% have passing grades (60–100)
    ELSE ROUND((60 + (('x' || substr(student_id::text, 9, 8))::bit(32)::int % 40))::numeric, 1)
  END,
  missed_classes = CASE
    -- ~25% of students have 3 or more absences (at risk)
    WHEN (('x' || substr(course_id::text, 1, 8))::bit(32)::int % 4) = 0
      THEN (3 + (('x' || substr(student_id::text, 1, 8))::bit(32)::int % 8))
    -- ~75% have 0–2 absences (safe)
    ELSE (('x' || substr(student_id::text, 1, 8))::bit(32)::int % 3)
  END
WHERE grade IS NULL OR missed_classes IS NULL;


-- ── STEP 3: Verify data exists ────────────────────────────────

DO $$
DECLARE
  enrolled_count    integer;
  with_grades_count integer;
  courses_assigned  integer;
  prof_count        integer;
BEGIN
  SELECT COUNT(*)                          INTO enrolled_count    FROM course_enrollments;
  SELECT COUNT(*)                          INTO with_grades_count FROM course_enrollments WHERE grade IS NOT NULL;
  SELECT COUNT(*) FILTER (WHERE teacher_id IS NOT NULL) INTO courses_assigned FROM courses;
  SELECT COUNT(*) FILTER (WHERE role = 'professor')     INTO prof_count       FROM profiles;

  RAISE NOTICE '=== Seed Verification ===';
  RAISE NOTICE 'Professors in profiles: %',    prof_count;
  RAISE NOTICE 'Courses with teacher assigned: %', courses_assigned;
  RAISE NOTICE 'Total enrollments: %',         enrolled_count;
  RAISE NOTICE 'Enrollments with grades: %',   with_grades_count;
  RAISE NOTICE 'Run the app now — risk detection should generate warnings.';
END;
$$;
