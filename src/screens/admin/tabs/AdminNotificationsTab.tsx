import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import {
  getAdminNotifications, markNotificationRead,
  markAllNotificationsRead, AdminNotification, NotifType,
} from '../../../services/adminAccreditation';
import { Profile } from '../../../types';

const C = {
  forest: '#1A5C38', leaf: '#3A8F5F', mist: '#F2FAF5',
  ink: '#1A1A1A', inkMid: 'rgba(26,26,26,0.6)', inkSoft: 'rgba(26,26,26,0.38)',
  border: '#E0EDE6', card: '#FFFFFF',
  red: '#C0392B', amber: '#92600A', amberBg: '#FFFBEB',
  blue: '#1D4ED8', blueBg: '#EFF6FF', purple: '#6D28D9',
};

const NOTIF_ICON: Record<NotifType, string> = {
  submission_received: '📄',
  approved:            '✅',
  declined:            '✕',
  changes_requested:   '✏️',
  overlap_detected:    '⚠️',
  task_assigned:       '📋',
  resubmitted:         '🔄',
};

const NOTIF_COLOR: Record<NotifType, string> = {
  submission_received: C.blue,
  approved:            C.forest,
  declined:            C.red,
  changes_requested:   C.purple,
  overlap_detected:    C.amber,
  task_assigned:       C.forest,
  resubmitted:         C.blue,
};

interface Props { profile: Profile; }

const AdminNotificationsTab: React.FC<Props> = ({ profile }) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setNotifications(await getAdminNotifications(profile.id)); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }, [profile.id]);

  React.useEffect(() => { load(); }, [load]);

  const handleRead = async (n: AdminNotification) => {
    if (n.read) return;
    await markNotificationRead(n.id);
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(profile.id);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {} finally { setMarkingAll(false); }
  };

  const fmtDate = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const unread = notifications.filter(n => !n.read);
  const read   = notifications.filter(n => n.read);

  return (
    <View style={s.root}>
      {/* Top bar */}
      <View style={s.topBar}>
        <Text style={s.topBarTitle}>
          {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAll} disabled={markingAll}>
            {markingAll
              ? <ActivityIndicator size="small" color={C.forest} />
              : <Text style={s.markAllBtn}>Mark all as read</Text>}
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={C.forest} /></View>
      ) : notifications.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🔔</Text>
          <Text style={s.emptyTitle}>No notifications yet</Text>
          <Text style={s.emptyBody}>You'll see alerts here when professors submit files or the AI detects overlaps.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {unread.length > 0 && (
            <>
              <Text style={s.groupLabel}>NEW</Text>
              {unread.map(n => <NotifCard key={n.id} n={n} onPress={handleRead} fmtDate={fmtDate} />)}
            </>
          )}
          {read.length > 0 && (
            <>
              <Text style={s.groupLabel}>EARLIER</Text>
              {read.map(n => <NotifCard key={n.id} n={n} onPress={handleRead} fmtDate={fmtDate} />)}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const NotifCard: React.FC<{
  n: AdminNotification;
  onPress: (n: AdminNotification) => void;
  fmtDate: (iso: string) => string;
}> = ({ n, onPress, fmtDate }) => {
  const icon  = NOTIF_ICON[n.type] ?? '🔔';
  const color = NOTIF_COLOR[n.type] ?? C.ink;

  return (
    <TouchableOpacity
      style={[s.card, !n.read && s.cardUnread]}
      onPress={() => onPress(n)}
      activeOpacity={0.75}
    >
      <View style={[s.iconWrap, { backgroundColor: color + '18' }]}>
        <Text style={s.icon}>{icon}</Text>
      </View>
      <View style={s.cardBody}>
        <View style={s.cardRow}>
          <Text style={[s.title, !n.read && s.titleUnread]} numberOfLines={1}>{n.title}</Text>
          <Text style={s.time}>{fmtDate(n.created_at)}</Text>
        </View>
        <Text style={s.message} numberOfLines={2}>{n.message}</Text>
      </View>
      {!n.read && <View style={[s.dot, { backgroundColor: color }]} />}
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.mist },
  topBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  topBarTitle:  { fontSize: 13, fontWeight: '700', color: C.ink },
  markAllBtn:   { fontSize: 12, color: C.forest, fontWeight: '700' },
  loader:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyIcon:    { fontSize: 44 },
  emptyTitle:   { fontSize: 17, fontWeight: '700', color: C.ink },
  emptyBody:    { fontSize: 13, color: C.inkMid, textAlign: 'center', lineHeight: 19 },
  list:         { paddingVertical: 12, gap: 2, paddingBottom: 40 },
  groupLabel:   { fontSize: 10, fontWeight: '800', color: C.inkSoft, letterSpacing: 1, paddingHorizontal: 16, paddingVertical: 8 },
  card:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.card, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  cardUnread:   { backgroundColor: '#F0F7F3' },
  iconWrap:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  icon:         { fontSize: 18 },
  cardBody:     { flex: 1, gap: 4 },
  cardRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title:        { fontSize: 13, fontWeight: '600', color: C.inkMid, flex: 1, marginRight: 8 },
  titleUnread:  { fontWeight: '800', color: C.ink },
  time:         { fontSize: 11, color: C.inkSoft },
  message:      { fontSize: 12, color: C.inkMid, lineHeight: 17 },
  dot:          { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});

export default AdminNotificationsTab;
