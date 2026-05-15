import React, { useEffect, useState } from 'react';
import { Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, View } from 'react-native';
import StudentCard from '../components/StudentCard';
import AddStudentModal from '../components/AddStudentModal';
import { Course, StudentWithEnrollments } from '../types';
import { getStudentsByTeacher } from '../services/supabase';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface Props {
  courses: Course[];
  teacherId: string;
}

const StudentsScreen: React.FC<Props> = ({ courses, teacherId }) => {
  const [students, setStudents] = useState<StudentWithEnrollments[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, [teacherId]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getStudentsByTeacher(teacherId);
      setStudents(data);
    } catch (e: any) {
      setError('Failed to load students.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Students</Text>
          <Text style={styles.subtitle}>
            {students.length} student{students.length !== 1 ? 's' : ''} across {courses.length} course{courses.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Add Student</Text>
        </TouchableOpacity>
      </View>

      {/* Student list */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.leaf} style={styles.loader} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : students.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👩‍🎓</Text>
          <Text style={styles.emptyTitle}>No students yet</Text>
          <Text style={styles.emptyBody}>Tap "Add Student" to enroll your first student.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.emptyBtnText}>+ Add Student</Text>
          </TouchableOpacity>
        </View>
      ) : (
        students.map(student => (
          <StudentCard key={student.id} student={student} courses={courses} />
        ))
      )}

      {/* Modal */}
      <AddStudentModal
        visible={modalVisible}
        courses={courses}
        onClose={() => setModalVisible(false)}
        onSuccess={fetchStudents}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.mist },
  content: { padding: Spacing.lg },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: Spacing.lg,
  },
  title: { ...Typography.display, marginBottom: 4 },
  subtitle: { ...Typography.body },
  addBtn: {
    backgroundColor: Colors.leaf, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    alignSelf: 'flex-start', marginTop: 6,
  },
  addBtnText: { ...Typography.label, color: Colors.white, textTransform: 'none', fontSize: 13 },
  loader: { marginTop: Spacing.xl },
  error: { ...Typography.body, color: Colors.red, textAlign: 'center', marginTop: Spacing.xl },
  emptyState: { alignItems: 'center', marginTop: Spacing.xxl, gap: Spacing.sm },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...Typography.heading1 },
  emptyBody: { ...Typography.body, textAlign: 'center' },
  emptyBtn: {
    marginTop: Spacing.sm, backgroundColor: Colors.leaf,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.lg, paddingVertical: 10,
  },
  emptyBtnText: { ...Typography.label, color: Colors.white, textTransform: 'none', fontSize: 13 },
});

export default StudentsScreen;
