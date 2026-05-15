import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../theme';

const NAV_ITEMS = [
  { name: 'Home', icon: '🏠', screen: 'Home' },
  { name: 'Courses', icon: '📚', screen: 'Courses' },
  { name: 'Students', icon: '👩‍🎓', screen: 'Students' },
  { name: 'Quality Control', icon: '🔍', screen: 'QualityControl' },
  { name: 'Warnings', icon: '⚠️', screen: 'Warnings' },
  { name: 'Profile', icon: '👤', screen: 'Profile' },
];

interface Props extends DrawerContentComponentProps {
  onLogout: () => void;
}

const Sidebar: React.FC<Props> = ({ navigation, state, onLogout }) => {
  const activeRoute = state.routes[state.index]?.name;

  return (
    <DrawerContentScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={['#0D3D25', '#1A5C38', '#2E7D52', '#3A8F5F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.brand}>
        <Text style={styles.brandIcon}>✋</Text>
        <Text style={styles.brandText}>High Five</Text>
      </View>

      <View style={styles.navItems}>
        {NAV_ITEMS.map(item => {
          const isActive = activeRoute === item.screen;
          return (
            <TouchableOpacity
              key={item.screen}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => navigation.navigate(item.screen)}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.navIcon}>⚙️</Text>
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navItem, styles.logoutItem]} onPress={onLogout}>
          <Text style={styles.navIcon}>🚪</Text>
          <Text style={[styles.navLabel, styles.logoutLabel]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, paddingTop: Spacing.xl, gap: Spacing.sm },
  brandIcon: { fontSize: 28 },
  brandText: { ...Typography.heading1, color: Colors.white, fontSize: 20 },
  navItems: { paddingHorizontal: Spacing.sm, flex: 1 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 12, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, marginBottom: 2,
  },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  navIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  navLabel: { ...Typography.body, color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  navLabelActive: { color: Colors.white, fontWeight: '500' },
  bottom: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingHorizontal: Spacing.sm, paddingBottom: Spacing.lg, paddingTop: Spacing.sm },
  logoutItem: {},
  logoutLabel: { color: 'rgba(255,255,255,0.6)' },
});

export default Sidebar;
