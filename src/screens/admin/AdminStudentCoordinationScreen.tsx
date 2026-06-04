import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Modal,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import {
  RiskWarning, RiskSettings,
  getAllWarningsForAdmin, getRiskSettings, saveRiskSettings, runRiskDetection,
} from '../../services/riskService';
import { supabase } from '../../services/supabase';
import { Green, Ink, Tint } from '../../theme';

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  forest: Green[700], leaf: Green[500], mist: Green[50],
  ink: Ink.base, inkMid: Ink[3], inkSoft: Ink[4],
  border: Ink.line, card: Ink.surface, green50: Green[50],
  red: Tint.rose.ink,    redBg:    Tint.rose.bg,    redBdr:    Tint.rose.line,
  amber: Tint.sun.ink,   amberBg:  Tint.sun.bg,     amberBdr:  Tint.sun.line,
  blue: Tint.sky.ink,    blueBg:   Tint.sky.bg,     blueBdr:   Tint.sky.line,
  purple: Tint.violet.ink, purpleBg: Tint.violet.bg, purpleBdr: Tint.violet.line,
  green: Tint.mint.ink,  greenBg:  Tint.mint.bg,    greenBdr:  Tint.mint.line,
  gray: Ink[4],          grayBg:   '#F9FAFB',        grayBdr:   Ink.line,
  teal: '#0D9488',       tealBg:   '#F0FDFA',        tealBdr:   '#99F6E4',
};

// ── Risk type helpers ──────────────────────────────────────────────────────────
type RiskType = 'grade' | 'absence' | 'both';

const getRiskType = (reason: string): RiskType => {
  const r = reason.toLowerCase();
  if (r.includes('grade') && (r.includes('absence') || r.includes('both'))) return 'both';
  if (r.includes('grade')) return 'grade';
  return 'absence';
};

const REASON_COLOR = (reason: string): string => {
  const t = getRiskType(reason);
  if (t === 'both')    return C.purple;
  if (t === 'grade')   return C.red;
  return C.amber;
};

// ── Filter state ───────────────────────────────────────────────────────────────
interface Filters {
  status:    'all' | 'active' | 'resolved';
  riskType:  'all' | RiskType;
  program:   string;
  semester:  string;
  professor: string;
}
const DEFAULT_FILTERS: Filters = {
  status: 'all', riskType: 'all', program: '', semester: '', professor: '',
};
const filtersActive = (f: Filters) =>
  f.status !== 'all' || f.riskType !== 'all' || !!f.program || !!f.semester || !!f.professor;

// ── WarningCard ────────────────────────────────────────────────────────────────
interface WarningCardProps {
  warning:  RiskWarning;
  settings: RiskSettings | null;
  dimmed?:  boolean;
}
const WarningCard: React.FC<WarningCardProps> = ({ warning: w, settings, dimmed }) => {
  const rc        = REASON_COLOR(w.risk_reason);
  const gradeBad  = w.grade_percentage   !== null && settings !== null
    && w.grade_percentage < settings.grade_limit_percentage;
  const absenceBad = w.missed_classes_count !== null && settings !== null
    && w.missed_classes_count >= settings.absence_limit_count;

  const statusBg  = w.status === 'active' ? C.redBg   : C.greenBg;
  const statusBdr = w.status === 'active' ? C.redBdr   : C.greenBdr;
  const statusTxt = w.status === 'active' ? C.red      : C.green;
  const statusLbl = w.status === 'active' ? 'ACTIVE'   : 'RESOLVED';

  return (
    <View style={[s.card, { borderLeftColor: rc }, dimmed && s.cardDimmed]}>

      {/* Header */}
      <View style={s.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.studentName}>{w.student_name}</Text>
          {!!w.student_email && <Text style={s.studentEmail}>{w.student_email}</Text>}
          <Text style={s.courseName}>{w.course_name}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: statusBg, borderColor: statusBdr }]}>
          <Text style={[s.badgeText, { color: statusTxt }]}>{statusLbl}</Text>
        </View>
      </View>

      {/* Professor box */}
      <View style={s.professorBox}>
        <Text style={s.professorLabel}>PROFESSOR</Text>
        <Text style={s.professorName}>{w.professor_name}</Text>
      </View>

      {/* Program / Semester tags */}
      <View style={s.metaRow}>
        {!!w.program  && <View style={s.metaTag}><Text style={s.metaTagText}>{w.program}</Text></View>}
        {!!w.semester && <View style={s.metaTag}><Text style={s.metaTagText}>{w.semester}</Text></View>}
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={[s.statVal, gradeBad && { color: C.red }]}>
            {w.grade_percentage !== null ? `${w.grade_percentage}%` : '—'}
          </Text>
          <Text style={s.statLabel}>Grade</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statVal}>
            {settings ? `${settings.grade_limit_percentage}%` : '—'}
          </Text>
          <Text style={s.statLabel}>Min Grade</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={[s.statVal, absenceBad && { color: C.red }]}>
            {w.missed_classes_count ?? '—'}
          </Text>
          <Text style={s.statLabel}>Missed</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statVal}>{settings?.absence_limit_count ?? '—'}</Text>
          <Text style={s.statLabel}>Max Absent</Text>
        </View>
      </View>

      {/* Risk reason */}
      <View style={[s.reasonBox, { backgroundColor: rc + '18', borderColor: rc + '40' }]}>
        <Text style={[s.reasonText, { color: rc }]}>⚠  {w.risk_reason}</Text>
      </View>

      {/* Email tracking */}
      <View style={s.emailTrackRow}>
        <View style={[
          s.emailBadge,
          w.course_help_email_sent && { backgroundColor: C.tealBg, borderColor: C.tealBdr },
        ]}>
          <Text style={[s.emailBadgeText, w.course_help_email_sent && { color: C.teal }]}>
            {w.course_help_email_sent ? '✓ Course Help Sent' : '○ Course Help'}
          </Text>
        </View>
        <View style={[
          s.emailBadge,
          w.absence_policy_email_sent && { backgroundColor: C.tealBg, borderColor: C.tealBdr },
        ]}>
          <Text style={[s.emailBadgeText, w.absence_policy_email_sent && { color: C.teal }]}>
            {w.absence_policy_email_sent ? '✓ Absence Policy Sent' : '○ Absence Policy'}
          </Text>
        </View>
      </View>
      {!!w.last_email_sent_at && (
        <Text style={s.lastEmailText}>
          Last email: {new Date(w.last_email_sent_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </Text>
      )}

      {/* Resolution info */}
      {w.status === 'resolved' && (
        <View style={s.resolutionBox}>
          <Text style={s.resolutionLabel}>RESOLVED</Text>
          {!!w.resolution_note && <Text style={s.resolutionNote}>{w.resolution_note}</Text>}
          {!!w.resolved_at && (
            <Text style={s.resolutionDate}>
              {new Date(w.resolved_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </Text>
          )}
        </View>
      )}

      {/* Detected */}
      <Text style={s.detectedAt}>
        Detected {new Date(w.created_at).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
        })}
      </Text>
    </View>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const AdminStudentCoordinationScreen: React.FC = () => {
  const [warnings,          setWarnings]          = useState<RiskWarning[]>([]);
  const [settings,          setSettings]          = useState<RiskSettings | null>(null);
  const [gradeLimitInput,   setGradeLimitInput]   = useState('60');
  const [absenceLimitInput, setAbsenceLimitInput] = useState('3');
  const [savingSettings,    setSavingSettings]    = useState(false);
  const [loading,           setLoading]           = useState(true);
  const [refreshing,        setRefreshing]        = useState(false);

  const [filters,    setFilters]    = useState<Filters>(DEFAULT_FILTERS);
  const [draft,      setDraft]      = useState<Filters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search,     setSearch]     = useState('');

  // ── Load ────────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      await runRiskDetection();
      const [data, cfg] = await Promise.all([
        getAllWarningsForAdmin(),
        getRiskSettings(),
      ]);
      setWarnings(data);
      setSettings(cfg);
      if (cfg) {
        setGradeLimitInput(String(cfg.grade_limit_percentage));
        setAbsenceLimitInput(String(cfg.absence_limit_count));
      }
    } catch (e) {
      console.error('AdminStudentCoordination load:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Save risk settings ───────────────────────────────────────────────
  const handleSaveSettings = async () => {
    const grade   = parseFloat(gradeLimitInput);
    const absence = parseInt(absenceLimitInput, 10);
    if (isNaN(grade) || grade < 0 || grade > 100) {
      Alert.alert('Invalid Input', 'Grade limit must be between 0 and 100.');
      return;
    }
    if (isNaN(absence) || absence < 0) {
      Alert.alert('Invalid Input', 'Absence limit must be 0 or more.');
      return;
    }
    setSavingSettings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await saveRiskSettings(grade, absence, user.id);
      await load(true);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Filter modal ─────────────────────────────────────────────────────
  const openFilters  = () => { setDraft({ ...filters }); setFilterOpen(true); };
  const applyFilters = () => { setFilters({ ...draft }); setFilterOpen(false); };
  const clearDraft   = () => setDraft(DEFAULT_FILTERS);

  // ── Derived ───────────────────────────────────────────────────────────
  const activeCount   = warnings.filter(w => w.status === 'active').length;
  const resolvedCount = warnings.filter(w => w.status === 'resolved').length;
  const emailsSent    = warnings.filter(
    w => w.course_help_email_sent || w.absence_policy_email_sent
  ).length;

  const programs   = [...new Set(warnings.map(w => w.program).filter(Boolean)   as string[])].sort();
  const semesters  = [...new Set(warnings.map(w => w.semester).filter(Boolean)  as string[])].sort();
  const professors = [...new Set(
    warnings.map(w => w.professor_name).filter(n => n !== 'Unknown')
  )].sort();

  const activeFilterCount = [
    filters.status   !== 'all',
    filters.riskType !== 'all',
    !!filters.program,
    !!filters.semester,
    !!filters.professor,
  ].filter(Boolean).length;

  const filtered = warnings.filter(w => {
    if (filters.status   !== 'all' && w.status                  !== filters.status)   return false;
    if (filters.riskType !== 'all' && getRiskType(w.risk_reason) !== filters.riskType) return false;
    if (filters.program   && w.program       !== filters.program)   return false;
    if (filters.semester  && w.semester      !== filters.semester)  return false;
    if (filters.professor && w.professor_name !== filters.professor) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        w.student_name.toLowerCase().includes(q)   ||
        w.student_email.toLowerCase().includes(q)  ||
        w.course_name.toLowerCase().includes(q)    ||
        w.professor_name.toLowerCase().includes(q) ||
        (w.program?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const filteredActive   = filtered.filter(w => w.status === 'active');
  const filteredResolved = filtered.filter(w => w.status === 'resolved');

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.centre}>
        <ActivityIndicator color={C.leaf} size="large" />
        <Text style={s.loadingText}>Running risk detection…</Text>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <Text style={s.pageTitle}>Student Risk Overview</Text>
        <Text style={s.pageSub}>School-wide at-risk monitoring · Pull to refresh</Text>

        {/* ── Risk Limit Settings ── */}
        <View style={s.settingsCard}>
          <Text style={s.settingsTitle}>Risk Limit Settings</Text>
          <Text style={s.settingsSub}>
            Risk detection runs automatically on every load and after saving.
          </Text>
          <View style={s.settingsRow}>
            <View style={s.settingsField}>
              <Text style={s.settingsLabel}>Grade Limit (%)</Text>
              <TextInput
                style={s.settingsInput}
                value={gradeLimitInput}
                onChangeText={setGradeLimitInput}
                keyboardType="decimal-pad"
                placeholder="60"
                placeholderTextColor={C.inkSoft}
              />
              <Text style={s.settingsHint}>Student at risk if grade is below this</Text>
            </View>
            <View style={s.settingsField}>
              <Text style={s.settingsLabel}>Max Absences</Text>
              <TextInput
                style={s.settingsInput}
                value={absenceLimitInput}
                onChangeText={setAbsenceLimitInput}
                keyboardType="number-pad"
                placeholder="3"
                placeholderTextColor={C.inkSoft}
              />
              <Text style={s.settingsHint}>Student at risk if missed ≥ this count</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[s.saveBtn, savingSettings && { opacity: 0.6 }]}
            onPress={handleSaveSettings}
            disabled={savingSettings}
            activeOpacity={0.8}
          >
            {savingSettings
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.saveBtnText}>Save & Re-run Detection</Text>}
          </TouchableOpacity>
        </View>

        {/* ── Summary cards ── */}
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
            <Text style={[s.summaryNum, { color: C.teal }]}>{emailsSent}</Text>
            <Text style={s.summaryLabel}>Emails{'\n'}Tracked</Text>
          </View>
          <View style={[s.summaryCard, { borderTopColor: C.inkSoft }]}>
            <Text style={[s.summaryNum, { color: C.ink }]}>{warnings.length}</Text>
            <Text style={s.summaryLabel}>Total{'\n'}Records</Text>
          </View>
        </View>

        {/* ── Search + Filter ── */}
        <View style={s.searchRow}>
          <TextInput
            style={s.searchInput}
            placeholder="Search student, email, course, professor…"
            placeholderTextColor={C.inkSoft}
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity
            style={[s.filterBtn, activeFilterCount > 0 && s.filterBtnActive]}
            onPress={openFilters}
            activeOpacity={0.75}
          >
            <Text style={[s.filterBtnIcon, activeFilterCount > 0 && s.filterBtnIconActive]}>⚙</Text>
            <Text style={[s.filterBtnText, activeFilterCount > 0 && s.filterBtnTextActive]}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Active filter chips ── */}
        {filtersActive(filters) && (
          <View style={s.activeChipsRow}>
            {filters.status !== 'all' && (
              <TouchableOpacity style={s.activeChip} onPress={() => setFilters(f => ({ ...f, status: 'all' }))}>
                <Text style={s.activeChipText}>{filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}  ✕</Text>
              </TouchableOpacity>
            )}
            {filters.riskType !== 'all' && (
              <TouchableOpacity style={s.activeChip} onPress={() => setFilters(f => ({ ...f, riskType: 'all' }))}>
                <Text style={s.activeChipText}>{filters.riskType.charAt(0).toUpperCase() + filters.riskType.slice(1)} Risk  ✕</Text>
              </TouchableOpacity>
            )}
            {!!filters.program && (
              <TouchableOpacity style={s.activeChip} onPress={() => setFilters(f => ({ ...f, program: '' }))}>
                <Text style={s.activeChipText}>{filters.program}  ✕</Text>
              </TouchableOpacity>
            )}
            {!!filters.semester && (
              <TouchableOpacity style={s.activeChip} onPress={() => setFilters(f => ({ ...f, semester: '' }))}>
                <Text style={s.activeChipText}>{filters.semester}  ✕</Text>
              </TouchableOpacity>
            )}
            {!!filters.professor && (
              <TouchableOpacity style={s.activeChip} onPress={() => setFilters(f => ({ ...f, professor: '' }))}>
                <Text style={s.activeChipText}>{filters.professor}  ✕</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setFilters(DEFAULT_FILTERS)}>
              <Text style={s.clearAllText}>Clear all</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Empty state ── */}
        {filtered.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>{filtersActive(filters) || search ? '🔍' : '✅'}</Text>
            <Text style={s.emptyTitle}>
              {filtersActive(filters) || search
                ? 'No records match these filters.'
                : 'No at-risk students detected.'}
            </Text>
            <Text style={s.emptyText}>
              {filtersActive(filters) || search
                ? 'Try adjusting the filters or search term.'
                : 'All students are within the current grade and absence thresholds.'}
            </Text>
            {(filtersActive(filters) || search) && (
              <TouchableOpacity
                style={s.clearFiltersBtn}
                onPress={() => { setFilters(DEFAULT_FILTERS); setSearch(''); }}
              >
                <Text style={s.clearFiltersBtnText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Active Warnings ── */}
        {filteredActive.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Active Warnings</Text>
              <Text style={s.resultCount}>{filteredActive.length} record{filteredActive.length !== 1 ? 's' : ''}</Text>
            </View>
            {filteredActive.map(w => (
              <WarningCard key={w.id} warning={w} settings={settings} />
            ))}
          </>
        )}

        {/* ── Resolved ── */}
        {filteredResolved.length > 0 && (
          <>
            <View style={[s.sectionHeader, { marginTop: filteredActive.length > 0 ? 16 : 0 }]}>
              <Text style={[s.sectionTitle, { color: C.inkMid }]}>Resolved</Text>
              <Text style={s.resultCount}>{filteredResolved.length} record{filteredResolved.length !== 1 ? 's' : ''}</Text>
            </View>
            {filteredResolved.map(w => (
              <WarningCard key={w.id} warning={w} settings={settings} dimmed />
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════
          FILTER PANEL
      ══════════════════════════════════════════════════════════════ */}
      <Modal
        visible={filterOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={fp.overlay}>
          <TouchableOpacity style={fp.backdrop} onPress={() => setFilterOpen(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={fp.sheet}
          >
            <View style={fp.sheetHeader}>
              <TouchableOpacity onPress={() => setFilterOpen(false)}>
                <Text style={fp.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <Text style={fp.sheetTitle}>Filters</Text>
              <TouchableOpacity onPress={clearDraft}>
                <Text style={fp.clearTxt}>Clear All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={fp.body} showsVerticalScrollIndicator={false}>

              {/* Status */}
              <View style={fp.group}>
                <Text style={fp.groupTitle}>Status</Text>
                <View style={fp.chipWrap}>
                  {(['all', 'active', 'resolved'] as const).map(opt => {
                    const active = draft.status === opt;
                    const color  = opt === 'active' ? C.red : opt === 'resolved' ? C.green : undefined;
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[fp.chip, active && fp.chipActive]}
                        onPress={() => setDraft(d => ({ ...d, status: opt }))}
                      >
                        <Text style={[fp.chipTxt, active && fp.chipTxtActive, active && color ? { color } : {}]}>
                          {opt === 'all' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Risk Type */}
              <View style={fp.group}>
                <Text style={fp.groupTitle}>Risk Type</Text>
                <View style={fp.chipWrap}>
                  {([
                    { val: 'all',     label: 'All Types' },
                    { val: 'grade',   label: 'Grade' },
                    { val: 'absence', label: 'Absences' },
                    { val: 'both',    label: 'Grade & Absences' },
                  ] as const).map(({ val, label }) => {
                    const active = draft.riskType === val;
                    return (
                      <TouchableOpacity
                        key={val}
                        style={[fp.chip, active && fp.chipActive]}
                        onPress={() => setDraft(d => ({ ...d, riskType: val }))}
                      >
                        <Text style={[fp.chipTxt, active && fp.chipTxtActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Program */}
              {programs.length > 0 && (
                <View style={fp.group}>
                  <Text style={fp.groupTitle}>Program</Text>
                  <View style={fp.chipWrap}>
                    <TouchableOpacity
                      style={[fp.chip, draft.program === '' && fp.chipActive]}
                      onPress={() => setDraft(d => ({ ...d, program: '' }))}
                    >
                      <Text style={[fp.chipTxt, draft.program === '' && fp.chipTxtActive]}>All Programs</Text>
                    </TouchableOpacity>
                    {programs.map(p => (
                      <TouchableOpacity
                        key={p}
                        style={[fp.chip, draft.program === p && fp.chipActive]}
                        onPress={() => setDraft(d => ({ ...d, program: p }))}
                      >
                        <Text style={[fp.chipTxt, draft.program === p && fp.chipTxtActive]}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Semester */}
              {semesters.length > 0 && (
                <View style={fp.group}>
                  <Text style={fp.groupTitle}>Semester</Text>
                  <View style={fp.chipWrap}>
                    <TouchableOpacity
                      style={[fp.chip, draft.semester === '' && fp.chipActive]}
                      onPress={() => setDraft(d => ({ ...d, semester: '' }))}
                    >
                      <Text style={[fp.chipTxt, draft.semester === '' && fp.chipTxtActive]}>All Semesters</Text>
                    </TouchableOpacity>
                    {semesters.map(sem => (
                      <TouchableOpacity
                        key={sem}
                        style={[fp.chip, draft.semester === sem && fp.chipActive]}
                        onPress={() => setDraft(d => ({ ...d, semester: sem }))}
                      >
                        <Text style={[fp.chipTxt, draft.semester === sem && fp.chipTxtActive]}>{sem}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Professor */}
              {professors.length > 0 && (
                <View style={fp.group}>
                  <Text style={fp.groupTitle}>Professor</Text>
                  <View style={fp.chipWrap}>
                    <TouchableOpacity
                      style={[fp.chip, draft.professor === '' && fp.chipActive]}
                      onPress={() => setDraft(d => ({ ...d, professor: '' }))}
                    >
                      <Text style={[fp.chipTxt, draft.professor === '' && fp.chipTxtActive]}>All Professors</Text>
                    </TouchableOpacity>
                    {professors.map(prof => (
                      <TouchableOpacity
                        key={prof}
                        style={[fp.chip, draft.professor === prof && fp.chipActive]}
                        onPress={() => setDraft(d => ({ ...d, professor: prof }))}
                      >
                        <Text style={[fp.chipTxt, draft.professor === prof && fp.chipTxtActive]}>{prof}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

            </ScrollView>

            <View style={fp.footer}>
              <TouchableOpacity style={fp.applyBtn} onPress={applyFilters}>
                <Text style={fp.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

// ── Main styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.mist },
  content:     { padding: 16, paddingBottom: 48 },
  centre:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  loadingText: { marginTop: 12, fontSize: 13, color: C.inkMid },

  pageTitle: { fontSize: 22, fontWeight: '800', color: C.forest, marginBottom: 2 },
  pageSub:   { fontSize: 12, color: C.inkSoft, marginBottom: 16 },

  // Settings card
  settingsCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  settingsTitle: { fontSize: 15, fontWeight: '800', color: C.forest, marginBottom: 2 },
  settingsSub:   { fontSize: 12, color: C.inkSoft, marginBottom: 14 },
  settingsRow:   { flexDirection: 'row', gap: 12, marginBottom: 14 },
  settingsField: { flex: 1 },
  settingsLabel: { fontSize: 11, fontWeight: '700', color: C.inkMid, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  settingsInput: {
    backgroundColor: C.mist, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 18, fontWeight: '800', color: C.forest, textAlign: 'center',
  },
  settingsHint: { fontSize: 10, color: C.inkSoft, marginTop: 5, textAlign: 'center', lineHeight: 14 },
  saveBtn: {
    backgroundColor: C.forest, borderRadius: 10, paddingVertical: 13,
    alignItems: 'center', minHeight: 46, justifyContent: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Summary
  summaryRow:   { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard:  { flex: 1, backgroundColor: C.card, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.border, borderTopWidth: 3, alignItems: 'center' },
  summaryNum:   { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  summaryLabel: { fontSize: 10, color: C.inkMid, textAlign: 'center', fontWeight: '600', lineHeight: 13 },

  // Search
  searchRow:  { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'center' },
  searchInput: {
    flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: C.ink,
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.card,
  },
  filterBtnActive:    { backgroundColor: C.forest, borderColor: C.forest },
  filterBtnIcon:      { fontSize: 14, color: C.inkMid },
  filterBtnIconActive:{ color: '#fff' },
  filterBtnText:      { fontSize: 13, fontWeight: '600', color: C.inkMid },
  filterBtnTextActive:{ color: '#fff' },

  // Active chips
  activeChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' },
  activeChip:     { backgroundColor: C.forest, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  activeChipText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  clearAllText:   { fontSize: 12, color: C.leaf, fontWeight: '600', paddingHorizontal: 4 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle:  { fontSize: 16, fontWeight: '800', color: C.forest },
  resultCount:   { fontSize: 12, color: C.inkSoft },

  // Cards
  card: {
    backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: C.border, borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardDimmed: { opacity: 0.65 },
  cardTop:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },

  studentName:  { fontSize: 15, fontWeight: '800', color: C.ink },
  studentEmail: { fontSize: 11, color: C.inkSoft, marginTop: 1 },
  courseName:   { fontSize: 12, color: C.inkMid, marginTop: 3 },

  badge:     { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  professorBox:   { backgroundColor: C.green50, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 10, marginBottom: 10 },
  professorLabel: { fontSize: 9, fontWeight: '800', color: C.forest, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  professorName:  { fontSize: 14, fontWeight: '700', color: C.forest },

  metaRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metaTag:    { backgroundColor: C.mist, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.border },
  metaTagText:{ fontSize: 11, color: C.forest, fontWeight: '600' },

  statsRow:    { flexDirection: 'row', backgroundColor: C.mist, borderRadius: 8, borderWidth: 1, borderColor: C.border, marginBottom: 10, overflow: 'hidden' },
  statBox:     { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statDivider: { width: 1, backgroundColor: C.border },
  statVal:     { fontSize: 14, fontWeight: '800', color: C.ink },
  statLabel:   { fontSize: 9, color: C.inkSoft, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },

  reasonBox:  { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 8 },
  reasonText: { fontSize: 12, fontWeight: '700', lineHeight: 17 },

  // Email tracking
  emailTrackRow:  { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  emailBadge:     { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.grayBg },
  emailBadgeText: { fontSize: 10, fontWeight: '600', color: C.gray },
  lastEmailText:  { fontSize: 10, color: C.inkSoft, marginBottom: 8 },

  // Resolution
  resolutionBox:  { backgroundColor: C.greenBg, borderRadius: 8, borderWidth: 1, borderColor: C.greenBdr, padding: 10, marginBottom: 8 },
  resolutionLabel:{ fontSize: 9, fontWeight: '800', color: C.green, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  resolutionNote: { fontSize: 12, color: C.ink, lineHeight: 17 },
  resolutionDate: { fontSize: 10, color: C.inkSoft, marginTop: 4 },

  detectedAt: { fontSize: 11, color: C.inkSoft },

  // Empty
  empty:           { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIcon:       { fontSize: 40, marginBottom: 10 },
  emptyTitle:      { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 6, textAlign: 'center' },
  emptyText:       { fontSize: 13, color: C.inkMid, textAlign: 'center', lineHeight: 20 },
  clearFiltersBtn: { marginTop: 14, backgroundColor: C.forest, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  clearFiltersBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

// ── Filter panel styles ────────────────────────────────────────────────────────
const fp = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: C.ink },
  cancelTxt:  { fontSize: 15, color: C.inkMid },
  clearTxt:   { fontSize: 15, color: C.red, fontWeight: '600' },
  body:       { padding: 20, gap: 24 },
  group:      { gap: 10 },
  groupTitle: { fontSize: 12, fontWeight: '800', color: C.forest, textTransform: 'uppercase', letterSpacing: 0.8 },
  chipWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.mist },
  chipActive:   { borderColor: C.forest, backgroundColor: C.green50 },
  chipTxt:      { fontSize: 13, color: C.inkMid, fontWeight: '500' },
  chipTxtActive:{ fontSize: 13, color: C.forest, fontWeight: '700' },
  footer:      { padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: C.border },
  applyBtn:    { backgroundColor: C.forest, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  applyBtnText:{ fontSize: 15, fontWeight: '800', color: '#fff' },
});

export default AdminStudentCoordinationScreen;
