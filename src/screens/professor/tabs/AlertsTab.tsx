import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Course, Profile } from '../../../types';
import { CourseAlert, AlertSeverity } from '../../../types/courseManagement';
import { getCourseAlerts, markAlertRead } from '../../../services/courseManagement';
import { getMockAlerts } from '../../../utils/aiPlaceholder';

const C = {
  forest: '#1A5C38', leaf: '#3A8F5F', mist: '#F2FAF5',
  ink: '#1A1A1A', inkMid: 'rgba(26,26,26,0.65)', inkSoft: 'rgba(26,26,26,0.4)',
  border: '#E0EDE6', card: '#FFFFFF', green50: '#F0F6EF',
  red: '#D9534F', redBg: '#FDF1F1', redBdr: '#F5C6C6',
  amber: '#92600A', amberBg: '#FFFBEB', amberBdr: '#FDE68A',
  blue: '#1D4ED8', blueBg: '#EFF6FF', blueBdr: '#BFDBFE',
};

const SEVERITY_META: Record<AlertSeverity, { icon: string; color: string; bg: string; border: string; label: string }> = {
  critical: { icon: '🔴', color: C.red,   bg: C.redBg,   border: C.redBdr,   label: 'Critical' },
  warning:  { icon: '🟡', color: C.amber, bg: C.amberBg, border: C.amberBdr, label: 'Warning' },
  info:     { icon: 'ℹ️', color: C.blue,  bg: C.blueBg,  border: C.blueBdr,  label: 'Info' },
};

interface Props {
  course: Course;
  profile: Profile;
}

const AlertsTab: React.FC<Props> = ({ course, profile }) => {
  const [alerts, setAlerts] = useState<CourseAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data = await getCourseAlerts(course.id, profile.id);
      if (data.length === 0) {
        data = getMockAlerts(course.id, profile.id) as CourseAlert[];
      }
      setAlerts(data);
    } catch {
      setAlerts(getMockAlerts(course.id, profile.id) as CourseAlert[]);
    } finally {
      setLoading(false);
    }
  }, [course.id, profile.id]);

  useEffect(() => { load(); }, [load]);

  const handleRead = async (id: string) => {
    await markAlertRead(id).catch(() => {});
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  };

  if (loading) {
    return <View style={s.centre}><ActivityIndicator color={C.leaf} size="large" /></View>;
  }

  const unread = alerts.filter(a => !a.read);
  const read   = alerts.filter(a => a.read);

  return (
    <ScrollView contentContainerStyle={s.content}>
      {/* Summary row */}
      <View style={s.summaryRow}>
        {(['critical', 'warning', 'info'] as AlertSeverity[]).map(sev => {
          const count = alerts.filter(a => a.severity === sev).length;
          const m = SEVERITY_META[sev];
          return (
            <View key={sev} style={[s.summaryCell, { backgroundColor: m.bg, borderColor: m.border }]}>
              <Text style={s.summaryIcon}>{m.icon}</Text>
              <Text style={[s.summaryCount, { color: m.color }]}>{count}</Text>
              <Text style={s.summaryLabel}>{m.label}</Text>
            </View>
          );
        })}
      </View>

      {alerts.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🔔</Text>
          <Text style={s.emptyTitle}>No Alerts</Text>
          <Text style={s.emptyText}>
            No alerts for this course. Alerts are generated automatically when the AI detects
            issues, overlaps, or accreditation gaps.
          </Text>
        </View>
      )}

      {/* Non-dismissible notice */}
      {alerts.some(a => !a.dismissible) && (
        <View style={s.noticeBox}>
          <Text style={s.noticeText}>
            🔒  AI-generated alerts cannot be dismissed or deleted. They remain active until the
            underlying issue is resolved through the Overlap Reports or Syllabus Check tabs.
          </Text>
        </View>
      )}

      {unread.length > 0 && (
        <>
          <Text style={s.groupLabel}>Unread ({unread.length})</Text>
          {unread.map(alert => (
            <AlertCard key={alert.id} alert={alert} onRead={() => handleRead(alert.id)} />
          ))}
        </>
      )}

      {read.length > 0 && (
        <>
          <Text style={[s.groupLabel, { marginTop: 16 }]}>Read ({read.length})</Text>
          {read.map(alert => (
            <AlertCard key={alert.id} alert={alert} onRead={() => {}} />
          ))}
        </>
      )}
    </ScrollView>
  );
};

interface AlertCardProps {
  alert: CourseAlert;
  onRead: () => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, onRead }) => {
  const m = SEVERITY_META[alert.severity];

  return (
    <TouchableOpacity
      style={[
        s.alertCard,
        { borderLeftColor: m.color, backgroundColor: alert.read ? C.card : m.bg },
      ]}
      onPress={alert.read ? undefined : onRead}
      activeOpacity={alert.read ? 1 : 0.8}
    >
      <View style={s.alertHeader}>
        <Text style={s.alertIcon}>{m.icon}</Text>
        <View style={{ flex: 1 }}>
          <View style={s.alertTitleRow}>
            {!alert.read && <View style={s.unreadDot} />}
            <Text style={[s.alertTitle, { color: m.color }]}>{alert.title}</Text>
          </View>
          <Text style={s.alertTime}>{new Date(alert.created_at).toLocaleString()}</Text>
        </View>
        {!alert.dismissible && (
          <View style={s.lockBadge}>
            <Text style={s.lockBadgeText}>🔒</Text>
          </View>
        )}
      </View>
      <Text style={s.alertMessage}>{alert.message}</Text>
      {!alert.read && (
        <TouchableOpacity style={s.readBtn} onPress={onRead}>
          <Text style={s.readBtnText}>Mark as read</Text>
        </TouchableOpacity>
      )}
      {!alert.dismissible && (
        <Text style={s.nonDismissibleNote}>
          This alert cannot be dismissed — resolve the underlying issue to clear it.
        </Text>
      )}
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  centre:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryCell: {
    flex: 1, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center', gap: 4,
  },
  summaryIcon:  { fontSize: 20 },
  summaryCount: { fontSize: 24, fontWeight: '900' },
  summaryLabel: { fontSize: 10, color: C.inkMid, fontWeight: '600', textTransform: 'uppercase' },

  noticeBox: {
    backgroundColor: '#F3F4F6', borderRadius: 8, padding: 10, marginBottom: 12,
  },
  noticeText: { fontSize: 12, color: C.inkMid, lineHeight: 17 },

  groupLabel: { fontSize: 12, fontWeight: '700', color: C.inkMid, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  empty: { alignItems: 'center', padding: 32 },
  emptyIcon:  { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 6 },
  emptyText:  { fontSize: 13, color: C.inkMid, textAlign: 'center', lineHeight: 19 },

  alertCard: {
    borderLeftWidth: 4, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  alertHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  alertIcon:    { fontSize: 20 },
  alertTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  unreadDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, flexShrink: 0 },
  alertTitle:   { fontSize: 13, fontWeight: '700', flex: 1 },
  alertTime:    { fontSize: 11, color: C.inkSoft, marginTop: 2 },
  lockBadge:    { borderRadius: 4, padding: 3 },
  lockBadgeText:{ fontSize: 12 },
  alertMessage: { fontSize: 13, color: C.ink, lineHeight: 19, marginBottom: 8 },
  readBtn:      { alignSelf: 'flex-start', borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 4 },
  readBtnText:  { fontSize: 11, color: C.inkMid, fontWeight: '600' },
  nonDismissibleNote: { fontSize: 11, color: C.inkSoft, fontStyle: 'italic' },
});

export default AlertsTab;
