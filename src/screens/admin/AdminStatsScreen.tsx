import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { getStudentStats, getCourseEnrollmentStats } from '../../services/supabase';
import { CourseEnrollmentStat } from '../../types';

const C = {
  green50:  '#f0f6ef',
  green100: '#e2efe5',
  green600: '#2a8a4d',
  green700: '#1d6e3a',
  text:     '#1a2418',
  muted:    '#6b7264',
  soft:     '#8e948a',
  border:   '#e4ebe2',
  red:      '#d94343',
  amber:    '#d99a1f',
  blue:     '#3b6fd1',
  purple:   '#7a5acc',
  card:     '#ffffff',
  bg:       '#f5f9f3',
};

// One color per bar (cycles if > 5 courses)
const BAR_COLORS = [C.green600, C.blue, C.amber, C.red, C.purple, '#3bbfbf', '#e06b3a'];

interface MetricCardProps {
  label: string; value: string; sub: string; color: string; bg: string;
}
const MetricCard: React.FC<MetricCardProps> = ({ label, value, sub, color, bg }) => (
  <View style={[metricStyles.card, { backgroundColor: bg, borderColor: color + '40' }]}>
    <Text style={[metricStyles.value, { color }]}>{value}</Text>
    <Text style={metricStyles.label}>{label}</Text>
    <Text style={metricStyles.sub}>{sub}</Text>
  </View>
);
const metricStyles = StyleSheet.create({
  card:  { flex: 1, minWidth: 140, borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
  value: { fontSize: 36, fontWeight: '900' },
  label: { fontSize: 13, fontWeight: '700', color: C.text },
  sub:   { fontSize: 11, color: C.muted },
});

const AdminStatsScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;

  const [stats, setStats]           = useState<{ total: number; atRisk: number; avgGrade: number; avgAttendance: number; active: number } | null>(null);
  const [courseStats, setCourseStats] = useState<CourseEnrollmentStat[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([getStudentStats(), getCourseEnrollmentStats()])
      .then(([s, cs]) => { setStats(s); setCourseStats(cs); })
      .catch(() => setStats({ total: 0, atRisk: 0, avgGrade: 0, avgAttendance: 0, active: 0 }))
      .finally(() => setLoading(false));
  }, []);

  // Top 5 courses for the bar chart
  const topCourses = courseStats.slice(0, 5);
  const maxCount = topCourses.length ? Math.max(...topCourses.map(c => c.students)) : 1;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Statistics &amp; Student Coordination</Text>
      <Text style={s.pageSub}>Platform-wide academic performance overview</Text>

      {loading ? (
        <ActivityIndicator size="large" color={C.green600} style={{ marginVertical: 40 }} />
      ) : (
        <View style={[s.grid, isWide && s.gridWide]}>
          <MetricCard
            label="Total Students"
            value={String(stats?.total ?? 0)}
            sub="enrolled this semester"
            color={C.green600}
            bg={C.green50}
          />
          <MetricCard
            label="At-Risk Students"
            value={String(stats?.atRisk ?? 0)}
            sub="grade < 60 or 3+ absences"
            color={C.red}
            bg="#fbeeee"
          />
          <MetricCard
            label="Average Grade"
            value={stats?.avgGrade ? `${stats.avgGrade}%` : '—'}
            sub="across graded enrollments"
            color={C.blue}
            bg="#eef3fb"
          />
          <MetricCard
            label="Avg Attendance"
            value={stats?.avgAttendance ? `${stats.avgAttendance}%` : '—'}
            sub="based on missed classes"
            color={C.purple}
            bg="#f2eefb"
          />
        </View>
      )}

      {/* Bar chart — Top courses by enrollment */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Top Courses by Enrollment</Text>
        {topCourses.length === 0 && !loading ? (
          <Text style={s.empty}>No enrollment data yet.</Text>
        ) : (
          topCourses.map((c, i) => (
            <View key={c.course_id} style={s.barRow}>
              <Text style={s.barLabel} numberOfLines={1}>{c.course}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, {
                  width: `${Math.max(4, (c.students / maxCount) * 100)}%` as any,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                }]} />
              </View>
              <Text style={s.barCount}>{c.students}</Text>
            </View>
          ))
        )}
      </View>

      {/* Course enrollment table */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Course Enrollment Stats</Text>
        <View style={s.tableHeader}>
          <Text style={[s.th, { flex: 3 }]}>Course</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>Students</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>Avg Grade</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>Status</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={C.green600} style={{ marginVertical: 16 }} />
        ) : courseStats.length === 0 ? (
          <Text style={s.empty}>No course data yet.</Text>
        ) : (
          courseStats.map((row, i) => (
            <View key={row.course_id} style={[s.tableRow, i % 2 === 0 && s.tableRowAlt]}>
              <Text style={[s.td, { flex: 3 }]} numberOfLines={1}>{row.course}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{row.students}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>
                {row.avg > 0 ? `${row.avg}%` : '—'}
              </Text>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={[s.statusBadge, { backgroundColor: row.status === 'At Risk' ? '#fbeeee' : C.green50 }]}>
                  <Text style={[s.statusText, { color: row.status === 'At Risk' ? C.red : C.green600 }]}>
                    {row.status}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  content:     { padding: 20, paddingBottom: 40 },
  pageTitle:   { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 4 },
  pageSub:     { fontSize: 13, color: C.muted, marginBottom: 20 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  gridWide:    { flexWrap: 'nowrap' },
  card:        { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14 },
  barRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barLabel:    { width: 110, fontSize: 12, color: C.text },
  barTrack:    { flex: 1, height: 10, backgroundColor: C.green100, borderRadius: 5 },
  barFill:     { height: 10, borderRadius: 5 },
  barCount:    { width: 36, fontSize: 12, color: C.muted, textAlign: 'right' },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 4 },
  tableRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  tableRowAlt: { backgroundColor: C.bg, borderRadius: 6 },
  th:          { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  td:          { fontSize: 13, color: C.text },
  statusBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:  { fontSize: 11, fontWeight: '700' },
  empty:       { fontSize: 13, color: C.muted, paddingVertical: 12 },
});

export default AdminStatsScreen;
