import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
// Side-effect import: makes every Text/TextInput default to Montserrat globally.
import './src/theme/globalFont';
import LoginScreen from './src/screens/LoginScreen';
import MainNavigator from './src/navigation/MainNavigator';
import AdminNavigator from './src/navigation/AdminNavigator';
import InstitutionSetupScreen from './src/screens/admin/InstitutionSetupScreen';
import TermsScreen from './src/screens/TermsScreen';
import { InstitutionProvider, useInstitution } from './src/context/InstitutionContext';
import { Profile, Course, TeacherStats, StudentWithEnrollments } from './src/types';
import {
  getCoursesByTeacher, getProfile, getTeacherStats,
  getStudentsByTeacher, signOut, supabase,
} from './src/services/supabase';
import { Colors } from './src/theme';

// ── Inner app: reads institution context after provider is mounted ─────────────
interface InnerAppProps {
  profile: Profile | null;
  courses: Course[];
  teacherStats: TeacherStats | null;
  students: StudentWithEnrollments[];
  onLogin: (prof: Profile) => void;
  onLogout: () => void;
  onAcceptTerms: () => void;
}

const InnerApp: React.FC<InnerAppProps> = ({
  profile, courses, teacherStats, students, onLogin, onLogout, onAcceptTerms,
}) => {
  const { settings, loading: institutionLoading, setupComplete, refresh } = useInstitution();

  if (!profile) {
    return <LoginScreen onLogin={onLogin} />;
  }

  if (institutionLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.leaf} />
      </View>
    );
  }

  // Professors must wait until setup is done
  if (profile.role === 'professor' && !setupComplete) {
    return (
      <View style={styles.waitScreen}>
        <Text style={styles.waitEmoji}>🏫</Text>
        <Text style={styles.waitTitle}>Setup In Progress</Text>
        <Text style={styles.waitBody}>
          Your institution administrator needs to complete the one-time setup before you can access
          your account. Please check back shortly or contact your administrator.
        </Text>
      </View>
    );
  }

  // Admin: show setup form if not done
  if (profile.role === 'administrator' && !setupComplete) {
    return (
      <InstitutionSetupScreen
        adminId={profile.id}
        onComplete={async () => { await refresh(); }}
      />
    );
  }

  // Terms gate — must accept before accessing any features
  if (!profile.accepted_terms) {
    return <TermsScreen userId={profile.id} onAccept={onAcceptTerms} />;
  }

  // All good — route to correct navigator
  return (
    <NavigationContainer>
      {profile.role === 'administrator' ? (
        <AdminNavigator profile={profile} onLogout={onLogout} />
      ) : (
        <MainNavigator
          profile={profile}
          courses={courses}
          teacherStats={teacherStats}
          students={students}
          onLogout={onLogout}
        />
      )}
    </NavigationContainer>
  );
};

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [fontsLoaded] = useFonts({
    Montserrat: require('./node_modules/@expo-google-fonts/montserrat/400Regular/Montserrat_400Regular.ttf'),
    'Montserrat-Light': require('./node_modules/@expo-google-fonts/montserrat/300Light/Montserrat_300Light.ttf'),
    'Montserrat-Medium': require('./node_modules/@expo-google-fonts/montserrat/500Medium/Montserrat_500Medium.ttf'),
    'Montserrat-SemiBold': require('./node_modules/@expo-google-fonts/montserrat/600SemiBold/Montserrat_600SemiBold.ttf'),
    'Montserrat-Bold': require('./node_modules/@expo-google-fonts/montserrat/700Bold/Montserrat_700Bold.ttf'),
    'Montserrat-ExtraBold': require('./node_modules/@expo-google-fonts/montserrat/800ExtraBold/Montserrat_800ExtraBold.ttf'),
  });

  const [profile, setProfile]         = useState<Profile | null>(null);
  const [courses, setCourses]         = useState<Course[]>([]);
  const [teacherStats, setTeacherStats] = useState<TeacherStats | null>(null);
  const [students, setStudents]       = useState<StudentWithEnrollments[]>([]);
  const [loading, setLoading]         = useState(true);

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
        setStudents([]);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadAllData = async (prof: Profile) => {
    if (prof.role === 'professor') {
      try { const c = await getCoursesByTeacher(prof.id); setCourses(c); console.log('[loadAllData] courses:', c.length); } catch (e) { console.error('[loadAllData] getCoursesByTeacher error:', e); }
      try { const s = await getTeacherStats(prof.id);     setTeacherStats(s); } catch (e) { console.error('[loadAllData] getTeacherStats error:', e); }
      try { const st = await getStudentsByTeacher(prof.id); setStudents(st); console.log('[loadAllData] students:', st.length); } catch (e) { console.error('[loadAllData] getStudentsByTeacher error:', e); }
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      const prof = await getProfile(userId);
      prof.role = prof.role?.toLowerCase() as Profile['role'];
      setProfile(prof);
      await loadAllData(prof);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (prof: Profile) => {
    prof.role = prof.role?.toLowerCase() as Profile['role'];
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

  const handleAcceptTerms = () => {
    setProfile(prev => prev ? { ...prev, accepted_terms: true } : null);
  };

  if (loading || !fontsLoaded) {
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
        <InstitutionProvider>
          <InnerApp
            profile={profile}
            courses={courses}
            teacherStats={teacherStats}
            students={students}
            onLogin={handleLogin}
            onLogout={handleLogout}
            onAcceptTerms={handleAcceptTerms}
          />
        </InstitutionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.mist },
  waitScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.mist, padding: 32,
  },
  waitEmoji: { fontSize: 52, marginBottom: 16 },
  waitTitle: { fontSize: 22, fontWeight: '700', color: Colors.forest, marginBottom: 12, textAlign: 'center' },
  waitBody:  { fontSize: 14, color: 'rgba(26,26,26,0.65)', textAlign: 'center', lineHeight: 21 },
});
