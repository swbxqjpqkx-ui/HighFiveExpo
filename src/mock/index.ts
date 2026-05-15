import { Task, Meeting, Deadline, Notification, ApprovalRequest } from '../types';

// mockStudents removed — real data now comes from Supabase

export const mockTasks: Task[] = [
  { id: 't1', title: 'Grade midterm exams',              completed: false, created_at: '2026-05-10', priority: 'high',   due: 'Due: Today' },
  { id: 't2', title: 'Prepare lecture slides for Week 8', completed: true,  created_at: '2026-05-08', priority: 'medium', due: 'Due: Tomorrow' },
  { id: 't3', title: 'Submit curriculum report',          completed: false, created_at: '2026-05-12', priority: 'low',    due: 'Due: May 18' },
  { id: 't4', title: 'Review student attendance',         completed: false, created_at: '2026-05-13', priority: 'medium', due: 'Due: May 16' },
];

export const mockMeetings: Meeting[] = [
  { id: 'm1', title: 'Department Meeting', date: '2026-05-16', time: '10:00 AM' },
  { id: 'm2', title: 'Student Advisory Session', date: '2026-05-20', time: '2:00 PM' },
  { id: 'm3', title: 'Curriculum Review', date: '2026-05-28', time: '11:00 AM' },
];

export const mockDeadlines: Deadline[] = [
  { id: 'd1', title: 'Final Exam Grades Due', date: '2026-05-22', course_id: 'c1' },
  { id: 'd2', title: 'Project Submission Deadline', date: '2026-05-18', course_id: 'c2' },
  { id: 'd3', title: 'Attendance Report', date: '2026-05-26', course_id: 'c3' },
];

export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    message: 'Your quality control report was sent to the administrator.',
    type: 'approval_sent',
    read: false,
    created_at: '2026-05-13T09:00:00Z',
  },
];

export const mockApprovals: ApprovalRequest[] = [];
