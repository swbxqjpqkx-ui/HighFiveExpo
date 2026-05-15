import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { getAllCourses, getAllTeachers, setTeachersForCourse } from '../../services/supabase';
import { Course, Profile } from '../../types';
import { Colors, Typography, Spacing, Radius } from '../../theme';

type Filter = 'all' | 'assigned' | 'unassigned';

const AssignCoursesScreen: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [c, t] = await Promise.all([getAllCourses(), getAllTeachers()]);
      setCourses(c);
      setTeachers(t);
    } catch (e: any) {
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openModal = (course: Course) => {
    setSelectedCourse(course);
    setSelectedTeacherIds((course.teachers ?? []).map(t => t.id));
    setTeacherSearch('');
    setSaveError('');
    setModalVisible(true);
  };

  const toggleTeacher = (id: string) => {
    setSelectedTeacherIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (!selectedCourse) return;
    setSaving(true);
    setSaveError('');
    try {
      await setTeachersForCourse(selectedCourse.id, selectedTeacherIds);
      setModalVisible(false);
      await loadData();
    } catch (e: any) {
      setSaveError(e.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Teachers filtered by the modal search box
  const filteredTeachers = teachers.filter(t => {
    const q = teacherSearch.toLowerCase();
    return !q || t.full_name.toLowerCase().includes(q);
  });

  // Courses filtered by tab + search bar
  const filteredCourses = courses.filter(c => {
    const hasTeachers = (c.teachers ?? []).length > 0;
    const matchFilter =
      filter === 'all' ||
      (filter === 'assigned' && hasTeachers) ||
      (filter === 'unassigned' && !hasTeachers);
    const q = search.toLowerCase();
    const teacherNames = (c.teachers ?? []).map(t => t.full_name.toLowerCase()).join(' ');
    const matchSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.program ?? '').toLowerCase().includes(q) ||
      teacherNames.includes(q);
    return matchFilter && matchSearch;
  });

  const assigned = courses.filter(c => (c.teachers ?? []).length > 0).length;
  const unassigned = courses.length - assigned;

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Assign Courses</Text>
            <Text style={styles.subtitle}>
              {assigned} assigned · {unassigned} unassigned
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
            <Text style={styles.refreshText}>↻ Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Course search */}
        <TextInput
          style={styles.search}
          placeholder="Search courses by name, program or teacher…"
          placeholderTextColor={Colors.inkLight}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          {(['all', 'assigned', 'unassigned'] as Filter[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Course list */}
        {loading ? (
          <ActivityIndicator size="large" color={Colors.leaf} style={styles.loader} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : filteredCourses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No courses found</Text>
          </View>
        ) : (
          filteredCourses.map(course => {
            const courseTeachers = course.teachers ?? [];
            const hasTeachers = courseTeachers.length > 0;
            return (
              <TouchableOpacity
                key={course.id}
                style={styles.courseCard}
                onPress={() => openModal(course)}
                activeOpacity={0.75}
              >
                <View style={styles.courseLeft}>
                  <Text style={styles.courseName}>{course.name}</Text>
                  <View style={styles.tagRow}>
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
                  {hasTeachers ? (
                    <View style={styles.teacherPills}>
                      {courseTeachers.map(t => (
                        <View key={t.id} style={styles.teacherPill}>
                          <Text style={styles.teacherPillText}>👩‍🏫 {t.full_name}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noTeacher}>⏳ Not assigned</Text>
                  )}
                </View>
                <View style={[styles.statusDot, hasTeachers ? styles.dotGreen : styles.dotAmber]} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Assign Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.centered}
          >
            <View style={styles.modal}>
              {/* Modal header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Assign Teachers</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              {selectedCourse && (
                <Text style={styles.modalCourseName}>{selectedCourse.name}</Text>
              )}

              {/* Selected count badge */}
              <View style={styles.selectedBadgeRow}>
                <Text style={styles.modalLabel}>Select Teachers</Text>
                {selectedTeacherIds.length > 0 && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>
                      {selectedTeacherIds.length} selected
                    </Text>
                  </View>
                )}
              </View>

              {/* Teacher search */}
              <TextInput
                style={styles.teacherSearchInput}
                placeholder="Search by name or surname…"
                placeholderTextColor={Colors.inkLight}
                value={teacherSearch}
                onChangeText={setTeacherSearch}
                autoCapitalize="none"
              />

              {/* Teacher list */}
              <ScrollView style={styles.teacherList} showsVerticalScrollIndicator={false}>
                {filteredTeachers.length === 0 ? (
                  <Text style={styles.noResults}>No teachers match your search</Text>
                ) : (
                  filteredTeachers.map(t => {
                    const selected = selectedTeacherIds.includes(t.id);
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.teacherOption, selected && styles.teacherOptionSelected]}
                        onPress={() => toggleTeacher(t.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                          {selected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={[styles.teacherOptionText, selected && styles.teacherOptionTextSelected]}>
                          {t.full_name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

              {/* Buttons */}
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color={Colors.white} size="small" />
                    : <Text style={styles.saveText}>
                        Save{selectedTeacherIds.length > 0 ? ` (${selectedTeacherIds.length})` : ''}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: Colors.mist },
  container: { flex: 1 },
  content: { padding: Spacing.lg },
  loader: { marginTop: Spacing.xl },
  error: { ...Typography.body, color: Colors.red, textAlign: 'center', marginTop: Spacing.xl },

  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: Spacing.md,
  },
  title: { ...Typography.display, marginBottom: 4 },
  subtitle: { ...Typography.body },
  refreshBtn: {
    backgroundColor: Colors.white, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border, marginTop: 6,
  },
  refreshText: { ...Typography.label, color: Colors.forest, fontSize: 12, textTransform: 'none' },

  search: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 11,
    ...Typography.body, color: Colors.ink, backgroundColor: Colors.white,
    marginBottom: Spacing.sm,
  },

  filterRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.md },
  filterTab: {
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  filterTabActive: { backgroundColor: Colors.leaf, borderColor: Colors.leaf },
  filterTabText: { ...Typography.label, color: Colors.inkLight, fontSize: 11, textTransform: 'none' },
  filterTabTextActive: { color: Colors.white },

  courseCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  courseLeft: { flex: 1 },
  courseName: { ...Typography.heading2, fontSize: 14, marginBottom: 4 },
  tagRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: 6, flexWrap: 'wrap' },
  tag: {
    backgroundColor: Colors.mist, borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  tagText: { ...Typography.body, fontSize: 10 },
  teacherPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  teacherPill: {
    backgroundColor: Colors.leaf + '15', borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.leaf + '30',
  },
  teacherPillText: { ...Typography.body, fontSize: 11, color: Colors.leaf },
  noTeacher: { ...Typography.body, fontSize: 12, color: Colors.amber },

  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: Spacing.sm, flexShrink: 0 },
  dotGreen: { backgroundColor: Colors.leaf },
  dotAmber: { backgroundColor: Colors.amber },

  emptyState: { alignItems: 'center', marginTop: Spacing.xxl, gap: Spacing.sm },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...Typography.heading1 },

  // Modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.lg,
  },
  centered: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  modal: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: Spacing.lg, maxHeight: '90%',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.xs,
  },
  modalTitle: { ...Typography.heading1 },
  closeBtn: { padding: Spacing.xs },
  closeText: { fontSize: 18, color: Colors.inkLight },
  modalCourseName: { ...Typography.body, color: Colors.forest, marginBottom: Spacing.md },

  selectedBadgeRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing.sm,
  },
  modalLabel: { ...Typography.label },
  selectedBadge: {
    backgroundColor: Colors.leaf, borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  selectedBadgeText: { ...Typography.label, color: Colors.white, fontSize: 10, textTransform: 'none' },

  teacherSearchInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    ...Typography.body, color: Colors.ink,
    marginBottom: Spacing.sm, backgroundColor: Colors.mist,
  },

  teacherList: { maxHeight: 280, marginBottom: Spacing.sm },
  noResults: { ...Typography.body, textAlign: 'center', marginTop: Spacing.md },

  teacherOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.sm, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xs,
  },
  teacherOptionSelected: { borderColor: Colors.leaf, backgroundColor: Colors.leaf + '10' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxSelected: { backgroundColor: Colors.leaf, borderColor: Colors.leaf },
  checkmark: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  teacherOptionText: { ...Typography.body, color: Colors.ink, flex: 1 },
  teacherOptionTextSelected: { color: Colors.leaf, fontWeight: '500' },

  saveError: { ...Typography.body, color: Colors.red, marginBottom: Spacing.sm },
  modalBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingVertical: 13, alignItems: 'center',
  },
  cancelText: { ...Typography.body, color: Colors.ink, fontWeight: '500' },
  saveBtn: {
    flex: 2, backgroundColor: Colors.leaf,
    borderRadius: Radius.sm, paddingVertical: 13, alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: Colors.inkLight },
  saveText: { ...Typography.label, color: Colors.white, textTransform: 'none', fontSize: 14 },
});

export default AssignCoursesScreen;
