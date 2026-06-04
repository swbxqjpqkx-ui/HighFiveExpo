-- ───────────────────────────────────────────────────────────────────────────
-- Course Overlap feature — ADDITIVE migration only.
--
-- Run ONCE in the Supabase SQL Editor.
--
-- Safe by design:
--   • Adds two NULLABLE jsonb columns to EXISTING tables.
--   • No constraints, no defaults that rewrite rows, no data loss.
--   • Does NOT touch RLS policies, auth rules, or any existing column.
--   • Existing rows keep working (the new columns are simply NULL until the
--     "Run Overlap Check" feature populates them).
--
-- Column purpose:
--   scheme_of_work.topics   → extracted Scheme-of-Work topics, e.g.
--       [{ "topic": "Market Segmentation", "week": 4 }, ...]
--   overlap_reports.details → the richer overlap data the UI needs, e.g.
--       {
--         "topic_a": "Market Segmentation", "week_a": 4,
--         "topic_b": "Customer Segmentation", "week_b": 6,
--         "recommendation": "Keep definitions in A, applied examples in B.",
--         "resolution_status": "new"   -- new | resolved | not_an_issue | needs_discussion
--       }
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE scheme_of_work  ADD COLUMN IF NOT EXISTS topics  jsonb;
ALTER TABLE overlap_reports ADD COLUMN IF NOT EXISTS details jsonb;
