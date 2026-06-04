-- ============================================================
-- Assign courses to Professor Azaliia Ibragimova
-- Run in Supabase SQL Editor
-- ============================================================

DO $$
DECLARE
  prof_id uuid;
  course_ids uuid[];
  cid uuid;
BEGIN
  -- Get professor's profile ID
  SELECT id INTO prof_id
  FROM profiles
  WHERE full_name ILIKE '%Azaliia Ibragimova%'
  LIMIT 1;

  IF prof_id IS NULL THEN
    RAISE EXCEPTION 'Professor "Azaliia Ibragimova" not found in profiles table.';
  END IF;

  RAISE NOTICE 'Found professor ID: %', prof_id;

  -- Get course IDs
  SELECT ARRAY(
    SELECT id FROM courses
    WHERE name ILIKE ANY(ARRAY[
      '%Macroeconomics%',
      '%Microeconomics%',
      '%Introduction to Business%',
      '%Financial Accounting%'
    ])
  ) INTO course_ids;

  IF array_length(course_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No matching courses found.';
  END IF;

  RAISE NOTICE 'Found % courses to assign.', array_length(course_ids, 1);

  -- Assign each course
  FOREACH cid IN ARRAY course_ids LOOP
    -- Add to course_teachers junction table
    INSERT INTO course_teachers (course_id, teacher_id)
    VALUES (cid, prof_id)
    ON CONFLICT DO NOTHING;

    -- Keep courses.teacher_id in sync
    UPDATE courses
    SET teacher_id = prof_id
    WHERE id = cid;
  END LOOP;

  RAISE NOTICE 'Done — courses assigned to Azaliia Ibragimova.';
END;
$$;


-- ── Verify ────────────────────────────────────────────────────

SELECT
  c.name,
  c.program,
  c.semester,
  p.full_name AS professor
FROM course_teachers ct
JOIN courses  c ON c.id = ct.course_id
JOIN profiles p ON p.id = ct.teacher_id
WHERE p.full_name ILIKE '%Azaliia Ibragimova%'
ORDER BY c.name;
