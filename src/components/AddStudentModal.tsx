import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Course } from '../types';
import { addStudent } from '../services/supabase';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface Props {
  visible: boolean;
  courses: Course[];
  onClose: () => void;
  onSuccess: () => void;
}

const AddStudentModal: React.FC<Props> = ({ visible, courses, onClose, onSuccess }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleCourse = (courseId: string) => {
    setSelectedCourses(prev =>
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId],
    );
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) { setError('Please enter the student\'s full name.'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email.'); return; }
    if (selectedCourses.length === 0) { setError('Please select at least one course.'); return; }

    setLoading(true);
    setError('');
    try {
      await addStudent(fullName.trim(), email.trim().toLowerCase(), selectedCourses);
      // Reset form
      setFullName('');
      setEmail('');
      setSelectedCourses([]);
      onSuccess();
      onClose();
    } catch (e: any) {
      if (e.message?.includes('duplicate') || e.code === '23505') {
        setError('A student with this email already exists.');
      } else {
        setError(e.message ?? 'Failed to add student. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFullName('');
    setEmail('');
    setSelectedCourses([]);
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.centered}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>Add New Student</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Full Name */}
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Sara Ahmed"
                placeholderTextColor={Colors.inkLight}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />

              {/* Email */}
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. sara@student.edu"
                placeholderTextColor={Colors.inkLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {/* Course Selection */}
              <Text style={styles.label}>Enroll in Courses *</Text>
              <Text style={styles.hint}>Select one or more courses</Text>
              <View style={styles.courseList}>
                {courses.map(course => {
                  const selected = selectedCourses.includes(course.id);
                  return (
                    <TouchableOpacity
                      key={course.id}
                      style={[styles.courseOption, selected && styles.courseOptionSelected]}
                      onPress={() => toggleCourse(course.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View style={styles.courseInfo}>
                        <Text style={[styles.courseName, selected && styles.courseNameSelected]}>
                          {course.name}
                        </Text>
                        {course.program && (
                          <Text style={styles.courseProgram}>{course.program}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Error */}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* Buttons */}
              <View style={styles.buttons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color={Colors.white} size="small" />
                    : <Text style={styles.submitText}>Add Student</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.lg,
  },
  centered: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  modal: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: Spacing.lg, maxHeight: '90%',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.lg,
  },
  title: { ...Typography.heading1 },
  closeBtn: { padding: Spacing.xs },
  closeText: { fontSize: 18, color: Colors.inkLight },
  label: { ...Typography.label, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  hint: { ...Typography.body, marginBottom: Spacing.sm, marginTop: -4 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    ...Typography.body, color: Colors.ink, marginBottom: Spacing.sm,
  },
  courseList: { gap: Spacing.xs, marginBottom: Spacing.md },
  courseOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.sm, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  courseOptionSelected: { borderColor: Colors.leaf, backgroundColor: Colors.leaf + '10' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: Colors.leaf, borderColor: Colors.leaf },
  checkmark: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  courseInfo: { flex: 1 },
  courseName: { ...Typography.body, color: Colors.ink, fontWeight: '500' },
  courseNameSelected: { color: Colors.leaf },
  courseProgram: { ...Typography.body, fontSize: 11 },
  error: { ...Typography.body, color: Colors.red, marginBottom: Spacing.sm },
  buttons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingVertical: 13, alignItems: 'center',
  },
  cancelText: { ...Typography.body, color: Colors.ink, fontWeight: '500' },
  submitBtn: {
    flex: 2, backgroundColor: Colors.leaf,
    borderRadius: Radius.sm, paddingVertical: 13, alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: Colors.inkLight },
  submitText: { ...Typography.label, color: Colors.white, textTransform: 'none', fontSize: 14 },
});

export default AddStudentModal;
