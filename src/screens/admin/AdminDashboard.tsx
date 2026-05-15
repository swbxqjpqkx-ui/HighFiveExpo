import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useWindowDimensions,
  TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Profile, AdminTask, AdminCalendarEvent, OpenDayStat } from '../../types';
import {
  getStudentStats, getOpenDayStats, getAdminCalendarEvents, getAdminTasksList,
} from '../../services/supabase';

const C = {
  green50:  '#f0f6ef',
  green100: '#e2efe5',
  green600: '#2a8a4d',
  green700: '#1d6e3a',
  green900: '#0f4a26',
  text:     '#1a2418',
  muted:    '#6b7264',
  soft:     '#8e948a',
  border:   '#e4ebe2',
  borderSt: '#d3ddd0',
  red:      '#d94343',
  amber:    '#d99a1f',
  blue:     '#3b6fd1',
  purple:   '#7a5acc',
  card:     '#ffffff',
  bg:       '#f5f9f3',
};

// ── Tone helpers ──────────────────────────────────────────────────────────────
type Tone = 'good' | 'info' | 'warn' | 'danger';

const toneBg: Record<Tone, string> = {
  danger: '#fbeeee',
  good:   '#f1f8f3',
  info:   '#eef3fb',
  warn:   '#f2eefb',
};
const toneBorder: Record<Tone, string> = {
  danger: '#f0d4d4',
  good:   '#d3e8d8',
  info:   '#d4def0',
  warn:   '#ddd3f0',
};
const toneBar: Record<Tone, string> = {
  danger: C.red,
  good:   C.green600,
  info:   C.blue,
  warn:   C.amber,
};
const toneText: Record<Tone, string> = {
  danger: C.red,
  good:   C.green600,
  info:   C.blue,
  warn:   C.amber,
};

// ── KPI Cell ─────────────────────────────────────────────────────────────────
interface KpiCellProps {
  label: string;
  value: string;
  trend: string;
  direction: 'up' | 'down';
  tone: Tone;
}

const KpiCell: React.FC<KpiCellProps> = ({ label, value, trend, direction, tone }) => (
  <View style={[kpiStyles.cell, { backgroundColor: toneBg[tone], borderColor: toneBorder[tone] }]}>
    <Text style={kpiStyles.label}>{label}</Text>
    <Text style={[kpiStyles.value, { color: toneText[tone] }]}>{value}</Text>
    <Text style={kpiStyles.trend}>
      {direction === 'up' ? '↑' : '↓'} {trend}
    </Text>
    <View style={[kpiStyles.bar, { backgroundColor: toneBar[tone] }]} />
  </View>
);

const kpiStyles = StyleSheet.create({
  cell: {
    flex: 1,
    minWidth: 90,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  label:  { fontSize: 11, color: C.muted, fontWeight: '500' },
  value:  { fontSize: 26, fontWeight: '800' },
  trend:  { fontSize: 11, color: C.soft },
  bar:    { height: 3, borderRadius: 2, width: '70%', marginTop: 4 },
});

// ── Statistics Oversight Card ─────────────────────────────────────────────────
interface StatsOverviewCardProps { atRisk: number; avgGrade: number; }

const StatisticsOversightCard: React.FC<StatsOverviewCardProps> = ({ atRisk, avgGrade }) => {
  const navigation = useNavigation<any>();
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.title}>Statistics &amp; Oversight</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminStats')}>
          <Text style={cardStyles.viewAll}>View all →</Text>
        </TouchableOpacity>
      </View>
      <View style={cardStyles.row}>
        <KpiCell label="At-risk Students" value={String(atRisk)} trend="from last month" direction="up" tone="danger" />
        <KpiCell label="Average Grade"    value={`${avgGrade}%`} trend="vs last term"    direction="up" tone="good" />
        <KpiCell label="Attendance Rate"  value="92%"            trend="stable"          direction="up" tone="info" />
        <KpiCell label="Escalations"      value="18"             trend="this week"       direction="down" tone="warn" />
      </View>
    </View>
  );
};

// ── Prof tile ─────────────────────────────────────────────────────────────────
interface ProfTileProps {
  label: string; value: number; tone: Tone; icon: string; trend: string; accent: string;
}

const ProfTile: React.FC<ProfTileProps> = ({ label, value, tone, icon, trend, accent }) => (
  <View style={[profStyles.tile, { borderLeftColor: accent }]}>
    <Text style={profStyles.icon}>{icon}</Text>
    <Text style={profStyles.label}>{label}</Text>
    <Text style={[profStyles.value, { color: toneText[tone] }]}>{value}</Text>
    <Text style={profStyles.trend}>{trend}</Text>
  </View>
);

const profStyles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 120,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  icon:  { fontSize: 20 },
  label: { fontSize: 11, color: C.muted, fontWeight: '500', flexShrink: 1 },
  value: { fontSize: 24, fontWeight: '800' },
  trend: { fontSize: 11, color: C.soft },
});

// ── Professors Overview Card ──────────────────────────────────────────────────
const ProfessorsOverviewCard: React.FC = () => {
  const navigation = useNavigation<any>();
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.title}>Professors Overview</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminProfessors')}>
          <Text style={cardStyles.viewAll}>View all →</Text>
        </TouchableOpacity>
      </View>
      <View style={cardStyles.row}>
        <ProfTile label="Courses Below Benchmark"       value={7}  tone="danger" icon="📉" trend="↑ 2 from last week" accent={C.red}      />
        <ProfTile label="Professors Requiring Support"  value={4}  tone="warn"   icon="⚠️" trend="→ unchanged"        accent={C.amber}    />
        <ProfTile label="Pending Approvals"             value={12} tone="info"   icon="📋" trend="↑ 5 new today"      accent={C.blue}     />
        <ProfTile label="Delayed Grading Activities"    value={9}  tone="good"   icon="✏️" trend="↓ 3 resolved"       accent={C.green600} />
      </View>
    </View>
  );
};

// ── Open Day Card ─────────────────────────────────────────────────────────────
interface OpenDayCardProps { stat: OpenDayStat | null; }

const OpenDayCard: React.FC<OpenDayCardProps> = ({ stat }) => {
  const navigation = useNavigation<any>();
  const capPct = stat ? Math.round((stat.capacity / stat.capacity_max) * 100) : 0;

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.title}>Open Day</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminOpenDay')}>
          <Text style={cardStyles.viewAll}>View all →</Text>
        </TouchableOpacity>
      </View>
      <View style={openDayStyles.row}>
        {/* Left gradient block */}
        <View style={openDayStyles.greenBlock}>
          <Text style={openDayStyles.nextLabel}>Next Open Day</Text>
          <Text style={openDayStyles.bigDay}>24</Text>
          <Text style={openDayStyles.month}>May 2026</Text>
          <View style={openDayStyles.pill}>
            <Text style={openDayStyles.pillText}>in {stat?.days_until ?? 10} days</Text>
          </View>
        </View>

        {/* Right 2x2 stats */}
        <View style={openDayStyles.statsGrid}>
          <View style={openDayStyles.statCell}>
            <Text style={openDayStyles.statVal}>{stat?.total_registrations ?? 312}</Text>
            <Text style={openDayStyles.statLbl}>Registrations</Text>
          </View>
          <View style={openDayStyles.statCell}>
            <Text style={openDayStyles.statVal}>{stat?.countries_count ?? 23}</Text>
            <Text style={openDayStyles.statLbl}>Countries</Text>
          </View>
          <View style={openDayStyles.statCell}>
            <Text style={openDayStyles.statVal}>{stat?.ambassadors_count ?? 45}</Text>
            <Text style={openDayStyles.statLbl}>Ambassadors</Text>
          </View>
          <View style={openDayStyles.statCell}>
            <Text style={openDayStyles.statVal}>{stat?.capacity ?? 312}/{stat?.capacity_max ?? 400}</Text>
            <Text style={openDayStyles.statLbl}>Capacity</Text>
            <View style={openDayStyles.capBar}>
              <View style={[openDayStyles.capFill, { width: `${capPct}%` as any }]} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const openDayStyles = StyleSheet.create({
  row:        { flexDirection: 'row', gap: 12 },
  greenBlock: {
    flex: 1,
    backgroundColor: C.green700,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  nextLabel:  { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  bigDay:     { fontSize: 48, fontWeight: '900', color: '#fff', lineHeight: 52 },
  month:      { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  pill:       { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  pillText:   { fontSize: 11, color: '#fff', fontWeight: '600' },
  statsGrid:  { flex: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell:   { width: '46%', backgroundColor: C.green50, borderRadius: 8, padding: 10, gap: 2 },
  statVal:    { fontSize: 18, fontWeight: '800', color: C.green700 },
  statLbl:    { fontSize: 10, color: C.muted },
  capBar:     { height: 4, backgroundColor: C.border, borderRadius: 2, marginTop: 4, width: '100%' },
  capFill:    { height: 4, backgroundColor: C.green600, borderRadius: 2 },
});

// ── Calendar Timeline Card ────────────────────────────────────────────────────
interface CalendarCardProps { events: AdminCalendarEvent[]; }

const CalendarTimelineCard: React.FC<CalendarCardProps> = ({ events }) => {
  const navigation = useNavigation<any>();
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.title}>Today's Calendar</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminCalendar')}>
          <Text style={cardStyles.viewAll}>View all →</Text>
        </TouchableOpacity>
      </View>
      {events.map((ev, idx) => (
        <View key={ev.id} style={calStyles.row}>
          {/* Time */}
          <Text style={calStyles.time}>{ev.time}</Text>
          {/* Rail */}
          <View style={calStyles.rail}>
            <View style={[calStyles.dot, { backgroundColor: ev.color ?? C.green600 }]} />
            {idx < events.length - 1 && <View style={calStyles.line} />}
          </View>
          {/* Event card */}
          <View style={[calStyles.evCard, { backgroundColor: (ev.color ?? C.green600) + '18' }]}>
            <Text style={[calStyles.evTitle, { color: ev.color ?? C.green600 }]}>{ev.title}</Text>
            <Text style={calStyles.evLoc}>📍 {ev.location}</Text>
            {ev.end_time && <Text style={calStyles.evTime}>{ev.time} – {ev.end_time}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
};

const calStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  time:    { width: 40, fontSize: 11, color: C.muted, paddingTop: 10, textAlign: 'right' },
  rail:    { alignItems: 'center', width: 16, paddingTop: 10 },
  dot:     { width: 10, height: 10, borderRadius: 5 },
  line:    { width: 2, flex: 1, backgroundColor: C.border, marginTop: 2, minHeight: 30 },
  evCard:  { flex: 1, borderRadius: 8, padding: 8, gap: 2 },
  evTitle: { fontSize: 13, fontWeight: '700' },
  evLoc:   { fontSize: 11, color: C.muted },
  evTime:  { fontSize: 10, color: C.soft },
});

// ── Tasks Card ────────────────────────────────────────────────────────────────
interface TasksCardProps { tasks: AdminTask[]; }

const priorityColor: Record<string, string> = {
  high:   C.red,
  medium: C.amber,
  low:    C.green600,
};

const TasksCard: React.FC<TasksCardProps> = ({ tasks: initialTasks }) => {
  const navigation = useNavigation<any>();
  const [tasks, setTasks] = useState<AdminTask[]>(initialTasks);
  const [newTask, setNewTask] = useState('');

  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);

  const toggle = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const add = () => {
    if (!newTask.trim()) return;
    setTasks(prev => [...prev, {
      id: `t${Date.now()}`, title: newTask.trim(), due: 'No due date', priority: 'medium', completed: false,
    }]);
    setNewTask('');
  };

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.title}>Tasks</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminTasks')}>
          <Text style={cardStyles.viewAll}>View all →</Text>
        </TouchableOpacity>
      </View>
      {tasks.map(task => (
        <TouchableOpacity key={task.id} style={taskStyles.row} onPress={() => toggle(task.id)}>
          <View style={[taskStyles.checkbox, task.completed && taskStyles.checkboxDone]}>
            {task.completed && <Text style={taskStyles.checkMark}>✓</Text>}
          </View>
          <View style={taskStyles.body}>
            <Text style={[taskStyles.title, task.completed && taskStyles.done]}>{task.title}</Text>
            <Text style={taskStyles.due}>{task.due}</Text>
          </View>
          <View style={[taskStyles.badge, { backgroundColor: priorityColor[task.priority] + '20' }]}>
            <Text style={[taskStyles.badgeText, { color: priorityColor[task.priority] }]}>
              {task.priority.toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
      {/* Add task */}
      <View style={taskStyles.addRow}>
        <TextInput
          style={taskStyles.input}
          value={newTask}
          onChangeText={setNewTask}
          placeholder="Add a task..."
          placeholderTextColor={C.soft}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <TouchableOpacity style={taskStyles.addBtn} onPress={add}>
          <Text style={taskStyles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const taskStyles = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  checkbox:    { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: C.borderSt, alignItems: 'center', justifyContent: 'center' },
  checkboxDone:{ backgroundColor: C.green600, borderColor: C.green600 },
  checkMark:   { color: '#fff', fontSize: 11, fontWeight: '700' },
  body:        { flex: 1, gap: 2 },
  title:       { fontSize: 13, color: C.text, fontWeight: '500' },
  done:        { textDecorationLine: 'line-through', opacity: 0.5 },
  due:         { fontSize: 11, color: C.soft },
  badge:       { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:   { fontSize: 10, fontWeight: '700' },
  addRow:      { flexDirection: 'row', gap: 8, marginTop: 10 },
  input:       { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: C.text, backgroundColor: C.bg },
  addBtn:      { backgroundColor: C.green600, borderRadius: 8, width: 36, alignItems: 'center', justifyContent: 'center' },
  addBtnText:  { color: '#fff', fontSize: 22, fontWeight: '300', lineHeight: 28 },
});

// ── Card shared styles ────────────────────────────────────────────────────────
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:   { fontSize: 15, fontWeight: '700', color: C.text },
  viewAll: { fontSize: 12, color: C.green600, fontWeight: '600' },
  row:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});

// ── Main Dashboard ────────────────────────────────────────────────────────────
interface Props { profile: Profile; }

const AdminDashboard: React.FC<Props> = ({ profile }) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [atRisk, setAtRisk]     = useState(0);
  const [avgGrade, setAvgGrade] = useState(78);
  const [openDay, setOpenDay]   = useState<OpenDayStat | null>(null);
  const [events, setEvents]     = useState<AdminCalendarEvent[]>([]);
  const [tasks, setTasks]       = useState<AdminTask[]>([]);
  const [loading, setLoading]   = useState(true);
  const [location, setLocation] = useState('Fetching location…');
  const [timeStr, setTimeStr]   = useState('');
  const [dateStr, setDateStr]   = useState('');

  // Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setDateStr(now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Location — tries GPS reverse geocoding first, falls back to IP geolocation
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          const [geo] = await Location.reverseGeocodeAsync(loc.coords);
          if (geo) {
            const city    = geo.city ?? geo.district ?? geo.subregion ?? geo.region ?? '';
            const country = geo.country ?? '';
            const result  = [city, country].filter(Boolean).join(', ');
            if (result) { setLocation(result); return; }
          }
        }
      } catch { /* fall through to IP lookup */ }

      // IP-based fallback — works on web and when GPS fails
      try {
        const res  = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        const city    = data.city ?? '';
        const country = data.country_name ?? '';
        setLocation([city, country].filter(Boolean).join(', ') || 'Unknown location');
      } catch {
        setLocation('Location unavailable');
      }
    })();
  }, []);

  // Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [stats, od, ev, tk] = await Promise.all([
        getStudentStats(),
        getOpenDayStats(),
        getAdminCalendarEvents(),
        getAdminTasksList(),
      ]);
      setAtRisk(stats.atRisk);
      setAvgGrade(stats.avgGrade || 78);
      setOpenDay(od);
      setEvents(ev);
      setTasks(tk);
    } catch (_) {
      // silently fall back to defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile.full_name?.split(' ')[0] ?? 'Admin';
  const initials = profile.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'A';

  const leftCol = (
    <>
      {loading
        ? <ActivityIndicator size="large" color={C.green600} style={{ marginVertical: 40 }} />
        : <StatisticsOversightCard atRisk={atRisk} avgGrade={avgGrade} />
      }
      <ProfessorsOverviewCard />
      <OpenDayCard stat={openDay} />
    </>
  );

  const rightCol = (
    <>
      <CalendarTimelineCard events={events} />
      <TasksCard tasks={tasks} />
    </>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <Text style={s.greeting}>{greeting}, {firstName} 👋</Text>
          <View style={s.subRow}>
            <Text style={s.sub}>{dateStr}</Text>
            <Text style={s.loc}> · 📍 {location}</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <Text style={s.clock}>{timeStr}</Text>
          <View style={s.chip}>
            <Text style={s.chipText}>{initials}</Text>
          </View>
          <View style={s.adminBadge}>
            <Text style={s.adminBadgeText}>🛡️ Admin</Text>
          </View>
        </View>
      </View>

      {/* Layout */}
      {isWide ? (
        <View style={s.cols}>
          <View style={s.leftCol}>{leftCol}</View>
          <View style={s.rightCol}>{rightCol}</View>
        </View>
      ) : (
        <View>
          {leftCol}
          {rightCol}
        </View>
      )}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content:   { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerLeft:{ flex: 1 },
  headerRight:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  greeting:  { fontSize: 22, fontWeight: '800', color: C.text },
  subRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  sub:       { fontSize: 12, color: C.muted },
  loc:       { fontSize: 12, color: C.soft },
  clock:     { fontSize: 18, fontWeight: '700', color: C.green700 },
  chip:      { width: 34, height: 34, borderRadius: 17, backgroundColor: C.green600, alignItems: 'center', justifyContent: 'center' },
  chipText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  adminBadge:{ backgroundColor: C.green50, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
  adminBadgeText: { fontSize: 11, color: C.green700, fontWeight: '600' },
  cols:      { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  leftCol:   { flex: 2 },
  rightCol:  { flex: 1, minWidth: 280 },
});

export default AdminDashboard;
