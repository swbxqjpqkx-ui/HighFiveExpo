export interface Profile {
  id: string;
  email?: string; // comes from auth session, not profiles table
  full_name: string;
  role: 'professor' | 'administrator';
  created_at?: string;
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
  QualityControl: undefined;
  Warnings: undefined;
  Profile: undefined;
  Settings: undefined;
};

export type AdminDrawerParamList = {
  AdminDashboard: undefined;
  AdminStats: undefined;
  AdminProfessors: undefined;
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
  name: string;
  role: string;
  initials: string;
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
