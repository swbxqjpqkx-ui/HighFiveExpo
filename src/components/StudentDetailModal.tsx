import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { updateStudentProfile } from '../services/supabase';
import { StudentWithEnrollments, Course } from '../types';
import { Green, Ink, Tint } from '../theme';
import { formatDOB, formatAgeStr } from '../utils/studentHelpers';
import StudentProfileInfoSection from './StudentProfileInfoSection';
import {
  fetchStudentHomeworkResults,
  StudentHomeworkRecord,
} from '../services/homeworkAssistanceService';

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  forest:  Green[700],
  leaf:    Green[500],
  mist:    Green[50],
  ink:     Ink.base,
  inkMid:  Ink[3],
  inkSoft: Ink[4],
  border:  Ink.line,
  border2: Ink.line2,
  card:    Ink.surface,
  red:     Tint.rose.ink,
  amber:   Tint.sun.ink,
  skyBg:   Tint.sky.bg,
  skyInk:  Tint.sky.ink,
  skyLine: Tint.sky.line,
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  visible:          boolean;
  onClose:          () => void;
  student:          StudentWithEnrollments | null;
  allCourses:       Course[];
  role:             'professor' | 'administrator';
  onStudentUpdated?: (updated: StudentWithEnrollments) => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────
const InfoRow: React.FC<{ label: string; value?: string | null; last?: boolean }> = ({
  label, value, last,
}) => (
  <View style={[m.row, last && { borderBottomWidth: 0 }]}>
    <Text style={m.rowLabel}>{label}</Text>
    <Text style={m.rowValue}>{value || 'Not provided'}</Text>
  </View>
);

const gradeColor = (g: number | null) => {
  if (g === null) return C.inkSoft;
  if (g >= 80) return C.forest;
  if (g >= 60) return C.amber;
  return C.red;
};

// ── Main component ────────────────────────────────────────────────────────────
const StudentDetailModal: React.FC<Props> = ({
  visible, onClose, student, allCourses, role, onStudentUpdated,
}) => {
  const isAdmin = role === 'administrator';

  const [editing,         setEditing]         = useState(false);
  const [editName,        setEditName]        = useState('');
  const [editEmail,       setEditEmail]       = useState('');
  const [editNationality, setEditNationality] = useState('');
  const [editDOB,         setEditDOB]         = useState('');
  const [saving,          setSaving]          = useState(false);
  const [saveError,       setSaveError]       = useState('');

  // ── Homework results (admin view only) ──────────────────────────────────────
  const [hwRecords,        setHwRecords]       = useState<StudentHomeworkRecord[]>([]);
  const [hwLoading,        setHwLoading]       = useState(false);
  const [hwExpanded,       setHwExpanded]      = useState<string | null>(null); // record id

  useEffect(() => {
    if (visible && student) {
      setEditName(student.full_name);
      setEditEmail(student.email ?? '');
      setEditNationality(student.nationality ?? '');
      setEditDOB(student.date_of_birth ?? '');
      setEditing(false);
      setSaveError('');
    }
  }, [visible, student?.id]);

  // Load homework records when admin opens the modal
  useEffect(() => {
    if (!visible || !student || !isAdmin) { setHwRecords([]); return; }
    setHwLoading(true);
    fetchStudentHomeworkResults(student.id)
      .then(setHwRecords)
      .catch(() => setHwRecords([]))
      .finally(() => setHwLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, student?.id]);

  if (!student) return null;

  // Map enrollments → course details (join by course_id)
  const enrolledCourses = student.enrollments.map(enr => {
    const course = allCourses.find(c => c.id === enr.course_id);
    return {
      ...enr,
      courseName: course?.name    ?? 'Unknown Course',
      program:    course?.program ?? null,
      semester:   course?.semester ?? null,
    };
  });

  // Unique programs across enrolled courses
  const programs = [
    ...new Set(enrolledCourses.map(c => c.program).filter(Boolean)),
  ] as string[];

  // Academic stats
  const graded  = enrolledCourses.filter(c => c.grade !== null);
  const avgGrade = graded.length
    ? Math.round(graded.reduce((s, c) => s + (c.grade ?? 0), 0) / graded.length)
    : null;
  const totalMissed = enrolledCourses.reduce((s, c) => s + (c.missed_classes ?? 0), 0);

  const handleSave = async () => {
    if (!editName.trim()) { setSaveError('Full name cannot be empty.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const updates = {
        full_name:     editName.trim(),
        email:         editEmail.trim() || null,
        nationality:   editNationality.trim() || null,
        date_of_birth: editDOB.trim() || null,
      };
      await updateStudentProfile(student.id, updates);
      setEditing(false);
      onStudentUpdated?.({
        ...student,
        full_name:     updates.full_name ?? student.full_name,
        email:         updates.email ?? '',
        nationality:   updates.nationality ?? null,
        date_of_birth: updates.date_of_birth ?? null,
      });
    } catch (e: any) {
      setSaveError(
        e?.code === '42501'
          ? 'Permission denied. Your account does not have edit access to student records.'
          : 'Failed to save. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={m.root}>

        {/* ── Header ── */}
        <View style={m.header}>
          <View style={{ flex: 1 }}>
            <Text style={m.headerName} numberOfLines={1}>
              {editing ? (editName || student.full_name) : student.full_name}
            </Text>
            <Text style={m.headerSub} numberOfLines={1}>
              {student.email || 'No email on record'}
            </Text>
            <Text style={m.headerBadge}>
              {isAdmin ? 'Admin View' : 'Professor View'}
            </Text>
          </View>
          <View style={m.headerBtns}>
            {isAdmin && !editing && (
              <TouchableOpacity
                style={m.editBtn}
                onPress={() => setEditing(true)}
                activeOpacity={0.75}
              >
                <Text style={m.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={m.closeBtn}
              onPress={onClose}
              activeOpacity={0.75}
            >
              <Text style={m.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={m.scroll} contentContainerStyle={m.scrollContent}>

          {/* ── Personal Information ── */}
          <View style={m.section}>
            <Text style={m.sectionTitle}>Personal Information</Text>

            {editing ? (
              /* Edit mode (admin only) */
              <>
                <View style={m.fieldGroup}>
                  <Text style={m.fieldLabel}>Full Name</Text>
                  <TextInput
                    style={m.textInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Full name"
                    placeholderTextColor={C.inkSoft}
                    autoCapitalize="words"
                  />
                </View>
                <View style={m.fieldGroup}>
                  <Text style={m.fieldLabel}>Email</Text>
                  <TextInput
                    style={m.textInput}
                    value={editEmail}
                    onChangeText={setEditEmail}
                    placeholder="Email address"
                    placeholderTextColor={C.inkSoft}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <View style={m.fieldGroup}>
                  <Text style={m.fieldLabel}>Nationality</Text>
                  <TextInput
                    style={m.textInput}
                    value={editNationality}
                    onChangeText={setEditNationality}
                    placeholder="e.g. Moroccan"
                    placeholderTextColor={C.inkSoft}
                    autoCapitalize="words"
                  />
                </View>
                <View style={m.fieldGroup}>
                  <Text style={m.fieldLabel}>Date of Birth (YYYY-MM-DD)</Text>
                  <TextInput
                    style={m.textInput}
                    value={editDOB}
                    onChangeText={setEditDOB}
                    placeholder="e.g. 1999-04-15"
                    placeholderTextColor={C.inkSoft}
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>

                {!!saveError && <Text style={m.saveError}>{saveError}</Text>}

                <View style={m.saveRow}>
                  <TouchableOpacity
                    style={m.cancelBtn}
                    onPress={() => { setEditing(false); setSaveError(''); }}
                    disabled={saving}
                    activeOpacity={0.75}
                  >
                    <Text style={m.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[m.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.75}
                  >
                    {saving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={m.saveBtnText}>Save Changes</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* Read mode */
              <>
                <InfoRow label="Full Name"     value={student.full_name} />
                <InfoRow label="Email"         value={student.email} />
                <InfoRow label="Age"           value={formatAgeStr(student.date_of_birth)} />
                <InfoRow label="Date of Birth" value={formatDOB(student.date_of_birth)} />
                <InfoRow label="Nationality"   value={student.nationality} />
                <InfoRow label="Average Grade"  value={avgGrade !== null ? `${avgGrade}%` : 'Not available'} />
                <InfoRow label="Total Absences" value={String(totalMissed)} />
                <InfoRow
                  label="Program(s)"
                  value={programs.length > 0 ? programs.join(', ') : null}
                  last
                />
              </>
            )}
          </View>

          {/* ── Academic Overview (only in read mode) ── */}
          {!editing && (
            <View style={m.section}>
              <Text style={m.sectionTitle}>Academic Overview</Text>
              <View style={m.statRow}>
                <View style={m.statBox}>
                  <Text style={[m.statVal, { color: gradeColor(avgGrade) }]}>
                    {avgGrade !== null ? `${avgGrade}%` : '—'}
                  </Text>
                  <Text style={m.statLabel}>Avg Grade</Text>
                </View>
                <View style={m.statBox}>
                  <Text style={[m.statVal, totalMissed > 5 ? { color: C.amber } : {}]}>
                    {totalMissed}
                  </Text>
                  <Text style={m.statLabel}>Total Missed</Text>
                </View>
                <View style={m.statBox}>
                  <Text style={m.statVal}>{enrolledCourses.length}</Text>
                  <Text style={m.statLabel}>Courses</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Enrolled Courses (only in read mode) ── */}
          {!editing && (
            <View style={m.section}>
              <Text style={m.sectionTitle}>
                Enrolled Courses ({enrolledCourses.length})
              </Text>
              {enrolledCourses.length === 0 ? (
                <Text style={m.emptyNote}>No enrolled courses found.</Text>
              ) : (
                enrolledCourses.map((c, i) => (
                  <View
                    key={c.course_id}
                    style={[
                      m.courseRow,
                      i === enrolledCourses.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={m.courseName} numberOfLines={1}>{c.courseName}</Text>
                      {(!!c.program || !!c.semester) && (
                        <Text style={m.courseSub}>
                          {[c.program, c.semester].filter(Boolean).join('  ·  ')}
                        </Text>
                      )}
                    </View>
                    <View style={m.courseStats}>
                      <View style={m.courseStatCol}>
                        <Text style={[m.courseStatVal, { color: gradeColor(c.grade ?? null) }]}>
                          {c.grade != null ? `${c.grade}%` : '—'}
                        </Text>
                        <Text style={m.courseStatLbl}>grade</Text>
                      </View>
                      <View style={m.courseStatCol}>
                        <Text style={[
                          m.courseStatVal,
                          (c.missed_classes ?? 0) > 5 ? { color: C.amber } : {},
                        ]}>
                          {c.missed_classes ?? 0}
                        </Text>
                        <Text style={m.courseStatLbl}>missed</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ── Homework Results (admin, read mode only) ── */}
          {isAdmin && !editing && (
            <View style={m.section}>
              <Text style={m.sectionTitle}>📝 Homework Results</Text>
              {hwLoading ? (
                <ActivityIndicator color={Green[500]} style={{ marginVertical: 12 }} />
              ) : hwRecords.length === 0 ? (
                <Text style={m.emptyNote}>No approved homework results found for this student.</Text>
              ) : (
                hwRecords.map(rec => {
                  const isOpen  = hwExpanded === rec.id;
                  const grade   = rec.professor_edited_grade ?? rec.overall_suggested_grade;
                  const pts     = rec.grade_points;
                  const tot     = rec.total_points;
                  const gradeColor = grade >= 70 ? Green[700] : grade >= 55 ? Tint.sun.ink : Tint.rose.ink;
                  const feedback= rec.professor_edited_feedback ?? rec.student_feedback_draft;
                  return (
                    <View key={rec.id} style={m.hwCard}>
                      {/* Header row */}
                      <TouchableOpacity
                        style={m.hwHeader}
                        onPress={() => setHwExpanded(isOpen ? null : rec.id)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={m.hwCourse} numberOfLines={1}>{rec.course_name}</Text>
                          <Text style={m.hwAssignment} numberOfLines={1}>{rec.assignment_title}</Text>
                          <Text style={m.hwDate}>
                            {new Date(rec.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={[m.hwGrade, { color: gradeColor }]}>
                            {pts !== undefined && tot !== undefined && tot !== 100
                              ? `${pts}/${tot} pts`
                              : `${grade}%`}
                          </Text>
                          {pts !== undefined && tot !== undefined && tot !== 100 && (
                            <Text style={[m.hwGradeSub, { color: gradeColor }]}>{grade}%</Text>
                          )}
                          <Text style={m.hwExpand}>{isOpen ? '▲ Collapse' : '▼ Details'}</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Expanded detail */}
                      {isOpen && (
                        <View style={m.hwDetail}>
                          {/* Rubric breakdown */}
                          {rec.rubric_criterion_grades?.length > 0 && (
                            <View style={m.hwBlock}>
                              <Text style={m.hwBlockTitle}>RUBRIC BREAKDOWN</Text>
                              {rec.rubric_criterion_grades.map((r: any, i: number) => (
                                <View key={i} style={m.rubricRow}>
                                  <Text style={[m.rubricCell, { flex: 2 }]}>{r.criterion}</Text>
                                  <Text style={m.rubricCell}>{r.suggested_score}/{r.max_score}</Text>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* Strengths */}
                          {rec.strengths?.length > 0 && (
                            <View style={m.hwBlock}>
                              <Text style={m.hwBlockTitle}>STRENGTHS</Text>
                              {rec.strengths.map((st: string, i: number) => (
                                <Text key={i} style={[m.hwListItem, { color: Green[700] }]}>✓ {st}</Text>
                              ))}
                            </View>
                          )}

                          {/* Weaknesses */}
                          {rec.weaknesses?.length > 0 && (
                            <View style={m.hwBlock}>
                              <Text style={m.hwBlockTitle}>WEAKNESSES</Text>
                              {rec.weaknesses.map((w: string, i: number) => (
                                <Text key={i} style={[m.hwListItem, { color: Tint.sun.ink }]}>→ {w}</Text>
                              ))}
                            </View>
                          )}

                          {/* Improvement recommendations */}
                          {(rec.improvement_recommendations ?? []).length > 0 && (
                            <View style={m.hwBlock}>
                              <Text style={m.hwBlockTitle}>IMPROVEMENT RECOMMENDATIONS</Text>
                              {(rec.improvement_recommendations ?? []).map((r: string, i: number) => (
                                <Text key={i} style={[m.hwListItem, { color: '#1D4ED8' }]}>• {r}</Text>
                              ))}
                            </View>
                          )}

                          {/* Approved feedback */}
                          {!!feedback && (
                            <View style={m.hwBlock}>
                              <Text style={m.hwBlockTitle}>APPROVED FEEDBACK</Text>
                              <Text style={m.hwFeedback}>{feedback}</Text>
                            </View>
                          )}

                          {/* Professor note */}
                          {!!rec.professor_note && (
                            <View style={[m.hwBlock, { backgroundColor: Green[50], borderRadius: 8, padding: 8 }]}>
                              <Text style={m.hwBlockTitle}>PROFESSOR NOTE (PRIVATE)</Text>
                              <Text style={m.hwFeedback}>{rec.professor_note}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ── Student Profile Information (replaces old Notes field, read mode only) ── */}
          {!editing && (
            <StudentProfileInfoSection
              studentId={student.id}
              studentName={student.full_name}
            />
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Green[50] },

  header: {
    backgroundColor: Green[700],
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerName:  { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 3 },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.72)', marginBottom: 4 },
  headerBadge: {
    fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  headerBtns: { gap: 6 },
  editBtn:  {
    backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  editBtnText:  { fontSize: 13, fontWeight: '700', color: '#fff' },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  closeBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 48 },

  section: {
    backgroundColor: Ink.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Ink.line, padding: 14,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: Green[700],
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10,
  },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Ink.line,
  },
  rowFaded:      { opacity: 0.5 },
  rowLabel:      { fontSize: 12, color: Ink[3], fontWeight: '500', flex: 1 },
  rowValue:      { fontSize: 13, color: Ink.base, fontWeight: '600', flex: 2, textAlign: 'right' },
  rowValueFaint: { fontSize: 12, color: Ink[4], fontStyle: 'italic', textAlign: 'right' },

  fieldGroup: { marginBottom: 10 },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: Ink[3],
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4,
  },
  textInput: {
    borderWidth: 1, borderColor: Ink.line2, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: Ink.base, backgroundColor: Green[50], fontWeight: '500',
  },
  saveError: { fontSize: 12, color: Tint.rose.ink, marginTop: 6, lineHeight: 17 },
  saveRow:   { flexDirection: 'row', gap: 8, marginTop: 14 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: Ink.line2,
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: Ink[3] },
  saveBtn: {
    flex: 2, backgroundColor: Green[600], borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
  },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  statRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1, backgroundColor: Green[50], borderRadius: 8,
    borderWidth: 1, borderColor: Ink.line, padding: 10, alignItems: 'center',
  },
  statVal:   { fontSize: 18, fontWeight: '900', color: Ink.base, marginBottom: 2 },
  statLabel: {
    fontSize: 10, color: Ink[4], fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center',
  },

  courseRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Ink.line, gap: 10,
  },
  courseName:    { fontSize: 13, fontWeight: '700', color: Ink.base, marginBottom: 2 },
  courseSub:     { fontSize: 11, color: Ink[3] },
  courseStats:   { flexDirection: 'row', gap: 10 },
  courseStatCol: { alignItems: 'center', minWidth: 42 },
  courseStatVal: { fontSize: 14, fontWeight: '800', color: Ink.base },
  courseStatLbl: {
    fontSize: 9, color: Ink[4], textTransform: 'uppercase', letterSpacing: 0.3,
  },

  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  editNoteBtn: {
    backgroundColor: Green[50], borderRadius: 7,
    borderWidth: 1, borderColor: Green[300],
    paddingHorizontal: 10, paddingVertical: 5,
  },
  editNoteBtnText: { fontSize: 11, fontWeight: '700', color: Green[700] },

  descText:  { fontSize: 13, color: Ink.base, lineHeight: 20 },
  descEmpty: { fontSize: 13, color: Ink[4], fontStyle: 'italic' },

  emptyNote: { fontSize: 13, color: Ink[4], textAlign: 'center', paddingVertical: 8 },

  // ── Homework results ─────────────────────────────────────────────────────────
  hwCard: {
    borderWidth: 1, borderColor: Ink.line, borderRadius: 10,
    marginBottom: 8, overflow: 'hidden',
  },
  hwHeader: {
    flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 8,
    backgroundColor: Green[50],
  },
  hwCourse:     { fontSize: 10, fontWeight: '700', color: Green[700], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  hwAssignment: { fontSize: 13, fontWeight: '700', color: Ink.base },
  hwDate:       { fontSize: 11, color: Ink[4], marginTop: 2 },
  hwGrade:      { fontSize: 15, fontWeight: '900' },
  hwGradeSub:   { fontSize: 11, fontWeight: '600' },
  hwExpand:     { fontSize: 11, color: Green[600], fontWeight: '600', marginTop: 4 },

  hwDetail: { padding: 12, gap: 10, backgroundColor: Ink.surface },
  hwBlock:  { gap: 4 },
  hwBlockTitle: {
    fontSize: 9, fontWeight: '800', color: Ink[4],
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4,
  },
  hwListItem: { fontSize: 13, lineHeight: 18 },
  hwFeedback: { fontSize: 13, color: Ink.base, lineHeight: 19 },

  rubricRow:  { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Ink.line },
  rubricCell: { flex: 1, fontSize: 12, color: Ink.base },
});

export default StudentDetailModal;
