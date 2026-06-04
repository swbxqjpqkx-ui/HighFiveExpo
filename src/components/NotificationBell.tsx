import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ProfessorNotification, routeForNotifType } from '../services/notificationService';
import { Colors, Typography, Spacing, Radius, Green, Ink } from '../theme';

interface Props {
  notifications: ProfessorNotification[];
  loading?: boolean;
  error?: string | null;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onMarkAll: () => void;
  onRefresh?: () => void;
  onSeeFull?: (n: ProfessorNotification) => void;
  onNavReady?: (nav: any) => void;
  // Resolver that decides whether a type has a destination (controls the "See full
  // version" hint). Defaults to the professor resolver; the admin bell passes its
  // own so the same component serves both account types without duplication.
  routeForType?: (type: string) => string | null;
}

// Icon + accent colour per notification type.
const META: Record<string, { icon: string; color: string }> = {
  approved:            { icon: '✅', color: Green[700] },
  declined:            { icon: '✕',  color: Colors.red },
  changes_requested:   { icon: '✏️', color: '#6D28D9' },
  submission_received: { icon: '📄', color: '#1D4ED8' },
  resubmitted:         { icon: '🔄', color: '#1D4ED8' },
  task_assigned:       { icon: '📋', color: Green[700] },
  overlap_detected:    { icon: '⚠️', color: '#92600A' },
  student_at_risk:     { icon: '🚨', color: Colors.red },
  new_article:         { icon: '📰', color: '#1D4ED8' },
  calendar_reminder:   { icon: '📅', color: Green[700] },
  approval_sent:       { icon: '📤', color: Green[700] },
  calendar_event:      { icon: '📅', color: '#1D4ED8' },
  student_serious:     { icon: '🚨', color: Colors.red },
  open_day_update:     { icon: '🎓', color: Green[700] },
};

const fmtTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const NotificationBell: React.FC<Props> = ({
  notifications, loading, error, onRead, onDelete, onMarkAll, onRefresh, onSeeFull, onNavReady,
  routeForType = routeForNotifType,
}) => {
  const navigation = useNavigation<any>();
  const [visible, setVisible] = useState(false);
  const unread = notifications.filter(n => !n.read).length;

  // Expose the drawer navigation object upward so the on-page banner (rendered
  // outside the navigator) can route when its body is tapped.
  useEffect(() => { onNavReady?.(navigation); }, [navigation, onNavReady]);

  const open = () => {
    setVisible(true);
    onRefresh?.(); // refresh on open, but DO NOT mark anything read here
  };

  // "See full version": mark this one read, then hand it to the parent, which
  // routes to the EXACT entity (course+tab / student) and shows the page banner.
  const handleSeeFull = (n: ProfessorNotification) => {
    if (!n.read) onRead(n.id); // read only on explicit click
    setVisible(false);
    onSeeFull?.(n);
  };

  return (
    <>
      <TouchableOpacity style={styles.bell} onPress={open} activeOpacity={0.7}>
        <Text style={styles.icon}>🔔</Text>
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)} />
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.panelTitle}>Notifications</Text>
            {unread > 0 && (
              <TouchableOpacity onPress={onMarkAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.markAll}>Mark all as read</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={Green[500]} />
            </View>
          ) : error ? (
            <View style={styles.stateBox}>
              <Text style={styles.errText}>{error}</Text>
              {onRefresh && (
                <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={n => n.id}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => {
                const meta = META[item.type] ?? { icon: '🔔', color: Ink.base };
                return (
                  <View style={[styles.item, !item.read && styles.unread]}>
                    <TouchableOpacity
                      style={styles.itemMain}
                      activeOpacity={0.75}
                      onPress={() => handleSeeFull(item)}
                    >
                      <View style={[styles.iconWrap, { backgroundColor: meta.color + '18' }]}>
                        <Text style={styles.itemIcon}>{meta.icon}</Text>
                      </View>
                      <View style={styles.itemBody}>
                        <View style={styles.itemTopRow}>
                          <Text style={[styles.itemTitle, !item.read && styles.itemTitleUnread]} numberOfLines={1}>
                            {item.title || 'Notification'}
                          </Text>
                          <Text style={styles.itemTime}>{fmtTime(item.created_at)}</Text>
                        </View>
                        {!!item.message && (
                          <Text style={styles.itemMsg} numberOfLines={2}>{item.message}</Text>
                        )}
                        {!!routeForType(item.type) && (
                          <Text style={[styles.seeDetails, { color: meta.color }]}>See full version ›</Text>
                        )}
                      </View>
                      {!item.read && <View style={[styles.dot, { backgroundColor: meta.color }]} />}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDelete(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.deleteBtn}
                    >
                      <Text style={styles.deleteIcon}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.stateBox}>
                  <Text style={styles.emptyIcon}>🔔</Text>
                  <Text style={styles.emptyText}>You're all caught up</Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bell: { padding: Spacing.sm, position: 'relative' },
  icon: { fontSize: 22 },
  badge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: Colors.red, borderRadius: 10,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)' },
  panel: {
    position: 'absolute', top: 60, right: 16,
    width: 340, backgroundColor: Colors.white,
    borderRadius: Radius.md, paddingVertical: Spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  panelTitle: { ...Typography.heading2 },
  markAll: { fontSize: 12, color: Green[700], fontWeight: '700' },

  stateBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 8 },
  emptyIcon: { fontSize: 32, opacity: 0.5 },
  emptyText: { ...Typography.body, color: Ink[3] },
  errText: { ...Typography.body, color: Colors.red, textAlign: 'center', paddingHorizontal: 16 },
  retryBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: Green[50] },
  retryText: { color: Green[700], fontWeight: '700', fontSize: 12 },

  item: { flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: Colors.border },
  unread: { backgroundColor: '#F0F7F3' },
  itemMain: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: Spacing.sm, paddingLeft: Spacing.md,
  },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  itemIcon: { fontSize: 15 },
  itemBody: { flex: 1, gap: 3 },
  itemTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemTitle: { fontSize: 13, fontWeight: '600', color: Ink[3], flex: 1, marginRight: 6 },
  itemTitleUnread: { fontWeight: '800', color: Ink.base },
  itemTime: { fontSize: 11, color: Ink[4] },
  itemMsg: { fontSize: 12, color: Ink[3], lineHeight: 17 },
  seeDetails: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  deleteBtn: { paddingHorizontal: 12, paddingTop: Spacing.sm + 2 },
  deleteIcon: { fontSize: 13, opacity: 0.4 },
});

export default NotificationBell;
