import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, TextInput,
} from 'react-native';
import { getAllStudents, getStudentsByTeacher, getAllCourses } from '../services/supabase';
import { Profile, Course, StudentWithEnrollments } from '../types';
import { Green, Ink, Tint } from '../theme';
import StudentDetailModal from '../components/StudentDetailModal';
import DescriptionEditModal from '../components/DescriptionEditModal';

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  forest:  Green[700],
  leaf:    Green[500],
  mist:    Green[50],
  ink:     Ink.base,
  inkMid:  Ink[3],
  inkSoft: Ink[4],
  border:  Ink.line,
  card:    Ink.surface,
  red:     Tint.rose.ink,
  amber:   Tint.sun.ink,
};

const gradeColor = (g: number | null) => {
  if (g === null) return C.inkSoft;
  if (g >= 80) return C.forest;
  if (g >= 60) return C.amber;
  return C.red;
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  profile: Profile;
  /**
   * For professor: their assigned courses (used for course name lookup in the modal).
   * For admin: pass [] — courses are fetched internally.
   */
  courses: Course[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const getAvgGrade = (s: StudentWithEnrollments): number | null => {
  const graded = s.enrollments.filter(e => e.grade !== null);
  if (!graded.length) return null;
  return Math.round(graded.reduce((sum, e) => sum + (e.grade ?? 0), 0) / graded.length);
};

const getInitials = (name: string): string =>
  name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();

// ── Component ─────────────────────────────────────────────────────────────────
const StudentListScreen: React.FC<Props> = ({ profile, courses: propCourses }) => {
  const isAdmin = profile.role === 'administrator';

  const [students, setStudents]               = useState<StudentWithEnrollments[]>([]);
  const [allCourses, setAllCourses]           = useState<Course[]>(propCourses);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState('');
  const [search, setSearch]                   = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentWithEnrollments | null>(null);
  const [descStudent, setDescStudent]         = useState<StudentWithEnrollments | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isAdmin) {
        const [fetchedStudents, fetchedCourses] = await Promise.all([
          getAllStudents(),
          getAllCourses(),
        ]);
        setStudents(fetchedStudents);
        setAllCourses(fetchedCourses);
      } else {
        const fetchedStudents = await getStudentsByTeacher(profile.id);
        setStudents(fetchedStudents);
        // propCourses already set as initial allCourses
      }
    } catch {
      setError('Failed to load students. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, profile.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Keep allCourses in sync when propCourses updates (professor view)
  useEffect(() => {
    if (!isAdmin) setAllCourses(propCourses);
  }, [propCourses, isAdmin]);

  const handleStudentUpdated = (updated: StudentWithEnrollments) => {
    setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelectedStudent(updated);
  };

  // Search filter
  const filtered = students.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q)
    );
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={sl.container}>

      {/* Page header */}
      <View style={sl.pageHeader}>
        <Text style={sl.pageTitle}>Student List</Text>
        <Text style={sl.pageDesc}>
          {isAdmin
            ? 'View and manage all student profiles across the institution.'
            : 'Students enrolled in your assigned courses.'}
        </Text>
      </View>

      {/* Search bar */}
      <View style={sl.searchWrap}>
        <TextInput
          style={sl.searchInput}
          placeholder="Search by name or email…"
          placeholderTextColor={C.inkSoft}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {/* Content */}
      {loading ? (
        <View style={sl.centre}>
          <ActivityIndicator color={C.leaf} size="large" />
          <Text style={sl.loadingText}>Loading students…</Text>
        </View>

      ) : error ? (
        <View style={sl.centre}>
          <Text style={sl.errorIcon}>⚠️</Text>
          <Text style={sl.errorText}>{error}</Text>
          <TouchableOpacity style={sl.retryBtn} onPress={fetchData} activeOpacity={0.75}>
            <Text style={sl.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>

      ) : filtered.length === 0 ? (
        <View style={sl.centre}>
          <Text style={sl.emptyIcon}>👩‍🎓</Text>
          <Text style={sl.emptyTitle}>
            {search.trim()
              ? 'No students match your search.'
              : isAdmin
                ? 'No students found in the system.'
                : 'No students are currently connected to your courses.'}
          </Text>
        </View>

      ) : (
        <ScrollView contentContainerStyle={sl.list}>

          {/* Count row */}
          <Text style={sl.countLine}>
            {filtered.length} student{filtered.length !== 1 ? 's' : ''}
            {search.trim() ? ' matching' : isAdmin ? ' total' : ' in your courses'}
          </Text>

          {filtered.map(student => {
            const avg = getAvgGrade(student);
            const cc  = student.enrollments.length;

            return (
              <TouchableOpacity
                key={student.id}
                style={sl.card}
                onPress={() => setSelectedStudent(student)}
                activeOpacity={0.72}
              >
                {/* Avatar */}
                <View style={sl.avatar}>
                  <Text style={sl.avatarText}>{getInitials(student.full_name)}</Text>
                </View>

                {/* Info */}
                <View style={sl.cardBody}>
                  <Text style={sl.studentName} numberOfLines={1}>{student.full_name}</Text>
                  <Text style={sl.studentEmail} numberOfLines={1}>
                    {student.email || 'No email on record'}
                  </Text>
                  <Text style={sl.studentMeta}>
                    {cc} course{cc !== 1 ? 's' : ''}
                  </Text>
                  {!!student.nationality && (
                    <Text style={sl.studentNationality} numberOfLines={1}>
                      {student.nationality}
                    </Text>
                  )}
                </View>

                {/* Right-side actions */}
                <View style={sl.rightArea}>
                  {avg !== null && (
                    <View style={[sl.gradePill, { backgroundColor: gradeColor(avg) + '18' }]}>
                      <Text style={[sl.gradeText, { color: gradeColor(avg) }]}>{avg}%</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={sl.noteBtn}
                    onPress={() => setDescStudent(student)}
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                    activeOpacity={0.6}
                  >
                    <Text style={sl.noteBtnText}>
                      {student.description ? '📝' : '📋'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={sl.chevron}>›</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Student detail modal */}
      <StudentDetailModal
        visible={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        student={selectedStudent}
        allCourses={allCourses}
        role={profile.role}
        onStudentUpdated={handleStudentUpdated}
      />

      {/* Quick description edit modal (📝 button on card) */}
      <DescriptionEditModal
        visible={!!descStudent}
        onClose={() => setDescStudent(null)}
        studentId={descStudent?.id ?? ''}
        studentName={descStudent?.full_name ?? ''}
        initialDescription={descStudent?.description}
        onSaved={(desc) => {
          setStudents(prev =>
            prev.map(s => s.id === descStudent?.id ? { ...s, description: desc } : s),
          );
          setDescStudent(null);
        }}
      />
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const sl = StyleSheet.create({
  container: { flex: 1, backgroundColor: Green[50] },

  pageHeader: {
    backgroundColor: Green[700],
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  pageDesc:  { fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: '400' },

  searchWrap: {
    backgroundColor: Ink.surface,
    borderBottomWidth: 1,
    borderBottomColor: Ink.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    backgroundColor: Green[50],
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Ink.line,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    color: Ink.base,
  },

  centre:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  loadingText: { fontSize: 13, color: Ink[3], marginTop: 8 },
  errorIcon:   { fontSize: 32 },
  errorText:   { fontSize: 13, color: Tint.rose.ink, textAlign: 'center', lineHeight: 19 },
  retryBtn:    {
    marginTop: 8, backgroundColor: Green[600],
    borderRadius: 8, paddingHorizontal: 20, paddingVertical: 9,
  },
  retryBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  emptyIcon:    { fontSize: 40 },
  emptyTitle:   { fontSize: 14, color: Ink[3], textAlign: 'center', maxWidth: 280, lineHeight: 20 },

  list:      { padding: 12, paddingBottom: 40 },
  countLine: {
    fontSize: 11, fontWeight: '700', color: Ink[4],
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 10, paddingHorizontal: 4,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Ink.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Ink.line,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Green[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  cardBody:          { flex: 1 },
  studentName:       { fontSize: 13, fontWeight: '700', color: Ink.base, marginBottom: 2 },
  studentEmail:      { fontSize: 11, color: Ink[3], marginBottom: 2 },
  studentMeta:       { fontSize: 11, color: Ink[4], fontWeight: '500' },
  studentNationality:{ fontSize: 11, color: Green[600], fontWeight: '600', marginTop: 2 },

  rightArea: { alignItems: 'flex-end', gap: 6 },
  gradePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  gradeText: { fontSize: 13, fontWeight: '800' },
  noteBtn:   {},
  noteBtnText: { fontSize: 15 },
  chevron:   { fontSize: 20, color: Ink[4], fontWeight: '300' },
});

export default StudentListScreen;
