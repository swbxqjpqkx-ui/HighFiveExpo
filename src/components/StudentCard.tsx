import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StudentWithEnrollments, Course } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme';
import GradeIndicator from './GradeIndicator';

interface Props {
  student: StudentWithEnrollments;
  courses: Course[];
}

const StudentCard: React.FC<Props> = ({ student, courses }) => {
  const grades = student.enrollments.map(e => e.grade).filter((g): g is number => g != null);
  const avg = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : 0;
  const totalMissed = student.enrollments.reduce((a, e) => a + (e.missed_classes ?? 0), 0);
  const totalSkipped = student.enrollments.reduce((a, e) => a + (e.skipped_classes ?? 0), 0);
  const enrolledCourses = courses.filter(c => student.enrollments.some(e => e.course_id === c.id));
  const hasWarning = totalSkipped > 5 || totalMissed > 3 || (avg > 0 && avg < 60);

  return (
    <View style={[styles.card, hasWarning && styles.cardWarning]}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{student.full_name.charAt(0)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{student.full_name}</Text>
          <Text style={styles.courses} numberOfLines={1}>
            {enrolledCourses.length > 0 ? enrolledCourses.map(c => c.name).join(', ') : 'No courses'}
          </Text>
        </View>
        {avg > 0 && <GradeIndicator grade={avg} />}
      </View>
      <View style={styles.stats}>
        <Text style={styles.stat}>📅 Missed: {totalMissed}</Text>
        <Text style={styles.stat}>🚫 Skipped: {totalSkipped}</Text>
        {hasWarning && <Text style={styles.warning}>⚠ Warning</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardWarning: { borderColor: '#D9534F66' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.leaf + '33',
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm,
  },
  avatarText: { ...Typography.heading2, color: Colors.leaf },
  info: { flex: 1 },
  name: { ...Typography.heading2 },
  courses: { ...Typography.body },
  stats: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  stat: { ...Typography.body },
  warning: { ...Typography.label, color: Colors.red, fontSize: 11 },
});

export default StudentCard;
