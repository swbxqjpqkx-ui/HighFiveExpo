import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput,
  TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { updateStudentDescription } from '../services/supabase';
import { Green, Ink, Tint } from '../theme';

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  visible:             boolean;
  onClose:             () => void;
  studentId:           string;
  studentName:         string;
  initialDescription?: string | null;
  onSaved:             (description: string | null) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
const DescriptionEditModal: React.FC<Props> = ({
  visible, onClose, studentId, studentName, initialDescription, onSaved,
}) => {
  const [text,   setText]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    if (visible) {
      setText(initialDescription ?? '');
      setError('');
      setSaving(false);
    }
  }, [visible, studentId]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const newDesc = text.trim() || null;
      await updateStudentDescription(studentId, newDesc);
      onSaved(newDesc);
    } catch (e: any) {
      setError(
        e?.code === '42501'
          ? 'Permission denied. You cannot edit this student record.'
          : 'Failed to save. Please try again.',
      );
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={d.root}>

          {/* ── Header ── */}
          <View style={d.header}>
            <View style={{ flex: 1 }}>
              <Text style={d.headerTitle}>Student Note</Text>
              <Text style={d.headerSub} numberOfLines={1}>{studentName}</Text>
            </View>
            <TouchableOpacity
              style={d.closeBtn}
              onPress={onClose}
              disabled={saving}
              activeOpacity={0.75}
            >
              <Text style={d.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* ── Body ── */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={d.body}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={d.hint}>
              Add notes or observations about this student. Leave blank to clear the note.
            </Text>

            <Text style={d.fieldLabel}>Note / Description</Text>
            <TextInput
              style={d.textArea}
              value={text}
              onChangeText={setText}
              placeholder="Write a note or observation…"
              placeholderTextColor={Ink[4]}
              multiline
              textAlignVertical="top"
              autoCapitalize="sentences"
              autoCorrect
              editable={!saving}
            />
            <Text style={d.charCount}>{text.length} character{text.length !== 1 ? 's' : ''}</Text>

            {!!error && <Text style={d.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[d.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.75}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={d.saveBtnText}>Save Note</Text>}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const d = StyleSheet.create({
  root: { flex: 1, backgroundColor: Green[50] },

  header: {
    backgroundColor: Green[700],
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 3 },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.72)' },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  body: { padding: 20 },

  hint: {
    fontSize: 13,
    color: Ink[3],
    lineHeight: 19,
    marginBottom: 20,
    backgroundColor: Ink.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Ink.line,
    padding: 12,
  },

  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: Ink[3],
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6,
  },

  textArea: {
    borderWidth: 1,
    borderColor: Ink.line2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Ink.base,
    backgroundColor: Ink.surface,
    minHeight: 160,
    fontWeight: '400',
  },

  charCount: {
    fontSize: 11,
    color: Ink[4],
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 18,
  },

  errorText: {
    fontSize: 12,
    color: Tint.rose.ink,
    lineHeight: 17,
    marginBottom: 12,
  },

  saveBtn: {
    backgroundColor: Green[600],
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

export default DescriptionEditModal;
