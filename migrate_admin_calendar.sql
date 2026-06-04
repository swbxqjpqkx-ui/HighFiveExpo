-- ============================================================================
-- migrate_admin_calendar.sql
-- Creates the admin_calendar table used by the Admin → Calendar screen.
-- Run this ONCE in the Supabase SQL Editor.
--
-- NOTE: This script intentionally contains NO RLS or policy statements, as
-- requested. It only creates the table + supporting indexes. If your other
-- tables use Row Level Security, you may want to enable RLS and add access
-- policies for this table yourself (or ask and I'll provide them separately).
-- Column names match the app's AdminCalendarEvent type exactly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_calendar (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  date        date NOT NULL,                         -- 'YYYY-MM-DD'
  time        text NOT NULL,                         -- 'HH:MM'
  end_time    text,                                  -- 'HH:MM' (optional)
  location    text NOT NULL DEFAULT 'TBD',
  type        text NOT NULL CHECK (type IN ('meeting', 'deadline', 'event')),
  color       text,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Speeds up the screen's ORDER BY date, time.
CREATE INDEX IF NOT EXISTS admin_calendar_date_time_idx
  ON admin_calendar (date, time);
