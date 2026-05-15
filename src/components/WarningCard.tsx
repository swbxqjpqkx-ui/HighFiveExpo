import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Warning } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface Props {
  warning: Warning;
}

const WarningCard: React.FC<Props> = ({ warning }) => {
  const isHigh = warning.severity === 'high';
  const color = isHigh ? Colors.red : Colors.yellow;

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={[styles.icon]}>{isHigh ? '🔴' : '🟡'}</Text>
      <Text style={styles.message}>{warning.message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  icon: { fontSize: 14 },
  message: { ...Typography.body, flex: 1, color: Colors.ink },
});

export default WarningCard;
