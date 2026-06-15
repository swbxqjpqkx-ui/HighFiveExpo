import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Course, Profile } from '../../../types';
import { CourseSyllabus, CourseMaterial, MaterialFileType, MaterialCheckResult } from '../../../types/courseManagement';
import {
  getCourseMaterials, addCourseMaterial, deleteCourseMaterial, uploadCourseFile,
  getAccreditationStandards, getCourseSchemeOfWork,
  getMaterialCheckResult, saveMaterialCheckResult,
} from '../../../services/courseManagement';
import { analyseMaterialAlignment } from '../../../services/aiAnalysis';
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

const FILE_TYPE_ICONS: Record<MaterialFileType | string, string> = {
  pdf: '📄', word: '📝', ppt: '📊', excel: '📈', image: '🖼️', link: '🔗', other: '📎',
};

const FILE_TYPES: { key: MaterialFileType; label: string }[] = [
  { key: 'pdf', label: 'PDF' }, { key: 'word', label: 'Word' }, { key: 'ppt', label: 'PowerPoint' },
  { key: 'excel', label: 'Excel' }, { key: 'image', label: 'Image' }, { key: 'link', label: 'Link' }, { key: 'other', label: 'Other' },
];

// Status badge styling per alignment outcome.
const STATUS_STYLE: Record<MaterialCheckResult['overallStatus'], { color: string; bg: string; bdr: string }> = {
  'Aligned':           { color: C.forest, bg: C.green50, bdr: C.border },
  'Partially Aligned': { color: C.amber,  bg: C.amberBg, bdr: C.amberBdr },
  'Not Aligned':       { color: C.red,    bg: C.redBg,   bdr: C.redBdr },
};

interface Props {
  course: Course;
  profile: Profile;
  syllabus: CourseSyllabus | null;
}

interface MaterialWithCheck {
  material: CourseMaterial;
  check: MaterialCheckResult | null;
  checking: boolean;
  notes: string[];
  // User-friendly error shown inline on the card (Alert is invisible on web).
  error: string | null;
}

const MaterialsCheckTab: React.FC<Props> = ({ course, profile, syllabus }) => {
  const { settings } = useInstitution();
  const syllabusLocked = syllabus?.status === 'locked';

  const [items, setItems]       = useState<MaterialWithCheck[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [week, setWeek]           = useState('');
  const [fileType, setFileType]   = useState<MaterialFileType>('pdf');
  const [linkUrl, setLinkUrl]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [uploading, setUploading]   = useState(false);

  const load = useCallback(async (): Promise<MaterialWithCheck[]> => {
    setLoading(true);
    try {
      const materials = await getCourseMaterials(course.id);
      const withCheck: MaterialWithCheck[] = await Promise.all(
        materials.map(async m => {
          const c = await getMaterialCheckResult(course.id, m.id).catch(() => null);
          return { material: m, check: c, checking: false, notes: [], error: null };
        }),
      );
      setItems(withCheck);
      return withCheck;
    } catch {
      setItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [course.id]);

  useEffect(() => { load(); }, [load]);

  // ── AI material check (accreditation + Scheme of Work + syllabus + objectives) ──
  const runMaterialCheck = useCallback(async (material: CourseMaterial) => {
    // 1. A readable material file must be attached (links are not analysable).
    if (!material.file_url || material.file_type === 'link') {
      setItems(prev => prev.map(it => it.material.id === material.id
        ? { ...it, error: 'Please upload a material file before running AI analysis.', checking: false } : it));
      return;
    }
    // Start: show the loading state and clear any previous error/notes.
    setItems(prev => prev.map(it => it.material.id === material.id
      ? { ...it, checking: true, error: null, notes: [] } : it));
    try {
      // Gather the selected course's saved context from Supabase.
      const [stds, sow] = await Promise.all([
        getAccreditationStandards(settings?.accreditation ?? 'AACSB').catch(() => []),
        getCourseSchemeOfWork(course.id).catch(() => null),
      ]);

      const accreditationStandards = stds.length
        ? stds.map(st => `${st.standard_code} — ${st.title}: ${st.description}`).join('\n')
        : '';

      const sowTopics = (sow?.topics && sow.topics.length)
        ? sow.topics.map(t => `- ${t.topic}${t.week != null ? ` (Week ${t.week})` : ''}`).join('\n')
        : '';

      const notes: string[] = [];
      if (!accreditationStandards || !sowTopics) {
        notes.push('Some course data is missing, so AI analyzed the material using the available information.');
      }

      const syllabusText = (syllabus && syllabus.status === 'locked')
        ? `An approved and locked syllabus is on file (${syllabus.file_name || 'syllabus document'}).`
        : 'No locked syllabus is available for this course.';

      const learningObjectives = sowTopics
        ? `No separate learning-objectives document is stored. Use the Scheme of Work weekly topics as the planned learning objectives:\n${sowTopics}`
        : 'No separate learning objectives are available for this course.';

      const result = await analyseMaterialAlignment({
        fileUrl: material.file_url,
        courseName: course.name,
        accreditationStandards: accreditationStandards || 'Not provided.',
        courseSyllabus: syllabusText,
        schemeOfWork: sowTopics || 'Not provided.',
        learningObjectives,
      });

      const withMeta: MaterialCheckResult = {
        ...result,
        file_name: material.file_name,
        file_type: material.file_type,
        created_at: new Date().toISOString(),
      };

      // Save to professor-private history (reuses ai_analysis_results).
      await saveMaterialCheckResult(course.id, material.id, withMeta).catch(() => {});

      setItems(prev => prev.map(it => it.material.id === material.id
        ? { ...it, check: withMeta, checking: false, notes, error: null } : it));
    } catch (e: any) {
      // Log the real technical error for debugging; show a clean message on screen.
      console.error('[MaterialCheck] AI analysis failed:', e);
      const raw = String(e?.message ?? '');
      const msg = raw === 'FILE_READ_FAILED'
        ? 'This file could not be read for AI analysis. Please upload a readable PDF, Word, PowerPoint, or text-based file.'
        : raw.includes('web preview')
        ? raw
        : 'AI material analysis could not be completed. Please try again.';
      setItems(prev => prev.map(it => it.material.id === material.id
        ? { ...it, checking: false, error: msg } : it));
    }
  }, [course.id, course.name, settings, syllabus]);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setPickedFile({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType ?? 'application/octet-stream',
          file: (asset as any).file ?? undefined,
        });
        // Auto-detect file type from extension
        const ext = asset.name.split('.').pop()?.toLowerCase() ?? '';
        const extMap: Record<string, MaterialFileType> = {
          pdf: 'pdf', doc: 'word', docx: 'word',
          ppt: 'ppt', pptx: 'ppt', xls: 'excel', xlsx: 'excel',
          png: 'image', jpg: 'image', jpeg: 'image',
        };
        if (extMap[ext]) setFileType(extMap[ext]);
        if (!title.trim()) setTitle(asset.name.replace(/\.[^.]+$/, ''));
      }
    } catch {
      Alert.alert('Error', 'Could not open file picker.');
    }
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    if (fileType !== 'link' && !pickedFile) {
      Alert.alert('No file selected', 'Please attach a file before saving.');
      return;
    }
    setSubmitting(true);
    let fileUrl = '';
    let fileName = fileType === 'link' ? linkUrl.trim() : '';
    try {
      if (fileType !== 'link' && pickedFile) {
        setUploading(true);
        try {
          const remotePath = `${course.id}/${Date.now()}_${pickedFile.name}`;
          fileUrl = await uploadCourseFile(pickedFile.uri, remotePath, pickedFile.mimeType, pickedFile.file);
          fileName = pickedFile.name;
        } catch (uploadErr: any) {
          setUploading(false);
          setSubmitting(false);
          Alert.alert(
            'Upload Failed',
            uploadErr?.message ?? 'Could not upload file.\n\nMake sure the "course-files" bucket exists in Supabase Dashboard → Storage.',
          );
          return;
        }
        setUploading(false);
      } else if (fileType === 'link') {
        fileUrl = linkUrl.trim();
        fileName = linkUrl.trim();
      }
      await addCourseMaterial(course.id, profile.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        week: week ? parseInt(week, 10) : undefined,
      });
      setTitle(''); setDesc(''); setWeek(''); setLinkUrl(''); setFileType('pdf'); setPickedFile(null);
      setShowForm(false);
      // Reload the list. AI analysis is NOT started automatically — the professor
      // runs it manually with the "Run AI Analysis" button on the material card.
      await load();
    } catch (e: any) {
      setUploading(false);
      Alert.alert('Error', e?.message ?? 'Failed to add material.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteCourseMaterial(id).catch(() => {});
    await load();
  };

  if (!syllabusLocked) {
    return (
      <View style={s.centre}>
        <Text style={s.lockIcon}>🔒</Text>
        <Text style={s.lockTitle}>Materials Check Locked</Text>
        <Text style={s.lockBody}>
          The Materials Check tab is disabled until the syllabus is approved and locked by an
          administrator. This ensures all materials are evaluated against the official, fixed
          course syllabus.
        </Text>
      </View>
    );
  }

  if (loading) {
    return <View style={s.centre}><ActivityIndicator color={C.leaf} size="large" /></View>;
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      {/* Actions */}
      <View style={s.topRow}>
        <Text style={s.pageInfo}>{items.length} material{items.length !== 1 ? 's' : ''} uploaded</Text>
        <TouchableOpacity style={s.btnPrimary} onPress={() => setShowForm(v => !v)}>
          <Text style={s.btnPrimaryText}>{showForm ? '✕ Cancel' : '+ Add Material'}</Text>
        </TouchableOpacity>
      </View>

      {/* Add form */}
      {showForm && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Add Course Material</Text>

          <Text style={s.fieldLabel}>Title *</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="e.g. Week 3 – Strategy slides" placeholderTextColor={C.inkSoft} />

          <Text style={s.fieldLabel}>File Type</Text>
          <View style={s.chipRow}>
            {FILE_TYPES.map(ft => (
              <TouchableOpacity
                key={ft.key}
                style={[s.typeChip, fileType === ft.key && s.typeChipActive]}
                onPress={() => setFileType(ft.key)}
              >
                <Text style={[s.typeChipText, fileType === ft.key && s.typeChipTextActive]}>
                  {FILE_TYPE_ICONS[ft.key]} {ft.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {fileType === 'link' ? (
            <>
              <Text style={s.fieldLabel}>URL *</Text>
              <TextInput style={s.input} value={linkUrl} onChangeText={setLinkUrl} placeholder="https://…" placeholderTextColor={C.inkSoft} autoCapitalize="none" keyboardType="url" />
            </>
          ) : (
            <TouchableOpacity style={[s.uploadZone, pickedFile && s.uploadZonePicked]} onPress={handlePickFile}>
              <Text style={s.uploadZoneIcon}>{pickedFile ? '✅' : FILE_TYPE_ICONS[fileType]}</Text>
              <Text style={s.uploadZoneText}>{pickedFile ? pickedFile.name : 'Tap to attach file'}</Text>
              {pickedFile
                ? <Text style={s.uploadZoneSub}>Tap to change</Text>
                : <Text style={s.uploadZoneSub}>PDF, Word, PowerPoint, Excel, Image…</Text>
              }
            </TouchableOpacity>
          )}

          <View style={s.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Week</Text>
              <TextInput style={s.input} value={week} onChangeText={setWeek} placeholder="e.g. 3" placeholderTextColor={C.inkSoft} keyboardType="numeric" />
            </View>
            <View style={{ flex: 2, marginLeft: 8 }}>
              <Text style={s.fieldLabel}>Description</Text>
              <TextInput style={s.input} value={description} onChangeText={setDesc} placeholder="Optional notes…" placeholderTextColor={C.inkSoft} />
            </View>
          </View>

          <TouchableOpacity
            style={[s.btnPrimary, !title.trim() && { opacity: 0.5 }]}
            onPress={handleAdd}
            disabled={!title.trim() || submitting || uploading}
          >
            {uploading
              ? <><ActivityIndicator color="#fff" size="small" /><Text style={[s.btnPrimaryText, { marginLeft: 6 }]}>Uploading…</Text></>
              : submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnPrimaryText}>Save Material</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Material list */}
      {items.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📂</Text>
          <Text style={s.emptyTitle}>No materials yet</Text>
          <Text style={s.emptyText}>Upload PDFs, slides, readings, links, and other course files. Each is automatically analysed against the locked syllabus, Scheme of Work and {settings?.accreditation ?? 'accreditation'} standards.</Text>
        </View>
      )}

      {items.map(item => (
        <MaterialCard
          key={item.material.id}
          item={item}
          onDelete={() => handleDelete(item.material.id)}
          onRunCheck={() => runMaterialCheck(item.material)}
        />
      ))}
    </ScrollView>
  );
};

// ── Single material row + its AI material-check result ──────────────────────────
const MaterialCard: React.FC<{
  item: MaterialWithCheck;
  onDelete: () => void;
  onRunCheck: () => void;
}> = ({ item, onDelete, onRunCheck }) => {
  const { material, check, checking, notes, error } = item;

  return (
    <View style={s.materialCard}>
      <View style={s.materialHeader}>
        <Text style={s.materialIcon}>{FILE_TYPE_ICONS[material.file_type]}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.materialTitle}>{material.title}</Text>
          <Text style={s.materialMeta}>
            {material.week ? `Week ${material.week} · ` : ''}{material.file_type.toUpperCase()}
            {material.description ? ` · ${material.description}` : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={onDelete} style={s.deleteBtn}>
          <Text style={s.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Loading message */}
      {checking && (
        <View style={s.loadingBox}>
          <ActivityIndicator size="small" color={C.forest} />
          <Text style={s.loadingText}>AI is analyzing your material against accreditation standards and course requirements...</Text>
        </View>
      )}

      {/* Error message (shown on the page — Alert is invisible on web) */}
      {!checking && error && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>⚠️  {error}</Text>
        </View>
      )}

      {/* Context notes (missing SoW / accreditation) */}
      {!checking && notes.map((n, i) => (
        <View key={i} style={s.noteBox}>
          <Text style={s.noteText}>ℹ️  {n}</Text>
        </View>
      ))}

      {/* Result */}
      {!checking && check && <CheckResultCard check={check} onRerun={onRunCheck} />}

      {/* Not yet analysed */}
      {!checking && !check && (
        <View style={s.aiRow}>
          <View style={[s.aiPill, { backgroundColor: '#F3F4F6' }]}>
            <Text style={[s.aiPillText, { color: C.inkSoft }]}>⏳ Not analysed yet</Text>
          </View>
          {material.file_type !== 'link' && (
            <TouchableOpacity onPress={onRunCheck} style={s.analysisBtn}>
              <Text style={s.analysisBtnText}>🤖 Run AI Analysis</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

// ── Rich material-check result (badge + score + summary + accordions) ───────────
const CheckResultCard: React.FC<{ check: MaterialCheckResult; onRerun: () => void }> = ({ check, onRerun }) => {
  const badge = STATUS_STYLE[check.overallStatus];

  return (
    <View style={s.resultCard}>
      {/* Top summary */}
      <View style={s.resultTop}>
        <View style={[s.statusBadge, { backgroundColor: badge.bg, borderColor: badge.bdr }]}>
          <Text style={[s.statusBadgeText, { color: badge.color }]}>{check.overallStatus}</Text>
        </View>
        <Text style={[s.scoreText, { color: badge.color }]}>{check.alignmentScore}% aligned</Text>
      </View>
      {!!check.overallSummary && <Text style={s.summaryText}>{check.overallSummary}</Text>}

      {/* Expandable sections */}
      <Section title="Accreditation Standards Check">
        <Bullets label="Covered standards" items={check.accreditationCheck.coveredStandards} tone="good" />
        <Bullets label="Missing or weak standards" items={check.accreditationCheck.missingOrWeakStandards} tone="bad" />
        <Explanation text={check.accreditationCheck.explanation} />
      </Section>

      <Section title="Scheme of Work Check">
        <Bullets label="Matched weeks / topics" items={check.schemeOfWorkCheck.matchedWeeksOrTopics} tone="good" />
        <Bullets label="Missing topics" items={check.schemeOfWorkCheck.missingTopics} tone="bad" />
        <Bullets label="Extra / unplanned topics" items={check.schemeOfWorkCheck.extraOrUnplannedTopics} tone="warn" />
        <Bullets label="Sequencing issues" items={check.schemeOfWorkCheck.sequencingIssues} tone="warn" />
        <Explanation text={check.schemeOfWorkCheck.explanation} />
      </Section>

      <Section title="Learning Objectives Check">
        <Bullets label="Supported objectives" items={check.learningObjectivesCheck.supportedObjectives} tone="good" />
        <Bullets label="Unsupported objectives" items={check.learningObjectivesCheck.unsupportedObjectives} tone="bad" />
        <Explanation text={check.learningObjectivesCheck.explanation} />
      </Section>

      <Section title="Gaps / Problems Found">
        <Bullets items={check.gapsAndProblems} tone="bad" />
      </Section>

      <Section title="Recommendations">
        <Bullets items={check.recommendations} tone="info" />
      </Section>

      <TouchableOpacity onPress={onRerun} style={s.rerunBtn}>
        <Text style={s.rerunBtnText}>↻ Re-run AI Analysis</Text>
      </TouchableOpacity>
    </View>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.section}>
      <TouchableOpacity style={s.sectionHeader} onPress={() => setOpen(o => !o)}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.sectionChevron}>{open ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {open && <View style={s.sectionBody}>{children}</View>}
    </View>
  );
};

const TONE: Record<string, string> = { good: C.forest, bad: C.red, warn: C.amber, info: C.blue };

const Bullets: React.FC<{ label?: string; items: string[]; tone: 'good' | 'bad' | 'warn' | 'info' }> = ({ label, items, tone }) => {
  if (!items || items.length === 0) {
    return label ? <Text style={s.bulletEmpty}>{label}: none</Text> : null;
  }
  return (
    <View style={s.bulletGroup}>
      {label && <Text style={s.bulletLabel}>{label}</Text>}
      {items.map((it, i) => (
        <View key={i} style={s.bulletRow}>
          <View style={[s.bulletDot, { backgroundColor: TONE[tone] }]} />
          <Text style={s.bulletText}>{it}</Text>
        </View>
      ))}
    </View>
  );
};

const Explanation: React.FC<{ text?: string }> = ({ text }) =>
  text ? <Text style={s.explanationText}>{text}</Text> : null;

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  centre:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  lockIcon:  { fontSize: 48, marginBottom: 12 },
  lockTitle: { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 8, textAlign: 'center' },
  lockBody:  { fontSize: 13, color: C.inkMid, textAlign: 'center', lineHeight: 19 },

  topRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pageInfo:   { fontSize: 12, color: C.inkMid },
  btnPrimary: { backgroundColor: C.forest, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardTitle:  { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: C.ink, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 5 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10,
    fontSize: 13, color: C.ink, backgroundColor: '#FAFCFA', marginBottom: 12,
  },
  chipRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  typeChip:      { borderWidth: 1.5, borderColor: C.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  typeChipActive:{ borderColor: C.forest, backgroundColor: C.green50 },
  typeChipText:  { fontSize: 12, color: C.inkMid },
  typeChipTextActive: { color: C.forest, fontWeight: '600' },
  uploadZone: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: C.border,
    borderRadius: 8, padding: 20, alignItems: 'center', marginBottom: 12,
  },
  uploadZonePicked: { borderColor: C.forest, backgroundColor: C.green50 },
  uploadZoneIcon: { fontSize: 32, marginBottom: 6 },
  uploadZoneText: { fontSize: 13, fontWeight: '600', color: C.ink },
  uploadZoneSub:  { fontSize: 11, color: C.inkSoft, marginTop: 2 },
  twoCol: { flexDirection: 'row', marginBottom: 12 },

  empty:      { alignItems: 'center', padding: 32 },
  emptyIcon:  { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 6 },
  emptyText:  { fontSize: 13, color: C.inkMid, textAlign: 'center', lineHeight: 19 },

  materialCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  materialHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  materialIcon:   { fontSize: 24, marginTop: 2 },
  materialTitle:  { fontSize: 13, fontWeight: '700', color: C.ink, flex: 1 },
  materialMeta:   { fontSize: 11, color: C.inkMid, marginTop: 2 },
  deleteBtn:      { padding: 4 },
  deleteBtnText:  { fontSize: 14, color: C.inkSoft },

  loadingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.green50, borderRadius: 8, padding: 10, marginTop: 4,
  },
  loadingText: { flex: 1, fontSize: 12, color: C.forest, fontWeight: '600', lineHeight: 17 },

  noteBox: { backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.amberBdr, borderRadius: 8, padding: 9, marginTop: 6 },
  noteText: { fontSize: 11, color: C.amber, lineHeight: 16 },

  errorBox: { backgroundColor: C.redBg, borderWidth: 1, borderColor: C.redBdr, borderRadius: 8, padding: 10, marginTop: 6 },
  errorText: { fontSize: 12, color: C.red, lineHeight: 17, fontWeight: '600' },

  aiRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  aiPill:      { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, flex: 1 },
  aiPillText:  { fontSize: 11, fontWeight: '600' },
  analysisBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  analysisBtnText: { fontSize: 11, color: C.forest, fontWeight: '600' },

  // Result card
  resultCard: {
    backgroundColor: C.mist, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, padding: 12, marginTop: 8,
  },
  resultTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  statusBadge: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  scoreText: { fontSize: 14, fontWeight: '800' },
  summaryText: { fontSize: 12, color: C.inkMid, lineHeight: 18, marginBottom: 8 },

  section: { borderTopWidth: 1, borderTopColor: C.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.ink, flex: 1 },
  sectionChevron: { fontSize: 12, color: C.inkMid, marginLeft: 8 },
  sectionBody: { paddingBottom: 10 },

  bulletGroup: { marginBottom: 8 },
  bulletLabel: { fontSize: 11, fontWeight: '700', color: C.inkMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginBottom: 3 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  bulletText: { flex: 1, fontSize: 12, color: C.ink, lineHeight: 17 },
  bulletEmpty: { fontSize: 11, color: C.inkSoft, fontStyle: 'italic', marginBottom: 6 },
  explanationText: { fontSize: 12, color: C.inkMid, lineHeight: 17, marginTop: 2 },

  rerunBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: C.forest, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  rerunBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

export default MaterialsCheckTab;
