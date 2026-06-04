-- ============================================================
-- Professor Warning Emails Table
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS professor_warning_emails (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid        NOT NULL,
  professor_id  uuid        NOT NULL,
  course_id     uuid        NOT NULL,
  warning_type  text        NOT NULL,   -- 'absence_policy' | 'support'
  email_subject text        NOT NULL,
  email_body    text        NOT NULL,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  status        text        NOT NULL DEFAULT 'sent',  -- 'sent' | 'failed'
  created_at    timestamptz DEFAULT now()
);

-- Fast lookups by professor (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_prof_warning_emails_professor
  ON professor_warning_emails(professor_id);

-- Fast lookups by student (for admin views, future use)
CREATE INDEX IF NOT EXISTS idx_prof_warning_emails_student
  ON professor_warning_emails(student_id);

ALTER TABLE professor_warning_emails ENABLE ROW LEVEL SECURITY;

-- Professors can read and create their own records
DROP POLICY IF EXISTS "professors_manage_own_warning_emails" ON professor_warning_emails;
CREATE POLICY "professors_manage_own_warning_emails"
  ON professor_warning_emails FOR ALL TO authenticated
  USING    (professor_id = auth.uid())
  WITH CHECK (professor_id = auth.uid());

-- Admins can read all records (for oversight and audit)
DROP POLICY IF EXISTS "admins_view_all_warning_emails" ON professor_warning_emails;
CREATE POLICY "admins_view_all_warning_emails"
  ON professor_warning_emails FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );
