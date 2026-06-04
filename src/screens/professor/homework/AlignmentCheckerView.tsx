import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Course } from '../../../types';
import { HomeworkAlignmentCheck } from '../../../types/homeworkAssistance';
import { mockHomeworkAlignmentCheck } from '../../../services/homeworkAlignmentService';
import { runHomeworkAlignmentCheck } from '../../../services/homeworkAlignmentService';
import {
  fetchLockedCourseContext,
  fetchRelatedCourses,
  saveAlignmentCheck,
} from '../../../services/homeworkAssistanceService';
import {
  exportAlignmentResultAsText,
  copyToClipboard,
  exportAsPdf,
  exportAsWord,
} from '../../../services/homeworkExportService';
import { useInstitution } from '../../../context/InstitutionContext';

const C = {
  forest: '#1A5C38', leaf: '#3A8F5F', mist: '#F2FAF5',
  ink: '#1A1A1A', inkMid: 'rgba(26,26,26,0.65)', inkSoft: 'rgba(26,26,26,0.4)',
  border: '#E0EDE6', card: '#FFFFFF',
  red: '#D9534F', redBg: '#FDF1F1', redBdr: '#F5C6C6',
  amber: '#92600A', amberBg: '#FFFBEB', amberBdr: '#FDE68A',
  blue: '#1D4ED8', blueBg: '#EFF6FF',
  purple: '#6D28D9', purpleBg: '#F5F3FF',
  green50: '#F0F6EF',
};

interface AttachedFile {
  name: string;
  uri: string;
  mimeType: string;
}

interface Props {
  onBack: () => void;
  courses: Course[];
  professorId: string;
}

// ── Score circle ───────────────────────────────────────────────────────────────

const ScoreCircle: React.FC<{ score: number }> = ({ score }) => {
  const color = score >= 85 ? C.forest : score >= 65 ? C.amber : score >= 40 ? C.blue : C.red;
  return (
    <View style={[styles.scoreCircle, { borderColor: color }]}>
      <Text style={[styles.scoreNumber, { color }]}>{score}%</Text>
      <Text style={[styles.scoreLabel, { color }]}>Aligned</Text>
    </View>
  );
};

// ── Status badge ───────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    strongly_aligned:  { label: 'Strongly Aligned',  bg: C.green50,  color: C.forest },
    mostly_aligned:    { label: 'Mostly Aligned',    bg: C.amberBg,  color: C.amber  },
    partially_aligned: { label: 'Partially Aligned', bg: C.blueBg,   color: C.blue   },
    not_aligned:       { label: 'Not Aligned',       bg: C.redBg,    color: C.red    },
  };
  const { label, bg, color } = map[status] ?? { label: status, bg: C.green50, color: C.forest };
  return (
    <View style={[styles.statusBadge, { backgroundColor: bg }]}>
      <Text style={[styles.statusText, { color }]}>{label}</Text>
    </View>
  );
};

// ── Collapsible card ───────────────────────────────────────────────────────────

const CollapsibleCard: React.FC<{
  icon: string; title: string; children: React.ReactNode; defaultOpen?: boolean;
}> = ({ icon, title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.collCard}>
      <TouchableOpacity style={styles.collHeader} onPress={() => setOpen(v => !v)}>
        <Text style={styles.collTitle}>{icon} {title}</Text>
        <Text style={styles.collChevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && <View style={styles.collBody}>{children}</View>}
    </View>
  );
};

// ── Priority badge ─────────────────────────────────────────────────────────────

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const map: Record<string, { bg: string; color: string }> = {
    high:   { bg: C.redBg,    color: C.red    },
    medium: { bg: C.amberBg,  color: C.amber  },
    low:    { bg: C.green50,  color: C.forest },
  };
  const { bg, color } = map[priority] ?? { bg: C.green50, color: C.forest };
  return (
    <View style={[styles.priorityBadge, { backgroundColor: bg }]}>
      <Text style={[styles.priorityText, { color }]}>{priority.toUpperCase()}</Text>
    </View>
  );
};

// ── Overlap severity badge ─────────────────────────────────────────────────────

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const map: Record<string, { bg: string; color: string }> = {
    high:   { bg: C.redBg,   color: C.red   },
    medium: { bg: C.amberBg, color: C.amber },
    low:    { bg: C.green50, color: C.forest },
  };
  const { bg, color } = map[severity] ?? { bg: C.green50, color: C.forest };
  return (
    <View style={[styles.priorityBadge, { backgroundColor: bg }]}>
      <Text style={[styles.priorityText, { color }]}>{severity.toUpperCase()}</Text>
    </View>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

const AlignmentCheckerView: React.FC<Props> = ({ onBack, courses, professorId }) => {
  const { settings } = useInstitution();

  // Step 1 state
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [weekNumber, setWeekNumber] = useState('');
  const [weekTopic, setWeekTopic] = useState('');
  const [homeworkTitle, setHomeworkTitle] = useState('');
  const [homeworkText, setHomeworkText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2 state
  const [result, setResult] = useState<HomeworkAlignmentCheck | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  const handlePickFiles = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets) {
        const newFiles: AttachedFile[] = res.assets.map(a => ({
          name: a.name,
          uri: a.uri,
          mimeType: a.mimeType ?? 'application/octet-stream',
        }));
        setAttachedFiles(prev => [...prev, ...newFiles]);
      }
    } catch {
      setError('Could not open file picker.');
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRun = async () => {
    const wk = parseInt(weekNumber, 10);
    if (!selectedCourseId || !weekNumber || !weekTopic.trim() || (!homeworkText.trim() && !homeworkTitle.trim())) return;
    setLoading(true);
    setError(null);

    try {
      const accreditation = settings?.accreditation ?? 'AACSB';
      let rawResult: Omit<HomeworkAlignmentCheck, 'id' | 'professor_id' | 'course_id' | 'course_name' | 'created_at' | 'updated_at'>;

      try {
        const [courseContext, relatedCourses] = await Promise.all([
          fetchLockedCourseContext(selectedCourseId),
          fetchRelatedCourses(
            selectedCourseId,
            selectedCourse?.program ?? '',
            selectedCourse?.semester ?? '',
          ),
        ]);
        rawResult = await runHomeworkAlignmentCheck(
          selectedCourseId,
          homeworkTitle,
          homeworkText,
          wk,
          weekTopic.trim(),
          [],
          courseContext,
          relatedCourses,
          accreditation,
        );
      } catch (aiErr: any) {
        // If it's a real gate error (no syllabus / no scheme), surface it — don't fall to mock
        const msg: string = aiErr?.message ?? '';
        if (msg.includes('syllabus') || msg.includes('scheme of work')) {
          throw aiErr;
        }
        rawResult = mockHomeworkAlignmentCheck(selectedCourseId, homeworkTitle, homeworkText, wk, weekTopic.trim());
      }

      const now = new Date().toISOString();
      const fullResult: HomeworkAlignmentCheck = {
        id: `check-${Date.now()}`,
        professor_id: professorId,
        course_id: selectedCourseId,
        course_name: selectedCourse?.name ?? '',
        created_at: now,
        updated_at: now,
        ...rawResult,
      };
      setResult(fullResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleCopyText = async () => {
    if (!result) return;
    try {
      await copyToClipboard(exportAlignmentResultAsText(result));
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch {
      setCopyFeedback('Copy failed');
      setTimeout(() => setCopyFeedback(''), 2000);
    }
    setShowExportMenu(false);
  };

  const handleSaveAndClose = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await saveAlignmentCheck({
        professor_id: result.professor_id,
        course_id: result.course_id,
        course_name: result.course_name,
        homework_title: result.homework_title,
        homework_text: result.homework_text,
        uploaded_file_urls: result.uploaded_file_urls,
        alignment_percentage: result.alignment_percentage,
        alignment_status: result.alignment_status,
        covered_learning_objectives: result.covered_learning_objectives,
        missing_learning_objectives: result.missing_learning_objectives,
        syllabus_alignment_summary: result.syllabus_alignment_summary,
        scheme_of_work_alignment_summary: result.scheme_of_work_alignment_summary,
        accreditation_alignment_summary: result.accreditation_alignment_summary,
        program_alignment_summary: result.program_alignment_summary,
        overlap_detected: result.overlap_detected,
        overlap_details: result.overlap_details,
        ai_recommendations: result.ai_recommendations,
        suggested_revised_homework: result.suggested_revised_homework,
        generated_tasks: result.generated_tasks,
        professor_edits: result.professor_edits,
      });
      setSaved(true);
    } catch {
      // saved flag stays false but we still navigate back
    } finally {
      setSaving(false);
      onBack();
    }
  };

  // ── Step 2: Results ──────────────────────────────────────────────────────────

  if (result) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => setResult(null)} style={styles.backBtn}>
          <Text style={styles.backText}>← Edit & Re-check</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Alignment Results</Text>
        <Text style={styles.subtitle}>{result.course_name} — {result.homework_title}</Text>

        {/* Score */}
        <View style={styles.scoreRow}>
          <ScoreCircle score={result.alignment_percentage} />
          <StatusBadge status={result.alignment_status} />
        </View>

        {/* Covered objectives */}
        {result.covered_learning_objectives.length > 0 && (
          <CollapsibleCard icon="✅" title="Covered Learning Objectives" defaultOpen>
            {result.covered_learning_objectives.map((obj, i) => (
              <Text key={i} style={styles.listItem}>• {obj}</Text>
            ))}
          </CollapsibleCard>
        )}

        {/* Missing objectives */}
        {result.missing_learning_objectives.length > 0 && (
          <CollapsibleCard icon="⚠️" title={`Missing Learning Objectives (${result.missing_learning_objectives.length})`} defaultOpen>
            {result.missing_learning_objectives.map((obj, i) => (
              <Text key={i} style={[styles.listItem, { color: C.red }]}>✗ {obj}</Text>
            ))}
          </CollapsibleCard>
        )}

        {/* Recommendations */}
        {result.ai_recommendations.length > 0 && (
          <CollapsibleCard icon="💡" title="AI Recommendations" defaultOpen>
            {result.ai_recommendations.map((rec, i) => (
              <Text key={i} style={styles.listItem}>{i + 1}. {rec}</Text>
            ))}
          </CollapsibleCard>
        )}

        {/* Suggested revision */}
        {result.suggested_revised_homework ? (
          <CollapsibleCard icon="✏️" title="Suggested Revised Homework">
            <Text style={styles.summaryText}>{result.suggested_revised_homework}</Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={async () => {
                try {
                  await copyToClipboard(result.suggested_revised_homework);
                  setCopyFeedback('Copied!');
                  setTimeout(() => setCopyFeedback(''), 2000);
                } catch {}
              }}
            >
              <Text style={styles.copyBtnText}>📋 Copy Revised Homework</Text>
            </TouchableOpacity>
          </CollapsibleCard>
        ) : null}

        {copyFeedback ? (
          <Text style={styles.copyFeedback}>{copyFeedback}</Text>
        ) : null}

        {/* Action row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, saving && styles.actionBtnDim]}
            onPress={handleSaveAndClose}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={C.card} />
              : <Text style={styles.actionBtnText}>💾 Save & Close</Text>}
          </TouchableOpacity>

          <View>
            <TouchableOpacity
              style={styles.actionBtnOutline}
              onPress={() => setShowExportMenu(v => !v)}
            >
              <Text style={styles.actionBtnOutlineText}>📄 Export</Text>
            </TouchableOpacity>
            {showExportMenu && (
              <View style={styles.exportMenu}>
                <TouchableOpacity style={styles.exportItem} onPress={async () => {
                  await handleCopyText();
                  onBack();
                }}>
                  <Text style={styles.exportItemText}>📋 Copy as Text</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exportItem} onPress={() => { exportAsPdf(exportAlignmentResultAsText(result)); setShowExportMenu(false); onBack(); }}>
                  <Text style={styles.exportItemText}>📄 Export PDF (soon)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exportItem} onPress={() => { exportAsWord(exportAlignmentResultAsText(result)); setShowExportMenu(false); onBack(); }}>
                  <Text style={styles.exportItemText}>📝 Export Word (soon)</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    );
  }

  // ── Step 1: Input ────────────────────────────────────────────────────────────

  const canRun = selectedCourseId && weekNumber.trim() && weekTopic.trim() &&
    (homeworkTitle.trim() || homeworkText.trim()) && !loading;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.screenTitle}>Homework Alignment Checker</Text>
      <Text style={styles.subtitle}>
        Check if your homework is aligned with the scheme of work for a specific week.
        The course syllabus and scheme of work must both be locked before you can run a check.
      </Text>

      {/* Course selector */}
      <Text style={styles.label}>Select Course</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.courseScroll}>
        {courses.map(course => (
          <TouchableOpacity
            key={course.id}
            style={[styles.courseChip, selectedCourseId === course.id && styles.courseChipActive]}
            onPress={() => setSelectedCourseId(course.id)}
          >
            <Text style={[styles.courseChipText, selectedCourseId === course.id && styles.courseChipTextActive]}>
              {course.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {courses.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No courses found. Please contact your administrator.</Text>
        </View>
      )}

      {/* Week number + topic — required */}
      <View style={styles.weekRow}>
        <View style={styles.weekNumberWrap}>
          <Text style={styles.label}>Week № <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, styles.weekInput]}
            placeholder="e.g. 5"
            placeholderTextColor={C.inkSoft}
            value={weekNumber}
            onChangeText={v => setWeekNumber(v.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            maxLength={2}
          />
        </View>
        <View style={styles.weekTopicWrap}>
          <Text style={styles.label}>Week Topic <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Porter's Five Forces"
            placeholderTextColor={C.inkSoft}
            value={weekTopic}
            onChangeText={setWeekTopic}
          />
        </View>
      </View>
      <View style={styles.requiredNote}>
        <Text style={styles.requiredNoteText}>
          ⓘ  Week and topic are required. The AI checks alignment for this specific week only — not the full course.
        </Text>
      </View>

      {/* Homework title */}
      <Text style={styles.label}>Homework Title</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Week 5 Case Study Analysis"
        placeholderTextColor={C.inkSoft}
        value={homeworkTitle}
        onChangeText={setHomeworkTitle}
      />

      {/* Homework text */}
      <Text style={styles.label}>Homework Description / Instructions</Text>
      <TextInput
        style={styles.textarea}
        placeholder="Paste or type the full homework brief here…"
        placeholderTextColor={C.inkSoft}
        value={homeworkText}
        onChangeText={setHomeworkText}
        multiline
        textAlignVertical="top"
      />

      {/* File upload */}
      <Text style={styles.label}>Attachments (optional)</Text>
      <TouchableOpacity style={styles.fileUploadArea} onPress={handlePickFiles}>
        <Text style={styles.fileUploadIcon}>📎</Text>
        <Text style={styles.fileUploadText}>Attach files (PDF, DOCX, images…)</Text>
      </TouchableOpacity>

      {attachedFiles.map((file, i) => (
        <View key={i} style={styles.fileChip}>
          <Text style={styles.fileChipName} numberOfLines={1}>{file.name}</Text>
          <TouchableOpacity onPress={() => handleRemoveFile(i)}>
            <Text style={styles.fileChipRemove}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={C.forest} />
          <Text style={styles.loadingText}>
            Analysing homework against Week {weekNumber}{weekTopic ? ` — ${weekTopic}` : ''} requirements…
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.runBtn, !canRun && styles.runBtnDisabled]}
          onPress={handleRun}
          disabled={!canRun}
        >
          <Text style={styles.runBtnText}>🤖 Run AI Alignment Check</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.mist },
  content: { padding: 20, paddingBottom: 60 },
  backBtn: { marginBottom: 12 },
  backText: { color: C.forest, fontSize: 15, fontWeight: '500' },
  screenTitle: { fontSize: 22, fontWeight: '700', color: C.ink, marginBottom: 6 },
  subtitle: { fontSize: 14, color: C.inkMid, marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: C.ink,
  },
  textarea: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: C.ink, minHeight: 140,
  },
  courseScroll: { flexDirection: 'row', marginBottom: 4 },
  courseChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card, marginRight: 8,
  },
  courseChipActive: { backgroundColor: C.forest, borderColor: C.forest },
  courseChipText: { fontSize: 13, color: C.inkMid },
  courseChipTextActive: { color: C.card, fontWeight: '600' },
  emptyBox: {
    backgroundColor: C.amberBg, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: C.amberBdr, marginTop: 10,
  },
  emptyText: { color: C.amber, fontSize: 14 },
  fileUploadArea: {
    borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed',
    borderRadius: 10, backgroundColor: C.card,
    padding: 20, alignItems: 'center', marginTop: 4,
  },
  fileUploadIcon: { fontSize: 28, marginBottom: 8 },
  fileUploadText: { color: C.inkMid, fontSize: 14 },
  fileChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.green50, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    marginTop: 6, borderWidth: 1, borderColor: C.border,
  },
  fileChipName: { flex: 1, fontSize: 13, color: C.ink },
  fileChipRemove: { color: C.red, fontSize: 16, marginLeft: 8 },
  errorBox: {
    backgroundColor: C.redBg, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: C.redBdr, marginTop: 14,
  },
  errorText: { color: C.red, fontSize: 14 },
  loadingBox: { alignItems: 'center', paddingVertical: 30, gap: 16 },
  loadingText: { color: C.inkMid, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  runBtn: {
    backgroundColor: C.forest, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 24,
  },
  runBtnDisabled: { backgroundColor: 'rgba(26,92,56,0.4)' },
  runBtnText: { color: C.card, fontSize: 16, fontWeight: '700' },

  // Results
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 20, flexWrap: 'wrap' },
  scoreCircle: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 4, alignItems: 'center', justifyContent: 'center',
  },
  scoreNumber: { fontSize: 22, fontWeight: '800' },
  scoreLabel: { fontSize: 11, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  statusText: { fontSize: 14, fontWeight: '700' },

  collCard: {
    backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, marginBottom: 10, overflow: 'hidden',
  },
  collHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  collTitle: { fontSize: 15, fontWeight: '600', color: C.ink, flex: 1 },
  collChevron: { color: C.inkSoft, fontSize: 12 },
  collBody: { paddingHorizontal: 16, paddingBottom: 14, gap: 6 },

  listItem: { fontSize: 14, color: C.ink, lineHeight: 20, paddingVertical: 2 },
  summaryText: { fontSize: 14, color: C.inkMid, lineHeight: 21 },

  overlapCard: {
    backgroundColor: C.redBg, borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: C.redBdr, marginBottom: 8,
  },
  overlapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  overlapCourse: { fontSize: 14, fontWeight: '600', color: C.ink, flex: 1 },
  overlapProf: { fontSize: 12, color: C.inkSoft, marginBottom: 4 },
  overlapDesc: { fontSize: 13, color: C.inkMid, lineHeight: 19 },

  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityText: { fontSize: 11, fontWeight: '700' },

  taskCard: {
    backgroundColor: C.mist, borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: C.border, marginBottom: 8,
  },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 10 },
  taskTitle: { fontSize: 14, fontWeight: '600', color: C.ink, flex: 1 },
  taskDesc: { fontSize: 13, color: C.inkMid, lineHeight: 19 },

  copyBtn: {
    backgroundColor: C.forest, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start', marginTop: 10,
  },
  copyBtnText: { color: C.card, fontSize: 13, fontWeight: '600' },
  copyFeedback: { color: C.forest, textAlign: 'center', fontSize: 13, marginVertical: 8, fontWeight: '600' },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  actionBtn: {
    backgroundColor: C.forest, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  actionBtnDim: { backgroundColor: 'rgba(26,92,56,0.5)' },
  actionBtnText: { color: C.card, fontSize: 13, fontWeight: '600' },
  actionBtnOutline: {
    borderWidth: 1.5, borderColor: C.forest, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  actionBtnOutlineText: { color: C.forest, fontSize: 13, fontWeight: '600' },

  exportMenu: {
    position: 'absolute', top: 44, right: 0, backgroundColor: C.card,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 6,
    zIndex: 99, minWidth: 180,
  },
  exportItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  exportItemText: { fontSize: 14, color: C.ink },

  // Week / topic row
  weekRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  weekNumberWrap: { width: 90 },
  weekTopicWrap: { flex: 1 },
  weekInput: { textAlign: 'center' },
  required: { color: C.red, fontWeight: '700' },
  requiredNote: {
    backgroundColor: C.blueBg, borderRadius: 8, padding: 10,
    marginTop: 6, borderWidth: 1, borderColor: '#BFDBFE',
  },
  requiredNoteText: { fontSize: 12, color: C.blue, lineHeight: 17 },
});

export default AlignmentCheckerView;
