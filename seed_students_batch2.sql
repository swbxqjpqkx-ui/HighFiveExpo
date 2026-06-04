-- ============================================================
-- Seed Batch 2: 60 Students enrolled in
--   • Introduction to Business
--   • Financial Accounting
--   • Business Mathematics
-- Safe to re-run — WHERE NOT EXISTS guards throughout
-- ============================================================


-- ─── STEP 1: Ensure the 3 courses exist ─────────────────────

INSERT INTO courses (id, name, program, semester)
SELECT gen_random_uuid(), v.name, v.program, v.semester
FROM (VALUES
  ('Introduction to Business', 'Business Administration', 'Semester 1'),
  ('Financial Accounting',     'Business Administration', 'Semester 1'),
  ('Business Mathematics',     'Business Administration', 'Semester 1')
) AS v(name, program, semester)
WHERE NOT EXISTS (
  SELECT 1 FROM courses c WHERE c.name = v.name
);

-- Assign teacher to any of those 3 that have no teacher yet
UPDATE courses
SET teacher_id = '0577d941-168f-444e-9903-9694c48ccebb'
WHERE name IN ('Introduction to Business','Financial Accounting','Business Mathematics')
  AND teacher_id IS NULL;


-- ─── STEP 2: Insert new students (skip existing) ────────────

INSERT INTO students (id, full_name, email)
SELECT gen_random_uuid(), v.full_name, v.email
FROM (VALUES
  ('Adam Keller',        'adam.keller@students.edu'),
  ('Sofia Romano',       'sofia.romano@students.edu'),
  ('Daniel Novak',       'daniel.novak@students.edu'),
  ('Emma Laurent',       'emma.laurent@students.edu'),
  ('Lucas Weber',        'lucas.weber@students.edu'),
  ('Mia Schneider',      'mia.schneider@students.edu'),
  ('Oliver Bennett',     'oliver.bennett@students.edu'),
  ('Isabella Rossi',     'isabella.rossi@students.edu'),
  ('Noah Müller',        'noah.muller@students.edu'),
  ('Ava Petrova',        'ava.petrova@students.edu'),
  ('Liam Dubois',        'liam.dubois@students.edu'),
  ('Chloe Martin',       'chloe.martin@students.edu'),
  ('Ethan Silva',        'ethan.silva@students.edu'),
  ('Amelia Fischer',     'amelia.fischer@students.edu'),
  ('James Ivanov',       'james.ivanov@students.edu'),
  ('Harper Collins',     'harper.collins@students.edu'),
  ('Benjamin Meyer',     'benjamin.meyer@students.edu'),
  ('Ella Smith',         'ella.smith@students.edu'),
  ('Alexander Brown',    'alexander.brown@students.edu'),
  ('Grace Wilson',       'grace.wilson@students.edu'),
  ('Henry Anderson',     'henry.anderson@students.edu'),
  ('Lily Thompson',      'lily.thompson@students.edu'),
  ('Samuel Garcia',      'samuel.garcia@students.edu'),
  ('Victoria Lee',       'victoria.lee@students.edu'),
  ('Michael Carter',     'michael.carter@students.edu'),
  ('Aria Johnson',       'aria.johnson@students.edu'),
  ('David Clark',        'david.clark@students.edu'),
  ('Emily Walker',       'emily.walker@students.edu'),
  ('Joseph Hall',        'joseph.hall@students.edu'),
  ('Scarlett Young',     'scarlett.young@students.edu'),
  ('Matthew King',       'matthew.king@students.edu'),
  ('Hannah Scott',       'hannah.scott@students.edu'),
  ('Christopher Green',  'christopher.green@students.edu'),
  ('Zoe Adams',          'zoe.adams@students.edu'),
  ('Andrew Baker',       'andrew.baker@students.edu'),
  ('Natalie Nelson',     'natalie.nelson@students.edu'),
  ('Ryan Hill',          'ryan.hill@students.edu'),
  ('Stella Mitchell',    'stella.mitchell@students.edu'),
  ('Nathan Perez',       'nathan.perez@students.edu'),
  ('Maya Roberts',       'maya.roberts@students.edu'),
  ('Jack Turner',        'jack.turner@students.edu'),
  ('Elena Phillips',     'elena.phillips@students.edu'),
  ('Thomas Campbell',    'thomas.campbell@students.edu'),
  ('Nora Parker',        'nora.parker@students.edu'),
  ('William Evans',      'william.evans@students.edu'),
  ('Layla Edwards',      'layla.edwards@students.edu'),
  ('George Morris',      'george.morris@students.edu'),
  ('Mila Rogers',        'mila.rogers@students.edu'),
  ('Leo Reed',           'leo.reed@students.edu'),
  ('Sophie Cook',        'sophie.cook@students.edu'),
  ('Oscar Bell',         'oscar.bell@students.edu'),
  ('Clara Murphy',       'clara.murphy@students.edu'),
  ('Max Bailey',         'max.bailey@students.edu'),
  ('Julia Rivera',       'julia.rivera@students.edu'),
  ('Sebastian Cooper',   'sebastian.cooper@students.edu'),
  ('Alice Richardson',   'alice.richardson@students.edu'),
  ('Gabriel Cox',        'gabriel.cox@students.edu'),
  ('Lina Howard',        'lina.howard@students.edu'),
  ('Patrick Ward',       'patrick.ward@students.edu'),
  ('Eva Brooks',         'eva.brooks@students.edu')
) AS v(full_name, email)
WHERE NOT EXISTS (
  SELECT 1 FROM students s WHERE s.full_name = v.full_name
);


-- ─── STEP 3: Insert enrollments ─────────────────────────────

INSERT INTO course_enrollments (id, student_id, course_id, grade, missed_classes)
SELECT gen_random_uuid(), s.id, c.id, e.grade, e.missed
FROM (VALUES
  -- 1 Adam Keller
  ('Adam Keller','Introduction to Business',84,2),
  ('Adam Keller','Financial Accounting',84,2),
  ('Adam Keller','Business Mathematics',84,2),
  -- 2 Sofia Romano
  ('Sofia Romano','Introduction to Business',76,4),
  ('Sofia Romano','Financial Accounting',76,4),
  -- 3 Daniel Novak
  ('Daniel Novak','Business Mathematics',69,6),
  ('Daniel Novak','Financial Accounting',69,6),
  -- 4 Emma Laurent
  ('Emma Laurent','Introduction to Business',91,1),
  ('Emma Laurent','Business Mathematics',91,1),
  -- 5 Lucas Weber
  ('Lucas Weber','Introduction to Business',88,0),
  ('Lucas Weber','Financial Accounting',88,0),
  ('Lucas Weber','Business Mathematics',88,0),
  -- 6 Mia Schneider
  ('Mia Schneider','Financial Accounting',73,5),
  ('Mia Schneider','Business Mathematics',73,5),
  -- 7 Oliver Bennett
  ('Oliver Bennett','Introduction to Business',81,3),
  ('Oliver Bennett','Business Mathematics',81,3),
  -- 8 Isabella Rossi
  ('Isabella Rossi','Introduction to Business',79,2),
  ('Isabella Rossi','Financial Accounting',79,2),
  -- 9 Noah Müller
  ('Noah Müller','Introduction to Business',86,1),
  ('Noah Müller','Financial Accounting',86,1),
  ('Noah Müller','Business Mathematics',86,1),
  -- 10 Ava Petrova
  ('Ava Petrova','Financial Accounting',67,7),
  ('Ava Petrova','Business Mathematics',67,7),
  -- 11 Liam Dubois
  ('Liam Dubois','Introduction to Business',92,0),
  ('Liam Dubois','Financial Accounting',92,0),
  ('Liam Dubois','Business Mathematics',92,0),
  -- 12 Chloe Martin
  ('Chloe Martin','Introduction to Business',74,4),
  ('Chloe Martin','Business Mathematics',74,4),
  -- 13 Ethan Silva
  ('Ethan Silva','Financial Accounting',83,2),
  ('Ethan Silva','Business Mathematics',83,2),
  -- 14 Amelia Fischer
  ('Amelia Fischer','Introduction to Business',78,3),
  ('Amelia Fischer','Financial Accounting',78,3),
  -- 15 James Ivanov
  ('James Ivanov','Introduction to Business',71,6),
  ('James Ivanov','Financial Accounting',71,6),
  ('James Ivanov','Business Mathematics',71,6),
  -- 16 Harper Collins
  ('Harper Collins','Introduction to Business',89,1),
  ('Harper Collins','Business Mathematics',89,1),
  -- 17 Benjamin Meyer
  ('Benjamin Meyer','Financial Accounting',64,8),
  ('Benjamin Meyer','Business Mathematics',64,8),
  -- 18 Ella Smith
  ('Ella Smith','Introduction to Business',82,2),
  ('Ella Smith','Financial Accounting',82,2),
  -- 19 Alexander Brown
  ('Alexander Brown','Introduction to Business',95,0),
  ('Alexander Brown','Financial Accounting',95,0),
  ('Alexander Brown','Business Mathematics',95,0),
  -- 20 Grace Wilson
  ('Grace Wilson','Introduction to Business',77,4),
  ('Grace Wilson','Business Mathematics',77,4),
  -- 21 Henry Anderson
  ('Henry Anderson','Financial Accounting',70,5),
  ('Henry Anderson','Business Mathematics',70,5),
  -- 22 Lily Thompson
  ('Lily Thompson','Introduction to Business',87,1),
  ('Lily Thompson','Financial Accounting',87,1),
  ('Lily Thompson','Business Mathematics',87,1),
  -- 23 Samuel Garcia
  ('Samuel Garcia','Introduction to Business',75,3),
  ('Samuel Garcia','Financial Accounting',75,3),
  -- 24 Victoria Lee
  ('Victoria Lee','Business Mathematics',68,7),
  ('Victoria Lee','Financial Accounting',68,7),
  -- 25 Michael Carter
  ('Michael Carter','Introduction to Business',80,2),
  ('Michael Carter','Business Mathematics',80,2),
  -- 26 Aria Johnson
  ('Aria Johnson','Introduction to Business',93,0),
  ('Aria Johnson','Financial Accounting',93,0),
  ('Aria Johnson','Business Mathematics',93,0),
  -- 27 David Clark
  ('David Clark','Introduction to Business',72,5),
  ('David Clark','Financial Accounting',72,5),
  -- 28 Emily Walker
  ('Emily Walker','Financial Accounting',85,2),
  ('Emily Walker','Business Mathematics',85,2),
  -- 29 Joseph Hall
  ('Joseph Hall','Introduction to Business',66,8),
  ('Joseph Hall','Business Mathematics',66,8),
  -- 30 Scarlett Young
  ('Scarlett Young','Introduction to Business',90,1),
  ('Scarlett Young','Financial Accounting',90,1),
  ('Scarlett Young','Business Mathematics',90,1),
  -- 31 Matthew King
  ('Matthew King','Introduction to Business',78,3),
  ('Matthew King','Financial Accounting',78,3),
  -- 32 Hannah Scott
  ('Hannah Scott','Business Mathematics',81,2),
  ('Hannah Scott','Financial Accounting',81,2),
  -- 33 Christopher Green
  ('Christopher Green','Introduction to Business',74,4),
  ('Christopher Green','Business Mathematics',74,4),
  -- 34 Zoe Adams
  ('Zoe Adams','Introduction to Business',96,0),
  ('Zoe Adams','Financial Accounting',96,0),
  ('Zoe Adams','Business Mathematics',96,0),
  -- 35 Andrew Baker
  ('Andrew Baker','Financial Accounting',63,9),
  ('Andrew Baker','Business Mathematics',63,9),
  -- 36 Natalie Nelson
  ('Natalie Nelson','Introduction to Business',79,3),
  ('Natalie Nelson','Financial Accounting',79,3),
  -- 37 Ryan Hill
  ('Ryan Hill','Introduction to Business',84,1),
  ('Ryan Hill','Business Mathematics',84,1),
  -- 38 Stella Mitchell
  ('Stella Mitchell','Introduction to Business',88,2),
  ('Stella Mitchell','Financial Accounting',88,2),
  ('Stella Mitchell','Business Mathematics',88,2),
  -- 39 Nathan Perez
  ('Nathan Perez','Financial Accounting',71,6),
  ('Nathan Perez','Business Mathematics',71,6),
  -- 40 Maya Roberts
  ('Maya Roberts','Introduction to Business',83,2),
  ('Maya Roberts','Financial Accounting',83,2),
  -- 41 Jack Turner
  ('Jack Turner','Introduction to Business',76,4),
  ('Jack Turner','Business Mathematics',76,4),
  -- 42 Elena Phillips
  ('Elena Phillips','Introduction to Business',91,1),
  ('Elena Phillips','Financial Accounting',91,1),
  ('Elena Phillips','Business Mathematics',91,1),
  -- 43 Thomas Campbell
  ('Thomas Campbell','Financial Accounting',69,7),
  ('Thomas Campbell','Business Mathematics',69,7),
  -- 44 Nora Parker
  ('Nora Parker','Introduction to Business',86,2),
  ('Nora Parker','Financial Accounting',86,2),
  -- 45 William Evans
  ('William Evans','Introduction to Business',73,5),
  ('William Evans','Business Mathematics',73,5),
  -- 46 Layla Edwards
  ('Layla Edwards','Introduction to Business',94,0),
  ('Layla Edwards','Financial Accounting',94,0),
  ('Layla Edwards','Business Mathematics',94,0),
  -- 47 George Morris
  ('George Morris','Financial Accounting',65,8),
  ('George Morris','Business Mathematics',65,8),
  -- 48 Mila Rogers
  ('Mila Rogers','Introduction to Business',82,3),
  ('Mila Rogers','Financial Accounting',82,3),
  -- 49 Leo Reed
  ('Leo Reed','Introduction to Business',79,2),
  ('Leo Reed','Business Mathematics',79,2),
  -- 50 Sophie Cook
  ('Sophie Cook','Introduction to Business',89,1),
  ('Sophie Cook','Financial Accounting',89,1),
  ('Sophie Cook','Business Mathematics',89,1),
  -- 51 Oscar Bell
  ('Oscar Bell','Financial Accounting',70,6),
  ('Oscar Bell','Business Mathematics',70,6),
  -- 52 Clara Murphy
  ('Clara Murphy','Introduction to Business',85,2),
  ('Clara Murphy','Financial Accounting',85,2),
  -- 53 Max Bailey
  ('Max Bailey','Introduction to Business',77,4),
  ('Max Bailey','Business Mathematics',77,4),
  -- 54 Julia Rivera
  ('Julia Rivera','Introduction to Business',92,0),
  ('Julia Rivera','Financial Accounting',92,0),
  ('Julia Rivera','Business Mathematics',92,0),
  -- 55 Sebastian Cooper
  ('Sebastian Cooper','Financial Accounting',68,7),
  ('Sebastian Cooper','Business Mathematics',68,7),
  -- 56 Alice Richardson
  ('Alice Richardson','Introduction to Business',80,3),
  ('Alice Richardson','Financial Accounting',80,3),
  -- 57 Gabriel Cox
  ('Gabriel Cox','Introduction to Business',75,4),
  ('Gabriel Cox','Business Mathematics',75,4),
  -- 58 Lina Howard
  ('Lina Howard','Introduction to Business',87,1),
  ('Lina Howard','Financial Accounting',87,1),
  ('Lina Howard','Business Mathematics',87,1),
  -- 59 Patrick Ward
  ('Patrick Ward','Financial Accounting',62,9),
  ('Patrick Ward','Business Mathematics',62,9),
  -- 60 Eva Brooks
  ('Eva Brooks','Introduction to Business',90,1),
  ('Eva Brooks','Financial Accounting',90,1),
  ('Eva Brooks','Business Mathematics',90,1)
) AS e(student_name, course_name, grade, missed)
JOIN students s ON s.full_name = e.student_name
JOIN courses  c ON c.name      = e.course_name
WHERE NOT EXISTS (
  SELECT 1 FROM course_enrollments ce
  WHERE ce.student_id = s.id AND ce.course_id = c.id
);
