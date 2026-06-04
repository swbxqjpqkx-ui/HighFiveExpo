import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, TextInput, Modal, Alert,
} from 'react-native';
import { getProfessorOverviews } from '../../services/supabase';
import {
  getAllPendingSubmissions, approveSubmission, declineSubmission,
  requestChanges, PendingSubmission,
} from '../../services/adminAccreditation';
import { ProfessorOverview, Profile } from '../../types';

const C = {
  forest:  '#1A5C38', leaf: '#3A8F5F', mist: '#F2FAF5',
  ink:     '#1A1A1A', inkMid: 'rgba(26,26,26,0.6)', inkSoft: 'rgba(26,26,26,0.38)',
  border:  '#E0EDE6', card: '#FFFFFF',
  red:     '#C0392B', redBg: '#FDF1F0',
  amber:   '#92600A', amberBg: '#FFFBEB',
  blue:    '#1D4ED8', blueBg: '#EFF6FF',
  purple:  '#6D28D9', purpleBg: '#F5F3FF',
  green50: '#EFF6EF',
};

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  pending:           { label: 'Pending',           bg: C.amberBg,  color: C.amber  },
  approved:          { label: 'Approved',           bg: C.green50,  color: C.forest },
  declined:          { label: 'Declined',           bg: C.redBg,    color: C.red    },
  changes_requested: { label: 'Changes Requested', bg: C.purpleBg, color: C.purple },
};

const FILE_ICON: Record<string, string> = {
  pdf: '📄', word: '📝', ppt: '📊', excel: '📈',
  image: '🖼', link: '🔗', other: '📎', syllabus: '📋',
};

interface Props { profile: Profile; }

const AdminProfessorsScreen: React.FC<Props> = ({ profile }) => {
  const [professors, setProfessors]   = useState<ProfessorOverview[]>([]);
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading]         = useState(true);

  // Action modal state
  const [actionModal, setActionModal] = useState<{
    sub: PendingSubmission; mode: 'decline' | 'changes';
  } | null>(null);
  const [actionText, setActionText]   = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Submission filter
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profs, subs] = await Promise.all([
        getProfessorOverviews(),
        getAllPendingSubmissions(),
      ]);
      setProfessors(profs);
      setSubmissions(subs);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (sub: PendingSubmission) => {
    try {
      await approveSubmission(sub, profile.id);
      await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleActionSubmit = async () => {
    if (!actionModal || !actionText.trim()) {
      Alert.alert('Required', 'Please write a message.');
      return;
    }
    setActionLoading(true);
    try {
      if (actionModal.mode === 'decline') {
        await declineSubmission(actionModal.sub, actionText.trim());
      } else {
        await requestChanges(actionModal.sub, actionText.trim());
      }
      setActionModal(null);
      setActionText('');
      await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setActionLoading(false); }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const pendingSubs  = submissions.filter(s => s.status === 'pending');
  const displayedSubs = showAll ? submissions : pendingSubs;
  const pendingCount = pendingSubs.length;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Professors Overview</Text>

      {/* KPI tiles */}
      <View style={s.tilesRow}>
        {[
          { label: 'Pending Approvals', value: pendingCount,         color: C.amber,  border: C.amber  },
          { label: 'Total Professors',  value: professors.length,    color: C.forest, border: C.forest },
          { label: 'Need Support',      value: professors.filter(p => p.needs_support).length, color: C.red,  border: C.red },
          { label: 'All Submissions',   value: submissions.length,   color: C.blue,   border: C.blue   },
        ].map(tile => (
          <View key={tile.label} style={[s.tile, { borderLeftColor: tile.border }]}>
            <Text style={[s.tileVal, { color: tile.color }]}>{tile.value}</Text>
            <Text style={s.tileLbl}>{tile.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Pending Approvals ── */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <View>
            <Text style={s.sectionTitle}>Pending Approvals</Text>
            <Text style={s.sectionSub}>Syllabi and course materials from professors</Text>
          </View>
          <TouchableOpacity onPress={() => setShowAll(v => !v)} style={s.toggleBtn}>
            <Text style={s.toggleBtnTxt}>{showAll ? 'Show pending' : 'Show all'}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={C.forest} style={{ marginVertical: 20 }} />
        ) : displayedSubs.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>✅</Text>
            <Text style={s.emptyTxt}>
              {showAll ? 'No submissions yet.' : 'No pending approvals — all clear.'}
            </Text>
          </View>
        ) : (
          displayedSubs.map(sub => {
            const st = STATUS_CFG[sub.status] ?? STATUS_CFG.pending;
            const isPending = sub.status === 'pending';
            return (
              <View key={sub.id} style={s.subCard}>
                {/* Top row */}
                <View style={s.subTop}>
                  <Text style={s.subFileIcon}>{FILE_ICON[sub.file_type ?? sub.type] ?? '📎'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.subCourse} numberOfLines={1}>{sub.course_name}</Text>
                    <Text style={s.subMeta}>
                      {[sub.program, sub.semester].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <View style={[s.statusChip, { backgroundColor: st.bg }]}>
                    <Text style={[s.statusChipTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                {/* Info row */}
                <View style={s.subInfo}>
                  <Text style={s.subInfoTxt}>👤 {sub.professor_name}</Text>
                  <Text style={s.subInfoTxt}>
                    {sub.type === 'syllabus' ? '📋 Syllabus' : '📎 Material'}
                  </Text>
                  <Text style={s.subInfoTxt}>🕐 {fmtDate(sub.submitted_at)}</Text>
                </View>

                {sub.file_name && (
                  <Text style={s.subFileName} numberOfLines={1}>
                    {FILE_ICON[sub.file_type ?? 'other']} {sub.file_name}
                  </Text>
                )}

                {sub.reason && (
                  <View style={s.reasonBox}>
                    <Text style={s.reasonLabel}>Professor's note</Text>
                    <Text style={s.reasonText} numberOfLines={2}>{sub.reason}</Text>
                  </View>
                )}

                {sub.admin_comment && !isPending && (
                  <View style={[s.reasonBox, { borderLeftColor: C.purple }]}>
                    <Text style={[s.reasonLabel, { color: C.purple }]}>Your last comment</Text>
                    <Text style={s.reasonText} numberOfLines={2}>{sub.admin_comment}</Text>
                  </View>
                )}

                {/* Actions — only for pending */}
                {isPending && (
                  <View style={s.subActions}>
                    <TouchableOpacity
                      style={s.btnDecline}
                      onPress={() => { setActionModal({ sub, mode: 'decline' }); setActionText(''); }}
                    >
                      <Text style={s.btnDeclineTxt}>✕ Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.btnChanges}
                      onPress={() => { setActionModal({ sub, mode: 'changes' }); setActionText(''); }}
                    >
                      <Text style={s.btnChangesTxt}>✏ Changes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.btnApprove}
                      onPress={() => handleApprove(sub)}
                    >
                      <Text style={s.btnApproveTxt}>✓ Approve</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* ── All Professors table ── */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>All Professors</Text>
        {loading ? (
          <ActivityIndicator size="large" color={C.forest} style={{ marginVertical: 20 }} />
        ) : (
          <>
            <View style={s.tableHeader}>
              <Text style={[s.th, { flex: 2 }]}>Name</Text>
              <Text style={[s.th, { flex: 2 }]}>Email</Text>
              <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>Courses</Text>
              <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>Support</Text>
            </View>
            {professors.length === 0 ? (
              <Text style={s.emptyTxt}>No professors found.</Text>
            ) : professors.map((p, i) => (
              <View key={p.id} style={[s.tableRow, i % 2 === 0 && s.tableRowAlt]}>
                <Text style={[s.td, { flex: 2, fontWeight: '600' }]} numberOfLines={1}>{p.full_name}</Text>
                <Text style={[s.td, { flex: 2, color: C.inkMid }]} numberOfLines={1}>{p.email}</Text>
                <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{p.courses_count}</Text>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <View style={[s.badge, p.needs_support && s.badgeWarn]}>
                    <Text style={[s.badgeTxt, p.needs_support && s.badgeTxtWarn]}>
                      {p.needs_support ? 'Yes' : 'No'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </View>

      {/* ── Action comment modal ── */}
      <Modal
        visible={!!actionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setActionModal(null)}
      >
        <View style={m.overlay}>
          <View style={m.modal}>
            <Text style={m.title}>
              {actionModal?.mode === 'decline' ? '✕ Decline Submission' : '✏ Request Changes'}
            </Text>
            {actionModal && (
              <Text style={m.sub}>
                {actionModal.sub.course_name} · {actionModal.sub.professor_name}
              </Text>
            )}
            <TextInput
              style={m.input}
              placeholder={
                actionModal?.mode === 'decline'
                  ? 'Explain what is wrong so the professor knows what to fix…'
                  : 'Describe the changes needed…'
              }
              placeholderTextColor={C.inkSoft}
              value={actionText}
              onChangeText={setActionText}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <View style={m.actions}>
              <TouchableOpacity style={m.btnCancel} onPress={() => setActionModal(null)}>
                <Text style={m.btnCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.btnSubmit, {
                  backgroundColor: actionModal?.mode === 'decline' ? C.red : C.forest,
                }]}
                onPress={handleActionSubmit}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={m.btnSubmitTxt}>
                      {actionModal?.mode === 'decline' ? 'Decline' : 'Send Request'}
                    </Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.mist },
  content:      { padding: 16, paddingBottom: 48 },
  pageTitle:    { fontSize: 22, fontWeight: '800', color: C.forest, marginBottom: 16 },
  tilesRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  tile:         { flex: 1, minWidth: 130, backgroundColor: C.card, borderWidth: 1, borderLeftWidth: 3, borderColor: C.border, borderRadius: 10, padding: 12, gap: 4 },
  tileVal:      { fontSize: 26, fontWeight: '900' },
  tileLbl:      { fontSize: 11, color: C.inkMid, fontWeight: '500' },
  card:         { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  cardHead:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.ink },
  sectionSub:   { fontSize: 11, color: C.inkMid, marginTop: 2 },
  toggleBtn:    { backgroundColor: C.mist, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.border },
  toggleBtnTxt: { fontSize: 12, fontWeight: '600', color: C.forest },
  empty:        { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyIcon:    { fontSize: 32 },
  emptyTxt:     { fontSize: 13, color: C.inkMid },

  // Submission card
  subCard:      { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, marginBottom: 10, gap: 8 },
  subTop:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  subFileIcon:  { fontSize: 22, marginTop: 1 },
  subCourse:    { fontSize: 13, fontWeight: '700', color: C.ink },
  subMeta:      { fontSize: 11, color: C.inkMid, marginTop: 2 },
  statusChip:   { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  statusChipTxt:{ fontSize: 10, fontWeight: '700' },
  subInfo:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  subInfoTxt:   { fontSize: 11, color: C.inkMid },
  subFileName:  { fontSize: 11, color: C.blue },
  reasonBox:    { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, borderLeftWidth: 3, borderLeftColor: C.amber },
  reasonLabel:  { fontSize: 10, fontWeight: '800', color: C.amber, marginBottom: 2 },
  reasonText:   { fontSize: 12, color: C.ink, lineHeight: 17 },
  subActions:   { flexDirection: 'row', gap: 8, marginTop: 2 },
  btnDecline:   { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center', backgroundColor: C.redBg, borderWidth: 1, borderColor: C.red },
  btnDeclineTxt:{ fontSize: 12, fontWeight: '700', color: C.red },
  btnChanges:   { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center', backgroundColor: C.purpleBg, borderWidth: 1, borderColor: C.purple },
  btnChangesTxt:{ fontSize: 12, fontWeight: '700', color: C.purple },
  btnApprove:   { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center', backgroundColor: C.forest },
  btnApproveTxt:{ fontSize: 12, fontWeight: '700', color: '#fff' },

  // Table
  tableHeader:  { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 4 },
  tableRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  tableRowAlt:  { backgroundColor: C.mist, borderRadius: 6 },
  th:           { fontSize: 10, fontWeight: '700', color: C.inkMid, textTransform: 'uppercase', letterSpacing: 0.6 },
  td:           { fontSize: 13, color: C.ink },
  badge:        { backgroundColor: C.green50, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeWarn:    { backgroundColor: C.amberBg },
  badgeTxt:     { fontSize: 11, fontWeight: '700', color: C.forest },
  badgeTxtWarn: { color: C.amber },
});

const m = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal:        { backgroundColor: C.card, borderRadius: 16, padding: 22, width: '100%', maxWidth: 500, gap: 12 },
  title:        { fontSize: 16, fontWeight: '800', color: C.ink },
  sub:          { fontSize: 12, color: C.inkMid },
  input:        { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 13, color: C.ink, minHeight: 110 },
  actions:      { flexDirection: 'row', gap: 10 },
  btnCancel:    { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center', backgroundColor: '#F3F4F6' },
  btnCancelTxt: { fontWeight: '600', color: C.inkMid, fontSize: 13 },
  btnSubmit:    { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  btnSubmitTxt: { fontWeight: '700', color: '#fff', fontSize: 13 },
});

export default AdminProfessorsScreen;
