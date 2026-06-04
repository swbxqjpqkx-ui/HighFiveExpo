import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Polyline, Line, Circle, Polygon } from 'react-native-svg';
import { AdminDrawerParamList, Profile } from '../types';
import NotificationBell from '../components/NotificationBell';
import FullNotificationBanner from '../components/FullNotificationBanner';
import {
  getNotificationsForUser, markNotificationRead, markAllNotificationsRead,
  deleteNotification, getAdminNotificationDestination, adminRouteForNotifType,
  ProfessorNotification,
} from '../services/notificationService';
import StudentListScreen from '../screens/StudentListScreen';
import AdminDashboard from '../screens/admin/AdminDashboard';
import AdminStatsScreen from '../screens/admin/AdminStatsScreen';
import AdminOpenDayScreen from '../screens/admin/AdminOpenDayScreen';
import AdminCalendarScreen from '../screens/admin/AdminCalendarScreen';
import AdminTasksScreen from '../screens/admin/AdminTasksScreen';
import AdminNewsScreen from '../screens/admin/AdminNewsScreen';
import AdminAccreditationScreen from '../screens/admin/AdminAccreditationScreen';
import AssignCoursesScreen from '../screens/admin/AssignCoursesScreen';
import AdminStudentCoordinationScreen from '../screens/admin/AdminStudentCoordinationScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { Colors, Green, Ink, Typography, Spacing, Radius } from '../theme';

const Drawer = createDrawerNavigator<AdminDrawerParamList>();

// ── SVG Icon components ───────────────────────────────────────────────────────
const ICON_COLOR = '#b6d4c2';
const ICON_SIZE  = 18;

const IcoHome = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M9 21V12h6v9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IcoBarChart = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="12" width="4" height="9" rx="1" stroke={color} strokeWidth={1.8} strokeLinejoin="round"/>
    <Rect x="10" y="7" width="4" height="14" rx="1" stroke={color} strokeWidth={1.8} strokeLinejoin="round"/>
    <Rect x="17" y="3" width="4" height="18" rx="1" stroke={color} strokeWidth={1.8} strokeLinejoin="round"/>
  </Svg>
);

const IcoUsers = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IcoFolder = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IcoCalendar = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
    <Line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
    <Line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
  </Svg>
);

const IcoCheck = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Polyline points="14 2 14 8 20 8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Line x1="9" y1="13" x2="15" y2="13" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
    <Line x1="9" y1="17" x2="15" y2="17" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
    <Polyline points="9 9 10 9 11 9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IcoNewspaper = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 22h14a2 2 0 002-2V7.5L14.5 2H6a2 2 0 00-2 2v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Polyline points="14 2 14 8 20 8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M2 15h10M2 11h10M2 19h6" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
  </Svg>
);

const IcoUser = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IcoSettings = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IcoLogout = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Polyline points="16 17 21 12 16 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Line x1="21" y1="12" x2="9" y2="12" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
  </Svg>
);

const IcoPyramid = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Polygon points="12 2 22 20 2 20" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Line x1="12" y1="2" x2="12" y2="20" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
    <Line x1="2" y1="20" x2="22" y2="20" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
  </Svg>
);

// Brand mark — 5-bar high-five glyph
const BrandMark = () => (
  <View style={sb.brandMark}>
    <LinearGradient
      colors={['#46c98e', '#2aa274', '#1f7a52']}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Rect x="3"    y="9" width="2.6" height="11" rx="1.3" fill="#0a1f17"/>
      <Rect x="6.8"  y="6" width="2.6" height="14" rx="1.3" fill="#0a1f17"/>
      <Rect x="10.7" y="3" width="2.6" height="17" rx="1.3" fill="#0a1f17"/>
      <Rect x="14.6" y="6" width="2.6" height="14" rx="1.3" fill="#0a1f17"/>
      <Rect x="18.4" y="9" width="2.6" height="11" rx="1.3" fill="#0a1f17"/>
    </Svg>
  </View>
);

// ── Nav item config ───────────────────────────────────────────────────────────
type NavItem = { name: string; label: string; Icon: React.FC<{ color?: string; size?: number }> };

const MAIN_NAV: NavItem[] = [
  { name: 'AdminDashboard',            label: 'Home',                 Icon: IcoHome      },
  { name: 'AdminStats',                label: 'Statistics',           Icon: IcoBarChart  },
  { name: 'AdminStudentCoordination',  label: 'Student Coordination', Icon: IcoUsers     },
  { name: 'AdminStudentList',          label: 'Student List',         Icon: IcoUsers     },
  { name: 'AdminAccreditation',        label: 'Material Management',  Icon: IcoFolder    },
  { name: 'AdminOpenDay',              label: 'Open Day',             Icon: IcoPyramid   },
  { name: 'AdminCalendar',             label: 'Calendar',             Icon: IcoCalendar  },
  { name: 'AdminTasks',                label: 'Tasks',                Icon: IcoCheck     },
  { name: 'AdminNews',                 label: 'News',                 Icon: IcoNewspaper },
];

const BOTTOM_NAV: NavItem[] = [
  { name: 'AdminProfile',  label: 'Profile',  Icon: IcoUser     },
  { name: 'AdminSettings', label: 'Settings', Icon: IcoSettings },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────
interface SidebarProps extends DrawerContentComponentProps {
  onLogout: () => void;
}

const AdminSidebar: React.FC<SidebarProps> = ({ navigation, state, onLogout }) => {
  const activeRoute = state.routes[state.index]?.name;

  const NavRow = ({ item, isBottom = false }: { item: NavItem; isBottom?: boolean }) => {
    const isActive = activeRoute === item.name;
    const iconColor = isActive ? '#ffffff' : '#b6d4c2';
    return (
      <TouchableOpacity
        style={[sb.navItem, isActive && sb.navItemActive]}
        onPress={() => navigation.navigate(item.name as any)}
        activeOpacity={0.7}
      >
        {isActive && (
          <LinearGradient
            colors={['rgba(70,201,142,0.18)', 'rgba(70,201,142,0.04)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 11 }]}
          />
        )}
        <View style={sb.navIcon}>
          <item.Icon color={iconColor} size={17} />
        </View>
        <Text style={[sb.navLabel, isActive && sb.navLabelActive]}>{item.label}</Text>
        {isActive && <View style={sb.activeBar} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={sb.wrap}>
      {/* Brand block */}
      <View style={sb.brand}>
        <BrandMark />
        <View style={{ marginLeft: 10 }}>
          <Text style={sb.brandName}>HIGH FIVE</Text>
          <Text style={sb.brandSub}>Admin Panel</Text>
        </View>
      </View>

      {/* Group label */}
      <Text style={sb.groupLabel}>WORKSPACE</Text>

      {/* Main nav */}
      <DrawerContentScrollView
        style={{ flex: 1 }}
        contentContainerStyle={sb.navList}
        showsVerticalScrollIndicator={false}
      >
        {MAIN_NAV.map(item => <NavRow key={item.name} item={item} />)}
      </DrawerContentScrollView>

      {/* Bottom nav */}
      <View style={sb.bottom}>
        <View style={sb.divider} />
        {BOTTOM_NAV.map(item => <NavRow key={item.name} item={item} />)}
        <TouchableOpacity style={sb.navItem} onPress={onLogout} activeOpacity={0.7}>
          <View style={sb.navIcon}><IcoLogout color="#b6d4c2" size={17} /></View>
          <Text style={[sb.navLabel, sb.logoutLabel]}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Navigator ─────────────────────────────────────────────────────────────────
interface Props {
  profile: Profile;
  onLogout: () => void;
}

const AdminNavigator: React.FC<Props> = ({ profile, onLogout }) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 1024;

  const initials = profile.full_name
    ? profile.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  // ── Admin notifications ───────────────────────────────────────────────────────
  // Reuses the SAME bell + banner + algorithm as the professor side. Admin-only:
  // the fetch is by this admin's user_id, so professor notifications never appear
  // here and admin notifications never appear on the professor side.
  const [notifications, setNotifications] = useState<ProfessorNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [fullNotif, setFullNotif] = useState<ProfessorNotification | null>(null);
  const [currentRoute, setCurrentRoute] = useState<string | null>(null);
  // Id of a notification that has been opened and is waiting to be removed — only
  // AFTER its full-details banner is actually visible on the redirected page (not
  // while it's just a preview in the list).
  const [pendingDismissId, setPendingDismissId] = useState<string | null>(null);
  // When an overlap notification is opened, this nonce tells the Material Management
  // screen to switch to its Overlap Review tab. Bumped on each overlap open.
  const [overlapFocusNonce, setOverlapFocusNonce] = useState<number | undefined>(undefined);
  const drawerNavRef = useRef<any>(null);

  const loadNotifications = useCallback(async () => {
    setNotifError(null);
    try { setNotifications(await getNotificationsForUser(profile.id)); }
    catch { setNotifError('Could not load notifications.'); }
    finally { setNotifLoading(false); }
  }, [profile.id]);

  useEffect(() => {
    loadNotifications();
    const t = setInterval(loadNotifications, 60000);
    return () => clearInterval(t);
  }, [loadNotifications]);

  const handleReadNotification = async (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    try { await markNotificationRead(id); } catch { loadNotifications(); }
  };
  const handleDeleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try { await deleteNotification(id); } catch { loadNotifications(); }
  };
  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try { await markAllNotificationsRead(profile.id); } catch { loadNotifications(); }
  };

  // Redirect to the admin page this notification points at. Returns true when a
  // redirect was dispatched.
  const navigateToNotification = useCallback(async (n: ProfessorNotification): Promise<boolean> => {
    const dest = getAdminNotificationDestination(n);
    if (dest.focus?.kind === 'overlap') setOverlapFocusNonce(Date.now());
    if (dest.route && drawerNavRef.current) {
      try { drawerNavRef.current.dispatch(DrawerActions.jumpTo(dest.route)); return true; }
      catch { return false; }
    }
    return false;
  }, []);

  // After opening: remove from the visible list (local) + persist read on the
  // existing `read` column. The manual trash icon stays the only path that deletes.
  const dismissOpenedNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try { await markNotificationRead(id); } catch { /* best-effort */ }
  }, []);

  // Bell card tap → show the banner + redirect. The notification is NOT removed
  // here; it is only marked for removal and actually disappears once its full
  // details are visible on the redirected page (see the effect below).
  const handleSeeFull = async (n: ProfessorNotification) => {
    try {
      setFullNotif(n);
      setPendingDismissId(n.id);       // remove only after full details open
      await navigateToNotification(n); // redirect to the connected page
    } catch (error) { console.error('Failed to open notification details', error); }
  };
  const handleCloseFull = () => setFullNotif(null);
  const handleDeleteFull = async () => {
    if (!fullNotif) return;
    const id = fullNotif.id;
    setFullNotif(null);
    setPendingDismissId(null);
    setNotifications(prev => prev.filter(n => n.id !== id));
    try { await deleteNotification(id); } catch { loadNotifications(); }
  };
  const handleOpenFull = async () => {
    if (!fullNotif) return;
    try {
      setPendingDismissId(fullNotif.id);     // re-arm in case it was closed earlier
      await navigateToNotification(fullNotif);
    } catch (error) { console.error('Failed to open notification details', error); }
  };

  // Remove the opened notification from the list + badge ONLY after its full-details
  // banner is actually visible on the redirected page (currentRoute matches the
  // notification's destination). This guarantees it disappears after a successful
  // redirected open — never while it is only previewed in the list. Admin-only.
  useEffect(() => {
    if (!fullNotif || !pendingDismissId || fullNotif.id !== pendingDismissId) return;
    if (currentRoute === adminRouteForNotifType(fullNotif.type)) {
      setPendingDismissId(null);
      dismissOpenedNotification(fullNotif.id);
    }
  }, [currentRoute, fullNotif, pendingDismissId, dismissOpenedNotification]);

  const headerRight = () => (
    <NotificationBell
      notifications={notifications}
      loading={notifLoading}
      error={notifError}
      onRead={handleReadNotification}
      onDelete={handleDeleteNotification}
      onMarkAll={handleMarkAllRead}
      onRefresh={loadNotifications}
      onSeeFull={handleSeeFull}
      onNavReady={nav => { drawerNavRef.current = nav; }}
      routeForType={adminRouteForNotifType}
    />
  );

  const showBanner = !!fullNotif && currentRoute === adminRouteForNotifType(fullNotif.type);
  const headerH = insets.top + (isWide ? 64 : 56);

  return (
    <View style={{ flex: 1 }}>
    <Drawer.Navigator
      drawerContent={props => <AdminSidebar {...props} onLogout={onLogout} />}
      screenListeners={{
        state: (e: any) => {
          const st = e?.data?.state;
          if (st && typeof st.index === 'number') {
            const name = st.routes?.[st.index]?.name;
            if (name) setCurrentRoute(name);
          }
        },
      }}
      screenOptions={{
        drawerType: isWide ? 'permanent' : 'front',
        drawerStyle: { width: 260, backgroundColor: Green[900] },
        headerStyle: { backgroundColor: Ink.surface, borderBottomColor: Ink.line, borderBottomWidth: 1 },
        headerTintColor: Green[700],
        overlayColor: 'rgba(0,0,0,0.35)',
        headerRight,
        headerTitle: () => (
          <View style={hdr.row}>
            <View style={hdr.avatar}>
              <Text style={hdr.avatarText}>{initials}</Text>
            </View>
            <View>
              <Text style={hdr.name}>{profile.full_name}</Text>
              <View style={hdr.pill}>
                <Text style={hdr.pillText}>Admin</Text>
              </View>
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
      <Drawer.Screen name="AdminStudentCoordination" options={{ title: 'Student Coordination' }}>
        {() => <AdminStudentCoordinationScreen />}
      </Drawer.Screen>
      <Drawer.Screen name="AdminStudentList" options={{ title: 'Student List' }}>
        {() => <StudentListScreen profile={profile} courses={[]} />}
      </Drawer.Screen>
      <Drawer.Screen name="AdminAccreditation" options={{ title: 'Material Management' }}>
        {() => <AdminAccreditationScreen profile={profile} overlapFocusNonce={overlapFocusNonce} />}
      </Drawer.Screen>
      <Drawer.Screen name="AdminOpenDay" options={{ title: 'Open Day' }}>
        {() => <AdminOpenDayScreen profile={profile} />}
      </Drawer.Screen>
      <Drawer.Screen name="AdminCalendar" options={{ title: 'Calendar' }}>
        {() => <AdminCalendarScreen />}
      </Drawer.Screen>
      <Drawer.Screen name="AdminTasks" options={{ title: 'Tasks' }}>
        {() => <AdminTasksScreen />}
      </Drawer.Screen>
      <Drawer.Screen name="AdminNews" options={{ title: 'News' }}>
        {() => <AdminNewsScreen profile={profile} />}
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

      {/* Full notification shown on its connected page, below the header. */}
      {showBanner && fullNotif && (
        <View
          style={[banner.wrap, { top: headerH + 8, left: isWide ? 260 : 0 }]}
          pointerEvents="box-none"
        >
          <FullNotificationBanner
            notification={fullNotif}
            onClose={handleCloseFull}
            onDelete={handleDeleteFull}
            onPress={handleOpenFull}
            routeForType={adminRouteForNotifType}
          />
        </View>
      )}
    </View>
  );
};

const banner = StyleSheet.create({
  wrap: { position: 'absolute', right: 0, paddingHorizontal: 16 },
});

// ── Styles ────────────────────────────────────────────────────────────────────
const sb = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: Green[900],
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 14,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontFamily: 'Montserrat-ExtraBold',
    fontSize: 18,
    color: '#ffffff',
    letterSpacing: 1.44,
    textTransform: 'uppercase',
  },
  brandSub: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 10.5,
    color: Green[300],
    letterSpacing: 1.47,
    textTransform: 'uppercase',
    marginTop: 5,
  },
  groupLabel: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10.5,
    color: '#5b8a72',
    letterSpacing: 1.47,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  navList: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 11,
    marginBottom: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  navItemActive: {
    borderWidth: 1,
    borderColor: 'rgba(70,201,142,0.25)',
  },
  navIcon: {
    width: 22,
    alignItems: 'center',
  },
  navLabel: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 13.5,
    color: '#b6d4c2',
    marginLeft: 10,
    flex: 1,
  },
  navLabelActive: {
    color: '#ffffff',
    fontFamily: 'Montserrat-SemiBold',
  },
  activeBar: {
    position: 'absolute',
    left: -8,
    top: '20%',
    width: 3,
    height: '60%',
    backgroundColor: Green[400],
    borderRadius: 2,
  },
  bottom: {
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 10,
  },
  logoutLabel: {
    color: 'rgba(182,212,194,0.6)',
  },
});

const hdr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Green[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 13,
    color: '#ffffff',
  },
  name: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 13,
    color: Ink.base,
    letterSpacing: -0.1,
  },
  pill: {
    marginTop: 2,
    backgroundColor: Green[100],
    borderWidth: 1,
    borderColor: Green[200],
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 10,
    color: Green[800],
    letterSpacing: 0.4,
  },
});

export default AdminNavigator;
