import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../theme';

const SettingsScreen: React.FC = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Settings</Text>
    <Text style={styles.body}>Settings will be available soon.</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.mist, padding: Spacing.lg },
  title: { ...Typography.display, marginBottom: Spacing.md },
  body: { ...Typography.body },
});

export default SettingsScreen;
