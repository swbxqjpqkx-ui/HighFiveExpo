import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useWindowDimensions,
  TouchableOpacity, TextInput, ActivityIndicator, Linking, Platform, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Profile, AdminTask, AdminCalendarEvent, OpenDayStat } from '../../types';
import {
  getStudentStats, getOpenDayStats, getAdminCalendarEvents, getAdminTasksList,
} from '../../services/supabase';
import { useInstitution } from '../../context/InstitutionContext';
import {
  AdminNewsArticle, CATEGORY_COLORS, CATEGORY_LABELS,
  getTopAdminNews, togglePinAdminArticle,
} from '../../services/adminNewsService';
import { Green, Ink, Tint } from '../../theme';
import { getUpcomingCalendarItemsForHome } from '../../utils/homeCalendar';

const C = {
  green50:  Green[50],
  green100: Green[100],
  green600: Green[600],
  green700: Green[700],
  green900: Green[900],
  text:     Ink.base,
  muted:    Ink[3],
  soft:     Ink[4],
  border:   Ink.line,
  borderSt: Ink.line2,
  red:      Tint.rose.ink,
  amber:    Tint.sun.ink,
  blue:     Tint.sky.ink,
  purple:   Tint.violet.ink,
  card:     Ink.surface,
  bg:       Ink.bg,
};

// ── Tone helpers ──────────────────────────────────────────────────────────────
type Tone = 'good' | 'info' | 'warn' | 'danger';

const toneBg: Record<Tone, string> = {
  danger: Tint.rose.bg,
  good:   Tint.mint.bg,
  info:   Tint.sky.bg,
  warn:   Tint.sun.bg,
};
const toneBorder: Record<Tone, string> = {
  danger: Tint.rose.line,
  good:   Tint.mint.line,
  info:   Tint.sky.line,
  warn:   Tint.sun.line,
};
const toneBar: Record<Tone, string> = {
  danger: Tint.rose.ink,
  good:   Tint.mint.ink,
  info:   Tint.sky.ink,
  warn:   Tint.sun.ink,
};
const toneText: Record<Tone, string> = {
  danger: Tint.rose.ink,
  good:   Tint.mint.ink,
  info:   Tint.sky.ink,
  warn:   Tint.sun.ink,
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
    borderRadius: 14,
    padding: 18,
    gap: 4,
  },
  label:  { fontFamily: 'Montserrat-SemiBold', fontSize: 11.5, letterSpacing: 0.35 },
  value:  { fontFamily: 'Montserrat-Bold', fontSize: 32, letterSpacing: -1.2, lineHeight: 36 },
  trend:  { fontFamily: 'Montserrat-Medium', fontSize: 11.5, color: C.soft },
  bar:    { height: 3, borderRadius: 2, width: '70%', marginTop: 6 },
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
    borderRadius: 14,
    padding: 18,
    gap: 4,
  },
  icon:  { fontSize: 20 },
  label: { fontFamily: 'Montserrat-SemiBold', fontSize: 12, color: C.muted, flexShrink: 1 },
  value: { fontFamily: 'Montserrat-Bold', fontSize: 30, letterSpacing: -1.2 },
  trend: { fontFamily: 'Montserrat-Medium', fontSize: 11.5, color: C.soft },
});

// ── Professors Overview Card ──────────────────────────────────────────────────
const ProfessorsOverviewCard: React.FC = () => {
  const navigation = useNavigation<any>();
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('AdminAccreditation')} style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.title}>Course Management</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminAccreditation')}>
          <Text style={cardStyles.viewAll}>View all →</Text>
        </TouchableOpacity>
      </View>
      <View style={cardStyles.row}>
        <ProfTile label="Courses Below Benchmark"       value={7}  tone="danger" icon="📉" trend="↑ 2 from last week" accent={C.red}      />
        <ProfTile label="Professors Requiring Support"  value={4}  tone="warn"   icon="⚠️" trend="→ unchanged"        accent={C.amber}    />
        <ProfTile label="Pending Approvals"             value={12} tone="info"   icon="📋" trend="↑ 5 new today"      accent={C.blue}     />
      </View>
    </TouchableOpacity>
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
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  nextLabel:  { fontFamily: 'Montserrat-Bold', fontSize: 10.5, color: Green[300], textTransform: 'uppercase', letterSpacing: 1.47 },
  bigDay:     { fontFamily: 'Montserrat-Bold', fontSize: 56, color: '#fff', lineHeight: 60, letterSpacing: -2.5 },
  month:      { fontFamily: 'Montserrat-SemiBold', fontSize: 16, color: Green[200] },
  pill:       { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  pillText:   { fontFamily: 'Montserrat-SemiBold', fontSize: 11, color: '#fff' },
  statsGrid:  { flex: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell:   { width: '46%', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, gap: 2 },
  statVal:    { fontFamily: 'Montserrat-Bold', fontSize: 24, color: C.text, letterSpacing: -0.8 },
  statLbl:    { fontFamily: 'Montserrat-Medium', fontSize: 12, color: C.muted },
  capBar:     { height: 6, backgroundColor: C.border, borderRadius: 3, marginTop: 6, width: '100%' },
  capFill:    { height: 6, backgroundColor: Green[500], borderRadius: 3 },
});

// ── Calendar Timeline Card ────────────────────────────────────────────────────
interface CalendarCardProps { events: AdminCalendarEvent[]; }

const CalendarTimelineCard: React.FC<CalendarCardProps> = ({ events }) => {
  const navigation = useNavigation<any>();
  // Upcoming-only from the real admin_calendar records: finished events drop off,
  // today's upcoming shown in full, otherwise the closest 4 future records.
  const upcoming = getUpcomingCalendarItemsForHome(events);
  return (
    <TouchableOpacity activeOpacity={1} style={cardStyles.card} onPress={() => navigation.navigate('AdminCalendar')}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.title}>Today's Calendar</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminCalendar')}>
          <Text style={cardStyles.viewAll}>View all →</Text>
        </TouchableOpacity>
      </View>
      {upcoming.length === 0 ? (
        <Text style={calStyles.empty}>No upcoming plans yet.</Text>
      ) : (
        upcoming.map((ev, idx) => (
          <TouchableOpacity
            key={ev.id}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('AdminCalendar', { focusDate: ev.date, focusNonce: Date.now() })}
            style={calStyles.row}
          >
            {/* Time */}
            <Text style={calStyles.time}>{ev.time}</Text>
            {/* Rail */}
            <View style={calStyles.rail}>
              <View style={[calStyles.dot, { backgroundColor: ev.color ?? C.green600 }]} />
              {idx < upcoming.length - 1 && <View style={calStyles.line} />}
            </View>
            {/* Event card */}
            <View style={[calStyles.evCard, { backgroundColor: (ev.color ?? C.green600) + '18' }]}>
              <Text style={[calStyles.evTitle, { color: ev.color ?? C.green600 }]}>{ev.title}</Text>
              <Text style={calStyles.evLoc}>📍 {ev.location}</Text>
              {ev.end_time && <Text style={calStyles.evTime}>{ev.time} – {ev.end_time}</Text>}
            </View>
          </TouchableOpacity>
        ))
      )}
    </TouchableOpacity>
  );
};

const calStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  time:    { width: 44, fontFamily: 'Montserrat-Bold', fontSize: 13, color: C.text, paddingTop: 11, textAlign: 'right' },
  rail:    { alignItems: 'center', width: 16, paddingTop: 13 },
  dot:     { width: 8, height: 8, borderRadius: 4 },
  line:    { width: 2, flex: 1, backgroundColor: C.border, marginTop: 2, minHeight: 30 },
  evCard:  { flex: 1, borderRadius: 10, padding: 11, gap: 2 },
  evTitle: { fontFamily: 'Montserrat-Bold', fontSize: 13, lineHeight: 18 },
  evLoc:   { fontFamily: 'Montserrat-Medium', fontSize: 11, color: C.muted },
  evTime:  { fontFamily: 'Montserrat-SemiBold', fontSize: 10.5, color: C.soft, marginTop: 4 },
  empty:   { fontFamily: 'Montserrat-Medium', fontSize: 13, color: C.muted, textAlign: 'center', paddingVertical: 12 },
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
    <TouchableOpacity activeOpacity={1} style={cardStyles.card} onPress={() => navigation.navigate('AdminTasks')}>
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
    </TouchableOpacity>
  );
};

const taskStyles = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  checkbox:    { width: 20, height: 20, borderRadius: 6, borderWidth: 1.6, borderColor: C.borderSt, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkboxDone:{ backgroundColor: Green[500], borderColor: Green[500] },
  checkMark:   { color: '#fff', fontSize: 11, fontFamily: 'Montserrat-Bold' },
  body:        { flex: 1, gap: 3 },
  title:       { fontFamily: 'Montserrat-SemiBold', fontSize: 13, color: C.text, lineHeight: 18 },
  done:        { textDecorationLine: 'line-through', color: C.soft },
  due:         { fontFamily: 'Montserrat-Medium', fontSize: 11, color: C.soft },
  badge:       { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText:   { fontFamily: 'Montserrat-ExtraBold', fontSize: 9.5, letterSpacing: 0.8 },
  addRow:      { flexDirection: 'row', gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border },
  input:       { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, fontFamily: 'Montserrat-Medium', fontSize: 12.5, color: C.text, backgroundColor: '#fafcfa' },
  addBtn:      { backgroundColor: Green[700], borderRadius: 9, width: 36, alignItems: 'center', justifyContent: 'center' },
  addBtnText:  { color: '#fff', fontSize: 22, fontWeight: '300', lineHeight: 28 },
});

// ── Card shared styles ────────────────────────────────────────────────────────
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 22,
    marginBottom: 18,
    shadowColor: Ink.base,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:   { fontFamily: 'Montserrat-Bold', fontSize: 15, color: C.text, letterSpacing: -0.1 },
  viewAll: { fontFamily: 'Montserrat-SemiBold', fontSize: 12, color: C.green700, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  row:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});

// ── News preview card ─────────────────────────────────────────────────────────
const openArticleUrl = (url: string) => {
  if (Platform.OS === 'web') {
    (window as any).open(url, '_blank', 'noopener,noreferrer');
  } else {
    Linking.openURL(url).catch(() => Alert.alert('Could not open article.'));
  }
};

const fmtNewsDate = (iso: string) => {
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / 3_600_000;
  if (diffH < 24)  return `${Math.round(diffH)}h ago`;
  if (diffH < 48)  return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

interface NewsPreviewCardProps {
  articles:   AdminNewsArticle[];
  loading:    boolean;
  adminId:    string;
  onPin:      (a: AdminNewsArticle) => void;
}

const NewsPreviewCard: React.FC<NewsPreviewCardProps> = ({ articles, loading, adminId, onPin }) => {
  const navigation = useNavigation<any>();

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.title}>Latest Education & Accreditation News</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminNews')}>
          <Text style={cardStyles.viewAll}>View all →</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={C.green600} style={{ marginVertical: 12 }} />
      ) : articles.length === 0 ? (
        <Text style={npStyles.empty}>No news articles available.</Text>
      ) : (
        articles.map(article => {
          const catColor = CATEGORY_COLORS[article.category] ?? C.green600;
          const catLabel = CATEGORY_LABELS[article.category] ?? article.category;
          return (
            <View key={article.id} style={npStyles.row}>
              {/* Color strip */}
              <View style={[npStyles.strip, { backgroundColor: catColor }]} />
              {/* Content */}
              <View style={npStyles.content}>
                <View style={npStyles.topRow}>
                  <View style={[npStyles.catBadge, { backgroundColor: catColor + '18' }]}>
                    <Text style={[npStyles.catBadgeText, { color: catColor }]}>{catLabel}</Text>
                  </View>
                  {!!article.related_accreditation && (
                    <View style={npStyles.accredTag}>
                      <Text style={npStyles.accredTagText}>{article.related_accreditation}</Text>
                    </View>
                  )}
                  <Text style={npStyles.date}>{fmtNewsDate(article.published_at)}</Text>
                </View>
                <Text style={npStyles.title} numberOfLines={2}>{article.title}</Text>
                <Text style={npStyles.source}>{article.source_name}</Text>
                <View style={npStyles.actions}>
                  <TouchableOpacity
                    style={npStyles.readBtn}
                    onPress={() => openArticleUrl(article.article_url)}
                  >
                    <Text style={npStyles.readBtnText}>Read more →</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onPin(article)}>
                    <Text style={[npStyles.pinIcon, article.isPinned && { color: '#D97706' }]}>
                      {article.isPinned ? '★' : '☆'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
};

const npStyles = StyleSheet.create({
  empty:       { fontFamily: 'Montserrat-Medium', fontSize: 13, color: C.muted, textAlign: 'center', paddingVertical: 12 },
  row:         { flexDirection: 'row', marginBottom: 12, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  strip:       { width: 4 },
  content:     { flex: 1, padding: 10, gap: 4 },
  topRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  catBadge:    { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  catBadgeText:{ fontFamily: 'Montserrat-Bold', fontSize: 10 },
  accredTag:   { backgroundColor: Green[100], borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  accredTagText:{ fontFamily: 'Montserrat-Bold', fontSize: 10, color: Green[700] },
  date:        { fontFamily: 'Montserrat-Medium', fontSize: 10, color: C.soft, marginLeft: 'auto' as any },
  title:       { fontFamily: 'Montserrat-Bold', fontSize: 13, color: C.text, lineHeight: 18 },
  source:      { fontFamily: 'Montserrat-Medium', fontSize: 11, color: C.soft, fontStyle: 'italic' },
  actions:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  readBtn:     { backgroundColor: Green[700], borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
  readBtnText: { fontFamily: 'Montserrat-Bold', fontSize: 12, color: '#fff' },
  pinIcon:     { fontSize: 20, color: 'rgba(26,26,26,0.35)' },
});

// ── Main Dashboard ────────────────────────────────────────────────────────────
interface Props { profile: Profile; }

const AdminDashboard: React.FC<Props> = ({ profile }) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { settings: instSettings } = useInstitution();
  const accreditation = instSettings?.accreditation ?? 'AACSB';

  const [atRisk, setAtRisk]     = useState(0);
  const [avgGrade, setAvgGrade] = useState(78);
  const [openDay, setOpenDay]   = useState<OpenDayStat | null>(null);
  const [events, setEvents]     = useState<AdminCalendarEvent[]>([]);
  const [tasks, setTasks]       = useState<AdminTask[]>([]);
  const [loading, setLoading]   = useState(true);
  const [location, setLocation] = useState('Fetching location…');
  const [timeStr, setTimeStr]   = useState('');
  const [dateStr, setDateStr]   = useState('');

  // News preview state
  const [newsArticles,  setNewsArticles]  = useState<AdminNewsArticle[]>([]);
  const [newsLoading,   setNewsLoading]   = useState(true);

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

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const top = await getTopAdminNews(profile.id, accreditation, 3);
      setNewsArticles(top);
    } catch {
      // silently keep empty
    } finally {
      setNewsLoading(false);
    }
  }, [profile.id, accreditation]);

  const handleNewsPin = async (article: AdminNewsArticle) => {
    const next = await togglePinAdminArticle(profile.id, article);
    setNewsArticles(prev => prev.map(a => a.id === article.id ? { ...a, isPinned: next } : a));
  };

  useEffect(() => { loadData(); loadNews(); }, [loadData, loadNews]);

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
      <NewsPreviewCard
        articles={newsArticles}
        loading={newsLoading}
        adminId={profile.id}
        onPin={handleNewsPin}
      />
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
  content:   { padding: 20, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft:{ flex: 1 },
  headerRight:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  greeting:  { fontFamily: 'Montserrat-Bold', fontSize: 24, color: C.text, letterSpacing: -0.6 },
  subRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 },
  sub:       { fontFamily: 'Montserrat-Medium', fontSize: 13, color: C.muted },
  loc:       { fontFamily: 'Montserrat-Medium', fontSize: 13, color: C.soft },
  clock:     { fontFamily: 'Montserrat-Bold', fontSize: 18, color: C.text },
  chip:      { width: 38, height: 38, borderRadius: 19, backgroundColor: Green[500], alignItems: 'center', justifyContent: 'center' },
  chipText:  { fontFamily: 'Montserrat-Bold', color: '#fff', fontSize: 13 },
  adminBadge:{ backgroundColor: Green[100], borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Green[200] },
  adminBadgeText: { fontFamily: 'Montserrat-Bold', fontSize: 11, color: Green[800], letterSpacing: 0.4 },
  cols:      { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  leftCol:   { flex: 2 },
  rightCol:  { flex: 1, minWidth: 280 },
});

export default AdminDashboard;
