import { supabase } from './supabase';
import {
  HomeworkAlignmentCheck,
  HomeworkGradingBatch,
  HomeworkStudentResult,
  HomeworkHistoryItem,
  HomeworkHistoryRecord,
} from '../types/homeworkAssistance';

// ── Course context types ───────────────────────────────────────────────────────

export interface CourseContext {
  syllabusText: string;
  syllabusFileUrl: string;
  learningObjectives: string[];
  schemeOfWorkText: string;
  schemeOfWorkFileUrl: string;
  schemeOfWorkWeeks: SchemeWeek[];
  materialsText: string;
  accreditationStandards: string;
  program: string;
  semester: string;
}

interface SchemeWeek {
  week: number;
  topic: string;
  description?: string;
}

export interface RelatedCourse {
  id: string;
  name: string;
  professor_name: string;
  program: string;
  semester: string;
}

// ── Fetch locked course context ────────────────────────────────────────────────

export const fetchLockedCourseContext = async (courseId: string): Promise<CourseContext> => {
  // Fetch locked syllabus — required
  const { data: syllabusData, error: syllabusError } = await supabase
    .from('course_syllabi')
    .select('*')
    .eq('course_id', courseId)
    .eq('status', 'locked')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (syllabusError || !syllabusData) {
    throw new Error('No locked syllabus found. The course syllabus must be locked by the administrator before running homework checks.');
  }

  // Fetch locked scheme of work — optional, enhances AI context
  const { data: sowData } = await supabase
    .from('scheme_of_work')
    .select('file_url, file_name, status')
    .eq('course_id', courseId)
    .eq('status', 'locked')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const schemeOfWorkFileUrl: string = sowData?.file_url ?? '';
  const schemeOfWorkText = sowData?.file_name
    ? `Scheme of Work document: ${sowData.file_name}`
    : 'No scheme of work uploaded yet.';

  // Fetch course materials titles
  const { data: materialsData } = await supabase
    .from('course_materials')
    .select('title, description, week')
    .eq('course_id', courseId)
    .order('week', { ascending: true });

  const materialsText = (materialsData ?? [])
    .map((m: { title: string; description?: string; week?: number }) =>
      `Week ${m.week ?? '?'}: ${m.title}${m.description ? ' — ' + m.description : ''}`)
    .join('\n');

  // Fetch institution settings for accreditation
  const { data: settingsData } = await supabase
    .from('institution_settings')
    .select('accreditation, programs')
    .limit(1)
    .single();

  const accreditationStandards = settingsData?.accreditation ?? 'AACSB';

  // Fetch course info for program/semester
  const { data: courseData } = await supabase
    .from('courses')
    .select('program, semester')
    .eq('id', courseId)
    .single();

  return {
    syllabusText: `Syllabus file: ${syllabusData.file_name}`,
    syllabusFileUrl: syllabusData.file_url,
    learningObjectives: [],
    schemeOfWorkText,
    schemeOfWorkFileUrl,
    schemeOfWorkWeeks: [],
    materialsText,
    accreditationStandards,
    program: courseData?.program ?? '',
    semester: courseData?.semester ?? '',
  };
};

// ── Fetch related courses ──────────────────────────────────────────────────────

export const fetchRelatedCourses = async (
  courseId: string,
  program: string,
  semester: string,
): Promise<RelatedCourse[]> => {
  const { data, error } = await supabase
    .from('courses')
    .select('id, name, program, semester, teacher_id')
    .eq('program', program)
    .eq('semester', semester)
    .neq('id', courseId);

  if (error || !data) return [];

  const teacherIds = [...new Set((data as { teacher_id?: string }[]).map(c => c.teacher_id).filter(Boolean))];

  let teacherMap: Record<string, string> = {};
  if (teacherIds.length > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', teacherIds as string[]);
    if (profilesData) {
      teacherMap = Object.fromEntries((profilesData as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));
    }
  }

  return (data as { id: string; name: string; program: string; semester: string; teacher_id?: string }[]).map(c => ({
    id: c.id,
    name: c.name,
    professor_name: c.teacher_id ? (teacherMap[c.teacher_id] ?? 'Unknown') : 'Unknown',
    program: c.program ?? '',
    semester: c.semester ?? '',
  }));
};

// ── Save alignment check ───────────────────────────────────────────────────────

export const saveAlignmentCheck = async (
  result: Omit<HomeworkAlignmentCheck, 'id' | 'created_at' | 'updated_at'>,
): Promise<HomeworkAlignmentCheck> => {
  const payload = {
    ...result,
    uploaded_file_urls: result.uploaded_file_urls,
    covered_learning_objectives: result.covered_learning_objectives,
    missing_learning_objectives: result.missing_learning_objectives,
    overlap_details: result.overlap_details,
    ai_recommendations: result.ai_recommendations,
    generated_tasks: result.generated_tasks,
  };

  const { data, error } = await supabase
    .from('homework_alignment_checks')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as HomeworkAlignmentCheck;
};

// ── Save grading batch ─────────────────────────────────────────────────────────

export const saveGradingBatch = async (
  batch: Omit<HomeworkGradingBatch, 'id' | 'created_at' | 'updated_at'>,
): Promise<HomeworkGradingBatch> => {
  const { student_results, ...rest } = batch;

  // TypeScript's Omit only strips fields from the type — at runtime the caller
  // may still pass id / created_at / updated_at (e.g. the local batch object has
  // a non-UUID placeholder like "batch-1748523456789").  Strip them explicitly so
  // Postgres always generates a proper UUID primary key.
  const {
    id: _id,
    created_at: _ca,
    updated_at: _ua,
    ...insertPayload
  } = rest as any;

  const { data, error } = await supabase
    .from('homework_grading_batches')
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;
  return data as HomeworkGradingBatch;
};

// ── Save student result ────────────────────────────────────────────────────────

export const saveStudentResult = async (
  result: Omit<HomeworkStudentResult, 'id' | 'created_at' | 'updated_at'>,
): Promise<HomeworkStudentResult> => {
  // Same defensive strip — callers should not pass id/timestamps but guard at
  // runtime so non-UUID placeholder IDs never reach the DB.
  const {
    id: _id,
    created_at: _ca,
    updated_at: _ua,
    ...insertPayload
  } = result as any;

  const { data, error } = await supabase
    .from('homework_student_results')
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;
  return data as HomeworkStudentResult;
};

// ── Update student result ──────────────────────────────────────────────────────

export const updateStudentResult = async (
  id: string,
  updates: Partial<HomeworkStudentResult>,
): Promise<HomeworkStudentResult> => {
  const { data, error } = await supabase
    .from('homework_student_results')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as HomeworkStudentResult;
};

// ── Fetch homework assistance history ─────────────────────────────────────────

export const fetchHomeworkAssistanceHistory = async (
  professorId: string,
): Promise<HomeworkHistoryItem[]> => {
  const [alignmentRes, gradingRes] = await Promise.all([
    supabase
      .from('homework_alignment_checks')
      .select('id, professor_id, course_id, course_name, homework_title, alignment_percentage, created_at')
      .eq('professor_id', professorId)
      .order('created_at', { ascending: false }),
    supabase
      .from('homework_grading_batches')
      .select('id, professor_id, course_id, course_name, assignment_title, created_at')
      .eq('professor_id', professorId)
      .order('created_at', { ascending: false }),
  ]);

  const alignmentItems: HomeworkHistoryItem[] = ((alignmentRes.data ?? []) as {
    id: string; professor_id: string; course_id: string; course_name: string;
    homework_title: string; alignment_percentage: number; created_at: string;
  }[]).map(item => ({
    id: `alignment-${item.id}`,
    professor_id: item.professor_id,
    course_id: item.course_id,
    course_name: item.course_name,
    check_type: 'alignment' as const,
    related_check_id: item.id,
    summary: `Alignment check for "${item.homework_title}"`,
    alignment_percentage: item.alignment_percentage,
    assignment_title: item.homework_title,
    created_at: item.created_at,
  }));

  const gradingItems: HomeworkHistoryItem[] = ((gradingRes.data ?? []) as {
    id: string; professor_id: string; course_id: string; course_name: string;
    assignment_title: string; created_at: string;
  }[]).map(item => ({
    id: `grading-${item.id}`,
    professor_id: item.professor_id,
    course_id: item.course_id,
    course_name: item.course_name,
    check_type: 'grading' as const,
    related_check_id: item.id,
    summary: `Grading batch for "${item.assignment_title}"`,
    assignment_title: item.assignment_title,
    created_at: item.created_at,
  }));

  const all = [...alignmentItems, ...gradingItems];
  all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return all;
};

// ── Homework History (professor-only graded homework) ─────────────────────────
// Reads the existing homework_student_results joined to their parent
// homework_grading_batches, scoped to the logged-in professor via the batch's
// professor_id. No new table / no policy change. RLS already restricts a
// professor to their own batches' results.

const deriveFileName = (url: string): string => {
  if (!url) return '';
  try {
    const last = url.split('/').pop() ?? '';
    const decoded = decodeURIComponent(last);
    // Storage paths are prefixed with a timestamp (e.g. "1748523456789_File.pdf")
    return decoded.replace(/^\d+_/, '');
  } catch {
    return '';
  }
};

export const fetchProfessorHomeworkHistory = async (
  professorId: string,
): Promise<HomeworkHistoryRecord[]> => {
  const { data, error } = await supabase
    .from('homework_student_results')
    .select(`
      *,
      homework_grading_batches!inner(
        id, professor_id, course_id, course_name, assignment_title, rubric_text
      )
    `)
    .eq('homework_grading_batches.professor_id', professorId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as any[]).map(row => {
    const batch = row.homework_grading_batches ?? {};
    return {
      id:                row.id,
      batch_id:          row.batch_id,
      professor_id:      batch.professor_id ?? professorId,
      course_id:         batch.course_id ?? '',
      course_name:       batch.course_name ?? '',
      assignment_title:  batch.assignment_title ?? 'Assignment',
      topic_name:        row.topic_name ?? undefined,
      student_id:        row.student_id ?? undefined,
      student_name:      row.student_name ?? 'Unknown',
      uploaded_file_name: deriveFileName(row.submission_file_url ?? ''),
      submission_file_url: row.submission_file_url ?? '',
      rubric_used:       batch.rubric_text ?? '',
      grade_justification: row.grade_justification ?? '',
      strengths:         row.strengths ?? [],
      weaknesses:        row.weaknesses ?? [],
      improvement_recommendations: row.improvement_recommendations ?? [],
      missing_requirements: row.missing_requirements ?? [],
      plagiarism_risk_summary: row.plagiarism_risk_summary ?? '',
      student_feedback_draft: row.student_feedback_draft ?? '',
      original_ai_feedback: row.original_ai_feedback || undefined,
      overall_suggested_grade: row.overall_suggested_grade ?? 0,
      professor_edited_grade: row.professor_edited_grade ?? undefined,
      grade_points:      row.grade_points ?? undefined,
      total_points:      row.total_points ?? undefined,
      professor_edited_feedback: row.professor_edited_feedback || undefined,
      professor_note:    row.professor_note || undefined,
      professor_status:  (row.professor_status ?? 'pending') as HomeworkHistoryRecord['professor_status'],
      approved_at:       row.approved_at ?? undefined,
      checked_at:        row.created_at,
      updated_at:        row.updated_at,
    };
  });
};

// Delete a single saved homework history item (one student result row).
// RLS "professors_manage_own_student_results" (FOR ALL) authorises the delete
// only when the row's batch belongs to the logged-in professor.
export const deleteHomeworkResult = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('homework_student_results')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// ── Enrolled students ─────────────────────────────────────────────────────────

export interface EnrolledStudent {
  id: string;
  full_name: string;
  email?: string;
}

export const fetchCourseEnrolledStudents = async (
  courseId: string,
): Promise<EnrolledStudent[]> => {
  const { data, error } = await supabase
    .from('course_enrollments')
    .select('students(id, full_name, email)')
    .eq('course_id', courseId);

  if (error || !data) return [];

  return (data as any[])
    .map(row => ({
      id: (row.students as any)?.id ?? '',
      full_name: (row.students as any)?.full_name ?? 'Unknown',
      email: (row.students as any)?.email ?? undefined,
    }))
    .filter(s => s.id !== '');
};

// ── Student homework results (for student profile / admin view) ────────────────

export interface StudentHomeworkRecord {
  id: string;
  batch_id: string;
  course_id: string;
  course_name: string;
  assignment_title: string;
  student_name: string;
  overall_suggested_grade: number;
  grade_points?: number;
  total_points?: number;
  rubric_criterion_grades: import('../types/homeworkAssistance').RubricCriterionGrade[];
  grade_justification: string;
  strengths: string[];
  weaknesses: string[];
  improvement_recommendations?: string[];
  missing_requirements: string[];
  original_ai_feedback?: string;
  student_feedback_draft: string;
  professor_edited_grade?: number;
  professor_edited_feedback?: string;
  professor_note?: string;
  professor_status: string;
  approved_at?: string;
  created_at: string;
}

export const fetchStudentHomeworkResults = async (
  studentId: string,
): Promise<StudentHomeworkRecord[]> => {
  const { data, error } = await supabase
    .from('homework_student_results')
    .select(`
      *,
      homework_grading_batches!inner(course_id, course_name, assignment_title)
    `)
    .eq('student_id', studentId)
    .eq('professor_status', 'approved')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as any[]).map(row => ({
    id: row.id,
    batch_id: row.batch_id,
    course_id: row.homework_grading_batches?.course_id ?? '',
    course_name: row.homework_grading_batches?.course_name ?? '',
    assignment_title: row.homework_grading_batches?.assignment_title ?? '',
    student_name: row.student_name,
    overall_suggested_grade: row.overall_suggested_grade,
    grade_points: row.grade_points ?? undefined,
    total_points: row.total_points ?? undefined,
    rubric_criterion_grades: row.rubric_criterion_grades ?? [],
    grade_justification: row.grade_justification ?? '',
    strengths: row.strengths ?? [],
    weaknesses: row.weaknesses ?? [],
    improvement_recommendations: row.improvement_recommendations?.length
      ? row.improvement_recommendations : undefined,
    missing_requirements: row.missing_requirements ?? [],
    original_ai_feedback: row.original_ai_feedback || undefined,
    student_feedback_draft: row.student_feedback_draft ?? '',
    professor_edited_grade: row.professor_edited_grade ?? undefined,
    professor_edited_feedback: row.professor_edited_feedback || undefined,
    professor_note: row.professor_note || undefined,
    professor_status: row.professor_status,
    approved_at: row.approved_at ?? undefined,
    created_at: row.created_at,
  }));
};

// ── Student course homework results (professor view — filtered by course) ─────

export interface CourseHomeworkRecord {
  id: string;
  assignment_title: string;
  overall_suggested_grade: number;
  grade_points?: number;
  total_points?: number;
  professor_edited_grade?: number;
  professor_edited_feedback?: string;
  student_feedback_draft: string;
  // AI-generated neutral summary fields (used to build the performance summary)
  grade_justification: string;
  strengths: string[];
  weaknesses: string[];
  improvement_recommendations: string[];
  approved_at?: string;
  created_at: string;
}

export const fetchStudentCourseHomeworkResults = async (
  studentId: string,
  courseId: string,
): Promise<CourseHomeworkRecord[]> => {
  // Step 1: get batch IDs (and titles) for this course
  const { data: batches, error: batchError } = await supabase
    .from('homework_grading_batches')
    .select('id, assignment_title')
    .eq('course_id', courseId);

  if (batchError || !batches || (batches as any[]).length === 0) return [];

  const batchIds = (batches as { id: string; assignment_title: string }[]).map(b => b.id);
  const batchTitleMap: Record<string, string> = Object.fromEntries(
    (batches as { id: string; assignment_title: string }[]).map(b => [b.id, b.assignment_title]),
  );

  // Step 2: get approved results for this student in those batches
  const { data, error } = await supabase
    .from('homework_student_results')
    .select(
      'id, batch_id, overall_suggested_grade, grade_points, total_points, ' +
      'professor_edited_grade, professor_edited_feedback, student_feedback_draft, ' +
      'grade_justification, strengths, weaknesses, improvement_recommendations, ' +
      'approved_at, created_at',
    )
    .eq('student_id', studentId)
    .eq('professor_status', 'approved')
    .in('batch_id', batchIds)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as any[]).map(row => ({
    id:                         row.id,
    assignment_title:           batchTitleMap[row.batch_id] ?? 'Assignment',
    overall_suggested_grade:    row.overall_suggested_grade ?? 0,
    grade_points:               row.grade_points   ?? undefined,
    total_points:               row.total_points   ?? undefined,
    professor_edited_grade:     row.professor_edited_grade ?? undefined,
    professor_edited_feedback:  row.professor_edited_feedback ?? undefined,
    student_feedback_draft:     row.student_feedback_draft ?? '',
    grade_justification:        row.grade_justification ?? '',
    strengths:                  row.strengths ?? [],
    weaknesses:                 row.weaknesses ?? [],
    improvement_recommendations: row.improvement_recommendations ?? [],
    approved_at:                row.approved_at ?? undefined,
    created_at:                 row.created_at,
  }));
};

// ── Upload homework file ───────────────────────────────────────────────────────

export const uploadHomeworkFile = async (
  fileUri: string,
  fileName: string,
  mimeType: string,
  fileObject?: File,
): Promise<string> => {
  let body: Blob | File;
  const remotePath = `homework/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  if (fileObject) {
    body = fileObject;
  } else if (fileUri.startsWith('blob:') || fileUri.startsWith('data:')) {
    const response = await fetch(fileUri);
    body = await response.blob();
  } else {
    const response = await fetch(fileUri);
    body = await response.blob();
  }

  const { data, error } = await supabase.storage
    .from('course-files')
    .upload(remotePath, body, { contentType: mimeType, upsert: true });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from('course-files').getPublicUrl(data.path);
  return urlData.publicUrl;
};
