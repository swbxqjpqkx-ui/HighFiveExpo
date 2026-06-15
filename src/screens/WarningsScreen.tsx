import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput,
  Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Profile, Course } from '../types';
import { useInstitution } from '../context/InstitutionContext';
import CourseStudentDetailModal from '../components/CourseStudentDetailModal';
import {
  RiskWarning, RiskSettings, ProfessorEmptyReason,
  fetchProfessorAtRiskStudents,
  resolveWarning,
  buildCourseHelpEmail, buildAbsencePolicyEmail,
} from '../services/riskService';
import { sendWarningEmail } from '../services/professorWarningEmailService';

// `focus` (optional) is set when the professor opens a "student at risk"
// notification: it points at the exact student (+ course) so this screen can
// scroll to and gently highlight that warning card. `nonce` re-triggers it.
interface NotifFocus { studentId?: string; courseId?: string; nonce?: number }
interface Props { profile: Profile; focus?: NotifFocus }

import { Green, Ink, Tint } from '../theme';

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  forest:  Green[700], leaf:   Green[500], mist:   Green[50],
  border:  Ink.line,   card:   Ink.surface, green50: Green[50],
  ink:     Ink.base,   inkMid: Ink[3],      inkSoft: Ink[4],
  red:     Tint.rose.ink,   redBg:    Tint.rose.bg,    redBdr:    Tint.rose.line,
  amber:   Tint.sun.ink,    amberBg:  Tint.sun.bg,     amberBdr:  Tint.sun.line,
  green:   Tint.mint.ink,   greenBg:  Tint.mint.bg,    greenBdr:  Tint.mint.line,
  gray:    Ink[4],          grayBg:   '#F9FAFB',        grayBdr:   Ink.line,
  teal:    '#0D9488',       tealBg:   '#F0FDFA',        tealBdr:   '#99F6E4',
  purple:  Tint.violet.ink, purpleBg: Tint.violet.bg,  purpleBdr: Tint.violet.line,
  blue:    Tint.sky.ink,    blueBg:   Tint.sky.bg,      blueBdr:   Tint.sky.line,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const reasonColor = (r: string) => {
  if (r.includes('both'))  return C.purple;
  if (r.includes('Grade')) return C.red;
  return C.amber;
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

type RiskFilter  = 'all' | 'grade' | 'absence' | 'both';
type EmailFilter = 'all' | 'contacted' | 'not_contacted';

interface FilterState {
  risk:     RiskFilter;
  email:    EmailFilter;
  course:   string;
  program:  string;
  semester: string;
}

const DEFAULT_FILTERS: FilterState = { risk: 'all', email: 'all', course: '', program: '', semester: '' };

const matchRisk = (w: RiskWarning, f: RiskFilter) => {
  if (f === 'all')    return true;
  if (f === 'both')   return w.risk_reason.includes('both');
  if (f === 'grade')  return w.risk_reason.includes('Grade') && !w.risk_reason.includes('both');
  return w.risk_reason.includes('Absences') && !w.risk_reason.includes('both');
};

const matchEmail = (w: RiskWarning, f: EmailFilter) => {
  if (f === 'all')        return true;
  if (f === 'contacted')  return w.course_help_email_sent || w.absence_policy_email_sent;
  return !w.course_help_email_sent && !w.absence_policy_email_sent;
};

// ── Filter icon (3-line funnel) ───────────────────────────────────────────────
const FunnelIcon: React.FC<{ active: boolean }> = ({ active }) => {
  const col = active ? C.forest : C.inkMid;
  return (
    <View style={{ alignItems: 'center', gap: 3.5 }}>
      <View style={{ width: 18, height: 2, backgroundColor: col, borderRadius: 1 }} />
      <View style={{ width: 13, height: 2, backgroundColor: col, borderRadius: 1 }} />
      <View style={{ width: 8,  height: 2, backgroundColor: col, borderRadius: 1 }} />
    </View>
  );
};

// ── Filter section row ────────────────────────────────────────────────────────
interface SectionProps {
  title:    string;
  options:  { key: string; label: string }[];
  selected: string;
  onSelect: (k: string) => void;
}

const FilterSection: React.FC<SectionProps> = ({ title, options, selected, onSelect }) => (
  <View style={fm.section}>
    <Text style={fm.sectionLabel}>{title.toUpperCase()}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
        {options.map(o => {
          const active = selected === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              style={[fm.chip, active && fm.chipActive]}
              onPress={() => onSelect(active ? '' : o.key)}
            >
              <Text style={[fm.chipText, active && fm.chipTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  </View>
);

// ── Active filter tag ─────────────────────────────────────────────────────────
const ActiveTag: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <TouchableOpacity style={s.activeTag} onPress={onRemove}>
    <Text style={s.activeTagText}>{label}</Text>
    <Text style={s.activeTagX}>✕</Text>
  </TouchableOpacity>
);

// ── Warning Card ──────────────────────────────────────────────────────────────
interface CardProps {
  warning:        RiskWarning;
  settings:       RiskSettings;
  professorName:  string;
  dimmed:         boolean;
  highlighted?:   boolean;
  onLayoutY?:     (y: number) => void;
  onEmailCourse:  () => void;
  onEmailAbsence: () => void;
  onResolve:      () => void;
  onViewProfile:  () => void;
}

const WarningCard: React.FC<CardProps> = ({
  warning, settings, dimmed, highlighted, onLayoutY,
  onEmailCourse, onEmailAbsence, onResolve, onViewProfile,
}) => {
  const rc         = reasonColor(warning.risk_reason);
  const gradeBad   = warning.grade_percentage       !== null && warning.grade_percentage       <  settings.grade_limit_percentage;
  const absenceBad = warning.missed_classes_count   !== null && warning.missed_classes_count   >= settings.absence_limit_count;
  const contacted  = warning.course_help_email_sent || warning.absence_policy_email_sent;
  const isActive   = warning.status === 'active';

  return (
    <View
      style={[s.card, { borderLeftColor: rc }, dimmed && s.cardDimmed, highlighted && s.cardHighlighted]}
      onLayout={onLayoutY ? e => onLayoutY(e.nativeEvent.layout.y) : undefined}
    >

      {/* Header (tap to open full student profile) */}
      <TouchableOpacity
        style={s.cardHeader}
        onPress={onViewProfile}
        activeOpacity={0.7}
        accessibilityLabel={`View profile for ${warning.student_name}`}
      >
        <View style={{ flex: 1 }}>
          <Text style={[s.studentName, dimmed && { color: C.inkMid }]}>{warning.student_name}</Text>
          {!!warning.student_email && <Text style={s.studentEmail}>{warning.student_email}</Text>}
        </View>
        <View style={[
          s.statusBadge,
          isActive
            ? { backgroundColor: C.redBg,   borderColor: C.redBdr }
            : { backgroundColor: C.greenBg, borderColor: C.greenBdr },
        ]}>
          <Text style={[s.statusText, { color: isActive ? C.red : C.green }]}>
            {isActive ? 'Active' : 'Resolved'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Meta tags */}
      <View style={s.tagRow}>
        {!!warning.program  && <View style={s.tag}><Text style={s.tagText}>{warning.program}</Text></View>}
        {!!warning.semester && <View style={s.tag}><Text style={s.tagText}>{warning.semester}</Text></View>}
      </View>

      {/* Course + Professor */}
      <View style={s.courseBox}>
        <Text style={s.courseLabel}>COURSE</Text>
        <Text style={s.courseName}>{warning.course_name}</Text>
        <Text style={s.professorLine}>👨‍🏫  {warning.professor_name}</Text>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Grade</Text>
          <Text style={[s.statVal, gradeBad && !dimmed && { color: C.red }]}>
            {warning.grade_percentage !== null ? `${warning.grade_percentage}%` : '—'}
          </Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statLabel}>Min Grade</Text>
          <Text style={s.statVal}>{settings.grade_limit_percentage}%</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statLabel}>Missed</Text>
          <Text style={[s.statVal, absenceBad && !dimmed && { color: C.amber }]}>
            {warning.missed_classes_count ?? '—'}
          </Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statLabel}>Limit</Text>
          <Text style={s.statVal}>{settings.absence_limit_count}</Text>
        </View>
      </View>

      {/* Risk reason */}
      <View style={[s.reasonBox, { backgroundColor: rc + '18', borderColor: rc + '40' }]}>
        <Text style={[s.reasonText, { color: dimmed ? C.inkMid : rc }]}>⚠  {warning.risk_reason}</Text>
      </View>

      {/* View full profile (opens popup; does not affect any existing action) */}
      <TouchableOpacity
        style={s.viewProfileBtn}
        onPress={onViewProfile}
        activeOpacity={0.75}
      >
        <Text style={s.viewProfileBtnText}>👤  View Profile</Text>
      </TouchableOpacity>

      {/* Email status badges */}
      <View style={s.emailStatusRow}>
        <View style={[
          s.emailStatusBadge,
          warning.course_help_email_sent
            ? { backgroundColor: C.tealBg, borderColor: C.tealBdr }
            : { backgroundColor: C.grayBg, borderColor: C.grayBdr },
        ]}>
          <Text style={[s.emailStatusText, { color: warning.course_help_email_sent ? C.teal : C.gray }]}>
            {warning.course_help_email_sent ? '✓ Course help sent' : 'Course help not sent'}
          </Text>
        </View>
        <View style={[
          s.emailStatusBadge,
          warning.absence_policy_email_sent
            ? { backgroundColor: C.tealBg, borderColor: C.tealBdr }
            : { backgroundColor: C.grayBg, borderColor: C.grayBdr },
        ]}>
          <Text style={[s.emailStatusText, { color: warning.absence_policy_email_sent ? C.teal : C.gray }]}>
            {warning.absence_policy_email_sent ? '✓ Absence email sent' : 'Absence email not sent'}
          </Text>
        </View>
      </View>
      {warning.last_email_sent_at && (
        <Text style={s.lastEmailText}>Last emailed {fmtDate(warning.last_email_sent_at)}</Text>
      )}

      {/* Active action buttons */}
      {isActive && (
        <View style={s.actionRow}>
          {!warning.student_email ? (
            <Text style={s.noEmailText}>No student email available</Text>
          ) : (
            <>
              {!warning.course_help_email_sent && (
                <TouchableOpacity style={[s.actionBtn, s.actionBtnTeal]} onPress={onEmailCourse}>
                  <Text style={[s.actionBtnText, { color: C.teal }]}>📨  Course Help</Text>
                </TouchableOpacity>
              )}
              {!warning.absence_policy_email_sent && (
                <TouchableOpacity style={[s.actionBtn, s.actionBtnAmber]} onPress={onEmailAbsence}>
                  <Text style={[s.actionBtnText, { color: C.amber }]}>📋  Absence Policy</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          <TouchableOpacity style={[s.actionBtn, s.actionBtnGreen]} onPress={onResolve}>
            <Text style={[s.actionBtnText, { color: C.green }]}>✓  Mark as Resolved</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Resolved history */}
      {!isActive && warning.resolution_note && (
        <View style={s.resolutionBox}>
          <Text style={s.resolutionLabel}>RESOLUTION NOTE</Text>
          <Text style={s.resolutionText}>{warning.resolution_note}</Text>
          {warning.resolved_at && (
            <Text style={s.resolutionDate}>Resolved {fmtDate(warning.resolved_at)}</Text>
          )}
        </View>
      )}
    </View>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const WarningsScreen: React.FC<Props> = ({ profile, focus }) => {
  const { settings: institutionSettings } = useInstitution();

  // Scroll-to-and-highlight the exact student card arrived at from a notification.
  const scrollRef = useRef<ScrollView>(null);
  const cardYRef  = useRef<Record<string, number>>({});
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [warnings,   setWarnings]   = useState<RiskWarning[]>([]);
  const [settings,   setSettings]   = useState<RiskSettings | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [emptyReason, setEmptyReason] = useState<ProfessorEmptyReason>(null);

  // Search
  const [search, setSearch] = useState('');

  // Applied filters
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Filter modal state
  const [filterOpen,  setFilterOpen]  = useState(false);
  const [pending,     setPending]     = useState<FilterState>(DEFAULT_FILTERS);

  // Email modal
  const [emailModal, setEmailModal] = useState<{
    warning: RiskWarning;
    type: 'course_help' | 'absence_policy';
    subject: string;
    body: string;
  } | null>(null);
  const [sending, setSending] = useState(false);

  // Resolve modal
  const [resolveTarget, setResolveTarget] = useState<RiskWarning | null>(null);
  const [resolveNote,   setResolveNote]   = useState('');
  const [resolving,     setResolving]     = useState(false);

  // Student profile preview modal (reuses the Course Overview profile component)
  const [profileTarget, setProfileTarget] = useState<RiskWarning | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const result = await fetchProfessorAtRiskStudents(profile.id);
      setSettings(result.settings);
      setWarnings(result.warnings);
      setEmptyReason(result.emptyReason);
    } catch (e: any) {
      console.error('[WarningsScreen] load error:', e?.message ?? e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  // When opened from a "student at risk" notification, scroll to + highlight the
  // exact warning (matched by student_id, and course_id when provided). Falls back
  // to a plain page view if no matching warning is loaded.
  useEffect(() => {
    if (!focus?.studentId) return;
    const match = warnings.find(
      w => w.student_id === focus.studentId &&
           (!focus.courseId || w.course_id === focus.courseId),
    );
    if (!match) return;
    setHighlightId(match.id);
    const t1 = setTimeout(() => {
      const y = cardYRef.current[match.id];
      if (typeof y === 'number') {
        try { scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true }); } catch {}
      }
    }, 250);
    const t2 = setTimeout(() => setHighlightId(null), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [focus?.nonce, focus?.studentId, focus?.courseId, warnings]);

  // ── Derived filter options ────────────────────────────────────────────────────
  const courseOptions = useMemo(() => {
    const names = [...new Set(warnings.map(w => w.course_name))].sort();
    return [{ key: '', label: 'All Courses' }, ...names.map(n => ({ key: n, label: n }))];
  }, [warnings]);

  const programOptions = useMemo(() => {
    const fromWarnings = warnings.map(w => w.program).filter(Boolean) as string[];
    const fromInstitution = institutionSettings?.programs ?? [];
    const all = [...new Set([...fromWarnings, ...fromInstitution])].sort();
    return [{ key: '', label: 'All Programs' }, ...all.map(p => ({ key: p, label: p }))];
  }, [warnings, institutionSettings]);

  const semesterOptions = useMemo(() => {
    const fromWarnings = warnings.map(w => w.semester).filter(Boolean) as string[];
    const all = [...new Set(fromWarnings)].sort();
    // If no semesters in data, provide defaults
    const options = all.length > 0 ? all : ['Semester 1', 'Semester 2', 'Semester 3'];
    return [{ key: '', label: 'All Semesters' }, ...options.map(s => ({ key: s, label: s }))];
  }, [warnings]);

  const riskOptions = [
    { key: 'all',     label: 'All' },
    { key: 'grade',   label: 'Grade Risk' },
    { key: 'absence', label: 'Absence Risk' },
    { key: 'both',    label: 'Grade + Absence' },
  ];

  const emailOptions = [
    { key: 'all',           label: 'All' },
    { key: 'contacted',     label: 'Contacted' },
    { key: 'not_contacted', label: 'Not Contacted' },
  ];

  // ── Filter panel open/apply/reset ─────────────────────────────────────────────
  const openFilter = () => {
    setPending(filters);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setFilters(pending);
    setFilterOpen(false);
  };

  const resetFilters = () => {
    setPending(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setFilterOpen(false);
  };

  // ── Email handlers ────────────────────────────────────────────────────────────
  const openEmailCourseHelp = (w: RiskWarning) => {
    if (!settings) return;
    const { subject, body } = buildCourseHelpEmail(w, settings, profile.full_name);
    setEmailModal({ warning: w, type: 'course_help', subject, body });
  };

  const openEmailAbsencePolicy = (w: RiskWarning) => {
    if (!settings) return;
    const { subject, body } = buildAbsencePolicyEmail(w, settings, profile.full_name);
    setEmailModal({ warning: w, type: 'absence_policy', subject, body });
  };

  const handleSendEmail = async () => {
    if (!emailModal) return;
    const { warning, type, subject, body } = emailModal;

    if (!warning.student_email) {
      Alert.alert('No Email Address', 'This student does not have an email address on file.');
      return;
    }

    setSending(true);
    try {
      await sendWarningEmail({
        warning_id:     warning.id,
        email_type:     type,
        to_email:       warning.student_email,
        student_name:   warning.student_name,
        student_id:     warning.student_id,
        course_id:      warning.course_id,
        course_name:    warning.course_name,
        professor_id:   profile.id,
        professor_name: profile.full_name ?? 'Professor',
        subject,
        body,
      });

      // Update local state — DB flags are already updated by the edge function
      setWarnings(prev => prev.map(w =>
        w.id === warning.id
          ? {
              ...w,
              course_help_email_sent:    type === 'course_help'    ? true : w.course_help_email_sent,
              absence_policy_email_sent: type === 'absence_policy' ? true : w.absence_policy_email_sent,
              last_email_sent_at:        new Date().toISOString(),
            }
          : w,
      ));
      setEmailModal(null);
      Alert.alert('Email Sent', `Email sent to ${warning.student_name}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ── Resolve handlers ──────────────────────────────────────────────────────────
  const openResolveModal = (w: RiskWarning) => { setResolveTarget(w); setResolveNote(''); };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setResolving(true);
    try {
      await resolveWarning(resolveTarget.id, profile.id, resolveNote);
      setWarnings(prev => prev.map(w =>
        w.id === resolveTarget.id
          ? { ...w, status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: profile.id, resolution_note: resolveNote.trim() || null }
          : w,
      ));
      setResolveTarget(null);
      Alert.alert('Warning marked as resolved.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not resolve warning.');
    } finally {
      setResolving(false);
    }
  };

  // ── Derived: filtered list ────────────────────────────────────────────────────
  const filtered = useMemo(() => warnings.filter(w => {
    if (!matchRisk(w,  filters.risk as RiskFilter))   return false;
    if (!matchEmail(w, filters.email as EmailFilter)) return false;
    if (filters.course   && w.course_name !== filters.course)   return false;
    if (filters.program  && w.program     !== filters.program)  return false;
    if (filters.semester && w.semester    !== filters.semester) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        w.student_name.toLowerCase().includes(q) ||
        w.student_email.toLowerCase().includes(q) ||
        w.course_name.toLowerCase().includes(q)
      );
    }
    return true;
  }), [warnings, filters, search]);

  const activeWarnings   = filtered.filter(w => w.status === 'active');
  const resolvedWarnings = filtered.filter(w => w.status === 'resolved');
  const activeCount      = warnings.filter(w => w.status === 'active').length;
  const resolvedCount    = warnings.filter(w => w.status === 'resolved').length;

  // ── Active filter tags ────────────────────────────────────────────────────────
  const hasActiveFilters = filters.risk !== 'all' || filters.email !== 'all' || !!filters.course || !!filters.program || !!filters.semester;

  const activeTags: { label: string; clear: () => void }[] = [];
  if (filters.program)          activeTags.push({ label: filters.program,  clear: () => setFilters(f => ({ ...f, program:  '' })) });
  if (filters.semester)         activeTags.push({ label: filters.semester, clear: () => setFilters(f => ({ ...f, semester: '' })) });
  if (filters.course)           activeTags.push({ label: filters.course,   clear: () => setFilters(f => ({ ...f, course:   '' })) });
  if (filters.risk !== 'all')   activeTags.push({ label: riskOptions.find(o => o.key === filters.risk)?.label   ?? filters.risk,  clear: () => setFilters(f => ({ ...f, risk:  'all' })) });
  if (filters.email !== 'all')  activeTags.push({ label: emailOptions.find(o => o.key === filters.email)?.label ?? filters.email, clear: () => setFilters(f => ({ ...f, email: 'all' })) });

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.centre}>
        <ActivityIndicator size="large" color={C.forest} />
        <Text style={s.loadingText}>Checking student risk…</Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={s.container}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <Text style={s.pageTitle}>Student Warnings</Text>
        <Text style={s.pageSub}>
          {settings
            ? `Risk limits: Grade < ${settings.grade_limit_percentage}%  ·  Absences ≥ ${settings.absence_limit_count}`
            : 'No risk limits configured by admin yet'}
        </Text>

        {/* Summary */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { borderTopColor: C.red }]}>
            <Text style={[s.summaryNum, { color: C.red }]}>{activeCount}</Text>
            <Text style={s.summaryLabel}>Active{'\n'}Warnings</Text>
          </View>
          <View style={[s.summaryCard, { borderTopColor: C.green }]}>
            <Text style={[s.summaryNum, { color: C.green }]}>{resolvedCount}</Text>
            <Text style={s.summaryLabel}>Resolved</Text>
          </View>
          <View style={[s.summaryCard, { borderTopColor: C.teal }]}>
            <Text style={[s.summaryNum, { color: C.teal }]}>
              {warnings.filter(w => w.course_help_email_sent || w.absence_policy_email_sent).length}
            </Text>
            <Text style={s.summaryLabel}>Students{'\n'}Contacted</Text>
          </View>
        </View>

        {/* Search + Filter icon row */}
        <View style={s.searchRow}>
          <TextInput
            style={s.searchInput}
            placeholder="Search by student name or course…"
            placeholderTextColor={C.inkSoft}
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity
            style={[s.filterBtn, hasActiveFilters && s.filterBtnActive]}
            onPress={openFilter}
            activeOpacity={0.7}
          >
            <FunnelIcon active={hasActiveFilters} />
            {hasActiveFilters && <View style={s.filterDot} />}
          </TouchableOpacity>
        </View>

        {/* Active filter tags */}
        {activeTags.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.activeTagsScroll}
            contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
          >
            {activeTags.map((t, i) => (
              <ActiveTag key={i} label={t.label} onRemove={t.clear} />
            ))}
            <TouchableOpacity style={s.clearAllBtn} onPress={() => setFilters(DEFAULT_FILTERS)}>
              <Text style={s.clearAllText}>Clear all</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Active warnings */}
        <Text style={s.sectionTitle}>Active Warnings  ({activeWarnings.length})</Text>
        {activeWarnings.length === 0 ? (
          <View style={s.empty}>
            {emptyReason === 'no_courses' ? (
              <>
                <Text style={s.emptyIcon}>📋</Text>
                <Text style={s.emptyTitle}>No courses assigned</Text>
                <Text style={s.emptySub}>
                  You are not assigned to any courses yet. Contact your administrator to get assigned to a course.
                </Text>
              </>
            ) : emptyReason === 'no_students' ? (
              <>
                <Text style={s.emptyIcon}>👥</Text>
                <Text style={s.emptyTitle}>No enrolled students</Text>
                <Text style={s.emptySub}>
                  Your courses currently have no enrolled students. Warnings will appear here once students are enrolled.
                </Text>
              </>
            ) : (
              <>
                <Text style={s.emptyIcon}>✅</Text>
                <Text style={s.emptyTitle}>No active warnings</Text>
                <Text style={s.emptySub}>
                  {settings
                    ? 'No students are currently at risk based on the active admin limits.'
                    : 'The administrator has not configured risk limits yet.'}
                </Text>
              </>
            )}
          </View>
        ) : (
          settings && activeWarnings.map(w => (
            <WarningCard
              key={w.id}
              warning={w}
              settings={settings}
              professorName={profile.full_name}
              dimmed={false}
              highlighted={highlightId === w.id}
              onLayoutY={y => { cardYRef.current[w.id] = y; }}
              onEmailCourse={() => openEmailCourseHelp(w)}
              onEmailAbsence={() => openEmailAbsencePolicy(w)}
              onResolve={() => openResolveModal(w)}
              onViewProfile={() => setProfileTarget(w)}
            />
          ))
        )}

        {/* Resolved warnings */}
        {resolvedWarnings.length > 0 && (
          <>
            <View style={s.resolvedDivider}>
              <View style={s.resolvedLine} />
              <Text style={s.resolvedDividerLabel}>Resolved Warnings  ({resolvedWarnings.length})</Text>
              <View style={s.resolvedLine} />
            </View>
            {settings && resolvedWarnings.map(w => (
              <WarningCard
                key={w.id}
                warning={w}
                settings={settings}
                professorName={profile.full_name}
                dimmed
                highlighted={highlightId === w.id}
                onLayoutY={y => { cardYRef.current[w.id] = y; }}
                onEmailCourse={() => {}}
                onEmailAbsence={() => {}}
                onResolve={() => {}}
                onViewProfile={() => setProfileTarget(w)}
              />
            ))}
          </>
        )}

        {resolvedWarnings.length === 0 && warnings.length > 0 && (
          <Text style={s.resolvedEmpty}>No resolved warnings yet.</Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══ FILTER MODAL ══ */}
      <Modal
        visible={filterOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterOpen(false)}
      >
        <TouchableOpacity
          style={fm.overlay}
          activeOpacity={1}
          onPress={() => setFilterOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={fm.sheet} onPress={() => {}}>
            {/* Handle */}
            <View style={fm.handle} />
            <View style={fm.titleRow}>
              <Text style={fm.title}>Filters</Text>
              <TouchableOpacity onPress={() => setFilterOpen(false)}>
                <Text style={fm.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <FilterSection
                title="Program"
                options={programOptions}
                selected={pending.program}
                onSelect={k => setPending(p => ({ ...p, program: k }))}
              />
              <FilterSection
                title="Semester"
                options={semesterOptions}
                selected={pending.semester}
                onSelect={k => setPending(p => ({ ...p, semester: k }))}
              />
              <FilterSection
                title="Course"
                options={courseOptions}
                selected={pending.course}
                onSelect={k => setPending(p => ({ ...p, course: k }))}
              />
              <FilterSection
                title="Risk Type"
                options={riskOptions}
                selected={pending.risk}
                onSelect={k => setPending(p => ({ ...p, risk: k as RiskFilter || 'all' }))}
              />
              <FilterSection
                title="Email Status"
                options={emailOptions}
                selected={pending.email}
                onSelect={k => setPending(p => ({ ...p, email: k as EmailFilter || 'all' }))}
              />
              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Buttons */}
            <View style={fm.btnRow}>
              <TouchableOpacity style={fm.resetBtn} onPress={resetFilters}>
                <Text style={fm.resetBtnText}>Reset Filters</Text>
              </TouchableOpacity>
              <TouchableOpacity style={fm.applyBtn} onPress={applyFilters}>
                <Text style={fm.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ══ EMAIL PREVIEW MODAL ══ */}
      <Modal
        visible={!!emailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { if (!sending) setEmailModal(null); }}
      >
        {emailModal && (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={em.root}>
              <View style={em.header}>
                <TouchableOpacity onPress={() => setEmailModal(null)} disabled={sending}>
                  <Text style={em.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={em.headerTitle}>
                  {emailModal.type === 'course_help' ? 'Course Help Email' : 'Absence Policy Email'}
                </Text>
                <TouchableOpacity
                  style={[em.sendBtn, sending && { opacity: 0.6 }]}
                  onPress={handleSendEmail}
                  disabled={sending}
                >
                  {sending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={em.sendBtnText}>Send</Text>}
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={em.body}>
                <View style={em.toBox}>
                  <Text style={em.toLabel}>TO</Text>
                  <Text style={em.toName}>{emailModal.warning.student_name}</Text>
                  <Text style={em.toEmail}>{emailModal.warning.student_email || 'No email address on file'}</Text>
                </View>
                <View style={em.field}>
                  <Text style={em.fieldLabel}>SUBJECT</Text>
                  <Text style={em.fieldValue}>{emailModal.subject}</Text>
                </View>
                <View style={em.field}>
                  <Text style={em.fieldLabel}>MESSAGE BODY</Text>
                  <Text style={em.fieldValue}>{emailModal.body}</Text>
                </View>
                <Text style={em.hint}>
                  Tapping "Send" will deliver this email directly to the student via the platform.
                </Text>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        )}
      </Modal>

      {/* ══ RESOLVE MODAL ══ */}
      <Modal
        visible={!!resolveTarget}
        animationType="slide"
        transparent
        onRequestClose={() => { if (!resolving) setResolveTarget(null); }}
      >
        <KeyboardAvoidingView
          style={rm.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={rm.sheet}>
            <Text style={rm.title}>Mark as Resolved</Text>
            <Text style={rm.sub}>{resolveTarget?.student_name} — {resolveTarget?.course_name}</Text>
            <Text style={rm.fieldLabel}>RESOLUTION NOTE</Text>
            <TextInput
              style={rm.input}
              value={resolveNote}
              onChangeText={setResolveNote}
              placeholder="e.g. Student was contacted and agreed to attend support session."
              placeholderTextColor={C.inkSoft}
              multiline
              numberOfLines={4}
            />
            <View style={rm.btnRow}>
              <TouchableOpacity style={[rm.btn, rm.btnCancel]} onPress={() => setResolveTarget(null)} disabled={resolving}>
                <Text style={rm.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[rm.btn, rm.btnSave, resolving && { opacity: 0.6 }]} onPress={handleResolve} disabled={resolving}>
                {resolving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={rm.btnSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══ STUDENT PROFILE PREVIEW MODAL ══ */}
      {/* Reuses the same profile component shown from Course Overview.        */}
      {/* Closing it simply clears the target and returns to this risk list.   */}
      <CourseStudentDetailModal
        visible={!!profileTarget}
        onClose={() => setProfileTarget(null)}
        student={profileTarget ? {
          id:             profileTarget.student_id,
          full_name:      profileTarget.student_name,
          grade:          profileTarget.grade_percentage,
          missed_classes: profileTarget.missed_classes_count,
        } : null}
        currentCourse={{
          id:       profileTarget?.course_id   ?? '',
          name:     profileTarget?.course_name ?? '',
          program:  profileTarget?.program     ?? undefined,
          semester: profileTarget?.semester    ?? undefined,
        } as Course}
      />
    </View>
  );
};

// ── Main styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.mist },
  content:     { padding: 16, paddingBottom: 48 },
  centre:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 13, color: C.inkMid },

  pageTitle: { fontSize: 22, fontWeight: '800', color: C.forest, marginBottom: 2 },
  pageSub:   { fontSize: 12, color: C.inkSoft, marginBottom: 16 },

  summaryRow:   { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard:  {
    flex: 1, backgroundColor: C.card, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: C.border, borderTopWidth: 3, alignItems: 'center',
  },
  summaryNum:   { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  summaryLabel: { fontSize: 10, color: C.inkMid, textAlign: 'center', fontWeight: '600', lineHeight: 13 },

  // Search + filter row
  searchRow:  { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  searchInput: {
    flex: 1,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: C.ink,
  },
  filterBtn: {
    width: 44, height: 44,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: C.green50, borderColor: C.leaf,
  },
  filterDot: {
    position: 'absolute', top: 6, right: 6,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: C.forest,
  },

  // Active filter tags
  activeTagsScroll: { marginBottom: 10 },
  activeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.forest, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  activeTagText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  activeTagX:    { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '700' },
  clearAllBtn: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.card,
    justifyContent: 'center',
  },
  clearAllText: { fontSize: 12, color: C.inkMid, fontWeight: '600' },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.forest, marginBottom: 10, marginTop: 4 },

  // Cards
  card: {
    backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: C.border, borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardDimmed: { opacity: 0.72, backgroundColor: C.mist },
  // Subtle highlight when arrived-at via a notification (uses existing tokens).
  cardHighlighted: { borderColor: C.forest, borderWidth: 1.5, backgroundColor: C.mist },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  studentName:  { fontSize: 15, fontWeight: '800', color: C.ink },
  studentEmail: { fontSize: 11, color: C.inkSoft, marginTop: 2 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  statusText:   { fontSize: 11, fontWeight: '700' },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag:    { backgroundColor: C.mist, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.border },
  tagText:{ fontSize: 11, color: C.forest, fontWeight: '600' },

  courseBox:     { backgroundColor: C.green50, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 10, marginBottom: 10 },
  courseLabel:   { fontSize: 9, fontWeight: '800', color: C.forest, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  courseName:    { fontSize: 13, fontWeight: '700', color: C.forest },
  professorLine: { fontSize: 11, color: C.inkMid, marginTop: 3 },

  statsRow:    { flexDirection: 'row', backgroundColor: C.mist, borderRadius: 8, borderWidth: 1, borderColor: C.border, marginBottom: 10, overflow: 'hidden' },
  statBox:     { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statDivider: { width: 1, backgroundColor: C.border },
  statLabel:   { fontSize: 9, color: C.inkSoft, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4 },
  statVal:     { fontSize: 14, fontWeight: '800', color: C.ink },

  reasonBox:  { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 8 },
  reasonText: { fontSize: 12, fontWeight: '700', lineHeight: 17 },

  viewProfileBtn: {
    borderWidth: 1.5, borderColor: C.blueBdr, backgroundColor: C.blueBg,
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
    alignItems: 'center', marginBottom: 8,
  },
  viewProfileBtnText: { fontSize: 12, fontWeight: '700', color: C.blue },

  emailStatusRow:   { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  emailStatusBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  emailStatusText:  { fontSize: 10, fontWeight: '600' },
  lastEmailText:    { fontSize: 10, color: C.inkSoft, marginBottom: 8 },

  noEmailText:    { fontSize: 11, color: C.gray, fontStyle: 'italic', marginTop: 2, marginBottom: 4 },
  actionRow:      { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  actionBtn:      { borderWidth: 1.5, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  actionBtnTeal:  { backgroundColor: C.tealBg,  borderColor: C.tealBdr  },
  actionBtnAmber: { backgroundColor: C.amberBg, borderColor: C.amberBdr },
  actionBtnGreen: { backgroundColor: C.greenBg, borderColor: C.greenBdr },
  actionBtnText:  { fontSize: 12, fontWeight: '700' },

  resolutionBox:   { backgroundColor: C.greenBg, borderWidth: 1, borderColor: C.greenBdr, borderRadius: 8, padding: 10, marginTop: 8 },
  resolutionLabel: { fontSize: 9, fontWeight: '800', color: C.green, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  resolutionText:  { fontSize: 12, color: C.forest, lineHeight: 17 },
  resolutionDate:  { fontSize: 10, color: C.green, marginTop: 4 },

  resolvedDivider:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  resolvedLine:         { flex: 1, height: 1, backgroundColor: C.border },
  resolvedDividerLabel: { fontSize: 12, fontWeight: '700', color: C.inkMid },
  resolvedEmpty:        { fontSize: 12, color: C.inkSoft, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },

  empty:      { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
  emptyIcon:  { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 6, textAlign: 'center' },
  emptySub:   { fontSize: 13, color: C.inkMid, textAlign: 'center', lineHeight: 19 },
});

// ── Filter modal styles ───────────────────────────────────────────────────────
const fm = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.border, alignSelf: 'center', marginTop: 10, marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title:    { fontSize: 17, fontWeight: '800', color: C.ink },
  closeBtn: { fontSize: 16, color: C.inkMid, padding: 4 },

  section: { paddingHorizontal: 20, paddingTop: 16 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: C.inkSoft,
    letterSpacing: 0.8, marginBottom: 8,
  },

  chip: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.mist,
  },
  chipActive:     { backgroundColor: C.forest, borderColor: C.forest },
  chipText:       { fontSize: 13, color: C.inkMid, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  btnRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  resetBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.mist,
  },
  resetBtnText: { fontSize: 14, fontWeight: '700', color: C.inkMid },
  applyBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: C.forest,
  },
  applyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

// ── Email modal styles ────────────────────────────────────────────────────────
const em = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.mist },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.card, paddingHorizontal: 16, paddingVertical: 14,
    paddingTop: 52, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  cancelText:  { fontSize: 15, color: C.inkMid },
  headerTitle: { fontSize: 15, fontWeight: '800', color: C.ink },
  sendBtn:     { backgroundColor: C.forest, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  sendBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  body:       { padding: 16, gap: 14 },
  toBox:      { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14 },
  toLabel:    { fontSize: 9, fontWeight: '800', color: C.forest, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  toName:     { fontSize: 14, fontWeight: '700', color: C.ink },
  toEmail:    { fontSize: 12, color: C.inkMid, marginTop: 2 },
  field:      { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14 },
  fieldLabel: { fontSize: 9, fontWeight: '800', color: C.forest, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  fieldValue: { fontSize: 13, color: C.ink, lineHeight: 20 },
  hint:       { fontSize: 11, color: C.inkSoft, textAlign: 'center', lineHeight: 17 },
});

// ── Resolve modal styles ──────────────────────────────────────────────────────
const rm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title:      { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 4 },
  sub:        { fontSize: 13, color: C.inkMid, marginBottom: 20 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  input:      {
    backgroundColor: C.mist, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 13, color: C.ink, textAlignVertical: 'top', minHeight: 90, marginBottom: 20,
  },
  btnRow:        { flexDirection: 'row', gap: 10 },
  btn:           { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  btnCancel:     { backgroundColor: C.mist, borderColor: C.border },
  btnCancelText: { fontSize: 14, fontWeight: '600', color: C.inkMid },
  btnSave:       { backgroundColor: C.forest, borderColor: C.forest },
  btnSaveText:   { fontSize: 14, fontWeight: '700', color: '#fff' },
});

export default WarningsScreen;
