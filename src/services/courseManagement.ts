/**
 * Course Management service — all Supabase calls for the professor CM section.
 *
 * Required Supabase tables (run SQL below in Supabase SQL Editor):
 * ─────────────────────────────────────────────────────────────────
 *
 * course_syllabi
 *   id uuid PK, course_id uuid FK courses, professor_id uuid FK auth.users,
 *   file_name text, file_url text, file_type text, file_size int,
 *   status text CHECK ('submitted','approved','locked','rejected'),
 *   version int DEFAULT 1,
 *   submitted_at timestamptz, approved_at timestamptz, approved_by uuid,
 *   locked_at timestamptz, locked_by uuid,
 *   unlocked_at timestamptz, unlocked_by uuid,
 *   created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
 *
 * syllabus_requests
 *   id uuid PK, course_id uuid FK, professor_id uuid FK,
 *   request_type text CHECK ('initial','replace','unlock'),
 *   file_name text, file_url text, reason text NOT NULL,
 *   status text CHECK ('pending','approved','declined') DEFAULT 'pending',
 *   admin_comment text,
 *   created_at timestamptz DEFAULT now(), resolved_at timestamptz
 *
 * course_materials
 *   id uuid PK, course_id uuid FK, professor_id uuid FK,
 *   title text NOT NULL, description text,
 *   file_name text NOT NULL, file_url text NOT NULL,
 *   file_type text CHECK ('pdf','word','ppt','excel','image','link','other'),
 *   file_size int, week int,
 *   ai_status text CHECK ('not_queued','pending','analysed','error') DEFAULT 'not_queued',
 *   created_at timestamptz DEFAULT now()
 *
 * ai_analysis_results
 *   id uuid PK, course_id uuid FK, target_id uuid, target_type text,
 *   analysis_type text, status text DEFAULT 'pending',
 *   overall_score int, compliance_level text,
 *   issues jsonb DEFAULT '[]', suggestions jsonb DEFAULT '[]',
 *   created_at timestamptz DEFAULT now()
 *
 * overlap_reports
 *   id uuid PK,
 *   course_id_a uuid FK, course_name_a text, professor_id_a uuid, professor_name_a text, program_a text,
 *   course_id_b uuid FK, course_name_b text, professor_id_b uuid, professor_name_b text, program_b text,
 *   overlap_topic text NOT NULL, description text,
 *   document_ref_a text, document_ref_b text, requirement_ref text,
 *   severity text CHECK ('high','medium','low'),
 *   status text CHECK ('open','in_discussion','resolved_by_professors','escalated','resolved_by_admin') DEFAULT 'open',
 *   task_generated boolean DEFAULT false,
 *   created_at timestamptz DEFAULT now()
 *
 * professor_messages
 *   id uuid PK, overlap_report_id uuid FK overlap_reports,
 *   from_professor_id uuid FK, from_professor_name text,
 *   to_professor_id uuid FK,
 *   message text NOT NULL,
 *   created_at timestamptz DEFAULT now()
 *
 * course_alerts
 *   id uuid PK, course_id uuid FK, professor_id uuid FK,
 *   type text, title text, message text,
 *   severity text CHECK ('critical','warning','info'),
 *   read boolean DEFAULT false, dismissible boolean DEFAULT false,
 *   overlap_report_id uuid,
 *   created_at timestamptz DEFAULT now()
 *
 * professor_tasks
 *   id uuid PK, course_id uuid FK, professor_id uuid FK,
 *   overlap_report_id uuid, type text, title text, description text,
 *   status text CHECK ('open','in_progress','resolved') DEFAULT 'open',
 *   created_at timestamptz DEFAULT now(), resolved_at timestamptz
 *
 * accreditation_standards  (developer-managed, read-only for all users)
 *   id uuid PK, accreditation_type text NOT NULL,
 *   standard_code text NOT NULL, category text, title text,
 *   description text, applies_to text[], requirements text[],
 *   created_at timestamptz DEFAULT now()
 *
 * Supabase Storage bucket: 'course-files' (public or signed URLs)
 * RLS: professors can read/write their own rows; admins can read/write all.
 * accreditation_standards: SELECT for all authenticated; INSERT/UPDATE/DELETE only via service_role.
 */

import { supabase } from './supabase';
import {
  CourseSyllabus,
  SyllabusRequest,
  SchemeOfWork,
  SchemeOfWorkRequest,
  CourseMaterial,
  AIAnalysisResult,
  OverlapReport,
  OverlapResolutionStatus,
  ProfessorMessage,
  CourseAlert,
  ProfessorTask,
  AccreditationStandard,
  SchemeTopic,
  MaterialCheckResult,
} from '../types/courseManagement';
import { extractSchemeTopics, compareSchemeTopics } from './aiAnalysis';
import { createNotificationIfNew, notifyAllAdmins } from './notificationService';

// ── Syllabus ──────────────────────────────────────────────────────────────────

export const getCourseSyllabus = async (courseId: string): Promise<CourseSyllabus | null> => {
  const { data, error } = await supabase
    .from('course_syllabi')
    .select('*')
    .eq('course_id', courseId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const getPendingSyllabusRequest = async (courseId: string): Promise<SyllabusRequest | null> => {
  const { data, error } = await supabase
    .from('syllabus_requests')
    .select('*')
    .eq('course_id', courseId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const submitSyllabusRequest = async (
  courseId: string,
  professorId: string,
  requestType: SyllabusRequest['request_type'],
  reason: string,
  fileUrl?: string,
  fileName?: string,
): Promise<void> => {
  const { error } = await supabase.from('syllabus_requests').insert({
    course_id: courseId,
    professor_id: professorId,
    request_type: requestType,
    reason,
    file_url: fileUrl,
    file_name: fileName,
    status: 'pending',
  });
  if (error) throw error;

  // Notify all administrators
  const { data: course } = await supabase
    .from('courses')
    .select('name')
    .eq('id', courseId)
    .maybeSingle();
  const { data: professor } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', professorId)
    .maybeSingle();
  await notifyAdmins(
    `📄 ${requestType === 'replace' ? 'Syllabus Replacement' : 'New Syllabus'} Submitted`,
    `${professor?.full_name ?? 'A professor'} submitted a syllabus for "${course?.name ?? 'a course'}". Reason: ${reason}`,
    'submission_received',
  );
};

// Notify all administrator accounts
const notifyAdmins = async (
  title: string,
  message: string,
  type: string,
  relatedId?: string,
  relatedType?: string,
): Promise<void> => {
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'administrator');
    if (!admins || admins.length === 0) return;
    await supabase.from('notifications').insert(
      admins.map((a: any) => ({
        user_id: a.id,
        title,
        message,
        type,
        related_id: relatedId,
        related_type: relatedType,
        read: false,
      })),
    );
  } catch {}
};

export const submitMaterialForReview = async (
  materialId: string,
  courseId: string,
  professorId: string,
  fileName: string,
): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('course_materials')
    .update({ admin_status: 'pending', submitted_for_review_at: now })
    .eq('id', materialId);
  if (error) throw error;

  const { data: course } = await supabase
    .from('courses')
    .select('name')
    .eq('id', courseId)
    .maybeSingle();
  const { data: professor } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', professorId)
    .maybeSingle();
  await notifyAdmins(
    `📎 Course Material Submitted`,
    `${professor?.full_name ?? 'A professor'} submitted "${fileName}" for "${course?.name ?? 'a course'}" — awaiting your review.`,
    'submission_received',
    materialId,
    'material',
  );
};

export const getSyllabusHistory = async (courseId: string): Promise<CourseSyllabus[]> => {
  const { data, error } = await supabase
    .from('course_syllabi')
    .select('*')
    .eq('course_id', courseId)
    .order('version', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

// ── Scheme of Work ────────────────────────────────────────────────────────────

export const getCourseSchemeOfWork = async (courseId: string): Promise<SchemeOfWork | null> => {
  const { data, error } = await supabase
    .from('scheme_of_work')
    .select('*')
    .eq('course_id', courseId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const getPendingSchemeOfWorkRequest = async (courseId: string): Promise<SchemeOfWorkRequest | null> => {
  const { data, error } = await supabase
    .from('scheme_of_work_requests')
    .select('*')
    .eq('course_id', courseId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const submitSchemeOfWorkRequest = async (
  courseId: string,
  professorId: string,
  requestType: 'initial' | 'replace',
  reason: string,
  fileUrl?: string,
  fileName?: string,
): Promise<void> => {
  const { error } = await supabase.from('scheme_of_work_requests').insert({
    course_id: courseId,
    professor_id: professorId,
    request_type: requestType,
    reason,
    file_url: fileUrl,
    file_name: fileName,
    status: 'pending',
  });
  if (error) throw error;

  const { data: course } = await supabase.from('courses').select('name').eq('id', courseId).maybeSingle();
  const { data: professor } = await supabase.from('profiles').select('full_name').eq('id', professorId).maybeSingle();
  await notifyAdmins(
    `📅 ${requestType === 'replace' ? 'Scheme of Work Replacement' : 'New Scheme of Work'} Submitted`,
    `${professor?.full_name ?? 'A professor'} submitted a scheme of work for "${course?.name ?? 'a course'}". Reason: ${reason}`,
    'submission_received',
  );
};

// ── Materials ─────────────────────────────────────────────────────────────────

export const getCourseMaterials = async (courseId: string): Promise<CourseMaterial[]> => {
  const { data, error } = await supabase
    .from('course_materials')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const addCourseMaterial = async (
  courseId: string,
  professorId: string,
  material: Pick<CourseMaterial, 'title' | 'description' | 'file_name' | 'file_url' | 'file_type' | 'week'>,
): Promise<void> => {
  const { error } = await supabase.from('course_materials').insert({
    ...material,
    course_id: courseId,
    professor_id: professorId,
    ai_status: 'pending',
  });
  if (error) throw error;
};

export const deleteCourseMaterial = async (materialId: string): Promise<void> => {
  const { error } = await supabase.from('course_materials').delete().eq('id', materialId);
  if (error) throw error;
};

// ── AI Analysis ───────────────────────────────────────────────────────────────

export const getAIAnalysis = async (
  courseId: string,
  targetId: string,
): Promise<AIAnalysisResult | null> => {
  const { data, error } = await supabase
    .from('ai_analysis_results')
    .select('*')
    .eq('course_id', courseId)
    .eq('target_id', targetId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const saveAIAnalysis = async (
  result: Omit<AIAnalysisResult, 'id' | 'created_at'>,
): Promise<void> => {
  const { error } = await supabase.from('ai_analysis_results').insert(result);
  if (error) throw error;
};

export const getAllAIAnalysisForCourse = async (courseId: string): Promise<AIAnalysisResult[]> => {
  const { data, error } = await supabase
    .from('ai_analysis_results')
    .select('*')
    .eq('course_id', courseId)
    .eq('status', 'complete')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

// ── Material Check history (professor-private) ────────────────────────────────
// Reuses the EXISTING ai_analysis_results table — no schema/RLS change. The rich
// MaterialCheckResult is packed into the suggestions jsonb column; analysis_type
// 'material_alignment' marks it professor-private. Admin's getOrRunAIAnalysis
// explicitly excludes this type, so it never surfaces in any admin view.
const MATERIAL_ALIGNMENT_TYPE = 'material_alignment';

export const saveMaterialCheckResult = async (
  courseId: string,
  materialId: string,
  result: MaterialCheckResult,
): Promise<void> => {
  const compliance =
    result.overallStatus === 'Aligned' ? 'full'
      : result.overallStatus === 'Not Aligned' ? 'non_compliant'
      : 'partial';
  const { error } = await supabase.from('ai_analysis_results').insert({
    course_id: courseId,
    target_id: materialId,
    target_type: 'material',
    analysis_type: MATERIAL_ALIGNMENT_TYPE,
    status: 'complete',
    overall_score: result.alignmentScore,
    compliance_level: compliance,
    issues: [],
    // Full rich result lives here (jsonb). Read back via getMaterialCheckResult.
    suggestions: [JSON.stringify(result)],
  });
  if (error) throw error;
};

export const getMaterialCheckResult = async (
  courseId: string,
  materialId: string,
): Promise<MaterialCheckResult | null> => {
  const { data, error } = await supabase
    .from('ai_analysis_results')
    .select('*')
    .eq('course_id', courseId)
    .eq('target_id', materialId)
    .eq('analysis_type', MATERIAL_ALIGNMENT_TYPE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  try {
    const raw = Array.isArray(data.suggestions) ? data.suggestions[0] : null;
    if (raw) return { ...(JSON.parse(raw) as MaterialCheckResult), created_at: data.created_at };
  } catch {}
  return null;
};

// ── Overlaps ──────────────────────────────────────────────────────────────────

export const getOverlapReports = async (courseId: string): Promise<OverlapReport[]> => {
  const { data, error } = await supabase
    .from('overlap_reports')
    .select('*')
    .or(`course_id_a.eq.${courseId},course_id_b.eq.${courseId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const updateOverlapStatus = async (
  overlapId: string,
  status: OverlapReport['status'],
): Promise<void> => {
  const { error } = await supabase
    .from('overlap_reports')
    .update({ status })
    .eq('id', overlapId);
  if (error) throw error;
};

export const escalateOverlapToAdmin = async (overlapId: string): Promise<void> => {
  const { error } = await supabase
    .from('overlap_reports')
    .update({ status: 'escalated' })
    .eq('id', overlapId);
  if (error) throw error;
};

export const sendProfessorMessage = async (
  overlapReportId: string,
  fromId: string,
  fromName: string,
  toId: string,
  message: string,
): Promise<void> => {
  const { error } = await supabase.from('professor_messages').insert({
    overlap_report_id: overlapReportId,
    from_professor_id: fromId,
    from_professor_name: fromName,
    to_professor_id: toId,
    message,
  });
  if (error) throw error;
};

export const getMessagesForOverlap = async (overlapReportId: string): Promise<ProfessorMessage[]> => {
  const { data, error } = await supabase
    .from('professor_messages')
    .select('*')
    .eq('overlap_report_id', overlapReportId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
};

// Update an overlap's resolution status (new | resolved | not_an_issue | needs_discussion).
// Stored in the additive `details` jsonb column — the legacy `status` column is left
// untouched so existing professor/admin flows keep working. Read-modify-write so other
// detail fields (topics, weeks, recommendation) are preserved.
export const updateOverlapResolution = async (
  overlapId: string,
  resolutionStatus: OverlapResolutionStatus,
): Promise<void> => {
  const { data } = await supabase
    .from('overlap_reports')
    .select('details')
    .eq('id', overlapId)
    .maybeSingle();
  const nextDetails = { ...(data?.details ?? {}), resolution_status: resolutionStatus };
  const { error } = await supabase
    .from('overlap_reports')
    .update({ details: nextDetails })
    .eq('id', overlapId);
  if (error) throw error;
};

// ── Run Overlap Check (manual, button-triggered) ──────────────────────────────
// Reads the REAL uploaded Scheme of Work records (see two-table note below),
// compares ONLY courses in the SAME program (across all semesters/terms), uses
// Claude for semantic topic comparison, saves new overlap cases to overlap_reports,
// and notifies the affected professors + all admins. Reuses the existing tables,
// storage bucket, courses/profiles connections and notification algorithm.

export type OverlapCheckOutcome =
  | 'created'           // ≥1 new overlap saved
  | 'none'              // compared, no overlaps
  | 'no_data'           // no uploaded Scheme of Work files at all (for this scope)
  | 'one_only'          // exactly 1 Scheme of Work — need a second to compare
  | 'no_program_group'  // ≥2 files but no single program has ≥2
  | 'no_topics';        // files exist but topics could not be extracted

export interface OverlapCheckResult {
  outcome: OverlapCheckOutcome;
  createdCount: number;     // brand-new overlap cases saved this run
  comparedPrograms: number; // programs that had ≥2 schemes to compare
  message: string;          // ready-to-show summary / empty-state message
}

interface EnrichedScheme {
  id: string;
  course_id: string;
  course_name: string;
  program: string;
  professor_id: string;
  professor_name: string;
  file_url: string;
  topics: SchemeTopic[];
  source: 'scheme_of_work' | 'request';
}

// Build a unique, orientation-independent key for an overlap so the same case is
// never saved or notified twice (duplicate prevention requirement).
const overlapKey = (cidA: string, cidB: string, topicA: string, topicB: string): string => {
  const courses = [cidA, cidB].sort().join('|');
  const topics = [topicA.toLowerCase().trim(), topicB.toLowerCase().trim()].sort().join('|');
  return `${courses}::${topics}`;
};

export const runOverlapCheck = async (opts?: { program?: string }): Promise<OverlapCheckResult> => {
  const scope = opts?.program;

  // ── 1. Read the REAL uploaded Scheme of Work records. ──
  // A Scheme of Work first lands in `scheme_of_work_requests` on upload (with its
  // file_url), and is only copied into `scheme_of_work` once the admin approves /
  // locks it. We read BOTH tables so a freshly-uploaded (not-yet-approved) scheme
  // is still found — this was the bug: only `scheme_of_work` was being read.
  const [{ data: sowRows, error: sowErr }, { data: reqRows, error: reqErr }] = await Promise.all([
    supabase.from('scheme_of_work')
      .select('id, course_id, professor_id, file_url, file_name, topics, version')
      .order('version', { ascending: false }),
    supabase.from('scheme_of_work_requests')
      .select('id, course_id, professor_id, file_url, file_name, created_at')
      .order('created_at', { ascending: false }),
  ]);
  if (sowErr) throw sowErr;
  if (reqErr) throw reqErr;

  // Merge to ONE record per course. Prefer the approved scheme_of_work row (it owns
  // the persisted `topics` column); fall back to the latest uploaded request.
  const perCourse = new Map<string, {
    id: string; course_id: string; professor_id: string;
    file_url: string; topics: SchemeTopic[]; source: 'scheme_of_work' | 'request';
  }>();
  for (const r of sowRows ?? []) {
    if (!r.file_url || perCourse.has(r.course_id)) continue;
    perCourse.set(r.course_id, {
      id: r.id, course_id: r.course_id, professor_id: r.professor_id,
      file_url: r.file_url, topics: Array.isArray(r.topics) ? r.topics : [], source: 'scheme_of_work',
    });
  }
  for (const r of reqRows ?? []) {
    if (!r.file_url || perCourse.has(r.course_id)) continue;
    perCourse.set(r.course_id, {
      id: r.id, course_id: r.course_id, professor_id: r.professor_id,
      file_url: r.file_url, topics: [], source: 'request',
    });
  }
  const uploaded = [...perCourse.values()];
  const sowFileCount = (sowRows ?? []).filter(r => r.file_url).length;
  const reqFileCount = (reqRows ?? []).filter(r => r.file_url).length;
  console.log(`[OverlapCheck] uploaded SoW files: ${uploaded.length} courses (scheme_of_work=${sowFileCount}, requests=${reqFileCount})`);

  if (uploaded.length === 0) {
    return { outcome: 'no_data', createdCount: 0, comparedPrograms: 0,
      message: 'No Scheme of Work documents found. Upload a Scheme of Work to run overlap comparison.' };
  }

  // ── 2. Enrich with course (name/program) + professor name, then scope to program. ──
  const courseIds = [...new Set(uploaded.map(s => s.course_id))];
  const profIds   = [...new Set(uploaded.map(s => s.professor_id))];
  const [{ data: courses }, { data: profs }] = await Promise.all([
    supabase.from('courses').select('id, name, program').in('id', courseIds),
    supabase.from('profiles').select('id, full_name').in('id', profIds),
  ]);
  const courseMap = new Map((courses ?? []).map((c: any) => [c.id, c]));
  const profMap   = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));

  let filesWithoutProgram = 0;
  const inScope: EnrichedScheme[] = [];
  for (const s of uploaded) {
    const course = courseMap.get(s.course_id);
    const program = course?.program ?? '';
    const passesFilter = !!program && (!scope || program === scope);
    console.log(`[OverlapCheck]  • course="${course?.name ?? s.course_id}" program="${program || '(none)'}" topics=${s.topics.length} source=${s.source} passesFilter=${passesFilter}`);
    if (!program) { filesWithoutProgram++; continue; }
    if (scope && program !== scope) continue;
    inScope.push({
      id: s.id, course_id: s.course_id, course_name: course?.name ?? 'Unknown course',
      program, professor_id: s.professor_id, professor_name: profMap.get(s.professor_id) ?? 'Unknown professor',
      file_url: s.file_url, topics: s.topics, source: s.source,
    });
  }

  if (inScope.length === 0) {
    const msg = filesWithoutProgram > 0
      ? 'Scheme of Work documents found, but their courses are not assigned to a program, so they cannot be compared.'
      : 'No Scheme of Work documents found for this program.';
    return { outcome: 'no_data', createdCount: 0, comparedPrograms: 0, message: msg };
  }

  // Exactly one Scheme of Work in scope → found, but a second is needed to compare.
  if (inScope.length === 1) {
    return { outcome: 'one_only', createdCount: 0, comparedPrograms: 0,
      message: '1 Scheme of Work found. Upload at least one more Scheme of Work in the same program to run overlap comparison.' };
  }

  // ── 3. Group by program; only programs with ≥2 different courses can be compared. ──
  const byProgram = new Map<string, EnrichedScheme[]>();
  for (const e of inScope) {
    if (!byProgram.has(e.program)) byProgram.set(e.program, []);
    byProgram.get(e.program)!.push(e);
  }
  const comparablePrograms = [...byProgram.entries()]
    .filter(([, list]) => new Set(list.map(s => s.course_id)).size >= 2);
  console.log(`[OverlapCheck] programs=${byProgram.size}, comparable (≥2 courses)=${comparablePrograms.length}`);

  if (comparablePrograms.length === 0) {
    return { outcome: 'no_program_group', createdCount: 0, comparedPrograms: 0,
      message: 'Scheme of Work documents found, but no matching program group has enough documents to compare.' };
  }

  // ── 4. Ensure topics exist for comparable schemes (extract + persist if missing). ──
  // Safe fallback: a file with no extracted topics is run through the existing AI
  // document flow (extractSchemeTopics). Approved rows persist topics; pending
  // request rows have no topics column, so they are extracted fresh each run.
  for (const [, list] of comparablePrograms) {
    for (const s of list) {
      if (s.topics.length > 0) continue;
      try {
        const topics = await extractSchemeTopics(s.file_url);
        s.topics = topics;
        if (topics.length > 0 && s.source === 'scheme_of_work') {
          await supabase.from('scheme_of_work').update({ topics }).eq('id', s.id);
        }
      } catch {
        s.topics = [];
      }
    }
  }

  // Re-evaluate which programs still have ≥2 courses WITH extracted topics.
  const programsWithTopics = comparablePrograms
    .map(([prog, list]) => [prog, list.filter(s => s.topics.length > 0)] as [string, EnrichedScheme[]])
    .filter(([, list]) => new Set(list.map(s => s.course_id)).size >= 2);
  console.log(`[OverlapCheck] comparable programs with extracted topics=${programsWithTopics.length}`);

  if (programsWithTopics.length === 0) {
    return { outcome: 'no_topics', createdCount: 0, comparedPrograms: 0,
      message: 'Scheme of Work file found, but no topics/text have been extracted yet. Please try running the check again in a moment.' };
  }

  // ── 5. Load existing overlaps once for duplicate prevention. ──
  const { data: existing } = await supabase
    .from('overlap_reports')
    .select('course_id_a, course_id_b, overlap_topic, details');
  const seen = new Set<string>();
  for (const r of existing ?? []) {
    const tA = (r as any).details?.topic_a ?? (r as any).overlap_topic ?? '';
    const tB = (r as any).details?.topic_b ?? (r as any).overlap_topic ?? '';
    seen.add(overlapKey(r.course_id_a, r.course_id_b, tA, tB));
  }

  // ── 6. Compare each unique course pair within each comparable program. ──
  let createdCount = 0;
  let comparedPrograms = 0;

  for (const [, list] of programsWithTopics) {
    comparedPrograms++;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.course_id === b.course_id) continue;

        let raw;
        try {
          raw = await compareSchemeTopics(
            { name: a.course_name, topics: a.topics },
            { name: b.course_name, topics: b.topics },
          );
        } catch {
          continue; // AI comparison failed for this pair — skip, keep going
        }

        for (const o of raw) {
          const key = overlapKey(a.course_id, b.course_id, o.topic_a, o.topic_b);
          if (seen.has(key)) continue; // duplicate — don't recreate
          seen.add(key);

          const details = {
            topic_a: o.topic_a, topic_b: o.topic_b,
            week_a: o.week_a, week_b: o.week_b,
            recommendation: o.recommendation,
            resolution_status: 'new' as OverlapResolutionStatus,
          };

          const { data: inserted, error: insErr } = await supabase
            .from('overlap_reports')
            .insert({
              course_id_a: a.course_id, course_name_a: a.course_name,
              professor_id_a: a.professor_id, professor_name_a: a.professor_name, program_a: a.program,
              course_id_b: b.course_id, course_name_b: b.course_name,
              professor_id_b: b.professor_id, professor_name_b: b.professor_name, program_b: b.program,
              overlap_topic: `${o.topic_a} ↔ ${o.topic_b}`,
              description: o.explanation,
              document_ref_a: o.week_a != null ? `Week ${o.week_a}` : null,
              document_ref_b: o.week_b != null ? `Week ${o.week_b}` : null,
              severity: o.severity,
              status: 'open',
              details,
            })
            .select('*')
            .maybeSingle();

          if (insErr || !inserted) continue;
          createdCount++;
          await notifyOverlap(inserted as OverlapReport);
        }
      }
    }
  }

  console.log(`[OverlapCheck] done — comparedPrograms=${comparedPrograms}, new overlaps created=${createdCount}`);
  if (createdCount === 0) {
    return { outcome: 'none', createdCount: 0, comparedPrograms,
      message: 'No course overlaps found for this program.' };
  }
  return { outcome: 'created', createdCount, comparedPrograms,
    message: `${createdCount} course overlap${createdCount === 1 ? '' : 's'} detected.` };
};

// Create notifications for a newly-detected overlap: both affected professors AND
// all admins. Uses the existing dedup-guarded notification helpers (related_id =
// the overlap report id, so the same case never produces duplicate notifications).
const notifyOverlap = async (report: OverlapReport): Promise<void> => {
  const d = report.details ?? {};
  const short =
    `Course overlap detected between ${report.course_name_a} by ${report.professor_name_a} ` +
    `and ${report.course_name_b} by ${report.professor_name_b}.`;
  const full =
    `${short}\n\n` +
    `Overlapping topics:\n` +
    `• Course A: ${d.topic_a ?? report.overlap_topic}${d.week_a != null ? ` — Week ${d.week_a}` : ''}\n` +
    `• Course B: ${d.topic_b ?? report.overlap_topic}${d.week_b != null ? ` — Week ${d.week_b}` : ''}\n\n` +
    `AI explanation:\n${report.description}\n\n` +
    `Recommendation:\n${d.recommendation ?? '—'}`;

  // Both professors involved in the overlap.
  await createNotificationIfNew({
    userId: report.professor_id_a,
    title: '⚠️ Course Overlap Detected',
    message: full,
    type: 'overlap_detected',
    relatedId: report.id,
    relatedType: 'overlap_report',
  });
  await createNotificationIfNew({
    userId: report.professor_id_b,
    title: '⚠️ Course Overlap Detected',
    message: full,
    type: 'overlap_detected',
    relatedId: report.id,
    relatedType: 'overlap_report',
  });
  // All admins.
  await notifyAllAdmins({
    title: '⚠️ Course Overlap Detected',
    message: full,
    type: 'overlap_detected',
    relatedId: report.id,
    relatedType: 'overlap_report',
  });
};

// ── Alerts ────────────────────────────────────────────────────────────────────

export const getCourseAlerts = async (
  courseId: string,
  professorId: string,
): Promise<CourseAlert[]> => {
  const { data, error } = await supabase
    .from('course_alerts')
    .select('*')
    .eq('course_id', courseId)
    .eq('professor_id', professorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const markAlertRead = async (alertId: string): Promise<void> => {
  const { error } = await supabase
    .from('course_alerts')
    .update({ read: true })
    .eq('id', alertId);
  if (error) throw error;
};

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const getProfessorTasks = async (
  courseId: string,
  professorId: string,
): Promise<ProfessorTask[]> => {
  const { data, error } = await supabase
    .from('professor_tasks')
    .select('*')
    .eq('course_id', courseId)
    .eq('professor_id', professorId)
    .neq('status', 'resolved')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const resolveTask = async (taskId: string): Promise<void> => {
  const { error } = await supabase
    .from('professor_tasks')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
};

// ── Accreditation Standards (read-only) ───────────────────────────────────────

export const getAccreditationStandards = async (
  accreditationType: string,
): Promise<AccreditationStandard[]> => {
  const { data, error } = await supabase
    .from('accreditation_standards')
    .select('*')
    .eq('accreditation_type', accreditationType)
    .order('standard_code');
  if (error) throw error;
  return data ?? [];
};

// ── Admin: Syllabus approvals ─────────────────────────────────────────────────

export interface AdminSyllabusRequest {
  id: string;
  course_id: string;
  course_name: string;
  professor_id: string;
  professor_name: string;
  request_type: string;
  reason: string;
  file_name?: string;
  file_url?: string;
  status: string;
  created_at: string;
}

export interface AdminSyllabusRow {
  id: string;
  course_id: string;
  course_name: string;
  professor_id: string;
  professor_name: string;
  file_name?: string;
  file_url?: string;
  status: string;
  version: number;
  submitted_at?: string;
  approved_at?: string;
  locked_at?: string;
}

export const getAllPendingSyllabusRequests = async (): Promise<AdminSyllabusRequest[]> => {
  const { data, error } = await supabase
    .from('syllabus_requests')
    .select('*, courses(name), profiles(full_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    course_id: r.course_id,
    course_name: r.courses?.name ?? 'Unknown course',
    professor_id: r.professor_id,
    professor_name: r.profiles?.full_name ?? 'Unknown professor',
    request_type: r.request_type,
    reason: r.reason,
    file_name: r.file_name,
    file_url: r.file_url,
    status: r.status,
    created_at: r.created_at,
  }));
};

export const getAllSyllabi = async (): Promise<AdminSyllabusRow[]> => {
  const { data, error } = await supabase
    .from('course_syllabi')
    .select('*, courses(name), profiles(full_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    course_id: r.course_id,
    course_name: r.courses?.name ?? 'Unknown course',
    professor_id: r.professor_id,
    professor_name: r.profiles?.full_name ?? 'Unknown professor',
    file_name: r.file_name,
    file_url: r.file_url,
    status: r.status,
    version: r.version,
    submitted_at: r.submitted_at,
    approved_at: r.approved_at,
    locked_at: r.locked_at,
  }));
};

export const approveSyllabusRequest = async (
  request: AdminSyllabusRequest,
  adminId: string,
): Promise<void> => {
  const now = new Date().toISOString();

  // Upsert syllabus row (insert if none, update if exists)
  const { data: existing } = await supabase
    .from('course_syllabi')
    .select('id, version')
    .eq('course_id', request.course_id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('course_syllabi')
      .update({ status: 'approved', approved_at: now, approved_by: adminId, updated_at: now })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('course_syllabi').insert({
      course_id: request.course_id,
      professor_id: request.professor_id,
      file_name: request.file_name ?? '',
      file_url: request.file_url ?? '',
      file_type: 'pdf',
      status: 'approved',
      version: 1,
      submitted_at: request.created_at,
      approved_at: now,
      approved_by: adminId,
    });
    if (error) throw error;
  }

  // Mark the request resolved
  const { error: reqError } = await supabase
    .from('syllabus_requests')
    .update({ status: 'approved', resolved_at: now })
    .eq('id', request.id);
  if (reqError) throw reqError;
};

export const declineSyllabusRequest = async (
  requestId: string,
  adminComment: string,
): Promise<void> => {
  const { error } = await supabase
    .from('syllabus_requests')
    .update({ status: 'declined', admin_comment: adminComment, resolved_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
};

export const lockSyllabus = async (syllabusId: string, adminId: string): Promise<void> => {
  const { error } = await supabase
    .from('course_syllabi')
    .update({ status: 'locked', locked_at: new Date().toISOString(), locked_by: adminId, updated_at: new Date().toISOString() })
    .eq('id', syllabusId);
  if (error) throw error;
};

export const unlockSyllabus = async (syllabusId: string, adminId: string): Promise<void> => {
  const { error } = await supabase
    .from('course_syllabi')
    .update({ status: 'approved', unlocked_at: new Date().toISOString(), unlocked_by: adminId, updated_at: new Date().toISOString() })
    .eq('id', syllabusId);
  if (error) throw error;
};

// ── File upload (Supabase Storage) ────────────────────────────────────────────
// Requires expo-document-picker + expo-file-system in package.json.
// Install: npx expo install expo-document-picker expo-file-system
// Bucket:  create 'course-files' in Supabase Storage (public or RLS-protected).

export const uploadCourseFile = async (
  localUri: string,
  remotePath: string,
  mimeType: string,
  fileObject?: File,
): Promise<string> => {
  let body: Blob | File;

  if (fileObject) {
    // Web: use the File object directly — most reliable
    body = fileObject;
  } else if (localUri.startsWith('blob:') || localUri.startsWith('data:')) {
    // Web fallback: fetch the blob URL
    const response = await fetch(localUri);
    body = await response.blob();
  } else {
    // Native: read the file via fetch
    const response = await fetch(localUri);
    body = await response.blob();
  }

  const { data, error } = await supabase.storage
    .from('course-files')
    .upload(remotePath, body, { contentType: mimeType, upsert: true });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from('course-files').getPublicUrl(data.path);
  return urlData.publicUrl;
};
