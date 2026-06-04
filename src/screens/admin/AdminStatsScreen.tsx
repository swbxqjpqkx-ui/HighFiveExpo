import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { getStudentStats, getCourseEnrollmentStats } from '../../services/supabase';
import { CourseEnrollmentStat } from '../../types';
import { Green, Ink, Tint } from '../../theme';

const C = {
  green50:  Green[50],
  green100: Green[100],
  green600: Green[600],
  green700: Green[700],
  text:     Ink.base,
  muted:    Ink[3],
  soft:     Ink[4],
  border:   Ink.line,
  red:      Tint.rose.ink,
  amber:    Tint.sun.ink,
  blue:     Tint.sky.ink,
  purple:   Tint.violet.ink,
  card:     Ink.surface,
  bg:       Ink.bg,
};

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
  card:  { flex: 1, minWidth: 140, borderWidth: 1, borderRadius: 14, padding: 18, gap: 4 },
  value: { fontFamily: 'Montserrat-Bold', fontSize: 36, letterSpacing: -1.5 },
  label: { fontFamily: 'Montserrat-Bold', fontSize: 13, color: C.text },
  sub:   { fontFamily: 'Montserrat-Medium', fontSize: 11, color: C.muted },
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
  pageTitle:   { fontFamily: 'Montserrat-Bold', fontSize: 22, color: C.text, marginBottom: 4, letterSpacing: -0.5 },
  pageSub:     { fontFamily: 'Montserrat-Medium', fontSize: 13, color: C.muted, marginBottom: 20 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  gridWide:    { flexWrap: 'nowrap' },
  card:        { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 22, marginBottom: 18 },
  sectionTitle:{ fontFamily: 'Montserrat-Bold', fontSize: 15, color: C.text, marginBottom: 14, letterSpacing: -0.1 },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 4 },
  tableRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  tableRowAlt: { backgroundColor: C.bg, borderRadius: 6 },
  th:          { fontFamily: 'Montserrat-Bold', fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  td:          { fontFamily: 'Montserrat-Medium', fontSize: 13, color: C.text },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:  { fontFamily: 'Montserrat-Bold', fontSize: 11 },
  empty:       { fontFamily: 'Montserrat-Medium', fontSize: 13, color: C.muted, paddingVertical: 12 },
});

export default AdminStatsScreen;
