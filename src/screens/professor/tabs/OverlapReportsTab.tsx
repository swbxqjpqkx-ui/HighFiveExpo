import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Course, Profile } from '../../../types';
import { OverlapReport, ProfessorMessage, OverlapResolutionStatus } from '../../../types/courseManagement';
import {
  getOverlapReports, updateOverlapStatus, escalateOverlapToAdmin,
  sendProfessorMessage, getMessagesForOverlap,
  runOverlapCheck, updateOverlapResolution,
} from '../../../services/courseManagement';

const C = {
  forest: '#1A5C38', leaf: '#3A8F5F', mist: '#F2FAF5',
  ink: '#1A1A1A', inkMid: 'rgba(26,26,26,0.65)', inkSoft: 'rgba(26,26,26,0.4)',
  border: '#E0EDE6', card: '#FFFFFF', green50: '#F0F6EF',
  red: '#D9534F', redBg: '#FDF1F1', redBdr: '#F5C6C6',
  amber: '#92600A', amberBg: '#FFFBEB', amberBdr: '#FDE68A',
  blue: '#1D4ED8', blueBg: '#EFF6FF', blueBdr: '#BFDBFE',
};

const SEVERITY_META = {
  high:   { color: C.red,    bg: C.redBg,    label: '🔴 HIGH',   border: C.redBdr   },
  medium: { color: C.amber,  bg: C.amberBg,  label: '🟡 MEDIUM', border: C.amberBdr },
  low:    { color: C.blue,   bg: C.blueBg,   label: '🔵 LOW',    border: C.blueBdr  },
};

const STATUS_LABELS: Record<OverlapReport['status'], string> = {
  open:                   'Open',
  in_discussion:          'In Discussion',
  resolved_by_professors: 'Resolved by Professors',
  escalated:              'Escalated to Admin',
  resolved_by_admin:      'Resolved by Admin',
};

// User-facing resolution states (stored in overlap_reports.details.resolution_status).
const RESOLUTION_META: Record<OverlapResolutionStatus, { label: string; color: string; bg: string }> = {
  new:              { label: 'New',            color: C.amber,  bg: C.amberBg },
  needs_discussion: { label: 'Needs Discussion', color: C.blue, bg: C.blueBg  },
  resolved:         { label: 'Resolved',       color: C.forest, bg: C.green50 },
  not_an_issue:     { label: 'Not an Issue',   color: C.inkMid, bg: C.green50 },
};
const RESOLUTION_CHOICES: OverlapResolutionStatus[] = ['resolved', 'not_an_issue', 'needs_discussion'];

interface Props {
  course: Course;
  profile: Profile;
}

interface ExpandedState {
  [id: string]: {
    messagesOpen: boolean;
    messages: ProfessorMessage[];
    messageText: string;
    loadingMessages: boolean;
    sendingMessage: boolean;
  };
}

const OverlapReportsTab: React.FC<Props> = ({ course, profile }) => {
  const [reports, setReports]   = useState<OverlapReport[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [running, setRunning]   = useState(false);
  const [runMsg, setRunMsg]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Only this professor's course overlaps (getOverlapReports filters by course).
      setReports(await getOverlapReports(course.id));
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [course.id]);

  useEffect(() => { load(); }, [load]);

  // ── Run Overlap Check (manual) ──────────────────────────────────────────────
  const handleRunCheck = async () => {
    setRunning(true);
    setRunMsg(null);
    try {
      const result = await runOverlapCheck({ program: course.program });
      setRunMsg(result.message);
      await load();
      Alert.alert(
        result.outcome === 'created' ? 'Overlap Check Complete' : 'Overlap Check',
        result.message,
      );
    } catch (e: any) {
      const msg = e?.message ?? 'Could not run the overlap check. Please try again.';
      setRunMsg(msg);
      Alert.alert('Overlap Check Failed', msg);
    } finally {
      setRunning(false);
    }
  };

  // ── Resolution status (Resolved / Not an issue / Needs discussion) ───────────
  const handleSetResolution = async (overlap: OverlapReport, status: OverlapResolutionStatus) => {
    setReports(prev => prev.map(r =>
      r.id === overlap.id ? { ...r, details: { ...(r.details ?? {}), resolution_status: status } } : r,
    ));
    try {
      await updateOverlapResolution(overlap.id, status);
    } catch {
      load(); // revert to server truth on failure
    }
  };

  const toggleExpanded = async (id: string) => {
    if (expanded[id]) {
      setExpanded(prev => { const next = { ...prev }; delete next[id]; return next; });
      return;
    }
    setExpanded(prev => ({
      ...prev,
      [id]: { messagesOpen: false, messages: [], messageText: '', loadingMessages: false, sendingMessage: false },
    }));
  };

  const openMessages = async (overlapId: string) => {
    setExpanded(prev => ({
      ...prev,
      [overlapId]: { ...prev[overlapId], messagesOpen: true, loadingMessages: true },
    }));
    try {
      const msgs = await getMessagesForOverlap(overlapId);
      setExpanded(prev => ({
        ...prev,
        [overlapId]: { ...prev[overlapId], messages: msgs, loadingMessages: false },
      }));
    } catch {
      setExpanded(prev => ({
        ...prev,
        [overlapId]: { ...prev[overlapId], loadingMessages: false },
      }));
    }
  };

  const sendMessage = async (overlap: OverlapReport) => {
    const state = expanded[overlap.id];
    if (!state?.messageText.trim()) return;

    const otherProfId   = overlap.professor_id_a === profile.id ? overlap.professor_id_b : overlap.professor_id_a;
    const otherProfName = overlap.professor_id_a === profile.id ? overlap.professor_name_b : overlap.professor_name_a;

    setExpanded(prev => ({ ...prev, [overlap.id]: { ...prev[overlap.id], sendingMessage: true } }));
    try {
      await sendProfessorMessage(overlap.id, profile.id, profile.full_name, otherProfId, state.messageText.trim());
      await updateOverlapStatus(overlap.id, 'in_discussion');
      setExpanded(prev => ({
        ...prev,
        [overlap.id]: { ...prev[overlap.id], messageText: '', sendingMessage: false },
      }));
      await openMessages(overlap.id);
      setReports(prev => prev.map(r => r.id === overlap.id ? { ...r, status: 'in_discussion' } : r));
      Alert.alert('Message Sent', `Your message has been sent to ${otherProfName}.`);
    } catch {
      setExpanded(prev => ({ ...prev, [overlap.id]: { ...prev[overlap.id], sendingMessage: false } }));
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  const handleEscalate = (overlap: OverlapReport) => {
    Alert.alert(
      'Escalate to Administrator',
      `This overlap between "${overlap.course_name_a}" and "${overlap.course_name_b}" will be sent to the administrator for review and decision. You will not be able to resolve it independently after escalation.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Escalate',
          style: 'destructive',
          onPress: async () => {
            await escalateOverlapToAdmin(overlap.id).catch(() => {});
            setReports(prev => prev.map(r => r.id === overlap.id ? { ...r, status: 'escalated' } : r));
          },
        },
      ],
    );
  };

  const handleMarkResolved = (overlap: OverlapReport) => {
    Alert.alert(
      'Mark as Resolved',
      'Confirm that both you and the other professor have agreed on a resolution. This will remove the overlap from the administrator\'s active conflict list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Resolved',
          onPress: async () => {
            await updateOverlapStatus(overlap.id, 'resolved_by_professors').catch(() => {});
            setReports(prev => prev.map(r => r.id === overlap.id ? { ...r, status: 'resolved_by_professors' } : r));
          },
        },
      ],
    );
  };

  if (loading) {
    return <View style={s.centre}><ActivityIndicator color={C.leaf} size="large" /></View>;
  }

  const open   = reports.filter(r => r.status === 'open' || r.status === 'in_discussion');
  const closed = reports.filter(r => r.status !== 'open' && r.status !== 'in_discussion');

  return (
    <ScrollView contentContainerStyle={s.content}>
      {/* ── Run Overlap Check ── */}
      <View style={s.runBox}>
        <Text style={s.runTitle}>Course Overlap Check</Text>
        <Text style={s.runSub}>
          Compares the Schemes of Work of all {course.program ?? 'program'} courses (across all
          semesters) and reports overlapping topics.
        </Text>
        <TouchableOpacity
          style={[s.runBtn, running && { opacity: 0.6 }]}
          onPress={handleRunCheck}
          disabled={running}
        >
          {running
            ? <><ActivityIndicator color="#fff" size="small" /><Text style={s.runBtnText}>  Running overlap check…</Text></>
            : <Text style={s.runBtnText}>🔁 Run Overlap Check</Text>
          }
        </TouchableOpacity>
        {!!runMsg && !running && <Text style={s.runResult}>{runMsg}</Text>}
      </View>

      {reports.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>✅</Text>
          <Text style={s.emptyTitle}>No Overlaps Detected</Text>
          <Text style={s.emptyText}>
            No course overlaps found for your courses yet. Tap “Run Overlap Check” above to
            compare your Scheme of Work against the other courses in your program.
          </Text>
        </View>
      )}

      {open.length > 0 && (
        <>
          <Text style={s.groupLabel}>⚠️  Requires Action ({open.length})</Text>
          {open.map(report => <OverlapCard key={report.id} report={report} profile={profile} expandedState={expanded[report.id]} onToggle={() => toggleExpanded(report.id)} onOpenMessages={() => openMessages(report.id)} onSend={() => sendMessage(report)} onEscalate={() => handleEscalate(report)} onResolve={() => handleMarkResolved(report)} onMessageChange={text => setExpanded(prev => ({ ...prev, [report.id]: { ...prev[report.id], messageText: text } }))} onSetResolution={status => handleSetResolution(report, status)} />)}
        </>
      )}

      {closed.length > 0 && (
        <>
          <Text style={[s.groupLabel, { marginTop: 16 }]}>📋 History ({closed.length})</Text>
          {closed.map(report => <OverlapCard key={report.id} report={report} profile={profile} expandedState={expanded[report.id]} onToggle={() => toggleExpanded(report.id)} onOpenMessages={() => openMessages(report.id)} onSend={() => sendMessage(report)} onEscalate={() => handleEscalate(report)} onResolve={() => handleMarkResolved(report)} onMessageChange={text => setExpanded(prev => ({ ...prev, [report.id]: { ...prev[report.id], messageText: text } }))} onSetResolution={status => handleSetResolution(report, status)} />)}
        </>
      )}
    </ScrollView>
  );
};

interface CardProps {
  report: OverlapReport;
  profile: Profile;
  expandedState: ExpandedState[string] | undefined;
  onToggle: () => void;
  onOpenMessages: () => void;
  onSend: () => void;
  onEscalate: () => void;
  onResolve: () => void;
  onMessageChange: (t: string) => void;
  onSetResolution: (status: OverlapResolutionStatus) => void;
}

const OverlapCard: React.FC<CardProps> = ({
  report, profile, expandedState, onToggle, onOpenMessages, onSend, onEscalate, onResolve, onMessageChange, onSetResolution,
}) => {
  const sev     = SEVERITY_META[report.severity];
  const isOpen  = report.status === 'open' || report.status === 'in_discussion';
  const expanded = !!expandedState;
  const otherName = report.professor_id_a === profile.id ? report.professor_name_b : report.professor_name_a;
  const otherCourse = report.professor_id_a === profile.id ? report.course_name_b : report.course_name_a;
  const resolution = (report.details?.resolution_status ?? 'new') as OverlapResolutionStatus;
  const resMeta = RESOLUTION_META[resolution];

  return (
    <View style={[s.card, { borderLeftColor: sev.color }]}>
      {/* Header */}
      <TouchableOpacity style={s.cardHeader} onPress={onToggle} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          <View style={s.severityRow}>
            <Text style={[s.severityLabel, { color: sev.color }]}>{sev.label}</Text>
            <View style={[s.statusPill, { backgroundColor: resMeta.bg }]}>
              <Text style={[s.statusPillText, { color: resMeta.color }]}>{resMeta.label}</Text>
            </View>
          </View>
          <Text style={s.topicTitle}>{report.overlap_topic}</Text>
          <Text style={s.partiesText}>
            Your course ↔ {otherCourse} ({otherName})
          </Text>
        </View>
        <Text style={s.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={s.expandedBody}>
          {/* Topics + weeks */}
          {(report.details?.topic_a || report.details?.topic_b) && (
            <View style={s.topicBox}>
              <Text style={s.topicLine}>
                • {report.course_name_a}: {report.details?.topic_a}
                {report.details?.week_a != null ? ` — Week ${report.details.week_a}` : ''}
              </Text>
              <Text style={s.topicLine}>
                • {report.course_name_b}: {report.details?.topic_b}
                {report.details?.week_b != null ? ` — Week ${report.details.week_b}` : ''}
              </Text>
            </View>
          )}

          {/* Description */}
          <Text style={s.bodyLabel}>What was detected</Text>
          <Text style={s.bodyText}>{report.description}</Text>

          {/* AI recommendation */}
          {!!report.details?.recommendation && (
            <View style={s.recBox}>
              <Text style={s.recLabel}>💡 Recommendation</Text>
              <Text style={s.recText}>{report.details.recommendation}</Text>
            </View>
          )}

          {/* Resolution status */}
          <Text style={s.bodyLabel}>Status</Text>
          <View style={s.resRow}>
            {RESOLUTION_CHOICES.map(choice => {
              const active = resolution === choice;
              const m = RESOLUTION_META[choice];
              return (
                <TouchableOpacity
                  key={choice}
                  style={[s.resBtn, active && { backgroundColor: m.bg, borderColor: m.color }]}
                  onPress={() => onSetResolution(choice)}
                >
                  <Text style={[s.resBtnText, active && { color: m.color, fontWeight: '700' }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* References */}
          {(report.document_ref_a || report.document_ref_b) && (
            <View style={s.refBox}>
              {report.document_ref_a && <Text style={s.refText}>📌 Your doc: {report.document_ref_a}</Text>}
              {report.document_ref_b && <Text style={s.refText}>📌 Their doc: {report.document_ref_b}</Text>}
              {report.requirement_ref && <Text style={s.refText}>📋 Requirement: {report.requirement_ref}</Text>}
            </View>
          )}

          {/* Programs */}
          <View style={s.programRow}>
            {report.program_a && <Text style={s.programPill}>{report.program_a}</Text>}
            {report.program_b && report.program_b !== report.program_a && (
              <Text style={s.programPill}>{report.program_b}</Text>
            )}
          </View>

          {/* Actions */}
          {isOpen && (
            <View style={s.actionsSection}>
              <Text style={s.bodyLabel}>Actions</Text>
              <View style={s.actionBtns}>
                <TouchableOpacity style={s.msgBtn} onPress={onOpenMessages}>
                  <Text style={s.msgBtnText}>💬 Message {otherName.split(' ')[1] ?? otherName}</Text>
                </TouchableOpacity>
                {report.status === 'in_discussion' && (
                  <TouchableOpacity style={s.resolveBtn} onPress={onResolve}>
                    <Text style={s.resolveBtnText}>✅ Mark Resolved</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.escalateBtn} onPress={onEscalate}>
                  <Text style={s.escalateBtnText}>↑ Escalate to Admin</Text>
                </TouchableOpacity>
              </View>

              <View style={[s.infoBox]}>
                <Text style={s.infoText}>
                  ℹ️  You cannot dismiss or delete AI-detected overlaps. Resolve them by coordinating with the other professor or escalating to the administrator.
                </Text>
              </View>
            </View>
          )}

          {/* Messages thread */}
          {expandedState?.messagesOpen && (
            <View style={s.messageSection}>
              <Text style={s.bodyLabel}>Message Thread</Text>
              {expandedState.loadingMessages ? (
                <ActivityIndicator color={C.leaf} size="small" />
              ) : (
                <>
                  {expandedState.messages.length === 0 && (
                    <Text style={s.emptyMsgText}>No messages yet. Start the conversation.</Text>
                  )}
                  {expandedState.messages.map(msg => (
                    <View key={msg.id} style={[
                      s.messageBubble,
                      msg.from_professor_id === profile.id ? s.bubbleMine : s.bubbleTheirs,
                    ]}>
                      <Text style={s.bubbleName}>{msg.from_professor_name}</Text>
                      <Text style={s.bubbleText}>{msg.message}</Text>
                      <Text style={s.bubbleTime}>{new Date(msg.created_at).toLocaleString()}</Text>
                    </View>
                  ))}
                  {isOpen && (
                    <View style={s.composeRow}>
                      <TextInput
                        style={s.composeInput}
                        value={expandedState.messageText}
                        onChangeText={onMessageChange}
                        placeholder={`Message ${otherName}…`}
                        placeholderTextColor={C.inkSoft}
                        multiline
                      />
                      <TouchableOpacity
                        style={[s.sendBtn, !expandedState.messageText.trim() && { opacity: 0.4 }]}
                        onPress={onSend}
                        disabled={!expandedState.messageText.trim() || expandedState.sendingMessage}
                      >
                        {expandedState.sendingMessage
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={s.sendBtnText}>Send</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  centre:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty:   { alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 10 },
  emptyTitle:{ fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 6 },
  emptyText: { fontSize: 13, color: C.inkMid, textAlign: 'center', lineHeight: 19 },

  groupLabel: { fontSize: 12, fontWeight: '700', color: C.inkMid, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  runBox:   { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, marginBottom: 16 },
  runTitle: { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 4 },
  runSub:   { fontSize: 12, color: C.inkMid, lineHeight: 17, marginBottom: 10 },
  runBtn:   { backgroundColor: C.forest, borderRadius: 8, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  runBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  runResult:{ fontSize: 12, color: C.inkMid, marginTop: 8, textAlign: 'center' },

  topicBox: { backgroundColor: C.mist, borderRadius: 6, padding: 10, marginTop: 10, gap: 3 },
  topicLine:{ fontSize: 12, color: C.ink, lineHeight: 17 },

  recBox:   { backgroundColor: C.green50, borderRadius: 6, padding: 10, marginTop: 10 },
  recLabel: { fontSize: 11, fontWeight: '700', color: C.forest, marginBottom: 3 },
  recText:  { fontSize: 12, color: C.ink, lineHeight: 17 },

  resRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  resBtn:   { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: C.card },
  resBtnText: { fontSize: 12, color: C.inkMid, fontWeight: '600' },

  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderLeftWidth: 4, borderRadius: 10, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 8 },
  severityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  severityLabel:{ fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  statusPill:  { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  statusPillText:{ fontSize: 10, fontWeight: '700' },
  topicTitle:  { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  partiesText: { fontSize: 12, color: C.inkMid },
  chevron:     { fontSize: 12, color: C.inkSoft },

  expandedBody: { paddingHorizontal: 14, paddingBottom: 14 },
  bodyLabel:   { fontSize: 11, fontWeight: '700', color: C.inkMid, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4, marginTop: 10 },
  bodyText:    { fontSize: 13, color: C.ink, lineHeight: 19 },

  refBox:      { backgroundColor: C.mist, borderRadius: 6, padding: 10, marginTop: 8, gap: 3 },
  refText:     { fontSize: 12, color: C.inkMid },

  programRow:  { flexDirection: 'row', gap: 6, marginTop: 8 },
  programPill: { backgroundColor: C.green50, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, fontSize: 11, color: C.forest, fontWeight: '600' },

  actionsSection: { marginTop: 4 },
  actionBtns:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  msgBtn:      { backgroundColor: C.forest, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  msgBtnText:  { color: '#fff', fontWeight: '700', fontSize: 12 },
  resolveBtn:  { backgroundColor: C.green50, borderWidth: 1.5, borderColor: C.forest, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  resolveBtnText: { color: C.forest, fontWeight: '700', fontSize: 12 },
  escalateBtn: { borderWidth: 1.5, borderColor: C.redBdr, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.redBg },
  escalateBtnText: { color: C.red, fontWeight: '700', fontSize: 12 },

  infoBox:     { backgroundColor: C.mist, borderRadius: 6, padding: 10, marginTop: 4 },
  infoText:    { fontSize: 11, color: C.inkMid, lineHeight: 16 },

  messageSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  emptyMsgText:   { fontSize: 12, color: C.inkSoft, fontStyle: 'italic', marginBottom: 8 },
  messageBubble:  { borderRadius: 10, padding: 10, marginBottom: 6, maxWidth: '85%' },
  bubbleMine:     { backgroundColor: C.green50, alignSelf: 'flex-end' },
  bubbleTheirs:   { backgroundColor: '#F3F4F6', alignSelf: 'flex-start' },
  bubbleName:     { fontSize: 10, fontWeight: '700', color: C.inkMid, marginBottom: 2 },
  bubbleText:     { fontSize: 13, color: C.ink, lineHeight: 18 },
  bubbleTime:     { fontSize: 10, color: C.inkSoft, marginTop: 3 },
  composeRow:     { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-end' },
  composeInput:   {
    flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 8,
    padding: 10, fontSize: 13, color: C.ink, maxHeight: 80,
  },
  sendBtn:     { backgroundColor: C.forest, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

export default OverlapReportsTab;
