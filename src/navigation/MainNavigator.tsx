import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerParamList, Profile, Course, TeacherStats, StudentWithEnrollments, Notification } from '../types';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import FullNotificationBanner from '../components/FullNotificationBanner';
import HomeScreen from '../screens/HomeScreen';
import CoursesScreen from '../screens/CoursesScreen';
import StudentsScreen from '../screens/StudentsScreen';
import StudentListScreen from '../screens/StudentListScreen';
import CourseManagementScreen from '../screens/professor/CourseManagementScreen';
import QualityControlScreen from '../screens/QualityControlScreen';
import WarningsScreen from '../screens/WarningsScreen';
import NewsScreen from '../screens/NewsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HomeworkAssistanceScreen from '../screens/professor/homework/HomeworkAssistanceScreen';
import ProfessorCalendarScreen from '../screens/professor/ProfessorCalendarScreen';
import {
  getProfessorNotifications, markNotificationRead, markAllNotificationsRead,
  deleteNotification, createNotificationIfNew, routeForNotifType, getNotificationDestination,
  ProfessorNotification, NotificationFocus,
} from '../services/notificationService';
import { Colors, Green, Ink } from '../theme';

const Drawer = createDrawerNavigator<DrawerParamList>();

interface Props {
  profile: Profile;
  courses: Course[];
  teacherStats: TeacherStats | null;
  students: StudentWithEnrollments[];
  onLogout: () => void;
}

const MainNavigator: React.FC<Props> = ({ profile, courses, teacherStats, students, onLogout }) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 1024;
  const [notifications, setNotifications] = useState<ProfessorNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifError, setNotifError] = useState<string | null>(null);

  // "See full version" → which notification to show on the redirected page,
  // and which drawer route is currently focused (banner only shows on a match).
  const [fullNotif, setFullNotif] = useState<ProfessorNotification | null>(null);
  const [currentRoute, setCurrentRoute] = useState<string | null>(null);

  // Exact entity to highlight on the destination screen (course+tab, or student).
  // Passed into the matching screen's render prop; `nonce` re-triggers on re-click.
  const [focus, setFocus] = useState<NotificationFocus | null>(null);

  // Drawer navigation handle, captured from the header bell (which has nav context).
  const drawerNavRef = useRef<any>(null);

  const loadNotifications = useCallback(async () => {
    setNotifError(null);
    try {
      setNotifications(await getProfessorNotifications(profile.id));
    } catch {
      setNotifError('Could not load notifications.');
    } finally {
      setNotifLoading(false);
    }
  }, [profile.id]);

  // Initial load + light polling so newly-created notifications appear.
  useEffect(() => {
    loadNotifications();
    const t = setInterval(loadNotifications, 60000);
    return () => clearInterval(t);
  }, [loadNotifications]);

  // QualityControl etc. send a transient Notification — persist it to the table.
  const handleNewNotification = async (n: Notification) => {
    const title =
      n.type === 'approval_sent' ? '📤 Comparison Sent' :
      n.type === 'warning'       ? '⚠️ Warning'        : 'Notification';
    await createNotificationIfNew({
      userId: profile.id,
      title,
      message: n.message,
      type: n.type,
    });
    loadNotifications();
  };

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

  // Resolve a notification's EXACT destination (route + entity focus) and go there.
  // Used by both "See full version" (from the bell) and the on-page card tap, so
  // every entry point lands on the precise item, not just the generic page.
  // Returns true only when a redirect was actually dispatched — callers use this
  // to decide whether it's safe to dismiss the notification afterwards.
  const navigateToNotification = useCallback(async (n: ProfessorNotification): Promise<boolean> => {
    let route = routeForNotifType(n.type);
    let nextFocus: NotificationFocus | null = null;
    try {
      const dest = await getNotificationDestination(n);
      route = dest.route;
      nextFocus = dest.focus ? { ...dest.focus, nonce: Date.now() } : null;
    } catch {
      /* fall back to the generic route below */
    }
    setFocus(nextFocus);
    if (route && drawerNavRef.current) {
      try {
        drawerNavRef.current.dispatch(DrawerActions.jumpTo(route));
        return true; // redirect successfully triggered
      } catch {
        return false; // navigation failed — keep the notification visible to retry
      }
    }
    return false; // no route for this type — nothing to redirect to, keep it visible
  }, []);

  // After opening: hide the notification from the visible list (local state) and
  // persist it as read on the EXISTING `read` column. The local removal is the
  // important part — it makes the card disappear immediately even though there is
  // no `dismissed` field. No new field, no record deletion — the manual trash icon
  // (handleDeleteNotification) is the only path that permanently removes a record.
  const dismissOpenedNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id)); // disappears from list
    try { await markNotificationRead(id); } catch { /* best-effort: stays hidden locally */ }
  }, []);

  // Show the full notification on its connected page, then route to the exact item.
  // Order: redirect FIRST, then remove the card from the visible list immediately.
  const handleSeeFull = async (n: ProfessorNotification) => {
    try {
      setFullNotif(n);
      await navigateToNotification(n);     // 1. redirect first
      await dismissOpenedNotification(n.id); // 2. remove from screen + mark read
    } catch (error) {
      console.error('Failed to open notification details', error);
    }
  };

  // Close = hide the card only; keep the record (and its read state).
  const handleCloseFull = () => setFullNotif(null);

  // Delete = remove the notification record only; never touches source data.
  const handleDeleteFull = async () => {
    if (!fullNotif) return;
    const id = fullNotif.id;
    setFullNotif(null);
    setNotifications(prev => prev.filter(n => n.id !== id));
    try { await deleteNotification(id); } catch { loadNotifications(); }
  };

  // "Open details" on the on-page banner → redirect, then remove it from the list
  // immediately. Same order as handleSeeFull; the on-page banner itself stays
  // visible (it's driven by fullNotif, not the list).
  const handleOpenFull = async () => {
    if (!fullNotif) return;
    try {
      await navigateToNotification(fullNotif);       // 1. redirect first
      await dismissOpenedNotification(fullNotif.id); // 2. remove from screen + mark read
    } catch (error) {
      console.error('Failed to open notification details', error);
    }
  };

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
    />
  );

  // Banner appears only while the user is on the page the notification points to.
  const showBanner = !!fullNotif && currentRoute === routeForNotifType(fullNotif.type);
  const headerH = insets.top + (isWide ? 64 : 56);

  return (
    <View style={{ flex: 1 }}>
    <Drawer.Navigator
      drawerContent={props => <Sidebar {...props} onLogout={onLogout} />}
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
        headerRight,
        overlayColor: 'rgba(0,0,0,0.3)',
      }}
    >
      <Drawer.Screen name="Home" options={{ title: 'Home' }}>
        {() => <HomeScreen profile={profile} courses={courses} teacherStats={teacherStats} students={students} />}
      </Drawer.Screen>
      <Drawer.Screen name="Courses" options={{ title: 'Course Overview' }}>
        {() => <CoursesScreen courses={courses} />}
      </Drawer.Screen>
      <Drawer.Screen name="Students" options={{ title: 'Students' }}>
        {() => <StudentsScreen courses={courses} teacherId={profile.id} />}
      </Drawer.Screen>
      <Drawer.Screen name="StudentList" options={{ title: 'Student List' }}>
        {() => <StudentListScreen profile={profile} courses={courses} />}
      </Drawer.Screen>
      <Drawer.Screen name="CourseManagement" options={{ title: 'Course Management' }}>
        {() => (
          <CourseManagementScreen
            courses={courses}
            profile={profile}
            focus={(focus?.kind === 'document' || focus?.kind === 'overlap') ? focus : undefined}
          />
        )}
      </Drawer.Screen>
      <Drawer.Screen name="HomeworkAssistance" options={{ title: 'Homework Assistance' }}>
        {() => <HomeworkAssistanceScreen courses={courses} profile={profile} />}
      </Drawer.Screen>
      <Drawer.Screen name="QualityControl" options={{ title: 'Quality Control' }}>
        {() => <QualityControlScreen courses={courses} onNewNotification={handleNewNotification} />}
      </Drawer.Screen>
      <Drawer.Screen name="Warnings" options={{ title: 'Warnings' }}>
        {() => (
          <WarningsScreen
            profile={profile}
            focus={focus?.kind === 'student' ? focus : undefined}
          />
        )}
      </Drawer.Screen>
      <Drawer.Screen name="News" options={{ title: 'Course News' }}>
        {() => <NewsScreen profile={profile} courses={courses} />}
      </Drawer.Screen>
      <Drawer.Screen name="Calendar" options={{ title: 'Calendar' }}>
        {() => <ProfessorCalendarScreen profile={profile} />}
      </Drawer.Screen>
      <Drawer.Screen name="Profile" options={{ title: 'Profile' }}>
        {() => <ProfileScreen profile={profile} courses={courses} />}
      </Drawer.Screen>
      <Drawer.Screen name="Settings" options={{ title: 'Settings' }}>
        {() => <SettingsScreen />}
      </Drawer.Screen>
    </Drawer.Navigator>

      {/* Full notification shown on its connected page, below the header. */}
      {showBanner && fullNotif && (
        <View
          style={[styles.bannerWrap, { top: headerH + 8, left: isWide ? 260 : 0 }]}
          pointerEvents="box-none"
        >
          <FullNotificationBanner
            notification={fullNotif}
            onClose={handleCloseFull}
            onDelete={handleDeleteFull}
            onPress={handleOpenFull}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bannerWrap: {
    position: 'absolute',
    right: 0,
    paddingHorizontal: 16,
  },
});

export default MainNavigator;
