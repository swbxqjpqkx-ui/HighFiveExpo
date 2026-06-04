-- ============================================================
-- Student Risk Rules & Warnings Tables
-- Run in Supabase SQL Editor
-- ============================================================

-- ─── student_risk_rules ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_risk_rules (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  program                   text NOT NULL,
  semester                  text NOT NULL,
  max_absences_allowed      integer NOT NULL CHECK (max_absences_allowed >= 0),
  borderline_grade_percentage integer NOT NULL CHECK (borderline_grade_percentage BETWEEN 0 AND 100),
  created_by_admin_id       uuid REFERENCES profiles(id),
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now(),
  UNIQUE(program, semester)
);

-- ─── student_warnings ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_warnings (
  id                          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id                  uuid REFERENCES students(id) ON DELETE CASCADE,
  course_id                   uuid REFERENCES courses(id) ON DELETE CASCADE,
  professor_id                uuid REFERENCES profiles(id),
  program                     text,
  semester                    text,
  grade_percentage            numeric,
  missed_classes_count        integer,
  max_absences_allowed        integer,
  borderline_grade_percentage integer,
  warning_reason              text,
  status                      text DEFAULT 'new' CHECK (status IN ('new','reviewed','resolved','ignored')),
  detected_at                 timestamptz DEFAULT now(),
  reviewed_at                 timestamptz,
  resolved_at                 timestamptz,
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_risk_rules_updated ON student_risk_rules;
CREATE TRIGGER trg_risk_rules_updated
  BEFORE UPDATE ON student_risk_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_warnings_updated ON student_warnings;
CREATE TRIGGER trg_warnings_updated
  BEFORE UPDATE ON student_warnings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ────────────────────────────────────────────────────

ALTER TABLE student_risk_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_warnings   ENABLE ROW LEVEL SECURITY;

-- Risk rules: admin can do everything, professors can read
CREATE POLICY "admin_all_risk_rules" ON student_risk_rules
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );

CREATE POLICY "professor_read_risk_rules" ON student_risk_rules
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'professor')
  );

-- Warnings: admin can do everything
CREATE POLICY "admin_all_warnings" ON student_warnings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );

-- Professors can read their own warnings
CREATE POLICY "professor_read_own_warnings" ON student_warnings
  FOR SELECT TO authenticated
  USING (
    professor_id = auth.uid()
  );

-- Professors can update status of their own warnings
CREATE POLICY "professor_update_own_warnings" ON student_warnings
  FOR UPDATE TO authenticated
  USING (professor_id = auth.uid())
  WITH CHECK (professor_id = auth.uid());

-- Professors can insert warnings (system creates them on their behalf)
CREATE POLICY "professor_insert_warnings" ON student_warnings
  FOR INSERT TO authenticated
  WITH CHECK (true);
