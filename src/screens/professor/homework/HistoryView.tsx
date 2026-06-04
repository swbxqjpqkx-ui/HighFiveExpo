import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { HomeworkHistoryItem } from '../../../types/homeworkAssistance';

const C = {
  forest: '#1A5C38', leaf: '#3A8F5F', mist: '#F2FAF5',
  ink: '#1A1A1A', inkMid: 'rgba(26,26,26,0.65)', inkSoft: 'rgba(26,26,26,0.4)',
  border: '#E0EDE6', card: '#FFFFFF',
  red: '#D9534F', redBg: '#FDF1F1',
  amber: '#92600A', amberBg: '#FFFBEB',
  blue: '#1D4ED8', blueBg: '#EFF6FF',
  green50: '#F0F6EF',
};

type FilterTab = 'all' | 'alignment' | 'grading';

interface Props {
  onBack: () => void;
  history: HomeworkHistoryItem[];
}

const HistoryView: React.FC<Props> = ({ onBack, history }) => {
  const [filter, setFilter] = useState<FilterTab>('all');

  const filtered = history.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'alignment') return item.check_type === 'alignment';
    return item.check_type === 'grading';
  });

  const formatDate = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'alignment', label: 'Alignment Checks' },
    { key: 'grading', label: 'Homework Checks' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.screenTitle}>Check History</Text>
      <Text style={styles.subtitle}>All your previous homework alignment and grading checks.</Text>

      {/* Filter tabs */}
      <View style={styles.tabRow}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, filter === tab.key && styles.tabActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text style={[styles.tabText, filter === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* History list */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptyText}>
            {filter === 'all'
              ? 'Run your first alignment check or homework checker to see results here.'
              : filter === 'alignment'
              ? 'No alignment checks found. Use the Homework Alignment Checker to get started.'
              : 'No homework grading sessions found. Use the Homework Checker to get started.'}
          </Text>
        </View>
      ) : (
        filtered.map(item => (
          <View key={item.id} style={styles.historyCard}>
            <View style={styles.cardTop}>
              <Text style={styles.typeIcon}>
                {item.check_type === 'alignment' ? '📐' : '📝'}
              </Text>
              <View style={styles.cardInfo}>
                <Text style={styles.cardCourse}>{item.course_name}</Text>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.summary}</Text>
              </View>
              <View style={[
                styles.typeBadge,
                { backgroundColor: item.check_type === 'alignment' ? C.green50 : C.blueBg },
              ]}>
                <Text style={[
                  styles.typeBadgeText,
                  { color: item.check_type === 'alignment' ? C.forest : C.blue },
                ]}>
                  {item.check_type === 'alignment' ? 'Alignment' : 'Grading'}
                </Text>
              </View>
            </View>

            <View style={styles.cardMeta}>
              <Text style={styles.metaDate}>{formatDate(item.created_at)}</Text>
              {item.alignment_percentage !== undefined && (
                <View style={styles.metaScore}>
                  <Text style={[
                    styles.metaScoreText,
                    { color: item.alignment_percentage >= 85 ? C.forest : item.alignment_percentage >= 65 ? C.amber : C.red },
                  ]}>
                    {item.alignment_percentage}% aligned
                  </Text>
                </View>
              )}
              {item.student_count !== undefined && (
                <Text style={styles.metaStudents}>{item.student_count} students</Text>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.mist },
  content: { padding: 20, paddingBottom: 60 },
  backBtn: { marginBottom: 12 },
  backText: { color: C.forest, fontSize: 15, fontWeight: '500' },
  screenTitle: { fontSize: 22, fontWeight: '700', color: C.ink, marginBottom: 6 },
  subtitle: { fontSize: 14, color: C.inkMid, marginBottom: 20, lineHeight: 20 },

  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  tabActive: { backgroundColor: C.forest, borderColor: C.forest },
  tabText: { fontSize: 13, color: C.inkMid, fontWeight: '500' },
  tabTextActive: { color: C.card, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.ink },
  emptyText: { fontSize: 14, color: C.inkMid, textAlign: 'center', lineHeight: 20, maxWidth: 300 },

  historyCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  typeIcon: { fontSize: 24, marginTop: 2 },
  cardInfo: { flex: 1, gap: 4 },
  cardCourse: { fontSize: 12, color: C.inkSoft, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: C.ink, lineHeight: 20 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },

  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  metaDate: { fontSize: 12, color: C.inkSoft },
  metaScore: { backgroundColor: C.mist, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  metaScoreText: { fontSize: 12, fontWeight: '700' },
  metaStudents: { fontSize: 12, color: C.inkSoft },
});

export default HistoryView;
