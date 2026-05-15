import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { DrawerParamList, Profile, Course, TeacherStats, StudentWithEnrollments, Notification } from '../types';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import HomeScreen from '../screens/HomeScreen';
import CoursesScreen from '../screens/CoursesScreen';
import StudentsScreen from '../screens/StudentsScreen';
import QualityControlScreen from '../screens/QualityControlScreen';
import WarningsScreen from '../screens/WarningsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { mockNotifications } from '../mock';
import { Colors, Spacing } from '../theme';

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
  const isWide = width >= 1024;
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  const handleNewNotification = (n: Notification) => {
    setNotifications(prev => [n, ...prev]);
  };

  const handleReadNotification = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const headerRight = () => (
    <NotificationBell notifications={notifications} onRead={handleReadNotification} />
  );

  return (
    <Drawer.Navigator
      drawerContent={props => <Sidebar {...props} onLogout={onLogout} />}
      screenOptions={{
        drawerType: isWide ? 'permanent' : 'front',
        drawerStyle: { width: 220, backgroundColor: '#0D3D25' },
        headerStyle: { backgroundColor: Colors.white, borderBottomColor: Colors.border, borderBottomWidth: 1 },
        headerTintColor: Colors.forest,
        headerRight,
        overlayColor: 'rgba(0,0,0,0.3)',
      }}
    >
      <Drawer.Screen name="Home" options={{ title: 'Home' }}>
        {() => <HomeScreen profile={profile} courses={courses} teacherStats={teacherStats} students={students} />}
      </Drawer.Screen>
      <Drawer.Screen name="Courses" options={{ title: 'Courses' }}>
        {() => <CoursesScreen courses={courses} />}
      </Drawer.Screen>
      <Drawer.Screen name="Students" options={{ title: 'Students' }}>
        {() => <StudentsScreen courses={courses} teacherId={profile.id} />}
      </Drawer.Screen>
      <Drawer.Screen name="QualityControl" options={{ title: 'Quality Control' }}>
        {() => <QualityControlScreen courses={courses} onNewNotification={handleNewNotification} />}
      </Drawer.Screen>
      <Drawer.Screen name="Warnings" options={{ title: 'Warnings' }}>
        {() => <WarningsScreen courses={courses} students={students} />}
      </Drawer.Screen>
      <Drawer.Screen name="Profile" options={{ title: 'Profile' }}>
        {() => <ProfileScreen profile={profile} courses={courses} />}
      </Drawer.Screen>
      <Drawer.Screen name="Settings" options={{ title: 'Settings' }}>
        {() => <SettingsScreen />}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
};

export default MainNavigator;
