-- ============================================================
-- Homework Assistance Feature — Full Schema Migration
-- Creates all 3 homework tables with enhanced columns.
-- Run in Supabase SQL Editor (Settings → SQL Editor).
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS guards.
-- ============================================================

-- ── Table 1: homework_alignment_checks ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS homework_alignment_checks (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id                    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id                       uuid        REFERENCES courses(id) ON DELETE SET NULL,
  course_name                     text        NOT NULL DEFAULT '',
  homework_title                  text        NOT NULL DEFAULT '',
  homework_text                   text        NOT NULL DEFAULT '',
  uploaded_file_urls              text[]      NOT NULL DEFAULT '{}',
  alignment_percentage            integer     NOT NULL DEFAULT 0,
  alignment_status                text        NOT NULL DEFAULT 'not_aligned',
  covered_learning_objectives     text[]      NOT NULL DEFAULT '{}',
  missing_learning_objectives     text[]      NOT NULL DEFAULT '{}',
  syllabus_alignment_summary      text        NOT NULL DEFAULT '',
  scheme_of_work_alignment_summary text       NOT NULL DEFAULT '',
  accreditation_alignment_summary text        NOT NULL DEFAULT '',
  program_alignment_summary       text        NOT NULL DEFAULT '',
  overlap_detected                boolean     NOT NULL DEFAULT false,
  overlap_details                 jsonb       NOT NULL DEFAULT '[]',
  ai_recommendations              text[]      NOT NULL DEFAULT '{}',
  suggested_revised_homework      text        NOT NULL DEFAULT '',
  generated_tasks                 jsonb       NOT NULL DEFAULT '[]',
  professor_edits                 text,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE homework_alignment_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "professors_manage_own_alignment_checks" ON homework_alignment_checks;
CREATE POLICY "professors_manage_own_alignment_checks"
  ON homework_alignment_checks FOR ALL TO authenticated
  USING    (professor_id = auth.uid())
  WITH CHECK (professor_id = auth.uid());

DROP POLICY IF EXISTS "admins_view_alignment_checks" ON homework_alignment_checks;
CREATE POLICY "admins_view_alignment_checks"
  ON homework_alignment_checks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'administrator'
    )
  );

-- ── Table 2: homework_grading_batches ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS homework_grading_batches (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id               uuid        REFERENCES courses(id) ON DELETE SET NULL,
  course_name             text        NOT NULL DEFAULT '',
  assignment_title        text        NOT NULL DEFAULT '',
  assignment_instructions text        NOT NULL DEFAULT '',
  rubric_text             text        NOT NULL DEFAULT '',
  rubric_file_urls        text[]      NOT NULL DEFAULT '{}',
  status                  text        NOT NULL DEFAULT 'pending',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE homework_grading_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "professors_manage_own_batches" ON homework_grading_batches;
CREATE POLICY "professors_manage_own_batches"
  ON homework_grading_batches FOR ALL TO authenticated
  USING    (professor_id = auth.uid())
  WITH CHECK (professor_id = auth.uid());

DROP POLICY IF EXISTS "admins_view_batches" ON homework_grading_batches;
CREATE POLICY "admins_view_batches"
  ON homework_grading_batches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'administrator'
    )
  );

-- ── Table 3: homework_student_results ────────────────────────────────────────
-- Stores per-student AI grading results.
-- student_id links to the students table (populated after student matching).
-- match_confidence: 'confirmed' | 'unclear' | 'unmatched' | 'pending'
-- grade_points / total_points: numeric grade alongside percentage.
-- improvement_recommendations: separate from weaknesses.
-- professor_note: private note visible only to professor.
-- original_ai_feedback: preserved AI draft before professor edits.

CREATE TABLE IF NOT EXISTS homework_student_results (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                     uuid        NOT NULL REFERENCES homework_grading_batches(id) ON DELETE CASCADE,

  -- Student identity
  student_name                 text        NOT NULL DEFAULT '',
  student_id                   uuid        REFERENCES students(id) ON DELETE SET NULL,
  match_confidence             text        NOT NULL DEFAULT 'pending',

  -- Submission
  submission_file_url          text        NOT NULL DEFAULT '',

  -- Grades
  overall_suggested_grade      integer     NOT NULL DEFAULT 0,
  grade_points                 numeric,
  total_points                 numeric,

  -- AI output
  rubric_criterion_grades      jsonb       NOT NULL DEFAULT '[]',
  grade_justification          text        NOT NULL DEFAULT '',
  strengths                    text[]      NOT NULL DEFAULT '{}',
  weaknesses                   text[]      NOT NULL DEFAULT '{}',
  improvement_recommendations  text[]      NOT NULL DEFAULT '{}',
  missing_requirements         text[]      NOT NULL DEFAULT '{}',
  plagiarism_risk_summary      text        NOT NULL DEFAULT '',
  original_ai_feedback         text        NOT NULL DEFAULT '',
  student_feedback_draft       text        NOT NULL DEFAULT '',

  -- Professor review
  professor_edited_grade       integer,
  professor_edited_feedback    text,
  professor_note               text,
  professor_status             text        NOT NULL DEFAULT 'pending',
  approved_at                  timestamptz,

  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE homework_student_results ENABLE ROW LEVEL SECURITY;

-- Professor policy: full CRUD for results belonging to their own batches
DROP POLICY IF EXISTS "professors_manage_own_student_results" ON homework_student_results;
CREATE POLICY "professors_manage_own_student_results"
  ON homework_student_results FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM homework_grading_batches
      WHERE homework_grading_batches.id = homework_student_results.batch_id
        AND homework_grading_batches.professor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM homework_grading_batches
      WHERE homework_grading_batches.id = homework_student_results.batch_id
        AND homework_grading_batches.professor_id = auth.uid()
    )
  );

-- Admin policy: view only, all approved results
DROP POLICY IF EXISTS "admins_view_student_results" ON homework_student_results;
CREATE POLICY "admins_view_student_results"
  ON homework_student_results FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'administrator'
    )
  );

-- ── Index for fast student profile lookups ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_homework_student_results_student_id
  ON homework_student_results (student_id)
  WHERE student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_homework_student_results_batch_id
  ON homework_student_results (batch_id);

CREATE INDEX IF NOT EXISTS idx_homework_grading_batches_professor_id
  ON homework_grading_batches (professor_id);

-- ============================================================
-- Done. Three tables created:
--   homework_alignment_checks
--   homework_grading_batches
--   homework_student_results
-- ============================================================
