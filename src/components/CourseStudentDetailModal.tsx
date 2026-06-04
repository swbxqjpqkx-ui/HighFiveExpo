import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Modal, ActivityIndicator,
} from 'react-native';
import { supabase } from '../services/supabase';
import {
  fetchStudentCourseHomeworkResults,
  CourseHomeworkRecord,
} from '../services/homeworkAssistanceService';
import { Course } from '../types';
import { Green, Ink, Tint } from '../theme';
import { formatDOB, formatAgeStr } from '../utils/studentHelpers';
import StudentProfileInfoSection from './StudentProfileInfoSection';

const C = {
  forest:  Green[700],
  leaf:    Green[500],
  mist:    Green[50],
  ink:     Ink.base,
  inkMid:  Ink[3],
  inkSoft: Ink[4],
  border:  Ink.line,
  card:    Ink.surface,
  green50: Green[50],
  red:     Tint.rose.ink,
  amber:   Tint.sun.ink,
};

interface StudentInfo {
  id: string;
  full_name: string;
  grade: number | null;
  missed_classes: number | null;
}

interface EnrolledCourse {
  id: string;
  name: string;
  program: string | null;
  semester: string | null;
  grade: number | null;
  missed_classes: number | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  student: StudentInfo | null;
  currentCourse: Course;
}

const gradeColor = (g: number | null) => {
  if (g === null) return C.inkSoft;
  if (g >= 80) return C.forest;
  if (g >= 60) return C.amber;
  return C.red;
};

const InfoRow: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => (
  <View style={s.infoRow}>
    <Text style={s.infoLabel}>{label}</Text>
    <Text style={s.infoValue}>{value || 'Not provided'}</Text>
  </View>
);

const CourseStudentDetailModal: React.FC<Props> = ({
  visible, onClose, student, currentCourse,
}) => {
  const [email,         setEmail]         = useState<string | null>(null);
  const [nationality,   setNationality]   = useState<string | null>(null);
  const [dob,           setDob]           = useState<string | null>(null);
  const [allCourses,    setAllCourses]    = useState<EnrolledCourse[]>([]);
  const [hwResults,     setHwResults]     = useState<CourseHomeworkRecord[]>([]);
  const [expandedHwId, setExpandedHwId]  = useState<string | null>(null);
  const [loading,       setLoading]       = useState(false);

  useEffect(() => {
    if (!visible || !student) {
      setEmail(null);
      setNationality(null);
      setDob(null);
      setAllCourses([]);
      setHwResults([]);
      setExpandedHwId(null);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase
        .from('students')
        .select('email, nationality, date_of_birth')
        .eq('id', student.id)
        .single(),
      supabase
        .from('course_enrollments')
        .select('grade, missed_classes, courses(id, name, program, semester)')
        .eq('student_id', student.id),
      fetchStudentCourseHomeworkResults(student.id, currentCourse.id),
    ])
      .then(([studentRes, enrollmentRes, hwRes]) => {
        if (!studentRes.error && studentRes.data) {
          const sd = studentRes.data as any;
          setEmail(sd.email ?? null);
          setNationality(sd.nationality ?? null);
          setDob(sd.date_of_birth ?? null);
        }
        if (!enrollmentRes.error && enrollmentRes.data) {
          const courses: EnrolledCourse[] = (enrollmentRes.data as any[])
            .filter(r => !!r.courses)
            .map(r => ({
              id:             r.courses.id,
              name:           r.courses.name,
              program:        r.courses.program ?? null,
              semester:       r.courses.semester ?? null,
              grade:          r.grade ?? null,
              missed_classes: r.missed_classes ?? null,
            }));
          setAllCourses(courses);
        }
        setHwResults(hwRes ?? []);
      })
      .finally(() => setLoading(false));
  }, [visible, student?.id, currentCourse.id]);

  if (!student) return null;

  // Aggregate across ALL enrolled courses (not only the current course).
  const gradedCourses = allCourses.filter(c => c.grade !== null);
  const avgGrade = gradedCourses.length
    ? Math.round(gradedCourses.reduce((sum, c) => sum + (c.grade ?? 0), 0) / gradedCourses.length)
    : null;
  const totalAbsences = allCourses.reduce((sum, c) => sum + (c.missed_classes ?? 0), 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={s.root}>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerName}>{student.full_name}</Text>
            {!!email && <Text style={s.headerSub}>{email}</Text>}
            <Text style={s.headerCourse}>{currentCourse.name}</Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={s.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.centre}>
            <ActivityIndicator color={C.leaf} size="large" />
          </View>
        ) : (
          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>

            {/* Student Information */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Student Information</Text>
              <InfoRow label="Full Name"     value={student.full_name} />
              <InfoRow label="Email"         value={email} />
              <InfoRow label="Age"           value={formatAgeStr(dob)} />
              <InfoRow label="Date of Birth" value={formatDOB(dob)} />
              <InfoRow label="Nationality"   value={nationality} />
              <InfoRow label="Average Grade"  value={avgGrade !== null ? `${avgGrade}%` : 'Not available'} />
              <InfoRow label="Total Absences" value={String(totalAbsences)} />
              <View style={[s.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={s.infoLabel}>Program</Text>
                <Text style={s.infoValue}>{currentCourse.program || 'Not provided'}</Text>
              </View>
            </View>

            {/* Student Profile Information (replaces the old Notes field) */}
            <StudentProfileInfoSection
              studentId={student.id}
              studentName={student.full_name}
            />

            {/* Current Course */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Current Course</Text>
              <View style={s.courseCard}>
                <Text style={s.courseCardName}>{currentCourse.name}</Text>
                {!!currentCourse.semester && (
                  <Text style={s.courseCardSub}>{currentCourse.semester}</Text>
                )}
                <View style={s.statRow}>
                  <View style={s.statChip}>
                    <Text style={[s.statVal, { color: gradeColor(student.grade) }]}>
                      {student.grade !== null ? `${student.grade}%` : '—'}
                    </Text>
                    <Text style={s.statLbl}>Grade</Text>
                  </View>
                  <View style={s.statChip}>
                    <Text style={[
                      s.statVal,
                      student.missed_classes !== null && student.missed_classes > 5
                        ? { color: C.red } : {},
                    ]}>
                      {student.missed_classes !== null ? student.missed_classes : '—'}
                    </Text>
                    <Text style={s.statLbl}>Missed</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Homework Feedback */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>📝 Homework Feedback</Text>
              {hwResults.length === 0 ? (
                <Text style={s.emptyNote}>No approved homework feedback yet.</Text>
              ) : (
                hwResults.map((hw, i) => {
                  const finalGrade  = hw.professor_edited_grade ?? hw.overall_suggested_grade;
                  const gradeDisplay =
                    hw.grade_points != null && hw.total_points != null
                      ? `${hw.grade_points}/${hw.total_points} pts  ·  ${finalGrade}%`
                      : `${finalGrade}%`;
                  const dateStr = new Date(hw.approved_at ?? hw.created_at).toLocaleDateString(
                    'en-GB',
                    { day: 'numeric', month: 'short', year: 'numeric' },
                  );

                  // Build neutral AI performance summary from existing AI-generated fields
                  const summaryParts: string[] = [];
                  if (hw.grade_justification?.trim()) summaryParts.push(hw.grade_justification.trim());
                  if (hw.strengths?.length > 0)       summaryParts.push(`Key strengths: ${hw.strengths.join('; ')}.`);
                  if (hw.weaknesses?.length > 0)      summaryParts.push(`Areas for development: ${hw.weaknesses.join('; ')}.`);
                  if (hw.improvement_recommendations?.length > 0)
                    summaryParts.push(`Recommendations: ${hw.improvement_recommendations.join('; ')}.`);
                  const fullSummary   = summaryParts.join('\n\n');
                  const summaryPreview = fullSummary
                    ? (fullSummary.length > 160 ? fullSummary.slice(0, 160).trimEnd() + '…' : fullSummary)
                    : 'Summary not available for this homework yet.';

                  const isExpanded = expandedHwId === hw.id;

                  return (
                    <View
                      key={hw.id}
                      style={[s.hwCard, i === hwResults.length - 1 && s.hwCardLast]}
                    >
                      {/* Assignment + grade */}
                      <View style={s.hwCardHeader}>
                        <Text style={s.hwAssignmentTitle} numberOfLines={2}>
                          {hw.assignment_title}
                        </Text>
                        <Text style={[s.hwGradeText, { color: gradeColor(finalGrade) }]}>
                          {gradeDisplay}
                        </Text>
                      </View>

                      {/* AI summary preview */}
                      <Text style={s.hwSummaryLabel}>AI Homework Summary</Text>
                      <Text style={s.hwFeedback}>{summaryPreview}</Text>

                      {/* Status + date row */}
                      <View style={s.hwFooterRow}>
                        <View style={s.hwStatusBadge}>
                          <Text style={s.hwStatusText}>✓ Approved</Text>
                        </View>
                        <Text style={s.hwDate}>Approved on: {dateStr}</Text>
                      </View>

                      {/* Expand / collapse */}
                      {isExpanded ? (
                        <View style={s.hwExpandedSection}>
                          <Text style={s.hwExpandedTitle}>Homework Performance Summary</Text>
                          <Text style={s.hwExpandedText}>
                            {fullSummary || 'Summary not available for this homework yet.'}
                          </Text>
                          <TouchableOpacity
                            style={s.hwShowLessBtn}
                            onPress={() => setExpandedHwId(null)}
                            activeOpacity={0.7}
                          >
                            <Text style={s.hwShowLessText}>Show less ↑</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        !!fullSummary && (
                          <TouchableOpacity
                            style={s.hwReadMoreBtn}
                            onPress={() => setExpandedHwId(hw.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={s.hwReadMoreText}>Read full summary ↓</Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  );
                })
              )}
            </View>

            {/* All Enrolled Courses */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>
                All Enrolled Courses ({allCourses.length})
              </Text>
              {allCourses.length === 0 ? (
                <Text style={s.emptyNote}>No enrollment data available.</Text>
              ) : (
                allCourses.map((c, i) => (
                  <View
                    key={c.id}
                    style={[
                      s.courseRow,
                      i === allCourses.length - 1 && s.courseRowLast,
                      c.id === currentCourse.id && s.courseRowHighlight,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={s.courseRowTitleLine}>
                        <Text style={s.courseRowName} numberOfLines={1}>{c.name}</Text>
                        {c.id === currentCourse.id && (
                          <View style={s.currentBadge}>
                            <Text style={s.currentBadgeText}>Current</Text>
                          </View>
                        )}
                      </View>
                      {(!!c.program || !!c.semester) && (
                        <Text style={s.courseRowSub}>
                          {[c.program, c.semester].filter(Boolean).join('  ·  ')}
                        </Text>
                      )}
                    </View>
                    <Text style={[s.courseRowGrade, { color: gradeColor(c.grade) }]}>
                      {c.grade !== null ? `${c.grade}%` : '—'}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.mist },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    backgroundColor: C.forest,
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerName:   { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 2 },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 2 },
  headerCourse: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 48 },

  section: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.forest,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 10,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoLabel: { fontSize: 12, color: C.inkMid, fontWeight: '500', flex: 1 },
  infoValue: { fontSize: 13, color: C.ink, fontWeight: '600', flex: 2, textAlign: 'right' },

  courseCard:     { backgroundColor: C.green50, borderRadius: 10, padding: 12 },
  courseCardName: { fontSize: 15, fontWeight: '800', color: C.forest, marginBottom: 2 },
  courseCardSub:  { fontSize: 12, color: C.inkMid, marginBottom: 10 },
  statRow:        { flexDirection: 'row', gap: 10 },
  statChip: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 8,
    alignItems: 'center',
  },
  statVal: { fontSize: 16, fontWeight: '900', marginBottom: 1 },
  statLbl: {
    fontSize: 10,
    color: C.inkSoft,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  courseRowLast:      { borderBottomWidth: 0 },
  courseRowHighlight: {
    backgroundColor: C.green50,
    marginHorizontal: -6,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  courseRowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  courseRowName:  { fontSize: 13, fontWeight: '700', color: C.ink, flexShrink: 1 },
  courseRowSub:   { fontSize: 11, color: C.inkMid },
  courseRowGrade: { fontSize: 14, fontWeight: '800', minWidth: 40, textAlign: 'right' },
  currentBadge: {
    backgroundColor: C.forest + '18',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: C.forest,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  emptyNote: { fontSize: 13, color: C.inkSoft, textAlign: 'center', paddingVertical: 8 },

  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  editNoteBtn: {
    backgroundColor: C.green50, borderRadius: 7,
    borderWidth: 1, borderColor: C.forest + '44',
    paddingHorizontal: 10, paddingVertical: 5,
  },
  editNoteBtnText: { fontSize: 11, fontWeight: '700', color: C.forest },

  descText:  { fontSize: 13, color: C.ink, lineHeight: 20 },
  descEmpty: { fontSize: 13, color: C.inkSoft, fontStyle: 'italic' },

  // ── Homework feedback cards ─────────────────────────────────────────────────
  hwCard: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  hwCardLast: { borderBottomWidth: 0 },
  hwCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  hwAssignmentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
    flex: 1,
  },
  hwGradeText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  hwSummaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.forest,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
    marginTop: 6,
  },
  hwFeedback: {
    fontSize: 12,
    color: C.inkMid,
    lineHeight: 18,
    marginBottom: 6,
  },
  hwFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  hwStatusBadge: {
    backgroundColor: C.green50,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.forest + '30',
  },
  hwStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.forest,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  hwDate: {
    fontSize: 11,
    color: C.inkSoft,
    fontWeight: '500',
    flex: 1,
  },
  hwReadMoreBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  hwReadMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.forest,
  },
  hwExpandedSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  hwExpandedTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: C.forest,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  hwExpandedText: {
    fontSize: 13,
    color: C.ink,
    lineHeight: 20,
  },
  hwShowLessBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  hwShowLessText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.inkMid,
  },
});

export default CourseStudentDetailModal;
