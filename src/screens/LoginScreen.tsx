import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { signIn, getProfile, signOut } from '../services/supabase';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { Profile } from '../types';

interface Props {
  onLogin: (profile: Profile) => void;
}

const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const [role, setRole] = useState<'professor' | 'administrator'>('professor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await signIn(email, password);
      const profile = await getProfile(data.user.id);
      if (profile.role !== role) {
        await signOut();
        setError(
          profile.role === 'administrator'
            ? 'This account is registered as Administrator. Please use the Administrator login.'
            : 'This account is registered as Professor. Please use the Professor login.'
        );
        return;
      }
      onLogin(profile);
    } catch (e: any) {
      setError(e.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.logoArea}>
            <Image
              source={require('../../assets/images/highfive-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.logoText}>High Five</Text>
            <Text style={styles.logoTagline}>Smarter schools start here</Text>
          </View>

          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[styles.roleBtn, role === 'professor' && styles.roleBtnActive]}
              onPress={() => setRole('professor')}
            >
              <Text style={[styles.roleBtnText, role === 'professor' && styles.roleBtnTextActive]}>Professor</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, role === 'administrator' && styles.roleBtnActive]}
              onPress={() => setRole('administrator')}
            >
              <Text style={[styles.roleBtnText, role === 'administrator' && styles.roleBtnTextActive]}>Administrator</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@university.edu"
            placeholderTextColor={Colors.inkLight}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={Colors.inkLight}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: Colors.mist },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  card: {
    width: '100%', maxWidth: 420,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl, padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, elevation: 4,
  },
  logoArea: { alignItems: 'center', marginBottom: Spacing.xl },
  logoImage: { width: 120, height: 96, marginBottom: Spacing.sm },
  logoText: { ...Typography.display, textAlign: 'center' },
  logoTagline: { fontSize: 28, fontWeight: '500', color: Colors.forest, textAlign: 'center', marginTop: 4 },
  roleRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  roleBtn: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingVertical: Spacing.sm, alignItems: 'center',
  },
  roleBtnActive: { borderColor: Colors.leaf, backgroundColor: Colors.leaf + '15' },
  roleBtnText: { ...Typography.label, color: Colors.inkLight },
  roleBtnTextActive: { color: Colors.leaf },
  fieldLabel: { ...Typography.label, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    ...Typography.body, color: Colors.ink, marginBottom: Spacing.sm,
  },
  error: { ...Typography.body, color: Colors.red, marginBottom: Spacing.sm },
  loginBtn: {
    backgroundColor: Colors.leaf, borderRadius: Radius.sm,
    paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm,
  },
  loginBtnText: { ...Typography.heading2, color: Colors.white, fontWeight: '600' },
});

export default LoginScreen;
