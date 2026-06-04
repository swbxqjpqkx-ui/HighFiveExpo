import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import {
  PendingSubmission, SubmissionType,
  getAllPendingSubmissions,
  approveSubmission, declineSubmission, requestChanges,
  lockSyllabusByAdminCourse, lockSchemeOfWorkByAdminCourse,
} from '../../../services/adminAccreditation';
import { Profile } from '../../../types';

const C = {
  forest: '#1A5C38', leaf: '#3A8F5F', mist: '#F2FAF5',
  ink: '#1A1A1A', inkMid: 'rgba(26,26,26,0.6)', inkSoft: 'rgba(26,26,26,0.38)',
  border: '#E0EDE6', card: '#FFFFFF',
  green: '#1A5C38', greenBg: '#EFF6EF',
  red: '#C0392B', redBg: '#FDF1F0',
  amber: '#92600A', amberBg: '#FFFBEB',
  blue: '#1D4ED8', blueBg: '#EFF6FF',
  purple: '#6D28D9', purpleBg: '#F5F3FF',
};

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  pending:           { label: 'Pending Review', bg: C.amberBg, color: C.amber },
  approved:          { label: 'Approved',        bg: C.greenBg, color: C.green },
  declined:          { label: 'Declined',         bg: C.redBg,   color: C.red   },
  changes_requested: { label: 'Changes Requested', bg: C.purpleBg, color: C.purple },
};

const AI_CFG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  not_run: { label: 'Not analysed', bg: '#F3F4F6', color: '#6B7280', icon: '—' },
  running: { label: 'Analysing…',   bg: C.amberBg, color: C.amber,   icon: '⏳' },
  pass:    { label: 'AI: Pass',      bg: C.greenBg, color: C.green,   icon: '✓' },
  issues:  { label: 'AI: Issues',    bg: C.amberBg, color: C.amber,   icon: '⚠' },
  fail:    { label: 'AI: Fail',      bg: C.redBg,   color: C.red,     icon: '✕' },
};

const FILE_ICON: Record<string, string> = {
  pdf: '📄', word: '📝', ppt: '📊', excel: '📈',
  image: '🖼', link: '🔗', other: '📎', syllabus: '📋', scheme_of_work: '📅',
};

const SEVERITY_CFG: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#C0392B', bg: '#FDF1F0', label: 'Critical' },
  warning:  { color: C.amber,   bg: C.amberBg, label: 'Warning' },
  info:     { color: C.blue,    bg: C.blueBg,  label: 'Info' },
};

const AACSB_STANDARDS: Record<string, { title: string; category: string }> = {
  'AACSB-1.1': { category: 'Mission', title: 'Mission & Collective Commitment' },
  'AACSB-2.1': { category: 'Learning', title: 'Student Learning & Pedagogical Innovation' },
  'AACSB-2.3': { category: 'Curriculum', title: 'Curriculum Content & Assurance of Learning' },
  'AACSB-3.1': { category: 'AoL', title: 'Assurance of Learning — Program Outcomes' },
  'AACSB-4.2': { category: 'Faculty', title: 'Intellectual Contributions & Engagement' },
  'AACSB-5.1': { category: 'Currency', title: 'Curriculum Currency & Continuous Improvement' },
};

type FilterType = 'all' | 'syllabus' | 'scheme_of_work' | 'material';

interface Props { profile: Profile; }

const PendingApprovalsTab: React.FC<Props> = ({ profile }) => {
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selected, setSelected] = useState<PendingSubmission | null>(null);
  const [actionModal, setActionModal] = useState<'decline' | 'changes' | null>(null);
  const [actionText, setActionText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSubmissions(await getAllPendingSubmissions());
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const handleApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await approveSubmission(selected, profile.id);
      // Keep modal open — update status in place so Lock button appears immediately
      setSelected(prev => prev ? { ...prev, status: 'approved' } : null);
      await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setActionLoading(false); }
  };

  const handleActionSubmit = async () => {
    if (!selected || !actionText.trim()) {
      Alert.alert('Required', 'Please write a message before submitting.');
      return;
    }
    setActionLoading(true);
    try {
      if (actionModal === 'decline') {
        await declineSubmission(selected, actionText.trim());
      } else {
        await requestChanges(selected, actionText.trim());
      }
      setActionModal(null);
      setActionText('');
      setSelected(null);
      await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setActionLoading(false); }
  };

  const handleLock = async () => {
    if (!selected) return;
    const snap = selected;
    setSelected(null);
    // Optimistic removal — remove all items for this course+type immediately
    setSubmissions(prev => prev.filter(s => !(s.course_id === snap.course_id && s.type === snap.type)));
    try {
      if (snap.type === 'scheme_of_work') {
        await lockSchemeOfWorkByAdminCourse(snap.course_id, profile.id, snap.professor_id);
      } else {
        await lockSyllabusByAdminCourse(snap.course_id, profile.id, snap.professor_id);
      }
      await load();
    } catch (e: any) {
      Alert.alert('Lock Failed', e?.message ?? 'Could not lock document.');
      await load();
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const filtered = submissions.filter(s =>
    filter === 'all' || s.type === filter,
  );

  const pendingCount = submissions.filter(s => s.status === 'pending').length;

  return (
    <View style={s.root}>
      {/* Filter chips */}
      <View style={s.filterRow}>
        {(['all', 'syllabus', 'scheme_of_work', 'material'] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterChip, filter === f && s.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterChipText, filter === f && s.filterChipTextActive]}>
              {f === 'all' ? `All (${submissions.length})` :
               f === 'syllabus' ? 'Syllabi' :
               f === 'scheme_of_work' ? 'Schemes of Work' : 'Materials'}
            </Text>
          </TouchableOpacity>
        ))}
        {pendingCount > 0 && (
          <View style={s.pendingBadge}>
            <Text style={s.pendingBadgeText}>{pendingCount} pending</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={C.forest} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>✅</Text>
              <Text style={s.emptyTitle}>All clear</Text>
              <Text style={s.emptyBody}>No submissions in this category.</Text>
            </View>
          ) : filtered.map(sub => {
            const st = STATUS_CFG[sub.status] ?? STATUS_CFG.pending;
            const ai = AI_CFG[sub.ai_status] ?? AI_CFG.not_run;
            return (
              <TouchableOpacity key={sub.id} style={s.card} onPress={() => setSelected(sub)} activeOpacity={0.8}>
                <View style={s.cardTop}>
                  <Text style={s.fileIconTxt}>{FILE_ICON[sub.file_type ?? sub.type] ?? '📎'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.courseName} numberOfLines={1}>{sub.course_name}</Text>
                    <Text style={s.meta}>
                      {[sub.program, sub.semester].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <View style={[s.chip, { backgroundColor: st.bg }]}>
                    <Text style={[s.chipTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                <View style={s.cardMid}>
                  <Text style={s.professorTxt}>👤 {sub.professor_name}</Text>
                  <Text style={s.dateTxt}>🕐 {fmtDate(sub.submitted_at)}</Text>
                </View>

                {sub.file_name && (
                  <Text style={s.fileName} numberOfLines={1}>
                    {FILE_ICON[sub.file_type ?? 'other']} {sub.file_name}
                  </Text>
                )}

                <View style={s.cardBottom}>
                  <View style={[s.aiChip, { backgroundColor: ai.bg }]}>
                    <Text style={[s.aiChipTxt, { color: ai.color }]}>{ai.icon} {ai.label}</Text>
                  </View>
                  <Text style={s.typeBadge}>
                    {sub.type === 'syllabus' ? '📋 Syllabus' :
                     sub.type === 'scheme_of_work' ? '📅 Scheme of Work' : '📎 Material'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Detail Modal ── */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={d.root}>
            {/* Header */}
            <View style={d.header}>
              <TouchableOpacity onPress={() => setSelected(null)} style={d.closeBtn}>
                <Text style={d.closeText}>✕ Close</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={d.headerTitle} numberOfLines={1}>{selected.course_name}</Text>
                <Text style={d.headerSub}>
                  {[selected.program, selected.semester].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={[d.statusChip, { backgroundColor: (STATUS_CFG[selected.status] ?? STATUS_CFG.pending).bg }]}>
                <Text style={[d.statusChipTxt, { color: (STATUS_CFG[selected.status] ?? STATUS_CFG.pending).color }]}>
                  {(STATUS_CFG[selected.status] ?? STATUS_CFG.pending).label}
                </Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={d.scroll}>
              {/* Submission info */}
              <View style={d.section}>
                <Text style={d.sectionTitle}>Submission Details</Text>
                <View style={d.infoGrid}>
                  <InfoRow label="Professor" value={selected.professor_name} />
                  <InfoRow label="Type" value={
                selected.type === 'syllabus' ? 'Syllabus' :
                selected.type === 'scheme_of_work' ? 'Scheme of Work' : 'Course Material'
              } />
                  <InfoRow label="File" value={selected.file_name ?? '—'} />
                  <InfoRow label="Submitted" value={fmtDate(selected.submitted_at)} />
                  {selected.reason && <InfoRow label="Professor's note" value={selected.reason} />}
                  {selected.admin_comment && (
                    <View style={d.commentBox}>
                      <Text style={d.commentLabel}>Previous admin comment:</Text>
                      <Text style={d.commentText}>{selected.admin_comment}</Text>
                    </View>
                  )}
                </View>
                {selected.file_url ? (
                  <TouchableOpacity
                    style={d.viewFileBtn}
                    onPress={() => {
                      if (typeof window !== 'undefined') {
                        window.open(selected.file_url, '_blank');
                      }
                    }}
                  >
                    <Text style={d.viewFileBtnTxt}>📄 View Uploaded File</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={d.noFileBox}>
                    <Text style={d.noFileTxt}>⚠ No file uploaded — AI analysis unavailable</Text>
                  </View>
                )}
              </View>

            </ScrollView>

            {/* Action bar */}
            <View style={d.actionBar}>
              {selected.status === 'approved' && (selected.type === 'syllabus' || selected.type === 'scheme_of_work') ? (
                <TouchableOpacity style={[d.actionBtn, d.btnLock]} onPress={handleLock} disabled={actionLoading}>
                  {actionLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={d.btnApproveTxt}>
                        {selected.type === 'scheme_of_work' ? '🔒 Lock Scheme of Work' : '🔒 Lock Syllabus'}
                      </Text>}
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[d.actionBtn, d.btnDecline]}
                    onPress={() => { setActionModal('decline'); setActionText(''); }}
                    disabled={actionLoading}
                  >
                    <Text style={d.btnDeclineTxt}>✕ Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[d.actionBtn, d.btnChanges]}
                    onPress={() => { setActionModal('changes'); setActionText(''); }}
                    disabled={actionLoading}
                  >
                    <Text style={d.btnChangesTxt}>✏ Changes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[d.actionBtn, d.btnApprove]} onPress={handleApprove} disabled={actionLoading}>
                    {actionLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={d.btnApproveTxt}>✓ Approve</Text>}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      </Modal>

      {/* ── Action comment modal ── */}
      <Modal
        visible={!!actionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setActionModal(null)}
      >
        <View style={cm.overlay}>
          <View style={cm.modal}>
            <Text style={cm.title}>
              {actionModal === 'decline' ? '✕ Decline Submission' : '✏ Request Changes'}
            </Text>
            <Text style={cm.body}>
              {actionModal === 'decline'
                ? 'Explain clearly what is wrong so the professor knows what to fix.'
                : 'Describe what changes are needed. The professor will receive this as a notification.'}
            </Text>
            <TextInput
              style={cm.input}
              placeholder={
                actionModal === 'decline'
                  ? 'e.g. Learning outcomes are missing assessment methods for LO3 and LO4…'
                  : 'e.g. Please add assessment criteria for all listed learning outcomes…'
              }
              placeholderTextColor="rgba(26,26,26,0.35)"
              value={actionText}
              onChangeText={setActionText}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <View style={cm.actions}>
              <TouchableOpacity style={cm.btnCancel} onPress={() => setActionModal(null)}>
                <Text style={cm.btnCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cm.btnSubmit, { backgroundColor: actionModal === 'decline' ? C.red : C.forest }]}
                onPress={handleActionSubmit}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={cm.btnSubmitTxt}>{actionModal === 'decline' ? 'Decline' : 'Send Request'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={d.infoRow}>
    <Text style={d.infoLabel}>{label}</Text>
    <Text style={d.infoValue}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: C.mist },
  filterRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, flexWrap: 'wrap' },
  filterChip:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive:  { backgroundColor: C.forest, borderColor: C.forest },
  filterChipText:    { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: '#fff' },
  pendingBadge:      { marginLeft: 'auto', backgroundColor: C.amber, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  pendingBadgeText:  { fontSize: 11, fontWeight: '800', color: '#fff' },
  loader:            { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  list:              { padding: 14, gap: 12, paddingBottom: 40 },
  empty:             { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon:         { fontSize: 44 },
  emptyTitle:        { fontSize: 17, fontWeight: '700', color: C.ink },
  emptyBody:         { fontSize: 13, color: C.inkMid },
  card:              { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, gap: 8 },
  cardTop:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  fileIconTxt:       { fontSize: 24, marginTop: 2 },
  courseName:        { fontSize: 14, fontWeight: '700', color: C.ink },
  meta:              { fontSize: 11, color: C.inkMid, marginTop: 2 },
  chip:              { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  chipTxt:           { fontSize: 10, fontWeight: '700' },
  cardMid:           { flexDirection: 'row', justifyContent: 'space-between' },
  professorTxt:      { fontSize: 12, color: C.inkMid },
  dateTxt:           { fontSize: 12, color: C.inkSoft },
  fileName:          { fontSize: 11, color: C.blue },
  cardBottom:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aiChip:            { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  aiChipTxt:         { fontSize: 11, fontWeight: '700' },
  typeBadge:         { fontSize: 11, color: C.inkSoft },
});

const d = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.mist },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 16, paddingVertical: 14, paddingTop: 20 },
  closeBtn:      { paddingRight: 8 },
  closeText:     { fontSize: 13, color: C.forest, fontWeight: '600' },
  headerTitle:   { fontSize: 15, fontWeight: '800', color: C.ink },
  headerSub:     { fontSize: 11, color: C.inkMid, marginTop: 1 },
  statusChip:    { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  statusChipTxt: { fontSize: 11, fontWeight: '700' },
  scroll:        { padding: 16, gap: 16, paddingBottom: 120 },
  section:       { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16, gap: 10 },
  sectionTitle:  { fontSize: 13, fontWeight: '800', color: C.forest, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionSub:    { fontSize: 12, color: C.inkMid, lineHeight: 17 },
  infoGrid:      { gap: 6 },
  infoRow:       { flexDirection: 'row', gap: 10 },
  infoLabel:     { fontSize: 12, fontWeight: '700', color: C.inkMid, width: 110 },
  infoValue:     { fontSize: 12, color: C.ink, flex: 1, flexWrap: 'wrap' },
  commentBox:    { backgroundColor: C.amberBg, borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: C.amber },
  commentLabel:  { fontSize: 11, fontWeight: '700', color: C.amber, marginBottom: 3 },
  commentText:   { fontSize: 12, color: C.ink, lineHeight: 17 },
  standardRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  standardCode:  { backgroundColor: C.forest + '15', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  standardCodeTxt:{ fontSize: 10, fontWeight: '800', color: C.forest },
  standardTitle: { fontSize: 12, fontWeight: '600', color: C.ink },
  standardCat:   { fontSize: 10, color: C.inkMid },
  aiLoader:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  aiLoaderTxt:   { fontSize: 13, color: C.inkMid },
  scoreRow:      { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 12 },
  scoreCircle:   { width: 72, height: 72, borderRadius: 36, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  scoreNum:      { fontSize: 22, fontWeight: '800' },
  scoreLabel:    { fontSize: 10, color: C.inkMid },
  complianceLabel:{ fontSize: 11, color: C.inkMid, fontWeight: '600' },
  complianceValue:{ fontSize: 15, fontWeight: '800', marginTop: 2 },
  issuesSummary: { fontSize: 11, color: C.inkMid, marginTop: 4 },
  issueCard:     { borderLeftWidth: 4, borderRadius: 8, backgroundColor: '#FAFAFA', padding: 12, gap: 6 },
  issueHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  severityTag:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  severityTxt:   { fontSize: 10, fontWeight: '800' },
  issueCode:     { fontSize: 11, fontWeight: '700', color: C.forest, flex: 1 },
  issueChevron:  { fontSize: 10, color: C.inkMid },
  issueTitle:    { fontSize: 13, fontWeight: '700', color: C.ink },
  issueDesc:     { fontSize: 12, color: C.inkMid, lineHeight: 18 },
  issueLocation: { fontSize: 11, color: C.blue },
  issueOutcome:  { fontSize: 11, color: C.purple },
  recBox:        { backgroundColor: C.greenBg, borderRadius: 8, padding: 10 },
  recLabel:      { fontSize: 11, fontWeight: '800', color: C.forest, marginBottom: 4 },
  recText:       { fontSize: 12, color: C.ink, lineHeight: 17 },
  noAI:          { fontSize: 13, color: C.inkMid, textAlign: 'center', padding: 20 },
  addToCommentBtn:    { marginTop: 4, backgroundColor: C.purpleBg, borderWidth: 1, borderColor: C.purple, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  addToCommentBtnTxt: { fontSize: 13, fontWeight: '700', color: C.purple },
  aiHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  runAIBtn:      { backgroundColor: C.forest, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  runAIBtnTxt:   { color: '#fff', fontWeight: '700', fontSize: 12 },
  aiErrorBox:    { backgroundColor: C.redBg, borderRadius: 8, padding: 12, borderLeftWidth: 3, borderLeftColor: C.red },
  aiErrorTxt:    { fontSize: 12, color: C.red, lineHeight: 18 },
  viewFileBtn:   { marginTop: 10, backgroundColor: C.blueBg, borderWidth: 1, borderColor: C.blue, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  viewFileBtnTxt:{ fontSize: 13, fontWeight: '700', color: C.blue },
  noFileBox:     { marginTop: 10, backgroundColor: C.amberBg, borderRadius: 8, padding: 10 },
  noFileTxt:     { fontSize: 12, color: C.amber, fontWeight: '600' },
  actionBar:     { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
  actionBtn:     { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnDecline:    { backgroundColor: C.redBg, borderWidth: 1, borderColor: C.red },
  btnDeclineTxt: { color: C.red, fontWeight: '700', fontSize: 13 },
  btnChanges:    { backgroundColor: C.purpleBg, borderWidth: 1, borderColor: C.purple },
  btnChangesTxt: { color: C.purple, fontWeight: '700', fontSize: 13 },
  btnApprove:    { backgroundColor: C.forest },
  btnLock:       { backgroundColor: C.blue },
  btnApproveTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

const cm = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal:       { backgroundColor: C.card, borderRadius: 16, padding: 22, width: '100%', maxWidth: 500, gap: 14 },
  title:       { fontSize: 17, fontWeight: '800', color: C.ink },
  body:        { fontSize: 13, color: C.inkMid, lineHeight: 19 },
  input:       { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 13, color: C.ink, minHeight: 110 },
  actions:     { flexDirection: 'row', gap: 10 },
  btnCancel:   { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center', backgroundColor: '#F3F4F6' },
  btnCancelTxt:{ fontWeight: '600', color: C.inkMid, fontSize: 13 },
  btnSubmit:   { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  btnSubmitTxt:{ fontWeight: '700', color: '#fff', fontSize: 13 },
});

export default PendingApprovalsTab;
