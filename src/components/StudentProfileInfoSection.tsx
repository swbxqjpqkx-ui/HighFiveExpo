import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { Green, Ink } from '../theme';
import { getCurrentProfile } from '../services/supabase';
import {
  getStudentProfileInfo, addStudentProfileInfo,
  updateStudentProfileInfo, deleteStudentProfileInfo,
} from '../services/studentProfileInfoService';
import {
  ProfileInfoCategory, ProfileInfoRow, DEFAULT_CATEGORIES,
  categoryLabel, formatEntryDate,
} from '../utils/studentProfileInfo';
import ProfileInfoEditModal from './ProfileInfoEditModal';

interface Props {
  studentId:   string;
  studentName: string;
}

const StudentProfileInfoSection: React.FC<Props> = ({ studentId, studentName }) => {
  const [rows,     setRows]     = useState<ProfileInfoRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [profId,   setProfId]   = useState<string | null>(null);
  const [profName, setProfName] = useState<string | null>(null);

  // Editor modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [addCat,    setAddCat]    = useState<ProfileInfoCategory | null>(null);
  const [editRow,   setEditRow]   = useState<ProfileInfoRow | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  // Load entries for this student (by global student_id).
  useEffect(() => {
    let active = true;
    setLoading(true);
    getStudentProfileInfo(studentId)
      .then(r => { if (active) setRows(r); })
      .catch(() => { if (active) setRows([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [studentId]);

  // Current user → "Added by" attribution.
  useEffect(() => {
    let active = true;
    getCurrentProfile()
      .then(p => { if (active && p) { setProfId(p.id); setProfName(p.full_name); } })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const openAdd = (cat: ProfileInfoCategory) => {
    setEditRow(null); setAddCat(cat); setError(''); setModalOpen(true);
  };
  const openEdit = (row: ProfileInfoRow) => {
    setAddCat(null); setEditRow(row); setError(''); setModalOpen(true);
  };

  const handleSave = async (content: string, customName: string | null) => {
    setSaving(true); setError('');
    try {
      if (editRow) {
        await updateStudentProfileInfo(editRow.id, {
          content,
          customName: editRow.category_type === 'custom' ? customName : undefined,
        });
      } else {
        await addStudentProfileInfo({
          studentId,
          category:      addCat!,
          customName,
          content,
          professorId:   profId,
          professorName: profName,
        });
      }
      setRows(await getStudentProfileInfo(studentId));
      setModalOpen(false);
    } catch (e: any) {
      setError(
        e?.code === '42501'
          ? 'Permission denied. You cannot edit this student record.'
          : 'Failed to save. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (row: ProfileInfoRow) => {
    Alert.alert(
      'Delete entry',
      `Delete this "${categoryLabel(row)}" entry? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteStudentProfileInfo(row.id);
              setRows(prev => prev.filter(r => r.id !== row.id));
            } catch {
              Alert.alert('Error', 'Failed to delete. Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Student Profile Information</Text>
      <Text style={s.desc}>
        Add student-specific context that can support teaching, coordination, and AI
        recommendations across courses.
      </Text>

      {/* Category buttons */}
      <View style={s.btnRow}>
        {DEFAULT_CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.key}
            style={s.catBtn}
            onPress={() => openAdd(c.key)}
            activeOpacity={0.75}
          >
            <Text style={s.catBtnText}>{c.addLabel}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Green[500]} style={{ marginTop: 14 }} />
      ) : (
        /* Saved entries (empty categories simply don't render) */
        rows.map(row => {
          const dateStr = formatEntryDate(row.updated_at || row.created_at);
          return (
            <View key={row.id} style={s.card}>
              <View style={s.cardTopRow}>
                <View style={s.catBadge}>
                  <Text style={s.catBadgeText}>{categoryLabel(row)}</Text>
                </View>
                <View style={s.iconGroup}>
                  <TouchableOpacity
                    onPress={() => openEdit(row)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.6}
                  >
                    <Text style={s.iconBtn}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(row)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.6}
                  >
                    <Text style={s.iconBtn}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={s.cardContent}>{row.content}</Text>

              <View style={s.metaWrap}>
                {!!row.added_by_professor_name && (
                  <Text style={s.metaText}>Added by: {row.added_by_professor_name}</Text>
                )}
                {!!dateStr && <Text style={s.metaText}>Date: {dateStr}</Text>}
              </View>
            </View>
          );
        })
      )}

      <ProfileInfoEditModal
        visible={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        studentName={studentName}
        category={addCat}
        entry={editRow}
        saving={saving}
        error={error}
        onSave={handleSave}
      />
    </View>
  );
};

const s = StyleSheet.create({
  section: {
    backgroundColor: Ink.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Ink.line, padding: 14,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: Green[700],
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6,
  },
  desc: { fontSize: 12, color: Ink[3], lineHeight: 17, marginBottom: 12 },

  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: {
    backgroundColor: Green[50], borderRadius: 8,
    borderWidth: 1, borderColor: Green[300],
    paddingHorizontal: 12, paddingVertical: 8,
  },
  catBtnText: { fontSize: 12, fontWeight: '700', color: Green[700] },

  card: {
    backgroundColor: Green[50], borderRadius: 10,
    borderWidth: 1, borderColor: Ink.line,
    padding: 12, marginTop: 12,
  },
  cardTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  catBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Green[700] + '18',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  catBadgeText: {
    fontSize: 10, fontWeight: '800', color: Green[700],
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  iconGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn:   { fontSize: 13, opacity: 0.4 },

  cardContent: { fontSize: 14, color: Ink.base, lineHeight: 20, marginBottom: 10 },

  metaWrap: { gap: 2 },
  metaText: { fontSize: 11, color: Ink[3], fontWeight: '500' },
});

export default StudentProfileInfoSection;
