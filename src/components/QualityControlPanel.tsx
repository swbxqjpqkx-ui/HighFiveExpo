import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Course, ApprovalRequest } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface Props {
  courses: Course[];
  onSendApproval: (courseA: string, courseB: string) => void;
}

const QualityControlPanel: React.FC<Props> = ({ courses, onSendApproval }) => {
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!selectedA || !selectedB) return;
    onSendApproval(selectedA, selectedB);
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Course Comparison</Text>
      <Text style={styles.subtitle}>Select two courses to compare for topic overlap.</Text>

      <Text style={styles.label}>Course A</Text>
      <View style={styles.options}>
        {courses.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[styles.option, selectedA === c.id && styles.optionSelected]}
            onPress={() => setSelectedA(c.id)}
          >
            <Text style={[styles.optionText, selectedA === c.id && styles.optionTextSelected]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Course B</Text>
      <View style={styles.options}>
        {courses.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[styles.option, selectedB === c.id && styles.optionSelected]}
            onPress={() => setSelectedB(c.id)}
          >
            <Text style={[styles.optionText, selectedB === c.id && styles.optionTextSelected]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.resultBox}>
        <Text style={styles.resultText}>
          🤖 AI comparison will be implemented in a future update. Once enabled, it will detect topic overlaps between selected courses.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.sendBtn, (!selectedA || !selectedB || selectedA === selectedB) && styles.sendBtnDisabled]}
        onPress={handleSend}
        disabled={!selectedA || !selectedB || selectedA === selectedB}
      >
        <Text style={styles.sendBtnText}>Send to Administrator for Approval</Text>
      </TouchableOpacity>

      {sent && (
        <View style={styles.successMsg}>
          <Text style={styles.successText}>✅ Sent to administrator for approval</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  title: { ...Typography.heading2, marginBottom: 4 },
  subtitle: { ...Typography.body, marginBottom: Spacing.md },
  label: { ...Typography.label, marginBottom: Spacing.xs },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.md },
  option: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  optionSelected: { borderColor: Colors.leaf, backgroundColor: Colors.leaf + '22' },
  optionText: { ...Typography.body, color: Colors.ink },
  optionTextSelected: { color: Colors.leaf, fontWeight: '500' },
  resultBox: {
    backgroundColor: Colors.mist, borderRadius: Radius.sm,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  resultText: { ...Typography.body },
  sendBtn: {
    backgroundColor: Colors.forest, borderRadius: Radius.sm,
    padding: Spacing.md, alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.inkLight },
  sendBtnText: { ...Typography.label, color: Colors.white, textTransform: 'none', fontSize: 13 },
  successMsg: {
    marginTop: Spacing.sm, backgroundColor: Colors.leaf + '22',
    borderRadius: Radius.sm, padding: Spacing.sm,
  },
  successText: { ...Typography.body, color: Colors.leaf },
});

export default QualityControlPanel;
