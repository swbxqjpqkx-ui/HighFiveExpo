-- ============================================================================
-- migrate_professor_calendar.sql
-- Creates the professor_calendar table used by the Professor → Calendar screen.
-- Each professor sees ONLY their own events (isolated by professor_id).
-- Run this ONCE in the Supabase SQL Editor.
--
-- Mirrors the admin_calendar table, but adds a professor_id owner column and
-- RLS policies scoped to professor_id = auth.uid(). Column names match the
-- app's AdminCalendarEvent type (reused for professor events).
--
-- This script DOES enable RLS and add policies (you asked for the script).
-- It does NOT modify any other table, the admin_calendar table, auth rules,
-- or existing policies. Review before running.
-- ============================================================================

CREATE TABLE IF NOT EXISTS professor_calendar (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  date          date NOT NULL,                         -- 'YYYY-MM-DD'
  time          text NOT NULL,                         -- 'HH:MM'
  end_time      text,                                  -- 'HH:MM' (optional)
  location      text NOT NULL DEFAULT 'TBD',
  type          text NOT NULL CHECK (type IN ('meeting', 'deadline', 'event')),
  color         text,
  professor_id  uuid NOT NULL REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Speeds up the screen's "my events, ordered by date/time" query.
CREATE INDEX IF NOT EXISTS professor_calendar_owner_date_idx
  ON professor_calendar (professor_id, date, time);

-- Row Level Security: a professor can only see / create their OWN events.
ALTER TABLE professor_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "professor_calendar_select_own"
  ON professor_calendar FOR SELECT
  TO authenticated
  USING (professor_id = auth.uid());

CREATE POLICY "professor_calendar_insert_own"
  ON professor_calendar FOR INSERT
  TO authenticated
  WITH CHECK (professor_id = auth.uid());
