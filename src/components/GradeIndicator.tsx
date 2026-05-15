import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { gradeColor } from '../utils/warnings';
import { Typography } from '../theme';

interface Props {
  grade: number;
}

const GradeIndicator: React.FC<Props> = ({ grade }) => {
  const color = gradeColor(grade);
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{grade.toFixed(0)}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: { ...Typography.label },
});

export default GradeIndicator;
