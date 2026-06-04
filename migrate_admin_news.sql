-- ============================================================
-- Admin News Tables Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. news_articles (shared article cache) ───────────────────
CREATE TABLE IF NOT EXISTS news_articles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 text NOT NULL,
  description           text,
  source_name           text,
  source_url            text,
  article_url           text NOT NULL,
  published_at          timestamptz,
  category              text,
  tags                  text[],
  related_accreditation text,
  image_url             text,
  relevance_score       numeric DEFAULT 0,
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "news_articles_read_authenticated" ON news_articles;
CREATE POLICY "news_articles_read_authenticated" ON news_articles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "news_articles_insert_authenticated" ON news_articles;
CREATE POLICY "news_articles_insert_authenticated" ON news_articles
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── 2. admin_pinned_news ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_pinned_news (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid NOT NULL,
  article_url   text NOT NULL,
  article_title text,
  pinned_at     timestamptz DEFAULT now(),
  UNIQUE(admin_id, article_url)
);

ALTER TABLE admin_pinned_news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_pinned_news_own" ON admin_pinned_news;
CREATE POLICY "admin_pinned_news_own" ON admin_pinned_news
  FOR ALL TO authenticated
  USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());

-- ── 3. admin_hidden_news ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_hidden_news (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL,
  article_url text NOT NULL,
  hidden_at   timestamptz DEFAULT now(),
  UNIQUE(admin_id, article_url)
);

ALTER TABLE admin_hidden_news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_hidden_news_own" ON admin_hidden_news;
CREATE POLICY "admin_hidden_news_own" ON admin_hidden_news
  FOR ALL TO authenticated
  USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());

-- ── Verify ────────────────────────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('news_articles', 'admin_pinned_news', 'admin_hidden_news')
ORDER BY tablename, cmd;
