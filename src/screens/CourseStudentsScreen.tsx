import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { supabase } from '../services/supabase';
import { Course } from '../types';
import { Green, Ink, Tint } from '../theme';
import CourseStudentDetailModal from '../components/CourseStudentDetailModal';

interface StudentRow {
  id: string;
  full_name: string;
  grade: number | null;
  missed_classes: number | null;
}

interface Props {
  course: Course;
  onBack: () => void;
}

const C = {
  forest: Green[700], leaf: Green[500], mist: Green[50],
  ink: Ink.base, inkMid: Ink[3], inkSoft: Ink[4],
  border: Ink.line, card: Ink.surface, green50: Green[50],
  red: Tint.rose.ink, amber: Tint.sun.ink,
};

const gradeColor = (g: number | null) => {
  if (g === null) return C.inkSoft;
  if (g >= 80) return C.forest;
  if (g >= 60) return C.amber;
  return C.red;
};

const CourseStudentsScreen: React.FC<Props> = ({ course, onBack }) => {
  const [students, setStudents]             = useState<StudentRow[]>([]);
  const [loading, setLoading]               = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('grade, missed_classes, students(id, full_name)')
        .eq('course_id', course.id)
        .order('grade', { ascending: false });

      if (!error && data) {
        const rows: StudentRow[] = (data as any[]).map(r => ({
          id: r.students?.id ?? '',
          full_name: r.students?.full_name ?? 'Unknown',
          grade: r.grade ?? null,
          missed_classes: r.missed_classes ?? null,
        }));
        setStudents(rows);
      }
      setLoading(false);
    };
    fetch();
  }, [course.id]);

  const avg = students.length
    ? Math.round(students.reduce((s, r) => s + (r.grade ?? 0), 0) / students.length)
    : null;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack}>
          <Text style={s.backArrow}>←</Text>
          <Text style={s.backText}>Courses</Text>
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.courseName}>{course.name}</Text>
          <View style={s.tags}>
            {course.program && <Text style={s.tag}>{course.program}</Text>}
            {course.semester && <Text style={s.tag}>{course.semester}</Text>}
          </View>
        </View>
        <View style={s.summaryRow}>
          <View style={s.summaryBox}>
            <Text style={s.summaryVal}>{students.length}</Text>
            <Text style={s.summaryLabel}>Students</Text>
          </View>
          <View style={s.summaryBox}>
            <Text style={[s.summaryVal, { color: avg !== null ? gradeColor(avg) : C.inkSoft }]}>
              {avg !== null ? `${avg}%` : '—'}
            </Text>
            <Text style={s.summaryLabel}>Class Avg</Text>
          </View>
        </View>
      </View>

      {/* Student list */}
      {loading ? (
        <View style={s.centre}>
          <ActivityIndicator color={C.leaf} size="large" />
        </View>
      ) : students.length === 0 ? (
        <View style={s.centre}>
          <Text style={s.emptyIcon}>👩‍🎓</Text>
          <Text style={s.emptyText}>No students enrolled yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {/* Column headers */}
          <View style={s.colHeader}>
            <Text style={[s.colLabel, { flex: 1 }]}>Student</Text>
            <Text style={[s.colLabel, { width: 70, textAlign: 'center' }]}>Grade</Text>
            <Text style={[s.colLabel, { width: 70, textAlign: 'center' }]}>Missed</Text>
          </View>

          {students.map((st, idx) => (
            <TouchableOpacity
              key={st.id}
              style={[s.row, idx % 2 === 0 && s.rowAlt]}
              onPress={() => setSelectedStudent(st)}
              activeOpacity={0.7}
            >
              <View style={s.rankBadge}>
                <Text style={s.rankText}>{idx + 1}</Text>
              </View>
              <Text style={s.studentName} numberOfLines={1}>{st.full_name}</Text>
              <View style={[s.gradePill, { backgroundColor: gradeColor(st.grade) + '18' }]}>
                <Text style={[s.gradeText, { color: gradeColor(st.grade) }]}>
                  {st.grade !== null ? `${st.grade}%` : '—'}
                </Text>
              </View>
              <View style={[s.missedPill, st.missed_classes !== null && st.missed_classes > 5 && s.missedHigh]}>
                <Text style={[s.missedText, st.missed_classes !== null && st.missed_classes > 5 && s.missedHighText]}>
                  {st.missed_classes !== null ? st.missed_classes : '—'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Student detail modal */}
      <CourseStudentDetailModal
        visible={!!selectedStudent}
        student={selectedStudent}
        currentCourse={course}
        onClose={() => setSelectedStudent(null)}
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.mist },
  centre:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: C.inkMid },

  header: {
    backgroundColor: C.forest, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 20,
  },
  backBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  backArrow: { fontSize: 18, color: 'rgba(255,255,255,0.8)' },
  backText:  { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  headerInfo:{ marginBottom: 16 },
  courseName:{ fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6 },
  tags:      { flexDirection: 'row', gap: 6 },
  tag:       { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, fontSize: 11, color: '#fff', fontWeight: '600', overflow: 'hidden' },
  summaryRow:{ flexDirection: 'row', gap: 12 },
  summaryBox:{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 12, alignItems: 'center' },
  summaryVal:{ fontSize: 22, fontWeight: '900', color: '#fff' },
  summaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  list: { padding: 16, paddingBottom: 40 },
  colHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 8, marginBottom: 4,
  },
  colLabel: { fontSize: 10, fontWeight: '700', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 8, paddingVertical: 10,
    paddingHorizontal: 12, marginBottom: 4,
    borderWidth: 1, borderColor: C.border,
  },
  rowAlt: { backgroundColor: '#FAFCFA' },
  rankBadge: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: C.green50,
    alignItems: 'center', justifyContent: 'center',
  },
  rankText:    { fontSize: 10, fontWeight: '700', color: C.forest },
  studentName: { flex: 1, fontSize: 13, fontWeight: '600', color: C.ink },
  gradePill:   { width: 70, borderRadius: 8, paddingVertical: 4, alignItems: 'center' },
  gradeText:   { fontSize: 13, fontWeight: '800' },
  missedPill:  { width: 70, borderRadius: 8, paddingVertical: 4, alignItems: 'center', backgroundColor: '#F3F4F6' },
  missedHigh:  { backgroundColor: '#FDF1F1' },
  missedText:  { fontSize: 13, fontWeight: '700', color: C.inkMid },
  missedHighText: { color: C.red },
});

export default CourseStudentsScreen;
