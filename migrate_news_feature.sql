-- ============================================================
-- News Feature: Professor Pinned Articles + News Preferences
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Table 1: professor_pinned_articles ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS professor_pinned_articles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id     uuid REFERENCES courses(id) ON DELETE SET NULL,
  course_name   text NOT NULL DEFAULT '',
  article_title text NOT NULL,
  article_url   text NOT NULL,
  source_name   text NOT NULL DEFAULT '',
  published_at  timestamptz,
  topic_keyword text,
  pinned_at     timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (professor_id, article_url)
);

ALTER TABLE professor_pinned_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "professors_manage_own_pins" ON professor_pinned_articles;
CREATE POLICY "professors_manage_own_pins"
  ON professor_pinned_articles FOR ALL TO authenticated
  USING    (professor_id = auth.uid())
  WITH CHECK (professor_id = auth.uid());

-- ── Table 2: professor_news_preferences ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS professor_news_preferences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_name   text NOT NULL,
  source_url    text,
  is_enabled    boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (professor_id, source_name)
);

ALTER TABLE professor_news_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "professors_manage_own_news_prefs" ON professor_news_preferences;
CREATE POLICY "professors_manage_own_news_prefs"
  ON professor_news_preferences FOR ALL TO authenticated
  USING    (professor_id = auth.uid())
  WITH CHECK (professor_id = auth.uid());
