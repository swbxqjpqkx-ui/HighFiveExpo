import { supabase } from './supabase';
import { analyseDocumentWithAI } from './aiAnalysis';
import { AIAnalysisResult, OverlapDetails } from '../types/courseManagement';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SubmissionType = 'syllabus' | 'material' | 'scheme_of_work';
export type SubmissionStatus = 'pending' | 'approved' | 'declined' | 'changes_requested' | 'locked';
export type AICheckStatus = 'not_run' | 'running' | 'pass' | 'issues' | 'fail';
export type OverlapSeverity = 'critical' | 'high' | 'medium' | 'low';
export type NotifType =
  | 'submission_received'
  | 'approved'
  | 'declined'
  | 'changes_requested'
  | 'overlap_detected'
  | 'task_assigned'
  | 'resubmitted';

export interface PendingSubmission {
  id: string;
  type: SubmissionType;
  course_id: string;
  course_name: string;
  program?: string;
  semester?: string;
  professor_id: string;
  professor_name: string;
  file_name?: string;
  file_url?: string;
  file_type?: string;
  reason?: string;
  admin_comment?: string;
  submitted_at: string;
  status: SubmissionStatus;
  ai_status: AICheckStatus;
  ai_score?: number;
  ai_issues_count?: number;
}

export interface InstitutionOverlap {
  id: string;
  course_id_a: string;
  course_name_a: string;
  professor_name_a: string;
  program_a?: string;
  course_id_b: string;
  course_name_b: string;
  professor_name_b: string;
  program_b?: string;
  overlap_topic: string;
  description: string;
  document_ref_a?: string;
  document_ref_b?: string;
  requirement_ref?: string;
  severity: OverlapSeverity;
  status: string;
  details?: OverlapDetails | null;
  created_at: string;
  suggestions?: string[];
}

export interface AdminNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotifType;
  related_id?: string;
  related_type?: string;
  read: boolean;
  created_at: string;
}

// ── Pending submissions ───────────────────────────────────────────────────────

export const getAllPendingSubmissions = async (): Promise<PendingSubmission[]> => {
  const results: PendingSubmission[] = [];

  // Helper: fetch professor names in bulk
  const fetchNames = async (ids: string[]): Promise<Record<string, string>> => {
    if (ids.length === 0) return {};
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', ids);
    return Object.fromEntries((data ?? []).map((p: any) => [p.id, p.full_name]));
  };

  // Syllabi — all except locked (pending, approved, declined, changes_requested)
  try {
    const { data, error } = await supabase
      .from('syllabus_requests')
      .select('*, courses(name, program, semester)')
      .not('status', 'eq', 'locked')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const names = await fetchNames([...new Set(data.map((r: any) => r.professor_id))]);
      data.forEach((r: any) => {
        results.push({
          id: r.id,
          type: 'syllabus',
          course_id: r.course_id,
          course_name: r.courses?.name ?? 'Unknown course',
          program: r.courses?.program,
          semester: r.courses?.semester,
          professor_id: r.professor_id,
          professor_name: names[r.professor_id] ?? 'Unknown professor',
          file_name: r.file_name,
          file_url: r.file_url,
          file_type: 'pdf',
          reason: r.reason,
          admin_comment: r.admin_comment,
          submitted_at: r.created_at,
          status: r.status as SubmissionStatus,
          ai_status: 'not_run',
        });
      });
    }
  } catch {}

  // Materials — only pending admin review
  try {
    const { data, error } = await supabase
      .from('course_materials')
      .select('*, courses(name, program, semester)')
      .eq('admin_status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const names = await fetchNames([...new Set(data.map((r: any) => r.professor_id))]);
      data.forEach((r: any) => {
        results.push({
          id: r.id,
          type: 'material',
          course_id: r.course_id,
          course_name: r.courses?.name ?? 'Unknown course',
          program: r.courses?.program,
          semester: r.courses?.semester,
          professor_id: r.professor_id,
          professor_name: names[r.professor_id] ?? 'Unknown professor',
          file_name: r.file_name,
          file_url: r.file_url,
          file_type: r.file_type,
          admin_comment: r.admin_comment,
          submitted_at: r.submitted_for_review_at ?? r.created_at,
          status: (r.admin_status ?? 'pending') as SubmissionStatus,
          ai_status: 'not_run',
        });
      });
    }
  } catch {}

  // Scheme of Work — all except locked (pending, approved, declined, changes_requested)
  try {
    const { data, error } = await supabase
      .from('scheme_of_work_requests')
      .select('*, courses(name, program, semester)')
      .not('status', 'eq', 'locked')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const names = await fetchNames([...new Set(data.map((r: any) => r.professor_id))]);
      data.forEach((r: any) => {
        results.push({
          id: r.id,
          type: 'scheme_of_work',
          course_id: r.course_id,
          course_name: r.courses?.name ?? 'Unknown course',
          program: r.courses?.program,
          semester: r.courses?.semester,
          professor_id: r.professor_id,
          professor_name: names[r.professor_id] ?? 'Unknown professor',
          file_name: r.file_name,
          file_url: r.file_url,
          file_type: 'pdf',
          reason: r.reason,
          admin_comment: r.admin_comment,
          submitted_at: r.created_at,
          status: r.status as SubmissionStatus,
          ai_status: 'not_run',
        });
      });
    }
  } catch {}

  return results.sort(
    (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
  );
};

// ── AI analysis ───────────────────────────────────────────────────────────────

export const getOrRunAIAnalysis = async (
  submission: PendingSubmission,
  accreditationType: string,
): Promise<AIAnalysisResult> => {
  // Try to load existing analysis from Supabase
  try {
    const { data } = await supabase
      .from('ai_analysis_results')
      .select('*')
      .eq('course_id', submission.course_id)
      .eq('target_id', submission.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as AIAnalysisResult;
  } catch {}

  // Run real AI analysis if file URL exists, otherwise throw
  const fileUrl = (submission as any).file_url;
  if (!fileUrl) throw new Error('No file uploaded for this submission — AI analysis requires an uploaded document.');
  return analyseDocumentWithAI(
    fileUrl,
    submission.course_id,
    submission.id,
    submission.type,
    accreditationType,
    submission.program,
  );
};

// ── Approval actions ──────────────────────────────────────────────────────────

export const approveSubmission = async (
  submission: PendingSubmission,
  adminId: string,
): Promise<void> => {
  const now = new Date().toISOString();

  if (submission.type === 'syllabus') {
    // Update syllabus_requests
    const { error: reqErr } = await supabase
      .from('syllabus_requests')
      .update({ status: 'approved', resolved_at: now })
      .eq('id', submission.id);
    if (reqErr) throw reqErr;

    // Upsert course_syllabi
    const { data: existing } = await supabase
      .from('course_syllabi')
      .select('id, version')
      .eq('course_id', submission.course_id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('course_syllabi')
        .update({ status: 'approved', approved_at: now, approved_by: adminId, updated_at: now })
        .eq('id', existing.id);
    } else {
      await supabase.from('course_syllabi').insert({
        course_id: submission.course_id,
        professor_id: submission.professor_id,
        file_name: submission.file_name ?? '',
        file_url: '',
        file_type: 'pdf',
        status: 'approved',
        version: 1,
        submitted_at: submission.submitted_at,
        approved_at: now,
        approved_by: adminId,
      });
    }
  } else if (submission.type === 'scheme_of_work') {
    const { error: reqErr } = await supabase
      .from('scheme_of_work_requests')
      .update({ status: 'approved', resolved_at: now })
      .eq('id', submission.id);
    if (reqErr) throw reqErr;

    const { data: existing } = await supabase
      .from('scheme_of_work')
      .select('id, version')
      .eq('course_id', submission.course_id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('scheme_of_work')
        .update({ status: 'approved', approved_at: now, approved_by: adminId, updated_at: now })
        .eq('id', existing.id);
    } else {
      await supabase.from('scheme_of_work').insert({
        course_id: submission.course_id,
        professor_id: submission.professor_id,
        file_name: submission.file_name ?? '',
        file_url: submission.file_url ?? '',
        file_type: 'pdf',
        status: 'approved',
        version: 1,
        submitted_at: submission.submitted_at,
        approved_at: now,
        approved_by: adminId,
      });
    }
  } else {
    await supabase
      .from('course_materials')
      .update({ admin_status: 'approved', resolved_at: now })
      .eq('id', submission.id);
  }

  const typeLabel =
    submission.type === 'syllabus' ? 'Syllabus' :
    submission.type === 'scheme_of_work' ? 'Scheme of Work' : 'Material';

  await notifyProfessor(
    submission.professor_id,
    `✓ ${typeLabel} Approved`,
    `Your ${typeLabel.toLowerCase()} for "${submission.course_name}" has been approved.`,
    'approved',
    submission.id,
    submission.type,
  );
};

export const declineSubmission = async (
  submission: PendingSubmission,
  reason: string,
): Promise<void> => {
  const now = new Date().toISOString();
  if (submission.type === 'syllabus') {
    const { error } = await supabase
      .from('syllabus_requests')
      .update({ status: 'declined', admin_comment: reason, resolved_at: now })
      .eq('id', submission.id);
    if (error) throw error;
  } else if (submission.type === 'scheme_of_work') {
    const { error } = await supabase
      .from('scheme_of_work_requests')
      .update({ status: 'declined', admin_comment: reason, resolved_at: now })
      .eq('id', submission.id);
    if (error) throw error;
  } else {
    await supabase
      .from('course_materials')
      .update({ admin_status: 'declined', admin_comment: reason, resolved_at: now })
      .eq('id', submission.id);
  }

  const typeLabel =
    submission.type === 'syllabus' ? 'Syllabus' :
    submission.type === 'scheme_of_work' ? 'Scheme of Work' : 'Material';

  await notifyProfessor(
    submission.professor_id,
    `✕ ${typeLabel} Declined`,
    `Your ${typeLabel.toLowerCase()} for "${submission.course_name}" was declined. Reason: ${reason}`,
    'declined',
    submission.id,
    submission.type,
  );
};

export const requestChanges = async (
  submission: PendingSubmission,
  comment: string,
): Promise<void> => {
  const now = new Date().toISOString();
  if (submission.type === 'syllabus') {
    const { error } = await supabase
      .from('syllabus_requests')
      .update({ status: 'changes_requested', admin_comment: comment })
      .eq('id', submission.id);
    if (error) throw error;
  } else if (submission.type === 'scheme_of_work') {
    const { error } = await supabase
      .from('scheme_of_work_requests')
      .update({ status: 'changes_requested', admin_comment: comment })
      .eq('id', submission.id);
    if (error) throw error;
  } else {
    await supabase
      .from('course_materials')
      .update({ admin_status: 'changes_requested', admin_comment: comment })
      .eq('id', submission.id);
  }

  const typeLabel =
    submission.type === 'syllabus' ? 'syllabus' :
    submission.type === 'scheme_of_work' ? 'scheme of work' : 'material';

  await notifyProfessor(
    submission.professor_id,
    `📝 Changes Requested`,
    `Changes requested for your ${typeLabel} in "${submission.course_name}": ${comment}`,
    'changes_requested',
    submission.id,
    submission.type,
  );
};

export const lockSyllabusByAdminCourse = async (
  courseId: string,
  adminId: string,
  fallbackProfessorId?: string,
): Promise<void> => {
  // Find any approved or submitted syllabus for this course
  let { data } = await supabase
    .from('course_syllabi')
    .select('id, professor_id')
    .eq('course_id', courseId)
    .in('status', ['approved', 'submitted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    // Fallback: create the record now using professor info from the request
    const pid = fallbackProfessorId;
    if (!pid) throw new Error('No syllabus record found to lock.');
    const { data: ins, error: insErr } = await supabase
      .from('course_syllabi')
      .insert({
        course_id: courseId,
        professor_id: pid,
        file_name: '',
        file_url: '',
        file_type: 'pdf',
        status: 'locked',
        version: 1,
        submitted_at: new Date().toISOString(),
      })
      .select('id, professor_id')
      .single();
    if (insErr) throw insErr;
    data = ins;
  } else {
    const { error } = await supabase
      .from('course_syllabi')
      .update({ status: 'locked' })
      .eq('id', data.id);
    if (error) throw error;
  }

  // Mark the syllabus_request as locked so it disappears from pending list
  await supabase
    .from('syllabus_requests')
    .update({ status: 'locked' })
    .eq('course_id', courseId)
    .in('status', ['approved', 'pending']);

  const { data: course } = await supabase
    .from('courses')
    .select('name')
    .eq('id', courseId)
    .maybeSingle();

  const professorId = data?.professor_id ?? fallbackProfessorId;
  if (professorId) {
    await notifyProfessor(
      professorId,
      '🔒 Syllabus Locked — Materials Unlocked',
      `Your syllabus for "${course?.name ?? 'your course'}" has been locked by the administrator. You can now upload course materials — each will be reviewed against your approved syllabus and AACSB standards.`,
      'approved',
      data?.id,
      'syllabus',
    );
  }
};

export const lockSchemeOfWorkByAdminCourse = async (
  courseId: string,
  adminId: string,
  fallbackProfessorId?: string,
): Promise<void> => {
  let { data } = await supabase
    .from('scheme_of_work')
    .select('id, professor_id')
    .eq('course_id', courseId)
    .in('status', ['approved', 'submitted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    const pid = fallbackProfessorId;
    if (!pid) throw new Error('No scheme of work record found to lock.');
    const { data: ins, error: insErr } = await supabase
      .from('scheme_of_work')
      .insert({
        course_id: courseId,
        professor_id: pid,
        file_name: '',
        file_url: '',
        file_type: 'pdf',
        status: 'locked',
        version: 1,
        submitted_at: new Date().toISOString(),
      })
      .select('id, professor_id')
      .single();
    if (insErr) throw insErr;
    data = ins;
  } else {
    const { error } = await supabase
      .from('scheme_of_work')
      .update({ status: 'locked', locked_at: new Date().toISOString(), locked_by: adminId })
      .eq('id', data.id);
    if (error) throw error;
  }

  await supabase
    .from('scheme_of_work_requests')
    .update({ status: 'locked' })
    .eq('course_id', courseId)
    .in('status', ['approved', 'pending']);

  const { data: course } = await supabase
    .from('courses')
    .select('name')
    .eq('id', courseId)
    .maybeSingle();

  const professorId = data?.professor_id ?? fallbackProfessorId;
  if (professorId) {
    await notifyProfessor(
      professorId,
      '🔒 Scheme of Work Locked',
      `Your scheme of work for "${course?.name ?? 'your course'}" has been locked by the administrator. AI analysis is now active.`,
      'approved',
      data?.id,
      'scheme_of_work',
    );
  }
};

// ── Institution overlaps ──────────────────────────────────────────────────────

export const getAllInstitutionOverlaps = async (): Promise<InstitutionOverlap[]> => {
  // Admin sees ALL overlap cases across every program and professor.
  const { data, error } = await supabase
    .from('overlap_reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InstitutionOverlap[];
};

// ── Notifications ─────────────────────────────────────────────────────────────

export const notifyProfessor = async (
  professorId: string,
  title: string,
  message: string,
  type: NotifType,
  relatedId?: string,
  relatedType?: string,
): Promise<void> => {
  try {
    await supabase.from('notifications').insert({
      user_id: professorId,
      title,
      message,
      type,
      related_id: relatedId,
      related_type: relatedType,
      read: false,
    });
  } catch {}
};

export const getAdminNotifications = async (adminId: string): Promise<AdminNotification[]> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', adminId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) return data as AdminNotification[];
  } catch {}
  return MOCK_ADMIN_NOTIFICATIONS;
};

export const markNotificationRead = async (id: string): Promise<void> => {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
};

export const markAllNotificationsRead = async (adminId: string): Promise<void> => {
  await supabase.from('notifications').update({ read: true }).eq('user_id', adminId).eq('read', false);
};

export const createProfessorTask = async (
  courseId: string,
  professorId: string,
  title: string,
  description: string,
  overlapReportId?: string,
): Promise<void> => {
  const { error } = await supabase.from('professor_tasks').insert({
    course_id: courseId,
    professor_id: professorId,
    overlap_report_id: overlapReportId,
    type: 'admin_assigned',
    title,
    description,
    status: 'open',
  });
  if (error) throw error;

  await notifyProfessor(
    professorId,
    `📋 New Task: ${title}`,
    description,
    'task_assigned',
    overlapReportId,
    'overlap_report',
  );
};

// ── Mock admin notifications (fallback) ───────────────────────────────────────

const MOCK_ADMIN_NOTIFICATIONS: AdminNotification[] = [
  {
    id: 'n1',
    user_id: 'admin',
    title: '📄 New Syllabus Submitted',
    message: 'Azaliia Ibragimova submitted a syllabus for Strategic Management — awaiting your review.',
    type: 'submission_received',
    read: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'n2',
    user_id: 'admin',
    title: '⚠️ Overlap Detected',
    message: "AI detected a content overlap between Strategic Management and Marketing Principles on Porter's Five Forces.",
    type: 'overlap_detected',
    read: false,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'n3',
    user_id: 'admin',
    title: '📎 Material Uploaded',
    message: 'Azaliia Ibragimova uploaded "Week 3 – Lecture Slides.pdf" for Strategic Management.',
    type: 'submission_received',
    read: true,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];
