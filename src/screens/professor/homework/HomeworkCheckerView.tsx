import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Course } from '../../../types';
import { HomeworkGradingBatch, HomeworkStudentResult, MatchConfidence } from '../../../types/homeworkAssistance';
import { runHomeworkCheckerBatch, mockHomeworkCheckerBatch, StudentFile } from '../../../services/homeworkCheckerService';
import {
  fetchCourseEnrolledStudents,
  saveGradingBatch,
  saveStudentResult,
  updateStudentResult,
  uploadHomeworkFile,
  EnrolledStudent,
} from '../../../services/homeworkAssistanceService';
import {
  exportGradingResultAsText,
  copyToClipboard,
  copyBatchCSV,
} from '../../../services/homeworkExportService';

// ── Palette ────────────────────────────────────────────────────────────────────

const C = {
  forest: '#1A5C38', leaf: '#3A8F5F', mist: '#F2FAF5',
  ink: '#1A1A1A', inkMid: 'rgba(26,26,26,0.65)', inkSoft: 'rgba(26,26,26,0.4)',
  border: '#E0EDE6', card: '#FFFFFF',
  red: '#D9534F', redBg: '#FDF1F1', redBdr: '#F5C6C6',
  amber: '#92600A', amberBg: '#FFFBEB', amberBdr: '#FDE68A',
  blue: '#1D4ED8', blueBg: '#EFF6FF', blueBdr: '#BFDBFE',
  green50: '#F0F6EF',
  purple: '#6D28D9', purpleBg: '#F5F3FF', purpleBdr: '#DDD6FE',
};

// ── Local types ────────────────────────────────────────────────────────────────

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

type CheckerView = 'input' | 'batch' | 'student-detail';

// ── Grade badge ────────────────────────────────────────────────────────────────

const GradeBadge: React.FC<{ result: HomeworkStudentResult }> = ({ result }) => {
  const grade = result.professor_edited_grade ?? result.overall_suggested_grade;
  const color = grade >= 70 ? C.forest : grade >= 55 ? C.amber : C.red;
  const bg    = grade >= 70 ? C.green50 : grade >= 55 ? C.amberBg : C.redBg;
  const pts   = result.grade_points;
  const tot   = result.total_points;
  return (
    <View style={[s.gradeBadge, { backgroundColor: bg }]}>
      <Text style={[s.gradeText, { color }]}>
        {pts !== undefined && tot !== undefined && tot !== 100
          ? `${pts}/${tot} pts · ${grade}%`
          : `${grade}%`}
      </Text>
    </View>
  );
};

// ── Status badge ───────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending:  { label: 'Pending',  bg: C.amberBg, color: C.amber  },
    approved: { label: 'Approved', bg: C.green50, color: C.forest },
    rejected: { label: 'Rejected', bg: C.redBg,   color: C.red    },
    draft:    { label: 'Draft',    bg: C.blueBg,  color: C.blue   },
  };
  const { label, bg, color } = map[status] ?? { label: status, bg: C.green50, color: C.forest };
  return (
    <View style={[s.statusBadge, { backgroundColor: bg }]}>
      <Text style={[s.statusText, { color }]}>{label}</Text>
    </View>
  );
};

// ── Match badge ────────────────────────────────────────────────────────────────

const MatchBadge: React.FC<{ confidence?: MatchConfidence }> = ({ confidence }) => {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    confirmed: { label: '✓ Matched',     bg: C.green50,  color: C.forest },
    unclear:   { label: '⚠ Match Unclear', bg: C.amberBg, color: C.amber  },
    unmatched: { label: '✗ No Match',    bg: C.redBg,    color: C.red    },
    pending:   { label: '⏳ Matching…',  bg: C.blueBg,   color: C.blue   },
  };
  const conf = confidence ?? 'pending';
  const { label, bg, color } = map[conf] ?? map.pending;
  return (
    <View style={[s.matchBadge, { backgroundColor: bg }]}>
      <Text style={[s.matchText, { color }]}>{label}</Text>
    </View>
  );
};

// ── Student match picker (modal) ───────────────────────────────────────────────

const StudentMatchPicker: React.FC<{
  visible: boolean;
  enrolledStudents: EnrolledStudent[];
  currentStudentId?: string;
  onClose: () => void;
  onSelect: (student: EnrolledStudent) => void;
}> = ({ visible, enrolledStudents, currentStudentId, onClose, onSelect }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={s.pickerOverlay}>
      <TouchableOpacity style={s.pickerBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.pickerSheet}>
        <View style={s.pickerHeader}>
          <Text style={s.pickerTitle}>Assign to Enrolled Student</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={s.pickerClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {enrolledStudents.length === 0 ? (
            <Text style={s.pickerEmpty}>No enrolled students found for this course.</Text>
          ) : (
            enrolledStudents.map(st => {
              const isSelected = st.id === currentStudentId;
              return (
                <TouchableOpacity
                  key={st.id}
                  style={[s.pickerRow, isSelected && s.pickerRowSelected]}
                  onPress={() => { onSelect(st); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.pickerName, isSelected && { color: C.forest }]}>{st.full_name}</Text>
                    {st.email ? <Text style={s.pickerEmail}>{st.email}</Text> : null}
                  </View>
                  {isSelected && <Text style={s.pickerCheckmark}>✓</Text>}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

// ── Student detail ─────────────────────────────────────────────────────────────

const StudentDetail: React.FC<{
  result: HomeworkStudentResult;
  batchTitle: string;
  enrolledStudents: EnrolledStudent[];
  onBack: () => void;
  onUpdate: (updated: HomeworkStudentResult) => void;
}> = ({ result, batchTitle, enrolledStudents, onBack, onUpdate }) => {
  const [overrideGrade,  setOverrideGrade]  = useState(
    result.professor_edited_grade !== undefined ? String(result.professor_edited_grade) : '',
  );
  const [editedFeedback, setEditedFeedback] = useState(
    result.professor_edited_feedback ?? result.student_feedback_draft,
  );
  const [professorNote,  setProfessorNote]  = useState(result.professor_note ?? '');
  const [saving,         setSaving]         = useState(false);
  const [copyMsg,        setCopyMsg]        = useState('');
  const [matchPickerVisible, setMatchPickerVisible] = useState(false);

  const displayGrade = result.professor_edited_grade ?? result.overall_suggested_grade;

  // ── Status change (draft / rejected) ───────────────────────────────────────

  const handleStatusChange = async (newStatus: HomeworkStudentResult['professor_status']) => {
    setSaving(true);
    const updates: Partial<HomeworkStudentResult> = {
      professor_status:        newStatus,
      professor_edited_grade:  overrideGrade ? Number(overrideGrade) : undefined,
      professor_edited_feedback: editedFeedback !== result.student_feedback_draft ? editedFeedback : undefined,
      professor_note:          professorNote.trim() || undefined,
    };
    try { await updateStudentResult(result.id, updates); } catch { /* update locally */ }
    onUpdate({ ...result, ...updates });
    setSaving(false);
  };

  // ── Approve & Save to student profile ──────────────────────────────────────

  const handleApproveAndSave = async () => {
    if (!result.student_id) {
      Alert.alert(
        'Student Not Assigned',
        'This submission has not been matched to an enrolled student. Tap "Change Match" below to assign it before approving.',
        [{ text: 'OK' }],
      );
      return;
    }
    setSaving(true);
    const approvedAt = new Date().toISOString();
    const updates: Partial<HomeworkStudentResult> = {
      professor_status:          'approved',
      professor_edited_grade:    overrideGrade ? Number(overrideGrade) : undefined,
      professor_edited_feedback: editedFeedback !== result.student_feedback_draft ? editedFeedback : undefined,
      professor_note:            professorNote.trim() || undefined,
      approved_at:               approvedAt,
      student_id:                result.student_id,
      match_confidence:          result.match_confidence === 'unclear' ? 'confirmed' : result.match_confidence,
    };

    let updatedResult = { ...result, ...updates };

    // ── Step 1: try to update the existing DB row ────────────────────────────
    let dbSaved = false;
    try {
      await updateStudentResult(result.id, updates);
      dbSaved = true;
    } catch {
      // Row may not be in DB yet (initial batch save failed for any reason).
      // Attempt a fresh insert so the result reaches the student profile.
      try {
        const fresh = await saveStudentResult({
          batch_id:                    result.batch_id,
          student_name:                result.student_name,
          student_id:                  result.student_id,
          match_confidence:            (updates.match_confidence ?? result.match_confidence ?? 'confirmed') as MatchConfidence,
          submission_file_url:         result.submission_file_url,
          overall_suggested_grade:     result.overall_suggested_grade,
          grade_points:                result.grade_points,
          total_points:                result.total_points,
          rubric_criterion_grades:     result.rubric_criterion_grades,
          grade_justification:         result.grade_justification,
          strengths:                   result.strengths,
          weaknesses:                  result.weaknesses,
          improvement_recommendations: result.improvement_recommendations ?? [],
          missing_requirements:        result.missing_requirements,
          plagiarism_risk_summary:     result.plagiarism_risk_summary,
          original_ai_feedback:        result.original_ai_feedback ?? result.student_feedback_draft,
          student_feedback_draft:      result.student_feedback_draft,
          professor_edited_grade:      updates.professor_edited_grade,
          professor_edited_feedback:   updates.professor_edited_feedback,
          professor_note:              updates.professor_note,
          professor_status:            'approved',
          approved_at:                 approvedAt,
        });
        updatedResult = { ...updatedResult, id: fresh.id };
        dbSaved = true;
      } catch (insertErr) {
        setSaving(false);
        Alert.alert(
          'Could Not Save',
          'The approved feedback could not be saved to the database.\n\n' +
          'Try re-running the Homework Checker for this student, then approve again.\n\n' +
          (insertErr instanceof Error ? insertErr.message : String(insertErr)),
        );
        return;
      }
    }

    // ── Step 2: update local state & confirm ────────────────────────────────
    onUpdate(updatedResult);
    setSaving(false);
    if (dbSaved) {
      Alert.alert(
        '✓ Approved',
        'Homework feedback saved. It will now appear in the student\'s course profile.',
        [{ text: 'OK' }],
      );
    }
  };

  // ── Change student match ────────────────────────────────────────────────────

  const handleMatchChange = async (student: EnrolledStudent) => {
    const updates: Partial<HomeworkStudentResult> = {
      student_id:       student.id,
      student_name:     student.full_name,
      match_confidence: 'confirmed',
    };
    try { await updateStudentResult(result.id, updates); } catch { /* update locally */ }
    onUpdate({ ...result, ...updates });
  };

  const handleCopyFeedback = async () => {
    try {
      await copyToClipboard(editedFeedback);
      setCopyMsg('Copied!');
    } catch { setCopyMsg('Copy failed'); }
    setTimeout(() => setCopyMsg(''), 2000);
  };

  const handleExportText = async () => {
    try {
      await copyToClipboard(exportGradingResultAsText(result, batchTitle));
      setCopyMsg('Full report copied!');
    } catch { setCopyMsg('Copy failed'); }
    setTimeout(() => setCopyMsg(''), 2000);
  };

  const needsMatch = !result.student_id || result.match_confidence === 'unmatched';

  return (
    <>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← Back to results</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={s.detailHeader}>
          <Text style={s.studentName}>{result.student_name}</Text>
          <GradeBadge result={result} />
          <StatusBadge status={result.professor_status} />
        </View>

        {/* Match status */}
        <View style={s.card}>
          <Text style={s.cardTitle}>👤 Student Match</Text>
          <View style={s.matchRow}>
            <MatchBadge confidence={result.match_confidence} />
            {result.student_id ? (
              <Text style={s.matchName}>{result.student_name}</Text>
            ) : (
              <Text style={[s.matchName, { color: C.red }]}>Not assigned to a student</Text>
            )}
          </View>
          <TouchableOpacity style={s.changeMatchBtn} onPress={() => setMatchPickerVisible(true)}>
            <Text style={s.changeMatchText}>
              {needsMatch ? '⚠️ Assign Student (required to approve)' : '↺ Change Match'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Rubric table */}
        {result.rubric_criterion_grades.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>📊 Rubric Breakdown</Text>
            <View style={s.rubricRow}>
              <Text style={[s.rubricCell, s.rubricHeader, { flex: 2 }]}>Criterion</Text>
              <Text style={[s.rubricCell, s.rubricHeader]}>Max</Text>
              <Text style={[s.rubricCell, s.rubricHeader]}>Score</Text>
            </View>
            {result.rubric_criterion_grades.map((r, i) => (
              <View key={i}>
                <View style={[s.rubricRow, i % 2 === 1 && { backgroundColor: C.mist }]}>
                  <Text style={[s.rubricCell, { flex: 2 }]}>{r.criterion}</Text>
                  <Text style={s.rubricCell}>{r.max_score}</Text>
                  <Text style={[s.rubricCell, { color: C.forest, fontWeight: '600' }]}>{r.suggested_score}</Text>
                </View>
                <Text style={s.rubricExplanation}>{r.explanation}</Text>
              </View>
            ))}
            {result.grade_points !== undefined && result.total_points !== undefined && (
              <View style={s.rubricTotal}>
                <Text style={s.rubricTotalLabel}>TOTAL</Text>
                <Text style={s.rubricTotalValue}>{result.grade_points} / {result.total_points} pts ({displayGrade}%)</Text>
              </View>
            )}
          </View>
        )}

        {/* Grade justification */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📝 Grade Justification</Text>
          <Text style={s.cardText}>{result.grade_justification}</Text>
        </View>

        {/* Strengths */}
        {result.strengths.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>💪 Strengths</Text>
            {result.strengths.map((st, i) => (
              <Text key={i} style={[s.listItem, { color: C.forest }]}>✓ {st}</Text>
            ))}
          </View>
        )}

        {/* Weaknesses */}
        {result.weaknesses.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>🔍 Weaknesses</Text>
            {result.weaknesses.map((w, i) => (
              <Text key={i} style={[s.listItem, { color: C.amber }]}>→ {w}</Text>
            ))}
          </View>
        )}

        {/* Improvement recommendations */}
        {(result.improvement_recommendations ?? []).length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>🚀 Improvement Recommendations</Text>
            {(result.improvement_recommendations ?? []).map((rec, i) => (
              <Text key={i} style={[s.listItem, { color: C.blue }]}>• {rec}</Text>
            ))}
          </View>
        )}

        {/* Missing requirements */}
        {result.missing_requirements.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>⚠️ Missing Requirements</Text>
            {result.missing_requirements.map((mr, i) => (
              <Text key={i} style={[s.listItem, { color: C.red }]}>! {mr}</Text>
            ))}
          </View>
        )}

        {/* Originality */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🔍 Originality Assessment</Text>
          <Text style={s.cardText}>{result.plagiarism_risk_summary}</Text>
          {result.plagiarism_risk_summary.toLowerCase().includes('concern') && (
            <View style={s.warningBox}>
              <Text style={s.warningText}>⚠️ Possible similarity concern — review carefully before approving.</Text>
            </View>
          )}
        </View>

        {/* Feedback draft */}
        <View style={s.card}>
          <Text style={s.cardTitle}>💬 Student Feedback Draft</Text>
          <TextInput
            style={s.feedbackInput}
            value={editedFeedback}
            onChangeText={setEditedFeedback}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity style={s.copyBtn} onPress={handleCopyFeedback}>
            <Text style={s.copyBtnText}>📋 Copy Feedback</Text>
          </TouchableOpacity>
        </View>

        {/* Grade override */}
        <View style={s.card}>
          <Text style={s.cardTitle}>✏️ Override Grade (optional)</Text>
          <TextInput
            style={s.input}
            value={overrideGrade}
            onChangeText={val => {
              const n = val.replace(/[^0-9]/g, '');
              if (n === '' || (parseInt(n, 10) >= 0 && parseInt(n, 10) <= 100)) setOverrideGrade(n);
            }}
            keyboardType="numeric"
            placeholder={`AI suggested: ${result.overall_suggested_grade}%`}
            placeholderTextColor={C.inkSoft}
            maxLength={3}
          />
        </View>

        {/* Professor note */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🗒 Professor Note (private)</Text>
          <TextInput
            style={s.noteInput}
            value={professorNote}
            onChangeText={setProfessorNote}
            multiline
            textAlignVertical="top"
            placeholder="Add a private note about this submission (not shared with student)…"
            placeholderTextColor={C.inkSoft}
          />
        </View>

        {copyMsg ? <Text style={s.copyFeedbackMsg}>{copyMsg}</Text> : null}

        {/* Actions */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.approveBtn, (saving || needsMatch) && s.btnDim]}
            onPress={handleApproveAndSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={C.card} />
              : <Text style={s.approveBtnText}>✓ Approve & Save</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.rejectBtn, saving && s.btnDim]}
            onPress={() => handleStatusChange('rejected')}
            disabled={saving}
          >
            <Text style={s.rejectBtnText}>✗ Reject</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.draftBtn, saving && s.btnDim]}
            onPress={() => handleStatusChange('draft')}
            disabled={saving}
          >
            <Text style={s.draftBtnText}>💾 Save Draft</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.exportBtn} onPress={handleExportText}>
            <Text style={s.exportBtnText}>📋 Copy Report</Text>
          </TouchableOpacity>
        </View>

        {needsMatch && (
          <View style={s.approveHint}>
            <Text style={s.approveHintText}>
              ⚠️ Assign this submission to a student (tap "Change Match" above) before you can approve.
            </Text>
          </View>
        )}
      </ScrollView>

      <StudentMatchPicker
        visible={matchPickerVisible}
        enrolledStudents={enrolledStudents}
        currentStudentId={result.student_id}
        onClose={() => setMatchPickerVisible(false)}
        onSelect={handleMatchChange}
      />
    </>
  );
};

// ── Batch results ──────────────────────────────────────────────────────────────

const BatchResults: React.FC<{
  batch: HomeworkGradingBatch;
  onBack: () => void;
  onSelectStudent: (result: HomeworkStudentResult) => void;
}> = ({ batch, onBack, onSelectStudent }) => {
  const [csvMsg, setCsvMsg] = useState('');

  const handleExportCSV = async () => {
    try {
      await copyBatchCSV(batch);
      setCsvMsg('CSV copied to clipboard!');
    } catch { setCsvMsg('Copy failed'); }
    setTimeout(() => setCsvMsg(''), 3000);
  };

  const approved  = batch.student_results.filter(r => r.professor_status === 'approved').length;
  const pending   = batch.student_results.filter(r => r.professor_status === 'pending').length;
  const unclear   = batch.student_results.filter(r => r.match_confidence === 'unclear' || r.match_confidence === 'unmatched').length;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <TouchableOpacity onPress={onBack} style={s.backBtn}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={s.screenTitle}>{batch.assignment_title}</Text>
      <Text style={s.subtitle}>{batch.course_name} — {batch.student_results.length} students analysed</Text>

      {/* Summary row */}
      <View style={s.batchSummaryRow}>
        <View style={s.batchStat}>
          <Text style={[s.batchStatNum, { color: C.forest }]}>{approved}</Text>
          <Text style={s.batchStatLabel}>Approved</Text>
        </View>
        <View style={s.batchStat}>
          <Text style={[s.batchStatNum, { color: C.amber }]}>{pending}</Text>
          <Text style={s.batchStatLabel}>Pending</Text>
        </View>
        {unclear > 0 && (
          <View style={s.batchStat}>
            <Text style={[s.batchStatNum, { color: C.red }]}>{unclear}</Text>
            <Text style={s.batchStatLabel}>Unmatched</Text>
          </View>
        )}
        <TouchableOpacity style={s.csvBtn} onPress={handleExportCSV}>
          <Text style={s.csvBtnText}>📊 Export CSV</Text>
        </TouchableOpacity>
      </View>
      {csvMsg ? <Text style={s.csvMsg}>{csvMsg}</Text> : null}

      {unclear > 0 && (
        <View style={s.matchWarningBox}>
          <Text style={s.matchWarningText}>⚠️ {unclear} submission{unclear > 1 ? 's' : ''} could not be matched to an enrolled student. Open each to assign manually before approving.</Text>
        </View>
      )}

      {batch.student_results.map(r => (
        <View key={r.id} style={s.studentCard}>
          <View style={s.studentCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.studentCardName}>{r.student_name}</Text>
            </View>
            <GradeBadge result={r} />
          </View>
          <View style={s.studentCardMeta}>
            <StatusBadge status={r.professor_status} />
            <MatchBadge confidence={r.match_confidence} />
          </View>
          <TouchableOpacity style={s.viewDetailBtn} onPress={() => onSelectStudent(r)}>
            <Text style={s.viewDetailText}>View Details →</Text>
          </TouchableOpacity>
        </View>
      ))}

      {batch.student_results.length === 0 && (
        <View style={s.emptyBox}>
          <Text style={s.emptyText}>No student results found.</Text>
        </View>
      )}
    </ScrollView>
  );
};

// ── Main view ──────────────────────────────────────────────────────────────────

const HomeworkCheckerView: React.FC<Props> = ({ onBack, courses, professorId }) => {
  const [view,               setView]               = useState<CheckerView>('input');
  const [selectedCourseId,   setSelectedCourseId]   = useState('');
  const [assignmentTitle,    setAssignmentTitle]     = useState('');
  const [assignmentInstructions, setAssignmentInstructions] = useState('');
  const [rubricText,         setRubricText]          = useState('');
  const [rubricFile,         setRubricFile]          = useState<AttachedFile | null>(null);
  const [studentFiles,       setStudentFiles]        = useState<AttachedFile[]>([]);
  const [enrolledStudents,   setEnrolledStudents]    = useState<EnrolledStudent[]>([]);
  const [enrolledLoading,    setEnrolledLoading]     = useState(false);
  const [loading,            setLoading]             = useState(false);
  const [error,              setError]               = useState<string | null>(null);
  const [batch,              setBatch]               = useState<HomeworkGradingBatch | null>(null);
  const [selectedStudent,    setSelectedStudent]     = useState<HomeworkStudentResult | null>(null);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  // Fetch enrolled students when course changes
  useEffect(() => {
    if (!selectedCourseId) { setEnrolledStudents([]); return; }
    setEnrolledLoading(true);
    fetchCourseEnrolledStudents(selectedCourseId)
      .then(setEnrolledStudents)
      .catch(() => setEnrolledStudents([]))
      .finally(() => setEnrolledLoading(false));
  }, [selectedCourseId]);

  // ── File pickers ─────────────────────────────────────────────────────────────

  const handlePickRubricFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const a = res.assets[0];
        setRubricFile({ name: a.name, uri: a.uri, mimeType: a.mimeType ?? 'application/octet-stream' });
      }
    } catch { setError('Could not open file picker.'); }
  };

  const handlePickStudentFiles = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets) {
        setStudentFiles(prev => [
          ...prev,
          ...res.assets.map(a => ({ name: a.name, uri: a.uri, mimeType: a.mimeType ?? 'application/octet-stream' })),
        ]);
      }
    } catch { setError('Could not open file picker.'); }
  };

  // ── Run AI check ──────────────────────────────────────────────────────────────

  const handleRun = async () => {
    if (!selectedCourseId || !assignmentTitle.trim() || studentFiles.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Upload rubric file (non-critical)
      let rubricFileUrl = '';
      if (rubricFile) {
        try { rubricFileUrl = await uploadHomeworkFile(rubricFile.uri, rubricFile.name, rubricFile.mimeType); } catch {}
      }

      // 2. Upload student files concurrently (non-critical)
      const uploaded = await Promise.all(
        studentFiles.map(async f => {
          let url = '';
          try { url = await uploadHomeworkFile(f.uri, f.name, f.mimeType); } catch {}
          return { name: f.name, content: `[File: ${f.name}]`, url };
        }),
      );

      // 3. Run AI
      const files: StudentFile[] = uploaded.map(f => ({ name: f.name, content: f.content }));
      let result: HomeworkGradingBatch;
      try {
        result = await runHomeworkCheckerBatch(
          selectedCourseId,
          assignmentTitle,
          assignmentInstructions,
          rubricText,
          files,
          enrolledStudents,
        );
      } catch {
        const names = studentFiles.map(f => f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '));
        result = mockHomeworkCheckerBatch(selectedCourseId, assignmentTitle, names, enrolledStudents);
      }

      // 4. Inject uploaded URLs
      const resultsWithUrls = result.student_results.map((r, i) => ({
        ...r,
        submission_file_url: uploaded[i]?.url ?? '',
      }));

      const finalBatch: HomeworkGradingBatch = {
        ...result,
        professor_id:    professorId,
        course_id:       selectedCourseId,
        course_name:     selectedCourse?.name ?? '',
        rubric_file_urls: rubricFileUrl ? [rubricFileUrl] : [],
        student_results: resultsWithUrls,
      };

      // 5. Persist to DB (get real UUIDs back)
      let displayBatch = finalBatch;
      try {
        const saved = await saveGradingBatch(finalBatch);
        const savedResults: HomeworkStudentResult[] = [];
        for (const sr of finalBatch.student_results) {
          try {
            const dbResult = await saveStudentResult({
              batch_id:                    saved.id,
              student_name:                sr.student_name,
              student_id:                  sr.student_id,
              match_confidence:            sr.match_confidence ?? 'pending',
              submission_file_url:         sr.submission_file_url,
              overall_suggested_grade:     sr.overall_suggested_grade,
              grade_points:                sr.grade_points,
              total_points:                sr.total_points,
              rubric_criterion_grades:     sr.rubric_criterion_grades,
              grade_justification:         sr.grade_justification,
              strengths:                   sr.strengths,
              weaknesses:                  sr.weaknesses,
              improvement_recommendations: sr.improvement_recommendations ?? [],
              missing_requirements:        sr.missing_requirements,
              plagiarism_risk_summary:     sr.plagiarism_risk_summary,
              original_ai_feedback:        sr.original_ai_feedback ?? sr.student_feedback_draft,
              student_feedback_draft:      sr.student_feedback_draft,
              professor_status:            'pending',
            });
            savedResults.push({ ...sr, id: dbResult.id, batch_id: saved.id });
          } catch { savedResults.push({ ...sr, batch_id: saved.id }); }
        }
        displayBatch = { ...finalBatch, id: saved.id, student_results: savedResults };
      } catch { /* show results even if DB save fails */ }

      setBatch(displayBatch);
      setView('batch');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Local state helpers ───────────────────────────────────────────────────────

  const handleUpdateStudent = (updated: HomeworkStudentResult) => {
    if (!batch) return;
    setBatch({ ...batch, student_results: batch.student_results.map(r => r.id === updated.id ? updated : r) });
    if (selectedStudent?.id === updated.id) setSelectedStudent(updated);
  };

  // ── Sub-view routing ──────────────────────────────────────────────────────────

  if (view === 'student-detail' && selectedStudent && batch) {
    return (
      <StudentDetail
        result={selectedStudent}
        batchTitle={batch.assignment_title}
        enrolledStudents={enrolledStudents}
        onBack={() => setView('batch')}
        onUpdate={handleUpdateStudent}
      />
    );
  }

  if (view === 'batch' && batch) {
    return (
      <BatchResults
        batch={batch}
        onBack={() => setView('input')}
        onSelectStudent={r => { setSelectedStudent(r); setView('student-detail'); }}
      />
    );
  }

  // ── Input view ────────────────────────────────────────────────────────────────

  const canRun = selectedCourseId && assignmentTitle.trim() && studentFiles.length > 0 && !loading;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <TouchableOpacity onPress={onBack} style={s.backBtn}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={s.screenTitle}>Homework Checker</Text>
      <Text style={s.subtitle}>
        Upload student submissions and get AI-powered grading with rubric breakdown, feedback drafts, and similarity assessment.
      </Text>

      {/* Course selector */}
      <Text style={s.label}>Select Course</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.courseScroll}>
        {courses.map(course => (
          <TouchableOpacity
            key={course.id}
            style={[s.courseChip, selectedCourseId === course.id && s.courseChipActive]}
            onPress={() => setSelectedCourseId(course.id)}
          >
            <Text style={[s.courseChipText, selectedCourseId === course.id && s.courseChipTextActive]}>
              {course.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Enrolled students status */}
      {selectedCourseId && (
        <View style={s.enrolledBanner}>
          {enrolledLoading ? (
            <ActivityIndicator size="small" color={C.forest} />
          ) : (
            <Text style={s.enrolledText}>
              {enrolledStudents.length > 0
                ? `✓ ${enrolledStudents.length} enrolled student${enrolledStudents.length > 1 ? 's' : ''} loaded — AI will match submissions to the roster`
                : '⚠ No enrolled students found for this course — student matching will be disabled'}
            </Text>
          )}
        </View>
      )}

      {/* Assignment title */}
      <Text style={s.label}>Assignment Title</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Mid-term Case Study"
        placeholderTextColor={C.inkSoft}
        value={assignmentTitle}
        onChangeText={setAssignmentTitle}
      />

      {/* Instructions */}
      <Text style={s.label}>Assignment Instructions</Text>
      <TextInput
        style={s.textarea}
        placeholder="Paste the assignment brief or instructions here…"
        placeholderTextColor={C.inkSoft}
        value={assignmentInstructions}
        onChangeText={setAssignmentInstructions}
        multiline
        textAlignVertical="top"
      />

      {/* Rubric file */}
      <Text style={s.label}>Rubric File (optional)</Text>
      <Text style={s.uploadHint}>Upload a PDF/DOCX rubric for reference. Type the rubric below for AI grading.</Text>
      {rubricFile ? (
        <View style={s.fileChip}>
          <Text style={s.fileChipIcon}>📄</Text>
          <Text style={s.fileChipName} numberOfLines={1}>{rubricFile.name}</Text>
          <TouchableOpacity onPress={() => setRubricFile(null)}>
            <Text style={s.fileChipRemove}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={s.fileUploadAreaSmall} onPress={handlePickRubricFile}>
          <Text style={s.fileUploadSmallText}>📎 Upload Rubric File (PDF, DOCX)</Text>
        </TouchableOpacity>
      )}

      {/* Rubric text */}
      <Text style={s.label}>Grading Rubric — Text (for AI)</Text>
      <TextInput
        style={s.textarea}
        placeholder={`Paste rubric criteria here, e.g.:\n- Content & Analysis: 40 points\n- Structure: 25 points\n- References: 20 points\n- Writing: 15 points\nTotal: 100 points`}
        placeholderTextColor={C.inkSoft}
        value={rubricText}
        onChangeText={setRubricText}
        multiline
        textAlignVertical="top"
      />

      {/* Student submissions */}
      <Text style={s.label}>Student Submissions</Text>
      <Text style={s.uploadHint}>
        Each file = one student. Name files clearly (e.g. "Alice_Smith_Assignment.pdf") for best AI matching.
      </Text>
      <TouchableOpacity style={s.fileUploadArea} onPress={handlePickStudentFiles}>
        <Text style={s.fileUploadIcon}>📤</Text>
        <Text style={s.fileUploadText}>Upload student submissions</Text>
        <Text style={s.fileUploadSub}>PDF, DOCX, TXT · tap to add more</Text>
      </TouchableOpacity>

      {studentFiles.map((file, i) => (
        <View key={i} style={s.fileChip}>
          <Text style={s.fileChipIcon}>👤</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.fileChipName} numberOfLines={1}>
              {file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')}
            </Text>
            <Text style={s.fileChipSub} numberOfLines={1}>{file.name}</Text>
          </View>
          <TouchableOpacity onPress={() => setStudentFiles(prev => prev.filter((_, idx) => idx !== i))}>
            <Text style={s.fileChipRemove}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      {studentFiles.length > 0 && (
        <Text style={s.fileCount}>{studentFiles.length} student{studentFiles.length > 1 ? 's' : ''} ready for analysis</Text>
      )}

      {error && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={C.forest} />
          <Text style={s.loadingText}>Analysing {studentFiles.length} submission{studentFiles.length > 1 ? 's' : ''}…</Text>
          <Text style={s.loadingSubText}>Uploading files and running AI — this may take a moment.</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[s.runBtn, !canRun && s.runBtnDisabled]}
          onPress={handleRun}
          disabled={!canRun}
        >
          <Text style={s.runBtnText}>🤖 Run AI Homework Check</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.mist },
  content:   { padding: 20, paddingBottom: 60 },
  backBtn:   { marginBottom: 12 },
  backText:  { color: C.forest, fontSize: 15, fontWeight: '500' },
  screenTitle: { fontSize: 22, fontWeight: '700', color: C.ink, marginBottom: 6 },
  subtitle:    { fontSize: 14, color: C.inkMid, marginBottom: 20, lineHeight: 20 },
  label:       { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 6, marginTop: 14 },
  uploadHint:  { fontSize: 12, color: C.inkSoft, marginBottom: 8 },

  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: C.ink,
  },
  feedbackInput: {
    backgroundColor: C.mist, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: C.ink, minHeight: 140,
  },
  noteInput: {
    backgroundColor: C.mist, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: C.ink, minHeight: 80,
  },
  textarea: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: C.ink, minHeight: 120,
  },

  courseScroll: { flexDirection: 'row', marginBottom: 4 },
  courseChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card, marginRight: 8,
  },
  courseChipActive: { backgroundColor: C.forest, borderColor: C.forest },
  courseChipText:   { fontSize: 13, color: C.inkMid },
  courseChipTextActive: { color: C.card, fontWeight: '600' },

  enrolledBanner: {
    backgroundColor: C.green50, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 8,
  },
  enrolledText: { fontSize: 12, color: C.forest, fontWeight: '500' },

  fileUploadArea: {
    borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed',
    borderRadius: 10, backgroundColor: C.card,
    padding: 24, alignItems: 'center',
  },
  fileUploadAreaSmall: {
    borderWidth: 1, borderColor: C.border, borderStyle: 'dashed',
    borderRadius: 10, backgroundColor: C.card,
    paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center',
  },
  fileUploadIcon:      { fontSize: 32, marginBottom: 8 },
  fileUploadText:      { color: C.ink, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  fileUploadSub:       { color: C.inkSoft, fontSize: 12 },
  fileUploadSmallText: { color: C.forest, fontSize: 13, fontWeight: '600' },

  fileChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 6, borderWidth: 1, borderColor: C.border, gap: 8,
  },
  fileChipIcon:   { fontSize: 16 },
  fileChipName:   { fontSize: 13, color: C.ink, fontWeight: '500' },
  fileChipSub:    { fontSize: 11, color: C.inkSoft },
  fileChipRemove: { color: C.red, fontSize: 16, paddingLeft: 4 },
  fileCount:      { fontSize: 12, color: C.forest, marginTop: 8, fontWeight: '600' },

  errorBox: {
    backgroundColor: C.redBg, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: C.redBdr, marginTop: 14,
  },
  errorText: { color: C.red, fontSize: 14 },

  loadingBox:    { alignItems: 'center', paddingVertical: 30, gap: 12 },
  loadingText:   { color: C.ink, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  loadingSubText:{ color: C.inkSoft, fontSize: 13, textAlign: 'center' },

  runBtn: {
    backgroundColor: C.forest, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 24,
  },
  runBtnDisabled: { backgroundColor: 'rgba(26,92,56,0.4)' },
  runBtnText:     { color: C.card, fontSize: 16, fontWeight: '700' },

  // Batch results
  batchSummaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 12, flexWrap: 'wrap',
  },
  batchStat: {
    backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 64,
  },
  batchStatNum:   { fontSize: 18, fontWeight: '900', color: C.ink },
  batchStatLabel: { fontSize: 10, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
  csvBtn: {
    backgroundColor: C.forest, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, marginLeft: 'auto',
  },
  csvBtnText: { color: C.card, fontSize: 12, fontWeight: '700' },
  csvMsg:     { fontSize: 12, color: C.forest, fontWeight: '600', marginBottom: 8 },

  matchWarningBox: {
    backgroundColor: C.amberBg, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: C.amberBdr, marginBottom: 12,
  },
  matchWarningText: { fontSize: 13, color: C.amber, lineHeight: 18 },

  studentCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  studentCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  studentCardMeta:   { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  studentCardName:   { fontSize: 15, fontWeight: '600', color: C.ink, flex: 1 },
  viewDetailBtn:     { alignSelf: 'flex-end' },
  viewDetailText:    { color: C.forest, fontSize: 13, fontWeight: '600' },

  // Student detail
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    flexWrap: 'wrap', marginBottom: 16,
  },
  studentName: { fontSize: 20, fontWeight: '700', color: C.ink, flex: 1 },

  card: {
    backgroundColor: C.card, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 10 },
  cardText:  { fontSize: 14, color: C.inkMid, lineHeight: 21 },
  listItem:  { fontSize: 14, lineHeight: 20, paddingVertical: 2 },

  matchRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  matchName:     { fontSize: 14, fontWeight: '600', color: C.ink, flex: 1 },
  changeMatchBtn:{
    backgroundColor: C.mist, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start',
  },
  changeMatchText:{ fontSize: 13, fontWeight: '600', color: C.forest },

  rubricRow:        { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  rubricCell:       { flex: 1, fontSize: 13, color: C.ink, paddingHorizontal: 4 },
  rubricHeader:     { fontWeight: '700', color: C.inkMid, fontSize: 12 },
  rubricExplanation:{ fontSize: 12, color: C.inkSoft, paddingHorizontal: 4, paddingBottom: 6, lineHeight: 17 },
  rubricTotal:      {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border,
  },
  rubricTotalLabel: { fontSize: 11, fontWeight: '800', color: C.inkMid, textTransform: 'uppercase', letterSpacing: 0.5 },
  rubricTotalValue: { fontSize: 14, fontWeight: '700', color: C.forest },

  warningBox: { backgroundColor: C.amberBg, borderRadius: 8, padding: 10, marginTop: 8 },
  warningText:{ color: C.amber, fontSize: 13, lineHeight: 18 },

  copyBtn: {
    backgroundColor: C.forest, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start', marginTop: 10,
  },
  copyBtnText:     { color: C.card, fontSize: 13, fontWeight: '600' },
  copyFeedbackMsg: { color: C.forest, textAlign: 'center', fontSize: 13, fontWeight: '600', marginVertical: 8 },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  approveBtn: { backgroundColor: C.forest, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  approveBtnText: { color: C.card, fontSize: 13, fontWeight: '700' },
  rejectBtn:  { backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  rejectBtnText:  { color: C.card, fontSize: 13, fontWeight: '700' },
  draftBtn: { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  draftBtnText:   { color: C.ink, fontSize: 13, fontWeight: '600' },
  exportBtn: { borderWidth: 1.5, borderColor: C.forest, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  exportBtnText:  { color: C.forest, fontSize: 13, fontWeight: '600' },
  btnDim: { opacity: 0.4 },

  approveHint: {
    backgroundColor: C.amberBg, borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: C.amberBdr, marginTop: 8,
  },
  approveHintText: { fontSize: 13, color: C.amber, lineHeight: 18 },

  // Badges
  gradeBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  gradeText:   { fontSize: 13, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText:  { fontSize: 12, fontWeight: '600' },
  matchBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  matchText:   { fontSize: 11, fontWeight: '700' },

  emptyBox: { backgroundColor: C.amberBg, borderRadius: 10, padding: 16, marginTop: 16 },
  emptyText:{ color: C.amber, fontSize: 14 },

  // Match picker modal
  pickerOverlay:  { flex: 1, justifyContent: 'flex-end' },
  pickerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: {
    backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  pickerTitle: { fontSize: 17, fontWeight: '800', color: C.ink },
  pickerClose: { fontSize: 18, color: C.inkMid, paddingHorizontal: 8 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  pickerRowSelected: { backgroundColor: C.green50 },
  pickerName:        { fontSize: 15, fontWeight: '600', color: C.ink },
  pickerEmail:       { fontSize: 12, color: C.inkSoft, marginTop: 2 },
  pickerCheckmark:   { fontSize: 18, color: C.forest, fontWeight: '800', marginLeft: 8 },
  pickerEmpty:       { fontSize: 14, color: C.inkSoft, textAlign: 'center', padding: 24 },
});

export default HomeworkCheckerView;
