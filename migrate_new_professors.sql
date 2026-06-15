-- ============================================================
-- High Five — Add 2 New Professors (Riccardo & Letizia)
-- Run ONCE in Supabase SQL Editor. Safe to re-run (idempotent).
--
-- PRE-REQUISITE (do this FIRST, in the dashboard):
--   Supabase → Authentication → Users → "Add user"
--   Create BOTH auth users with "Auto Confirm User" checked:
--     1) riccardo.muneratti@gmail.com   password: SONOfrocio123
--     2) pozzaletizia@gmail.com         password: SONObella123
--   (The app has no sign-up screen, so accounts are made here —
--    exactly the same way the existing professor was created.)
--
-- This script then:
--   1. Links each auth user to a profiles row (role = 'professor')
--   2. Assigns each professor to their existing courses via
--      course_teachers (the source of truth) — ON CONFLICT DO NOTHING
--   3. Does NOT create/modify courses, students, enrollments,
--      RLS, or courses.teacher_id (existing professors untouched)
--   4. Prints verification at the end
-- ============================================================


-- ── PROFESSOR 1: Riccardo Munnerati ──────────────────────────
DO $$
DECLARE
  prof_id  uuid;
  cname    text;
  c_id     uuid;
  v_courses text[] := ARRAY[
    'Human Resource Management',
    'Hospitality Law and Ethics',
    'Event Management',
    'Resort Management'
  ];
BEGIN
  -- Resolve the auth user created in the dashboard
  SELECT id INTO prof_id FROM auth.users
  WHERE lower(email) = lower('riccardo.muneratti@gmail.com') LIMIT 1;

  IF prof_id IS NULL THEN
    RAISE EXCEPTION 'Auth user riccardo.muneratti@gmail.com not found. Create it in Authentication → Users (Auto Confirm) FIRST, then re-run.';
  END IF;

  -- Link / ensure the professor profile (role = professor, never admin)
  INSERT INTO profiles (id, full_name, role)
  VALUES (prof_id, 'Riccardo Munnerati', 'professor')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role      = 'professor';

  RAISE NOTICE 'Riccardo profile linked: %', prof_id;

  -- Assign his courses (existing records only; junction table is source of truth)
  FOREACH cname IN ARRAY v_courses LOOP
    SELECT id INTO c_id FROM courses WHERE name ILIKE cname LIMIT 1;
    IF c_id IS NULL THEN
      RAISE WARNING 'Course "%" not found — skipped (no course created).', cname;
      CONTINUE;
    END IF;
    INSERT INTO course_teachers (course_id, teacher_id)
    VALUES (c_id, prof_id)
    ON CONFLICT DO NOTHING;
    RAISE NOTICE '  ✓ Riccardo → %', cname;
  END LOOP;
END $$;


-- ── PROFESSOR 2: Letizia Pozza ───────────────────────────────
DO $$
DECLARE
  prof_id  uuid;
  cname    text;
  c_id     uuid;
  v_courses text[] := ARRAY[
    'Luxury Brand Management',
    'Rooms Division Management',
    'Digital Marketing Strategy',
    'Guest Experience Management',
    'Sustainable Hospitality'
  ];
BEGIN
  SELECT id INTO prof_id FROM auth.users
  WHERE lower(email) = lower('pozzaletizia@gmail.com') LIMIT 1;

  IF prof_id IS NULL THEN
    RAISE EXCEPTION 'Auth user pozzaletizia@gmail.com not found. Create it in Authentication → Users (Auto Confirm) FIRST, then re-run.';
  END IF;

  INSERT INTO profiles (id, full_name, role)
  VALUES (prof_id, 'Letizia Pozza', 'professor')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role      = 'professor';

  RAISE NOTICE 'Letizia profile linked: %', prof_id;

  FOREACH cname IN ARRAY v_courses LOOP
    SELECT id INTO c_id FROM courses WHERE name ILIKE cname LIMIT 1;
    IF c_id IS NULL THEN
      RAISE WARNING 'Course "%" not found — skipped (no course created).', cname;
      CONTINUE;
    END IF;
    INSERT INTO course_teachers (course_id, teacher_id)
    VALUES (c_id, prof_id)
    ON CONFLICT DO NOTHING;
    RAISE NOTICE '  ✓ Letizia → %', cname;
  END LOOP;
END $$;


-- ── VERIFICATION ─────────────────────────────────────────────
-- Each professor's courses + how many students are enrolled in each.
SELECT
  p.full_name              AS professor,
  u.email,
  p.role,
  c.name                   AS course,
  c.program,
  c.semester,
  COUNT(ce.id)             AS enrolled_students
FROM profiles p
JOIN auth.users u            ON u.id = p.id
JOIN course_teachers ct      ON ct.teacher_id = p.id
JOIN courses c               ON c.id = ct.course_id
LEFT JOIN course_enrollments ce ON ce.course_id = c.id
WHERE lower(u.email) IN ('riccardo.muneratti@gmail.com', 'pozzaletizia@gmail.com')
GROUP BY p.full_name, u.email, p.role, c.name, c.program, c.semester
ORDER BY p.full_name, c.name;
