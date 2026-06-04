import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { useInstitution } from '../context/InstitutionContext';
import { Colors, Spacing, Radius, Green, Ink, Tint } from '../theme';
import { supabase } from '../services/supabase';
import {
  RiskRule,
  getRiskRules,
  saveRiskRule,
  deleteRiskRule,
  recheckStudentsForProgramSemester,
} from '../services/studentRiskService';

// ── Theme ─────────────────────────────────────────────────────────────────────
const C = {
  forest:  Green[700],
  leaf:    Green[500],
  mist:    Green[50],
  border:  Ink.line,
  ink:     Ink.base,
  inkMid:  Ink[3],
  inkSoft: Ink[4],
  card:    Ink.surface,
  bg:      Ink.bg,
  green50: Green[50],
  amber:   Tint.sun.ink,    amberBg: Tint.sun.bg,     amberBdr: Tint.sun.line,
  blue:    Tint.sky.ink,    blueBg:  Tint.sky.bg,      blueBdr:  Tint.sky.line,
  purple:  Tint.violet.ink, purpleBg: Tint.violet.bg,  purpleBdr: Tint.violet.line,
  red:     Tint.rose.ink,   redBg:   Tint.rose.bg,     redBdr:   Tint.rose.line,
  green:   Tint.mint.ink,   greenBg: Tint.mint.bg,     greenBdr: Tint.mint.line,
};

// ── Shared sub-components ─────────────────────────────────────────────────────

const SectionTitle: React.FC<{ icon: string; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <View style={s.sectionTitleRow}>
    <Text style={s.sectionIcon}>{icon}</Text>
    <View style={{ flex: 1 }}>
      <Text style={s.sectionTitleText}>{title}</Text>
      {subtitle ? <Text style={s.sectionTitleSub}>{subtitle}</Text> : null}
    </View>
  </View>
);

const ReadOnlyField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={s.roField}>
    <Text style={s.roLabel}>{label}</Text>
    <Text style={s.roValue}>{value || '—'}</Text>
  </View>
);

const Divider: React.FC = () => <View style={s.divider} />;

// ── Settings Screen ───────────────────────────────────────────────────────────
const SettingsScreen: React.FC = () => {
  const { settings, loading } = useInstitution();

  // ── Risk standards (admin only) ──────────────────────────────
  const [isAdmin, setIsAdmin]           = useState(false);
  const [adminId, setAdminId]           = useState<string | null>(null);
  const [riskRules, setRiskRules]       = useState<RiskRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [coursePrograms, setCoursePrograms]   = useState<string[]>([]);
  const [courseSemesters, setCourseSemesters] = useState<string[]>([]);
  const [ruleForm, setRuleForm] = useState({
    program: '', semester: '', maxAbsences: '', borderlineGrade: '',
  });
  const [savingRule, setSavingRule]  = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ruleMsg, setRuleMsg]       = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase.from('profiles').select('id, role').eq('id', data.user.id).single()
        .then(({ data: p }) => {
          if (p?.role === 'administrator') {
            setIsAdmin(true);
            setAdminId(p.id);
            fetchRules();
            fetchCourseOptions();
          }
        });
    });
  }, []);

  const fetchRules = async () => {
    setRulesLoading(true);
    try {
      setRiskRules(await getRiskRules());
    } catch (e) {
      console.error('fetchRules:', e);
    } finally {
      setRulesLoading(false);
    }
  };

  const fetchCourseOptions = async () => {
    const { data } = await supabase
      .from('courses')
      .select('program, semester');
    if (!data) return;
    const progs = [...new Set(data.map((r: any) => r.program).filter(Boolean))].sort() as string[];
    const sems  = [...new Set(data.map((r: any) => r.semester).filter(Boolean))].sort() as string[];
    setCoursePrograms(progs);
    setCourseSemesters(sems);
  };

  const handleSaveRule = async () => {
    if (!adminId || !ruleForm.program || !ruleForm.semester ||
        !ruleForm.maxAbsences || !ruleForm.borderlineGrade) {
      setRuleMsg({ text: 'Please fill in all fields.', ok: false });
      return;
    }
    setSavingRule(true);
    setRuleMsg(null);
    try {
      const rule = await saveRiskRule({
        program: ruleForm.program,
        semester: ruleForm.semester,
        max_absences_allowed: parseInt(ruleForm.maxAbsences, 10),
        borderline_grade_percentage: parseInt(ruleForm.borderlineGrade, 10),
      }, adminId);
      await recheckStudentsForProgramSemester(ruleForm.program, ruleForm.semester, rule);
      setRuleMsg({ text: 'Rule saved and all students re-evaluated!', ok: true });
      setRuleForm({ program: '', semester: '', maxAbsences: '', borderlineGrade: '' });
      setRiskRules(await getRiskRules());
    } catch (e: any) {
      setRuleMsg({ text: e.message ?? 'Error saving rule.', ok: false });
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteRiskRule(id);
      setRiskRules(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error('deleteRiskRule:', e);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={Colors.leaf} />
      </View>
    );
  }

  const periods = settings?.academic_periods ?? [];
  const programs = settings?.programs ?? [];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Settings</Text>
      <Text style={s.pageSub}>Institution configuration and platform management</Text>

      {/* ── 1. Institution Profile ── */}
      <View style={s.card}>
        <SectionTitle
          icon="🏫"
          title="Institution Profile"
          subtitle="Read-only after institution setup is completed."
        />
        <Divider />
        <ReadOnlyField label="University / School Name" value={settings?.name ?? ''} />
        <ReadOnlyField label="Country"                  value={settings?.country ?? ''} />
        <ReadOnlyField label="City"                     value={settings?.city ?? ''} />
        <ReadOnlyField label="Address"                  value={settings?.address ?? ''} />
        {settings?.setup_completed_at && (
          <ReadOnlyField
            label="Setup Completed"
            value={new Date(settings.setup_completed_at).toLocaleDateString(undefined, {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          />
        )}
      </View>

      {/* ── 2. Accreditation Settings ── */}
      <View style={s.card}>
        <SectionTitle
          icon="🎓"
          title="Accreditation Settings"
          subtitle="Locked after setup. This value drives AI features and reporting."
        />
        <Divider />
        {settings?.accreditation ? (
          <View style={s.accredBadgeRow}>
            <View style={s.accredBadge}>
              <Text style={s.accredBadgeText}>{settings.accreditation}</Text>
            </View>
            <Text style={s.accredDesc}>
              {settings.accreditation === 'AACSB' && 'Association to Advance Collegiate Schools of Business'}
              {settings.accreditation === 'EQUIS' && 'European Quality Improvement System (EFMD)'}
              {settings.accreditation === 'AMBA'  && 'Association of MBAs'}
            </Text>
          </View>
        ) : (
          <Text style={s.roValue}>Not configured</Text>
        )}

        <View style={s.infoBox}>
          <Text style={s.infoBoxText}>
            ℹ️  Accreditation-based AI tools are being prepared. Guidelines will be connected
            through Supabase and will automatically adapt to your selected framework.
          </Text>
        </View>
      </View>

      {/* ── 3. Academic Structure ── */}
      <View style={s.card}>
        <SectionTitle
          icon="📅"
          title="Academic Structure"
          subtitle="Academic periods configured during institution setup."
        />
        <Divider />
        {periods.length === 0 ? (
          <Text style={s.emptyText}>No academic periods defined.</Text>
        ) : (
          periods.map((p, i) => (
            <View key={p.id} style={[s.periodRow, i < periods.length - 1 && s.periodRowBorder]}>
              <View style={s.periodDot} />
              <View style={{ flex: 1 }}>
                <Text style={s.periodName}>{p.name}</Text>
                <Text style={s.periodDuration}>{p.duration_value} {p.duration_unit}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* ── 4. Programs Offered ── */}
      <View style={s.card}>
        <SectionTitle
          icon="📚"
          title="Programs Offered"
          subtitle="Degree programs selected during institution setup."
        />
        <Divider />
        {programs.length === 0 ? (
          <Text style={s.emptyText}>No programs configured.</Text>
        ) : (
          <View style={s.chipWrap}>
            {programs.map(p => (
              <View key={p} style={s.chip}>
                <Text style={s.chipText}>{p}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── 5. Student Risk Standards (admin only) ── */}
      {isAdmin && (
        <View style={s.card}>
          <SectionTitle
            icon="⚠️"
            title="Student Risk Standards"
            subtitle="Set thresholds that trigger automatic at-risk warnings per program and semester."
          />
          <Divider />

          {/* Existing rules */}
          {rulesLoading ? (
            <ActivityIndicator color={C.forest} style={{ marginVertical: 8 }} />
          ) : riskRules.length === 0 ? (
            <Text style={s.emptyText}>No risk rules defined yet.</Text>
          ) : (
            riskRules.map(rule => (
              <View key={rule.id} style={rs.ruleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={rs.ruleProgram}>{rule.program}</Text>
                  <Text style={rs.ruleMeta}>
                    {rule.semester} · Max absences: {rule.max_absences_allowed} · Min grade: {rule.borderline_grade_percentage}%
                  </Text>
                </View>
                <TouchableOpacity
                  style={[rs.deleteBtn, deletingId === rule.id && { opacity: 0.5 }]}
                  onPress={() => handleDeleteRule(rule.id)}
                  disabled={deletingId === rule.id}
                >
                  <Text style={rs.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          <Divider />
          <Text style={rs.formTitle}>Add / Update Rule</Text>

          {/* Program selector — from actual courses table */}
          <Text style={rs.fieldLabel}>Program</Text>
          {coursePrograms.length === 0 ? (
            <ActivityIndicator color={C.forest} style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {coursePrograms.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[rs.progChip, ruleForm.program === p && rs.progChipActive]}
                  onPress={() => setRuleForm(f => ({ ...f, program: p }))}
                >
                  <Text style={[rs.progChipText, ruleForm.program === p && rs.progChipTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Semester — chips from actual courses table */}
          <Text style={rs.fieldLabel}>Semester</Text>
          {courseSemesters.length === 0 ? (
            <ActivityIndicator color={C.forest} style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {courseSemesters.map(sem => (
                <TouchableOpacity
                  key={sem}
                  style={[rs.progChip, ruleForm.semester === sem && rs.progChipActive]}
                  onPress={() => setRuleForm(f => ({ ...f, semester: sem }))}
                >
                  <Text style={[rs.progChipText, ruleForm.semester === sem && rs.progChipTextActive]}>
                    {sem}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Thresholds */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={rs.fieldLabel}>Max Absences Allowed</Text>
              <TextInput
                style={rs.input}
                placeholder="e.g. 5"
                placeholderTextColor={C.inkSoft}
                keyboardType="number-pad"
                value={ruleForm.maxAbsences}
                onChangeText={v => setRuleForm(f => ({ ...f, maxAbsences: v }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={rs.fieldLabel}>Borderline Grade (%)</Text>
              <TextInput
                style={rs.input}
                placeholder="e.g. 60"
                placeholderTextColor={C.inkSoft}
                keyboardType="number-pad"
                value={ruleForm.borderlineGrade}
                onChangeText={v => setRuleForm(f => ({ ...f, borderlineGrade: v }))}
              />
            </View>
          </View>

          {ruleMsg && (
            <View style={[rs.msg, {
              borderColor: ruleMsg.ok ? C.greenBdr : C.redBdr,
              backgroundColor: ruleMsg.ok ? C.greenBg : C.redBg,
            }]}>
              <Text style={[rs.msgText, { color: ruleMsg.ok ? C.green : C.red }]}>
                {ruleMsg.text}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[rs.saveBtn, savingRule && { opacity: 0.6 }]}
            onPress={handleSaveRule}
            disabled={savingRule}
          >
            <Text style={rs.saveBtnText}>{savingRule ? 'Saving…' : 'Save Rule'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content:   { padding: Spacing.md, paddingBottom: 40 },
  loader:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  pageTitle: { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 4 },
  pageSub:   { fontSize: 13, color: C.inkMid, marginBottom: 20 },

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

  sectionTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  sectionIcon:     { fontSize: 20, marginTop: 1 },
  sectionTitleText:{ fontSize: 15, fontWeight: '700', color: C.ink, flex: 1 },
  sectionTitleSub: { fontSize: 12, color: C.inkMid, marginTop: 2, lineHeight: 17 },

  divider: { height: 1, backgroundColor: C.border, marginVertical: Spacing.sm },

  roField: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  roLabel: { fontSize: 11, fontWeight: '600', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 3 },
  roValue: { fontSize: 14, color: C.ink, fontWeight: '500' },

  accredBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.sm },
  accredBadge: {
    backgroundColor: C.green50, borderRadius: 8, borderWidth: 1.5,
    borderColor: Colors.forest, paddingHorizontal: 14, paddingVertical: 6,
  },
  accredBadgeText: { fontSize: 16, fontWeight: '800', color: C.forest },
  accredDesc:      { flex: 1, fontSize: 13, color: C.inkMid, lineHeight: 18 },

  periodRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  periodRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  periodDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.leaf, flexShrink: 0 },
  periodName:  { fontSize: 13, fontWeight: '600', color: C.ink },
  periodDuration: { fontSize: 12, color: C.inkMid, marginTop: 2 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: C.green50, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  chipText: { fontSize: 13, color: C.forest, fontWeight: '500' },

  infoBox: {
    backgroundColor: C.green50, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.sm, padding: Spacing.sm, marginTop: Spacing.sm,
  },
  infoBoxText: { fontSize: 12, color: C.inkMid, lineHeight: 18 },

  emptyText: { fontSize: 13, color: C.inkSoft, paddingVertical: 8 },
});

// ── Risk standards sub-styles ─────────────────────────────────────────────────
const rs = StyleSheet.create({
  ruleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8,
  },
  ruleProgram: { fontSize: 13, fontWeight: '700', color: C.ink },
  ruleMeta:    { fontSize: 12, color: C.inkMid, marginTop: 2 },
  deleteBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: C.amberBdr, backgroundColor: C.amberBg,
  },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: C.amber },

  formTitle: { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 10 },
  fieldLabel: {
    fontSize: 11, fontWeight: '600', color: C.inkSoft,
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6,
  },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 10,
    fontSize: 13, color: C.ink, marginBottom: 12,
  },
  progChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, marginRight: 8,
  },
  progChipActive:     { backgroundColor: C.forest, borderColor: C.forest },
  progChipText:       { fontSize: 12, fontWeight: '600', color: C.inkMid },
  progChipTextActive: { color: '#FFFFFF' },
  msg: {
    borderWidth: 1, borderRadius: Radius.sm, padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  msgText: { fontSize: 12, fontWeight: '600' },
  saveBtn: {
    backgroundColor: C.forest, borderRadius: Radius.sm,
    paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});

export default SettingsScreen;
