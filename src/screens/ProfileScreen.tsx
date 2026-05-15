import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import ProfileSummary from '../components/ProfileSummary';
import { Profile, Course } from '../types';
import { Colors, Spacing } from '../theme';

interface Props {
  profile: Profile;
  courses: Course[];
}

const ProfileScreen: React.FC<Props> = ({ profile, courses }) => (
  <ScrollView style={styles.container}>
    <ProfileSummary profile={profile} courses={courses} />
  </ScrollView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.mist },
});

export default ProfileScreen;
