import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface Props {
  title: string;
  icon: string;
  value?: string | number;
  onPress: () => void;
  alert?: boolean;
}

const DashboardCard: React.FC<Props> = ({ title, icon, value, onPress, alert }) => (
  <TouchableOpacity style={[styles.card, alert && styles.alertCard]} onPress={onPress} activeOpacity={0.8}>
    <Text style={styles.icon}>{icon}</Text>
    {value !== undefined && <Text style={styles.value}>{value}</Text>}
    <Text style={styles.title}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 130,
    margin: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 100,
  },
  alertCard: { borderColor: Colors.red, backgroundColor: '#D9534F08' },
  icon: { fontSize: 28, marginBottom: Spacing.xs },
  value: { ...Typography.heading1, color: Colors.forest, marginBottom: 2 },
  title: { ...Typography.label, textAlign: 'center' },
});

export default DashboardCard;
