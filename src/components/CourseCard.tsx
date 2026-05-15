import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Course } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface Props {
  course: Course;
  onPress?: () => void;
}

const riskColor = (level?: string) => {
  if (level === 'high') return Colors.red;
  if (level === 'medium') return Colors.yellow;
  return Colors.green;
};

const completionColor = (rate?: number) => {
  if (!rate) return Colors.inkLight;
  if (rate >= 85) return Colors.green;
  if (rate >= 65) return Colors.yellow;
  return Colors.red;
};

const CourseCard: React.FC<Props> = ({ course, onPress }) => {
  const completion = course.completion_rate ?? 0;
  const color = completionColor(completion);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={styles.titleArea}>
          <Text style={styles.name}>{course.name}</Text>
          <View style={styles.tags}>
            {course.program && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{course.program}</Text>
              </View>
            )}
            {course.semester && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{course.semester}</Text>
              </View>
            )}
          </View>
        </View>
        {course.risk_level && (
          <View style={[styles.riskBadge, { backgroundColor: riskColor(course.risk_level) + '22', borderColor: riskColor(course.risk_level) }]}>
            <Text style={[styles.riskText, { color: riskColor(course.risk_level) }]}>
              {course.risk_level.toUpperCase()} RISK
            </Text>
          </View>
        )}
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{course.student_count ?? '—'}</Text>
          <Text style={styles.statLabel}>Students</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color }]}>{completion > 0 ? `${completion}%` : '—'}</Text>
          <Text style={styles.statLabel}>Avg Grade</Text>
        </View>
      </View>

      {completion > 0 && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.min(completion, 100)}%` as any, backgroundColor: color }]} />
        </View>
      )}
    </TouchableOpacity>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  titleArea: { flex: 1, marginRight: Spacing.sm },
  name: { ...Typography.heading2, marginBottom: Spacing.xs },
  tags: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  tag: { backgroundColor: Colors.mist, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { ...Typography.label, color: Colors.forest, fontSize: 10 },
  riskBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  riskText: { ...Typography.label, fontSize: 9 },
  stats: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { ...Typography.heading1, color: Colors.forest },
  statLabel: { ...Typography.body, fontSize: 11 },
  divider: { width: 1, height: 30, backgroundColor: Colors.border },
  progressBar: { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
});

export default CourseCard;
