import { supabase } from './supabase';

// Professor-facing notification access. Uses the EXISTING `notifications` table
// (columns: id, user_id, title, message, type, related_id, related_type, read,
// created_at) — the same table the admin side and notifyProfessor() already use.
// No schema, RLS, or policy changes.

export type ProfessorNotifType =
  // Document workflow (already emitted by adminAccreditation.notifyProfessor)
  | 'approved'
  | 'declined'
  | 'changes_requested'
  | 'submission_received'
  | 'resubmitted'
  | 'task_assigned'
  // Cross-cutting
  | 'overlap_detected'
  | 'student_at_risk'
  | 'new_article'
  | 'calendar_reminder'
  | 'approval_sent'
  // Admin-only (delivered to administrator accounts via notifyAllAdmins)
  | 'calendar_event'
  | 'student_serious'
  | 'open_day_update'
  | string;

export interface ProfessorNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: ProfessorNotifType;
  related_id?: string | null;
  related_type?: string | null;
  read: boolean;
  created_at: string;
}

// Maps a notification type to the EXISTING professor drawer route that should
// open when "See full version" is clicked. Returns null for types with no page.
export const routeForNotifType = (type: string): string | null => {
  switch (type) {
    case 'approved':
    case 'declined':
    case 'changes_requested':
    case 'submission_received':
    case 'resubmitted':
      return 'CourseManagement';   // document / material / approval status
    case 'overlap_detected':
      return 'CourseManagement';   // Course Management → Course Overlap (Overlap Reports tab)
    case 'task_assigned':
      return 'QualityControl';     // course overlap / AI analysis
    case 'student_at_risk':
      return 'Warnings';           // student grade / absence warning
    case 'homework_feedback':
    case 'homework':
      return 'HomeworkAssistance'; // homework / homework checker feedback
    case 'new_article':
      return 'News';               // news / articles
    case 'calendar_reminder':
      return 'Home';               // calendar / events live on the dashboard
    case 'approval_sent':
      return 'QualityControl';
    default:
      return null;
  }
};

// ── Exact-entity routing ──────────────────────────────────────────────────────
// A notification points at a drawer route AND (when resolvable) an exact entity
// on that route, so "Open details"/"See full version"/card-tap land on the precise
// item rather than the generic page. Focus carries just enough for the destination
// screen to auto-select + highlight; `nonce` forces re-trigger on repeat clicks.

export interface NotificationFocus {
  kind: 'document' | 'student' | 'overlap';
  courseId?: string;
  // CourseManagement (documents / overlaps): which tab to open.
  tab?: 'guidelines' | 'materials' | 'overlaps' | 'alerts';
  submissionId?: string;
  // Warnings (student at risk): which student to highlight.
  studentId?: string;
  nonce?: number;
}

export interface NotificationDestination {
  route: string | null;
  focus: NotificationFocus | null;
}

// Submission `type` → the tables whose row id may appear in related_id (each
// carries a `course_id` column). Document notifications point at different tables
// depending on the stage: a pending submission lives in the `*_requests` table,
// while a *locked* document (e.g. "Syllabus Locked — Materials Unlocked") points
// at the finalised `course_syllabi` / `scheme_of_work` record. We try each in
// order so the redirect resolves the exact course in every case.
const DOC_COURSE_TABLES: Record<string, string[]> = {
  syllabus: ['syllabus_requests', 'course_syllabi'],
  scheme_of_work: ['scheme_of_work_requests', 'scheme_of_work'],
  material: ['course_materials'],
};

// Read-only lookup of a submission's course. Document notifications store the
// submission id in related_id but no course_id, so we resolve it here. Never
// throws — routing falls back to the generic page when this returns null.
export const resolveDocumentCourseId = async (
  docType: string | null | undefined,
  submissionId: string | null | undefined,
): Promise<string | null> => {
  const tables = docType ? DOC_COURSE_TABLES[docType] : undefined;
  if (!tables || !submissionId) return null;
  for (const table of tables) {
    try {
      const { data } = await supabase
        .from(table)
        .select('course_id')
        .eq('id', submissionId)
        .maybeSingle();
      if (data?.course_id) return data.course_id as string;
    } catch {
      /* table not present / not readable — try the next candidate */
    }
  }
  return null;
};

// For an overlap notification, find WHICH course (of the two in the overlap) the
// recipient professor teaches, so Course Management opens that course's Overlap tab.
// Read-only; never throws — returns null when it can't resolve (safe page fallback).
export const resolveOverlapCourseId = async (
  overlapId: string | null | undefined,
  professorUserId: string,
): Promise<string | null> => {
  if (!overlapId) return null;
  try {
    const { data } = await supabase
      .from('overlap_reports')
      .select('course_id_a, professor_id_a, course_id_b, professor_id_b')
      .eq('id', overlapId)
      .maybeSingle();
    if (!data) return null;
    if (data.professor_id_b === professorUserId) return data.course_id_b as string;
    return (data.course_id_a as string) ?? null; // default to course A
  } catch {
    return null;
  }
};

// Resolve the exact destination (route + focus) for a notification. Async because
// document notifications need a read-only submission→course_id lookup. Always
// returns a route when one exists; focus is null when the exact entity can't be
// resolved (the screen then just opens normally — a safe fallback, never a crash).
export const getNotificationDestination = async (
  n: ProfessorNotification,
): Promise<NotificationDestination> => {
  const route = routeForNotifType(n.type);
  const nonce = Date.now();

  switch (n.type) {
    // Document workflow → exact course + the tab that holds this submission.
    case 'approved':
    case 'declined':
    case 'changes_requested':
    case 'submission_received':
    case 'resubmitted': {
      const docType = n.related_type ?? null;
      const tab: NotificationFocus['tab'] = docType === 'material' ? 'materials' : 'guidelines';
      const courseId = await resolveDocumentCourseId(docType, n.related_id ?? null);
      if (!courseId) {
        // Not enough data to open the exact course — the route's generic page is
        // the safe fallback (req. fallback rule). Surface it for developers.
        console.warn('Notification missing destination data', n);
        return { route, focus: null };
      }
      return {
        route,
        focus: { kind: 'document', courseId, tab, submissionId: n.related_id ?? undefined, nonce },
      };
    }

    // Course overlap → open Course Management on the recipient's course + Overlap tab.
    case 'overlap_detected': {
      const courseId = await resolveOverlapCourseId(n.related_id ?? null, n.user_id);
      if (!courseId) return { route, focus: null };
      return { route, focus: { kind: 'overlap', courseId, tab: 'overlaps', nonce } };
    }

    // Student at risk → exact student in course context (related_id = `studentId:courseId`).
    case 'student_at_risk': {
      const [studentId, courseId] = (n.related_id ?? '').split(':');
      if (!studentId) {
        console.warn('Notification missing destination data', n);
        return { route, focus: null };
      }
      return {
        route,
        focus: { kind: 'student', studentId, courseId: courseId || undefined, nonce },
      };
    }

    // Types without an exact-detail route (or not yet generated) open their page.
    default:
      return { route, focus: null };
  }
};

// ── Admin-side routing ────────────────────────────────────────────────────────
// Admin notifications reuse the SAME `notifications` table + the SAME bell/banner
// components, but map to the ADMIN drawer routes. Kept entirely separate from the
// professor resolvers above so professor behaviour is never touched. Admin-only
// isolation is inherent: these rows are inserted with administrator user_ids, so a
// professor's by-user_id fetch never returns them.
export const adminRouteForNotifType = (type: string): string | null => {
  switch (type) {
    // Syllabus / scheme / material sent for approval → Pending Approvals
    // (the default tab of the Material Management / AdminAccreditation screen).
    case 'submission_received':
    case 'resubmitted':
    case 'overlap_detected':
      return 'AdminAccreditation';
    case 'calendar_event':
      return 'AdminCalendar';
    case 'student_serious':
      return 'AdminStudentCoordination';
    case 'open_day_update':
      return 'AdminOpenDay';
    default:
      return null;
  }
};

// Exact entity an admin notification points at on its destination screen. Page-level
// redirect always works; focus is carried when a related id exists so a screen that
// supports it can deep-link. `nonce` forces re-trigger on repeat clicks.
export interface AdminNotificationFocus {
  kind: 'approval' | 'calendar' | 'student' | 'open_day' | 'overlap';
  eventId?: string;
  studentId?: string;
  itemId?: string;
  nonce?: number;
}

export interface AdminNotificationDestination {
  route: string | null;
  focus: AdminNotificationFocus | null;
}

// Resolve the admin destination (route + optional focus) for a notification.
// Never throws; logs a developer warning and falls back to the route's page when
// the exact entity can't be resolved.
export const getAdminNotificationDestination = (
  n: ProfessorNotification,
): AdminNotificationDestination => {
  const route = adminRouteForNotifType(n.type);
  const nonce = Date.now();
  switch (n.type) {
    case 'overlap_detected':
      // Admin Material Management → Overlap Review tab.
      return { route, focus: { kind: 'overlap', nonce } };
    case 'calendar_event':
      return { route, focus: n.related_id ? { kind: 'calendar', eventId: n.related_id, nonce } : null };
    case 'student_serious': {
      const [studentId] = (n.related_id ?? '').split(':');
      return { route, focus: studentId ? { kind: 'student', studentId, nonce } : null };
    }
    case 'open_day_update':
      return { route, focus: n.related_id ? { kind: 'open_day', itemId: n.related_id, nonce } : null };
    default:
      if (!route) console.warn('Admin notification missing destination', n);
      return { route, focus: null };
  }
};

// Fan-out a notification to every administrator account. Reuses createNotificationIfNew
// per admin so the same duplicate-guard (one unread per user+type+related_id) applies.
// Best-effort — never throws, so the underlying business action is never broken.
export const notifyAllAdmins = async (params: {
  title: string;
  message: string;
  type: ProfessorNotifType;
  relatedId?: string | null;
  relatedType?: string | null;
}): Promise<void> => {
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'administrator');
    if (!admins || admins.length === 0) return;
    await Promise.all(
      admins.map((a: any) =>
        createNotificationIfNew({
          userId: a.id,
          title: params.title,
          message: params.message,
          type: params.type,
          relatedId: params.relatedId ?? null,
          relatedType: params.relatedType ?? null,
        }),
      ),
    );
  } catch {
    /* swallow — notifications are best-effort */
  }
};

// Short human label for the notification's context chip on the full card.
export const notifTypeLabel = (type: string): string => {
  switch (type) {
    case 'approved':            return 'Document approved';
    case 'declined':            return 'Document rejected';
    case 'changes_requested':   return 'Changes requested';
    case 'submission_received': return 'Submission';
    case 'resubmitted':         return 'Resubmitted';
    case 'task_assigned':       return 'Task assigned';
    case 'overlap_detected':    return 'Course overlap';
    case 'student_at_risk':     return 'Student at risk';
    case 'new_article':         return 'New article';
    case 'calendar_reminder':   return 'Calendar reminder';
    case 'approval_sent':       return 'Comparison sent';
    case 'calendar_event':      return 'Calendar event';
    case 'student_serious':     return 'Serious student case';
    case 'open_day_update':     return 'Open Day update';
    default:                    return 'Notification';
  }
};

// Fetch the latest notifications addressed to this professor (newest first).
export const getProfessorNotifications = async (
  userId: string,
): Promise<ProfessorNotification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ProfessorNotification[];
};

// Same query, role-neutral name — used by the admin bell. The fetch is purely
// by user_id, so it returns whatever notifications target that account (admin or
// professor). Kept as an alias to avoid duplicating the query.
export const getNotificationsForUser = getProfessorNotifications;

export const markNotificationRead = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw error;
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
};

export const deleteNotification = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// Create a notification, skipping it if an UNREAD one with the same
// (user_id + type + related_id) already exists — strong duplicate prevention so
// repeated risk re-checks / re-fetches don't spam the professor. Never throws:
// notification creation must never break the underlying business action.
export const createNotificationIfNew = async (params: {
  userId: string;
  title: string;
  message: string;
  type: ProfessorNotifType;
  relatedId?: string | null;
  relatedType?: string | null;
}): Promise<void> => {
  try {
    if (params.relatedId) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', params.userId)
        .eq('type', params.type)
        .eq('related_id', params.relatedId)
        .eq('read', false)
        .limit(1);
      if (existing && existing.length > 0) return; // duplicate — skip
    }
    await supabase.from('notifications').insert({
      user_id: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      related_id: params.relatedId ?? null,
      related_type: params.relatedType ?? null,
      read: false,
    });
  } catch {
    /* swallow — notifications are best-effort */
  }
};
