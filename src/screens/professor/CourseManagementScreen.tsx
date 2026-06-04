import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  useWindowDimensions, SafeAreaView,
} from 'react-native';
import { Course, Profile } from '../../types';
import { CourseSyllabus } from '../../types/courseManagement';
import { getCourseSyllabus } from '../../services/courseManagement';
import { useInstitution } from '../../context/InstitutionContext';
import GuidelinesCheckTab from './tabs/GuidelinesCheckTab';
import MaterialsCheckTab  from './tabs/MaterialsCheckTab';
import OverlapReportsTab  from './tabs/OverlapReportsTab';
import AlertsTab          from './tabs/AlertsTab';
import { Green, Ink, Tint } from '../../theme';

const C = {
  forest: Green[700], leaf: Green[500], mist: Green[50],
  ink: Ink.base, inkMid: Ink[3], inkSoft: Ink[4],
  border: Ink.line, card: Ink.surface, green50: Green[50],
  red: Tint.rose.ink, redBg: Tint.rose.bg,
  amber: Tint.sun.ink, amberBg: Tint.sun.bg,
  blue: Tint.sky.ink,
};

const COURSE_ICONS = ['📗', '📘', '📙', '📕', '🧪', '🔬', '📓', '📔'];

const SYLLABUS_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  none:      { label: 'No Syllabus', bg: C.redBg,   color: C.red    },
  submitted: { label: 'Pending',     bg: C.amberBg, color: C.amber  },
  approved:  { label: 'Approved',    bg: '#EFF6FF',  color: C.blue   },
  locked:    { label: '🔒 Locked',   bg: C.green50, color: C.forest },
  rejected:  { label: 'Rejected',    bg: C.redBg,   color: C.red    },
};

// ── Tab configuration ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'guidelines', label: 'Guidelines Check',  icon: '📋' },
  { key: 'materials',  label: 'Materials Check',   icon: '📂' },
  { key: 'overlaps',   label: 'Overlap Reports',   icon: '🔁' },
  { key: 'alerts',     label: 'Alerts',            icon: '🔔' },
] as const;

type TabKey = typeof TABS[number]['key'];

// ── Props ─────────────────────────────────────────────────────────────────────
// `focus` (optional) is set when a document notification is opened: it points at
// the exact course + the tab that holds the submission, so this screen jumps
// straight there instead of the generic course grid. `nonce` re-triggers it.
interface NotifFocus { courseId?: string; tab?: TabKey; submissionId?: string; nonce?: number }
interface Props {
  courses: Course[];
  profile: Profile;
  focus?: NotifFocus;
}

// ── Course List ───────────────────────────────────────────────────────────────
interface CourseListProps {
  courses: Course[];
  profile: Profile;
  onSelect: (course: Course) => void;
}

const CourseList: React.FC<CourseListProps> = ({ courses, profile, onSelect }) => {
  const { settings } = useInstitution();

  if (courses.length === 0) {
    return (
      <View style={ls.empty}>
        <Text style={ls.emptyIcon}>📚</Text>
        <Text style={ls.emptyTitle}>No courses assigned</Text>
        <Text style={ls.emptyText}>
          Courses are assigned to your account by the administrator. Contact them if you
          believe courses are missing.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={ls.content}>
      {/* Header */}
      <View style={ls.pageHead}>
        <View>
          <Text style={ls.pageTitle}>Course Management</Text>
          <Text style={ls.pageSub}>
            {courses.length} course{courses.length !== 1 ? 's' : ''} assigned to you
            {settings?.accreditation ? ` · ${settings.accreditation} framework` : ''}
          </Text>
        </View>
      </View>

      {/* Accreditation notice */}
      {settings?.accreditation && (
        <View style={ls.accrBadge}>
          <Text style={ls.accrBadgeText}>
            🎓 All course checks follow {settings.accreditation} standards
            {settings.name ? ` for ${settings.name}` : ''}
          </Text>
        </View>
      )}

      {/* Course grid */}
      <View style={ls.grid}>
        {courses.map((course, idx) => (
          <CourseCard
            key={course.id}
            course={course}
            icon={COURSE_ICONS[idx % COURSE_ICONS.length]}
            onPress={() => onSelect(course)}
          />
        ))}
      </View>
    </ScrollView>
  );
};

interface CourseCardProps {
  course: Course;
  icon: string;
  onPress: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, icon, onPress }) => {
  const [syllabus, setSyllabus] = useState<CourseSyllabus | null | undefined>(undefined);

  React.useEffect(() => {
    getCourseSyllabus(course.id)
      .then(setSyllabus)
      .catch(() => setSyllabus(null));
  }, [course.id]);

  const statusKey = syllabus === undefined ? 'none' : (syllabus?.status ?? 'none');
  const badge = SYLLABUS_BADGES[statusKey] ?? SYLLABUS_BADGES['none'];

  return (
    <TouchableOpacity style={cs.card} onPress={onPress} activeOpacity={0.8}>
      <View style={cs.cardTop}>
        <Text style={cs.icon}>{icon}</Text>
        <View style={[cs.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[cs.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>
      <Text style={cs.name} numberOfLines={2}>{course.name}</Text>
      {(course.program || course.semester) && (
        <Text style={cs.meta}>
          {[course.program, course.semester].filter(Boolean).join(' · ')}
        </Text>
      )}
      <View style={cs.footer}>
        {course.student_count !== undefined && (
          <Text style={cs.footerStat}>👩‍🎓 {course.student_count}</Text>
        )}
        <Text style={cs.openLink}>Open →</Text>
      </View>
    </TouchableOpacity>
  );
};

// ── Course Detail (tab view) ──────────────────────────────────────────────────
interface DetailProps {
  course: Course;
  profile: Profile;
  initialTab?: TabKey;
  focusNonce?: number;
  onBack: () => void;
}

const CourseDetail: React.FC<DetailProps> = ({ course, profile, initialTab, focusNonce, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? 'guidelines');
  const [syllabus, setSyllabus]   = useState<CourseSyllabus | null>(null);
  const { width } = useWindowDimensions();

  // When arriving from a notification, open the tab that holds the submission.
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab, focusNonce]);

  const handleSyllabusChange = useCallback((s: CourseSyllabus | null) => {
    setSyllabus(s);
  }, []);

  return (
    <View style={ds.container}>
      {/* ── Back + course header ── */}
      <View style={ds.header}>
        <TouchableOpacity style={ds.backBtn} onPress={onBack}>
          <Text style={ds.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={ds.headerInfo}>
          <Text style={ds.headerTitle} numberOfLines={1}>{course.name}</Text>
          <Text style={ds.headerSub}>
            {[course.program, course.semester].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {syllabus && (
          <View style={[
            ds.syllabusChip,
            { backgroundColor: SYLLABUS_BADGES[syllabus.status]?.bg ?? C.green50 },
          ]}>
            <Text style={[
              ds.syllabusChipText,
              { color: SYLLABUS_BADGES[syllabus.status]?.color ?? C.forest },
            ]}>
              {SYLLABUS_BADGES[syllabus.status]?.label ?? syllabus.status}
            </Text>
          </View>
        )}
      </View>

      {/* ── Tab bar ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={ds.tabBar}
        contentContainerStyle={ds.tabBarContent}
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const isDisabled = tab.key === 'materials' && (!syllabus || syllabus.status !== 'locked');
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                ds.tab,
                isActive && ds.tabActive,
                isDisabled && ds.tabDisabled,
              ]}
              onPress={() => !isDisabled && setActiveTab(tab.key)}
              activeOpacity={isDisabled ? 1 : 0.7}
            >
              <Text style={ds.tabIcon}>{tab.icon}</Text>
              <Text style={[ds.tabLabel, isActive && ds.tabLabelActive, isDisabled && ds.tabLabelDisabled]}>
                {tab.label}
              </Text>
              {isActive && <View style={ds.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Tab content ── */}
      <View style={ds.tabContent}>
        {activeTab === 'guidelines' && (
          <GuidelinesCheckTab
            course={course}
            profile={profile}
            syllabus={syllabus}
            onSyllabusChange={handleSyllabusChange}
          />
        )}
        {activeTab === 'materials' && (
          <MaterialsCheckTab course={course} profile={profile} syllabus={syllabus} />
        )}
        {activeTab === 'overlaps' && (
          <OverlapReportsTab course={course} profile={profile} />
        )}
        {activeTab === 'alerts' && (
          <AlertsTab course={course} profile={profile} />
        )}
      </View>
    </View>
  );
};

// ── Root Screen ───────────────────────────────────────────────────────────────
const CourseManagementScreen: React.FC<Props> = ({ courses, profile, focus }) => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  // Auto-open the exact course a document notification points to.
  useEffect(() => {
    if (!focus?.courseId) return;
    const match = courses.find(c => c.id === focus.courseId);
    if (match) setSelectedCourse(match);
  }, [focus?.nonce, focus?.courseId, courses]);

  if (selectedCourse) {
    return (
      <CourseDetail
        course={selectedCourse}
        profile={profile}
        initialTab={focus?.courseId === selectedCourse.id ? focus?.tab : undefined}
        focusNonce={focus?.nonce}
        onBack={() => setSelectedCourse(null)}
      />
    );
  }

  return (
    <CourseList
      courses={courses}
      profile={profile}
      onSelect={setSelectedCourse}
    />
  );
};

// ── Styles: List ──────────────────────────────────────────────────────────────
const ls = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  pageHead:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  pageTitle:{ fontSize: 22, fontWeight: '800', color: C.ink },
  pageSub:  { fontSize: 12, color: C.inkMid, marginTop: 2 },
  accrBadge:{
    backgroundColor: C.green50, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, padding: 10, marginBottom: 14,
  },
  accrBadgeText: { fontSize: 12, color: C.forest, fontWeight: '600' },
  grid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 8 },
  emptyText:  { fontSize: 13, color: C.inkMid, textAlign: 'center', lineHeight: 19 },
});

// ── Styles: Course Card ───────────────────────────────────────────────────────
const cs = StyleSheet.create({
  card: {
    width: '47%', backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  icon:          { fontSize: 28 },
  statusBadge:   { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText:{ fontSize: 10, fontWeight: '700' },
  name:          { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 4, lineHeight: 20 },
  meta:          { fontSize: 11, color: C.inkMid, marginBottom: 8 },
  footer:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerStat:    { fontSize: 11, color: C.inkSoft },
  openLink:      { fontSize: 12, color: C.forest, fontWeight: '700' },
});

// ── Styles: Detail ────────────────────────────────────────────────────────────
const ds = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.mist },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  backBtn:      { paddingRight: 8, paddingVertical: 4 },
  backText:     { fontSize: 14, color: C.forest, fontWeight: '600' },
  headerInfo:   { flex: 1 },
  headerTitle:  { fontSize: 15, fontWeight: '700', color: C.ink },
  headerSub:    { fontSize: 11, color: C.inkMid, marginTop: 1 },
  syllabusChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  syllabusChipText: { fontSize: 11, fontWeight: '700' },

  tabBar:        { backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, maxHeight: 50 },
  tabBarContent: { paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 14, position: 'relative',
  },
  tabActive:    {},
  tabDisabled:  { opacity: 0.35 },
  tabIcon:      { fontSize: 14 },
  tabLabel:     { fontSize: 12, color: C.inkMid, fontWeight: '500', whiteSpace: 'nowrap' } as any,
  tabLabelActive:  { color: C.forest, fontWeight: '700' },
  tabLabelDisabled:{ color: C.inkSoft },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 8, right: 8,
    height: 2, backgroundColor: C.forest, borderRadius: 1,
  },
  tabContent: { flex: 1 },
});

export default CourseManagementScreen;
