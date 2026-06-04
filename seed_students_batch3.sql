-- ============================================================
-- Seed Batch 3: 60 Students
--   • 30 in Microeconomics (very low grades)
--   • 30 in Financial Accounting (95%+ grades)
-- Safe to re-run — WHERE NOT EXISTS guards throughout
-- ============================================================


-- ─── STEP 1: Insert Students ────────────────────────────────

INSERT INTO students (id, full_name, email)
SELECT gen_random_uuid(), v.full_name, v.email
FROM (VALUES
  ('Adrian Blake',      'adrian.blake@students.edu'),
  ('Maria Gomez',       'maria.gomez@students.edu'),
  ('Kevin Stone',       'kevin.stone@students.edu'),
  ('Lina Hart',         'lina.hart@students.edu'),
  ('Omar Lewis',        'omar.lewis@students.edu'),
  ('Nina Brooks',       'nina.brooks@students.edu'),
  ('Victor James',      'victor.james@students.edu'),
  ('Clara Evans',       'clara.evans@students.edu'),
  ('Milan Novak',       'milan.novak@students.edu'),
  ('Sophie Grant',      'sophie.grant@students.edu'),
  ('Leo Morgan',        'leo.morgan@students.edu'),
  ('Amira Khan',        'amira.khan@students.edu'),
  ('Daniel White',      'daniel.white@students.edu'),
  ('Elena Cross',       'elena.cross@students.edu'),
  ('Max Turner',        'max.turner@students.edu'),
  ('Julia Fisher',      'julia.fisher@students.edu'),
  ('Adam Hill',         'adam.hill@students.edu'),
  ('Bella Foster',      'bella.foster@students.edu'),
  ('Ryan Cooper',       'ryan.cooper@students.edu'),
  ('Eva Parker',        'eva.parker@students.edu'),
  ('Thomas Reed',       'thomas.reed@students.edu'),
  ('Layla Ward',        'layla.ward@students.edu'),
  ('Ivan Petrov',       'ivan.petrov@students.edu'),
  ('Mia Collins',       'mia.collins@students.edu'),
  ('Jack Bennett',      'jack.bennett@students.edu'),
  ('Sara Hughes',       'sara.hughes@students.edu'),
  ('David Allen',       'david.allen@students.edu'),
  ('Chloe Price',       'chloe.price@students.edu'),
  ('Noah Kelly',        'noah.kelly@students.edu'),
  ('Emma Gray',         'emma.gray@students.edu'),
  ('Alexander Moore',   'alexander.moore@students.edu'),
  ('Olivia Bennett',    'olivia.bennett@students.edu'),
  ('Benjamin Clarke',   'benjamin.clarke@students.edu'),
  ('Sophia Adams',      'sophia.adams@students.edu'),
  ('Lucas Harris',      'lucas.harris@students.edu'),
  ('Isabella Turner',   'isabella.turner@students.edu'),
  ('Ethan Walker',      'ethan.walker@students.edu'),
  ('Amelia Scott',      'amelia.scott@students.edu'),
  ('Noah Phillips',     'noah.phillips@students.edu'),
  ('Ava Green',         'ava.green@students.edu'),
  ('James Carter',      'james.carter@students.edu'),
  ('Mia Nelson',        'mia.nelson@students.edu'),
  ('William Baker',     'william.baker@students.edu'),
  ('Charlotte King',    'charlotte.king@students.edu'),
  ('Henry Morris',      'henry.morris@students.edu'),
  ('Emily Rogers',      'emily.rogers@students.edu'),
  ('Daniel Rivera',     'daniel.rivera@students.edu'),
  ('Grace Murphy',      'grace.murphy@students.edu'),
  ('Liam Bailey',       'liam.bailey@students.edu'),
  ('Ella Richardson',   'ella.richardson@students.edu'),
  ('Michael Cox',       'michael.cox@students.edu'),
  ('Harper Howard',     'harper.howard@students.edu'),
  ('Samuel Ward',       'samuel.ward@students.edu'),
  ('Lily Brooks',       'lily.brooks@students.edu'),
  ('Joseph Bell',       'joseph.bell@students.edu'),
  ('Zoe Cooper',        'zoe.cooper@students.edu'),
  ('Matthew Price',     'matthew.price@students.edu'),
  ('Scarlett Hughes',   'scarlett.hughes@students.edu'),
  ('Andrew Foster',     'andrew.foster@students.edu'),
  ('Nora Collins',      'nora.collins@students.edu')
) AS v(full_name, email)
WHERE NOT EXISTS (
  SELECT 1 FROM students s WHERE s.full_name = v.full_name
);


-- ─── STEP 2: Insert Enrollments ─────────────────────────────

INSERT INTO course_enrollments (id, student_id, course_id, grade, missed_classes)
SELECT gen_random_uuid(), s.id, c.id, e.grade, e.missed
FROM (VALUES
  -- Microeconomics (low grades)
  ('Adrian Blake',    'Microeconomics', 21, 9),
  ('Maria Gomez',     'Microeconomics', 18, 11),
  ('Kevin Stone',     'Microeconomics', 27, 8),
  ('Lina Hart',       'Microeconomics', 15, 12),
  ('Omar Lewis',      'Microeconomics', 32, 7),
  ('Nina Brooks',     'Microeconomics', 24, 10),
  ('Victor James',    'Microeconomics', 19, 13),
  ('Clara Evans',     'Microeconomics', 29, 8),
  ('Milan Novak',     'Microeconomics', 12, 14),
  ('Sophie Grant',    'Microeconomics', 34, 6),
  ('Leo Morgan',      'Microeconomics', 23, 10),
  ('Amira Khan',      'Microeconomics', 17, 12),
  ('Daniel White',    'Microeconomics', 28, 9),
  ('Elena Cross',     'Microeconomics', 20, 11),
  ('Max Turner',      'Microeconomics', 31, 7),
  ('Julia Fisher',    'Microeconomics', 14, 15),
  ('Adam Hill',       'Microeconomics', 26, 9),
  ('Bella Foster',    'Microeconomics', 22, 10),
  ('Ryan Cooper',     'Microeconomics', 16, 13),
  ('Eva Parker',      'Microeconomics', 30, 8),
  ('Thomas Reed',     'Microeconomics', 25, 10),
  ('Layla Ward',      'Microeconomics', 11, 16),
  ('Ivan Petrov',     'Microeconomics', 33, 7),
  ('Mia Collins',     'Microeconomics', 19, 12),
  ('Jack Bennett',    'Microeconomics', 27, 9),
  ('Sara Hughes',     'Microeconomics', 13, 15),
  ('David Allen',     'Microeconomics', 35, 6),
  ('Chloe Price',     'Microeconomics', 18, 13),
  ('Noah Kelly',      'Microeconomics', 24, 11),
  ('Emma Gray',       'Microeconomics', 20, 12),
  -- Financial Accounting (95%+ grades)
  ('Alexander Moore', 'Financial Accounting', 98, 0),
  ('Olivia Bennett',  'Financial Accounting', 96, 1),
  ('Benjamin Clarke', 'Financial Accounting', 99, 0),
  ('Sophia Adams',    'Financial Accounting', 97, 0),
  ('Lucas Harris',    'Financial Accounting', 95, 1),
  ('Isabella Turner', 'Financial Accounting', 100, 0),
  ('Ethan Walker',    'Financial Accounting', 96, 1),
  ('Amelia Scott',    'Financial Accounting', 98, 0),
  ('Noah Phillips',   'Financial Accounting', 97, 0),
  ('Ava Green',       'Financial Accounting', 99, 0),
  ('James Carter',    'Financial Accounting', 95, 1),
  ('Mia Nelson',      'Financial Accounting', 98, 0),
  ('William Baker',   'Financial Accounting', 96, 1),
  ('Charlotte King',  'Financial Accounting', 100, 0),
  ('Henry Morris',    'Financial Accounting', 97, 0),
  ('Emily Rogers',    'Financial Accounting', 95, 1),
  ('Daniel Rivera',   'Financial Accounting', 99, 0),
  ('Grace Murphy',    'Financial Accounting', 98, 0),
  ('Liam Bailey',     'Financial Accounting', 96, 1),
  ('Ella Richardson', 'Financial Accounting', 97, 0),
  ('Michael Cox',     'Financial Accounting', 100, 0),
  ('Harper Howard',   'Financial Accounting', 98, 0),
  ('Samuel Ward',     'Financial Accounting', 95, 1),
  ('Lily Brooks',     'Financial Accounting', 99, 0),
  ('Joseph Bell',     'Financial Accounting', 96, 1),
  ('Zoe Cooper',      'Financial Accounting', 97, 0),
  ('Matthew Price',   'Financial Accounting', 98, 0),
  ('Scarlett Hughes', 'Financial Accounting', 100, 0),
  ('Andrew Foster',   'Financial Accounting', 95, 1),
  ('Nora Collins',    'Financial Accounting', 99, 0)
) AS e(student_name, course_name, grade, missed)
JOIN students s ON s.full_name = e.student_name
JOIN courses  c ON c.name      = e.course_name
WHERE NOT EXISTS (
  SELECT 1 FROM course_enrollments ce
  WHERE ce.student_id = s.id AND ce.course_id = c.id
);
