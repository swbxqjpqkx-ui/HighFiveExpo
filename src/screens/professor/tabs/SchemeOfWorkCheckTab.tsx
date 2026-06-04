import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Course, Profile } from '../../../types';
import { SchemeOfWork, SchemeOfWorkRequest, AIAnalysisResult } from '../../../types/courseManagement';
import {
  getCourseSchemeOfWork, getPendingSchemeOfWorkRequest,
  submitSchemeOfWorkRequest, getAIAnalysis, uploadCourseFile,
} from '../../../services/courseManagement';
import { analyseDocumentWithAI } from '../../../services/aiAnalysis';
import { useInstitution } from '../../../context/InstitutionContext';

interface PickedFile { uri: string; name: string; mimeType: string; file?: File; }

const C = {
  forest: '#1A5C38', leaf: '#3A8F5F', mist: '#F2FAF5',
  ink: '#1A1A1A', inkMid: 'rgba(26,26,26,0.65)', inkSoft: 'rgba(26,26,26,0.4)',
  border: '#E0EDE6', card: '#FFFFFF', green50: '#F0F6EF',
  red: '#D9534F', redBg: '#FDF1F1', redBdr: '#F5C6C6',
  amber: '#92600A', amberBg: '#FFFBEB', amberBdr: '#FDE68A',
  blue: '#1D4ED8', blueBg: '#EFF6FF',
};

interface Props {
  course: Course;
  profile: Profile;
  schemeOfWork: SchemeOfWork | null;
  onSchemeOfWorkChange: (s: SchemeOfWork | null) => void;
}

const statusMeta: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  none:      { label: 'No Scheme of Work', color: C.red,    bg: C.redBg,    icon: '📅' },
  submitted: { label: 'Pending Review',    color: C.amber,  bg: C.amberBg,  icon: '⏳' },
  approved:  { label: 'Approved',          color: C.blue,   bg: C.blueBg,   icon: '✅' },
  locked:    { label: 'Locked',            color: C.forest, bg: C.green50,  icon: '🔒' },
  rejected:  { label: 'Rejected',          color: C.red,    bg: C.redBg,    icon: '❌' },
};

const IssueCard: React.FC<{ issue: AIAnalysisResult['issues'][0] }> = ({ issue }) => {
  const [expanded, setExpanded] = useState(false);
  const severityStyle = {
    critical: { bar: C.red,    bg: C.redBg,    label: '● Critical' },
    warning:  { bar: C.amber,  bg: C.amberBg,  label: '● Warning'  },
    info:     { bar: C.blue,   bg: C.blueBg,   label: '● Info'     },
  }[issue.severity];

  return (
    <TouchableOpacity
      style={[s.issueCard, { borderLeftColor: severityStyle.bar, backgroundColor: severityStyle.bg }]}
      onPress={() => setExpanded(v => !v)}
      activeOpacity={0.8}
    >
      <View style={s.issueHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[s.issueSeverity, { color: severityStyle.bar }]}>{severityStyle.label}</Text>
          <Text style={s.issueCode}>{issue.requirement_code} · {issue.requirement_title}</Text>
        </View>
        <Text style={s.issueChevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      <Text style={s.issueDesc} numberOfLines={expanded ? undefined : 2}>{issue.description}</Text>
      {expanded && (
        <View style={s.issueDetails}>
          {issue.location && (
            <Text style={s.issueMeta}>📍 <Text style={{ fontWeight: '600' }}>Location:</Text> {issue.location}</Text>
          )}
          {issue.outcome_affected && (
            <Text style={s.issueMeta}>🎯 <Text style={{ fontWeight: '600' }}>Outcome:</Text> {issue.outcome_affected}</Text>
          )}
          <Text style={[s.issueMeta, { marginTop: 6, color: C.forest, fontWeight: '600' }]}>
            💡 Recommendation:
          </Text>
          <Text style={s.issueRec}>{issue.recommendation}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const SchemeOfWorkCheckTab: React.FC<Props> = ({ course, profile, schemeOfWork, onSchemeOfWorkChange }) => {
  const { settings } = useInstitution();
  const [pendingRequest, setPendingRequest] = useState<SchemeOfWorkRequest | null>(null);
  const [analysis, setAnalysis]             = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading]               = useState(true);
  const [analysing, setAnalysing]           = useState(false);
  const [showRequest, setShowRequest]       = useState(false);
  const [requestReason, setRequestReason]   = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [pickedFile, setPickedFile]         = useState<PickedFile | null>(null);
  const [uploading, setUploading]           = useState(false);
  const [preCheck, setPreCheck]             = useState<AIAnalysisResult | null>(null);
  const [preChecking, setPreChecking]       = useState(false);

  const status: string = schemeOfWork?.status ?? 'none';
  const meta = statusMeta[status] ?? statusMeta['none'];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sow, req] = await Promise.all([
        getCourseSchemeOfWork(course.id),
        getPendingSchemeOfWorkRequest(course.id),
      ]);
      onSchemeOfWorkChange(sow);
      setPendingRequest(req);

      if (sow?.status === 'locked') {
        const existing = await getAIAnalysis(course.id, sow.id);
        setAnalysis(existing);
      }
    } catch {
      // tables may not exist yet — handled by empty state UI
    } finally {
      setLoading(false);
    }
  }, [course.id]);

  useEffect(() => { load(); }, [load]);

  const runAnalysis = async () => {
    if (!schemeOfWork || schemeOfWork.status !== 'locked') return;
    if (!schemeOfWork.file_url) {
      Alert.alert('No file', 'No document was uploaded with this scheme of work.');
      return;
    }
    setAnalysing(true);
    try {
      const result = await analyseDocumentWithAI(
        schemeOfWork.file_url,
        course.id,
        schemeOfWork.id,
        'scheme_of_work',
        settings?.accreditation ?? 'AACSB',
        course.program,
      );
      setAnalysis(result);
    } catch (e: any) {
      Alert.alert('Analysis Failed', e?.message ?? 'Could not analyse document.');
    } finally {
      setAnalysing(false);
    }
  };

  const handlePreCheck = async () => {
    if (!pickedFile) return;
    setPreChecking(true);
    setPreCheck(null);
    try {
      const result = await analyseDocumentWithAI(
        pickedFile.uri,
        course.id,
        'pre-check',
        'scheme_of_work',
        settings?.accreditation ?? 'AACSB',
        course.program,
      );
      setPreCheck(result);
    } catch (e: any) {
      Alert.alert('Pre-check Failed', e?.message ?? 'Could not analyse document.');
    } finally {
      setPreChecking(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword',
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
               'application/vnd.ms-powerpoint',
               'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setPickedFile({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType ?? 'application/pdf',
          file: (asset as any).file ?? undefined,
        });
        setPreCheck(null);
      }
    } catch {
      Alert.alert('Error', 'Could not open file picker.');
    }
  };

  const handleSubmitRequest = async () => {
    if (!requestReason.trim()) {
      Alert.alert('Required', 'Please write a reason before submitting.');
      return;
    }
    setSubmitting(true);
    setUploading(false);
    let fileUrl: string | undefined;
    let fileName: string | undefined;
    try {
      if (pickedFile) {
        setUploading(true);
        const remotePath = `${course.id}/sow_${Date.now()}_${pickedFile.name}`;
        fileUrl = await uploadCourseFile(pickedFile.uri, remotePath, pickedFile.mimeType, pickedFile.file);
        fileName = pickedFile.name;
        setUploading(false);
      }
      await submitSchemeOfWorkRequest(
        course.id,
        profile.id,
        schemeOfWork ? 'replace' : 'initial',
        requestReason.trim(),
        fileUrl,
        fileName,
      );
      setShowRequest(false);
      setRequestReason('');
      setPickedFile(null);
      await load();
      Alert.alert('Request Sent', 'Your scheme of work has been sent to the administrator for review.');
    } catch (e: any) {
      setUploading(false);
      Alert.alert('Error', e?.message ?? JSON.stringify(e) ?? 'Failed to send request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={s.centre}>
        <ActivityIndicator color={C.leaf} size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.content}>

      {/* ── Status banner ── */}
      <View style={[s.statusBanner, { backgroundColor: meta.bg, borderColor: meta.color + '40' }]}>
        <Text style={s.statusIcon}>{meta.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.statusLabel, { color: meta.color }]}>{meta.label}</Text>
          {schemeOfWork && (
            <Text style={s.statusSub}>
              Version {schemeOfWork.version}
              {schemeOfWork.locked_at
                ? ` · Locked ${new Date(schemeOfWork.locked_at).toLocaleDateString()}`
                : schemeOfWork.submitted_at
                ? ` · Submitted ${new Date(schemeOfWork.submitted_at).toLocaleDateString()}`
                : ''}
            </Text>
          )}
          {!schemeOfWork && (
            <Text style={s.statusSub}>No scheme of work has been uploaded for this course yet.</Text>
          )}
        </View>
      </View>

      {/* ── Unlocked warning ── */}
      {schemeOfWork && (schemeOfWork.status === 'approved' || schemeOfWork.status === 'submitted') && (
        <View style={s.warningBox}>
          <Text style={s.warningTitle}>⚠️  Analysis Disabled</Text>
          <Text style={s.warningText}>
            {schemeOfWork.status === 'submitted'
              ? 'Your scheme of work is pending administrator approval. AI analysis will begin after the administrator approves and locks it.'
              : 'Your scheme of work has been approved but is not yet locked. The administrator must lock it before AI analysis can begin.'}
          </Text>
        </View>
      )}

      {/* ── Pending request notice ── */}
      {pendingRequest && (
        <View style={[s.infoBox, { borderColor: C.amberBdr, backgroundColor: C.amberBg }]}>
          <Text style={[s.infoText, { color: C.amber, fontWeight: '700' }]}>
            📋 Request Pending Admin Review
          </Text>
          <Text style={[s.infoText, { color: C.amber }]}>
            {pendingRequest.request_type === 'replace'
              ? 'A replacement request is waiting for administrator approval.'
              : 'Your initial scheme of work submission is waiting for administrator review.'}
          </Text>
          <Text style={[s.infoText, { color: C.amber, marginTop: 4 }]}>
            Reason: {pendingRequest.reason}
          </Text>
        </View>
      )}

      {/* ── Actions ── */}
      <View style={s.actionRow}>
        {schemeOfWork?.file_url && (
          <TouchableOpacity
            style={s.btnOutline}
            onPress={() => {
              if (typeof window !== 'undefined') {
                window.open(schemeOfWork.file_url, '_blank');
              }
            }}
          >
            <Text style={s.btnOutlineText}>📅 View Scheme of Work</Text>
          </TouchableOpacity>
        )}
        {!pendingRequest && schemeOfWork?.status !== 'submitted' && (
          <TouchableOpacity style={s.btnPrimary} onPress={() => setShowRequest(true)}>
            <Text style={s.btnPrimaryText}>
              {schemeOfWork ? '🔄 Request Replacement' : '⬆️  Submit Scheme of Work'}
            </Text>
          </TouchableOpacity>
        )}
        {schemeOfWork?.status === 'locked' && (
          <TouchableOpacity style={s.btnSecondary} onPress={runAnalysis} disabled={analysing}>
            {analysing
              ? <ActivityIndicator color={C.forest} size="small" />
              : <Text style={s.btnSecondaryText}>🤖 Run AI Analysis</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* ── Upload placeholder ── */}
      {!schemeOfWork && !showRequest && (
        <TouchableOpacity style={s.uploadPlaceholder} onPress={() => setShowRequest(true)}>
          <Text style={s.uploadIcon}>📅</Text>
          <Text style={s.uploadTitle}>Upload Scheme of Work</Text>
          <Text style={s.uploadSub}>PDF or Word document</Text>
        </TouchableOpacity>
      )}

      {/* ── Request form ── */}
      {showRequest && (
        <View style={s.card}>
          <Text style={s.cardTitle}>
            {schemeOfWork ? 'Request Scheme of Work Replacement' : 'Submit Scheme of Work'}
          </Text>
          <Text style={s.fieldLabel}>Reason / Notes for Administrator *</Text>
          <TextInput
            style={s.textArea}
            value={requestReason}
            onChangeText={setRequestReason}
            placeholder="Describe the changes or reason for this submission…"
            placeholderTextColor={C.inkSoft}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <TouchableOpacity style={[s.uploadInForm, pickedFile && s.uploadInFormPicked]} onPress={handlePickFile}>
            {pickedFile ? (
              <>
                <Text style={s.uploadInFormText}>✅ {pickedFile.name}</Text>
                <Text style={[s.uploadInFormText, { fontSize: 11, marginTop: 2 }]}>Tap to change file</Text>
              </>
            ) : (
              <Text style={s.uploadInFormText}>📎 Attach File (PDF or Word)</Text>
            )}
          </TouchableOpacity>

          {/* AI Pre-check */}
          {pickedFile && (
            <View style={s.preCheckBox}>
              <View style={s.preCheckHeader}>
                <Text style={s.preCheckTitle}>🤖 AI Pre-check</Text>
                <TouchableOpacity
                  style={[s.preCheckBtn, preChecking && { opacity: 0.6 }]}
                  onPress={handlePreCheck}
                  disabled={preChecking}
                >
                  {preChecking
                    ? <><ActivityIndicator size="small" color="#fff" /><Text style={s.preCheckBtnTxt}> Analysing…</Text></>
                    : <Text style={s.preCheckBtnTxt}>{preCheck ? '↻ Re-run' : 'Run Analysis'}</Text>
                  }
                </TouchableOpacity>
              </View>
              <Text style={s.preCheckSub}>
                Check your document against {settings?.accreditation ?? 'AACSB'} standards before submitting to admin.
              </Text>

              {preCheck && (
                <View style={s.preCheckResult}>
                  <View style={s.preCheckScoreRow}>
                    <View style={[s.preCheckCircle, {
                      borderColor: preCheck.overall_score >= 80 ? C.forest : preCheck.overall_score >= 60 ? C.amber : C.red,
                    }]}>
                      <Text style={[s.preCheckScore, {
                        color: preCheck.overall_score >= 80 ? C.forest : preCheck.overall_score >= 60 ? C.amber : C.red,
                      }]}>{preCheck.overall_score}</Text>
                      <Text style={s.preCheckScoreDen}>/100</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.preCheckCompliance, {
                        color: preCheck.compliance_level === 'full' ? C.forest :
                               preCheck.compliance_level === 'partial' ? C.amber : C.red,
                      }]}>
                        {preCheck.compliance_level === 'full' ? '✓ Fully Compliant' :
                         preCheck.compliance_level === 'partial' ? '⚠ Partial Compliance' : '✕ Non-Compliant'}
                      </Text>
                      <Text style={s.preCheckIssueSummary}>
                        {preCheck.issues.filter(i => i.severity === 'critical').length} critical ·{' '}
                        {preCheck.issues.filter(i => i.severity === 'warning').length} warnings
                      </Text>
                    </View>
                  </View>
                  {preCheck.issues.map(issue => (
                    <View key={issue.id} style={[s.preCheckIssue, {
                      borderLeftColor: issue.severity === 'critical' ? C.red : issue.severity === 'warning' ? C.amber : C.blue,
                    }]}>
                      <Text style={[s.preCheckIssueCode, {
                        color: issue.severity === 'critical' ? C.red : issue.severity === 'warning' ? C.amber : C.blue,
                      }]}>{issue.requirement_code} · {issue.severity.toUpperCase()}</Text>
                      <Text style={s.preCheckIssueDesc}>{issue.description}</Text>
                      <Text style={s.preCheckIssueRec}>💡 {issue.recommendation}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={s.formBtns}>
            <TouchableOpacity style={s.btnOutline} onPress={() => { setShowRequest(false); setRequestReason(''); }}>
              <Text style={s.btnOutlineText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnPrimary, !requestReason.trim() && { opacity: 0.5 }]}
              onPress={handleSubmitRequest}
              disabled={!requestReason.trim() || submitting || uploading}
            >
              {uploading
                ? <><ActivityIndicator color="#fff" size="small" /><Text style={[s.btnPrimaryText, { marginLeft: 6 }]}>Uploading…</Text></>
                : submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.btnPrimaryText}>Send to Admin</Text>
              }
            </TouchableOpacity>
          </View>
          <View style={[s.infoBox, { marginTop: 10 }]}>
            <Text style={s.infoText}>
              ℹ️  Only the administrator can approve and lock schemes of work. After locking, AI analysis activates automatically.
            </Text>
          </View>
        </View>
      )}

      {/* ── AI Analysis Results ── */}
      {schemeOfWork?.status === 'locked' && (
        <View style={s.card}>
          <Text style={s.cardTitle}>AI Analysis — {settings?.accreditation ?? 'Accreditation'} Check</Text>

          {!analysis && !analysing && (
            <Text style={s.emptyText}>No analysis yet. Tap "Run AI Analysis" to generate a detailed report.</Text>
          )}

          {analysis && (
            <>
              <View style={s.scoreRow}>
                <View style={[s.scoreCircle, {
                  borderColor: analysis.overall_score >= 80 ? C.forest : analysis.overall_score >= 60 ? C.amber : C.red,
                }]}>
                  <Text style={[s.scoreNum, {
                    color: analysis.overall_score >= 80 ? C.forest : analysis.overall_score >= 60 ? C.amber : C.red,
                  }]}>{analysis.overall_score}</Text>
                  <Text style={s.scoreDen}>/100</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.complianceLabel}>
                    {analysis.compliance_level === 'full'         && '✅ Fully Compliant'}
                    {analysis.compliance_level === 'partial'      && '⚠️  Partially Compliant'}
                    {analysis.compliance_level === 'non_compliant' && '❌ Non-Compliant'}
                  </Text>
                  <Text style={s.issuesSummary}>
                    {analysis.issues.filter(i => i.severity === 'critical').length} critical  ·{' '}
                    {analysis.issues.filter(i => i.severity === 'warning').length} warnings  ·{' '}
                    {analysis.issues.filter(i => i.severity === 'info').length} notes
                  </Text>
                  <Text style={s.analysedAt}>
                    Analysed {new Date(analysis.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>

              {analysis.issues.length > 0 && (
                <>
                  <Text style={s.issuesSectionTitle}>Identified Issues</Text>
                  {analysis.issues.map(issue => (
                    <IssueCard key={issue.id} issue={issue} />
                  ))}
                </>
              )}

              {analysis.suggestions && analysis.suggestions.length > 0 && (
                <>
                  <Text style={[s.issuesSectionTitle, { marginTop: 12, color: C.forest }]}>
                    ✅ Strengths
                  </Text>
                  {analysis.suggestions.map((strength, i) => (
                    <View key={i} style={s.strengthCard}>
                      <Text style={s.strengthText}>{'✓  '}{strength}</Text>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  content:  { padding: 16, paddingBottom: 40 },
  centre:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 12,
  },
  statusIcon:  { fontSize: 28 },
  statusLabel: { fontSize: 15, fontWeight: '700' },
  statusSub:   { fontSize: 12, color: C.inkMid, marginTop: 2 },

  warningBox: {
    backgroundColor: C.redBg, borderWidth: 1, borderColor: C.redBdr,
    borderRadius: 8, padding: 12, marginBottom: 12,
  },
  warningTitle: { fontSize: 13, fontWeight: '700', color: C.red, marginBottom: 4 },
  warningText:  { fontSize: 12, color: C.red, lineHeight: 18 },

  infoBox: {
    backgroundColor: C.green50, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, padding: 12, marginBottom: 12,
  },
  infoText: { fontSize: 12, color: C.inkMid, lineHeight: 17 },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  btnPrimary: {
    backgroundColor: C.forest, borderRadius: 8, paddingVertical: 10,
    paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnOutline: {
    borderWidth: 1.5, borderColor: C.forest, borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  btnOutlineText: { color: C.forest, fontWeight: '600', fontSize: 13 },
  btnSecondary: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 14, backgroundColor: C.card,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  btnSecondaryText: { color: C.forest, fontWeight: '600', fontSize: 13 },

  uploadPlaceholder: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: C.border,
    borderRadius: 10, padding: 32, alignItems: 'center', marginBottom: 16,
    backgroundColor: C.mist,
  },
  uploadIcon:  { fontSize: 40, marginBottom: 8 },
  uploadTitle: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 4 },
  uploadSub:   { fontSize: 12, color: C.inkMid },

  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardTitle:  { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: C.ink, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 5 },
  textArea: {
    borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10,
    fontSize: 13, color: C.ink, minHeight: 90, marginBottom: 10,
  },
  uploadInForm: {
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.border,
    borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 12,
  },
  uploadInFormPicked: { borderColor: C.forest, backgroundColor: C.green50 },
  uploadInFormText: { fontSize: 13, color: C.inkMid },
  formBtns: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },

  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  scoreCircle: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreNum:       { fontSize: 26, fontWeight: '900' },
  scoreDen:       { fontSize: 10, color: C.inkSoft },
  complianceLabel:{ fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  issuesSummary:  { fontSize: 12, color: C.inkMid },
  analysedAt:     { fontSize: 11, color: C.inkSoft, marginTop: 2 },

  issuesSectionTitle: { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 8 },
  issueCard: {
    borderLeftWidth: 3, borderRadius: 8, padding: 12, marginBottom: 8,
  },
  issueHeader:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  issueSeverity:{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  issueCode:    { fontSize: 12, color: C.inkMid, marginTop: 1 },
  issueChevron: { fontSize: 11, color: C.inkSoft },
  issueDesc:    { fontSize: 13, color: C.ink, lineHeight: 19 },
  issueDetails: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  issueMeta:    { fontSize: 12, color: C.inkMid, marginBottom: 3, lineHeight: 17 },
  issueRec:     { fontSize: 12, color: C.forest, lineHeight: 18 },

  emptyText: { fontSize: 13, color: C.inkSoft, textAlign: 'center', paddingVertical: 16 },

  strengthCard: {
    backgroundColor: C.green50, borderLeftWidth: 3, borderLeftColor: C.forest,
    borderRadius: 8, padding: 10, marginBottom: 6,
  },
  strengthText: { fontSize: 13, color: C.forest, lineHeight: 19 },

  preCheckBox: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    backgroundColor: C.mist, padding: 14, marginBottom: 12,
  },
  preCheckHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  preCheckTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  preCheckBtn: {
    backgroundColor: C.forest, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center',
  },
  preCheckBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  preCheckSub: { fontSize: 12, color: C.inkMid, marginBottom: 10, lineHeight: 17 },
  preCheckResult: { gap: 8 },
  preCheckScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  preCheckCircle: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  preCheckScore: { fontSize: 20, fontWeight: '900' },
  preCheckScoreDen: { fontSize: 9, color: C.inkSoft },
  preCheckCompliance: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  preCheckIssueSummary: { fontSize: 12, color: C.inkMid },
  preCheckIssue: {
    borderLeftWidth: 3, borderRadius: 8, backgroundColor: C.card,
    padding: 10, gap: 4,
  },
  preCheckIssueCode: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  preCheckIssueDesc: { fontSize: 12, color: C.ink, lineHeight: 17 },
  preCheckIssueRec: { fontSize: 12, color: C.forest, lineHeight: 17 },
});

export default SchemeOfWorkCheckTab;
