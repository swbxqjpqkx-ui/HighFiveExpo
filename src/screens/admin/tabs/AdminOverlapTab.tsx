import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { getAllInstitutionOverlaps, InstitutionOverlap, createProfessorTask, notifyProfessor } from '../../../services/adminAccreditation';
import { runOverlapCheck, updateOverlapResolution } from '../../../services/courseManagement';
import { OverlapResolutionStatus } from '../../../types/courseManagement';
import { Profile } from '../../../types';

const C = {
  forest: '#1A5C38', leaf: '#3A8F5F', mist: '#F2FAF5',
  ink: '#1A1A1A', inkMid: 'rgba(26,26,26,0.6)', inkSoft: 'rgba(26,26,26,0.38)',
  border: '#E0EDE6', card: '#FFFFFF',
  red: '#C0392B', redBg: '#FDF1F0',
  amber: '#92600A', amberBg: '#FFFBEB',
  blue: '#1D4ED8', blueBg: '#EFF6FF',
  purple: '#6D28D9', purpleBg: '#F5F3FF',
};

const SEVERITY_CFG = {
  critical: { label: 'Critical', bg: C.redBg,    color: C.red,    border: C.red    },
  high:     { label: 'High',     bg: '#FFF7F0',   color: '#C05621', border: '#C05621' },
  medium:   { label: 'Medium',   bg: C.amberBg,  color: C.amber,  border: C.amber  },
  low:      { label: 'Low',      bg: C.blueBg,   color: C.blue,   border: C.blue   },
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  open:                    { label: 'Open',             color: C.red     },
  in_discussion:           { label: 'In Discussion',    color: C.amber   },
  resolved_by_professors:  { label: 'Resolved',         color: C.forest  },
  escalated:               { label: 'Escalated',        color: C.purple  },
  resolved_by_admin:       { label: 'Resolved by Admin', color: C.forest },
};

// User-facing resolution states stored in overlap_reports.details.resolution_status.
const RESOLUTION_META: Record<OverlapResolutionStatus, { label: string; color: string; bg: string }> = {
  new:              { label: 'New',              color: C.amber,  bg: C.amberBg },
  needs_discussion: { label: 'Needs Discussion', color: C.blue,   bg: C.blueBg  },
  resolved:         { label: 'Resolved',         color: C.forest, bg: '#EAF5EE' },
  not_an_issue:     { label: 'Not an Issue',     color: C.inkMid, bg: '#F3F4F6' },
};
const RESOLUTION_CHOICES: OverlapResolutionStatus[] = ['resolved', 'not_an_issue', 'needs_discussion'];

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

interface Props { profile: Profile; }

const AdminOverlapTab: React.FC<Props> = ({ profile }) => {
  const [overlaps, setOverlaps] = useState<InstitutionOverlap[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [taskModal, setTaskModal] = useState<InstitutionOverlap | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskLoading, setTaskLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setOverlaps(await getAllInstitutionOverlaps()); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Run the overlap check across ALL programs (admin scope). Compares each program's
  // schemes of work internally and saves any new overlap cases + notifications.
  const handleRunCheck = async () => {
    setRunning(true);
    setRunMsg(null);
    try {
      const result = await runOverlapCheck();
      setRunMsg(result.message);
      await load();
      Alert.alert(result.outcome === 'created' ? 'Overlap Check Complete' : 'Overlap Check', result.message);
    } catch (e: any) {
      const msg = e?.message ?? 'Could not run the overlap check.';
      setRunMsg(msg);
      Alert.alert('Overlap Check Failed', msg);
    } finally {
      setRunning(false);
    }
  };

  const handleSetResolution = async (overlap: InstitutionOverlap, status: OverlapResolutionStatus) => {
    setOverlaps(prev => prev.map(o =>
      o.id === overlap.id ? { ...o, details: { ...(o.details ?? {}), resolution_status: status } } : o,
    ));
    try { await updateOverlapResolution(overlap.id, status); }
    catch { load(); }
  };

  const filtered = overlaps.filter(o =>
    severityFilter === 'all' || o.severity === severityFilter,
  );

  const counts = {
    critical: overlaps.filter(o => o.severity === 'critical').length,
    high:     overlaps.filter(o => o.severity === 'high').length,
    medium:   overlaps.filter(o => o.severity === 'medium').length,
    low:      overlaps.filter(o => o.severity === 'low').length,
  };

  const handleNotify = async (overlap: InstitutionOverlap) => {
    try {
      await notifyProfessor(
        overlap.course_id_a,
        '⚠️ Overlap Requires Your Attention',
        `Content overlap detected between "${overlap.course_name_a}" and "${overlap.course_name_b}" on topic: ${overlap.overlap_topic}. Please coordinate with ${overlap.professor_name_b}.`,
        'overlap_detected',
        overlap.id,
        'overlap_report',
      );
      Alert.alert('Notification sent', `${overlap.professor_name_a} has been notified.`);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleCreateTask = async () => {
    if (!taskModal || !taskTitle.trim()) {
      Alert.alert('Required', 'Please enter a task title.');
      return;
    }
    setTaskLoading(true);
    try {
      await createProfessorTask(
        taskModal.course_id_a,
        taskModal.course_id_a,
        taskTitle.trim(),
        taskDesc.trim() || `Resolve content overlap with "${taskModal.course_name_b}" on topic: ${taskModal.overlap_topic}`,
        taskModal.id,
      );
      setTaskModal(null);
      setTaskTitle('');
      setTaskDesc('');
      Alert.alert('Task created', 'The professor has been notified about the new task.');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setTaskLoading(false); }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={s.root}>
      {/* Run Overlap Check */}
      <View style={s.runBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.runTitle}>Course Overlap Check</Text>
          <Text style={s.runSub}>Compares Schemes of Work within each program across all semesters.</Text>
          {!!runMsg && !running && <Text style={s.runResult}>{runMsg}</Text>}
        </View>
        <TouchableOpacity style={[s.runBtn, running && { opacity: 0.6 }]} onPress={handleRunCheck} disabled={running}>
          {running
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.runBtnTxt}>🔁 Run Overlap Check</Text>}
        </TouchableOpacity>
      </View>

      {/* Summary row */}
      <View style={s.summaryRow}>
        {(Object.entries(counts) as [string, number][]).map(([sev, count]) => {
          const cfg = SEVERITY_CFG[sev as keyof typeof SEVERITY_CFG];
          return (
            <View key={sev} style={[s.summaryCell, { borderTopColor: cfg.color }]}>
              <Text style={[s.summaryCellNum, { color: cfg.color }]}>{count}</Text>
              <Text style={s.summaryCellLabel}>{cfg.label}</Text>
            </View>
          );
        })}
      </View>

      {/* Severity filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
        {(['all', 'critical', 'high', 'medium', 'low'] as SeverityFilter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterChip, severityFilter === f && s.filterChipActive]}
            onPress={() => setSeverityFilter(f)}
          >
            <Text style={[s.filterChipTxt, severityFilter === f && s.filterChipTxtActive]}>
              {f === 'all' ? 'All' : (SEVERITY_CFG[f as keyof typeof SEVERITY_CFG]?.label ?? f)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={C.forest} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>✅</Text>
              <Text style={s.emptyTitle}>No overlaps detected</Text>
              <Text style={s.emptyBody}>The AI has not found content overlaps at this severity level.</Text>
            </View>
          ) : filtered.map(overlap => {
            const sev = SEVERITY_CFG[overlap.severity] ?? SEVERITY_CFG.medium;
            const isExpanded = expanded === overlap.id;
            const resolution = (overlap.details?.resolution_status ?? 'new') as OverlapResolutionStatus;
            const resMeta = RESOLUTION_META[resolution];

            return (
              <View key={overlap.id} style={[s.card, { borderLeftColor: sev.color }]}>
                {/* Card header */}
                <TouchableOpacity
                  style={s.cardHeader}
                  onPress={() => setExpanded(isExpanded ? null : overlap.id)}
                  activeOpacity={0.8}
                >
                  <View style={s.cardHeaderLeft}>
                    <View style={[s.sevBadge, { backgroundColor: sev.bg }]}>
                      <Text style={[s.sevBadgeTxt, { color: sev.color }]}>{sev.label}</Text>
                    </View>
                    <View style={[s.resPill, { backgroundColor: resMeta.bg }]}>
                      <Text style={[s.resPillTxt, { color: resMeta.color }]}>{resMeta.label}</Text>
                    </View>
                  </View>
                  <Text style={s.chevron}>{isExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                <Text style={s.topicTxt}>⚡ {overlap.overlap_topic}</Text>

                {/* Course pair */}
                <View style={s.coursePair}>
                  <CourseBox
                    name={overlap.course_name_a}
                    professor={overlap.professor_name_a}
                    program={overlap.program_a}
                    docRef={overlap.document_ref_a}
                  />
                  <Text style={s.vsText}>⟷</Text>
                  <CourseBox
                    name={overlap.course_name_b}
                    professor={overlap.professor_name_b}
                    program={overlap.program_b}
                    docRef={overlap.document_ref_b}
                  />
                </View>

                {isExpanded && (
                  <>
                    <View style={s.descBox}>
                      <Text style={s.descLabel}>Why this is a problem</Text>
                      <Text style={s.descText}>{overlap.description}</Text>
                    </View>

                    {overlap.requirement_ref && (
                      <View style={s.reqRow}>
                        <Text style={s.reqIcon}>📐</Text>
                        <Text style={s.reqText}>{overlap.requirement_ref}</Text>
                      </View>
                    )}

                    {overlap.suggestions && overlap.suggestions.length > 0 && (
                      <View style={s.suggestSection}>
                        <Text style={s.suggestTitle}>Suggested Solutions</Text>
                        {overlap.suggestions.map((sug, i) => (
                          <View key={i} style={s.suggestRow}>
                            <Text style={s.suggestBullet}>{i + 1}.</Text>
                            <Text style={s.suggestText}>{sug}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* AI recommendation */}
                    {!!overlap.details?.recommendation && (
                      <View style={s.recBox}>
                        <Text style={s.recLabel}>💡 Recommendation</Text>
                        <Text style={s.recText}>{overlap.details.recommendation}</Text>
                      </View>
                    )}

                    {/* Resolution status */}
                    <Text style={s.resHdr}>Status</Text>
                    <View style={s.resRow}>
                      {RESOLUTION_CHOICES.map(choice => {
                        const active = resolution === choice;
                        const m = RESOLUTION_META[choice];
                        return (
                          <TouchableOpacity
                            key={choice}
                            style={[s.resChoice, active && { backgroundColor: m.bg, borderColor: m.color }]}
                            onPress={() => handleSetResolution(overlap, choice)}
                          >
                            <Text style={[s.resChoiceTxt, active && { color: m.color, fontWeight: '700' }]}>{m.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Actions */}
                    <View style={s.actionRow}>
                      <TouchableOpacity style={s.actionBtn} onPress={() => handleNotify(overlap)}>
                        <Text style={s.actionBtnTxt}>🔔 Notify Professor</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.actionBtn, s.actionBtnPrimary]}
                        onPress={() => {
                          setTaskModal(overlap);
                          setTaskTitle(`Resolve overlap: ${overlap.overlap_topic}`);
                          setTaskDesc('');
                        }}
                      >
                        <Text style={s.actionBtnPrimaryTxt}>📋 Create Task</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={s.dateTxt}>Detected {fmtDate(overlap.created_at)}</Text>
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Task creation modal */}
      <Modal visible={!!taskModal} transparent animationType="fade" onRequestClose={() => setTaskModal(null)}>
        <View style={tm.overlay}>
          <View style={tm.modal}>
            <Text style={tm.title}>📋 Create Task for Professor</Text>
            {taskModal && (
              <Text style={tm.courseLabel}>{taskModal.course_name_a} · {taskModal.professor_name_a}</Text>
            )}
            <TextInput
              style={tm.input}
              placeholder="Task title"
              placeholderTextColor="rgba(26,26,26,0.35)"
              value={taskTitle}
              onChangeText={setTaskTitle}
            />
            <TextInput
              style={[tm.input, tm.textArea]}
              placeholder="Task description (optional — default will be auto-generated)"
              placeholderTextColor="rgba(26,26,26,0.35)"
              value={taskDesc}
              onChangeText={setTaskDesc}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={tm.actions}>
              <TouchableOpacity style={tm.btnCancel} onPress={() => setTaskModal(null)}>
                <Text style={tm.btnCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={tm.btnCreate} onPress={handleCreateTask} disabled={taskLoading}>
                {taskLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={tm.btnCreateTxt}>Create & Notify</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const CourseBox: React.FC<{ name: string; professor: string; program?: string; docRef?: string }> = ({ name, professor, program, docRef }) => (
  <View style={s.courseBox}>
    <Text style={s.courseBoxName} numberOfLines={2}>{name}</Text>
    <Text style={s.courseBoxMeta}>👤 {professor}</Text>
    {program && <Text style={s.courseBoxMeta}>📚 {program}</Text>}
    {docRef && <Text style={s.courseBoxDoc} numberOfLines={1}>📍 {docRef}</Text>}
  </View>
);

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: C.mist },
  runBar:            { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 14, paddingVertical: 12 },
  runTitle:          { fontSize: 14, fontWeight: '700', color: C.ink },
  runSub:            { fontSize: 11, color: C.inkMid, marginTop: 2 },
  runResult:         { fontSize: 11, color: C.forest, marginTop: 4 },
  runBtn:            { backgroundColor: C.forest, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', minWidth: 120 },
  runBtnTxt:         { color: '#fff', fontWeight: '700', fontSize: 12 },
  resPill:           { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  resPillTxt:        { fontSize: 11, fontWeight: '700' },
  recBox:            { backgroundColor: '#EAF5EE', borderRadius: 8, padding: 12, gap: 3 },
  recLabel:          { fontSize: 11, fontWeight: '800', color: C.forest },
  recText:           { fontSize: 12, color: C.ink, lineHeight: 17 },
  resHdr:            { fontSize: 11, fontWeight: '800', color: C.ink },
  resRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resChoice:         { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#F9FAFB' },
  resChoiceTxt:      { fontSize: 12, color: C.inkMid, fontWeight: '600' },
  summaryRow:        { flexDirection: 'row', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  summaryCell:       { flex: 1, alignItems: 'center', paddingVertical: 12, borderTopWidth: 3 },
  summaryCellNum:    { fontSize: 22, fontWeight: '800' },
  summaryCellLabel:  { fontSize: 10, fontWeight: '700', color: C.inkMid, marginTop: 2 },
  filterBar:         { backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, maxHeight: 50 },
  filterContent:     { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  filterChip:        { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive:  { backgroundColor: C.forest, borderColor: C.forest },
  filterChipTxt:     { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterChipTxtActive:{ color: '#fff' },
  loader:            { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  list:              { padding: 14, gap: 12, paddingBottom: 40 },
  empty:             { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon:         { fontSize: 44 },
  emptyTitle:        { fontSize: 17, fontWeight: '700', color: C.ink },
  emptyBody:         { fontSize: 13, color: C.inkMid, textAlign: 'center' },
  card:              { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, borderLeftWidth: 4, padding: 14, gap: 10 },
  cardHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sevBadge:          { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sevBadgeTxt:       { fontSize: 11, fontWeight: '800' },
  statusTxt:         { fontSize: 12, fontWeight: '600' },
  chevron:           { fontSize: 11, color: C.inkSoft },
  topicTxt:          { fontSize: 14, fontWeight: '700', color: C.ink },
  coursePair:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  courseBox:         { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, gap: 3 },
  courseBoxName:     { fontSize: 12, fontWeight: '700', color: C.ink },
  courseBoxMeta:     { fontSize: 11, color: C.inkMid },
  courseBoxDoc:      { fontSize: 10, color: C.blue },
  vsText:            { fontSize: 16, color: C.inkSoft, paddingTop: 16 },
  descBox:           { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, gap: 4 },
  descLabel:         { fontSize: 11, fontWeight: '800', color: C.ink },
  descText:          { fontSize: 12, color: C.inkMid, lineHeight: 18 },
  reqRow:            { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reqIcon:           { fontSize: 14 },
  reqText:           { fontSize: 12, fontWeight: '600', color: C.forest },
  suggestSection:    { gap: 6 },
  suggestTitle:      { fontSize: 12, fontWeight: '800', color: C.ink },
  suggestRow:        { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  suggestBullet:     { fontSize: 12, fontWeight: '700', color: C.forest, width: 16 },
  suggestText:       { fontSize: 12, color: C.inkMid, flex: 1, lineHeight: 17 },
  actionRow:         { flexDirection: 'row', gap: 10 },
  actionBtn:         { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  actionBtnTxt:      { fontSize: 12, fontWeight: '700', color: C.ink },
  actionBtnPrimary:  { backgroundColor: C.forest, borderColor: C.forest },
  actionBtnPrimaryTxt:{ fontSize: 12, fontWeight: '700', color: '#fff' },
  dateTxt:           { fontSize: 11, color: C.inkSoft },
});

const tm = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal:       { backgroundColor: C.card, borderRadius: 16, padding: 22, width: '100%', maxWidth: 480, gap: 12 },
  title:       { fontSize: 16, fontWeight: '800', color: C.ink },
  courseLabel: { fontSize: 12, color: C.inkMid },
  input:       { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 13, color: C.ink },
  textArea:    { minHeight: 90 },
  actions:     { flexDirection: 'row', gap: 10 },
  btnCancel:   { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center', backgroundColor: '#F3F4F6' },
  btnCancelTxt:{ fontWeight: '600', color: C.inkMid, fontSize: 13 },
  btnCreate:   { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center', backgroundColor: C.forest },
  btnCreateTxt:{ fontWeight: '700', color: '#fff', fontSize: 13 },
});

export default AdminOverlapTab;
