import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { HomeworkHistoryRecord } from '../../../types/homeworkAssistance';
import {
  updateStudentResult,
  deleteHomeworkResult,
} from '../../../services/homeworkAssistanceService';

// ── Palette (shared High Five design system) ─────────────────────────────────
const C = {
  forest: '#1A5C38', leaf: '#3A8F5F', mist: '#F2FAF5',
  ink: '#1A1A1A', inkMid: 'rgba(26,26,26,0.65)', inkSoft: 'rgba(26,26,26,0.4)',
  border: '#E0EDE6', card: '#FFFFFF',
  red: '#D9534F', redBg: '#FDF1F1',
  amber: '#92600A', amberBg: '#FFFBEB',
  blue: '#1D4ED8', blueBg: '#EFF6FF',
  green50: '#F0F6EF',
};

// ── Status helpers (approved / rejected / waiting) ───────────────────────────
type SimpleStatus = 'approved' | 'rejected' | 'waiting';

const toSimpleStatus = (s: HomeworkHistoryRecord['professor_status']): SimpleStatus => {
  if (s === 'approved') return 'approved';
  if (s === 'rejected') return 'rejected';
  return 'waiting'; // pending + draft both await professor action
};

const STATUS_META: Record<SimpleStatus, { icon: string; label: string; bg: string; color: string }> = {
  approved: { icon: '✓', label: 'Approved',           bg: C.green50, color: C.forest },
  rejected: { icon: '✗', label: 'Rejected',           bg: C.redBg,   color: C.red    },
  waiting:  { icon: '⏳', label: 'Waiting for action', bg: C.amberBg, color: C.amber  },
};

const StatusPill: React.FC<{ status: SimpleStatus; small?: boolean }> = ({ status, small }) => {
  const m = STATUS_META[status];
  return (
    <View style={[styles.statusPill, { backgroundColor: m.bg }, small && styles.statusPillSmall]}>
      <Text style={[styles.statusPillText, { color: m.color }, small && { fontSize: 10 }]}>
        {m.icon} {m.label}
      </Text>
    </View>
  );
};

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
};

const gradeColor = (g: number) => (g >= 70 ? C.forest : g >= 55 ? C.amber : C.red);

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  onBack: () => void;
  records: HomeworkHistoryRecord[];
  professorName: string;
  loading: boolean;
  onChanged: () => void; // ask parent to reload from Supabase after edit/delete
}

type DateFilter = 'all' | '7d' | '30d';

// ── Main view ────────────────────────────────────────────────────────────────
const HomeworkHistoryView: React.FC<Props> = ({
  onBack, records, professorName, loading, onChanged,
}) => {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [fCourse, setFCourse]         = useState<string>('all');
  const [fStudent, setFStudent]       = useState<string>('all');
  const [fAssignment, setFAssignment] = useState<string>('all');
  const [fStatus, setFStatus]         = useState<'all' | SimpleStatus>('all');
  const [fDate, setFDate]             = useState<DateFilter>('all');

  // Detail panel (internal — not a route, not a modal)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Distinct values for filter chips
  const courseOptions     = useMemo(() => Array.from(new Set(records.map(r => r.course_name).filter(Boolean))).sort(), [records]);
  const studentOptions    = useMemo(() => Array.from(new Set(records.map(r => r.student_name).filter(Boolean))).sort(), [records]);
  const assignmentOptions = useMemo(() => Array.from(new Set(records.map(r => r.assignment_title).filter(Boolean))).sort(), [records]);

  const activeFilterCount =
    (fCourse !== 'all' ? 1 : 0) + (fStudent !== 'all' ? 1 : 0) +
    (fAssignment !== 'all' ? 1 : 0) + (fStatus !== 'all' ? 1 : 0) + (fDate !== 'all' ? 1 : 0);

  // ── Apply search + filters ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return records.filter(r => {
      if (q) {
        const hay = [
          r.student_name, r.assignment_title, r.course_name, r.topic_name ?? '',
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fCourse !== 'all' && r.course_name !== fCourse) return false;
      if (fStudent !== 'all' && r.student_name !== fStudent) return false;
      if (fAssignment !== 'all' && r.assignment_title !== fAssignment) return false;
      if (fStatus !== 'all' && toSimpleStatus(r.professor_status) !== fStatus) return false;
      if (fDate !== 'all') {
        const ageDays = (now - new Date(r.checked_at).getTime()) / 86_400_000;
        if (fDate === '7d' && ageDays > 7) return false;
        if (fDate === '30d' && ageDays > 30) return false;
      }
      return true;
    });
  }, [records, search, fCourse, fStudent, fAssignment, fStatus, fDate]);

  // ── Group primarily by assignment (then course) ─────────────────────────────
  const groups = useMemo(() => {
    const map = new Map<string, { assignment: string; course: string; items: HomeworkHistoryRecord[] }>();
    for (const r of filtered) {
      const key = `${r.assignment_title}__${r.course_name}`;
      if (!map.has(key)) map.set(key, { assignment: r.assignment_title, course: r.course_name, items: [] });
      map.get(key)!.items.push(r);
    }
    return Array.from(map.values()).sort((a, b) => {
      const at = Math.max(...a.items.map(i => new Date(i.checked_at).getTime()));
      const bt = Math.max(...b.items.map(i => new Date(i.checked_at).getTime()));
      return bt - at;
    });
  }, [filtered]);

  const selected = selectedId ? records.find(r => r.id === selectedId) ?? null : null;

  const clearFilters = () => {
    setFCourse('all'); setFStudent('all'); setFAssignment('all'); setFStatus('all'); setFDate('all');
  };

  // ── Detail panel ────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <DetailPanel
        record={selected}
        professorName={professorName}
        onBack={() => setSelectedId(null)}
        onChanged={onChanged}
      />
    );
  }

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>Homework History</Text>
          <Text style={styles.subtitle}>Saved AI-checked homework — by assignment, course and student.</Text>
        </View>
        <TouchableOpacity
          style={[styles.filterIconBtn, (showFilters || activeFilterCount > 0) && styles.filterIconBtnActive]}
          onPress={() => setShowFilters(v => !v)}
        >
          <Text style={[styles.filterIconText, (showFilters || activeFilterCount > 0) && styles.filterIconTextActive]}>
            ⚙︎ Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search student, homework, course or topic…"
          placeholderTextColor={C.inkSoft}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          <FilterGroup label="Course"     value={fCourse}     options={courseOptions}     onSelect={setFCourse} />
          <FilterGroup label="Student"    value={fStudent}    options={studentOptions}    onSelect={setFStudent} />
          <FilterGroup label="Assignment" value={fAssignment} options={assignmentOptions} onSelect={setFAssignment} />
          <FilterChips
            label="Status"
            value={fStatus}
            options={[
              { key: 'all', label: 'All' },
              { key: 'approved', label: '✓ Approved' },
              { key: 'rejected', label: '✗ Rejected' },
              { key: 'waiting', label: '⏳ Waiting' },
            ]}
            onSelect={k => setFStatus(k as 'all' | SimpleStatus)}
          />
          <FilterChips
            label="Date"
            value={fDate}
            options={[
              { key: 'all', label: 'Any time' },
              { key: '7d', label: 'Last 7 days' },
              { key: '30d', label: 'Last 30 days' },
            ]}
            onSelect={k => setFDate(k as DateFilter)}
          />
          {activeFilterCount > 0 && (
            <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters}>
              <Text style={styles.clearFiltersText}>Clear all filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Results */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={C.forest} />
          <Text style={styles.loadingText}>Loading homework history…</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>
            {records.length === 0 ? 'No saved homework yet' : 'No matches'}
          </Text>
          <Text style={styles.emptyText}>
            {records.length === 0
              ? 'Run the Homework Checker — every AI-checked submission is saved here automatically.'
              : 'Try a different search term or clear your filters.'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.resultCount}>
            {filtered.length} item{filtered.length !== 1 ? 's' : ''} · {groups.length} assignment{groups.length !== 1 ? 's' : ''}
          </Text>
          {groups.map(group => (
            <View key={`${group.assignment}__${group.course}`} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>📝 {group.assignment}</Text>
                <Text style={styles.groupCourse}>{group.course}</Text>
                <Text style={styles.groupCount}>
                  {group.items.length} student{group.items.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {group.items.map(item => {
                const grade = item.professor_edited_grade ?? item.overall_suggested_grade;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.studentRow}
                    onPress={() => setSelectedId(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentName}>{item.student_name}</Text>
                      <Text style={styles.studentMeta}>
                        {formatDate(item.checked_at)}
                        {item.topic_name ? ` · ${item.topic_name}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.studentGrade, { color: gradeColor(grade) }]}>{grade}%</Text>
                    <StatusPill status={toSimpleStatus(item.professor_status)} small />
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
};

// ── Filter sub-components ─────────────────────────────────────────────────────
const FilterChips: React.FC<{
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onSelect: (key: string) => void;
}> = ({ label, value, options, onSelect }) => (
  <View style={styles.filterGroup}>
    <Text style={styles.filterLabel}>{label}</Text>
    <View style={styles.chipWrap}>
      {options.map(o => (
        <TouchableOpacity
          key={o.key}
          style={[styles.chip, value === o.key && styles.chipActive]}
          onPress={() => onSelect(o.key)}
        >
          <Text style={[styles.chipText, value === o.key && styles.chipTextActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

const FilterGroup: React.FC<{
  label: string;
  value: string;
  options: string[];
  onSelect: (key: string) => void;
}> = ({ label, value, options, onSelect }) => {
  if (options.length === 0) return null;
  return (
    <FilterChips
      label={label}
      value={value}
      options={[{ key: 'all', label: 'All' }, ...options.map(o => ({ key: o, label: o }))]}
      onSelect={onSelect}
    />
  );
};

// ── Detail panel (internal page) ──────────────────────────────────────────────
const DetailPanel: React.FC<{
  record: HomeworkHistoryRecord;
  professorName: string;
  onBack: () => void;
  onChanged: () => void;
}> = ({ record, professorName, onBack, onChanged }) => {
  const initialComment = record.professor_edited_feedback ?? record.student_feedback_draft;
  const [comment, setComment] = useState(initialComment);
  const [note, setNote]       = useState(record.professor_note ?? '');
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg]         = useState('');

  const grade = record.professor_edited_grade ?? record.overall_suggested_grade;
  const status = toSimpleStatus(record.professor_status);
  const dirty = comment !== initialComment || note !== (record.professor_note ?? '');

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      await updateStudentResult(record.id, {
        professor_edited_feedback: comment,
        professor_note: note.trim() || undefined,
      });
      setMsg('✓ Comment saved');
      onChanged();
    } catch {
      setMsg('Could not save. Please try again.');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 2500);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete history item',
      `Remove "${record.student_name}" — ${record.assignment_title} from your homework history? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteHomeworkResult(record.id);
              onChanged();
              onBack();
            } catch {
              setDeleting(false);
              Alert.alert('Delete failed', 'Could not delete this item. Please try again.');
            }
          },
        },
      ],
    );
  };

  const Field: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value && value.length > 0 ? value : '—'}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← Back to history</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.detailHeader}>
        <Text style={styles.detailStudent}>{record.student_name}</Text>
        <View style={styles.detailHeaderMeta}>
          <View style={[styles.gradeBadge, { backgroundColor: gradeColor(grade) === C.forest ? C.green50 : gradeColor(grade) === C.amber ? C.amberBg : C.redBg }]}>
            <Text style={[styles.gradeBadgeText, { color: gradeColor(grade) }]}>
              {record.grade_points !== undefined && record.total_points !== undefined && record.total_points !== 100
                ? `${record.grade_points}/${record.total_points} pts · ${grade}%`
                : `${grade}%`}
            </Text>
          </View>
          <StatusPill status={status} />
        </View>
      </View>

      {/* Overview fields */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Overview</Text>
        <Field label="Student" value={record.student_name} />
        <Field label="Course" value={record.course_name} />
        <Field label="Assignment / Homework" value={record.assignment_title} />
        <Field label="Topic" value={record.topic_name} />
        <Field label="Uploaded file" value={record.uploaded_file_name} />
        <Field label="Score / Grade" value={
          record.grade_points !== undefined && record.total_points !== undefined
            ? `${record.grade_points}/${record.total_points} pts (${grade}%)`
            : `${grade}%`
        } />
        <Field label="Date checked" value={formatDate(record.checked_at)} />
        <Field label="Approved on" value={record.approved_at ? formatDate(record.approved_at) : undefined} />
        <Field label="Professor" value={professorName} />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Approval status</Text>
          <StatusPill status={status} small />
        </View>
      </View>

      {/* Rubric used */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 Rubric Used</Text>
        <Text style={styles.cardText}>{record.rubric_used || 'No rubric text was recorded for this assignment.'}</Text>
      </View>

      {/* AI comments */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🤖 AI Comments</Text>
        {record.grade_justification ? <Text style={styles.cardText}>{record.grade_justification}</Text> : null}
        {record.strengths.length > 0 && (
          <>
            <Text style={styles.aiSubhead}>Strengths</Text>
            {record.strengths.map((x, i) => <Text key={i} style={[styles.aiItem, { color: C.forest }]}>✓ {x}</Text>)}
          </>
        )}
        {record.weaknesses.length > 0 && (
          <>
            <Text style={styles.aiSubhead}>Weaknesses</Text>
            {record.weaknesses.map((x, i) => <Text key={i} style={[styles.aiItem, { color: C.amber }]}>→ {x}</Text>)}
          </>
        )}
        {record.improvement_recommendations.length > 0 && (
          <>
            <Text style={styles.aiSubhead}>Improvement Recommendations</Text>
            {record.improvement_recommendations.map((x, i) => <Text key={i} style={[styles.aiItem, { color: C.blue }]}>• {x}</Text>)}
          </>
        )}
        {record.missing_requirements.length > 0 && (
          <>
            <Text style={styles.aiSubhead}>Missing Requirements</Text>
            {record.missing_requirements.map((x, i) => <Text key={i} style={[styles.aiItem, { color: C.red }]}>! {x}</Text>)}
          </>
        )}
        {record.plagiarism_risk_summary ? (
          <>
            <Text style={styles.aiSubhead}>Originality</Text>
            <Text style={styles.cardText}>{record.plagiarism_risk_summary}</Text>
          </>
        ) : null}
      </View>

      {/* Editable professor comment */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>💬 Professor Comment</Text>
        <Text style={styles.helperText}>Edit the comment shared with the student. Saved to Supabase.</Text>
        <TextInput
          style={styles.commentInput}
          value={comment}
          onChangeText={setComment}
          multiline
          textAlignVertical="top"
          placeholder="Write or refine the feedback comment…"
          placeholderTextColor={C.inkSoft}
        />
      </View>

      {/* Private note */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🗒 Private Note</Text>
        <Text style={styles.helperText}>Only you can see this. Not shared with the student.</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          multiline
          textAlignVertical="top"
          placeholder="Add a private note…"
          placeholderTextColor={C.inkSoft}
        />
      </View>

      {msg ? <Text style={styles.savedMsg}>{msg}</Text> : null}

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.saveBtn, (!dirty || saving) && styles.btnDim]}
          onPress={handleSave}
          disabled={!dirty || saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={C.card} />
            : <Text style={styles.saveBtnText}>💾 Save Comment</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteBtn, deleting && styles.btnDim]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting
            ? <ActivityIndicator size="small" color={C.red} />
            : <Text style={styles.deleteBtnText}>🗑 Delete</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.mist },
  content: { padding: 20, paddingBottom: 60 },
  backBtn: { marginBottom: 12 },
  backText: { color: C.forest, fontSize: 15, fontWeight: '500' },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  screenTitle: { fontSize: 22, fontWeight: '700', color: C.ink, marginBottom: 6 },
  subtitle: { fontSize: 14, color: C.inkMid, lineHeight: 20 },

  filterIconBtn: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.card,
  },
  filterIconBtnActive: { borderColor: C.forest, backgroundColor: C.green50 },
  filterIconText: { fontSize: 13, fontWeight: '600', color: C.inkMid },
  filterIconTextActive: { color: C.forest },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14,
  },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, fontSize: 14, color: C.ink, paddingVertical: 2 },
  searchClear: { fontSize: 15, color: C.inkSoft, paddingHorizontal: 4 },

  filterPanel: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 14, marginBottom: 16, gap: 12,
  },
  filterGroup: { gap: 6 },
  filterLabel: { fontSize: 12, fontWeight: '700', color: C.inkMid, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: C.mist, borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.forest, borderColor: C.forest },
  chipText: { fontSize: 12, color: C.inkMid, fontWeight: '500' },
  chipTextActive: { color: C.card, fontWeight: '700' },
  clearFiltersBtn: { alignSelf: 'flex-start', paddingTop: 4 },
  clearFiltersText: { fontSize: 13, color: C.red, fontWeight: '600' },

  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 24 },
  loadingText: { color: C.inkMid, fontSize: 14 },

  emptyState: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  emptyText: { fontSize: 14, color: C.inkMid, textAlign: 'center', lineHeight: 20, maxWidth: 300 },

  resultCount: { fontSize: 12, color: C.inkSoft, marginBottom: 10, fontWeight: '600' },

  groupCard: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    marginBottom: 12, overflow: 'hidden',
  },
  groupHeader: {
    backgroundColor: C.green50, paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  groupTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  groupCourse: { fontSize: 12, color: C.forest, fontWeight: '600', marginTop: 2 },
  groupCount: { fontSize: 11, color: C.inkSoft, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  studentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  studentName: { fontSize: 14, fontWeight: '600', color: C.ink },
  studentMeta: { fontSize: 12, color: C.inkSoft, marginTop: 2 },
  studentGrade: { fontSize: 14, fontWeight: '700' },
  chevron: { fontSize: 22, color: C.inkSoft, marginLeft: 2 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  statusPillSmall: { paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 12, fontWeight: '700' },

  // Detail
  detailHeader: { marginBottom: 16, gap: 10 },
  detailStudent: { fontSize: 22, fontWeight: '700', color: C.ink },
  detailHeaderMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  gradeBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  gradeBadgeText: { fontSize: 14, fontWeight: '700' },

  card: {
    backgroundColor: C.card, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 10 },
  cardText: { fontSize: 14, color: C.inkMid, lineHeight: 21 },
  helperText: { fontSize: 12, color: C.inkSoft, marginBottom: 8, lineHeight: 17 },

  field: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, gap: 10, borderBottomWidth: 1, borderBottomColor: C.mist },
  fieldLabel: { fontSize: 13, color: C.inkSoft, width: 140 },
  fieldValue: { fontSize: 14, color: C.ink, fontWeight: '500', flex: 1 },

  aiSubhead: { fontSize: 13, fontWeight: '700', color: C.inkMid, marginTop: 12, marginBottom: 4 },
  aiItem: { fontSize: 14, lineHeight: 20, paddingVertical: 1 },

  commentInput: {
    backgroundColor: C.mist, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: C.ink, minHeight: 130,
  },
  noteInput: {
    backgroundColor: C.mist, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: C.ink, minHeight: 80,
  },

  savedMsg: { color: C.forest, textAlign: 'center', fontSize: 13, fontWeight: '600', marginVertical: 8 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveBtn: { flex: 1, backgroundColor: C.forest, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: C.card, fontSize: 14, fontWeight: '700' },
  deleteBtn: { borderWidth: 1.5, borderColor: C.red, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center' },
  deleteBtnText: { color: C.red, fontSize: 14, fontWeight: '700' },
  btnDim: { opacity: 0.4 },
});

export default HomeworkHistoryView;
