import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Course, Profile } from '../../../types';
import { CourseSyllabus, CourseMaterial, AIAnalysisResult, MaterialFileType } from '../../../types/courseManagement';
import { getCourseMaterials, addCourseMaterial, deleteCourseMaterial, getAIAnalysis, uploadCourseFile } from '../../../services/courseManagement';
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

const FILE_TYPE_ICONS: Record<MaterialFileType | string, string> = {
  pdf: '📄', word: '📝', ppt: '📊', excel: '📈', image: '🖼️', link: '🔗', other: '📎',
};

const FILE_TYPES: { key: MaterialFileType; label: string }[] = [
  { key: 'pdf', label: 'PDF' }, { key: 'word', label: 'Word' }, { key: 'ppt', label: 'PowerPoint' },
  { key: 'excel', label: 'Excel' }, { key: 'image', label: 'Image' }, { key: 'link', label: 'Link' }, { key: 'other', label: 'Other' },
];

interface Props {
  course: Course;
  profile: Profile;
  syllabus: CourseSyllabus | null;
}

interface MaterialWithAnalysis {
  material: CourseMaterial;
  analysis: AIAnalysisResult | null;
  analysing: boolean;
}

const MaterialsCheckTab: React.FC<Props> = ({ course, profile, syllabus }) => {
  const { settings } = useInstitution();
  const syllabusLocked = syllabus?.status === 'locked';

  const [items, setItems]       = useState<MaterialWithAnalysis[]>([]);
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const materials = await getCourseMaterials(course.id);
      const withAnalysis: MaterialWithAnalysis[] = await Promise.all(
        materials.map(async m => {
          const a = await getAIAnalysis(course.id, m.id).catch(() => null);
          return { material: m, analysis: a, analysing: false };
        }),
      );
      setItems(withAnalysis);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [course.id]);

  useEffect(() => { load(); }, [load]);

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

  const runAnalysis = async (idx: number) => {
    const item = items[idx];
    if (!item.material.file_url) {
      Alert.alert('No file', 'No document was uploaded for this material.');
      return;
    }
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, analysing: true } : it));
    try {
      const result = await analyseDocumentWithAI(
        item.material.file_url,
        course.id,
        item.material.id,
        'material',
        settings?.accreditation ?? 'AACSB',
        course.program,
      );
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, analysis: result, analysing: false } : it));
    } catch (e: any) {
      Alert.alert('Analysis Failed', e?.message ?? 'Could not analyse document.');
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, analysing: false } : it));
    }
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
          <Text style={s.emptyText}>Upload PDFs, slides, readings, links, and other course files. Each will be analysed against the locked syllabus and {settings?.accreditation ?? 'accreditation'} standards.</Text>
        </View>
      )}

      {items.map(({ material, analysis, analysing }, idx) => (
        <View key={material.id} style={s.materialCard}>
          <View style={s.materialHeader}>
            <Text style={s.materialIcon}>{FILE_TYPE_ICONS[material.file_type]}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.materialTitle}>{material.title}</Text>
              <Text style={s.materialMeta}>
                {material.week ? `Week ${material.week} · ` : ''}{material.file_type.toUpperCase()}
                {material.description ? ` · ${material.description}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(material.id)} style={s.deleteBtn}>
              <Text style={s.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* AI status */}
          <View style={s.aiRow}>
            {analysing ? (
              <View style={s.aiPill}><ActivityIndicator size="small" color={C.forest} /><Text style={s.aiPillText}> Analysing…</Text></View>
            ) : analysis ? (
              <View style={[s.aiPill, { backgroundColor: analysis.overall_score >= 80 ? C.green50 : C.amberBg }]}>
                <Text style={[s.aiPillText, { color: analysis.overall_score >= 80 ? C.forest : C.amber }]}>
                  🤖 Score: {analysis.overall_score}/100 · {analysis.issues.length} issue{analysis.issues.length !== 1 ? 's' : ''}
                </Text>
              </View>
            ) : (
              <View style={[s.aiPill, { backgroundColor: '#F3F4F6' }]}>
                <Text style={[s.aiPillText, { color: C.inkSoft }]}>⏳ Not analysed</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => runAnalysis(idx)} style={s.analysisBtn} disabled={analysing}>
              <Text style={s.analysisBtnText}>{analysis ? '↻ Re-run' : '🤖 Analyse'}</Text>
            </TouchableOpacity>
          </View>

          {/* Issues inline */}
          {analysis && analysis.issues.length > 0 && (
            <View style={s.issuesList}>
              {analysis.issues.map(issue => (
                <View key={issue.id} style={[s.inlineIssue, {
                  backgroundColor: issue.severity === 'critical' ? C.redBg : issue.severity === 'warning' ? C.amberBg : C.blueBg,
                }]}>
                  <Text style={s.inlineIssueSeverity}>
                    {issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : 'ℹ️'}
                    {' '}{issue.requirement_code}
                  </Text>
                  <Text style={s.inlineIssueText}>{issue.description}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  centre:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  lockIcon:  { fontSize: 48, marginBottom: 12 },
  lockTitle: { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 8, textAlign: 'center' },
  lockBody:  { fontSize: 13, color: C.inkMid, textAlign: 'center', lineHeight: 19 },

  topRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pageInfo:   { fontSize: 12, color: C.inkMid },
  btnPrimary: { backgroundColor: C.forest, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
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

  aiRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  aiPill:      { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, flex: 1 },
  aiPillText:  { fontSize: 11, fontWeight: '600' },
  analysisBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  analysisBtnText: { fontSize: 11, color: C.forest, fontWeight: '600' },

  issuesList:      { gap: 4, marginTop: 4 },
  inlineIssue:     { borderRadius: 6, padding: 8 },
  inlineIssueSeverity: { fontSize: 11, fontWeight: '700', color: C.ink, marginBottom: 2 },
  inlineIssueText: { fontSize: 11, color: C.inkMid, lineHeight: 16 },
});

export default MaterialsCheckTab;
