import { AccreditationType } from './index';

// ── Syllabus ──────────────────────────────────────────────────────────────────

export type SyllabusStatus = 'none' | 'submitted' | 'approved' | 'locked' | 'rejected';
export type SyllabusRequestType = 'initial' | 'replace' | 'unlock';
export type SyllabusRequestStatus = 'pending' | 'approved' | 'declined';

export interface CourseSyllabus {
  id: string;
  course_id: string;
  professor_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size?: number;
  status: SyllabusStatus;
  version: number;
  submitted_at?: string;
  approved_at?: string;
  approved_by?: string;
  locked_at?: string;
  locked_by?: string;
  unlocked_at?: string;
  unlocked_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SyllabusRequest {
  id: string;
  course_id: string;
  professor_id: string;
  request_type: SyllabusRequestType;
  file_name?: string;
  file_url?: string;
  reason: string;
  status: SyllabusRequestStatus;
  admin_comment?: string;
  created_at: string;
  resolved_at?: string;
}

// ── Scheme of Work ────────────────────────────────────────────────────────────

export type SchemeOfWorkStatus = 'submitted' | 'approved' | 'locked' | 'rejected';
export type SchemeOfWorkRequestStatus = 'pending' | 'approved' | 'declined' | 'changes_requested';

// A single topic extracted from a Scheme of Work document (with its week/module
// number when the document states one). Stored in scheme_of_work.topics (jsonb).
export interface SchemeTopic {
  topic: string;
  week?: number | string;
}

export interface SchemeOfWork {
  id: string;
  course_id: string;
  professor_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size?: number;
  status: SchemeOfWorkStatus;
  version: number;
  submitted_at?: string;
  approved_at?: string;
  approved_by?: string;
  locked_at?: string;
  locked_by?: string;
  // Extracted topics — populated lazily by "Run Overlap Check" (jsonb column).
  topics?: SchemeTopic[] | null;
  created_at: string;
  updated_at: string;
}

export interface SchemeOfWorkRequest {
  id: string;
  course_id: string;
  professor_id: string;
  request_type: 'initial' | 'replace';
  file_name?: string;
  file_url?: string;
  reason: string;
  status: SchemeOfWorkRequestStatus;
  admin_comment?: string;
  created_at: string;
  resolved_at?: string;
}

// ── Materials ─────────────────────────────────────────────────────────────────

export type MaterialFileType = 'pdf' | 'word' | 'ppt' | 'excel' | 'image' | 'link' | 'other';
export type MaterialAIStatus = 'not_queued' | 'pending' | 'analysed' | 'error';

export interface CourseMaterial {
  id: string;
  course_id: string;
  professor_id: string;
  title: string;
  description?: string;
  file_name: string;
  file_url: string;
  file_type: MaterialFileType;
  file_size?: number;
  week?: number;
  ai_status: MaterialAIStatus;
  created_at: string;
}

// ── AI Analysis ───────────────────────────────────────────────────────────────

export type AIIssueSeverity = 'critical' | 'warning' | 'info';
export type AISuggestionType =
  | 'replace_topic'
  | 'move_semester'
  | 'change_outcome'
  | 'reduce_content'
  | 'notify_professor'
  | 'request_admin';

export interface AIIssue {
  id: string;
  severity: AIIssueSeverity;
  requirement_code: string;
  requirement_title: string;
  description: string;
  location?: string;
  outcome_affected?: string;
  recommendation: string;
}

export interface AISuggestion {
  id: string;
  type: AISuggestionType;
  title: string;
  description: string;
  action_label: string;
  related_professor_name?: string;
  related_course_name?: string;
}

export interface AIAnalysisResult {
  id: string;
  course_id: string;
  target_id: string;
  target_type: 'syllabus' | 'material' | 'scheme_of_work';
  analysis_type: 'syllabus_check' | 'material_check' | 'overlap_check' | 'scheme_of_work_check';
  status: 'pending' | 'complete' | 'error';
  overall_score: number;
  compliance_level: 'full' | 'partial' | 'non_compliant';
  issues: AIIssue[];
  suggestions: string[];
  created_at: string;
}

// ── Material Check (AI curriculum-alignment) ──────────────────────────────────
// Richer alignment result for a single uploaded course material. Stored in the
// EXISTING ai_analysis_results table (analysis_type='material_alignment', the full
// object packed into the suggestions jsonb column) — professor-private, never shown
// to admin. No schema or RLS change.
export type MaterialAlignmentStatus = 'Aligned' | 'Partially Aligned' | 'Not Aligned';

export interface MaterialCheckResult {
  overallStatus: MaterialAlignmentStatus;
  alignmentScore: number;            // 0–100
  overallSummary: string;
  accreditationCheck: {
    coveredStandards: string[];
    missingOrWeakStandards: string[];
    explanation: string;
  };
  schemeOfWorkCheck: {
    matchedWeeksOrTopics: string[];
    missingTopics: string[];
    extraOrUnplannedTopics: string[];
    sequencingIssues: string[];
    explanation: string;
  };
  learningObjectivesCheck: {
    supportedObjectives: string[];
    unsupportedObjectives: string[];
    explanation: string;
  };
  gapsAndProblems: string[];
  recommendations: string[];
  // Display meta (not part of the AI JSON — attached by the caller)
  file_name?: string;
  file_type?: string;
  created_at?: string;
}

// ── Overlaps ──────────────────────────────────────────────────────────────────

export type OverlapSeverity = 'high' | 'medium' | 'low';
export type OverlapStatus =
  | 'open'
  | 'in_discussion'
  | 'resolved_by_professors'
  | 'escalated'
  | 'resolved_by_admin';

// User-facing resolution state for an overlap case (stored in overlap_reports.details).
// Kept separate from the legacy `status` column so existing flows are untouched.
export type OverlapResolutionStatus = 'new' | 'resolved' | 'not_an_issue' | 'needs_discussion';

// Richer overlap data the Course Overlap UI needs, stored in overlap_reports.details
// (jsonb). All fields optional so legacy rows (details = null) still render fine.
export interface OverlapDetails {
  topic_a?: string;
  topic_b?: string;
  week_a?: number | string;
  week_b?: number | string;
  recommendation?: string;
  resolution_status?: OverlapResolutionStatus;
}

export interface OverlapReport {
  id: string;
  course_id_a: string;
  course_name_a: string;
  professor_id_a: string;
  professor_name_a: string;
  program_a?: string;
  course_id_b: string;
  course_name_b: string;
  professor_id_b: string;
  professor_name_b: string;
  program_b?: string;
  overlap_topic: string;
  description: string;
  document_ref_a?: string;
  document_ref_b?: string;
  requirement_ref?: string;
  severity: OverlapSeverity;
  status: OverlapStatus;
  details?: OverlapDetails | null;
  task_generated: boolean;
  created_at: string;
}

export interface ProfessorMessage {
  id: string;
  overlap_report_id: string;
  from_professor_id: string;
  from_professor_name: string;
  to_professor_id: string;
  message: string;
  created_at: string;
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType =
  | 'syllabus_missing'
  | 'syllabus_unlocked'
  | 'overlap_detected'
  | 'missing_requirement'
  | 'material_conflict'
  | 'admin_action';

export interface CourseAlert {
  id: string;
  course_id: string;
  professor_id: string;
  type: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  read: boolean;
  dismissible: boolean;
  overlap_report_id?: string;
  created_at: string;
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export type TaskType = 'resolve_overlap' | 'upload_syllabus' | 'resubmit_syllabus' | 'review_conflict';
export type TaskStatus = 'open' | 'in_progress' | 'resolved';

export interface ProfessorTask {
  id: string;
  course_id: string;
  professor_id: string;
  overlap_report_id?: string;
  type: TaskType;
  title: string;
  description: string;
  status: TaskStatus;
  created_at: string;
  resolved_at?: string;
}

// ── Accreditation Standards ───────────────────────────────────────────────────
// Stored in Supabase, read-only for all users. Only app developers update them.

export interface AccreditationStandard {
  id: string;
  accreditation_type: AccreditationType;
  standard_code: string;
  category: string;
  title: string;
  description: string;
  applies_to: string[];
  requirements: string[];
  created_at: string;
}
