import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import MainNavigator from './src/navigation/MainNavigator';
import AdminNavigator from './src/navigation/AdminNavigator';
import { Profile, Course, TeacherStats, StudentWithEnrollments } from './src/types';
import { getCoursesByTeacher, getProfile, getTeacherStats, getStudentsByTeacher, signOut, supabase } from './src/services/supabase';
import { Colors } from './src/theme';

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teacherStats, setTeacherStats] = useState<TeacherStats | null>(null);
  const [students, setStudents] = useState<StudentWithEnrollments[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        loadProfile(data.session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setProfile(null);
        setCourses([]);
        setTeacherStats(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadAllData = async (prof: Profile) => {
    // Load courses first — always critical
    try {
      const c = await getCoursesByTeacher(prof.id);
      setCourses(c);
    } catch (e) {
      console.error('[App] Failed to load courses:', e);
    }
    // Load stats and students independently — failures won't affect courses
    try {
      const stats = await getTeacherStats(prof.id);
      setTeacherStats(stats);
    } catch (e) {
      console.error('[App] Failed to load teacher stats:', e);
    }
    try {
      const s = await getStudentsByTeacher(prof.id);
      setStudents(s);
    } catch (e) {
      console.error('[App] Failed to load students:', e);
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      const prof = await getProfile(userId);
      setProfile(prof);
      await loadAllData(prof);
    } catch (profileErr) {
      console.error('[App] Failed to load profile:', profileErr);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (prof: Profile) => {
    setProfile(prof);
    await loadAllData(prof);
  };

  const handleLogout = async () => {
    await signOut();
    setProfile(null);
    setCourses([]);
    setTeacherStats(null);
    setStudents([]);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.leaf} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor={Colors.white} />
        <NavigationContainer>
          {profile ? (
            profile.role === 'administrator' ? (
              <AdminNavigator profile={profile} onLogout={handleLogout} />
            ) : (
              <MainNavigator
                profile={profile}
                courses={courses}
                teacherStats={teacherStats}
                students={students}
                onLogout={handleLogout}
              />
            )
          ) : (
            <LoginScreen onLogin={handleLogin} />
          )}
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.mist },
});
