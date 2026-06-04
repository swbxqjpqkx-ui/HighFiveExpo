import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, ActivityIndicator,
} from 'react-native';
import {
  AtRiskStudent,
  StudentCourseDetail,
  fetchStudentCourseDetails,
  upsertWarningStatus,
} from '../services/studentRiskService';

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  forest: '#1A5C38', leaf: '#3A8F5F', mist: '#F2FAF5',
  border: '#E0EDE6', card: '#FFFFFF', green50: '#F0F6EF',
  ink: '#1A1A1A', inkMid: 'rgba(26,26,26,0.65)', inkSoft: 'rgba(26,26,26,0.4)',
  red:    '#DC2626', redBg:    '#FEF2F2', redBdr:    '#FECACA',
  amber:  '#D97706', amberBg:  '#FFFBEB', amberBdr:  '#FDE68A',
  green:  '#16A34A', greenBg:  '#F0FDF4', greenBdr:  '#BBF7D0',
  gray:   '#6B7280', grayBg:   '#F9FAFB', grayBdr:   '#E5E7EB',
  teal:   '#0D9488', tealBg:   '#F0FDFA', tealBdr:   '#99F6E4',
  purple: '#7C3AED', purpleBg: '#F5F3FF', purpleBdr: '#DDD6FE',
};

const STATUS_META: Record<string, { bg: string; bdr: string; text: string; label: string }> = {
  new:       { bg: C.redBg,   bdr: C.redBdr,   text: C.red,   label: 'New'       },
  reviewed:  { bg: C.amberBg, bdr: C.amberBdr, text: C.amber, label: 'Reviewed'  },
  contacted: { bg: C.tealBg,  bdr: C.tealBdr,  text: C.teal,  label: 'Contacted' },
  resolved:  { bg: C.greenBg, bdr: C.greenBdr, text: C.green, label: 'Resolved'  },
  ignored:   { bg: C.grayBg,  bdr: C.grayBdr,  text: C.gray,  label: 'Ignored'   },
};

const RISK_META: Record<string, { bg: string; bdr: string; text: string }> = {
  low:    { bg: C.greenBg, bdr: C.greenBdr, text: C.green },
  medium: { bg: C.amberBg, bdr: C.amberBdr, text: C.amber },
  high:   { bg: C.redBg,   bdr: C.redBdr,   text: C.red   },
};

const reasonColor = (r: string) => {
  if (r.includes('Grade') && r.includes('absences')) return C.purple;
  if (r.includes('Grade')) return C.red;
  return C.amber;
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  visible:        boolean;
  onClose:        () => void;
  student:        AtRiskStudent | null;
  mode:           'admin' | 'professor';
  professorId?:   string;
  onStatusChange: (student: AtRiskStudent, newStatus: AtRiskStudent['status']) => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────
const InfoRow: React.FC<{ label: string; value?: string | null; valueColor?: string }> = ({
  label, value, valueColor,
}) => (
  <View style={m.row}>
    <Text style={m.rowLabel}>{label}</Text>
    <Text style={[m.rowValue, valueColor ? { color: valueColor, fontWeight: '700' } : null]}>
      {value || '—'}
    </Text>
  </View>
);

const StatBox: React.FC<{ label: string; value: string; color?: string }> = ({
  label, value, color = C.forest,
}) => (
  <View style={m.statBox}>
    <Text style={[m.statVal, { color }]}>{value}</Text>
    <Text style={m.statLabel}>{label}</Text>
  </View>
);

const Btn: React.FC<{
  label: string; bg: string; bdr: string; clr: string;
  onPress: () => void; disabled?: boolean;
}> = ({ label, bg, bdr, clr, onPress, disabled }) => (
  <TouchableOpacity
    style={[m.actionBtn, { backgroundColor: bg, borderColor: bdr, opacity: disabled ? 0.55 : 1 }]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.75}
  >
    <Text style={[m.actionBtnText, { color: clr }]}>{label}</Text>
  </TouchableOpacity>
);

// ── Main component ────────────────────────────────────────────────────────────
const StudentProfileModal: React.FC<Props> = ({
  visible, onClose, student, mode, professorId, onStatusChange,
}) => {
  const [courses,  setCourses]  = useState<StudentCourseDetail[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!visible || !student) { setCourses([]); return; }
    setLoading(true);
    fetchStudentCourseDetails(student.student_id, mode, professorId)
      .then(setCourses)
      .catch(e => console.error('[StudentProfileModal]', e))
      .finally(() => setLoading(false));
  }, [visible, student?.student_id, mode, professorId]);

  if (!student) return null;

  const sm  = STATUS_META[student.status] ?? STATUS_META.new;
  const rm  = RISK_META[student.risk_level] ?? RISK_META.medium;
  const rc  = reasonColor(student.warning_reason);
  const isClosed = student.status === 'resolved' || student.status === 'ignored';

  const gradesWithData = courses.filter(c => c.grade !== null);
  const avgGrade = gradesWithData.length
    ? Math.round(gradesWithData.reduce((s, c) => s + c.grade!, 0) / gradesWithData.length)
    : null;
  const totalMissed   = courses.reduce((s, c) => s + (c.missed_classes ?? 0), 0);
  const atRiskCount   = courses.filter(c => c.is_at_risk).length;

  const handleStatus = async (
    newStatus: 'reviewed' | 'contacted' | 'resolved' | 'ignored',
  ) => {
    setUpdating(true);
    try {
      const warningId = await upsertWarningStatus(student, newStatus);
      onStatusChange({ ...student, status: newStatus, warning_id: warningId }, newStatus);
    } catch (e) {
      console.error('[StudentProfileModal] handleStatus:', e);
    } finally {
      setUpdating(false);
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
            <Text style={m.headerName}>{student.student_name}</Text>
            <Text style={m.headerSub}>{student.program}  ·  {student.semester}</Text>
            <View style={m.headerBadges}>
              <View style={[m.badge, { backgroundColor: sm.bg, borderColor: sm.bdr }]}>
                <Text style={[m.badgeText, { color: sm.text }]}>{sm.label}</Text>
              </View>
              <View style={[m.badge, { backgroundColor: rm.bg, borderColor: rm.bdr }]}>
                <Text style={[m.badgeText, { color: rm.text }]}>
                  {student.risk_level.toUpperCase()} RISK
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={m.closeBtn} onPress={onClose}>
            <Text style={m.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={m.scroll} contentContainerStyle={m.scrollContent}>

          {/* ── Identity ── */}
          <View style={m.section}>
            <Text style={m.sectionTitle}>👤  Student</Text>
            <InfoRow label="Full Name" value={student.student_name} />
            {!!student.student_email && (
              <InfoRow label="Email" value={student.student_email} />
            )}
            <InfoRow label="Program"  value={student.program} />
            <InfoRow label="Semester" value={student.semester} />
          </View>

          {/* ── Admin: all courses overview ── */}
          {mode === 'admin' && (
            <View style={m.section}>
              <Text style={m.sectionTitle}>📊  Academic Overview (All Courses)</Text>

              {loading ? (
                <ActivityIndicator color={C.leaf} style={{ marginVertical: 16 }} />
              ) : courses.length === 0 ? (
                <Text style={m.emptyNote}>No enrollment records found.</Text>
              ) : (
                <>
                  {/* Summary stats */}
                  <View style={m.overviewRow}>
                    <StatBox
                      label="Avg Grade"
                      value={avgGrade !== null ? `${avgGrade}%` : '—'}
                      color={avgGrade !== null && avgGrade < 70 ? C.red : C.forest}
                    />
                    <StatBox
                      label="Total Missed"
                      value={String(totalMissed)}
                      color={totalMissed > 5 ? C.amber : C.forest}
                    />
                    <StatBox label="Courses" value={String(courses.length)} />
                    <StatBox
                      label="At Risk In"
                      value={String(atRiskCount)}
                      color={atRiskCount > 0 ? C.red : C.green}
                    />
                  </View>

                  {/* Per-course rows */}
                  <Text style={m.tableHeader}>ALL ENROLLED COURSES</Text>
                  {courses.map((c, i) => {
                    const gradeBad   = c.grade !== null && c.borderline_grade !== null
                      && c.grade < c.borderline_grade;
                    const absenceBad = c.missed_classes !== null && c.max_absences !== null
                      && c.missed_classes > c.max_absences;
                    return (
                      <View
                        key={c.course_id}
                        style={[
                          m.courseRow,
                          i === courses.length - 1 && { borderBottomWidth: 0 },
                          c.is_at_risk && m.courseRowRisk,
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={m.courseRowName}>{c.course_name}</Text>
                          <Text style={m.courseRowProf}>👨‍🏫  {c.professor_name}</Text>
                        </View>
                        <View style={m.courseStatCol}>
                          <Text style={[m.courseStatVal, gradeBad && { color: C.red }]}>
                            {c.grade !== null ? `${c.grade}%` : '—'}
                          </Text>
                          <Text style={m.courseStatLbl}>grade</Text>
                        </View>
                        <View style={m.courseStatCol}>
                          <Text style={[m.courseStatVal, absenceBad && { color: C.amber }]}>
                            {c.missed_classes ?? '—'}
                          </Text>
                          <Text style={m.courseStatLbl}>missed</Text>
                        </View>
                        {c.is_at_risk && <View style={m.atRiskDot} />}
                      </View>
                    );
                  })}
                </>
              )}
            </View>
          )}

          {/* ── Professor: this course only ── */}
          {mode === 'professor' && (
            <View style={m.section}>
              <Text style={m.sectionTitle}>📚  Course Performance</Text>
              <InfoRow label="Course"    value={student.course_name} />
              <InfoRow label="Professor" value={student.professor_name} />
              <InfoRow
                label="Current Grade"
                value={student.grade_percentage !== null ? `${student.grade_percentage}%` : '—'}
                valueColor={
                  student.grade_percentage !== null &&
                  student.grade_percentage < student.borderline_grade_percentage
                    ? C.red : undefined
                }
              />
              <InfoRow label="Minimum Grade" value={`${student.borderline_grade_percentage}%`} />
              <InfoRow
                label="Classes Missed"
                value={student.missed_classes_count !== null
                  ? String(student.missed_classes_count) : '—'}
                valueColor={
                  student.missed_classes_count !== null &&
                  student.missed_classes_count > student.max_absences_allowed
                    ? C.red : undefined
                }
              />
              <InfoRow label="Max Absences Allowed" value={String(student.max_absences_allowed)} />
            </View>
          )}

          {/* ── Warning details ── */}
          <View style={m.section}>
            <Text style={m.sectionTitle}>⚠️  Warning Details</Text>
            <View style={[m.reasonBox, { backgroundColor: rc + '18', borderColor: rc + '40' }]}>
              <Text style={[m.reasonText, { color: rc }]}>{student.warning_reason}</Text>
            </View>
            <InfoRow label="Case Status" value={sm.label} />
            <InfoRow
              label="Detected"
              value={new Date(student.detected_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            />
            {student.contacted_at && (
              <InfoRow
                label="Contacted"
                value={new Date(student.contacted_at).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              />
            )}
          </View>

          {/* ── Responsible professor (admin only, context course) ── */}
          {mode === 'admin' && (
            <View style={m.section}>
              <Text style={m.sectionTitle}>👨‍🏫  Responsible Professor (This Case)</Text>
              <InfoRow label="Name"   value={student.professor_name} />
              <InfoRow label="Email"  value={student.professor_email} />
              <InfoRow label="Course" value={student.course_name} />
            </View>
          )}

          {/* ── Status actions ── */}
          {!isClosed ? (
            <View style={m.section}>
              <Text style={m.sectionTitle}>🔄  Update Case Status</Text>
              <View style={m.actionRow}>
                {student.status === 'new' && (
                  <Btn label="Mark Reviewed"
                    bg={C.amberBg} bdr={C.amberBdr} clr={C.amber}
                    onPress={() => handleStatus('reviewed')} disabled={updating}
                  />
                )}
                {mode === 'admin' && student.status !== 'contacted' && (
                  <Btn label="Mark Contacted"
                    bg={C.tealBg} bdr={C.tealBdr} clr={C.teal}
                    onPress={() => handleStatus('contacted')} disabled={updating}
                  />
                )}
                <Btn label="Resolve Case"
                  bg={C.greenBg} bdr={C.greenBdr} clr={C.green}
                  onPress={() => handleStatus('resolved')} disabled={updating}
                />
                <Btn label="Ignore"
                  bg={C.grayBg} bdr={C.grayBdr} clr={C.gray}
                  onPress={() => handleStatus('ignored')} disabled={updating}
                />
              </View>
              {updating && (
                <ActivityIndicator color={C.leaf} style={{ marginTop: 12 }} />
              )}
            </View>
          ) : (
            <View style={[m.section, { backgroundColor: C.greenBg, borderColor: C.greenBdr }]}>
              <Text style={[m.sectionTitle, { color: C.green }]}>
                ✓  Case {student.status === 'resolved' ? 'Resolved' : 'Ignored'}
              </Text>
              <Text style={m.resolvedNote}>
                This case has been marked as {student.status}. No further action is required.
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.mist },
  header: {
    backgroundColor: C.forest, paddingTop: 52, paddingBottom: 20,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  headerName:   { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 3 },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  headerBadges: { flexDirection: 'row', gap: 6 },
  badge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  closeBtn:     { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  closeBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 48 },

  section: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, padding: 14,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: C.forest,
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10,
  },

  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  rowLabel: { fontSize: 12, color: C.inkMid, fontWeight: '500', flex: 1 },
  rowValue: { fontSize: 13, color: C.ink, fontWeight: '600', flex: 2, textAlign: 'right' },

  overviewRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statBox:  { flex: 1, backgroundColor: C.mist, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 10, alignItems: 'center' },
  statVal:  { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  statLabel:{ fontSize: 10, color: C.inkSoft, fontWeight: '600', textAlign: 'center', lineHeight: 13 },

  tableHeader:    { fontSize: 10, fontWeight: '800', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  courseRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
  courseRowRisk:  { backgroundColor: '#FEF2F2' },
  courseRowName:  { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 2 },
  courseRowProf:  { fontSize: 11, color: C.inkMid },
  courseStatCol:  { alignItems: 'center', minWidth: 44 },
  courseStatVal:  { fontSize: 14, fontWeight: '800', color: C.ink },
  courseStatLbl:  { fontSize: 9, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.3 },
  atRiskDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red },

  emptyNote: { fontSize: 13, color: C.inkSoft, textAlign: 'center', paddingVertical: 12 },

  reasonBox:   { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
  reasonText:  { fontSize: 13, fontWeight: '600', lineHeight: 18 },

  actionRow:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn:    { borderWidth: 1.5, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 13 },
  actionBtnText:{ fontSize: 13, fontWeight: '700' },

  resolvedNote: { fontSize: 13, color: C.green, lineHeight: 19 },
});

export default StudentProfileModal;
