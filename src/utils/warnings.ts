import { StudentWithEnrollments, Course, Warning } from '../types';

export const computeWarnings = (students: StudentWithEnrollments[], courses: Course[]): Warning[] => {
  const warnings: Warning[] = [];

  students.forEach(student => {
    student.enrollments.forEach(enrollment => {
      const missed = enrollment.missed_classes ?? 0;
      const skipped = enrollment.skipped_classes ?? 0;
      const grade = enrollment.grade;
      const course = courses.find(c => c.id === enrollment.course_id);
      const courseName = course?.name ?? enrollment.course_id;

      if (skipped > 5) {
        warnings.push({
          id: `w-skip-${student.id}-${enrollment.course_id}`,
          type: 'skipped_classes',
          message: `${student.full_name} skipped more than 5 classes in ${courseName}`,
          severity: 'high',
          student_id: student.id,
          course_id: enrollment.course_id,
        });
      } else if (missed > 3) {
        warnings.push({
          id: `w-miss-${student.id}-${enrollment.course_id}`,
          type: 'missed_classes',
          message: `${student.full_name} missed more than 3 classes in ${courseName}`,
          severity: 'medium',
          student_id: student.id,
          course_id: enrollment.course_id,
        });
      }

      if (grade != null && grade < 60) {
        warnings.push({
          id: `w-grade-${student.id}-${enrollment.course_id}`,
          type: 'low_grade',
          message: `${student.full_name} has a grade of ${grade}% in ${courseName}`,
          severity: 'high',
          student_id: student.id,
          course_id: enrollment.course_id,
        });
      }
    });
  });

  courses.forEach(course => {
    const enrollments = students.flatMap(s => s.enrollments.filter(e => e.course_id === course.id));
    const grades = enrollments.map(e => e.grade).filter((g): g is number => g != null);
    if (grades.length === 0) return;
    const avg = grades.reduce((a, b) => a + b, 0) / grades.length;
    if (avg < 75) {
      warnings.push({
        id: `w-avg-${course.id}`,
        type: 'low_course_avg',
        message: `${course.name} has a course average of ${avg.toFixed(1)}%`,
        severity: 'high',
        course_id: course.id,
      });
    }
  });

  return warnings;
};

export const gradeColor = (grade: number): string => {
  if (grade >= 85) return '#3A8F5F';
  if (grade >= 65) return '#F0AD4E';
  return '#D9534F';
};
