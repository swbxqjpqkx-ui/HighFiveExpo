import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile, Course, TeacherStats, Student, CourseEnrollment, StudentWithEnrollments, AdminTask, AdminCalendarEvent, PendingApproval, AdminNewsItem, ProfessorOverview, OpenDayStat, CourseEnrollmentStat } from '../types';

const SUPABASE_URL = 'https://nkfthxagzjoimxxlwcrv.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rZnRoeGFnempvaW14eGx3Y3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NDIxNjAsImV4cCI6MjA5NDIxODE2MH0.1aFvPt7yS-N-UbywlEt6cL-7DsE8yVL5iZ8fW0vpEqQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getProfile = async (userId: string): Promise<Profile> => {
  const { data, error } = await supabase
    .from('profiles_with_email')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as Profile;
};

// Uses course_teachers junction table (supports multiple teachers per course)
export const getCoursesByTeacher = async (teacherId: string): Promise<Course[]> => {
  const { data, error } = await supabase
    .from('course_teachers')
    .select('courses(*)')
    .eq('teacher_id', teacherId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.courses).filter(Boolean);
};

// Keep old name as alias so nothing breaks
export const getCoursesByProfessor = getCoursesByTeacher;

// Fetch all students enrolled in the teacher's courses (with their enrollment data)
export const getStudentsByTeacher = async (teacherId: string): Promise<StudentWithEnrollments[]> => {
  // Step 1: get the teacher's course IDs via junction table
  const { data: coursesData, error: coursesError } = await supabase
    .from('course_teachers')
    .select('course_id')
    .eq('teacher_id', teacherId);

  if (coursesError) throw coursesError;
  if (!coursesData || coursesData.length === 0) return [];

  const courseIds = coursesData.map((c: any) => c.course_id);

  // Step 2: fetch enrollments with student info for those courses
  const { data, error } = await supabase
    .from('course_enrollments')
    .select(`
      id,
      student_id,
      course_id,
      grade,
      missed_classes,
      skipped_classes,
      enrolled_at,
      students (
        id,
        full_name,
        email,
        created_at
      )
    `)
    .in('course_id', courseIds);

  if (error) throw error;
  if (!data) return [];

  // Step 3: group enrollments by student
  const studentMap = new Map<string, StudentWithEnrollments>();
  data.forEach((row: any) => {
    const student = row.students as Student;
    if (!student) return;
    if (!studentMap.has(student.id)) {
      studentMap.set(student.id, { ...student, enrollments: [] });
    }
    studentMap.get(student.id)!.enrollments.push({
      id: row.id,
      student_id: row.student_id,
      course_id: row.course_id,
      grade: row.grade,
      missed_classes: row.missed_classes,
      skipped_classes: row.skipped_classes,
      enrolled_at: row.enrolled_at,
    });
  });

  return Array.from(studentMap.values());
};

// Add a new student and enroll them in selected courses
export const addStudent = async (
  fullName: string,
  email: string,
  courseIds: string[],
): Promise<void> => {
  // 1. Insert student
  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert({ full_name: fullName, email })
    .select()
    .single();

  if (studentError) throw studentError;

  // 2. Enroll in selected courses
  if (courseIds.length > 0) {
    const enrollments = courseIds.map(course_id => ({
      student_id: student.id,
      course_id,
    }));
    const { error: enrollError } = await supabase
      .from('course_enrollments')
      .insert(enrollments);
    if (enrollError) throw enrollError;
  }
};

export const getTeacherStats = async (teacherId: string): Promise<TeacherStats | null> => {
  const { data, error } = await supabase
    .from('teachers_stats')
    .select('*')
    .eq('teacher_id', teacherId)
    .single();
  if (error) return null;
  return data;
};

// ── Admin functions ────────────────────────────────────────────────────────────

// Fetch every course with their assigned teachers (admin view)
export const getAllCourses = async (): Promise<Course[]> => {
  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      course_teachers (
        teacher_id,
        profiles ( id, full_name )
      )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    ...c,
    teachers: (c.course_teachers ?? [])
      .map((ct: any) => ct.profiles)
      .filter(Boolean),
  }));
};

// Fetch all professor profiles
export const getAllTeachers = async (): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'professor')
    .order('full_name');
  if (error) throw error;
  return data ?? [];
};

// Set all teachers for a course (replaces existing assignments)
export const setTeachersForCourse = async (courseId: string, teacherIds: string[]): Promise<void> => {
  // Remove all existing assignments for this course
  const { error: deleteError } = await supabase
    .from('course_teachers')
    .delete()
    .eq('course_id', courseId);
  if (deleteError) throw deleteError;

  // Insert new assignments
  if (teacherIds.length > 0) {
    const { error: insertError } = await supabase
      .from('course_teachers')
      .insert(teacherIds.map(tid => ({ course_id: courseId, teacher_id: tid })));
    if (insertError) throw insertError;
  }

  // Keep legacy teacher_id in sync (first teacher, or null)
  const { error: updateError } = await supabase
    .from('courses')
    .update({ teacher_id: teacherIds[0] ?? null })
    .eq('id', courseId);
  if (updateError) throw updateError;
};

// Fetch platform-wide stats for admin dashboard
export const getAdminStats = async (): Promise<{
  totalCourses: number;
  assignedCourses: number;
  unassignedCourses: number;
  totalTeachers: number;
  totalStudents: number;
}> => {
  const [coursesRes, teachersRes, studentsRes, assignedRes] = await Promise.all([
    supabase.from('courses').select('id'),
    supabase.from('profiles').select('id').eq('role', 'professor'),
    supabase.from('students').select('id'),
    supabase.from('course_teachers').select('course_id'),
  ]);

  const totalCourses = (coursesRes.data ?? []).length;
  const assignedCourseIds = new Set((assignedRes.data ?? []).map((r: any) => r.course_id));

  return {
    totalCourses,
    assignedCourses: assignedCourseIds.size,
    unassignedCourses: totalCourses - assignedCourseIds.size,
    totalTeachers: (teachersRes.data ?? []).length,
    totalStudents: (studentsRes.data ?? []).length,
  };
};

// ── Admin extended functions ───────────────────────────────────────────────

/**
 * Fetch admin-level student stats from students + course_enrollments tables.
 */
export const getStudentStats = async (): Promise<{
  total: number;
  atRisk: number;
  avgGrade: number;
  avgAttendance: number;
  active: number;
}> => {
  const [studentsRes, enrollmentsRes] = await Promise.all([
    supabase.from('students').select('id'),
    supabase.from('course_enrollments').select('id, grade, missed_classes'),
  ]);

  const total = (studentsRes.data ?? []).length;
  const enrollments = enrollmentsRes.data ?? [];

  // At-risk: grade < 60 OR more than 3 missed classes
  const atRisk = enrollments.filter(
    (e: any) => (e.grade != null && e.grade < 60) || (e.missed_classes ?? 0) > 3
  ).length;

  // Avg grade: only over enrollments that have a grade recorded
  const graded = enrollments.filter((e: any) => e.grade != null);
  const avgGrade = graded.length
    ? Math.round(graded.reduce((s: number, e: any) => s + e.grade, 0) / graded.length)
    : 0;

  // Avg attendance: assume 20 sessions per course as baseline
  const withMissed = enrollments.filter((e: any) => e.missed_classes != null);
  const avgMissed = withMissed.length
    ? withMissed.reduce((s: number, e: any) => s + e.missed_classes, 0) / withMissed.length
    : 0;
  const avgAttendance = Math.round(Math.max(0, (1 - avgMissed / 20) * 100));

  return { total, atRisk, avgGrade, avgAttendance, active: total };
};

/**
 * Fetch per-course enrollment stats (student count, avg grade, at-risk status).
 * Reads from course_enrollments joined with courses.
 */
export const getCourseEnrollmentStats = async (): Promise<CourseEnrollmentStat[]> => {
  const { data, error } = await supabase
    .from('course_enrollments')
    .select(`
      course_id,
      grade,
      missed_classes,
      courses ( id, name )
    `);
  if (error) throw error;

  // Group by course
  const map = new Map<string, { name: string; grades: number[]; enrollCount: number }>();
  (data ?? []).forEach((row: any) => {
    const course = row.courses;
    if (!course) return;
    if (!map.has(course.id)) {
      map.set(course.id, { name: course.name, grades: [], enrollCount: 0 });
    }
    const entry = map.get(course.id)!;
    entry.enrollCount += 1;
    if (row.grade != null) entry.grades.push(row.grade);
  });

  return Array.from(map.entries())
    .map(([id, c]) => {
      const avg = c.grades.length
        ? Math.round(c.grades.reduce((s, g) => s + g, 0) / c.grades.length)
        : 0;
      return {
        course_id: id,
        course: c.name,
        students: c.enrollCount,
        avg,
        status: (avg > 0 && avg < 65 ? 'At Risk' : 'On Track') as 'On Track' | 'At Risk',
      };
    })
    .sort((a, b) => b.students - a.students); // highest enrollment first
};

/**
 * Fetch professors with their course counts.
 * TODO: join with approvals, grading_activities tables when ready.
 */
export const getProfessorOverviews = async (): Promise<ProfessorOverview[]> => {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'professor');
  if (error) throw error;
  if (!profiles || profiles.length === 0) return [];

  const { data: ctData } = await supabase
    .from('course_teachers')
    .select('teacher_id');

  const countMap: Record<string, number> = {};
  (ctData ?? []).forEach((r: any) => {
    countMap[r.teacher_id] = (countMap[r.teacher_id] ?? 0) + 1;
  });

  return profiles.map((p: any): ProfessorOverview => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email ?? '',
    courses_count: countMap[p.id] ?? 0,
    pending_items: 0,
    status: 'active',
    needs_support: false,
  }));
};

/**
 * Fetch pending document approvals.
 * TODO: connect to approvals/documents table once created.
 */
export const getPendingApprovals = async (): Promise<PendingApproval[]> => {
  return MOCK_APPROVALS;
};

/**
 * Approve a document submission.
 * TODO: connect to approvals table.
 */
export const approveDocument = async (id: string): Promise<void> => {
  console.log('[Admin] Approved document:', id);
};

/**
 * Decline a document submission with a comment.
 * TODO: connect to approvals table.
 */
export const declineDocument = async (id: string, comment: string): Promise<void> => {
  console.log('[Admin] Declined document:', id, 'Reason:', comment);
};

/**
 * Fetch Open Day stats.
 * TODO: connect to open_day, open_day_registrations, open_day_ambassadors tables.
 */
export const getOpenDayStats = async (): Promise<OpenDayStat> => {
  return {
    total_registrations: 312,
    countries_count: 23,
    ambassadors_count: 45,
    capacity: 312,
    capacity_max: 400,
    next_event_date: '2026-05-24',
    days_until: 10,
  };
};

/**
 * Fetch admin calendar events.
 * TODO: connect to admin_calendar or events table.
 */
export const getAdminCalendarEvents = async (): Promise<AdminCalendarEvent[]> => {
  return MOCK_ADMIN_EVENTS;
};

/**
 * Fetch admin tasks.
 * TODO: connect to admin_tasks table.
 */
export const getAdminTasksList = async (): Promise<AdminTask[]> => {
  return MOCK_ADMIN_TASKS;
};

/**
 * Fetch admin news items.
 * TODO: connect to news table.
 */
export const getAdminNews = async (): Promise<AdminNewsItem[]> => {
  return MOCK_NEWS_ITEMS;
};

// ── Mock data (remove once Supabase tables are ready) ─────────────────────

const MOCK_ADMIN_TASKS: AdminTask[] = [
  { id: 'at1', title: 'Review 5 materials pending approval', due: 'Due: Today',     priority: 'high',   completed: false },
  { id: 'at2', title: 'Approve updated curricula',            due: 'Due: Tomorrow', priority: 'medium', completed: false },
  { id: 'at3', title: 'Follow up on at-risk students',        due: 'Due: May 16',   priority: 'low',    completed: false },
  { id: 'at4', title: 'Prepare accreditation report',         due: 'Due: May 18',   priority: 'low',    completed: true  },
];

const MOCK_ADMIN_EVENTS: AdminCalendarEvent[] = [
  { id: 'ae1', title: 'Department Meeting',          time: '09:00', end_time: '10:30', location: 'Room 101',         date: '2026-05-14', type: 'meeting', color: '#7a5acc' },
  { id: 'ae2', title: 'Curriculum Review Committee', time: '11:00', end_time: '12:30', location: 'Online',           date: '2026-05-14', type: 'meeting', color: '#2a8a4d' },
  { id: 'ae3', title: 'Accreditation Preparation',   time: '14:00', end_time: '15:30', location: 'Room 203',         date: '2026-05-14', type: 'event',   color: '#d99a1f' },
  { id: 'ae4', title: 'Open Day Planning',            time: '16:00', end_time: '17:00', location: 'Marketing Office', date: '2026-05-14', type: 'meeting', color: '#d94343' },
];

const MOCK_APPROVALS: PendingApproval[] = [
  { id: 'ap1', professor_name: 'Daniel Meyer',   professor_email: 'daniel.meyer@best-teacher.ch',   document_name: 'Course Syllabus Q3.pdf',        file_url: '', file_type: 'pdf',   status: 'pending', submitted_at: '2026-05-13T10:00:00Z' },
  { id: 'ap2', professor_name: 'Anna Keller',    professor_email: 'anna.keller@best-teacher.ch',    document_name: 'Grade Report May.xlsx',         file_url: '', file_type: 'excel', status: 'pending', submitted_at: '2026-05-12T14:30:00Z' },
  { id: 'ap3', professor_name: 'Michael Weber',  professor_email: 'michael.weber@best-teacher.ch',  document_name: 'Attendance Summary.docx',       file_url: '', file_type: 'word',  status: 'pending', submitted_at: '2026-05-12T09:00:00Z' },
  { id: 'ap4', professor_name: 'Sophie Fischer', professor_email: 'sophie.fischer@best-teacher.ch', document_name: 'Lab Results Presentation.pptx', file_url: '', file_type: 'ppt',  status: 'pending', submitted_at: '2026-05-11T16:00:00Z' },
];

const MOCK_NEWS_ITEMS: AdminNewsItem[] = [
  { id: 'n1', title: 'Policy Update: Absence tracking', date: 'May 10, 2026', is_new: true,  thumb_index: 0 },
  { id: 'n2', title: 'Accreditation Standards 2026',    date: 'May 8, 2026',  is_new: false, thumb_index: 1 },
  { id: 'n3', title: 'Budget Planning 2026/27',         date: 'May 6, 2026',  is_new: false, thumb_index: 2 },
  { id: 'n4', title: 'Field-trip permission templates', date: 'May 4, 2026',  is_new: false, thumb_index: 3 },
];
