import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Profile } from '../types';
import { AtRiskStudent, getStudentsAtRiskForProfessor } from '../services/studentRiskService';
import { supabase } from '../services/supabase';
import {
  WarningEmailType,
  WarningEmailRecord,
  getSentEmailsForProfessor,
  saveWarningEmailRecord,
  sendWarningEmail,
  buildAbsenceEmailSubject,
  buildAbsenceEmailBody,
  buildSupportEmailSubject,
  buildSupportEmailBody,
} from '../services/professorWarningEmailService';

// ── Palette (matches ProfileScreen) ───────────────────────────────────────────
const C = {
  forest:   '#1A5C38',
  leaf:     '#3A8F5F',
  mist:     '#F2FAF5',
  border:   '#E0EDE6',
  card:     '#FFFFFF',
  green50:  '#F0F6EF',
  ink:      '#1A1A1A',
  inkMid:   'rgba(26,26,26,0.65)',
  inkSoft:  'rgba(26,26,26,0.4)',
  red:      '#DC2626', redBg:    '#FEF2F2', redBdr:    '#FECACA',
  amber:    '#D97706', amberBg:  '#FFFBEB', amberBdr:  '#FDE68A',
  green:    '#16A34A', greenBg:  '#F0FDF4', greenBdr:  '#BBF7D0',
  purple:   '#7C3AED', purpleBg: '#F5F3FF', purpleBdr: '#DDD6FE',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const emailKey = (studentId: string, courseId: string, type: WarningEmailType): string =>
  `${studentId}||${courseId}||${type}`;

const reasonColor = (reason: string): string => {
  const hasGrade    = reason.toLowerCase().includes('grade') || reason.toLowerCase().includes('borderline');
  const hasAbsence  = reason.toLowerCase().includes('absence') || reason.toLowerCase().includes('absences');
  if (hasGrade && hasAbsence) return C.purple;
  if (hasGrade) return C.red;
  return C.amber;
};

// ── Email modal state shape ────────────────────────────────────────────────────

interface EmailModalState {
  student:  AtRiskStudent;
  type:     WarningEmailType;
  subject:  string;
  body:     string;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  profile: Profile;
}

// ── Component ──────────────────────────────────────────────────────────────────

const StudentWarningsSection: React.FC<Props> = ({ profile }) => {
  const [students,     setStudents]     = useState<AtRiskStudent[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [emailsMap,    setEmailsMap]    = useState<Record<string, string>>({});  // studentId → email
  const [sentSet,      setSentSet]      = useState<Set<string>>(new Set());
  const [modal,        setModal]        = useState<EmailModalState | null>(null);
  const [sending,      setSending]      = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Fetch at-risk students for this professor's courses
      const atRisk = await getStudentsAtRiskForProfessor(profile.id);
      setStudents(atRisk);

      // Fetch student emails in one query
      if (atRisk.length > 0) {
        const ids = [...new Set(atRisk.map(s => s.student_id))];
        const { data: studentRows } = await supabase
          .from('students')           // Table: students (contains email field)
          .select('id, email')
          .in('id', ids);
        const map: Record<string, string> = {};
        (studentRows ?? []).forEach((s: any) => { if (s.email) map[s.id] = s.email; });
        setEmailsMap(map);
      }

      // Fetch already-sent warning emails so buttons show "Email Sent"
      const sent = await getSentEmailsForProfessor(profile.id);
      const keys = new Set(sent.map((e: WarningEmailRecord) =>
        emailKey(e.student_id, e.course_id, e.warning_type),
      ));
      setSentSet(keys);
    } catch (e: any) {
      setLoadError(e.message ?? 'Could not load student warnings.');
    } finally {
      setLoading(false);
    }
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  // ── Open email preview modal ─────────────────────────────────────────────────

  const openModal = (student: AtRiskStudent, type: WarningEmailType) => {
    const subject = type === 'absence_policy'
      ? buildAbsenceEmailSubject(student.course_name)
      : buildSupportEmailSubject(student.course_name);

    const body = type === 'absence_policy'
      ? buildAbsenceEmailBody(student.student_name, student.course_name, student.missed_classes_count, profile.full_name)
      : buildSupportEmailBody(student.student_name, student.course_name, profile.full_name);

    setModal({ student, type, subject, body });
  };

  // ── Send email ───────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!modal) return;
    const studentEmail = emailsMap[modal.student.student_id];
    if (!studentEmail) {
      Alert.alert(
        'No Email Found',
        "This student's email address was not found in the system. The email record will still be saved.",
      );
    }

    setSending(true);
    try {
      // 1. Dispatch the email (placeholder — see professorWarningEmailService.ts)
      await sendWarningEmail({
        toEmail:  studentEmail ?? '',
        subject:  modal.subject,
        body:     modal.body,
      });

      // 2. Persist record to Supabase
      await saveWarningEmailRecord({
        student_id:    modal.student.student_id,
        professor_id:  profile.id,
        course_id:     modal.student.course_id,
        warning_type:  modal.type,
        email_subject: modal.subject,
        email_body:    modal.body,
        sent_at:       new Date().toISOString(),
        status:        'sent',
      });

      // 3. Optimistic update — disable the button immediately
      setSentSet(prev => {
        const next = new Set(prev);
        next.add(emailKey(modal.student.student_id, modal.student.course_id, modal.type));
        return next;
      });

      setModal(null);
    } catch (e: any) {
      Alert.alert('Send Failed', e.message ?? 'Could not send the email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const isSent = (student: AtRiskStudent, type: WarningEmailType): boolean =>
    sentSet.has(emailKey(student.student_id, student.course_id, type));

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={ws.card}>
      {/* Section header */}
      <View style={ws.sectionHeader}>
        <Text style={ws.sectionIcon}>⚠️</Text>
        <View style={{ flex: 1 }}>
          <Text style={ws.sectionTitle}>Student Warnings</Text>
          {!loading && (
            <Text style={ws.sectionSub}>
              {students.length === 0
                ? 'All students are meeting thresholds'
                : `${students.length} student${students.length !== 1 ? 's' : ''} at risk in your courses`}
            </Text>
          )}
        </View>
        {students.length > 0 && (
          <View style={ws.countBadge}>
            <Text style={ws.countBadgeText}>{students.length}</Text>
          </View>
        )}
      </View>

      <View style={ws.divider} />

      {/* Loading */}
      {loading && (
        <View style={ws.centre}>
          <ActivityIndicator size="small" color={C.leaf} />
          <Text style={ws.centreText}>Loading student warnings…</Text>
        </View>
      )}

      {/* Error */}
      {!loading && loadError && (
        <View style={ws.errorBox}>
          <Text style={ws.errorText}>⚠ {loadError}</Text>
          <TouchableOpacity style={ws.retryBtn} onPress={load}>
            <Text style={ws.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Empty state */}
      {!loading && !loadError && students.length === 0 && (
        <View style={ws.emptyBox}>
          <Text style={ws.emptyIcon}>✅</Text>
          <Text style={ws.emptyTitle}>No student warnings at the moment.</Text>
          <Text style={ws.emptySub}>
            All students in your courses are currently meeting the defined attendance and grade thresholds.
          </Text>
        </View>
      )}

      {/* Warning cards */}
      {!loading && !loadError && students.map((student, idx) => {
        const key        = `${student.student_id}||${student.course_id}`;
        const gradeBad   = student.grade_percentage !== null
          && student.grade_percentage < student.borderline_grade_percentage;
        const absenceBad = student.missed_classes_count !== null
          && student.missed_classes_count > student.max_absences_allowed;
        const rc         = reasonColor(student.warning_reason);
        const absenceSent = isSent(student, 'absence_policy');
        const supportSent = isSent(student, 'support');

        return (
          <View
            key={key}
            style={[ws.warningCard, idx === students.length - 1 && { marginBottom: 0 }]}
          >
            {/* Card header: name + course + badge */}
            <View style={ws.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={ws.studentName}>{student.student_name}</Text>
                <Text style={ws.courseName}>{student.course_name}</Text>
              </View>
              <View style={[ws.atRiskBadge, { backgroundColor: rc + '18', borderColor: rc + '40' }]}>
                <Text style={[ws.atRiskBadgeText, { color: rc }]}>At Risk</Text>
              </View>
            </View>

            {/* Program / Semester tags */}
            <View style={ws.tagRow}>
              {student.program  && <View style={ws.tag}><Text style={ws.tagText}>{student.program}</Text></View>}
              {student.semester && <View style={ws.tag}><Text style={ws.tagText}>{student.semester}</Text></View>}
            </View>

            {/* Stats grid */}
            <View style={ws.statsGrid}>
              <View style={ws.statBox}>
                <Text style={ws.statLabel}>GRADE</Text>
                <Text style={[ws.statVal, gradeBad && { color: C.red }]}>
                  {student.grade_percentage !== null ? `${student.grade_percentage}%` : '—'}
                </Text>
              </View>
              <View style={ws.statSep} />
              <View style={ws.statBox}>
                <Text style={ws.statLabel}>MIN GRADE</Text>
                <Text style={ws.statVal}>{student.borderline_grade_percentage}%</Text>
              </View>
              <View style={ws.statSep} />
              <View style={ws.statBox}>
                <Text style={ws.statLabel}>MISSED</Text>
                <Text style={[ws.statVal, absenceBad && { color: C.red }]}>
                  {student.missed_classes_count ?? '—'}
                </Text>
              </View>
              <View style={ws.statSep} />
              <View style={ws.statBox}>
                <Text style={ws.statLabel}>MAX ABS.</Text>
                <Text style={ws.statVal}>{student.max_absences_allowed}</Text>
              </View>
            </View>

            {/* Warning reason */}
            <View style={[ws.reasonBox, { backgroundColor: rc + '12', borderColor: rc + '35' }]}>
              <Text style={[ws.reasonText, { color: rc }]}>⚠  {student.warning_reason}</Text>
            </View>

            {/* Email action buttons */}
            <View style={ws.emailBtns}>
              {/* Absence Policy Email */}
              {absenceSent ? (
                <View style={[ws.emailBtn, ws.sentBtn]}>
                  <Text style={ws.sentBtnText}>✓ Absence Email Sent</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[ws.emailBtn, ws.absenceBtn]}
                  onPress={() => openModal(student, 'absence_policy')}
                  activeOpacity={0.75}
                >
                  <Text style={ws.absenceBtnText}>📨  Send Absence Policy Email</Text>
                </TouchableOpacity>
              )}

              {/* Support Email */}
              {supportSent ? (
                <View style={[ws.emailBtn, ws.sentBtn]}>
                  <Text style={ws.sentBtnText}>✓ Support Email Sent</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[ws.emailBtn, ws.supportBtn]}
                  onPress={() => openModal(student, 'support')}
                  activeOpacity={0.75}
                >
                  <Text style={ws.supportBtnText}>💬  Send Support Email</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      {/* ── EMAIL REVIEW MODAL ── */}
      <Modal
        visible={!!modal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { if (!sending) setModal(null); }}
      >
        {modal && (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={em.root}>

              {/* Modal header */}
              <View style={em.header}>
                <TouchableOpacity
                  onPress={() => { if (!sending) setModal(null); }}
                  style={em.cancelBtn}
                  disabled={sending}
                >
                  <Text style={em.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={em.headerTitle}>
                    {modal.type === 'absence_policy' ? 'Absence Policy Email' : 'Support Email'}
                  </Text>
                  <Text style={em.headerSub} numberOfLines={1}>
                    To: {modal.student.student_name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[em.headerSendBtn, sending && { opacity: 0.6 }]}
                  onPress={handleSend}
                  disabled={sending}
                >
                  {sending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={em.headerSendBtnText}>Send</Text>}
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={em.body}>

                {/* Recipient info */}
                <View style={em.recipientBox}>
                  <Text style={em.recipientLabel}>TO</Text>
                  <Text style={em.recipientName}>{modal.student.student_name}</Text>
                  {emailsMap[modal.student.student_id] ? (
                    <Text style={em.recipientEmail}>{emailsMap[modal.student.student_id]}</Text>
                  ) : (
                    <Text style={[em.recipientEmail, { color: C.amber }]}>
                      ⚠ Email address not found in system
                    </Text>
                  )}
                </View>

                {/* Subject */}
                <View style={em.field}>
                  <Text style={em.fieldLabel}>SUBJECT</Text>
                  <TextInput
                    style={em.subjectInput}
                    value={modal.subject}
                    onChangeText={v => setModal(prev => prev ? { ...prev, subject: v } : prev)}
                    placeholder="Email subject"
                    placeholderTextColor={C.inkSoft}
                  />
                </View>

                {/* Body */}
                <View style={em.field}>
                  <Text style={em.fieldLabel}>MESSAGE</Text>
                  <TextInput
                    style={em.bodyInput}
                    value={modal.body}
                    onChangeText={v => setModal(prev => prev ? { ...prev, body: v } : prev)}
                    multiline
                    textAlignVertical="top"
                    placeholder="Email body…"
                    placeholderTextColor={C.inkSoft}
                  />
                </View>

                {/* Info note */}
                <View style={em.infoBox}>
                  <Text style={em.infoText}>
                    Review and edit the email before sending. Once sent, this email will be
                    logged in the system and the button will show "Email Sent".
                  </Text>
                </View>

              </ScrollView>

              {/* Footer send button */}
              <View style={em.footer}>
                <TouchableOpacity
                  style={[em.sendBtn, sending && { opacity: 0.6 }]}
                  onPress={handleSend}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={em.sendBtnText}>
                      📧  Send Email to {modal.student.student_name}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

            </View>
          </KeyboardAvoidingView>
        )}
      </Modal>
    </View>
  );
};

// ── Section card stylesheet ────────────────────────────────────────────────────

const ws = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  sectionIcon:   { fontSize: 20, marginTop: 1 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: C.ink },
  sectionSub:    { fontSize: 12, color: C.inkMid, marginTop: 2 },
  countBadge:    { backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  countBadgeText:{ fontSize: 11, fontWeight: '800', color: '#fff' },
  divider:       { height: 1, backgroundColor: C.border, marginBottom: 14 },

  // Centre states
  centre:        { alignItems: 'center', paddingVertical: 24, gap: 8 },
  centreText:    { fontSize: 13, color: C.inkMid },
  errorBox:      { backgroundColor: C.redBg, borderWidth: 1, borderColor: C.redBdr, borderRadius: 10, padding: 14, alignItems: 'center', gap: 10 },
  errorText:     { fontSize: 13, color: C.red, fontWeight: '600', textAlign: 'center' },
  retryBtn:      { backgroundColor: C.red, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 7 },
  retryBtnText:  { fontSize: 13, fontWeight: '700', color: '#fff' },
  emptyBox:      { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyIcon:     { fontSize: 36 },
  emptyTitle:    { fontSize: 14, fontWeight: '700', color: C.ink, textAlign: 'center' },
  emptySub:      { fontSize: 12, color: C.inkMid, textAlign: 'center', lineHeight: 18 },

  // Warning card
  warningCard:   { backgroundColor: C.mist, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12 },
  cardHeader:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
  studentName:   { fontSize: 14, fontWeight: '700', color: C.ink },
  courseName:    { fontSize: 12, color: C.inkMid, marginTop: 2 },
  atRiskBadge:   { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  atRiskBadgeText:{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Tags
  tagRow:  { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  tag:     { backgroundColor: C.green50, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.border },
  tagText: { fontSize: 11, color: C.forest, fontWeight: '500' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', backgroundColor: C.card, borderRadius: 10,
    borderWidth: 1, borderColor: C.border, marginBottom: 10, overflow: 'hidden',
  },
  statBox:   { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statSep:   { width: 1, backgroundColor: C.border },
  statLabel: { fontSize: 9, color: C.inkSoft, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  statVal:   { fontSize: 13, fontWeight: '800', color: C.ink },

  // Reason
  reasonBox:  { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  reasonText: { fontSize: 12, fontWeight: '600', lineHeight: 17 },

  // Email buttons
  emailBtns:      { gap: 8 },
  emailBtn:       { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  absenceBtn:     { backgroundColor: C.amberBg, borderColor: C.amberBdr },
  absenceBtnText: { fontSize: 13, fontWeight: '700', color: C.amber },
  supportBtn:     { backgroundColor: C.green50, borderColor: C.border },
  supportBtnText: { fontSize: 13, fontWeight: '700', color: C.forest },
  sentBtn:        { backgroundColor: C.greenBg, borderColor: C.greenBdr },
  sentBtnText:    { fontSize: 13, fontWeight: '700', color: C.green },
});

// ── Email modal stylesheet ─────────────────────────────────────────────────────

const em = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.mist },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 16, paddingVertical: 14, paddingTop: 20,
  },
  cancelBtn:         { paddingRight: 4 },
  cancelText:        { fontSize: 15, color: C.inkMid, fontWeight: '500' },
  headerTitle:       { fontSize: 15, fontWeight: '800', color: C.ink },
  headerSub:         { fontSize: 11, color: C.inkMid, marginTop: 1 },
  headerSendBtn:     { backgroundColor: C.forest, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7 },
  headerSendBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  body:          { padding: 20, gap: 18, paddingBottom: 24 },

  recipientBox:  { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, gap: 2 },
  recipientLabel:{ fontSize: 10, fontWeight: '700', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.7 },
  recipientName: { fontSize: 15, fontWeight: '700', color: C.ink, marginTop: 4 },
  recipientEmail:{ fontSize: 13, color: C.inkMid },

  field:         { gap: 6 },
  fieldLabel:    { fontSize: 10, fontWeight: '700', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.7 },
  subjectInput:  {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: C.ink,
  },
  bodyInput:     {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    fontSize: 13, color: C.ink, lineHeight: 21, minHeight: 260,
  },

  infoBox:  { backgroundColor: C.mist, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12 },
  infoText: { fontSize: 12, color: C.inkMid, lineHeight: 18 },

  footer:  { padding: 16, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
  sendBtn: { backgroundColor: C.forest, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

export default StudentWarningsSection;
