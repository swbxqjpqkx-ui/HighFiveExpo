-- ─────────────────────────────────────────────────────────────────────────────
-- Homework Assistance Tables
-- Run this in the Supabase SQL Editor for the HighFive project.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── homework_alignment_checks ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS homework_alignment_checks (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id                    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id                       uuid NOT NULL,
  course_name                     text NOT NULL,
  homework_title                  text NOT NULL,
  homework_text                   text NOT NULL DEFAULT '',
  uploaded_file_urls              jsonb NOT NULL DEFAULT '[]',
  alignment_percentage            integer NOT NULL CHECK (alignment_percentage >= 0 AND alignment_percentage <= 100),
  alignment_status                text NOT NULL CHECK (alignment_status IN ('strongly_aligned','mostly_aligned','partially_aligned','not_aligned')),
  covered_learning_objectives     jsonb NOT NULL DEFAULT '[]',
  missing_learning_objectives     jsonb NOT NULL DEFAULT '[]',
  syllabus_alignment_summary      text NOT NULL DEFAULT '',
  scheme_of_work_alignment_summary text NOT NULL DEFAULT '',
  accreditation_alignment_summary text NOT NULL DEFAULT '',
  program_alignment_summary       text NOT NULL DEFAULT '',
  overlap_detected                boolean NOT NULL DEFAULT false,
  overlap_details                 jsonb NOT NULL DEFAULT '[]',
  ai_recommendations              jsonb NOT NULL DEFAULT '[]',
  suggested_revised_homework      text NOT NULL DEFAULT '',
  generated_tasks                 jsonb NOT NULL DEFAULT '[]',
  professor_edits                 text,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE homework_alignment_checks ENABLE ROW LEVEL SECURITY;

-- Professors can manage their own checks
CREATE POLICY "Professors manage own alignment checks"
  ON homework_alignment_checks
  FOR ALL
  USING (auth.uid() = professor_id)
  WITH CHECK (auth.uid() = professor_id);

-- Admins can read all checks
CREATE POLICY "Admins read all alignment checks"
  ON homework_alignment_checks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'administrator'
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_homework_alignment_checks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_homework_alignment_checks_updated_at ON homework_alignment_checks;
CREATE TRIGGER trg_homework_alignment_checks_updated_at
  BEFORE UPDATE ON homework_alignment_checks
  FOR EACH ROW EXECUTE FUNCTION update_homework_alignment_checks_updated_at();


-- ── homework_grading_batches ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS homework_grading_batches (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id               uuid NOT NULL,
  course_name             text NOT NULL,
  assignment_title        text NOT NULL,
  assignment_instructions text NOT NULL DEFAULT '',
  rubric_text             text NOT NULL DEFAULT '',
  rubric_file_urls        jsonb NOT NULL DEFAULT '[]',
  status                  text NOT NULL CHECK (status IN ('pending','processing','complete','error')) DEFAULT 'pending',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE homework_grading_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professors manage own grading batches"
  ON homework_grading_batches
  FOR ALL
  USING (auth.uid() = professor_id)
  WITH CHECK (auth.uid() = professor_id);

CREATE POLICY "Admins read all grading batches"
  ON homework_grading_batches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'administrator'
    )
  );

CREATE OR REPLACE FUNCTION update_homework_grading_batches_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_homework_grading_batches_updated_at ON homework_grading_batches;
CREATE TRIGGER trg_homework_grading_batches_updated_at
  BEFORE UPDATE ON homework_grading_batches
  FOR EACH ROW EXECUTE FUNCTION update_homework_grading_batches_updated_at();


-- ── homework_student_results ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS homework_student_results (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                    uuid NOT NULL REFERENCES homework_grading_batches(id) ON DELETE CASCADE,
  student_name                text NOT NULL,
  submission_file_url         text NOT NULL DEFAULT '',
  overall_suggested_grade     integer NOT NULL CHECK (overall_suggested_grade >= 0 AND overall_suggested_grade <= 100),
  rubric_criterion_grades     jsonb NOT NULL DEFAULT '[]',
  grade_justification         text NOT NULL DEFAULT '',
  strengths                   jsonb NOT NULL DEFAULT '[]',
  weaknesses                  jsonb NOT NULL DEFAULT '[]',
  missing_requirements        jsonb NOT NULL DEFAULT '[]',
  plagiarism_risk_summary     text NOT NULL DEFAULT '',
  student_feedback_draft      text NOT NULL DEFAULT '',
  professor_edited_grade      integer CHECK (professor_edited_grade >= 0 AND professor_edited_grade <= 100),
  professor_edited_feedback   text,
  professor_status            text NOT NULL CHECK (professor_status IN ('pending','approved','rejected','draft')) DEFAULT 'pending',
  approved_at                 timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE homework_student_results ENABLE ROW LEVEL SECURITY;

-- Professors can manage results for their own batches
CREATE POLICY "Professors manage results for own batches"
  ON homework_student_results
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM homework_grading_batches b
      WHERE b.id = homework_student_results.batch_id
        AND b.professor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM homework_grading_batches b
      WHERE b.id = homework_student_results.batch_id
        AND b.professor_id = auth.uid()
    )
  );

CREATE POLICY "Admins read all student results"
  ON homework_student_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'administrator'
    )
  );

CREATE OR REPLACE FUNCTION update_homework_student_results_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_homework_student_results_updated_at ON homework_student_results;
CREATE TRIGGER trg_homework_student_results_updated_at
  BEFORE UPDATE ON homework_student_results
  FOR EACH ROW EXECUTE FUNCTION update_homework_student_results_updated_at();


-- ── homework_assistance_tasks ─────────────────────────────────────────────────
-- Persisted action tasks generated from alignment checks
CREATE TABLE IF NOT EXISTS homework_assistance_tasks (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alignment_check_id      uuid REFERENCES homework_alignment_checks(id) ON DELETE SET NULL,
  course_id               uuid,
  title                   text NOT NULL,
  description             text NOT NULL DEFAULT '',
  priority                text NOT NULL CHECK (priority IN ('high','medium','low')) DEFAULT 'medium',
  status                  text NOT NULL CHECK (status IN ('open','done')) DEFAULT 'open',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE homework_assistance_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professors manage own homework tasks"
  ON homework_assistance_tasks
  FOR ALL
  USING (auth.uid() = professor_id)
  WITH CHECK (auth.uid() = professor_id);

CREATE OR REPLACE FUNCTION update_homework_assistance_tasks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_homework_assistance_tasks_updated_at ON homework_assistance_tasks;
CREATE TRIGGER trg_homework_assistance_tasks_updated_at
  BEFORE UPDATE ON homework_assistance_tasks
  FOR EACH ROW EXECUTE FUNCTION update_homework_assistance_tasks_updated_at();


-- ── homework_assistance_history (view) ───────────────────────────────────────
-- Convenience view combining alignment checks and grading batches for history display.
-- Use fetchHomeworkAssistanceHistory() in the service instead of this view
-- if RLS on the base tables is sufficient.
CREATE OR REPLACE VIEW homework_assistance_history AS
  SELECT
    ('alignment-' || id)::text AS id,
    professor_id,
    course_id,
    course_name,
    'alignment'::text                                   AS check_type,
    id                                                  AS related_check_id,
    ('Alignment check for "' || homework_title || '"')  AS summary,
    alignment_percentage,
    homework_title                                      AS assignment_title,
    NULL::integer                                       AS student_count,
    created_at
  FROM homework_alignment_checks

  UNION ALL

  SELECT
    ('grading-' || b.id)::text,
    b.professor_id,
    b.course_id,
    b.course_name,
    'grading'::text,
    b.id,
    ('Grading batch for "' || b.assignment_title || '"'),
    NULL::integer,
    b.assignment_title,
    (SELECT COUNT(*)::integer FROM homework_student_results r WHERE r.batch_id = b.id),
    b.created_at
  FROM homework_grading_batches b

  ORDER BY created_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase Storage
-- ─────────────────────────────────────────────────────────────────────────────
-- The homework files use the existing 'course-files' bucket under the 'homework/'
-- prefix. No new bucket is required. Ensure the bucket exists with the following
-- policy allowing authenticated users to upload under their own professor_id path.
--
-- In the Supabase dashboard, Storage → course-files → Policies, add:
--
--   INSERT policy: bucket_id = 'course-files' AND (storage.foldername(name))[1] = 'homework'
--     FOR authenticated users (auth.role() = 'authenticated')
--
--   SELECT policy: bucket_id = 'course-files'
--     FOR authenticated users
-- ─────────────────────────────────────────────────────────────────────────────
