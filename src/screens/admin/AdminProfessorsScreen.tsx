import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput,
} from 'react-native';
import { getProfessorOverviews, getPendingApprovals, approveDocument, declineDocument } from '../../services/supabase';
import { ProfessorOverview, PendingApproval } from '../../types';

const C = {
  green50:  '#f0f6ef',
  green600: '#2a8a4d',
  green700: '#1d6e3a',
  text:     '#1a2418',
  muted:    '#6b7264',
  soft:     '#8e948a',
  border:   '#e4ebe2',
  red:      '#d94343',
  amber:    '#d99a1f',
  blue:     '#3b6fd1',
  card:     '#ffffff',
  bg:       '#f5f9f3',
};

const FILE_ICONS: Record<string, string> = {
  pdf:   '📄',
  excel: '📊',
  word:  '📝',
  ppt:   '📑',
};

const AdminProfessorsScreen: React.FC = () => {
  const [professors, setProfessors] = useState<ProfessorOverview[]>([]);
  const [approvals, setApprovals]   = useState<PendingApproval[]>([]);
  const [loading, setLoading]       = useState(true);
  const [declineId, setDeclineId]   = useState<string | null>(null);
  const [comment, setComment]       = useState('');
  const [actionMsg, setActionMsg]   = useState('');

  useEffect(() => {
    Promise.all([getProfessorOverviews(), getPendingApprovals()])
      .then(([profs, apps]) => { setProfessors(profs); setApprovals(apps); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async (id: string) => {
    await approveDocument(id);
    setApprovals(prev => prev.filter(a => a.id !== id));
    setActionMsg('Document approved.');
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleDecline = async (id: string) => {
    await declineDocument(id, comment);
    setApprovals(prev => prev.filter(a => a.id !== id));
    setDeclineId(null);
    setComment('');
    setActionMsg('Document declined.');
    setTimeout(() => setActionMsg(''), 3000);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Professors Overview &amp; Coordination</Text>

      {/* KPI tiles */}
      <View style={s.tilesRow}>
        {[
          { label: 'Courses Below Benchmark', value: 7,  color: C.red,      accent: C.red },
          { label: 'Requiring Support',       value: 4,  color: C.amber,    accent: C.amber },
          { label: 'Pending Approvals',       value: approvals.length, color: C.blue, accent: C.blue },
          { label: 'Delayed Grading',         value: 9,  color: C.green600, accent: C.green600 },
        ].map(tile => (
          <View key={tile.label} style={[s.tile, { borderLeftColor: tile.accent }]}>
            <Text style={[s.tileVal, { color: tile.color }]}>{tile.value}</Text>
            <Text style={s.tileLbl}>{tile.label}</Text>
          </View>
        ))}
      </View>

      {/* Action message */}
      {actionMsg ? <View style={s.actionMsg}><Text style={s.actionMsgText}>{actionMsg}</Text></View> : null}

      {/* Pending Approvals — shown first */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Pending Approvals ({approvals.length})</Text>
        {approvals.length === 0 ? (
          <Text style={s.empty}>No pending approvals.</Text>
        ) : (
          approvals.map(ap => (
            <View key={ap.id}>
              <View style={s.approvalRow}>
                <Text style={s.fileIcon}>{FILE_ICONS[ap.file_type] ?? '📎'}</Text>
                <View style={s.approvalBody}>
                  <Text style={s.approvalDoc}>{ap.document_name}</Text>
                  <Text style={s.approvalProf}>{ap.professor_name} · {ap.professor_email}</Text>
                  <Text style={s.approvalDate}>Submitted {formatDate(ap.submitted_at)}</Text>
                </View>
                <View style={s.approvalBtns}>
                  <TouchableOpacity style={s.approveBtn} onPress={() => handleApprove(ap.id)}>
                    <Text style={s.approveBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.declineBtn} onPress={() => setDeclineId(declineId === ap.id ? null : ap.id)}>
                    <Text style={s.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {/* Decline form */}
              {declineId === ap.id && (
                <View style={s.declineForm}>
                  <TextInput
                    style={s.declineInput}
                    value={comment}
                    onChangeText={setComment}
                    placeholder="Reason for declining..."
                    placeholderTextColor={C.soft}
                    multiline
                  />
                  <View style={s.declineFormBtns}>
                    <TouchableOpacity style={s.declineConfirm} onPress={() => handleDecline(ap.id)}>
                      <Text style={s.declineConfirmText}>Confirm Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setDeclineId(null); setComment(''); }}>
                      <Text style={s.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* All Professors table — shown below approvals */}
      {loading ? (
        <ActivityIndicator size="large" color={C.green600} style={{ marginVertical: 30 }} />
      ) : (
        <View style={s.card}>
          <Text style={s.sectionTitle}>All Professors</Text>
          <View style={s.tableHeader}>
            <Text style={[s.th, { flex: 2 }]}>Name</Text>
            <Text style={[s.th, { flex: 2 }]}>Email</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>Courses</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>Pending</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>Support</Text>
          </View>
          {professors.length === 0 ? (
            <Text style={s.empty}>No professors found.</Text>
          ) : (
            professors.map((p, i) => (
              <View key={p.id} style={[s.tableRow, i % 2 === 0 && s.tableRowAlt]}>
                <Text style={[s.td, { flex: 2, fontWeight: '600' }]}>{p.full_name}</Text>
                <Text style={[s.td, { flex: 2, color: C.muted }]}>{p.email}</Text>
                <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{p.courses_count}</Text>
                <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{p.pending_items}</Text>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <View style={[s.badge, p.needs_support && s.badgeWarn]}>
                    <Text style={[s.badgeText, p.needs_support && s.badgeTextWarn]}>
                      {p.needs_support ? 'Yes' : 'No'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  content:      { padding: 20, paddingBottom: 40 },
  pageTitle:    { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 16 },
  tilesRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  tile:         { flex: 1, minWidth: 130, backgroundColor: C.card, borderWidth: 1, borderLeftWidth: 3, borderColor: C.border, borderRadius: 10, padding: 12, gap: 4 },
  tileVal:      { fontSize: 28, fontWeight: '900' },
  tileLbl:      { fontSize: 11, color: C.muted, fontWeight: '500' },
  actionMsg:    { backgroundColor: C.green50, borderWidth: 1, borderColor: C.green600 + '50', borderRadius: 8, padding: 10, marginBottom: 12 },
  actionMsgText:{ fontSize: 13, color: C.green700, fontWeight: '600' },
  card:         { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14 },
  tableHeader:  { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 4 },
  tableRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  tableRowAlt:  { backgroundColor: C.bg, borderRadius: 6 },
  th:           { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  td:           { fontSize: 13, color: C.text },
  badge:        { backgroundColor: C.green50, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeWarn:    { backgroundColor: '#fef3cd' },
  badgeText:    { fontSize: 11, fontWeight: '700', color: C.green600 },
  badgeTextWarn:{ color: C.amber },
  empty:        { fontSize: 13, color: C.muted, paddingVertical: 12 },
  approvalRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  fileIcon:     { fontSize: 28 },
  approvalBody: { flex: 1, gap: 3 },
  approvalDoc:  { fontSize: 13, fontWeight: '700', color: C.text },
  approvalProf: { fontSize: 12, color: C.muted },
  approvalDate: { fontSize: 11, color: C.soft },
  approvalBtns: { gap: 6 },
  approveBtn:   { backgroundColor: C.green600, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  approveBtnText:{ fontSize: 12, fontWeight: '700', color: '#fff' },
  declineBtn:   { backgroundColor: '#fbeeee', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  declineBtnText:{ fontSize: 12, fontWeight: '700', color: C.red },
  declineForm:  { backgroundColor: '#fbeeee', borderRadius: 10, padding: 12, marginBottom: 8, gap: 8 },
  declineInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, fontSize: 13, color: C.text, minHeight: 60 },
  declineFormBtns:{ flexDirection: 'row', gap: 12, alignItems: 'center' },
  declineConfirm:{ backgroundColor: C.red, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  declineConfirmText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  cancelText:   { fontSize: 12, color: C.muted },
});

export default AdminProfessorsScreen;
