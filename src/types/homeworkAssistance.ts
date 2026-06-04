// ── Homework Assistance Types ─────────────────────────────────────────────────

export type AlignmentStatus =
  | 'strongly_aligned'
  | 'mostly_aligned'
  | 'partially_aligned'
  | 'not_aligned';

export interface OverlapDetail {
  course_name: string;
  professor_name?: string;
  overlap_description: string;
  severity: 'high' | 'medium' | 'low';
}

export interface GeneratedTask {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'done';
}

export interface RubricCriterionGrade {
  criterion: string;
  max_score: number;
  suggested_score: number;
  explanation: string;
}

export interface HomeworkAlignmentCheck {
  id: string;
  professor_id: string;
  course_id: string;
  course_name: string;
  homework_title: string;
  homework_text: string;
  uploaded_file_urls: string[];
  alignment_percentage: number;
  alignment_status: AlignmentStatus;
  covered_learning_objectives: string[];
  missing_learning_objectives: string[];
  syllabus_alignment_summary: string;
  scheme_of_work_alignment_summary: string;
  accreditation_alignment_summary: string;
  program_alignment_summary: string;
  overlap_detected: boolean;
  overlap_details: OverlapDetail[];
  ai_recommendations: string[];
  suggested_revised_homework: string;
  generated_tasks: GeneratedTask[];
  professor_edits?: string;
  created_at: string;
  updated_at: string;
}

export interface HomeworkGradingBatch {
  id: string;
  professor_id: string;
  course_id: string;
  course_name: string;
  assignment_title: string;
  assignment_instructions: string;
  rubric_text: string;
  rubric_file_urls: string[];
  status: 'pending' | 'processing' | 'complete' | 'error';
  student_results: HomeworkStudentResult[];
  created_at: string;
  updated_at: string;
}

export type MatchConfidence = 'confirmed' | 'unclear' | 'unmatched' | 'pending';

export interface HomeworkStudentResult {
  id: string;
  batch_id: string;

  // Student identity
  student_name: string;
  student_id?: string;                          // matched enrolled student UUID
  match_confidence?: MatchConfidence;

  // Submission
  submission_file_url: string;

  // Grades
  overall_suggested_grade: number;
  grade_points?: number;                        // points scored (e.g. 30)
  total_points?: number;                        // max points in rubric (e.g. 40)

  // AI output
  rubric_criterion_grades: RubricCriterionGrade[];
  grade_justification: string;
  strengths: string[];
  weaknesses: string[];
  improvement_recommendations?: string[];       // separate actionable improvements
  missing_requirements: string[];
  plagiarism_risk_summary: string;
  original_ai_feedback?: string;               // preserved AI draft before professor edits
  student_feedback_draft: string;

  // Professor review
  professor_edited_grade?: number;
  professor_edited_feedback?: string;
  professor_note?: string;                     // private professor note
  professor_status: 'pending' | 'approved' | 'rejected' | 'draft';
  approved_at?: string;

  created_at: string;
  updated_at: string;
}

export interface HomeworkHistoryItem {
  id: string;
  professor_id: string;
  course_id: string;
  course_name: string;
  check_type: 'alignment' | 'grading';
  related_check_id: string;
  summary: string;
  alignment_percentage?: number;
  assignment_title?: string;
  student_count?: number;
  created_at: string;
}
