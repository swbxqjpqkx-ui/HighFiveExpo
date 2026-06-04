import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useWindowDimensions,
  TouchableOpacity, TextInput, ActivityIndicator, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { mockMeetings, mockDeadlines, mockTasks } from '../mock';
import { computeWarnings } from '../utils/warnings';
import { Profile, Course, Task, TeacherStats, StudentWithEnrollments, NewsArticle } from '../types';
import { Colors, Spacing, Radius, Green, Ink, Tint } from '../theme';
import { fetchCourseNews, getProfessorNewsPreferences } from '../services/newsService';
import CalendarWidget from '../components/CalendarWidget';

// ─── Local colour tokens ─────────────────────────────────────────────────────
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

// ─── Shared Card shell ────────────────────────────────────────────────────────
interface CardProps {
  icon: string;
  title: string;
  onViewAll?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}
const Card: React.FC<CardProps> = ({ icon, title, onViewAll, children, footer }) => (
  <View style={cs.card}>
    <View style={cs.cardHead}>
      <View style={cs.cardTitleRow}>
        <View style={cs.cardIconBox}><Text style={cs.cardIconText}>{icon}</Text></View>
        <Text style={cs.cardTitleText}>{title}</Text>
      </View>
      {onViewAll && (
        <TouchableOpacity onPress={onViewAll}>
          <Text style={cs.viewAll}>View all →</Text>
        </TouchableOpacity>
      )}
    </View>
    <View style={cs.cardBody}>{children}</View>
    {footer}
  </View>
);

// ─── Course Control ───────────────────────────────────────────────────────────
const COURSE_ICONS = ['📗', '📘', '📙', '📕', '🧪', '🔬', '📓', '📔'];
function gradeColor(pct: number) {
  if (pct >= 75) return C.green600;
  if (pct >= 65) return C.amber;
  return C.red;
}
function gradeBarColor(pct: number) {
  if (pct >= 75) return '#2a8a4d';
  if (pct >= 65) return C.amber;
  return C.red;
}
function gradePillStyle(pct: number) {
  if (pct >= 75) return { bg: '#e3f1e7', color: '#1d6e3a' };
  if (pct >= 65) return { bg: '#fbf1da', color: '#8e6212' };
  return { bg: '#fbe2e0', color: '#a73a32' };
}

interface CourseControlProps {
  courses: Course[];
  teacherStats: TeacherStats | null;
  onViewAll: () => void;
}
const CourseControlCard: React.FC<CourseControlProps> = ({ courses, teacherStats, onViewAll }) => {
  const totalStudents = teacherStats?.total_students
    ?? courses.reduce((s, c) => s + (c.student_count ?? 0), 0);
  const avgGrade = courses.length > 0
    ? Math.round(courses.reduce((s, c) => s + (c.completion_rate ?? 0), 0) / courses.length)
    : 0;

  return (
    <Card icon="📚" title="COURSE CONTROL" onViewAll={onViewAll}>
      {/* Summary mini-grid */}
      <View style={cc.summary}>
        <View style={cc.summaryCell}>
          <Text style={cc.summaryLabel}>Courses</Text>
          <Text style={[cc.summaryValue, { color: C.green700 }]}>{courses.length}</Text>
        </View>
        <View style={cc.summaryCell}>
          <Text style={cc.summaryLabel}>Total students</Text>
          <Text style={[cc.summaryValue, { color: C.green700 }]}>{totalStudents}</Text>
        </View>
        <View style={cc.summaryCell}>
          <Text style={cc.summaryLabel}>Avg. grade</Text>
          <Text style={[cc.summaryValue, { color: gradeColor(avgGrade) }]}>{avgGrade}%</Text>
        </View>
      </View>

      {/* Course rows */}
      {courses.slice(0, 6).map((course, i) => {
        const pct = course.completion_rate ?? 0;
        const pill = gradePillStyle(pct);
        return (
          <View key={course.id} style={cc.courseRow}>
            <View style={cc.courseIconBox}>
              <Text style={cc.courseIconText}>{COURSE_ICONS[i % COURSE_ICONS.length]}</Text>
            </View>
            <View style={cc.courseInfo}>
              <Text style={cc.courseName} numberOfLines={1}>{course.name}</Text>
              <Text style={cc.courseSub}>
                {course.student_count ?? 0} students
                {course.program ? `  ·  ${course.program}` : ''}
              </Text>
            </View>
            <View style={cc.progressWrap}>
              <View style={cc.progressBg}>
                <View style={[cc.progressFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: gradeBarColor(pct) }]} />
              </View>
            </View>
            <View style={[cc.gradePill, { backgroundColor: pill.bg }]}>
              <Text style={[cc.gradePillText, { color: pill.color }]}>{pct}%</Text>
            </View>
          </View>
        );
      })}

      {courses.length === 0 && (
        <Text style={cc.empty}>No courses yet</Text>
      )}
    </Card>
  );
};

// ─── Personal Calendar ────────────────────────────────────────────────────────
const CAL_TINTS = [
  { bg: '#eaf5ec', border: '#d3eadb', dot: C.green600 },
  { bg: '#fbf2dd', border: '#f3e4bc', dot: C.amber    },
  { bg: '#fbe7e6', border: '#f1cfcd', dot: C.red      },
  { bg: '#ede8fa', border: '#ddd4f5', dot: C.purple   },
  { bg: '#ddeef9', border: '#c0dcf0', dot: C.blue     },
];

const PersonalCalendarCard: React.FC = () => {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const events = [
    ...mockMeetings.map((m, i) => ({ title: m.title, time: m.time, where: 'Room / Online', tint: CAL_TINTS[i % CAL_TINTS.length] })),
    ...mockDeadlines.slice(0, 2).map((d, i) => ({ title: d.title, time: 'All day', where: 'Deadline', tint: CAL_TINTS[(mockMeetings.length + i) % CAL_TINTS.length] })),
  ].slice(0, 4);

  return (
    <Card icon="📅" title="PERSONAL CALENDAR">
      <Text style={cal.sub}>{dateStr}</Text>
      {events.map((ev, idx) => (
        <View key={idx} style={cal.row}>
          {/* Time */}
          <View style={cal.timeCol}>
            <Text style={cal.time}>{ev.time}</Text>
          </View>
          {/* Rail */}
          <View style={cal.rail}>
            <View style={[cal.dot, { backgroundColor: ev.tint.dot }]} />
            {idx < events.length - 1 && <View style={cal.line} />}
          </View>
          {/* Event card */}
          <View style={[cal.eventCard, { backgroundColor: ev.tint.bg, borderColor: ev.tint.border }]}>
            <Text style={cal.eventName}>{ev.title}</Text>
            <Text style={cal.eventWhere}>{ev.where}</Text>
          </View>
        </View>
      ))}
      {/* Tap a day to see that day's events / deadlines */}
      <View style={cal.widgetWrap}>
        <CalendarWidget meetings={mockMeetings} deadlines={mockDeadlines} />
      </View>
    </Card>
  );
};

// ─── Tasks ────────────────────────────────────────────────────────────────────
function priorityStyle(p?: string) {
  if (p === 'high')   return { bg: '#fbe2e0', color: '#a73a32' };
  if (p === 'medium') return { bg: '#fbf1da', color: '#8e6212' };
  return { bg: '#e3f1e7', color: '#1d6e3a' };
}

interface TasksCardProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}
const TasksCard: React.FC<TasksCardProps> = ({ tasks, onTasksChange }) => {
  const [draft, setDraft] = useState('');

  const toggle = (id: string) =>
    onTasksChange(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));

  const add = () => {
    if (!draft.trim()) return;
    onTasksChange([...tasks, {
      id: `t${Date.now()}`, title: draft.trim(),
      completed: false, created_at: new Date().toISOString(),
      priority: 'low', due: 'Due: Soon',
    }]);
    setDraft('');
  };

  const footer = (
    <View style={tk.addRow}>
      <TextInput
        style={tk.addInput}
        placeholder="Add a new task…"
        placeholderTextColor={C.soft}
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={add}
        returnKeyType="done"
      />
      <TouchableOpacity
        style={[tk.addBtn, !draft.trim() && tk.addBtnDisabled]}
        onPress={add}
        disabled={!draft.trim()}
      >
        <Text style={tk.addBtnText}>Add</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Card icon="✅" title="TASKS" footer={footer}>
      {tasks.map((t, idx) => {
        const ps = priorityStyle(t.priority);
        return (
          <View key={t.id} style={[tk.taskRow, idx > 0 && tk.taskRowBorder, t.completed && tk.taskRowDone]}>
            <TouchableOpacity style={[tk.checkbox, t.completed && tk.checkboxDone]} onPress={() => toggle(t.id)}>
              {t.completed && <Text style={tk.checkmark}>✓</Text>}
            </TouchableOpacity>
            <View style={tk.taskBody}>
              <Text style={[tk.taskTitle, t.completed && tk.taskTitleDone]} numberOfLines={2}>{t.title}</Text>
              {t.due && <Text style={tk.taskDue}>{t.due}</Text>}
            </View>
            {t.priority && (
              <View style={[tk.badge, { backgroundColor: ps.bg }]}>
                <Text style={[tk.badgeText, { color: ps.color }]}>{t.priority.toUpperCase()}</Text>
              </View>
            )}
          </View>
        );
      })}
    </Card>
  );
};

// ─── Course News Preview ──────────────────────────────────────────────────────
const nwRelTime = (iso: string): string => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

interface CourseNewsPreviewCardProps {
  courses: Course[];
  professorId: string;
  onViewAll: () => void;
}
const CourseNewsPreviewCard: React.FC<CourseNewsPreviewCardProps> = ({ courses, professorId, onViewAll }) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prefs = await getProfessorNewsPreferences(professorId);
        const { articles: fetched } = await fetchCourseNews(courses, professorId, prefs);
        if (!cancelled) setArticles(fetched.slice(0, 3));
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [professorId, courses]);

  const handleRead = async (url: string) => {
    try {
      if (await Linking.canOpenURL(url)) Linking.openURL(url);
    } catch { /* silent */ }
  };

  return (
    <Card icon="📰" title="COURSE NEWS" onViewAll={onViewAll}>
      {loading ? (
        <View style={nw.loadingRow}>
          <ActivityIndicator color={C.green600} size="small" />
          <Text style={nw.loadingText}>Loading course news…</Text>
        </View>
      ) : articles.length === 0 ? (
        <Text style={nw.empty}>No recent articles found for your courses.</Text>
      ) : (
        articles.map((a, i) => (
          <TouchableOpacity
            key={a.id}
            style={[nw.row, i > 0 && nw.rowBorder]}
            activeOpacity={0.75}
            onPress={() => handleRead(a.url)}
          >
            <View style={nw.sourceBox}>
              <Text style={nw.sourceLetter}>{a.sourceName.charAt(0)}</Text>
            </View>
            <View style={nw.body}>
              <Text style={nw.title} numberOfLines={2}>{a.title}</Text>
              <Text style={nw.meta}>{a.sourceName}  ·  {nwRelTime(a.publishedAt)}</Text>
              {!!a.relatedCourseName && (
                <Text style={nw.course} numberOfLines={1}>{a.relatedCourseName}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))
      )}
    </Card>
  );
};

// ─── Main HomeScreen ──────────────────────────────────────────────────────────
interface Props {
  profile: Profile;
  courses: Course[];
  teacherStats: TeacherStats | null;
  students: StudentWithEnrollments[];
}

const HomeScreen: React.FC<Props> = ({ profile, courses, teacherStats, students }) => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [location, setLocation] = useState<string | undefined>();

  const warnings = computeWarnings(students, courses);
  const unreadCount = warnings.filter(w => w.severity === 'high').length;

  const firstName = profile.full_name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const initials = profile.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '??';

  useEffect(() => { requestLocation(); }, []);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocation('Location unavailable'); return; }
      const loc = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (place) {
        const city = place.city || place.subregion || place.region || 'Unknown city';
        setLocation(`${city}${place.country ? ', ' + place.country : ''}`);
      } else { setLocation('Location unavailable'); }
    } catch { setLocation('Location unavailable'); }
  };

  return (
    <ScrollView style={hs.container} contentContainerStyle={hs.content}>

      {/* ── Topbar ── */}
      <View style={hs.topbar}>
        <View>
          <Text style={hs.greeting}>{timeGreeting}, {firstName}! 👋</Text>
          <Text style={hs.greetingSub}>
            {location ? `📍 ${location}  ·  ` : ''}Here's what's happening today.
          </Text>
        </View>
        <View style={hs.topbarRight}>
          {unreadCount > 0 && (
            <TouchableOpacity style={hs.alertChip} onPress={() => navigation.navigate('Warnings')}>
              <Text style={hs.alertChipText}>⚠️  {unreadCount} alert{unreadCount !== 1 ? 's' : ''}</Text>
            </TouchableOpacity>
          )}
          <View style={hs.userChip}>
            <View style={hs.avatar}>
              <Text style={hs.avatarText}>{initials}</Text>
            </View>
            <View style={hs.userMeta}>
              <Text style={hs.userName} numberOfLines={1}>{profile.full_name}</Text>
              <Text style={hs.userRole}>Teacher</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Dashboard Grid ── */}
      <View style={isWide ? hs.grid : undefined}>
        {/* Left column */}
        <View style={isWide ? hs.leftCol : undefined}>
          <CourseControlCard
            courses={courses}
            teacherStats={teacherStats}
            onViewAll={() => navigation.navigate('Courses')}
          />
          <CourseNewsPreviewCard
            courses={courses}
            professorId={profile.id}
            onViewAll={() => navigation.navigate('News')}
          />
        </View>

        {/* Right column */}
        <View style={isWide ? hs.rightCol : undefined}>
          <PersonalCalendarCard />
          <TasksCard tasks={tasks} onTasksChange={setTasks} />
        </View>
      </View>

    </ScrollView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

// Shared card styles
const cs = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 12, marginBottom: 12,
    shadowColor: C.green900, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIconBox: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: C.green50, alignItems: 'center', justifyContent: 'center',
  },
  cardIconText: { fontSize: 14 },
  cardTitleText: { fontFamily: 'Montserrat-Bold', fontSize: 10.5, color: C.text, letterSpacing: 1.2, textTransform: 'uppercase' },
  viewAll: { fontFamily: 'Montserrat-SemiBold', fontSize: 12, color: C.green700 },
  cardBody: {},
});

// Course control
const cc = StyleSheet.create({
  summary: {
    flexDirection: 'row', backgroundColor: C.green50,
    borderRadius: 10, padding: 10, marginBottom: 10, gap: 4,
  },
  summaryCell: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 10, color: C.muted, marginBottom: 2 },
  summaryValue: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  courseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8,
  },
  courseIconBox: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: C.green50, alignItems: 'center', justifyContent: 'center',
  },
  courseIconText: { fontSize: 16 },
  courseInfo: { flex: 1, minWidth: 0 },
  courseName: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 2 },
  courseSub: { fontSize: 11, color: C.muted },
  progressWrap: { width: 72 },
  progressBg: { height: 6, backgroundColor: C.green50, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  gradePill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, minWidth: 46, alignItems: 'center' },
  gradePillText: { fontSize: 11, fontWeight: '700' },
  empty: { fontSize: 13, color: C.muted, textAlign: 'center', paddingVertical: 16 },
});

// Calendar
const cal = StyleSheet.create({
  sub: { fontSize: 11, color: C.muted, marginBottom: 10 },
  widgetWrap: { marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 6, gap: 8 },
  timeCol: { width: 52, paddingTop: 8 },
  time: { fontSize: 10, color: C.muted, lineHeight: 14 },
  rail: { alignItems: 'center', paddingTop: 10, width: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { width: 1, flex: 1, backgroundColor: C.border, marginTop: 3 },
  eventCard: { flex: 1, borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  eventName: { fontSize: 12, fontWeight: '600', color: C.text, marginBottom: 1 },
  eventWhere: { fontSize: 10.5, color: C.muted },
});

// Tasks
const tk = StyleSheet.create({
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  taskRowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  taskRowDone: { opacity: 0.6 },
  checkbox: {
    width: 18, height: 18, borderRadius: 5,
    borderWidth: 1.5, borderColor: C.borderSt,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: C.green600, borderColor: C.green600 },
  checkmark: { color: '#fff', fontSize: 11, fontWeight: '700' },
  taskBody: { flex: 1 },
  taskTitle: { fontSize: 12.5, fontWeight: '500', color: C.text, lineHeight: 16 },
  taskTitleDone: { textDecorationLine: 'line-through', color: C.soft },
  taskDue: { fontSize: 10.5, color: C.muted, marginTop: 1 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  addRow: {
    flexDirection: 'row', gap: 6, marginTop: 8,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border,
  },
  addInput: {
    flex: 1, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bg, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    fontSize: 12, color: C.text,
  },
  addBtn: {
    backgroundColor: C.green700, borderRadius: 8,
    paddingHorizontal: 14, justifyContent: 'center',
  },
  addBtnDisabled: { backgroundColor: C.borderSt },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
});

// Course news preview
const nw = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  rowBorder:   { borderTopWidth: 1, borderTopColor: C.border },
  sourceBox: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: C.green700, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sourceLetter: { color: '#fff', fontWeight: '800', fontSize: 14 },
  body:    { flex: 1 },
  title:   { fontSize: 12.5, fontWeight: '600', color: C.text, lineHeight: 17, marginBottom: 2 },
  meta:    { fontSize: 10.5, color: C.muted },
  course:  { fontSize: 10.5, color: C.green700, fontWeight: '500', marginTop: 1 },
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  loadingText: { fontSize: 12, color: C.muted },
  empty:   { fontSize: 12, color: C.muted, textAlign: 'center', paddingVertical: 16 },
});

// HomeScreen layout
const hs = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16 },

  topbar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8,
  },
  greeting: { fontFamily: 'Montserrat-Bold', fontSize: 19, color: C.text, letterSpacing: -0.2, marginBottom: 2 },
  greetingSub: { fontFamily: 'Montserrat-Medium', fontSize: 12, color: C.muted },
  topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  alertChip: {
    backgroundColor: '#fbe2e0', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#f1cfcd',
  },
  alertChipText: { fontSize: 12, fontWeight: '600', color: '#a73a32' },

  userChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 999,
    paddingLeft: 4, paddingRight: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: C.border,
  },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.green700, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  userMeta: { gap: 1 },
  userName: { fontSize: 13, fontWeight: '600', color: C.text, maxWidth: 130 },
  userRole: { fontSize: 11, color: C.muted },

  grid: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  leftCol: { flex: 2.1, minWidth: 0 },
  rightCol: { flex: 1, minWidth: 220 },
});

export default HomeScreen;
