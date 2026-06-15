export interface Profile {
  id: string;
  email?: string; // comes from auth session, not profiles table
  full_name: string;
  role: 'professor' | 'administrator';
  created_at?: string;
  accepted_terms?: boolean;
  accepted_terms_at?: string | null;
  terms_version?: string | null;
}

export interface Course {
  id: string;
  name: string;
  teacher_id?: string | null;
  teachers?: { id: string; full_name: string }[]; // populated in admin views
  program?: string;
  semester?: string;
  student_count?: number;
  completion_rate?: number;
  risk_level?: 'low' | 'medium' | 'high';
  created_at?: string;
}

export interface TeacherStats {
  id: string;
  teacher_id: string;
  total_courses: number;
  total_students: number;
  avg_completion: number;
  curriculum_stats?: any;
}

// Matches students table
export interface Student {
  id: string;
  full_name: string;
  email: string;
  created_at?: string;
  nationality?: string | null;
  date_of_birth?: string | null;
  description?: string | null;
}

// Matches course_enrollments table
export interface CourseEnrollment {
  id: string;
  student_id: string;
  course_id: string;
  grade?: number;
  missed_classes?: number;
  skipped_classes?: number;
  enrolled_at?: string;
}

// Student with their enrollment data joined
export interface StudentWithEnrollments extends Student {
  enrollments: CourseEnrollment[];
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
  priority?: 'high' | 'medium' | 'low';
  due?: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
}

export interface Deadline {
  id: string;
  title: string;
  date: string;
  course_id: string;
}

export interface Warning {
  id: string;
  type: 'missed_classes' | 'skipped_classes' | 'low_grade' | 'low_course_avg' | 'overlap';
  message: string;
  severity: 'medium' | 'high';
  student_id?: string;
  course_id?: string;
}

export interface Notification {
  id: string;
  message: string;
  type: 'approval_sent' | 'approved' | 'declined' | 'warning';
  read: boolean;
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  course_id_a: string;
  course_id_b: string;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
}

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type DrawerParamList = {
  Home: undefined;
  Courses: undefined;
  Students: undefined;
  StudentList: undefined;
  CourseManagement: undefined;
  HomeworkAssistance: undefined;
  QualityControl: undefined;
  Warnings: undefined;
  News: undefined;
  Calendar: undefined;
  Tasks: undefined;
  Profile: undefined;
  Settings: undefined;
};

// ── News feature types ────────────────────────────────────────
export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  relatedCourseId?: string;
  relatedCourseName: string;
  topicKeyword?: string;
  snippet?: string;
  isPinned?: boolean;
}

export interface NewsPreference {
  id?: string;
  professor_id?: string;
  source_name: string;
  source_url: string | null;
  is_enabled: boolean;
}

export interface PinnedArticle {
  id: string;
  professor_id: string;
  course_id?: string | null;
  course_name: string;
  article_title: string;
  article_url: string;
  source_name: string;
  published_at?: string | null;
  topic_keyword?: string | null;
  pinned_at: string;
  created_at: string;
}

export type AdminDrawerParamList = {
  AdminDashboard: undefined;
  AdminStats: undefined;
  AdminStudentCoordination: undefined;
  AdminStudentList: undefined;
  AdminAccreditation: undefined;
  AdminOpenDay: undefined;
  AdminCalendar: undefined;
  AdminTasks: undefined;
  AdminNews: undefined;
  AdminSettings: undefined;
  AdminProfile: undefined;
  AssignCourses: undefined;
};

// ── Admin types ───────────────────────────────────────────────
export interface AdminTask {
  id: string;
  title: string;
  due: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
}

export interface AdminCalendarEvent {
  id: string;
  title: string;
  time: string;
  end_time?: string;
  location: string;
  date: string;
  type: 'meeting' | 'deadline' | 'event';
  color?: string;
}

export interface PendingApproval {
  id: string;
  professor_name: string;
  professor_email: string;
  document_name: string;
  file_url: string;
  file_type: string;
  status: 'pending' | 'approved' | 'declined';
  submitted_at: string;
  admin_comment?: string;
}

export interface ProfessorOverview {
  id: string;
  full_name: string;
  email: string;
  courses_count: number;
  pending_items: number;
  status: 'active' | 'inactive';
  needs_support: boolean;
}

export interface OpenDayItem {
  id: string;
  institution_id?: string | null;
  title: string;
  description?: string | null;
  icon_name?: string | null;
  linked_route?: string | null;
  display_order?: number;
  is_visible?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OpenDayStat {
  total_registrations: number;
  countries_count: number;
  ambassadors_count: number;
  capacity: number;
  capacity_max: number;
  next_event_date: string;
  days_until: number;
}

export interface OpenDayRegistration {
  id: string;
  name: string;
  email: string;
  country: string;
  registered_at: string;
  ambassador_id?: string;
}

export interface OpenDayAmbassador {
  id: string;
  full_name: string;
  country: string;
  program: string;
  email: string;
  phone?: string | null;
  role: string;
  photo_url?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AdminNewsItem {
  id: string;
  title: string;
  date: string;
  is_new: boolean;
  thumb_index: number;
  category?: string;
}

export interface CourseEnrollmentStat {
  course_id: string;
  course: string;
  students: number;
  avg: number;       // average grade (0 if no grades yet)
  status: 'On Track' | 'At Risk';
}

export interface AdminKpi {
  label: string;
  value: string;
  trend: string;
  direction: 'up' | 'down';
  tone: 'good' | 'info' | 'warn' | 'danger';
}

// ── Institution settings ───────────────────────────────────────
export type AccreditationType = 'AACSB' | 'EQUIS' | 'AMBA';

export interface AcademicPeriod {
  id: string;
  name: string;
  duration_value: number;
  duration_unit: 'weeks' | 'months';
}

export interface InstitutionSettings {
  id: string;
  name: string;
  country: string;
  city: string;
  address: string;
  accreditation: AccreditationType;
  programs: string[];
  academic_periods: AcademicPeriod[];
  setup_completed: boolean;
  setup_completed_by?: string;
  setup_completed_at?: string;
  locked: boolean;
  created_at?: string;
  updated_at?: string;
}

export const ALL_PROGRAMS = [
  'BBA',
  'Bachelor in Business/Management',
  'Bachelor in Hospitality Management',
  'MBA',
  'MSc in Management',
  'MSc in Finance',
  'MSc in Marketing',
  'Master in International Business',
  'Master in Management',
  'DBA',
  'PhD in Business/Management',
  'Executive Education',
] as const;
