-- ============================================================
-- High Five — Risk Warning System
-- Run in Supabase SQL Editor
-- ============================================================

-- ── risk_settings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_settings (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id         uuid,
  grade_limit_percentage numeric     NOT NULL DEFAULT 60,
  absence_limit_count    integer     NOT NULL DEFAULT 3,
  created_by             uuid        REFERENCES profiles(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Only one row (school-wide settings)
CREATE UNIQUE INDEX IF NOT EXISTS risk_settings_singleton ON risk_settings ((true));

ALTER TABLE risk_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "risk_settings_read"  ON risk_settings;
DROP POLICY IF EXISTS "risk_settings_write" ON risk_settings;

CREATE POLICY "risk_settings_read" ON risk_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "risk_settings_write" ON risk_settings
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator'))
  WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator'));

-- ── risk_warnings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_warnings (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id                 uuid        NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
  professor_id              uuid        REFERENCES profiles(id),
  program                   text,
  semester                  text,
  grade_percentage          numeric,
  missed_classes_count      integer,
  risk_reason               text        NOT NULL,
  status                    text        NOT NULL DEFAULT 'active'
                                        CHECK (status IN ('active', 'resolved')),
  course_help_email_sent    boolean     NOT NULL DEFAULT false,
  absence_policy_email_sent boolean     NOT NULL DEFAULT false,
  last_email_sent_at        timestamptz,
  resolved_by               uuid        REFERENCES profiles(id),
  resolved_at               timestamptz,
  resolution_note           text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

CREATE INDEX IF NOT EXISTS risk_warnings_professor ON risk_warnings (professor_id);
CREATE INDEX IF NOT EXISTS risk_warnings_status    ON risk_warnings (status);

ALTER TABLE risk_warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "risk_warnings_select" ON risk_warnings;
DROP POLICY IF EXISTS "risk_warnings_insert" ON risk_warnings;
DROP POLICY IF EXISTS "risk_warnings_update" ON risk_warnings;

-- Professors see their own; admins see all
CREATE POLICY "risk_warnings_select" ON risk_warnings
  FOR SELECT TO authenticated
  USING (
    professor_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator')
  );

CREATE POLICY "risk_warnings_insert" ON risk_warnings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "risk_warnings_update" ON risk_warnings
  FOR UPDATE TO authenticated
  USING (
    professor_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'administrator')
  );

-- auto-update updated_at
CREATE OR REPLACE FUNCTION update_risk_warnings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_risk_warnings_updated ON risk_warnings;
CREATE TRIGGER trg_risk_warnings_updated
  BEFORE UPDATE ON risk_warnings
  FOR EACH ROW EXECUTE FUNCTION update_risk_warnings_updated_at();
