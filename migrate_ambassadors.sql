-- ============================================================
-- Open Day Ambassadors Table
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS open_day_ambassadors (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name  text        NOT NULL,
  country    text        NOT NULL DEFAULT '',
  program    text        NOT NULL DEFAULT '',
  email      text        NOT NULL DEFAULT '',
  phone      text,
  role       text        NOT NULL DEFAULT 'Student Ambassador',
  photo_url  text,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_open_day_ambassadors_active
  ON open_day_ambassadors(is_active);

ALTER TABLE open_day_ambassadors ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "admins_manage_ambassadors" ON open_day_ambassadors;
CREATE POLICY "admins_manage_ambassadors"
  ON open_day_ambassadors FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );

-- All authenticated users can read active ambassadors
DROP POLICY IF EXISTS "authenticated_read_ambassadors" ON open_day_ambassadors;
CREATE POLICY "authenticated_read_ambassadors"
  ON open_day_ambassadors FOR SELECT TO authenticated
  USING (is_active = true);

-- ── Seed sample data ──────────────────────────────────────────────────────────
INSERT INTO open_day_ambassadors (full_name, country, program, email, role, is_active) VALUES
  ('Mia Hofmann',  'Switzerland', 'International Business', 'mia.hofmann@example.com',  'Lead Ambassador',     true),
  ('Tom Richter',  'Germany',     'Finance',                'tom.richter@example.com',  'Campus Guide',        true),
  ('Sara Nguyen',  'France',      'Marketing',              'sara.nguyen@example.com',  'Social Media',        true),
  ('Ben Fischer',  'Austria',     'Economics',              'ben.fischer@example.com',  'Campus Guide',        true),
  ('Lena Braun',   'Germany',     'Business Analytics',     'lena.braun@example.com',   'Registration',        true),
  ('Marc Dupont',  'France',      'Hospitality Management', 'marc.dupont@example.com',  'Campus Guide',        true)
ON CONFLICT DO NOTHING;
