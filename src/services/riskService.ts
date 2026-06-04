import { supabase } from './supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RiskSettings {
  id:                     string;
  grade_limit_percentage: number;
  absence_limit_count:    number;
  updated_at?:            string;
  created_at?:            string;
}

export interface RiskWarning {
  id:                        string;
  student_id:                string;
  course_id:                 string;
  professor_id:              string | null;
  program:                   string | null;
  semester:                  string | null;
  grade_percentage:          number | null;
  missed_classes_count:      number | null;
  risk_reason:               string;
  status:                    'active' | 'resolved';
  course_help_email_sent:    boolean;
  absence_policy_email_sent: boolean;
  last_email_sent_at:        string | null;
  resolved_by:               string | null;
  resolved_at:               string | null;
  resolution_note:           string | null;
  created_at:                string;
  updated_at:                string;
  // joined
  student_name:    string;
  student_email:   string;
  course_name:     string;
  professor_name:  string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const SELECT_FIELDS = `
  *,
  students(full_name, email),
  courses(name, program, semester),
  profiles!professor_id(full_name)
`;

const mapRow = (row: any): RiskWarning => ({
  ...row,
  student_name:   row.students?.full_name  ?? 'Unknown',
  student_email:  row.students?.email       ?? '',
  course_name:    row.courses?.name         ?? 'Unknown',
  program:        row.courses?.program      ?? row.program  ?? null,
  semester:       row.courses?.semester     ?? row.semester ?? null,
  professor_name: row.profiles?.full_name   ?? 'Not assigned',
});

const buildRiskReason = (gradeBad: boolean, absenceBad: boolean): string => {
  if (gradeBad && absenceBad) return 'Grade and absences both at risk';
  if (gradeBad)               return 'Grade below admin limit';
  return 'Absences reached or exceeded admin limit';
};

// ── Risk Settings ──────────────────────────────────────────────────────────────

export const getRiskSettings = async (): Promise<RiskSettings | null> => {
  const { data } = await supabase
    .from('risk_settings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as RiskSettings | null;
};

export const saveRiskSettings = async (
  grade_limit_percentage: number,
  absence_limit_count:    number,
  userId:                 string,
): Promise<void> => {
  const existing = await getRiskSettings();
  if (existing?.id) {
    const { error } = await supabase
      .from('risk_settings')
      .update({
        grade_limit_percentage,
        absence_limit_count,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('risk_settings')
      .insert({ grade_limit_percentage, absence_limit_count, created_by: userId });
    if (error) throw error;
  }
};

// ── Risk Detection ─────────────────────────────────────────────────────────────
// Runs automatically on screen load and after settings change.
// Creates/updates warnings for at-risk students and auto-resolves those no longer at risk.

export const runRiskDetection = async (professorId?: string): Promise<void> => {
  const settings = await getRiskSettings();
  if (!settings) return;

  // 1. Resolve which course IDs to scan
  let courseIds: string[];

  if (professorId) {
    // Scope to this professor's courses via the junction table
    const { data: ctData, error: ctErr } = await supabase
      .from('course_teachers')
      .select('course_id')
      .eq('teacher_id', professorId);
    if (ctErr || !ctData?.length) return;
    courseIds = (ctData as any[]).map(r => r.course_id as string);
  } else {
    // Admin path: all courses
    const { data: allCourses, error: allErr } = await supabase
      .from('courses')
      .select('id');
    if (allErr || !allCourses?.length) return;
    courseIds = (allCourses as any[]).map(c => c.id as string);
  }

  // 2. Fetch course details for those IDs
  const { data: courses, error: courseErr } = await supabase
    .from('courses')
    .select('id, name, program, semester, teacher_id')
    .in('id', courseIds);
  if (courseErr || !courses?.length) return;

  const courseMap = new Map((courses as any[]).map(c => [c.id, c]));

  // 2. Fetch all enrollments for these courses
  const { data: enrollments, error: enrolErr } = await supabase
    .from('course_enrollments')
    .select('student_id, course_id, grade, missed_classes')
    .in('course_id', courseIds);
  if (enrolErr || !enrollments?.length) return;

  const now = new Date().toISOString();
  const atRiskKeys = new Set<string>();
  const upserts: any[] = [];

  // 3. Evaluate each enrollment
  for (const row of enrollments as any[]) {
    const course = courseMap.get(row.course_id);
    if (!course) continue;

    const grade  = row.grade          ?? null;
    const missed = row.missed_classes ?? null;
    const gradeBad   = grade  !== null && grade  <  settings.grade_limit_percentage;
    const absenceBad = missed !== null && missed >= settings.absence_limit_count;

    if (gradeBad || absenceBad) {
      atRiskKeys.add(`${row.student_id}||${row.course_id}`);
      upserts.push({
        student_id:           row.student_id,
        course_id:            row.course_id,
        // Use the explicit professorId when provided so the warning is
        // always queryable by getWarningsForProfessor(professorId)
        professor_id:         professorId ?? course.teacher_id ?? null,
        program:              course.program    ?? null,
        semester:             course.semester   ?? null,
        grade_percentage:     grade,
        missed_classes_count: missed,
        risk_reason:          buildRiskReason(gradeBad, absenceBad),
        status:               'active',
        updated_at:           now,
      });
    }
  }

  // 4. Upsert all at-risk warnings.
  // Split by whether we have a professor_id: rows with a known professor_id
  // are upserted fully; rows without one use ignoreDuplicates so we never
  // overwrite an existing professor_id with null.
  if (upserts.length) {
    const withProf    = upserts.filter(u => u.professor_id != null);
    const withoutProf = upserts.filter(u => u.professor_id == null);

    if (withProf.length) {
      await supabase
        .from('risk_warnings')
        .upsert(withProf, { onConflict: 'student_id,course_id' });
    }
    if (withoutProf.length) {
      // ignoreDuplicates: true → insert only, never overwrite an existing row
      // (so a previously-set professor_id is preserved)
      await supabase
        .from('risk_warnings')
        .upsert(withoutProf, { onConflict: 'student_id,course_id', ignoreDuplicates: true });
    }
  }

  // 5. Auto-resolve active warnings where student is no longer at risk
  const { data: activeWarnings } = await supabase
    .from('risk_warnings')
    .select('id, student_id, course_id')
    .in('course_id', courseIds)
    .eq('status', 'active');

  const toResolve = ((activeWarnings ?? []) as any[])
    .filter(w => !atRiskKeys.has(`${w.student_id}||${w.course_id}`))
    .map(w => w.id);

  if (toResolve.length) {
    await supabase
      .from('risk_warnings')
      .update({
        status:          'resolved',
        resolved_at:     now,
        resolution_note: 'Auto-resolved: student no longer meets risk criteria',
        updated_at:      now,
      })
      .in('id', toResolve);
  }
};

// ── Professor at-risk fetch (direct from enrollments) ─────────────────────────
// Bypasses risk_warnings as source of truth — computes from course_enrollments
// directly so the page shows data even before runRiskDetection has ever been run.

export type ProfessorEmptyReason = 'no_courses' | 'no_students' | 'no_at_risk' | null;

export interface FetchProfessorAtRiskResult {
  warnings:    RiskWarning[];
  settings:    RiskSettings | null;
  emptyReason: ProfessorEmptyReason;
}

export const fetchProfessorAtRiskStudents = async (
  professorId: string,
): Promise<FetchProfessorAtRiskResult> => {
  const settings = await getRiskSettings();

  // 1. Dual-path course lookup: courses.teacher_id → course_teachers fallback
  let courseIds: string[] = [];
  const { data: directCourses } = await supabase
    .from('courses')
    .select('id')
    .eq('teacher_id', professorId);

  if (directCourses && directCourses.length > 0) {
    courseIds = (directCourses as any[]).map(c => c.id as string);
  } else {
    const { data: ctData } = await supabase
      .from('course_teachers')
      .select('course_id')
      .eq('teacher_id', professorId);
    courseIds = ((ctData ?? []) as any[]).map(c => c.course_id as string);
  }

  if (!courseIds.length) {
    return { warnings: [], settings, emptyReason: 'no_courses' };
  }

  if (!settings) {
    // Settings not configured — still return courses-exist state so UI can explain
    return { warnings: [], settings, emptyReason: 'no_at_risk' };
  }

  // 2. Fetch course details
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, program, semester, teacher_id')
    .in('id', courseIds);

  const courseMap = new Map(((courses ?? []) as any[]).map(c => [c.id, c]));

  // 3. Fetch enrollments with student join
  const { data: enrollments, error: enrolErr } = await supabase
    .from('course_enrollments')
    .select('student_id, course_id, grade, missed_classes, students(id, full_name, email)')
    .in('course_id', courseIds);

  if (enrolErr) {
    console.error('[fetchProfessorAtRiskStudents] enrollment error:', enrolErr.message);
    throw enrolErr;
  }

  if (!enrollments?.length) {
    return { warnings: [], settings, emptyReason: 'no_students' };
  }

  // 4. Evaluate which students are at risk
  const now = new Date().toISOString();
  const atRiskKeys = new Set<string>();
  const upserts: any[] = [];

  for (const row of enrollments as any[]) {
    const course = courseMap.get(row.course_id);
    if (!course) continue;

    const grade  = row.grade          ?? null;
    const missed = row.missed_classes ?? null;
    const gradeBad   = grade  !== null && grade  <  settings.grade_limit_percentage;
    const absenceBad = missed !== null && missed >= settings.absence_limit_count;

    if (gradeBad || absenceBad) {
      atRiskKeys.add(`${row.student_id}||${row.course_id}`);
      upserts.push({
        student_id:           row.student_id,
        course_id:            row.course_id,
        professor_id:         professorId,
        program:              course.program  ?? null,
        semester:             course.semester ?? null,
        grade_percentage:     grade,
        missed_classes_count: missed,
        risk_reason:          buildRiskReason(gradeBad, absenceBad),
        status:               'active',
        updated_at:           now,
      });
    }
  }

  // 5. Upsert at-risk rows (preserves email flags via merge)
  if (upserts.length) {
    const { error: upsertErr } = await supabase
      .from('risk_warnings')
      .upsert(upserts, { onConflict: 'student_id,course_id' });
    if (upsertErr) {
      console.error('[fetchProfessorAtRiskStudents] upsert error:', upsertErr.message);
    }
  }

  // 6. Auto-resolve warnings no longer at risk
  const { data: activeWarnings } = await supabase
    .from('risk_warnings')
    .select('id, student_id, course_id')
    .in('course_id', courseIds)
    .eq('status', 'active');

  const toResolve = ((activeWarnings ?? []) as any[])
    .filter(w => !atRiskKeys.has(`${w.student_id}||${w.course_id}`))
    .map(w => w.id as string);

  if (toResolve.length) {
    await supabase
      .from('risk_warnings')
      .update({
        status:          'resolved',
        resolved_at:     now,
        resolution_note: 'Auto-resolved: student no longer meets risk criteria',
        updated_at:      now,
      })
      .in('id', toResolve);
  }

  if (!atRiskKeys.size) {
    return { warnings: [], settings, emptyReason: 'no_at_risk' };
  }

  // 7. Fetch final list with joins (includes email tracking flags)
  const { data, error } = await supabase
    .from('risk_warnings')
    .select(SELECT_FIELDS)
    .eq('professor_id', professorId)
    .order('status')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return {
    warnings:    ((data ?? []) as any[]).map(mapRow),
    settings,
    emptyReason: null,
  };
};

// ── Queries ────────────────────────────────────────────────────────────────────

export const getWarningsForProfessor = async (
  professorId: string,
): Promise<RiskWarning[]> => {
  const { data, error } = await supabase
    .from('risk_warnings')
    .select(SELECT_FIELDS)
    .eq('professor_id', professorId)
    .order('status')               // 'active' sorts before 'resolved'
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map(mapRow);
};

export const getAllWarningsForAdmin = async (): Promise<RiskWarning[]> => {
  // Fetch warnings; also pull courses.teacher_id so we can resolve the
  // professor name even when risk_warnings.professor_id is null.
  const { data, error } = await supabase
    .from('risk_warnings')
    .select(`
      *,
      students(full_name, email),
      courses(name, program, semester, teacher_id),
      profiles!professor_id(full_name)
    `)
    .order('status')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as any[];

  // Collect course teacher_ids where the direct professor_id join returned nothing.
  const missingIds = [
    ...new Set(
      rows
        .filter(r => !r.profiles?.full_name && r.courses?.teacher_id)
        .map(r => r.courses.teacher_id as string),
    ),
  ];

  // Batch-fetch those profile names in a single extra query.
  const teacherMap = new Map<string, string>();
  if (missingIds.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', missingIds);
    (profs ?? []).forEach((p: any) => teacherMap.set(p.id, p.full_name));
  }

  return rows.map(row => ({
    ...mapRow(row),
    professor_name:
      row.profiles?.full_name ??
      teacherMap.get(row.courses?.teacher_id) ??
      'Not assigned',
  }));
};

// ── Mutations ──────────────────────────────────────────────────────────────────

export const markEmailSent = async (
  warningId: string,
  type: 'course_help' | 'absence_policy',
): Promise<void> => {
  const patch: Record<string, any> = { last_email_sent_at: new Date().toISOString() };
  if (type === 'course_help')    patch.course_help_email_sent    = true;
  if (type === 'absence_policy') patch.absence_policy_email_sent = true;
  const { error } = await supabase.from('risk_warnings').update(patch).eq('id', warningId);
  if (error) throw error;
};

export const resolveWarning = async (
  warningId: string,
  resolvedBy: string,
  note:       string,
): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('risk_warnings')
    .update({
      status:          'resolved',
      resolved_by:     resolvedBy,
      resolved_at:     now,
      resolution_note: note.trim() || null,
    })
    .eq('id', warningId);
  if (error) throw error;
};

// ── Email template builders ────────────────────────────────────────────────────

export const buildCourseHelpEmail = (
  w:             RiskWarning,
  settings:      RiskSettings,
  professorName: string,
): { subject: string; body: string } => ({
  subject: `Support available for ${w.course_name}`,
  body:
`Dear ${w.student_name},

I am contacting you regarding your current performance in ${w.course_name} within the ${w.program ?? 'your'} program.

Your current grade is ${w.grade_percentage ?? '—'}%, which is below the academic risk limit of ${settings.grade_limit_percentage}% set by the school. Because of this, you have been marked as a student who may need additional academic support.

I would like to offer help with this course. We can arrange a meeting, review difficult topics, provide additional learning materials, or discuss what support would help you improve your progress.

Please contact me so we can agree on the best support option for you.

Best regards,
${professorName}`,
});

export const buildAbsencePolicyEmail = (
  w:             RiskWarning,
  settings:      RiskSettings,
  professorName: string,
): { subject: string; body: string } => ({
  subject: `Attendance notice for ${w.course_name}`,
  body:
`Dear ${w.student_name},

I am contacting you regarding your attendance in ${w.course_name} within the ${w.program ?? 'your'} program.

You currently have ${w.missed_classes_count ?? '—'} missed classes. The school absence risk limit is ${settings.absence_limit_count} missed classes. Because your missed classes are equal to or above this limit, you have been marked as a student at risk according to the attendance policy.

Please review the school attendance policy and contact me if you need support or if there is a reason for your absences.

Best regards,
${professorName}`,
});
