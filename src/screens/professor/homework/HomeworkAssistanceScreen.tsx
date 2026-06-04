import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Course, Profile } from '../../../types';
import { HomeworkHistoryItem } from '../../../types/homeworkAssistance';
import { fetchHomeworkAssistanceHistory } from '../../../services/homeworkAssistanceService';
import AlignmentCheckerView from './AlignmentCheckerView';
import HomeworkCheckerView from './HomeworkCheckerView';
import HistoryView from './HistoryView';

const C = {
  forest: '#1A5C38', leaf: '#3A8F5F', mist: '#F2FAF5',
  ink: '#1A1A1A', inkMid: 'rgba(26,26,26,0.65)', inkSoft: 'rgba(26,26,26,0.4)',
  border: '#E0EDE6', card: '#FFFFFF',
  red: '#D9534F', redBg: '#FDF1F1',
  amber: '#92600A', amberBg: '#FFFBEB',
  blue: '#1D4ED8', blueBg: '#EFF6FF',
  green50: '#F0F6EF',
};

type ScreenView = 'home' | 'alignment' | 'checker' | 'history';

interface Props {
  courses: Course[];
  profile: Profile;
}

// ── Feature card ───────────────────────────────────────────────────────────────

const FeatureCard: React.FC<{
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
  onPress: () => void;
  wide: boolean;
}> = ({ icon, title, description, buttonLabel, onPress, wide }) => (
  <View style={[styles.featureCard, wide && styles.featureCardWide]}>
    <Text style={styles.featureIcon}>{icon}</Text>
    <Text style={styles.featureTitle}>{title}</Text>
    <Text style={styles.featureDesc}>{description}</Text>
    <TouchableOpacity style={styles.featureBtn} onPress={onPress}>
      <Text style={styles.featureBtnText}>{buttonLabel}</Text>
    </TouchableOpacity>
  </View>
);

// ── History summary card ───────────────────────────────────────────────────────

const HistorySummaryCard: React.FC<{ item: HomeworkHistoryItem }> = ({ item }) => {
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch { return iso; }
  };

  return (
    <View style={styles.recentCard}>
      <Text style={styles.recentIcon}>{item.check_type === 'alignment' ? '📐' : '📝'}</Text>
      <View style={styles.recentInfo}>
        <Text style={styles.recentCourse}>{item.course_name}</Text>
        <Text style={styles.recentSummary} numberOfLines={2}>{item.summary}</Text>
        {item.alignment_percentage !== undefined && (
          <Text style={[
            styles.recentMeta,
            { color: item.alignment_percentage >= 85 ? C.forest : item.alignment_percentage >= 65 ? C.amber : C.red },
          ]}>
            {item.alignment_percentage}% aligned
          </Text>
        )}
        {item.student_count !== undefined && (
          <Text style={styles.recentMeta}>{item.student_count} students graded</Text>
        )}
      </View>
      <Text style={styles.recentDate}>{formatDate(item.created_at)}</Text>
    </View>
  );
};

// ── Main screen ────────────────────────────────────────────────────────────────

const HomeworkAssistanceScreen: React.FC<Props> = ({ courses, profile }) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  const [view, setView] = useState<ScreenView>('home');
  const [history, setHistory] = useState<HomeworkHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setHistoryLoading(true);
      try {
        const items = await fetchHomeworkAssistanceHistory(profile.id);
        setHistory(items);
      } catch {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    void load();
  }, [profile.id]);

  // ── Sub-views ──────────────────────────────────────────────────────────────

  if (view === 'alignment') {
    return (
      <AlignmentCheckerView
        onBack={() => setView('home')}
        courses={courses}
        professorId={profile.id}
      />
    );
  }

  if (view === 'checker') {
    return (
      <HomeworkCheckerView
        onBack={() => setView('home')}
        courses={courses}
        professorId={profile.id}
      />
    );
  }

  if (view === 'history') {
    return (
      <HistoryView
        onBack={() => setView('home')}
        history={history}
      />
    );
  }

  // ── Home view ──────────────────────────────────────────────────────────────

  const recentHistory = history.slice(0, 3);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Homework Assistance</Text>
          <Text style={styles.headerSubtitle}>
            AI-powered homework alignment checking and student grading tools.
          </Text>
        </View>
        <TouchableOpacity style={styles.historyBtn} onPress={() => setView('history')}>
          <Text style={styles.historyBtnText}>🕐 History</Text>
        </TouchableOpacity>
      </View>

      {/* Feature cards */}
      <View style={[styles.featureRow, isWide && styles.featureRowWide]}>
        <FeatureCard
          icon="📐"
          title="Homework Alignment Checker"
          description="Analyse your homework brief against the locked syllabus, scheme of work, learning objectives, accreditation standards, and detect overlaps with other courses."
          buttonLabel="Start Alignment Check"
          onPress={() => setView('alignment')}
          wide={isWide}
        />
        <FeatureCard
          icon="📝"
          title="Homework Checker"
          description="Upload student submissions and get AI-powered grading with rubric breakdowns, tailored feedback drafts, and originality assessments — all in one batch."
          buttonLabel="Start Homework Check"
          onPress={() => setView('checker')}
          wide={isWide}
        />
      </View>

      {/* Recent activity */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>Recent Activity</Text>
          {history.length > 0 && (
            <TouchableOpacity onPress={() => setView('history')}>
              <Text style={styles.viewAllText}>View All →</Text>
            </TouchableOpacity>
          )}
        </View>

        {historyLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={C.forest} />
            <Text style={styles.loadingText}>Loading history…</Text>
          </View>
        ) : recentHistory.length === 0 ? (
          <View style={styles.emptyRecent}>
            <Text style={styles.emptyRecentIcon}>📋</Text>
            <Text style={styles.emptyRecentTitle}>No checks yet</Text>
            <Text style={styles.emptyRecentText}>
              Run your first alignment check or homework grading session to see activity here.
            </Text>
          </View>
        ) : (
          recentHistory.map(item => (
            <HistorySummaryCard key={item.id} item={item} />
          ))
        )}
      </View>

      {/* Quick tips */}
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>💡 Quick Tips</Text>
        <Text style={styles.tipItem}>• Lock your syllabus first in Course Management for the most accurate alignment analysis.</Text>
        <Text style={styles.tipItem}>• Name student submission files clearly (e.g. "Alice_Smith_Assignment1.pdf") — the file name becomes the student name.</Text>
        <Text style={styles.tipItem}>• Include a detailed rubric when running homework checks for criterion-level breakdowns.</Text>
        <Text style={styles.tipItem}>• All AI results can be exported as text or copied to your clipboard.</Text>
      </View>
    </ScrollView>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.mist },
  content: { padding: 20, paddingBottom: 60 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 },
  headerLeft: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', color: C.forest, marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: C.inkMid, lineHeight: 20 },
  historyBtn: {
    borderWidth: 1.5, borderColor: C.forest, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  historyBtnText: { color: C.forest, fontSize: 13, fontWeight: '600' },

  featureRow: { gap: 12, marginBottom: 28 },
  featureRowWide: { flexDirection: 'row' },

  featureCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  featureCardWide: { flex: 1 },
  featureIcon: { fontSize: 36, marginBottom: 12 },
  featureTitle: { fontSize: 17, fontWeight: '700', color: C.ink, marginBottom: 8 },
  featureDesc: { fontSize: 14, color: C.inkMid, lineHeight: 20, marginBottom: 16 },
  featureBtn: {
    backgroundColor: C.forest, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  featureBtnText: { color: C.card, fontSize: 14, fontWeight: '700' },

  recentSection: { marginBottom: 28 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  recentTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  viewAllText: { color: C.forest, fontSize: 13, fontWeight: '600' },

  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20 },
  loadingText: { color: C.inkMid, fontSize: 14 },

  emptyRecent: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyRecentIcon: { fontSize: 36 },
  emptyRecentTitle: { fontSize: 16, fontWeight: '600', color: C.ink },
  emptyRecentText: { fontSize: 13, color: C.inkMid, textAlign: 'center', lineHeight: 19, maxWidth: 280 },

  recentCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border, marginBottom: 8,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  recentIcon: { fontSize: 22, marginTop: 2 },
  recentInfo: { flex: 1, gap: 3 },
  recentCourse: { fontSize: 11, color: C.inkSoft, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  recentSummary: { fontSize: 14, color: C.ink, lineHeight: 19 },
  recentMeta: { fontSize: 12, fontWeight: '600' },
  recentDate: { fontSize: 12, color: C.inkSoft, marginTop: 2 },

  tipsCard: {
    backgroundColor: C.green50, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: C.border, gap: 6,
  },
  tipsTitle: { fontSize: 14, fontWeight: '700', color: C.forest, marginBottom: 6 },
  tipItem: { fontSize: 13, color: C.inkMid, lineHeight: 19 },
});

export default HomeworkAssistanceScreen;
