import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ProfessorNotification, notifTypeLabel, routeForNotifType } from '../services/notificationService';
import { Green, Ink, Tint, Radius, Shadow } from '../theme';

interface Props {
  notification: ProfessorNotification;
  onClose: () => void;   // hide the card, keep the record
  onDelete: () => void;  // delete the notification record only
  onPress?: () => void;  // open the connected page/details for this notification
  // Resolver that decides whether this type has a destination (controls the "Open
  // details" hint). Defaults to the professor resolver; the admin banner passes its
  // own so the same card serves both account types without duplication.
  routeForType?: (type: string) => string | null;
}

// Icon + accent per type (mirrors the dropdown for visual consistency).
const META: Record<string, { icon: string; color: string }> = {
  approved:            { icon: '✅', color: Green[700] },
  declined:            { icon: '✕',  color: Tint.rose.ink },
  changes_requested:   { icon: '✏️', color: Tint.violet.ink },
  submission_received: { icon: '📄', color: Tint.sky.ink },
  resubmitted:         { icon: '🔄', color: Tint.sky.ink },
  task_assigned:       { icon: '📋', color: Green[700] },
  overlap_detected:    { icon: '⚠️', color: Tint.sun.ink },
  student_at_risk:     { icon: '🚨', color: Tint.rose.ink },
  new_article:         { icon: '📰', color: Tint.sky.ink },
  calendar_reminder:   { icon: '📅', color: Green[700] },
  approval_sent:       { icon: '📤', color: Green[700] },
  calendar_event:      { icon: '📅', color: Tint.sky.ink },
  student_serious:     { icon: '🚨', color: Tint.rose.ink },
  open_day_update:     { icon: '🎓', color: Green[700] },
};

const fmtDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const FullNotificationBanner: React.FC<Props> = ({
  notification, onClose, onDelete, onPress, routeForType = routeForNotifType,
}) => {
  const meta = META[notification.type] ?? { icon: '🔔', color: Ink.base };
  const when = fmtDateTime(notification.created_at);
  const canOpen = !!onPress && !!routeForType(notification.type);

  return (
    <View style={[s.card, { borderLeftColor: meta.color }]}>
      {/* Subtle close / delete icons — rendered ON TOP as an absolute sibling so a
          tap here never reaches the pressable body underneath (no redirect). */}
      <View style={s.iconGroup}>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
          accessibilityLabel="Close notification"
        >
          <Text style={s.icon}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
          accessibilityLabel="Delete notification"
        >
          <Text style={s.icon}>🗑</Text>
        </TouchableOpacity>
      </View>

      {/* Pressable body → opens the connected page/details. */}
      <TouchableOpacity
        activeOpacity={canOpen ? 0.85 : 1}
        onPress={canOpen ? onPress : undefined}
        disabled={!canOpen}
        accessibilityRole={canOpen ? 'button' : undefined}
      >
        <View style={s.chipRow}>
          <View style={[s.chip, { backgroundColor: meta.color + '18' }]}>
            <Text style={s.chipIcon}>{meta.icon}</Text>
            <Text style={[s.chipText, { color: meta.color }]}>
              {notifTypeLabel(notification.type)}
            </Text>
          </View>
        </View>

        {!!notification.title && <Text style={s.title}>{notification.title}</Text>}
        {!!notification.message && <Text style={s.message}>{notification.message}</Text>}

        <View style={s.footerRow}>
          {!!when && <Text style={s.meta}>{when}</Text>}
          {canOpen && (
            <Text style={[s.openHint, { color: meta.color }]}>Open details ›</Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const s = StyleSheet.create({
  card: {
    backgroundColor: Ink.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Ink.line,
    borderLeftWidth: 4,
    padding: 14,
    ...Shadow.md,
  },
  iconGroup: {
    position: 'absolute',
    top: 12, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    zIndex: 2,
  },
  icon: { fontSize: 13, opacity: 0.4, color: Ink.base },

  chipRow: { flexDirection: 'row', marginBottom: 8, paddingRight: 56 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 4,
  },
  chipIcon: { fontSize: 12 },
  chipText: {
    fontSize: 10, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  title: { fontSize: 15, fontWeight: '800', color: Ink.base, marginBottom: 4 },
  message: { fontSize: 13, color: Ink[2], lineHeight: 19, marginBottom: 8 },

  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { fontSize: 11, color: Ink[3], fontWeight: '500' },
  openHint: { fontSize: 11, fontWeight: '700' },
});

export default FullNotificationBanner;
