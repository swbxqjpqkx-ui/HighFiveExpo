import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, ScrollView } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { LinearGradient } from 'expo-linear-gradient';
import { AdminDrawerParamList, Profile } from '../types';
import AdminDashboard from '../screens/admin/AdminDashboard';
import AdminStatsScreen from '../screens/admin/AdminStatsScreen';
import AdminProfessorsScreen from '../screens/admin/AdminProfessorsScreen';
import AdminOpenDayScreen from '../screens/admin/AdminOpenDayScreen';
import AdminCalendarScreen from '../screens/admin/AdminCalendarScreen';
import AdminTasksScreen from '../screens/admin/AdminTasksScreen';
import AdminNewsScreen from '../screens/admin/AdminNewsScreen';
import AssignCoursesScreen from '../screens/admin/AssignCoursesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { Colors, Typography, Spacing, Radius } from '../theme';

const Drawer = createDrawerNavigator<AdminDrawerParamList>();

const MAIN_NAV = [
  { name: 'AdminDashboard',  label: 'Home',           icon: '🏠' },
  { name: 'AdminStats',      label: 'Statistics',     icon: '📊' },
  { name: 'AdminProfessors', label: 'Professors',     icon: '👩‍🏫' },
  { name: 'AdminOpenDay',    label: 'Open Day',       icon: '🎟️' },
  { name: 'AdminCalendar',   label: 'Calendar',       icon: '📅' },
  { name: 'AdminTasks',      label: 'Tasks',          icon: '✅' },
  { name: 'AdminNews',       label: 'News',           icon: '📰' },
  { name: 'AssignCourses',   label: 'Assign Courses', icon: '🎓' },
];

const BOTTOM_NAV = [
  { name: 'AdminSettings', label: 'Settings', icon: '⚙️' },
  { name: 'AdminProfile',  label: 'Profile',  icon: '👤' },
];

interface SidebarProps extends DrawerContentComponentProps {
  onLogout: () => void;
}

const AdminSidebar: React.FC<SidebarProps> = ({ navigation, state, onLogout }) => {
  const activeRoute = state.routes[state.index]?.name;

  return (
    <View style={styles.sidebarWrap}>
      <LinearGradient
        colors={['#0D3D25', '#1A5C38', '#2E7D52', '#3A8F5F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Brand */}
      <View style={styles.brand}>
        <Text style={styles.brandIcon}>✋</Text>
        <View>
          <Text style={styles.brandText}>HIGH FIVE</Text>
          <Text style={styles.brandRole}>Admin Panel</Text>
        </View>
      </View>

      {/* Workspace label */}
      <Text style={styles.sectionLabel}>WORKSPACE</Text>

      {/* Main nav */}
      <DrawerContentScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {MAIN_NAV.map(item => {
          const isActive = activeRoute === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => navigation.navigate(item.name as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
              {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </DrawerContentScrollView>

      {/* Bottom nav */}
      <View style={styles.bottom}>
        <View style={styles.divider} />
        {BOTTOM_NAV.map(item => {
          const isActive = activeRoute === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => navigation.navigate(item.name as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.navItem} onPress={onLogout} activeOpacity={0.7}>
          <Text style={styles.navIcon}>🚪</Text>
          <Text style={[styles.navLabel, styles.logoutLabel]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface Props {
  profile: Profile;
  onLogout: () => void;
}

const AdminNavigator: React.FC<Props> = ({ profile, onLogout }) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;

  return (
    <Drawer.Navigator
      drawerContent={props => <AdminSidebar {...props} onLogout={onLogout} />}
      screenOptions={{
        drawerType: isWide ? 'permanent' : 'front',
        drawerStyle: { width: 240, backgroundColor: 'transparent' },
        headerStyle: { backgroundColor: Colors.white, borderBottomColor: Colors.border, borderBottomWidth: 1 },
        headerTintColor: Colors.forest,
        overlayColor: 'rgba(0,0,0,0.3)',
        headerTitle: () => (
          <View style={headerStyles.titleRow}>
            <Text style={headerStyles.name}>{profile.full_name}</Text>
            <View style={headerStyles.badge}>
              <Text style={headerStyles.badgeText}>🛡️ Admin</Text>
            </View>
          </View>
        ),
      }}
    >
      <Drawer.Screen name="AdminDashboard" options={{ title: 'Dashboard' }}>
        {() => <AdminDashboard profile={profile} />}
      </Drawer.Screen>
      <Drawer.Screen name="AdminStats" options={{ title: 'Statistics' }}>
        {() => <AdminStatsScreen />}
      </Drawer.Screen>
      <Drawer.Screen name="AdminProfessors" options={{ title: 'Professors' }}>
        {() => <AdminProfessorsScreen />}
      </Drawer.Screen>
      <Drawer.Screen name="AdminOpenDay" options={{ title: 'Open Day' }}>
        {() => <AdminOpenDayScreen />}
      </Drawer.Screen>
      <Drawer.Screen name="AdminCalendar" options={{ title: 'Calendar' }}>
        {() => <AdminCalendarScreen />}
      </Drawer.Screen>
      <Drawer.Screen name="AdminTasks" options={{ title: 'Tasks' }}>
        {() => <AdminTasksScreen />}
      </Drawer.Screen>
      <Drawer.Screen name="AdminNews" options={{ title: 'News' }}>
        {() => <AdminNewsScreen />}
      </Drawer.Screen>
      <Drawer.Screen name="AssignCourses" options={{ title: 'Assign Courses' }}>
        {() => <AssignCoursesScreen />}
      </Drawer.Screen>
      <Drawer.Screen name="AdminSettings" options={{ title: 'Settings' }}>
        {() => <SettingsScreen />}
      </Drawer.Screen>
      <Drawer.Screen name="AdminProfile" options={{ title: 'Profile' }}>
        {() => <ProfileScreen profile={profile} courses={[]} />}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  sidebarWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  brand: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.lg, paddingTop: Spacing.xl + 4, gap: Spacing.sm,
  },
  brandIcon: { fontSize: 28 },
  brandText: { ...Typography.heading1, color: Colors.white, fontSize: 18, letterSpacing: 1 },
  brandRole: { ...Typography.body, color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 1 },
  sectionLabel: {
    ...Typography.label,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    letterSpacing: 1.2,
    paddingHorizontal: Spacing.md,
    marginBottom: 6,
    marginTop: 4,
  },
  navScroll: { flex: 1 },
  navScrollContent: { paddingHorizontal: Spacing.sm, paddingBottom: 8 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 11, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm,
    marginBottom: 2, position: 'relative',
  },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  navIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  navLabel: { ...Typography.body, color: 'rgba(255,255,255,0.72)', fontSize: 13, flex: 1 },
  navLabelActive: { color: Colors.white, fontWeight: '600' },
  activeIndicator: {
    width: 3, height: '70%', backgroundColor: Colors.white,
    borderRadius: 2, position: 'absolute', right: 4,
  },
  bottom: {
    paddingHorizontal: Spacing.sm, paddingBottom: Spacing.xl, paddingTop: 0,
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: Spacing.sm },
  logoutLabel: { color: 'rgba(255,255,255,0.55)' },
});

const headerStyles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:     { fontSize: 15, fontWeight: '700', color: Colors.ink },
  badge:    {
    backgroundColor: Colors.forest + '15', borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.forest + '30',
  },
  badgeText:{ fontSize: 11, fontWeight: '600', color: Colors.forest },
});

export default AdminNavigator;
