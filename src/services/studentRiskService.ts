import { supabase } from './supabase';
import { createNotificationIfNew, notifyAllAdmins } from './notificationService';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RiskRule {
  id: string;
  program: string;
  semester: string;
  max_absences_allowed: number;
  borderline_grade_percentage: number;
  created_by_admin_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StudentWarning {
  id: string;
  student_id: string;
  course_id: string;
  professor_id: string | null;
  program: string | null;
  semester: string | null;
  grade_percentage: number | null;
  missed_classes_count: number | null;
  max_absences_allowed: number | null;
  borderline_grade_percentage: number | null;
  warning_reason: string;
  status: 'new' | 'reviewed' | 'contacted' | 'resolved' | 'ignored';
  detected_at: string;
  reviewed_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  student_name?: string;
  course_name?: string;
  professor_name?: string;
}

// ── Risk Rules CRUD ────────────────────────────────────────────────────────────

export const getRiskRules = async (): Promise<RiskRule[]> => {
  const { data, error } = await supabase
    .from('student_risk_rules')
    .select('*')
    .order('program')
    .order('semester');
  if (error) throw error;
  return (data ?? []) as RiskRule[];
};

export const getRiskRuleForStudent = async (
  program: string,
  semester: string,
): Promise<RiskRule | null> => {
  const { data } = await supabase
    .from('student_risk_rules')
    .select('*')
    .eq('program', program)
    .eq('semester', semester)
    .maybeSingle();
  return data as RiskRule | null;
};

export const saveRiskRule = async (
  rule: Omit<RiskRule, 'id' | 'created_at' | 'updated_at'>,
  adminId: string,
): Promise<RiskRule> => {
  const payload = { ...rule, created_by_admin_id: adminId };

  // Upsert by program+semester unique constraint
  const { data, error } = await supabase
    .from('student_risk_rules')
    .upsert(payload, { onConflict: 'program,semester' })
    .select()
    .single();

  if (error) throw error;
  return data as RiskRule;
};

export const deleteRiskRule = async (id: string): Promise<void> => {
  const { error } = await supabase.from('student_risk_rules').delete().eq('id', id);
  if (error) throw error;
};

// ── Risk level computation ─────────────────────────────────────────────────────

export const computeRiskLevel = (
  grade: number | null,
  missedClasses: number | null,
  rule: RiskRule,
): 'low' | 'medium' | 'high' => {
  const gradeBad   = grade !== null && grade < rule.borderline_grade_percentage;
  const absenceBad = missedClasses !== null && missedClasses > rule.max_absences_allowed;
  if (gradeBad && absenceBad) return 'high';
  if (gradeBad && grade !== null && grade <= rule.borderline_grade_percentage - 15) return 'high';
  if (absenceBad && missedClasses !== null && rule.max_absences_allowed > 0 &&
      missedClasses >= rule.max_absences_allowed * 2) return 'high';
  return 'medium';
};

// ── Warning reason builder ─────────────────────────────────────────────────────

const buildWarningReason = (
  gradeBad: boolean,
  absenceBad: boolean,
): string => {
  if (gradeBad && absenceBad) return 'Grade below borderline and absences above limit';
  if (gradeBad) return 'Grade below borderline';
  return 'Absences above limit';
};

// ── Core evaluation ────────────────────────────────────────────────────────────

export const evaluateStudentRisk = (
  grade: number | null,
  missedClasses: number | null,
  rule: RiskRule,
): { isAtRisk: boolean; reason: string } => {
  const gradeBad  = grade !== null && grade < rule.borderline_grade_percentage;
  const absenceBad = missedClasses !== null && missedClasses > rule.max_absences_allowed;
  const isAtRisk  = gradeBad || absenceBad;
  return { isAtRisk, reason: isAtRisk ? buildWarningReason(gradeBad, absenceBad) : '' };
};

// ── Create/update a single warning ────────────────────────────────────────────

export const createOrUpdateStudentWarning = async (params: {
  studentId: string;
  courseId: string;
  professorId: string | null;
  program: string | null;
  semester: string | null;
  grade: number | null;
  missedClasses: number | null;
  rule: RiskRule;
  reason: string;
}): Promise<void> => {
  const payload = {
    student_id: params.studentId,
    course_id: params.courseId,
    professor_id: params.professorId,
    program: params.program,
    semester: params.semester,
    grade_percentage: params.grade,
    missed_classes_count: params.missedClasses,
    max_absences_allowed: params.rule.max_absences_allowed,
    borderline_grade_percentage: params.rule.borderline_grade_percentage,
    warning_reason: params.reason,
    status: 'new',
    detected_at: new Date().toISOString(),
  };

  // Upsert by student+course unique constraint, reset to new if condition worsened
  const { error } = await supabase
    .from('student_warnings')
    .upsert(payload, { onConflict: 'student_id,course_id' });

  if (error) throw error;

  // Notify the responsible professor that a student is at risk. Best-effort and
  // duplicate-guarded (one unread alert per student+course), so re-checks don't spam.
  if (params.professorId) {
    try {
      const [{ data: student }, { data: course }] = await Promise.all([
        supabase.from('students').select('full_name').eq('id', params.studentId).maybeSingle(),
        supabase.from('courses').select('name').eq('id', params.courseId).maybeSingle(),
      ]);
      const studentName = student?.full_name ?? 'A student';
      const courseName  = course?.name ?? 'one of your courses';
      await createNotificationIfNew({
        userId:      params.professorId,
        title:       '🚨 Student at Risk',
        message:     `${studentName} is at risk in "${courseName}". ${params.reason}`,
        type:        'student_at_risk',
        relatedId:   `${params.studentId}:${params.courseId}`,
        relatedType: 'student_warning',
      });
    } catch {
      /* notification failures must never break risk detection */
    }
  }

  // Notify all administrators when the case becomes SERIOUS — absences ≥ 25% above
  // the allowed limit, OR grade ≥ 25% below the allowed limit (uses the same
  // admin-set rule already connected). Reuses the shared notifications table +
  // duplicate-guard. Best-effort; never breaks risk detection.
  try {
    const absLimit   = params.rule.max_absences_allowed;
    const gradeLimit = params.rule.borderline_grade_percentage;
    const seriousAbsence = params.missedClasses !== null && absLimit > 0 &&
      params.missedClasses >= absLimit * 1.25;
    const seriousGrade = params.grade !== null && gradeLimit > 0 &&
      params.grade <= gradeLimit * 0.75;
    if (seriousAbsence || seriousGrade) {
      const [{ data: student }, { data: course }] = await Promise.all([
        supabase.from('students').select('full_name').eq('id', params.studentId).maybeSingle(),
        supabase.from('courses').select('name').eq('id', params.courseId).maybeSingle(),
      ]);
      const studentName = student?.full_name ?? 'A student';
      const courseName  = course?.name ?? 'a course';
      const detail = seriousAbsence && seriousGrade
        ? 'critically high absences and a critically low grade'
        : seriousAbsence ? 'critically high absences' : 'a critically low grade';
      await notifyAllAdmins({
        title:   '🚨 Serious Student Case',
        message: `${studentName} has ${detail} in "${courseName}" and needs coordination review.`,
        type:    'student_serious',
        relatedId:   `${params.studentId}:${params.courseId}`,
        relatedType: 'student_warning',
      });
    }
  } catch {
    /* admin notification failures must never break risk detection */
  }
};

export const resolveWarningIfSafe = async (
  studentId: string,
  courseId: string,
): Promise<void> => {
  // Called when student is no longer at risk — auto-resolve the warning
  const { error } = await supabase
    .from('student_warnings')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .in('status', ['new', 'reviewed']);

  if (error) console.warn('resolveWarningIfSafe:', error.message);
};

// ── Re-check all students in a program+semester ────────────────────────────────

export const recheckStudentsForProgramSemester = async (
  program: string,
  semester: string,
  rule: RiskRule,
): Promise<void> => {
  // Step 1: get all courses for this program+semester
  const { data: courses, error: courseErr } = await supabase
    .from('courses')
    .select('id, teacher_id')
    .eq('program', program)
    .eq('semester', semester);

  if (courseErr || !courses || courses.length === 0) return;

  const courseIds  = courses.map((c: any) => c.id as string);
  const teacherMap = Object.fromEntries(courses.map((c: any) => [c.id, c.teacher_id]));

  // Step 2: get all enrollments for those courses
  const { data: enrollments, error } = await supabase
    .from('course_enrollments')
    .select('student_id, course_id, grade, missed_classes')
    .in('course_id', courseIds);

  if (error || !enrollments) return;

  for (const row of enrollments as any[]) {
    const grade  = row.grade          ?? null;
    const missed = row.missed_classes ?? null;
    const { isAtRisk, reason } = evaluateStudentRisk(grade, missed, rule);

    if (isAtRisk) {
      await createOrUpdateStudentWarning({
        studentId:    row.student_id,
        courseId:     row.course_id,
        professorId:  teacherMap[row.course_id] ?? null,
        program,
        semester,
        grade,
        missedClasses: missed,
        rule,
        reason,
      });
    } else {
      await resolveWarningIfSafe(row.student_id, row.course_id);
    }
  }
};

// ── Check a single enrollment (called after grade/attendance update) ───────────

export const checkEnrollmentRisk = async (
  studentId: string,
  courseId: string,
): Promise<void> => {
  // Fetch enrollment + course info
  const { data: row, error } = await supabase
    .from('course_enrollments')
    .select('grade, missed_classes, courses(program, semester, teacher_id)')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .single();

  if (error || !row) return;

  const course   = (row as any).courses;
  const program  = course?.program  ?? null;
  const semester = course?.semester ?? null;
  if (!program || !semester) return;

  const rule = await getRiskRuleForStudent(program, semester);
  if (!rule) return;

  const grade   = (row as any).grade ?? null;
  const missed  = (row as any).missed_classes ?? null;
  const { isAtRisk, reason } = evaluateStudentRisk(grade, missed, rule);

  if (isAtRisk) {
    await createOrUpdateStudentWarning({
      studentId,
      courseId,
      professorId:  course?.teacher_id ?? null,
      program,
      semester,
      grade,
      missedClasses: missed,
      rule,
      reason,
    });
  } else {
    await resolveWarningIfSafe(studentId, courseId);
  }
};

// ── Fetch warnings ─────────────────────────────────────────────────────────────

export const getWarningsForProfessor = async (
  professorId: string,
): Promise<StudentWarning[]> => {
  const { data, error } = await supabase
    .from('student_warnings')
    .select(`
      *,
      students(full_name),
      courses(name),
      profiles(full_name)
    `)
    .eq('professor_id', professorId)
    .order('detected_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as any[]).map(row => ({
    ...row,
    student_name:   row.students?.full_name ?? 'Unknown',
    course_name:    row.courses?.full_name  ?? row.courses?.name ?? 'Unknown',
    professor_name: row.profiles?.full_name ?? 'Unknown',
  })) as StudentWarning[];
};

export const getWarningsAdmin = async (filters?: {
  program?: string;
  semester?: string;
  status?: string;
}): Promise<StudentWarning[]> => {
  let query = supabase
    .from('student_warnings')
    .select(`
      *,
      students(full_name),
      courses(name),
      profiles(full_name)
    `)
    .order('detected_at', { ascending: false });

  if (filters?.program) query = query.eq('program', filters.program);
  if (filters?.semester) query = query.eq('semester', filters.semester);
  if (filters?.status)   query = query.eq('status',  filters.status);

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as any[]).map(row => ({
    ...row,
    student_name:   row.students?.full_name ?? 'Unknown',
    course_name:    row.courses?.name       ?? 'Unknown',
    professor_name: row.profiles?.full_name ?? 'Unknown',
  })) as StudentWarning[];
};

// ── Update warning status ──────────────────────────────────────────────────────

export const updateWarningStatus = async (
  id: string,
  status: 'reviewed' | 'resolved' | 'ignored',
): Promise<void> => {
  const updates: Record<string, any> = { status };
  if (status === 'reviewed') updates.reviewed_at = new Date().toISOString();
  if (status === 'resolved') updates.resolved_at = new Date().toISOString();

  const { error } = await supabase
    .from('student_warnings')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
};

// ── AtRiskStudent — live evaluated result ─────────────────────────────────────

export interface AtRiskStudent {
  student_id: string;
  student_name: string;
  student_email: string;
  student_nationality?: string | null;
  student_dob?: string | null;
  student_description?: string | null;
  course_id: string;
  course_name: string;
  professor_id: string | null;
  professor_name: string;
  professor_email: string;
  program: string;
  semester: string;
  grade_percentage: number | null;
  missed_classes_count: number | null;
  borderline_grade_percentage: number;
  max_absences_allowed: number;
  warning_reason: string;
  risk_level: 'low' | 'medium' | 'high';
  // from student_warnings (status tracking only)
  warning_id: string | null;
  status: 'new' | 'reviewed' | 'contacted' | 'resolved' | 'ignored';
  detected_at: string;
  contacted_at: string | null;
}

// ── Core live evaluation ───────────────────────────────────────────────────────
// Reads directly from course_enrollments + courses + risk_rules.
// student_warnings is only used to look up review status.

const buildAtRiskList = async (courseFilter: { column: string; value: string } | null): Promise<AtRiskStudent[]> => {
  const tag = courseFilter ? `[prof:${courseFilter.value.slice(0,8)}]` : '[admin]';

  // 1. Fetch all risk rules
  const rules = await getRiskRules();
  console.log(`${tag} risk rules:`, rules.length);
  if (!rules.length) return [];
  const ruleMap = new Map(rules.map(r => [`${r.program}||${r.semester}`, r]));

  // 2. Fetch matching courses
  let courseQuery = supabase.from('courses').select('id, name, program, semester, teacher_id');
  if (courseFilter) courseQuery = courseQuery.eq(courseFilter.column, courseFilter.value);
  const { data: courses, error: courseErr } = await courseQuery;
  console.log(`${tag} courses:`, courses?.length ?? 0, courseErr?.message ?? '');
  if (!courses?.length) return [];

  // Only keep courses that have a matching risk rule
  const relevantCourses = (courses as any[]).filter(
    c => c.program && c.semester && ruleMap.has(`${c.program}||${c.semester}`)
  );
  console.log(`${tag} relevantCourses (matched rules):`, relevantCourses.length);
  if (!relevantCourses.length) return [];

  const courseIds = relevantCourses.map(c => c.id as string);
  const courseMap = new Map(relevantCourses.map(c => [c.id, c]));

  // 3. Fetch enrollments with student names and emails
  const { data: enrollments, error: enrolErr } = await supabase
    .from('course_enrollments')
    .select('student_id, course_id, grade, missed_classes, students(id, full_name, email, nationality, date_of_birth, description)')
    .in('course_id', courseIds);
  console.log(`${tag} enrollments:`, enrollments?.length ?? 0, enrolErr?.message ?? '');
  if (!enrollments?.length) return [];

  // 4. Fetch professor names and emails
  const teacherIds = [...new Set(relevantCourses.map(c => c.teacher_id).filter(Boolean) as string[])];
  const profNameMap  = new Map<string, string>();
  const profEmailMap = new Map<string, string>();
  if (teacherIds.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', teacherIds);
    (profs ?? []).forEach((p: any) => {
      profNameMap.set(p.id, p.full_name);
      profEmailMap.set(p.id, p.email ?? '');
    });
  }

  // 5. Deterministic evaluation
  const atRiskRaw: Array<{
    student_id: string; student_name: string; student_email: string;
    student_nationality: string | null; student_dob: string | null; student_description: string | null;
    course_id: string; course: any;
    professor_name: string; professor_email: string;
    grade: number | null; missed: number | null;
    rule: RiskRule; reason: string; risk_level: 'low' | 'medium' | 'high';
  }> = [];

  for (const row of enrollments as any[]) {
    const course = courseMap.get(row.course_id);
    if (!course) continue;
    const rule = ruleMap.get(`${course.program}||${course.semester}`);
    if (!rule) continue;

    const grade  = row.grade          ?? null;
    const missed = row.missed_classes ?? null;
    const { isAtRisk, reason } = evaluateStudentRisk(grade, missed, rule);
    if (!isAtRisk) continue;

    atRiskRaw.push({
      student_id:          row.student_id,
      student_name:        (row.students as any)?.full_name    ?? 'Unknown',
      student_email:       (row.students as any)?.email        ?? '',
      student_nationality: (row.students as any)?.nationality  ?? null,
      student_dob:         (row.students as any)?.date_of_birth ?? null,
      student_description: (row.students as any)?.description  ?? null,
      course_id:           row.course_id,
      course,
      professor_name:  profNameMap.get(course.teacher_id)  ?? 'Unknown',
      professor_email: profEmailMap.get(course.teacher_id) ?? '',
      grade,
      missed,
      rule,
      reason,
      risk_level: computeRiskLevel(grade, missed, rule),
    });
  }
  console.log(`${tag} atRiskRaw:`, atRiskRaw.length);
  if (!atRiskRaw.length) return [];

  // 6. Fetch existing warning statuses (for status tracking only)
  const studentIds = [...new Set(atRiskRaw.map(r => r.student_id))];
  const statusMap = new Map<string, {
    id: string; status: string; detected_at: string; contacted_at: string | null;
  }>();
  const { data: existingWarnings } = await supabase
    .from('student_warnings')
    .select('id, student_id, course_id, status, detected_at, contacted_at')
    .in('student_id', studentIds);
  (existingWarnings ?? []).forEach((w: any) =>
    statusMap.set(`${w.student_id}||${w.course_id}`, w),
  );

  // 7. Merge and return
  return atRiskRaw.map(r => {
    const existing = statusMap.get(`${r.student_id}||${r.course_id}`);
    return {
      student_id:                  r.student_id,
      student_name:                r.student_name,
      student_email:               r.student_email,
      student_nationality:         r.student_nationality,
      student_dob:                 r.student_dob,
      student_description:         r.student_description,
      course_id:                   r.course_id,
      course_name:                 r.course.name,
      professor_id:                r.course.teacher_id ?? null,
      professor_name:              r.professor_name,
      professor_email:             r.professor_email,
      program:                     r.course.program,
      semester:                    r.course.semester,
      grade_percentage:            r.grade,
      missed_classes_count:        r.missed,
      borderline_grade_percentage: r.rule.borderline_grade_percentage,
      max_absences_allowed:        r.rule.max_absences_allowed,
      warning_reason:              r.reason,
      risk_level:                  r.risk_level,
      warning_id:                  existing?.id ?? null,
      status:       (existing?.status       ?? 'new') as AtRiskStudent['status'],
      detected_at:   existing?.detected_at  ?? new Date().toISOString(),
      contacted_at:  existing?.contacted_at ?? null,
    };
  });
};

export const getStudentsAtRiskForAdmin = (): Promise<AtRiskStudent[]> =>
  buildAtRiskList(null);

export const getStudentsAtRiskForProfessor = (professorId: string): Promise<AtRiskStudent[]> =>
  buildAtRiskList({ column: 'teacher_id', value: professorId });

// ── Upsert warning status (status tracking — not detection) ───────────────────

export const upsertWarningStatus = async (
  student: AtRiskStudent,
  newStatus: 'reviewed' | 'contacted' | 'resolved' | 'ignored',
): Promise<string> => {
  const now = new Date().toISOString();
  const payload: Record<string, any> = {
    student_id:                  student.student_id,
    course_id:                   student.course_id,
    professor_id:                student.professor_id,
    program:                     student.program,
    semester:                    student.semester,
    grade_percentage:            student.grade_percentage,
    missed_classes_count:        student.missed_classes_count,
    max_absences_allowed:        student.max_absences_allowed,
    borderline_grade_percentage: student.borderline_grade_percentage,
    warning_reason:              student.warning_reason,
    status:                      newStatus,
    detected_at:                 student.detected_at,
  };
  if (newStatus === 'reviewed')  payload.reviewed_at   = now;
  if (newStatus === 'contacted') payload.contacted_at  = now;
  if (newStatus === 'resolved')  payload.resolved_at   = now;

  const { data, error } = await supabase
    .from('student_warnings')
    .upsert(payload, { onConflict: 'student_id,course_id' })
    .select('id')
    .single();
  if (error) throw error;
  return (data as any).id as string;
};

// ── Full student course detail (for StudentProfileModal) ──────────────────────

export interface StudentCourseDetail {
  course_id:       string;
  course_name:     string;
  program:         string;
  semester:        string;
  professor_name:  string;
  professor_email: string;
  grade:           number | null;
  missed_classes:  number | null;
  borderline_grade: number | null;
  max_absences:    number | null;
  is_at_risk:      boolean;
}

export const fetchStudentCourseDetails = async (
  studentId:   string,
  mode:        'admin' | 'professor',
  professorId?: string,
): Promise<StudentCourseDetail[]> => {
  const { data: enrollments, error } = await supabase
    .from('course_enrollments')
    .select('course_id, grade, missed_classes, courses(id, name, program, semester, teacher_id)')
    .eq('student_id', studentId);

  if (error) throw error;
  if (!enrollments?.length) return [];

  let rows = (enrollments as any[]).filter(e => e.courses);
  if (mode === 'professor' && professorId) {
    rows = rows.filter(e => e.courses.teacher_id === professorId);
  }

  const teacherIds = [...new Set(rows.map(e => e.courses.teacher_id).filter(Boolean) as string[])];
  const profMap = new Map<string, { name: string; email: string }>();
  if (teacherIds.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', teacherIds);
    (profs ?? []).forEach((p: any) =>
      profMap.set(p.id, { name: p.full_name ?? 'Unknown', email: p.email ?? '' }),
    );
  }

  const rules = await getRiskRules();
  const ruleMap = new Map(rules.map(r => [`${r.program}||${r.semester}`, r]));

  return rows.map(e => {
    const c    = e.courses;
    const rule = ruleMap.get(`${c.program}||${c.semester}`);
    const prof = profMap.get(c.teacher_id);
    const grade  = e.grade          ?? null;
    const missed = e.missed_classes ?? null;
    const borderline   = rule?.borderline_grade_percentage ?? null;
    const maxAbsences  = rule?.max_absences_allowed        ?? null;
    const gradeBad  = grade  !== null && borderline  !== null && grade  < borderline;
    const absenceBad = missed !== null && maxAbsences !== null && missed > maxAbsences;
    return {
      course_id:        e.course_id,
      course_name:      c.name,
      program:          c.program  ?? '',
      semester:         c.semester ?? '',
      professor_name:   prof?.name  ?? 'Unknown',
      professor_email:  prof?.email ?? '',
      grade,
      missed_classes:   missed,
      borderline_grade: borderline,
      max_absences:     maxAbsences,
      is_at_risk:       gradeBad || absenceBad,
    };
  });
};

// ── Run full institution-wide risk check (call once after SQL seed) ────────────

export const runFullRiskCheck = async (): Promise<void> => {
  const rules = await getRiskRules();
  for (const rule of rules) {
    await recheckStudentsForProgramSemester(rule.program, rule.semester, rule);
  }
};
