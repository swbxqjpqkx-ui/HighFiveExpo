import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Profile, Course } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface Props {
  profile: Profile;
  courses: Course[];
}

const ProfileSummary: React.FC<Props> = ({ profile, courses }) => (
  <View style={styles.container}>
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{profile.full_name?.charAt(0) ?? 'P'}</Text>
    </View>
    <Text style={styles.name}>{profile.full_name}</Text>
    <Text style={styles.email}>{profile.email}</Text>
    <View style={styles.badge}>
      <Text style={styles.badgeText}>Professor</Text>
    </View>
    <Text style={styles.courses}>{courses.length} course{courses.length !== 1 ? 's' : ''}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: Spacing.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.leaf + '33',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  avatarText: { fontSize: 36, fontWeight: '500', color: Colors.leaf },
  name: { ...Typography.heading1, marginBottom: 4 },
  email: { ...Typography.body, marginBottom: Spacing.sm },
  badge: {
    backgroundColor: Colors.forest + '22', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: Spacing.sm,
  },
  badgeText: { ...Typography.label, color: Colors.forest },
  courses: { ...Typography.body },
});

export default ProfileSummary;
