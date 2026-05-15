import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { Notification } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface Props {
  notifications: Notification[];
  onRead: (id: string) => void;
}

const NotificationBell: React.FC<Props> = ({ notifications, onRead }) => {
  const [visible, setVisible] = useState(false);
  const unread = notifications.filter(n => !n.read).length;

  return (
    <>
      <TouchableOpacity style={styles.bell} onPress={() => setVisible(true)}>
        <Text style={styles.icon}>🔔</Text>
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread}</Text>
          </View>
        )}
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)} />
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Notifications</Text>
          <FlatList
            data={notifications}
            keyExtractor={n => n.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.notifItem, !item.read && styles.unread]}
                onPress={() => { onRead(item.id); setVisible(false); }}
              >
                <Text style={styles.notifText}>{item.message}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No notifications</Text>}
          />
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bell: { padding: Spacing.sm, position: 'relative' },
  icon: { fontSize: 22 },
  badge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: Colors.red, borderRadius: 10,
    width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: Colors.white, fontSize: 9, fontWeight: '700' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)' },
  panel: {
    position: 'absolute', top: 60, right: 16,
    width: 300, backgroundColor: Colors.white,
    borderRadius: Radius.md, padding: Spacing.md,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  panelTitle: { ...Typography.heading2, marginBottom: Spacing.sm },
  notifItem: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  unread: { backgroundColor: Colors.mist },
  notifText: { ...Typography.body, color: Colors.ink },
  empty: { ...Typography.body, textAlign: 'center', paddingVertical: Spacing.md },
});

export default NotificationBell;
