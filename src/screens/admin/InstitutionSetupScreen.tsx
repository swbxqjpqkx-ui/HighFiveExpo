import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { saveInstitutionSettings } from '../../services/supabase';
import { AccreditationType, AcademicPeriod, ALL_PROGRAMS } from '../../types';
import { Colors, Spacing, Radius } from '../../theme';

interface Props {
  adminId: string;
  onComplete: () => void;
}

// ── Accreditation info ────────────────────────────────────────────────────────
const ACCREDITATIONS: { key: AccreditationType; label: string; desc: string }[] = [
  { key: 'AACSB', label: 'AACSB', desc: 'Association to Advance Collegiate Schools of Business — premier global standard for business education.' },
  { key: 'EQUIS', label: 'EQUIS', desc: 'European Quality Improvement System — EFMD\'s international quality label for business schools.' },
  { key: 'AMBA', label: 'AMBA', desc: 'Association of MBAs — world\'s impartial authority for postgraduate business education.' },
];

// ── Theme ─────────────────────────────────────────────────────────────────────
const C = {
  forest:  '#1A5C38',
  leaf:    '#3A8F5F',
  mist:    '#F2FAF5',
  border:  '#E0EDE6',
  ink:     '#1A1A1A',
  inkMid:  'rgba(26,26,26,0.7)',
  inkSoft: 'rgba(26,26,26,0.45)',
  red:     '#D9534F',
  redBg:   '#FDF1F1',
  redBdr:  '#F5C6C6',
  amber:   '#92600A',
  amberBg: '#FFFBEB',
  amberBdr:'#FDE68A',
  white:   '#FFFFFF',
  card:    '#FFFFFF',
  green50: '#F0F6EF',
};

// ── Helper: generate a simple unique id ──────────────────────────────────────
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ── Duration constraints ──────────────────────────────────────────────────────
const MIN_WEEKS   = 6;
const MAX_WEEKS   = 52;
const MIN_MONTHS  = 2;
const MAX_MONTHS  = 12;

function durationError(value: number, unit: 'weeks' | 'months'): string | null {
  if (isNaN(value) || value <= 0) return 'Enter a positive number.';
  if (unit === 'weeks'  && value < MIN_WEEKS)  return `Minimum is ${MIN_WEEKS} weeks.`;
  if (unit === 'weeks'  && value > MAX_WEEKS)  return `Maximum is ${MAX_WEEKS} weeks.`;
  if (unit === 'months' && value < MIN_MONTHS) return `Minimum is ${MIN_MONTHS} months.`;
  if (unit === 'months' && value > MAX_MONTHS) return `Maximum is ${MAX_MONTHS} months.`;
  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <View style={s.sectionHeader}>
    <Text style={s.sectionTitle}>{title}</Text>
    {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
  </View>
);

const Field: React.FC<{
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; multiline?: boolean;
}> = ({ label, value, onChangeText, placeholder, multiline }) => (
  <View style={{ marginBottom: Spacing.md }}>
    <Text style={s.fieldLabel}>{label}</Text>
    <TextInput
      style={[s.input, multiline && { height: 72, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.inkSoft}
      autoCapitalize="words"
      multiline={multiline}
    />
  </View>
);

// ── Period Row ────────────────────────────────────────────────────────────────
interface PeriodRowProps {
  period: AcademicPeriod & { _rawValue: string };
  onChange: (updated: AcademicPeriod & { _rawValue: string }) => void;
  onRemove: () => void;
}

const PeriodRow: React.FC<PeriodRowProps> = ({ period, onChange, onRemove }) => {
  const numVal = Number(period._rawValue);
  const err = period._rawValue !== '' ? durationError(numVal, period.duration_unit) : null;

  return (
    <View style={s.periodCard}>
      <View style={s.periodHeader}>
        <Text style={s.periodNum}>Period</Text>
        <TouchableOpacity onPress={onRemove} style={s.removePill}>
          <Text style={s.removePillText}>✕ Remove</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.fieldLabel}>Period Name</Text>
      <TextInput
        style={[s.input, { marginBottom: Spacing.sm }]}
        value={period.name}
        onChangeText={v => onChange({ ...period, name: v })}
        placeholder="e.g. Semester 1, MBA Intensive Period…"
        placeholderTextColor={C.inkSoft}
      />

      <Text style={s.fieldLabel}>Duration</Text>
      <View style={s.durationRow}>
        <TextInput
          style={[s.input, s.durationInput, err ? s.inputError : null]}
          value={period._rawValue}
          onChangeText={v => {
            const num = parseFloat(v);
            onChange({ ...period, _rawValue: v, duration_value: isNaN(num) ? 0 : num });
          }}
          placeholder="e.g. 16"
          placeholderTextColor={C.inkSoft}
          keyboardType="numeric"
        />
        <View style={s.unitRow}>
          {(['weeks', 'months'] as const).map(unit => (
            <TouchableOpacity
              key={unit}
              style={[s.unitBtn, period.duration_unit === unit && s.unitBtnActive]}
              onPress={() => onChange({ ...period, duration_unit: unit })}
            >
              <Text style={[s.unitBtnText, period.duration_unit === unit && s.unitBtnTextActive]}>
                {unit}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {err ? <Text style={s.fieldError}>{err}</Text> : null}
      <Text style={s.fieldHint}>Min 6 weeks · Max 12 months</Text>
    </View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
const InstitutionSetupScreen: React.FC<Props> = ({ adminId, onComplete }) => {
  const [accreditation, setAccreditation] = useState<AccreditationType | null>(null);
  const [name, setName]       = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity]       = useState('');
  const [address, setAddress] = useState('');
  const [programs, setPrograms] = useState<string[]>([]);
  const [periods, setPeriods] = useState<(AcademicPeriod & { _rawValue: string })[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const toggleProgram = (p: string) => {
    setPrograms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const addPeriod = () => {
    setPeriods(prev => [...prev, {
      id: uid(), name: '', duration_value: 0, duration_unit: 'weeks', _rawValue: '',
    }]);
  };

  const updatePeriod = (idx: number, updated: AcademicPeriod & { _rawValue: string }) => {
    setPeriods(prev => prev.map((p, i) => i === idx ? updated : p));
  };

  const removePeriod = (idx: number) => {
    setPeriods(prev => prev.filter((_, i) => i !== idx));
  };

  const periodsValid = periods.length > 0 && periods.every(p => {
    if (!p.name.trim()) return false;
    return durationError(p.duration_value, p.duration_unit) === null;
  });

  const formReady =
    !!accreditation &&
    name.trim() !== '' &&
    country.trim() !== '' &&
    city.trim() !== '' &&
    address.trim() !== '' &&
    programs.length > 0 &&
    periodsValid &&
    confirmed;

  const handleSave = async () => {
    if (!formReady || !accreditation) return;
    setError('');
    setSaving(true);
    try {
      await saveInstitutionSettings(
        {
          name: name.trim(),
          country: country.trim(),
          city: city.trim(),
          address: address.trim(),
          accreditation,
          programs,
          academic_periods: periods.map(({ _rawValue, ...rest }) => rest),
        },
        adminId,
      );
      onComplete();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* ── Page title ── */}
        <View style={s.pageHead}>
          <Text style={s.logoEmoji}>✋</Text>
          <Text style={s.pageTitle}>Institution Setup</Text>
          <Text style={s.pageSub}>
            Complete this one-time setup to activate the platform for your entire institution.
            Only one administrator needs to do this.
          </Text>
        </View>

        {/* ── 1. Accreditation ── */}
        <View style={s.card}>
          <SectionHeader
            title="1. Accreditation Type"
            subtitle="Select the accreditation framework your institution operates under. This choice is permanent."
          />
          {ACCREDITATIONS.map(a => (
            <TouchableOpacity
              key={a.key}
              style={[s.accredRow, accreditation === a.key && s.accredRowActive]}
              onPress={() => setAccreditation(a.key)}
              activeOpacity={0.7}
            >
              <View style={[s.radio, accreditation === a.key && s.radioActive]}>
                {accreditation === a.key && <View style={s.radioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.accredLabel, accreditation === a.key && s.accredLabelActive]}>
                  {a.label}
                </Text>
                <Text style={s.accredDesc}>{a.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 2. Institution info ── */}
        <View style={s.card}>
          <SectionHeader
            title="2. Institution Information"
            subtitle="This information will appear across all admin and professor views."
          />
          <Field label="University / School Name *" value={name} onChangeText={setName} placeholder="e.g. Geneva School of Business" />
          <Field label="Country *"  value={country}  onChangeText={setCountry}  placeholder="e.g. Switzerland" />
          <Field label="City *"     value={city}     onChangeText={setCity}     placeholder="e.g. Geneva" />
          <Field label="Address *"  value={address}  onChangeText={setAddress}  placeholder="e.g. Rue de Lausanne 15" multiline />
        </View>

        {/* ── 3. Programs ── */}
        <View style={s.card}>
          <SectionHeader
            title="3. Programs Offered"
            subtitle="Select all degree programs your institution offers. Multiple selections are allowed."
          />
          <View style={s.programGrid}>
            {(ALL_PROGRAMS as readonly string[]).map(p => {
              const selected = programs.includes(p);
              return (
                <TouchableOpacity
                  key={p}
                  style={[s.programChip, selected && s.programChipActive]}
                  onPress={() => toggleProgram(p)}
                  activeOpacity={0.7}
                >
                  {selected && <Text style={s.programCheck}>✓ </Text>}
                  <Text style={[s.programChipText, selected && s.programChipTextActive]}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {programs.length > 0 && (
            <Text style={s.selectedCount}>{programs.length} program{programs.length !== 1 ? 's' : ''} selected</Text>
          )}
        </View>

        {/* ── 4. Academic Periods ── */}
        <View style={s.card}>
          <SectionHeader
            title="4. Academic Periods"
            subtitle="Define the academic calendar periods for your institution (e.g. Semester 1, MBA Intensive Period)."
          />
          {periods.map((p, i) => (
            <PeriodRow
              key={p.id}
              period={p}
              onChange={updated => updatePeriod(i, updated)}
              onRemove={() => removePeriod(i)}
            />
          ))}
          <TouchableOpacity style={s.addPeriodBtn} onPress={addPeriod} activeOpacity={0.7}>
            <Text style={s.addPeriodText}>+ Add Academic Period</Text>
          </TouchableOpacity>
        </View>

        {/* ── Warning box ── */}
        <View style={s.warningBox}>
          <Text style={s.warningTitle}>⚠️  Important — Read Before Saving</Text>
          <Text style={s.warningText}>
            Once saved, all institution settings will be{' '}
            <Text style={{ fontWeight: '700' }}>permanently locked</Text>. The accreditation type,
            institution profile, programs, and academic periods cannot be changed through the app.
            Future changes require developer access via Supabase.
          </Text>
          <TouchableOpacity
            style={s.checkRow}
            onPress={() => setConfirmed(v => !v)}
            activeOpacity={0.7}
          >
            <View style={[s.checkbox, confirmed && s.checkboxChecked]}>
              {confirmed && <Text style={s.checkMark}>✓</Text>}
            </View>
            <Text style={s.checkLabel}>
              I understand that this setup will be locked after saving and cannot be undone.
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Error ── */}
        {error ? <Text style={s.errorText}>{error}</Text> : null}

        {/* ── Save button ── */}
        <TouchableOpacity
          style={[s.saveBtn, !formReady && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!formReady || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.saveBtnText}>Complete Institution Setup</Text>
          )}
        </TouchableOpacity>

        {!formReady && (
          <Text style={s.disabledHint}>
            Fill in all fields, select at least one program and one academic period, and check the confirmation box to enable saving.
          </Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.mist },
  content:   { padding: Spacing.md, paddingTop: Spacing.xl },

  pageHead:  { alignItems: 'center', marginBottom: Spacing.lg, paddingHorizontal: Spacing.md },
  logoEmoji: { fontSize: 44, marginBottom: Spacing.sm },
  pageTitle: { fontSize: 26, fontWeight: '700', color: C.forest, textAlign: 'center', marginBottom: 6 },
  pageSub:   { fontSize: 13, color: C.inkMid, textAlign: 'center', lineHeight: 19 },

  card: {
    backgroundColor: C.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  sectionHeader: { marginBottom: Spacing.md },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 4 },
  sectionSub:    { fontSize: 12, color: C.inkMid, lineHeight: 17 },

  fieldLabel: { fontSize: 11, fontWeight: '600', color: C.ink, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 11,
    fontSize: 14,
    color: C.ink,
    backgroundColor: '#FAFCFA',
  },
  inputError: { borderColor: C.red },
  fieldError: { fontSize: 11, color: C.red, marginTop: 4 },
  fieldHint:  { fontSize: 11, color: C.inkSoft, marginTop: 3 },

  // Accreditation
  accredRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    borderWidth: 1.5, borderColor: C.border, borderRadius: Radius.sm,
    padding: Spacing.sm, marginBottom: Spacing.sm, backgroundColor: '#FAFCFA',
  },
  accredRowActive: { borderColor: C.forest, backgroundColor: C.green50 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0,
  },
  radioActive: { borderColor: C.forest },
  radioDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: C.forest },
  accredLabel:     { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  accredLabelActive:{ color: C.forest },
  accredDesc:      { fontSize: 12, color: C.inkMid, lineHeight: 17 },

  // Programs
  programGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  programChip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FAFCFA',
  },
  programChipActive:    { borderColor: C.forest, backgroundColor: C.green50 },
  programCheck:         { fontSize: 12, color: C.forest, fontWeight: '700' },
  programChipText:      { fontSize: 13, color: C.inkMid },
  programChipTextActive:{ color: C.forest, fontWeight: '600' },
  selectedCount:        { fontSize: 12, color: C.leaf, fontWeight: '600', marginTop: 4 },

  // Periods
  periodCard: {
    borderWidth: 1, borderColor: C.border, borderRadius: Radius.sm,
    padding: Spacing.sm, marginBottom: Spacing.sm, backgroundColor: '#FAFCFA',
  },
  periodHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  periodNum:    { fontSize: 12, fontWeight: '700', color: C.forest },
  removePill: {
    borderWidth: 1, borderColor: '#F5C6C6', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.redBg,
  },
  removePillText: { fontSize: 11, color: C.red, fontWeight: '600' },
  durationRow:    { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  durationInput:  { flex: 1, marginBottom: 0 },
  unitRow:        { flexDirection: 'row', gap: 6 },
  unitBtn: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: Radius.sm,
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#FAFCFA',
  },
  unitBtnActive:    { borderColor: C.forest, backgroundColor: C.green50 },
  unitBtnText:      { fontSize: 13, color: C.inkMid, fontWeight: '500' },
  unitBtnTextActive:{ color: C.forest, fontWeight: '700' },
  addPeriodBtn: {
    borderWidth: 1.5, borderColor: C.forest, borderRadius: Radius.sm, borderStyle: 'dashed',
    paddingVertical: 13, alignItems: 'center', marginTop: 4,
  },
  addPeriodText: { fontSize: 14, color: C.forest, fontWeight: '600' },

  // Warning
  warningBox: {
    backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.amberBdr,
    borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.md,
  },
  warningTitle: { fontSize: 14, fontWeight: '700', color: C.amber, marginBottom: 6 },
  warningText:  { fontSize: 13, color: C.amber, lineHeight: 19, marginBottom: Spacing.md },
  checkRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: C.amber,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: C.forest, borderColor: C.forest },
  checkMark:       { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel:      { flex: 1, fontSize: 13, color: C.amber, lineHeight: 18, fontWeight: '600' },

  // Save
  saveBtn: {
    backgroundColor: C.forest, borderRadius: Radius.sm,
    paddingVertical: 16, alignItems: 'center', marginBottom: Spacing.sm,
  },
  saveBtnDisabled: { backgroundColor: '#A8C4B4', opacity: 0.7 },
  saveBtnText:     { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  errorText:       { fontSize: 13, color: C.red, marginBottom: Spacing.sm, textAlign: 'center' },
  disabledHint:    { fontSize: 12, color: C.inkSoft, textAlign: 'center', lineHeight: 17 },
});

export default InstitutionSetupScreen;
