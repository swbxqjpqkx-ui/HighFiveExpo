import React from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import WarningCard from '../components/WarningCard';
import { computeWarnings } from '../utils/warnings';
import { Course, StudentWithEnrollments } from '../types';
import { Colors, Typography, Spacing } from '../theme';

interface Props {
  courses: Course[];
  students: StudentWithEnrollments[];
}

const WarningsScreen: React.FC<Props> = ({ courses, students }) => {
  const warnings = computeWarnings(students, courses);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Warnings</Text>
      {warnings.length === 0 ? (
        <Text style={styles.empty}>No warnings at this time. Great job! ✅</Text>
      ) : (
        warnings.map(w => <WarningCard key={w.id} warning={w} />)
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.mist },
  content: { padding: Spacing.lg },
  title: { ...Typography.display, marginBottom: Spacing.lg },
  empty: { ...Typography.body, textAlign: 'center', marginTop: Spacing.xl },
});

export default WarningsScreen;
