-- ============================================================
-- warning_email_logs — Full audit log for all warning emails
-- Shared between professor and admin email actions.
-- Run in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS warning_email_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who the email was sent to
  student_id      uuid        NOT NULL,
  student_email   text        NOT NULL,
  student_name    text        NOT NULL,

  -- Which course/warning triggered it
  course_id       uuid        NOT NULL,
  course_name     text        NOT NULL,
  warning_id      uuid,           -- nullable: may not have a risk_warnings row

  -- Who sent it
  professor_id    uuid        NOT NULL,
  professor_name  text        NOT NULL,
  sent_by_user_id uuid        NOT NULL,   -- auth.uid() of the caller
  sent_by_name    text        NOT NULL,
  sender_role     text        NOT NULL    -- 'professor' | 'admin'
                  CHECK (sender_role IN ('professor', 'admin')),

  -- Email content
  email_type      text        NOT NULL    -- 'course_help' | 'absence_policy'
                  CHECK (email_type IN ('course_help', 'absence_policy')),
  subject         text        NOT NULL,
  body            text        NOT NULL,

  -- Delivery result
  sent_at         timestamptz NOT NULL DEFAULT now(),
  status          text        NOT NULL DEFAULT 'sent'
                  CHECK (status IN ('sent', 'failed')),
  error_message   text,

  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Fast lookups
CREATE INDEX IF NOT EXISTS idx_wel_professor  ON warning_email_logs (professor_id);
CREATE INDEX IF NOT EXISTS idx_wel_student    ON warning_email_logs (student_id);
CREATE INDEX IF NOT EXISTS idx_wel_warning    ON warning_email_logs (warning_id);
CREATE INDEX IF NOT EXISTS idx_wel_sent_at    ON warning_email_logs (sent_at DESC);

ALTER TABLE warning_email_logs ENABLE ROW LEVEL SECURITY;

-- Professors see only their own logs
DROP POLICY IF EXISTS "wel_select_own" ON warning_email_logs;
CREATE POLICY "wel_select_own" ON warning_email_logs
  FOR SELECT TO authenticated
  USING (professor_id = auth.uid() OR is_admin_user());

-- Only the service role (edge function) inserts rows — no INSERT policy needed for regular users.
-- If you want to allow direct inserts from the client as fallback, add:
-- CREATE POLICY "wel_insert_own" ON warning_email_logs
--   FOR INSERT TO authenticated
--   WITH CHECK (sent_by_user_id = auth.uid());
