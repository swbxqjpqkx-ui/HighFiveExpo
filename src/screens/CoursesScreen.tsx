import React, { useState } from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import CourseCard from '../components/CourseCard';
import CourseStudentsScreen from './CourseStudentsScreen';
import { Course } from '../types';
import { Colors, Typography, Spacing } from '../theme';

interface Props {
  courses: Course[];
}

const CoursesScreen: React.FC<Props> = ({ courses }) => {
  const [selected, setSelected] = useState<Course | null>(null);

  if (selected) {
    return (
      <CourseStudentsScreen
        course={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>My Courses</Text>
      {courses.length === 0 ? (
        <Text style={styles.empty}>No courses found.</Text>
      ) : (
        courses.map(course => (
          <CourseCard
            key={course.id}
            course={course}
            onPress={() => setSelected(course)}
          />
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.mist },
  content:   { padding: Spacing.lg },
  title:     { ...Typography.display, marginBottom: Spacing.lg },
  empty:     { ...Typography.body, textAlign: 'center', marginTop: Spacing.xl },
});

export default CoursesScreen;
