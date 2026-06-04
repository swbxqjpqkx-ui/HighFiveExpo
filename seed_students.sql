-- ============================================================
-- Seed: 130 Students, 50 Courses, ~450 Enrollments
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run — uses WHERE NOT EXISTS guards throughout
-- ============================================================


-- ─── STEP 1: Courses ────────────────────────────────────────

INSERT INTO courses (id, name, program, semester)
SELECT gen_random_uuid(), v.name, v.program, v.semester
FROM (VALUES
  ('Introduction to Business Management','Business Administration','Semester 1'),
  ('Financial Accounting Basics','Business Administration','Semester 1'),
  ('Business Communication','Business Administration','Semester 1'),
  ('Principles of Marketing','Business Administration','Semester 1'),
  ('Microeconomics','Business Administration','Semester 1'),
  ('Organizational Behavior','Business Administration','Semester 2'),
  ('Statistics for Business','Business Administration','Semester 2'),
  ('Consumer Behavior','Business Administration','Semester 2'),
  ('Business Law','Business Administration','Semester 2'),
  ('Macroeconomics','Business Administration','Semester 2'),
  ('Corporate Finance','Business Administration','Semester 3'),
  ('Digital Marketing Strategy','Business Administration','Semester 3'),
  ('Human Resource Management','Business Administration','Semester 3'),
  ('Managerial Accounting','Business Administration','Semester 3'),
  ('Operations Management','Business Administration','Semester 3'),
  ('International Business','Business Administration','Semester 4'),
  ('Strategic Management','Business Administration','Semester 4'),
  ('Entrepreneurship','Business Administration','Semester 4'),
  ('Project Management','Business Administration','Semester 4'),
  ('Business Analytics','Business Administration','Semester 4'),
  ('Corporate Social Responsibility','Business Administration','Semester 5'),
  ('Supply Chain Management','Business Administration','Semester 5'),
  ('Investment Analysis','Business Administration','Semester 5'),
  ('Leadership and Change Management','Business Administration','Semester 5'),
  ('Risk Management','Business Administration','Semester 5'),
  ('Introduction to Hospitality Industry','Hospitality Management','Semester 1'),
  ('Rooms Division Management','Hospitality Management','Semester 1'),
  ('Hospitality Communication','Hospitality Management','Semester 1'),
  ('Service Excellence Basics','Hospitality Management','Semester 1'),
  ('Food and Beverage Operations','Hospitality Management','Semester 1'),
  ('Front Office Operations','Hospitality Management','Semester 2'),
  ('Hospitality Accounting','Hospitality Management','Semester 2'),
  ('Tourism and Destination Management','Hospitality Management','Semester 2'),
  ('Event Management','Hospitality Management','Semester 2'),
  ('Housekeeping Management','Hospitality Management','Semester 2'),
  ('Restaurant Management','Hospitality Management','Semester 3'),
  ('Guest Experience Management','Hospitality Management','Semester 3'),
  ('Revenue Management','Hospitality Management','Semester 3'),
  ('Hospitality Marketing','Hospitality Management','Semester 3'),
  ('Hospitality Law and Ethics','Hospitality Management','Semester 3'),
  ('Luxury Brand Management','Hospitality Management','Semester 4'),
  ('Conference and Banquet Management','Hospitality Management','Semester 4'),
  ('Sustainable Hospitality','Hospitality Management','Semester 4'),
  ('Hotel Operations Strategy','Hospitality Management','Semester 4'),
  ('Hospitality Data Analytics','Hospitality Management','Semester 4'),
  ('Hospitality Entrepreneurship','Hospitality Management','Semester 5'),
  ('Strategic Revenue Optimization','Hospitality Management','Semester 5'),
  ('Resort Management','Hospitality Management','Semester 5'),
  ('International Hotel Development','Hospitality Management','Semester 5'),
  ('Crisis Management in Hospitality','Hospitality Management','Semester 5')
) AS v(name, program, semester)
WHERE NOT EXISTS (
  SELECT 1 FROM courses c WHERE c.name = v.name AND c.program = v.program
);


-- ─── STEP 2: Students ───────────────────────────────────────

INSERT INTO students (id, full_name, email)
SELECT gen_random_uuid(), v.full_name, v.email
FROM (VALUES
  ('Adam Keller',       'adam.keller@students.edu'),
  ('Sofia Meyer',       'sofia.meyer@students.edu'),
  ('Lucas Weber',       'lucas.weber@students.edu'),
  ('Emma Fischer',      'emma.fischer@students.edu'),
  ('Noah Schmidt',      'noah.schmidt@students.edu'),
  ('Mia Wagner',        'mia.wagner@students.edu'),
  ('Liam Becker',       'liam.becker@students.edu'),
  ('Anna Hoffmann',     'anna.hoffmann@students.edu'),
  ('Elias Bauer',       'elias.bauer@students.edu'),
  ('Lena Richter',      'lena.richter@students.edu'),
  ('Felix Klein',       'felix.klein@students.edu'),
  ('Clara Wolf',        'clara.wolf@students.edu'),
  ('Jonas Hartmann',    'jonas.hartmann@students.edu'),
  ('Laura Neumann',     'laura.neumann@students.edu'),
  ('David Schwarz',     'david.schwarz@students.edu'),
  ('Nina Braun',        'nina.braun@students.edu'),
  ('Leo Zimmermann',    'leo.zimmermann@students.edu'),
  ('Julia Kruger',      'julia.kruger@students.edu'),
  ('Max Vogel',         'max.vogel@students.edu'),
  ('Sara Lange',        'sara.lange@students.edu'),
  ('Tom Berger',        'tom.berger@students.edu'),
  ('Eva Lorenz',        'eva.lorenz@students.edu'),
  ('Paul Steiner',      'paul.steiner@students.edu'),
  ('Amelie Graf',       'amelie.graf@students.edu'),
  ('Ben Weiss',         'ben.weiss@students.edu'),
  ('Lea Schmid',        'lea.schmid@students.edu'),
  ('Nico Keller',       'nico.keller@students.edu'),
  ('Marie Huber',       'marie.huber@students.edu'),
  ('Jan Meier',         'jan.meier@students.edu'),
  ('Lara Koch',         'lara.koch@students.edu'),
  ('Simon Frank',       'simon.frank@students.edu'),
  ('Elisa Roth',        'elisa.roth@students.edu'),
  ('Matteo Russo',      'matteo.russo@students.edu'),
  ('Giulia Romano',     'giulia.romano@students.edu'),
  ('Luca Bianchi',      'luca.bianchi@students.edu'),
  ('Chiara Conti',      'chiara.conti@students.edu'),
  ('Marco Ferrari',     'marco.ferrari@students.edu'),
  ('Alessia Ricci',     'alessia.ricci@students.edu'),
  ('Andrea Moretti',    'andrea.moretti@students.edu'),
  ('Martina Gallo',     'martina.gallo@students.edu'),
  ('Lorenzo Costa',     'lorenzo.costa@students.edu'),
  ('Elena Greco',       'elena.greco@students.edu'),
  ('Diego Marino',      'diego.marino@students.edu'),
  ('Valeria Rizzo',     'valeria.rizzo@students.edu'),
  ('Hugo Martin',       'hugo.martin@students.edu'),
  ('Camille Bernard',   'camille.bernard@students.edu'),
  ('Louis Dubois',      'louis.dubois@students.edu'),
  ('Manon Laurent',     'manon.laurent@students.edu'),
  ('Theo Moreau',       'theo.moreau@students.edu'),
  ('Chloe Simon',       'chloe.simon@students.edu'),
  ('Jules Lefevre',     'jules.lefevre@students.edu'),
  ('Ines Rousseau',     'ines.rousseau@students.edu'),
  ('Nathan Girard',     'nathan.girard@students.edu'),
  ('Alice Fournier',    'alice.fournier@students.edu'),
  ('Arthur Lambert',    'arthur.lambert@students.edu'),
  ('Lucie Andre',       'lucie.andre@students.edu'),
  ('Gabriel Mercier',   'gabriel.mercier@students.edu'),
  ('Sarah Blanc',       'sarah.blanc@students.edu'),
  ('Karim Haddad',      'karim.haddad@students.edu'),
  ('Lina Mansour',      'lina.mansour@students.edu'),
  ('Omar Farouk',       'omar.farouk@students.edu'),
  ('Yasmin Saleh',      'yasmin.saleh@students.edu'),
  ('Amir Nasser',       'amir.nasser@students.edu'),
  ('Leila Abbas',       'leila.abbas@students.edu'),
  ('Sami Khalil',       'sami.khalil@students.edu'),
  ('Nadia Rahman',      'nadia.rahman@students.edu'),
  ('Rayan Malik',       'rayan.malik@students.edu'),
  ('Aisha Khan',        'aisha.khan@students.edu'),
  ('Daniel Costa',      'daniel.costa@students.edu'),
  ('Beatriz Silva',     'beatriz.silva@students.edu'),
  ('Miguel Pereira',    'miguel.pereira@students.edu'),
  ('Ana Santos',        'ana.santos@students.edu'),
  ('Rafael Oliveira',   'rafael.oliveira@students.edu'),
  ('Mariana Almeida',   'mariana.almeida@students.edu'),
  ('Tiago Martins',     'tiago.martins@students.edu'),
  ('Carolina Rocha',    'carolina.rocha@students.edu'),
  ('Pedro Fernandes',   'pedro.fernandes@students.edu'),
  ('Ines Carvalho',     'ines.carvalho@students.edu'),
  ('Alex Johnson',      'alex.johnson@students.edu'),
  ('Olivia Brown',      'olivia.brown@students.edu'),
  ('Ethan Williams',    'ethan.williams@students.edu'),
  ('Ava Taylor',        'ava.taylor@students.edu'),
  ('James Wilson',      'james.wilson@students.edu'),
  ('Grace Thompson',    'grace.thompson@students.edu'),
  ('Henry Anderson',    'henry.anderson@students.edu'),
  ('Emily Walker',      'emily.walker@students.edu'),
  ('Oliver Clark',      'oliver.clark@students.edu'),
  ('Lily Lewis',        'lily.lewis@students.edu'),
  ('Mason Hall',        'mason.hall@students.edu'),
  ('Sophie Young',      'sophie.young@students.edu'),
  ('Jack Allen',        'jack.allen@students.edu'),
  ('Ella King',         'ella.king@students.edu'),
  ('Ryan Scott',        'ryan.scott@students.edu'),
  ('Hannah Green',      'hannah.green@students.edu'),
  ('Victor Ivanov',     'victor.ivanov@students.edu'),
  ('Alina Petrova',     'alina.petrova@students.edu'),
  ('Maksim Sokolov',    'maksim.sokolov@students.edu'),
  ('Daria Volkova',     'daria.volkova@students.edu'),
  ('Timur Akhmetov',    'timur.akhmetov@students.edu'),
  ('Amina Nurly',       'amina.nurly@students.edu'),
  ('Arman Bekov',       'arman.bekov@students.edu'),
  ('Dana Karimova',     'dana.karimova@students.edu'),
  ('Ilyas Omarov',      'ilyas.omarov@students.edu'),
  ('Aigerim Sadyk',     'aigerim.sadyk@students.edu'),
  ('Kenji Tanaka',      'kenji.tanaka@students.edu'),
  ('Yuki Nakamura',     'yuki.nakamura@students.edu'),
  ('Haruto Sato',       'haruto.sato@students.edu'),
  ('Mei Kobayashi',     'mei.kobayashi@students.edu'),
  ('Jiho Kim',          'jiho.kim@students.edu'),
  ('Minji Park',        'minji.park@students.edu'),
  ('Hyun Lee',          'hyun.lee@students.edu'),
  ('Hana Choi',         'hana.choi@students.edu'),
  ('Aarav Sharma',      'aarav.sharma@students.edu'),
  ('Priya Patel',       'priya.patel@students.edu'),
  ('Rohan Gupta',       'rohan.gupta@students.edu'),
  ('Anika Mehta',       'anika.mehta@students.edu'),
  ('Wei Chen',          'wei.chen@students.edu'),
  ('Lian Zhang',        'lian.zhang@students.edu'),
  ('Ming Liu',          'ming.liu@students.edu'),
  ('Jia Wang',          'jia.wang@students.edu'),
  ('Mateo Garcia',      'mateo.garcia@students.edu'),
  ('Lucia Fernandez',   'lucia.fernandez@students.edu'),
  ('Pablo Martinez',    'pablo.martinez@students.edu'),
  ('Carmen Lopez',      'carmen.lopez@students.edu'),
  ('Diego Torres',      'diego.torres@students.edu'),
  ('Isabella Ramirez',  'isabella.ramirez@students.edu'),
  ('Santiago Morales',  'santiago.morales@students.edu'),
  ('Valentina Cruz',    'valentina.cruz@students.edu'),
  ('Nikolai Hansen',    'nikolai.hansen@students.edu'),
  ('Freya Olsen',       'freya.olsen@students.edu')
) AS v(full_name, email)
WHERE NOT EXISTS (
  SELECT 1 FROM students s WHERE s.full_name = v.full_name
);


-- ─── STEP 3: Enrollments ────────────────────────────────────

INSERT INTO course_enrollments (id, student_id, course_id, grade, missed_classes)
SELECT gen_random_uuid(), s.id, c.id, e.grade, e.missed
FROM (VALUES
  -- 1 Adam Keller
  ('Adam Keller','International Business',91,0),
  ('Adam Keller','Strategic Management',87,0),
  ('Adam Keller','Entrepreneurship',85,4),
  ('Adam Keller','Project Management',92,3),
  -- 2 Sofia Meyer
  ('Sofia Meyer','Organizational Behavior',89,1),
  ('Sofia Meyer','Statistics for Business',76,8),
  ('Sofia Meyer','Consumer Behavior',88,0),
  ('Sofia Meyer','Business Law',77,1),
  -- 3 Lucas Weber
  ('Lucas Weber','Corporate Social Responsibility',82,3),
  ('Lucas Weber','Supply Chain Management',93,2),
  ('Lucas Weber','Investment Analysis',79,1),
  -- 4 Emma Fischer
  ('Emma Fischer','Luxury Brand Management',94,2),
  ('Emma Fischer','Conference and Banquet Management',71,3),
  ('Emma Fischer','Sustainable Hospitality',80,3),
  ('Emma Fischer','Hotel Operations Strategy',76,1),
  -- 5 Noah Schmidt
  ('Noah Schmidt','Introduction to Business Management',83,1),
  ('Noah Schmidt','Financial Accounting Basics',86,1),
  ('Noah Schmidt','Business Communication',79,8),
  ('Noah Schmidt','Principles of Marketing',87,0),
  -- 6 Mia Wagner
  ('Mia Wagner','Luxury Brand Management',74,0),
  ('Mia Wagner','Hospitality Data Analytics',88,2),
  ('Mia Wagner','Hotel Operations Strategy',80,0),
  -- 7 Liam Becker
  ('Liam Becker','Business Analytics',79,6),
  ('Liam Becker','Project Management',92,3),
  ('Liam Becker','Entrepreneurship',73,4),
  ('Liam Becker','Strategic Management',86,2),
  -- 8 Anna Hoffmann
  ('Anna Hoffmann','Business Analytics',75,2),
  ('Anna Hoffmann','Strategic Management',78,4),
  ('Anna Hoffmann','International Business',86,3),
  -- 9 Elias Bauer
  ('Elias Bauer','Introduction to Hospitality Industry',80,5),
  ('Elias Bauer','Rooms Division Management',70,5),
  ('Elias Bauer','Hospitality Communication',74,2),
  -- 10 Lena Richter
  ('Lena Richter','Business Analytics',93,2),
  ('Lena Richter','Strategic Management',80,0),
  ('Lena Richter','Entrepreneurship',81,2),
  ('Lena Richter','Project Management',87,2),
  -- 11 Felix Klein
  ('Felix Klein','Risk Management',77,1),
  ('Felix Klein','Leadership and Change Management',89,0),
  ('Felix Klein','Supply Chain Management',88,1),
  -- 12 Clara Wolf
  ('Clara Wolf','Corporate Social Responsibility',94,0),
  ('Clara Wolf','Supply Chain Management',83,6),
  ('Clara Wolf','Leadership and Change Management',92,2),
  ('Clara Wolf','Investment Analysis',87,2),
  -- 13 Jonas Hartmann
  ('Jonas Hartmann','Corporate Finance',82,1),
  ('Jonas Hartmann','Digital Marketing Strategy',78,5),
  ('Jonas Hartmann','Human Resource Management',89,3),
  ('Jonas Hartmann','Managerial Accounting',83,6),
  -- 14 Laura Neumann
  ('Laura Neumann','Service Excellence Basics',86,3),
  ('Laura Neumann','Hospitality Communication',74,7),
  ('Laura Neumann','Food and Beverage Operations',88,0),
  -- 15 David Schwarz
  ('David Schwarz','Macroeconomics',84,0),
  ('David Schwarz','Statistics for Business',86,7),
  ('David Schwarz','Organizational Behavior',80,3),
  ('David Schwarz','Consumer Behavior',82,0),
  -- 16 Nina Braun
  ('Nina Braun','Organizational Behavior',87,3),
  ('Nina Braun','Business Law',83,0),
  ('Nina Braun','Macroeconomics',89,0),
  ('Nina Braun','Consumer Behavior',80,2),
  -- 17 Leo Zimmermann
  ('Leo Zimmermann','Human Resource Management',77,0),
  ('Leo Zimmermann','Digital Marketing Strategy',79,4),
  ('Leo Zimmermann','Managerial Accounting',82,2),
  -- 18 Julia Kruger
  ('Julia Kruger','Front Office Operations',86,0),
  ('Julia Kruger','Hospitality Accounting',89,0),
  ('Julia Kruger','Tourism and Destination Management',83,3),
  ('Julia Kruger','Event Management',92,4),
  -- 19 Max Vogel
  ('Max Vogel','Conference and Banquet Management',82,3),
  ('Max Vogel','Hospitality Data Analytics',93,1),
  ('Max Vogel','Hotel Operations Strategy',74,2),
  ('Max Vogel','Luxury Brand Management',83,6),
  -- 20 Sara Lange
  ('Sara Lange','International Business',84,1),
  ('Sara Lange','Project Management',87,1),
  ('Sara Lange','Strategic Management',79,4),
  ('Sara Lange','Entrepreneurship',73,0),
  -- 21 Tom Berger
  ('Tom Berger','International Business',77,5),
  ('Tom Berger','Strategic Management',86,8),
  ('Tom Berger','Business Analytics',87,1),
  ('Tom Berger','Project Management',80,3),
  -- 22 Eva Lorenz
  ('Eva Lorenz','Business Law',83,2),
  ('Eva Lorenz','Consumer Behavior',94,4),
  ('Eva Lorenz','Macroeconomics',82,1),
  ('Eva Lorenz','Organizational Behavior',74,5),
  -- 23 Paul Steiner
  ('Paul Steiner','Investment Analysis',76,3),
  ('Paul Steiner','Leadership and Change Management',86,6),
  ('Paul Steiner','Corporate Social Responsibility',82,0),
  ('Paul Steiner','Risk Management',79,6),
  -- 24 Amelie Graf
  ('Amelie Graf','Corporate Social Responsibility',80,2),
  ('Amelie Graf','Leadership and Change Management',83,8),
  ('Amelie Graf','Investment Analysis',87,3),
  ('Amelie Graf','Risk Management',82,8),
  -- 25 Ben Weiss
  ('Ben Weiss','Digital Marketing Strategy',93,2),
  ('Ben Weiss','Managerial Accounting',86,4),
  ('Ben Weiss','Operations Management',68,3),
  -- 26 Lea Schmid
  ('Lea Schmid','Sustainable Hospitality',69,7),
  ('Lea Schmid','Conference and Banquet Management',71,2),
  ('Lea Schmid','Luxury Brand Management',83,8),
  ('Lea Schmid','Hotel Operations Strategy',91,7),
  -- 27 Nico Keller
  ('Nico Keller','Restaurant Management',87,6),
  ('Nico Keller','Guest Experience Management',89,7),
  ('Nico Keller','Revenue Management',70,5),
  ('Nico Keller','Hospitality Marketing',86,0),
  -- 28 Marie Huber
  ('Marie Huber','Entrepreneurship',82,0),
  ('Marie Huber','Strategic Management',74,3),
  ('Marie Huber','International Business',80,1),
  ('Marie Huber','Project Management',79,1),
  -- 29 Jan Meier
  ('Jan Meier','Introduction to Hospitality Industry',80,2),
  ('Jan Meier','Hospitality Communication',77,0),
  ('Jan Meier','Food and Beverage Operations',81,3),
  ('Jan Meier','Service Excellence Basics',78,2),
  -- 30 Lara Koch
  ('Lara Koch','Project Management',79,1),
  ('Lara Koch','International Business',82,3),
  ('Lara Koch','Entrepreneurship',74,3),
  ('Lara Koch','Business Analytics',75,0),
  -- 31 Simon Frank
  ('Simon Frank','Hospitality Entrepreneurship',80,6),
  ('Simon Frank','Strategic Revenue Optimization',92,6),
  ('Simon Frank','Resort Management',77,6),
  ('Simon Frank','International Hotel Development',86,1),
  -- 32 Elisa Roth
  ('Elisa Roth','Crisis Management in Hospitality',74,4),
  ('Elisa Roth','International Hotel Development',75,0),
  ('Elisa Roth','Resort Management',79,7),
  ('Elisa Roth','Strategic Revenue Optimization',83,3),
  -- 33 Matteo Russo
  ('Matteo Russo','Tourism and Destination Management',80,2),
  ('Matteo Russo','Front Office Operations',79,6),
  ('Matteo Russo','Event Management',89,1),
  ('Matteo Russo','Hospitality Accounting',82,2),
  -- 34 Giulia Romano
  ('Giulia Romano','Event Management',71,3),
  ('Giulia Romano','Housekeeping Management',93,3),
  ('Giulia Romano','Hospitality Accounting',75,2),
  ('Giulia Romano','Front Office Operations',80,0),
  -- 35 Luca Bianchi
  ('Luca Bianchi','Corporate Social Responsibility',77,0),
  ('Luca Bianchi','Risk Management',79,2),
  ('Luca Bianchi','Leadership and Change Management',86,4),
  ('Luca Bianchi','Supply Chain Management',87,0),
  -- 36 Chiara Conti
  ('Chiara Conti','Introduction to Hospitality Industry',92,1),
  ('Chiara Conti','Hospitality Communication',74,0),
  ('Chiara Conti','Rooms Division Management',71,2),
  ('Chiara Conti','Service Excellence Basics',83,0),
  -- 37 Marco Ferrari
  ('Marco Ferrari','Revenue Management',88,1),
  ('Marco Ferrari','Hospitality Marketing',78,2),
  ('Marco Ferrari','Guest Experience Management',94,7),
  ('Marco Ferrari','Restaurant Management',89,1),
  -- 38 Alessia Ricci
  ('Alessia Ricci','International Hotel Development',87,0),
  ('Alessia Ricci','Resort Management',93,2),
  ('Alessia Ricci','Crisis Management in Hospitality',86,1),
  -- 39 Andrea Moretti
  ('Andrea Moretti','Hospitality Accounting',80,3),
  ('Andrea Moretti','Housekeeping Management',82,0),
  ('Andrea Moretti','Tourism and Destination Management',79,4),
  ('Andrea Moretti','Front Office Operations',88,3),
  -- 40 Martina Gallo
  ('Martina Gallo','Strategic Management',80,6),
  ('Martina Gallo','International Business',92,1),
  ('Martina Gallo','Business Analytics',87,1),
  -- 41 Lorenzo Costa
  ('Lorenzo Costa','Introduction to Hospitality Industry',89,0),
  ('Lorenzo Costa','Rooms Division Management',86,0),
  ('Lorenzo Costa','Food and Beverage Operations',71,3),
  -- 42 Elena Greco
  ('Elena Greco','Food and Beverage Operations',87,1),
  ('Elena Greco','Service Excellence Basics',86,2),
  ('Elena Greco','Introduction to Hospitality Industry',86,1),
  ('Elena Greco','Rooms Division Management',92,4),
  -- 43 Diego Marino
  ('Diego Marino','Guest Experience Management',82,1),
  ('Diego Marino','Revenue Management',80,2),
  ('Diego Marino','Restaurant Management',83,1),
  ('Diego Marino','Hospitality Law and Ethics',92,2),
  -- 44 Valeria Rizzo
  ('Valeria Rizzo','Digital Marketing Strategy',78,2),
  ('Valeria Rizzo','Corporate Finance',82,3),
  ('Valeria Rizzo','Managerial Accounting',83,7),
  ('Valeria Rizzo','Operations Management',82,7),
  -- 45 Hugo Martin
  ('Hugo Martin','Statistics for Business',86,3),
  ('Hugo Martin','Organizational Behavior',66,0),
  ('Hugo Martin','Consumer Behavior',94,2),
  -- 46 Camille Bernard
  ('Camille Bernard','Microeconomics',77,2),
  ('Camille Bernard','Principles of Marketing',89,2),
  ('Camille Bernard','Introduction to Business Management',71,3),
  ('Camille Bernard','Business Communication',74,3),
  -- 47 Louis Dubois
  ('Louis Dubois','Statistics for Business',75,4),
  ('Louis Dubois','Business Law',83,3),
  ('Louis Dubois','Organizational Behavior',82,3),
  ('Louis Dubois','Consumer Behavior',87,1),
  -- 48 Manon Laurent
  ('Manon Laurent','International Business',82,2),
  ('Manon Laurent','Entrepreneurship',69,3),
  ('Manon Laurent','Business Analytics',86,1),
  ('Manon Laurent','Project Management',74,4),
  -- 49 Theo Moreau
  ('Theo Moreau','Hospitality Marketing',78,5),
  ('Theo Moreau','Hospitality Law and Ethics',86,1),
  ('Theo Moreau','Guest Experience Management',75,8),
  ('Theo Moreau','Revenue Management',83,5),
  -- 50 Chloe Simon
  ('Chloe Simon','Introduction to Business Management',82,4),
  ('Chloe Simon','Microeconomics',83,3),
  ('Chloe Simon','Financial Accounting Basics',92,8),
  ('Chloe Simon','Principles of Marketing',82,6),
  -- 51 Jules Lefevre
  ('Jules Lefevre','Rooms Division Management',83,4),
  ('Jules Lefevre','Service Excellence Basics',82,1),
  ('Jules Lefevre','Food and Beverage Operations',80,1),
  ('Jules Lefevre','Introduction to Hospitality Industry',93,0),
  -- 52 Ines Rousseau
  ('Ines Rousseau','Organizational Behavior',80,1),
  ('Ines Rousseau','Consumer Behavior',94,2),
  ('Ines Rousseau','Business Law',67,2),
  ('Ines Rousseau','Statistics for Business',92,6),
  -- 53 Nathan Girard
  ('Nathan Girard','Leadership and Change Management',77,2),
  ('Nathan Girard','Investment Analysis',86,3),
  ('Nathan Girard','Risk Management',79,2),
  ('Nathan Girard','Corporate Social Responsibility',77,6),
  -- 54 Alice Fournier
  ('Alice Fournier','Hotel Operations Strategy',80,0),
  ('Alice Fournier','Conference and Banquet Management',92,1),
  ('Alice Fournier','Sustainable Hospitality',89,3),
  ('Alice Fournier','Hospitality Data Analytics',88,0),
  -- 55 Arthur Lambert
  ('Arthur Lambert','Introduction to Business Management',79,2),
  ('Arthur Lambert','Principles of Marketing',86,0),
  ('Arthur Lambert','Financial Accounting Basics',83,1),
  ('Arthur Lambert','Business Communication',87,8),
  -- 56 Lucie Andre
  ('Lucie Andre','Financial Accounting Basics',80,1),
  ('Lucie Andre','Introduction to Business Management',82,2),
  ('Lucie Andre','Principles of Marketing',87,2),
  -- 57 Gabriel Mercier
  ('Gabriel Mercier','Strategic Revenue Optimization',83,3),
  ('Gabriel Mercier','Resort Management',80,4),
  ('Gabriel Mercier','Hospitality Entrepreneurship',68,6),
  -- 58 Sarah Blanc
  ('Sarah Blanc','Service Excellence Basics',89,1),
  ('Sarah Blanc','Rooms Division Management',86,5),
  ('Sarah Blanc','Introduction to Hospitality Industry',83,5),
  -- 59 Karim Haddad
  ('Karim Haddad','Business Analytics',82,3),
  ('Karim Haddad','Entrepreneurship',80,3),
  ('Karim Haddad','Project Management',87,0),
  ('Karim Haddad','International Business',79,6),
  -- 60 Lina Mansour
  ('Lina Mansour','Human Resource Management',80,3),
  ('Lina Mansour','Corporate Finance',79,1),
  ('Lina Mansour','Operations Management',77,4),
  ('Lina Mansour','Managerial Accounting',80,3),
  -- 61 Omar Farouk
  ('Omar Farouk','Business Communication',79,6),
  ('Omar Farouk','Introduction to Business Management',87,4),
  ('Omar Farouk','Microeconomics',82,3),
  -- 62 Yasmin Saleh
  ('Yasmin Saleh','Business Analytics',80,0),
  ('Yasmin Saleh','International Business',82,5),
  ('Yasmin Saleh','Project Management',79,0),
  ('Yasmin Saleh','Strategic Management',86,1),
  -- 63 Amir Nasser
  ('Amir Nasser','Hospitality Law and Ethics',92,8),
  ('Amir Nasser','Restaurant Management',83,6),
  ('Amir Nasser','Hospitality Marketing',79,1),
  ('Amir Nasser','Revenue Management',82,2),
  -- 64 Leila Abbas
  ('Leila Abbas','Consumer Behavior',82,6),
  ('Leila Abbas','Organizational Behavior',86,3),
  ('Leila Abbas','Statistics for Business',80,6),
  ('Leila Abbas','Macroeconomics',87,2),
  -- 65 Sami Khalil
  ('Sami Khalil','Housekeeping Management',87,8),
  ('Sami Khalil','Tourism and Destination Management',71,8),
  ('Sami Khalil','Event Management',86,3),
  ('Sami Khalil','Front Office Operations',77,6),
  -- 66 Nadia Rahman
  ('Nadia Rahman','Operations Management',92,4),
  ('Nadia Rahman','Corporate Finance',88,8),
  ('Nadia Rahman','Managerial Accounting',83,4),
  ('Nadia Rahman','Digital Marketing Strategy',75,6),
  -- 67 Rayan Malik
  ('Rayan Malik','Hospitality Law and Ethics',89,1),
  ('Rayan Malik','Revenue Management',80,0),
  ('Rayan Malik','Hospitality Marketing',86,0),
  ('Rayan Malik','Restaurant Management',82,5),
  -- 68 Aisha Khan
  ('Aisha Khan','Introduction to Business Management',71,0),
  ('Aisha Khan','Principles of Marketing',82,0),
  ('Aisha Khan','Financial Accounting Basics',86,0),
  ('Aisha Khan','Business Communication',74,1),
  -- 69 Daniel Costa
  ('Daniel Costa','Entrepreneurship',89,1),
  ('Daniel Costa','Project Management',88,6),
  ('Daniel Costa','International Business',82,0),
  ('Daniel Costa','Business Analytics',87,0),
  -- 70 Beatriz Silva
  ('Beatriz Silva','Guest Experience Management',68,3),
  ('Beatriz Silva','Restaurant Management',82,5),
  ('Beatriz Silva','Hospitality Law and Ethics',80,5),
  -- 71 Miguel Pereira
  ('Miguel Pereira','Hotel Operations Strategy',71,1),
  ('Miguel Pereira','Luxury Brand Management',88,6),
  ('Miguel Pereira','Sustainable Hospitality',69,7),
  ('Miguel Pereira','Conference and Banquet Management',89,6),
  -- 72 Ana Santos
  ('Ana Santos','Business Law',80,0),
  ('Ana Santos','Organizational Behavior',75,2),
  ('Ana Santos','Statistics for Business',89,4),
  ('Ana Santos','Consumer Behavior',86,4),
  -- 73 Rafael Oliveira
  ('Rafael Oliveira','Rooms Division Management',75,2),
  ('Rafael Oliveira','Introduction to Hospitality Industry',74,2),
  ('Rafael Oliveira','Hospitality Communication',87,1),
  ('Rafael Oliveira','Service Excellence Basics',88,3),
  -- 74 Mariana Almeida
  ('Mariana Almeida','Introduction to Business Management',87,0),
  ('Mariana Almeida','Principles of Marketing',80,0),
  ('Mariana Almeida','Financial Accounting Basics',71,1),
  ('Mariana Almeida','Business Communication',86,0),
  -- 75 Tiago Martins
  ('Tiago Martins','Consumer Behavior',82,2),
  ('Tiago Martins','Macroeconomics',94,0),
  ('Tiago Martins','Organizational Behavior',89,2),
  ('Tiago Martins','Statistics for Business',88,1),
  -- 76 Carolina Rocha
  ('Carolina Rocha','Food and Beverage Operations',70,5),
  ('Carolina Rocha','Service Excellence Basics',83,6),
  ('Carolina Rocha','Hospitality Communication',78,0),
  ('Carolina Rocha','Rooms Division Management',86,1),
  -- 77 Pedro Fernandes
  ('Pedro Fernandes','Digital Marketing Strategy',86,1),
  ('Pedro Fernandes','Operations Management',89,0),
  ('Pedro Fernandes','Human Resource Management',92,8),
  ('Pedro Fernandes','Managerial Accounting',87,1),
  -- 78 Ines Carvalho
  ('Ines Carvalho','Business Communication',87,0),
  ('Ines Carvalho','Principles of Marketing',92,1),
  ('Ines Carvalho','Microeconomics',86,3),
  -- 79 Alex Johnson
  ('Alex Johnson','Operations Management',82,1),
  ('Alex Johnson','Human Resource Management',80,2),
  ('Alex Johnson','Digital Marketing Strategy',93,1),
  ('Alex Johnson','Managerial Accounting',83,4),
  -- 80 Olivia Brown
  ('Olivia Brown','Restaurant Management',87,1),
  ('Olivia Brown','Revenue Management',83,2),
  ('Olivia Brown','Hospitality Law and Ethics',86,1),
  ('Olivia Brown','Guest Experience Management',82,0),
  -- 81 Ethan Williams
  ('Ethan Williams','Introduction to Hospitality Industry',79,4),
  ('Ethan Williams','Rooms Division Management',80,3),
  ('Ethan Williams','Hospitality Communication',66,1),
  ('Ethan Williams','Service Excellence Basics',87,7),
  -- 82 Ava Taylor
  ('Ava Taylor','Macroeconomics',87,0),
  ('Ava Taylor','Organizational Behavior',89,5),
  ('Ava Taylor','Business Law',86,2),
  ('Ava Taylor','Statistics for Business',78,1),
  -- 83 James Wilson
  ('James Wilson','Statistics for Business',77,3),
  ('James Wilson','Business Law',80,2),
  ('James Wilson','Macroeconomics',89,3),
  -- 84 Grace Thompson
  ('Grace Thompson','Corporate Finance',86,8),
  ('Grace Thompson','Operations Management',87,6),
  ('Grace Thompson','Human Resource Management',80,5),
  ('Grace Thompson','Managerial Accounting',83,4),
  -- 85 Henry Anderson
  ('Henry Anderson','Hotel Operations Strategy',87,0),
  ('Henry Anderson','Luxury Brand Management',86,1),
  ('Henry Anderson','Hospitality Data Analytics',78,1),
  -- 86 Emily Walker
  ('Emily Walker','Human Resource Management',87,0),
  ('Emily Walker','Digital Marketing Strategy',82,4),
  ('Emily Walker','Operations Management',83,5),
  ('Emily Walker','Managerial Accounting',71,0),
  -- 87 Oliver Clark
  ('Oliver Clark','Principles of Marketing',86,6),
  ('Oliver Clark','Business Communication',74,1),
  ('Oliver Clark','Financial Accounting Basics',87,3),
  ('Oliver Clark','Microeconomics',80,0),
  -- 88 Lily Lewis
  ('Lily Lewis','Guest Experience Management',87,3),
  ('Lily Lewis','Revenue Management',83,0),
  ('Lily Lewis','Hospitality Marketing',74,0),
  -- 89 Mason Hall
  ('Mason Hall','Food and Beverage Operations',89,4),
  ('Mason Hall','Service Excellence Basics',83,4),
  ('Mason Hall','Introduction to Hospitality Industry',80,3),
  ('Mason Hall','Hospitality Communication',88,2),
  -- 90 Sophie Young
  ('Sophie Young','Organizational Behavior',86,1),
  ('Sophie Young','Consumer Behavior',82,4),
  ('Sophie Young','Macroeconomics',75,1),
  -- 91 Jack Allen
  ('Jack Allen','Crisis Management in Hospitality',92,7),
  ('Jack Allen','Hospitality Entrepreneurship',87,1),
  ('Jack Allen','Strategic Revenue Optimization',82,3),
  ('Jack Allen','Resort Management',67,3),
  -- 92 Ella King
  ('Ella King','Hospitality Data Analytics',93,2),
  ('Ella King','Sustainable Hospitality',68,1),
  ('Ella King','Hotel Operations Strategy',89,1),
  ('Ella King','Conference and Banquet Management',92,1),
  -- 93 Ryan Scott
  ('Ryan Scott','Financial Accounting Basics',79,2),
  ('Ryan Scott','Microeconomics',80,0),
  ('Ryan Scott','Business Communication',94,1),
  ('Ryan Scott','Introduction to Business Management',87,8),
  -- 94 Hannah Green
  ('Hannah Green','Consumer Behavior',87,1),
  ('Hannah Green','Statistics for Business',89,3),
  ('Hannah Green','Macroeconomics',78,0),
  -- 95 Victor Ivanov
  ('Victor Ivanov','Hospitality Law and Ethics',78,2),
  ('Victor Ivanov','Hospitality Marketing',77,1),
  ('Victor Ivanov','Restaurant Management',82,2),
  ('Victor Ivanov','Revenue Management',67,6),
  -- 96 Alina Petrova
  ('Alina Petrova','Strategic Revenue Optimization',75,3),
  ('Alina Petrova','Hospitality Entrepreneurship',87,8),
  ('Alina Petrova','Crisis Management in Hospitality',80,0),
  ('Alina Petrova','Resort Management',77,0),
  -- 97 Maksim Sokolov
  ('Maksim Sokolov','Hospitality Data Analytics',87,4),
  ('Maksim Sokolov','Conference and Banquet Management',80,6),
  ('Maksim Sokolov','Luxury Brand Management',93,1),
  -- 98 Daria Volkova
  ('Daria Volkova','Tourism and Destination Management',82,1),
  ('Daria Volkova','Hospitality Accounting',66,8),
  ('Daria Volkova','Front Office Operations',75,3),
  -- 99 Timur Akhmetov
  ('Timur Akhmetov','Macroeconomics',75,1),
  ('Timur Akhmetov','Business Law',74,1),
  ('Timur Akhmetov','Statistics for Business',92,6),
  ('Timur Akhmetov','Organizational Behavior',83,4),
  -- 100 Amina Nurly
  ('Amina Nurly','Operations Management',75,5),
  ('Amina Nurly','Corporate Finance',78,4),
  ('Amina Nurly','Digital Marketing Strategy',87,6),
  ('Amina Nurly','Human Resource Management',77,4),
  -- 101 Arman Bekov
  ('Arman Bekov','Introduction to Hospitality Industry',82,1),
  ('Arman Bekov','Rooms Division Management',79,3),
  ('Arman Bekov','Hospitality Communication',71,0),
  -- 102 Dana Karimova
  ('Dana Karimova','Leadership and Change Management',75,7),
  ('Dana Karimova','Supply Chain Management',80,5),
  ('Dana Karimova','Investment Analysis',82,4),
  ('Dana Karimova','Risk Management',92,1),
  -- 103 Ilyas Omarov
  ('Ilyas Omarov','Investment Analysis',83,4),
  ('Ilyas Omarov','Risk Management',80,3),
  ('Ilyas Omarov','Leadership and Change Management',79,4),
  -- 104 Aigerim Sadyk
  ('Aigerim Sadyk','Financial Accounting Basics',80,1),
  ('Aigerim Sadyk','Principles of Marketing',79,8),
  ('Aigerim Sadyk','Microeconomics',77,0),
  ('Aigerim Sadyk','Introduction to Business Management',83,4),
  -- 105 Kenji Tanaka
  ('Kenji Tanaka','Front Office Operations',87,8),
  ('Kenji Tanaka','Hospitality Accounting',80,1),
  ('Kenji Tanaka','Event Management',79,3),
  ('Kenji Tanaka','Tourism and Destination Management',78,3),
  -- 106 Yuki Nakamura
  ('Yuki Nakamura','Digital Marketing Strategy',69,1),
  ('Yuki Nakamura','Operations Management',89,0),
  ('Yuki Nakamura','Human Resource Management',86,5),
  ('Yuki Nakamura','Managerial Accounting',87,0),
  -- 107 Haruto Sato
  ('Haruto Sato','Entrepreneurship',82,4),
  ('Haruto Sato','Project Management',89,4),
  ('Haruto Sato','Business Analytics',88,1),
  ('Haruto Sato','International Business',87,0),
  -- 108 Mei Kobayashi
  ('Mei Kobayashi','Food and Beverage Operations',71,1),
  ('Mei Kobayashi','Service Excellence Basics',83,0),
  ('Mei Kobayashi','Hospitality Communication',89,0),
  ('Mei Kobayashi','Introduction to Hospitality Industry',75,7),
  -- 109 Jiho Kim
  ('Jiho Kim','Principles of Marketing',82,4),
  ('Jiho Kim','Microeconomics',71,3),
  ('Jiho Kim','Financial Accounting Basics',77,8),
  -- 110 Minji Park
  ('Minji Park','Tourism and Destination Management',80,2),
  ('Minji Park','Front Office Operations',66,4),
  ('Minji Park','Hospitality Accounting',69,0),
  -- 111 Hyun Lee
  ('Hyun Lee','Statistics for Business',87,1),
  ('Hyun Lee','Macroeconomics',71,1),
  ('Hyun Lee','Consumer Behavior',86,3),
  ('Hyun Lee','Business Law',80,0),
  -- 112 Hana Choi
  ('Hana Choi','Sustainable Hospitality',80,2),
  ('Hana Choi','Hotel Operations Strategy',77,0),
  ('Hana Choi','Luxury Brand Management',87,3),
  ('Hana Choi','Conference and Banquet Management',79,4),
  -- 113 Aarav Sharma
  ('Aarav Sharma','Guest Experience Management',82,1),
  ('Aarav Sharma','Revenue Management',75,2),
  ('Aarav Sharma','Restaurant Management',89,3),
  ('Aarav Sharma','Hospitality Law and Ethics',78,5),
  -- 114 Priya Patel
  ('Priya Patel','Microeconomics',79,4),
  ('Priya Patel','Financial Accounting Basics',89,2),
  ('Priya Patel','Principles of Marketing',80,7),
  -- 115 Rohan Gupta
  ('Rohan Gupta','International Business',82,0),
  ('Rohan Gupta','Strategic Management',86,0),
  ('Rohan Gupta','Project Management',78,1),
  ('Rohan Gupta','Entrepreneurship',83,4),
  -- 116 Anika Mehta
  ('Anika Mehta','Hospitality Entrepreneurship',89,0),
  ('Anika Mehta','Strategic Revenue Optimization',88,6),
  ('Anika Mehta','International Hotel Development',86,1),
  ('Anika Mehta','Crisis Management in Hospitality',80,6),
  -- 117 Wei Chen
  ('Wei Chen','Sustainable Hospitality',75,2),
  ('Wei Chen','Hotel Operations Strategy',80,0),
  ('Wei Chen','Luxury Brand Management',83,2),
  ('Wei Chen','Conference and Banquet Management',86,3),
  -- 118 Lian Zhang
  ('Lian Zhang','Luxury Brand Management',83,0),
  ('Lian Zhang','Hospitality Data Analytics',86,4),
  ('Lian Zhang','Sustainable Hospitality',80,5),
  ('Lian Zhang','Hotel Operations Strategy',74,6),
  -- 119 Ming Liu
  ('Ming Liu','Restaurant Management',82,7),
  ('Ming Liu','Revenue Management',68,7),
  ('Ming Liu','Guest Experience Management',66,7),
  ('Ming Liu','Hospitality Law and Ethics',86,1),
  -- 120 Jia Wang
  ('Jia Wang','Rooms Division Management',83,1),
  ('Jia Wang','Hospitality Communication',78,1),
  ('Jia Wang','Food and Beverage Operations',80,5),
  ('Jia Wang','Introduction to Hospitality Industry',87,2),
  -- 121 Mateo Garcia
  ('Mateo Garcia','Event Management',80,4),
  ('Mateo Garcia','Tourism and Destination Management',78,7),
  ('Mateo Garcia','Housekeeping Management',89,2),
  ('Mateo Garcia','Front Office Operations',79,4),
  -- 122 Lucia Fernandez
  ('Lucia Fernandez','Luxury Brand Management',88,1),
  ('Lucia Fernandez','Hospitality Data Analytics',84,2),
  ('Lucia Fernandez','Sustainable Hospitality',82,3),
  ('Lucia Fernandez','Hotel Operations Strategy',79,4),
  -- 123 Pablo Martinez
  ('Pablo Martinez','Corporate Finance',84,2),
  ('Pablo Martinez','Operations Management',78,5),
  ('Pablo Martinez','Managerial Accounting',81,3),
  ('Pablo Martinez','Digital Marketing Strategy',88,1),
  -- 124 Carmen Lopez
  ('Carmen Lopez','Business Law',85,1),
  ('Carmen Lopez','Macroeconomics',79,3),
  ('Carmen Lopez','Organizational Behavior',82,2),
  ('Carmen Lopez','Consumer Behavior',90,0),
  -- 125 Diego Torres
  ('Diego Torres','Resort Management',81,5),
  ('Diego Torres','Hospitality Entrepreneurship',86,2),
  ('Diego Torres','Strategic Revenue Optimization',78,6),
  ('Diego Torres','International Hotel Development',84,1),
  -- 126 Isabella Ramirez
  ('Isabella Ramirez','Introduction to Hospitality Industry',90,0),
  ('Isabella Ramirez','Hospitality Communication',86,1),
  ('Isabella Ramirez','Food and Beverage Operations',82,4),
  ('Isabella Ramirez','Service Excellence Basics',88,2),
  -- 127 Santiago Morales
  ('Santiago Morales','Investment Analysis',79,4),
  ('Santiago Morales','Risk Management',83,2),
  ('Santiago Morales','Supply Chain Management',85,3),
  ('Santiago Morales','Corporate Social Responsibility',87,1),
  -- 128 Valentina Cruz
  ('Valentina Cruz','Front Office Operations',82,2),
  ('Valentina Cruz','Event Management',88,1),
  ('Valentina Cruz','Hospitality Accounting',76,5),
  ('Valentina Cruz','Housekeeping Management',84,3),
  -- 129 Nikolai Hansen
  ('Nikolai Hansen','Strategic Management',81,4),
  ('Nikolai Hansen','Business Analytics',86,2),
  ('Nikolai Hansen','International Business',84,1),
  ('Nikolai Hansen','Project Management',90,0),
  -- 130 Freya Olsen
  ('Freya Olsen','Revenue Management',83,3),
  ('Freya Olsen','Hospitality Marketing',87,1),
  ('Freya Olsen','Guest Experience Management',85,2),
  ('Freya Olsen','Restaurant Management',80,4)
) AS e(student_name, course_name, grade, missed)
JOIN students s ON s.full_name = e.student_name
JOIN courses  c ON c.name      = e.course_name
WHERE NOT EXISTS (
  SELECT 1 FROM course_enrollments ce
  WHERE ce.student_id = s.id AND ce.course_id = c.id
);
