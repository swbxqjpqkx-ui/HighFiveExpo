import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import {
  getAllPendingSyllabusRequests,
  getAllSyllabi,
  approveSyllabusRequest,
  declineSyllabusRequest,
  lockSyllabus,
  unlockSyllabus,
  AdminSyllabusRequest,
  AdminSyllabusRow,
} from '../../services/courseManagement';
import { Profile } from '../../types';

const C = {
  forest: '#1A5C38', leaf: '#3A8F5F', mist: '#F2FAF5',
  ink: '#1A1A1A', inkMid: 'rgba(26,26,26,0.6)', inkSoft: 'rgba(26,26,26,0.38)',
  border: '#E0EDE6', card: '#FFFFFF',
  green: '#1A5C38', greenBg: '#EFF6EF',
  red: '#C0392B', redBg: '#FDF1F0',
  amber: '#92600A', amberBg: '#FFFBEB',
  blue: '#1D4ED8', blueBg: '#EFF6FF',
  grey: '#6B7280', greyBg: '#F3F4F6',
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: C.amberBg, color: C.amber,  label: 'Pending' },
  approved:  { bg: C.greenBg, color: C.green,  label: 'Approved' },
  locked:    { bg: C.blueBg,  color: C.blue,   label: '🔒 Locked' },
  declined:  { bg: C.redBg,   color: C.red,    label: 'Declined' },
  submitted: { bg: C.amberBg, color: C.amber,  label: 'Submitted' },
};

interface Props {
  profile: Profile;
}

const AdminSyllabusScreen: React.FC<Props> = ({ profile }) => {
  const [tab, setTab] = useState<'requests' | 'syllabi'>('requests');
  const [requests, setRequests] = useState<AdminSyllabusRequest[]>([]);
  const [syllabi, setSyllabi] = useState<AdminSyllabusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [declineModal, setDeclineModal] = useState<{ visible: boolean; requestId: string }>({ visible: false, requestId: '' });
  const [declineComment, setDeclineComment] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, syls] = await Promise.all([
        getAllPendingSyllabusRequests(),
        getAllSyllabi(),
      ]);
      setRequests(reqs);
      setSyllabi(syls);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load syllabus data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (req: AdminSyllabusRequest) => {
    setActionLoading(req.id);
    try {
      await approveSyllabusRequest(req, profile.id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Approval failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineSubmit = async () => {
    if (!declineComment.trim()) {
      Alert.alert('Required', 'Please enter a reason for declining.');
      return;
    }
    setActionLoading(declineModal.requestId);
    setDeclineModal({ visible: false, requestId: '' });
    try {
      await declineSyllabusRequest(declineModal.requestId, declineComment.trim());
      setDeclineComment('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Decline failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLock = async (syl: AdminSyllabusRow) => {
    setActionLoading(syl.id);
    try {
      await lockSyllabus(syl.id, profile.id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Lock failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlock = async (syl: AdminSyllabusRow) => {
    Alert.alert(
      'Unlock Syllabus',
      `Unlocking will disable AI analysis for "${syl.course_name}" until it is locked again. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlock',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(syl.id);
            try {
              await unlockSyllabus(syl.id, profile.id);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Unlock failed.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <View style={s.root}>
      {/* Tab bar */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tab, tab === 'requests' && s.tabActive]}
          onPress={() => setTab('requests')}
        >
          <Text style={[s.tabLabel, tab === 'requests' && s.tabLabelActive]}>
            Pending Requests
            {requests.length > 0 && (
              <Text style={s.badge}> {requests.length}</Text>
            )}
          </Text>
          {tab === 'requests' && <View style={s.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'syllabi' && s.tabActive]}
          onPress={() => setTab('syllabi')}
        >
          <Text style={[s.tabLabel, tab === 'syllabi' && s.tabLabelActive]}>All Syllabi</Text>
          {tab === 'syllabi' && <View style={s.tabUnderline} />}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={C.forest} />
          <Text style={s.loaderText}>Loading…</Text>
        </View>
      ) : tab === 'requests' ? (
        <ScrollView contentContainerStyle={s.list}>
          {requests.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>✅</Text>
              <Text style={s.emptyTitle}>No pending requests</Text>
              <Text style={s.emptyBody}>All syllabus submissions have been reviewed.</Text>
            </View>
          ) : (
            requests.map(req => (
              <View key={req.id} style={s.card}>
                <View style={s.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.courseName}>{req.course_name}</Text>
                    <Text style={s.professorName}>👤 {req.professor_name}</Text>
                  </View>
                  <View style={[s.chip, { backgroundColor: C.amberBg }]}>
                    <Text style={[s.chipText, { color: C.amber }]}>
                      {req.request_type === 'initial' ? 'Initial' : req.request_type === 'replace' ? 'Replace' : 'Unlock'}
                    </Text>
                  </View>
                </View>

                <View style={s.reasonBox}>
                  <Text style={s.reasonLabel}>Reason from professor:</Text>
                  <Text style={s.reasonText}>{req.reason}</Text>
                </View>

                {req.file_name && (
                  <View style={s.fileRow}>
                    <Text style={s.fileIcon}>📄</Text>
                    <Text style={s.fileName}>{req.file_name}</Text>
                  </View>
                )}

                <Text style={s.dateText}>Submitted {formatDate(req.created_at)}</Text>

                <View style={s.actions}>
                  <TouchableOpacity
                    style={[s.btn, s.btnDecline]}
                    onPress={() => setDeclineModal({ visible: true, requestId: req.id })}
                    disabled={actionLoading === req.id}
                  >
                    <Text style={s.btnDeclineText}>✕ Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btn, s.btnApprove]}
                    onPress={() => handleApprove(req)}
                    disabled={actionLoading === req.id}
                  >
                    {actionLoading === req.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.btnApproveText}>✓ Approve</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {syllabi.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📋</Text>
              <Text style={s.emptyTitle}>No syllabi yet</Text>
              <Text style={s.emptyBody}>Approved syllabi will appear here for locking.</Text>
            </View>
          ) : (
            syllabi.map(syl => {
              const st = STATUS_STYLE[syl.status] ?? STATUS_STYLE['approved'];
              return (
                <View key={syl.id} style={s.card}>
                  <View style={s.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.courseName}>{syl.course_name}</Text>
                      <Text style={s.professorName}>👤 {syl.professor_name}</Text>
                    </View>
                    <View style={[s.chip, { backgroundColor: st.bg }]}>
                      <Text style={[s.chipText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>

                  <View style={s.metaRow}>
                    <Text style={s.metaItem}>Version {syl.version}</Text>
                    {syl.submitted_at && <Text style={s.metaItem}>Submitted {formatDate(syl.submitted_at)}</Text>}
                    {syl.approved_at && <Text style={s.metaItem}>Approved {formatDate(syl.approved_at)}</Text>}
                    {syl.locked_at && <Text style={s.metaItem}>Locked {formatDate(syl.locked_at)}</Text>}
                  </View>

                  {syl.file_name && (
                    <View style={s.fileRow}>
                      <Text style={s.fileIcon}>📄</Text>
                      <Text style={s.fileName}>{syl.file_name}</Text>
                    </View>
                  )}

                  {syl.status === 'locked' ? (
                    <View style={s.actions}>
                      <View style={s.lockedNotice}>
                        <Text style={s.lockedNoticeText}>🔒 Locked — AI analysis active</Text>
                      </View>
                      <TouchableOpacity
                        style={[s.btn, s.btnDecline]}
                        onPress={() => handleUnlock(syl)}
                        disabled={actionLoading === syl.id}
                      >
                        {actionLoading === syl.id ? (
                          <ActivityIndicator size="small" color={C.red} />
                        ) : (
                          <Text style={s.btnDeclineText}>🔓 Unlock</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : syl.status === 'approved' ? (
                    <View style={s.actions}>
                      <TouchableOpacity
                        style={[s.btn, s.btnLock]}
                        onPress={() => handleLock(syl)}
                        disabled={actionLoading === syl.id}
                      >
                        {actionLoading === syl.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={s.btnApproveText}>🔒 Lock & Enable AI</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Decline modal */}
      <Modal
        visible={declineModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeclineModal({ visible: false, requestId: '' })}
      >
        <View style={m.overlay}>
          <View style={m.modal}>
            <Text style={m.title}>Decline Syllabus Request</Text>
            <Text style={m.body}>
              Provide a reason so the professor knows what to fix before resubmitting.
            </Text>
            <TextInput
              style={m.input}
              placeholder="e.g. Missing learning outcomes for weeks 3–6…"
              placeholderTextColor={C.inkSoft}
              value={declineComment}
              onChangeText={setDeclineComment}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={m.actions}>
              <TouchableOpacity
                style={m.btnCancel}
                onPress={() => { setDeclineModal({ visible: false, requestId: '' }); setDeclineComment(''); }}
              >
                <Text style={m.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.btnDecline} onPress={handleDeclineSubmit}>
                <Text style={m.btnDeclineText}>Decline Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.mist },
  tabBar:      { flexDirection: 'row', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  tab:         { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
  tabActive:   {},
  tabLabel:    { fontSize: 13, fontWeight: '500', color: C.inkMid },
  tabLabelActive: { color: C.forest, fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 16, right: 16, height: 2, backgroundColor: C.forest, borderRadius: 1 },
  badge:       { color: C.amber, fontWeight: '700' },
  loader:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText:  { color: C.inkMid, fontSize: 14 },
  list:        { padding: 16, paddingBottom: 40, gap: 12 },
  empty:       { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon:   { fontSize: 44 },
  emptyTitle:  { fontSize: 17, fontWeight: '700', color: C.ink },
  emptyBody:   { fontSize: 13, color: C.inkMid, textAlign: 'center' },
  card:        { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16, gap: 10 },
  cardRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  courseName:  { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 2 },
  professorName:{ fontSize: 12, color: C.inkMid },
  chip:        { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  chipText:    { fontSize: 11, fontWeight: '700' },
  reasonBox:   { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: C.amber },
  reasonLabel: { fontSize: 11, fontWeight: '700', color: C.amber, marginBottom: 4 },
  reasonText:  { fontSize: 13, color: C.ink, lineHeight: 18 },
  fileRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fileIcon:    { fontSize: 14 },
  fileName:    { fontSize: 12, color: C.blue },
  dateText:    { fontSize: 11, color: C.inkSoft },
  actions:     { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 4 },
  btn:         { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnApprove:  { backgroundColor: C.forest },
  btnApproveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnDecline:  { backgroundColor: C.redBg, borderWidth: 1, borderColor: C.red },
  btnDeclineText: { color: C.red, fontWeight: '700', fontSize: 13 },
  btnLock:     { backgroundColor: C.blue },
  metaRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaItem:    { fontSize: 11, color: C.inkMid, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  lockedNotice:{ flex: 1, backgroundColor: C.blueBg, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, justifyContent: 'center' },
  lockedNoticeText: { fontSize: 12, color: C.blue, fontWeight: '600' },
});

const m = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal:    { backgroundColor: C.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, gap: 14 },
  title:    { fontSize: 17, fontWeight: '800', color: C.ink },
  body:     { fontSize: 13, color: C.inkMid, lineHeight: 19 },
  input:    {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    padding: 12, fontSize: 13, color: C.ink, minHeight: 100,
  },
  actions:  { flexDirection: 'row', gap: 10 },
  btnCancel:{ flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#F3F4F6' },
  btnCancelText: { fontWeight: '600', color: C.inkMid, fontSize: 13 },
  btnDecline: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: C.red },
  btnDeclineText: { fontWeight: '700', color: '#fff', fontSize: 13 },
});

export default AdminSyllabusScreen;
