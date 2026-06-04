import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput,
  TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Green, Ink, Tint } from '../theme';
import {
  ProfileInfoCategory, ProfileInfoRow, categoryLabel, addTitle,
} from '../utils/studentProfileInfo';

interface Props {
  visible:     boolean;
  onClose:     () => void;
  studentName: string;
  /** Category chosen when adding a new entry. */
  category:    ProfileInfoCategory | null;
  /** Existing entry when editing; null when adding. */
  entry:       ProfileInfoRow | null;
  saving:      boolean;
  error?:      string;
  /** content + (for custom) the category name typed by the user. */
  onSave:      (content: string, customName: string | null) => void;
}

const ProfileInfoEditModal: React.FC<Props> = ({
  visible, onClose, studentName, category, entry, saving, error, onSave,
}) => {
  const isEdit       = !!entry;
  const activeCat    = entry ? entry.category_type : category;
  const isCustom     = activeCat === 'custom';

  const [content,    setContent]    = useState('');
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (visible) {
      setContent(entry?.content ?? '');
      setCustomName(entry?.custom_category_name ?? '');
    }
  }, [visible, entry?.id, category]);

  const title = isEdit
    ? `Edit ${categoryLabel(entry!)}`
    : activeCat
      ? addTitle(activeCat)
      : 'Add Entry';

  const canSave =
    content.trim().length > 0 &&
    (!isCustom || customName.trim().length > 0);

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
          {/* Header */}
          <View style={d.header}>
            <View style={{ flex: 1 }}>
              <Text style={d.headerTitle}>{title}</Text>
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

          {/* Body */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={d.body}
            keyboardShouldPersistTaps="handled"
          >
            {isCustom && (
              <>
                <Text style={d.fieldLabel}>Category Name</Text>
                <TextInput
                  style={d.input}
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="e.g. Career Goal, Family Context…"
                  placeholderTextColor={Ink[4]}
                  autoCapitalize="words"
                  editable={!saving}
                />
                <View style={{ height: 16 }} />
              </>
            )}

            <Text style={d.fieldLabel}>Information</Text>
            <TextInput
              style={d.textArea}
              value={content}
              onChangeText={setContent}
              placeholder="Type the student information…"
              placeholderTextColor={Ink[4]}
              multiline
              textAlignVertical="top"
              autoCapitalize="sentences"
              autoCorrect
              editable={!saving}
            />
            <Text style={d.charCount}>
              {content.length} character{content.length !== 1 ? 's' : ''}
            </Text>

            {!!error && <Text style={d.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[d.saveBtn, (!canSave || saving) && { opacity: 0.5 }]}
              onPress={() => onSave(content.trim(), isCustom ? customName.trim() : null)}
              disabled={!canSave || saving}
              activeOpacity={0.75}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={d.saveBtnText}>{isEdit ? 'Save Changes' : 'Save'}</Text>}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

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

  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: Ink[3],
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Ink.line2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: Ink.base,
    backgroundColor: Ink.surface,
    fontWeight: '500',
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
    minHeight: 150,
    fontWeight: '400',
  },
  charCount: {
    fontSize: 11, color: Ink[4], textAlign: 'right',
    marginTop: 4, marginBottom: 18,
  },
  errorText: {
    fontSize: 12, color: Tint.rose.ink, lineHeight: 17, marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: Green[600],
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

export default ProfileInfoEditModal;
