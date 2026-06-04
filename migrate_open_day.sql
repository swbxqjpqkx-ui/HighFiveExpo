-- ============================================================
-- Open Day Items Table
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS open_day_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid,
  title         text        NOT NULL,
  description   text,
  icon_name     text        DEFAULT '🎟️',
  linked_route  text,
  display_order integer     DEFAULT 0,
  is_visible    boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE open_day_items ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY IF NOT EXISTS "admins_manage_open_day_items"
  ON open_day_items FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );

-- All authenticated users can view visible items
CREATE POLICY IF NOT EXISTS "users_view_open_day_items"
  ON open_day_items FOR SELECT TO authenticated
  USING (is_visible = true);

-- Seed with starter items (optional — remove if you want to start empty)
INSERT INTO open_day_items (title, description, icon_name, display_order) VALUES
  ('Campus Tour',            'Guided walk through our campus facilities and student spaces.',    '🏫', 1),
  ('Program Presentations',  'Overview of BBA, MBA, and DBA programs by department heads.',     '🎓', 2),
  ('Meet the Professors',    'Q&A sessions with faculty members across all programs.',           '👩‍🏫', 3),
  ('Student Life Panel',     'Current students share their experience and answer questions.',    '💬', 4),
  ('Admissions Desk',        'One-on-one meetings with admissions officers.',                   '📋', 5),
  ('Networking Lunch',       'Join students, faculty, and staff for an informal lunch.',        '🍽️', 6)
ON CONFLICT DO NOTHING;
