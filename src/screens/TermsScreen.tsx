import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import { supabase } from '../services/supabase';
import { TERMS_CONTENT, TERMS_VERSION } from '../constants/terms';

const C = {
  forest:  '#1A5C38',
  leaf:    '#3A8F5F',
  mist:    '#F2FAF5',
  border:  '#E0EDE6',
  card:    '#FFFFFF',
  ink:     '#1A1A1A',
  inkMid:  'rgba(26,26,26,0.65)',
  inkSoft: 'rgba(26,26,26,0.4)',
  green:   '#16A34A', greenBg: '#F0FDF4', greenBdr: '#BBF7D0',
};

interface Props {
  userId: string;
  onAccept: () => void;
}

const TermsScreen: React.FC<Props> = ({ userId, onAccept }) => {
  const [checked,  setChecked]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleAccept = async () => {
    if (!checked) return;
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({
          accepted_terms:    true,
          accepted_terms_at: new Date().toISOString(),
          terms_version:     TERMS_VERSION,
        })
        .eq('id', userId);
      if (err) throw err;
      onAccept();
    } catch (e: any) {
      setError(e.message ?? 'Could not save acceptance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Terms & Conditions</Text>
        <Text style={s.headerSub}>Please read and accept before continuing · {TERMS_VERSION}</Text>
      </View>

      {/* Terms text */}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <Text style={s.termsText}>{TERMS_CONTENT}</Text>
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* Checkbox */}
        <TouchableOpacity
          style={s.checkRow}
          onPress={() => setChecked(v => !v)}
          activeOpacity={0.7}
        >
          <View style={[s.checkbox, checked && s.checkboxChecked]}>
            {checked && <Text style={s.checkmark}>✓</Text>}
          </View>
          <Text style={s.checkLabel}>
            I have read and accept the Terms & Conditions.
          </Text>
        </TouchableOpacity>

        {/* Accept button */}
        <TouchableOpacity
          style={[s.acceptBtn, !checked && s.acceptBtnDisabled]}
          onPress={handleAccept}
          disabled={!checked || saving}
          activeOpacity={checked ? 0.8 : 1}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[s.acceptBtnText, !checked && s.acceptBtnTextDisabled]}>
              Accept & Continue
            </Text>
          )}
        </TouchableOpacity>

        <Text style={s.footerNote}>
          You must accept the Terms & Conditions to use High Five.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.mist },

  header: {
    backgroundColor: C.forest,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  scroll:        { flex: 1, backgroundColor: C.card },
  scrollContent: { padding: 20 },
  termsText:     { fontSize: 13, color: C.ink, lineHeight: 21, fontFamily: undefined },

  footer: {
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    padding: 20,
    gap: 12,
  },

  errorBox: {
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 10, padding: 12,
  },
  errorText: { fontSize: 13, color: '#DC2626', fontWeight: '500' },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    borderColor: C.border, backgroundColor: C.mist,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: C.forest, borderColor: C.forest },
  checkmark:  { fontSize: 14, color: '#fff', fontWeight: '800' },
  checkLabel: { flex: 1, fontSize: 14, color: C.ink, lineHeight: 20, fontWeight: '500' },

  acceptBtn: {
    backgroundColor: C.forest, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center',
  },
  acceptBtnDisabled: { backgroundColor: C.border },
  acceptBtnText:     { fontSize: 16, fontWeight: '700', color: '#fff' },
  acceptBtnTextDisabled: { color: C.inkSoft },

  footerNote: { fontSize: 11, color: C.inkSoft, textAlign: 'center' },
});

export default TermsScreen;
