-- ============================================================
-- Notification Preferences & User Settings Tables
-- Run in Supabase SQL Editor
-- ============================================================

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  warning_notifications  boolean NOT NULL DEFAULT true,
  syllabus_notifications boolean NOT NULL DEFAULT true,
  system_notifications   boolean NOT NULL DEFAULT true,
  homework_notifications boolean NOT NULL DEFAULT false,
  updated_at             timestamptz DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "notif_prefs_own"
  ON notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- User settings per user (language, etc.)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language   text NOT NULL DEFAULT 'English',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "user_settings_own"
  ON user_settings FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
