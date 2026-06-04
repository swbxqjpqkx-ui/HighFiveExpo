import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Alert,
  Modal, Switch, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { Profile, Course } from '../types';
import { supabase } from '../services/supabase';
import { getAdminStats } from '../services/supabase';
import { useInstitution } from '../context/InstitutionContext';
import { TERMS_CONTENT, TERMS_VERSION } from '../constants/terms';
import { Green, Ink, Tint } from '../theme';

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  forest:  Green[700],
  leaf:    Green[500],
  mist:    Green[50],
  border:  Ink.line,
  card:    Ink.surface,
  ink:     Ink.base,
  inkMid:  Ink[3],
  inkSoft: Ink[4],
  green50: Green[50],
  red:     Tint.rose.ink, redBg:    Tint.rose.bg,    redBdr:    Tint.rose.line,
  amber:   Tint.sun.ink,  amberBg:  Tint.sun.bg,     amberBdr:  Tint.sun.line,
  blue:    Tint.sky.ink,  blueBg:   Tint.sky.bg,     blueBdr:   Tint.sky.line,
  purple:  Tint.violet.ink, purpleBg: Tint.violet.bg, purpleBdr: Tint.violet.line,
  green:   Tint.mint.ink, greenBg:  Tint.mint.bg,    greenBdr:  Tint.mint.line,
};

const LANGUAGES = ['English', 'French', 'Arabic', 'German', 'Spanish'];

// ── Shared sub-components ─────────────────────────────────────────────────────

const SectionCard: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => (
  <View style={[sc.card, style]}>{children}</View>
);

const SectionTitle: React.FC<{ icon: string; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <View style={sc.titleRow}>
    <Text style={sc.titleIcon}>{icon}</Text>
    <View style={{ flex: 1 }}>
      <Text style={sc.titleText}>{title}</Text>
      {subtitle ? <Text style={sc.titleSub}>{subtitle}</Text> : null}
    </View>
  </View>
);

const Divider: React.FC = () => <View style={sc.divider} />;

const InfoRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <View style={sc.infoRow}>
    <Text style={sc.infoLabel}>{label}</Text>
    <Text style={sc.infoValue}>{value || '—'}</Text>
  </View>
);

const StatCard: React.FC<{ value: string | number; label: string; color?: string }> = ({ value, label, color = C.forest }) => (
  <View style={sc.statCard}>
    <Text style={[sc.statVal, { color }]}>{value}</Text>
    <Text style={sc.statLabel}>{label}</Text>
  </View>
);


const sc = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1,
    borderColor: C.border, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  titleRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  titleIcon:    { fontSize: 20, marginTop: 1 },
  titleText:    { fontSize: 15, fontWeight: '700', color: C.ink },
  titleSub:     { fontSize: 12, color: C.inkMid, marginTop: 2 },
  divider:      { height: 1, backgroundColor: C.border, marginVertical: 12 },
  infoRow:      { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  infoLabel:    { width: 140, fontSize: 11, fontWeight: '600', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 },
  infoValue:    { flex: 1, fontSize: 13, color: C.ink, fontWeight: '500' },
  statCard:     { flex: 1, alignItems: 'center', backgroundColor: C.mist, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingVertical: 12 },
  statVal:      { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  statLabel:    { fontSize: 10, color: C.inkMid, textAlign: 'center', fontWeight: '600', lineHeight: 13 },
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface ExtendedProfile {
  phone?:          string | null;
  bio?:            string | null;
  office_location?:string | null;
  department?:     string | null;
  academic_title?: string | null;
  city?:           string | null;
  country?:        string | null;
  specialization?: string | null;
  status?:         string | null;
  updated_at?:     string | null;
  last_login_at?:  string | null;
}

interface Props {
  profile: Profile;
  courses: Course[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const initials = (name: string) =>
  name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

// ── Main component ────────────────────────────────────────────────────────────
const ProfileScreen: React.FC<Props> = ({ profile, courses }) => {
  const { settings } = useInstitution();
  const isAdmin = profile.role === 'administrator';

  // ── Data state ────────────────────────────────────────────────────
  const [ext, setExt]               = useState<ExtendedProfile>({});
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Admin stats
  const [adminStats, setAdminStats] = useState<{
    totalCourses: number; totalTeachers: number; totalStudents: number;
  } | null>(null);

  // Professor stats
  const [totalStudents, setTotalStudents] = useState(0);

  // ── Edit form fields ──────────────────────────────────────────────
  const [editFirstName,      setEditFirstName]      = useState('');
  const [editLastName,       setEditLastName]        = useState('');
  const [editPhone,          setEditPhone]           = useState('');
  const [editCity,           setEditCity]            = useState('');
  const [editCountry,        setEditCountry]         = useState('');
  const [editBio,            setEditBio]             = useState('');
  const [editTitle,          setEditTitle]           = useState('');
  const [editDept,           setEditDept]            = useState('');
  const [editSpecialization, setEditSpecialization]  = useState('');
  const [editOffice,         setEditOffice]          = useState('');

  // ── Modal visibility ──────────────────────────────────────────────
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNotifModal,    setShowNotifModal]    = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTermsModal,    setShowTermsModal]    = useState(false);

  // Change password state
  const [newPassword,      setNewPassword]      = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Notification preferences state
  const [notifWarnings,    setNotifWarnings]    = useState(true);
  const [notifSyllabus,    setNotifSyllabus]    = useState(true);
  const [notifSystem,      setNotifSystem]      = useState(true);
  const [notifAssignment,  setNotifAssignment]  = useState(false);
  const [savingNotifs,     setSavingNotifs]     = useState(false);

  // Account settings state
  const [language,         setLanguage]         = useState('English');
  const [savingSettings,   setSavingSettings]   = useState(false);

  // ── Load ──────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data: extData } = await supabase
        .from('profiles')
        .select('phone, bio, office_location, department, academic_title, city, country, specialization, status, updated_at, last_login_at')
        .eq('id', profile.id)
        .single();

      const e: ExtendedProfile = extData ?? {};
      setExt(e);

      const parts = profile.full_name.trim().split(/\s+/);
      setEditFirstName(parts[0] ?? '');
      setEditLastName(parts.slice(1).join(' '));
      setEditPhone(e.phone ?? '');
      setEditCity(e.city ?? '');
      setEditCountry(e.country ?? '');
      setEditBio(e.bio ?? '');
      setEditTitle(e.academic_title ?? '');
      setEditDept(e.department ?? '');
      setEditSpecialization(e.specialization ?? '');
      setEditOffice(e.office_location ?? '');

      if (isAdmin) {
        const stats = await getAdminStats();
        setAdminStats(stats);
      } else {
        const { data: enrolData } = await supabase
          .from('course_enrollments')
          .select('id')
          .in('course_id', courses.map(c => c.id));
        setTotalStudents((enrolData ?? []).length);
      }

      // Notification preferences (graceful — table may not exist yet)
      const { data: notifData } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (notifData) {
        setNotifWarnings(notifData.warning_notifications  ?? true);
        setNotifSyllabus(notifData.syllabus_notifications ?? true);
        setNotifSystem(  notifData.system_notifications   ?? true);
        setNotifAssignment(notifData.homework_notifications ?? false);
      }

      // User settings (graceful)
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('language')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (settingsData?.language) setLanguage(settingsData.language);

    } catch (err) {
      console.error('ProfileScreen load:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile.id, profile.full_name, isAdmin, courses]);

  useEffect(() => { load(); }, [load]);

  // ── Save profile edits ────────────────────────────────────────────
  const handleSave = async () => {
    if (!editFirstName.trim()) {
      Alert.alert('Validation', 'First name is required.'); return;
    }
    if (!editLastName.trim()) {
      Alert.alert('Validation', 'Last name is required.'); return;
    }
    if (editBio.length > 500) {
      Alert.alert('Validation', 'Bio must be 500 characters or less.'); return;
    }
    setSaving(true);
    try {
      const fullName = `${editFirstName.trim()} ${editLastName.trim()}`;
      const patch: Record<string, any> = {
        full_name: fullName,
        phone:     editPhone   || null,
        city:      editCity    || null,
        country:   editCountry || null,
        bio:       editBio     || null,
      };
      if (!isAdmin) {
        patch.academic_title  = editTitle          || null;
        patch.department      = editDept           || null;
        patch.specialization  = editSpecialization || null;
        patch.office_location = editOffice         || null;
      }
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', profile.id)
        .select();
      console.log('[ProfileSave] data:', JSON.stringify(data), 'error:', JSON.stringify(error));
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Update was blocked (RLS policy). No rows updated.');
      }

      setExt(prev => ({ ...prev, ...patch }));
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      Alert.alert('Save Error', err.message ?? 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  // ── Change password ───────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Validation', 'Password must be at least 6 characters.'); return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation', 'Passwords do not match.'); return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert('Success', 'Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not update password.');
    } finally {
      setChangingPassword(false);
    }
  };

  // ── Save notification preferences ─────────────────────────────────
  const handleSaveNotifs = async () => {
    setSavingNotifs(true);
    try {
      const { error } = await supabase.from('notification_preferences').upsert({
        user_id:                profile.id,
        warning_notifications:  notifWarnings,
        syllabus_notifications: notifSyllabus,
        system_notifications:   notifSystem,
        homework_notifications: notifAssignment,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      setShowNotifModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save preferences.');
    } finally {
      setSavingNotifs(false);
    }
  };

  // ── Save account settings ─────────────────────────────────────────
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase.from('user_settings').upsert({
        user_id: profile.id,
        language,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      setShowSettingsModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.centre}>
        <ActivityIndicator size="large" color={C.leaf} />
      </View>
    );
  }

  const programs    = [...new Set(courses.map(c => c.program).filter(Boolean)  as string[])];
  const semesters   = [...new Set(courses.map(c => c.semester).filter(Boolean) as string[])];
  const statusLabel = ext.status ?? 'active';
  const firstName   = profile.full_name.split(' ')[0];

  // ── Render ────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.mist }}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {/* Save success banner */}
        {saveSuccess && (
          <View style={s.successBanner}>
            <Text style={s.successText}>✓  Profile saved successfully</Text>
          </View>
        )}

        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={[s.avatar, { backgroundColor: isAdmin ? '#0D3D25' : C.leaf }]}>
            <Text style={s.avatarText}>{initials(profile.full_name)}</Text>
          </View>
          <Text style={s.greeting}>{greeting()}, {firstName}</Text>
          <Text style={s.fullName}>{profile.full_name}</Text>
          <View style={[s.roleBadge, { backgroundColor: isAdmin ? '#0D3D25' : C.leaf }]}>
            <Text style={s.roleBadgeText}>{isAdmin ? '🛡️ Administrator' : '👩‍🏫 Professor'}</Text>
          </View>
          {settings?.name && <Text style={s.institution}>{settings.name}</Text>}
          <Text style={s.email}>{profile.email ?? '—'}</Text>
          <View style={[s.statusBadge, {
            backgroundColor: statusLabel === 'active' ? C.greenBg : C.amberBg,
            borderColor:     statusLabel === 'active' ? C.greenBdr : C.amberBdr,
          }]}>
            <View style={[s.statusDot, { backgroundColor: statusLabel === 'active' ? C.green : C.amber }]} />
            <Text style={[s.statusText, { color: statusLabel === 'active' ? C.green : C.amber }]}>
              {statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}
            </Text>
          </View>
        </View>

        {/* ── PERSONAL INFORMATION ── */}
        <SectionCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flex: 1 }}><SectionTitle icon="👤" title="Personal Information" /></View>
            {!editing ? (
              <TouchableOpacity style={s.editBtn} onPress={() => setEditing(true)}>
                <Text style={s.editBtnText}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={[s.editBtn, { backgroundColor: C.mist }]} onPress={() => setEditing(false)}>
                  <Text style={[s.editBtnText, { color: C.inkMid }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.editBtn, { backgroundColor: C.forest }]} onPress={handleSave} disabled={saving}>
                  <Text style={[s.editBtnText, { color: '#fff' }]}>{saving ? '…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <Divider />

          {!editing ? (
            <>
              <InfoRow label="Full Name" value={profile.full_name} />
              <InfoRow label="Email"     value={profile.email} />
              <InfoRow label="Phone"     value={ext.phone} />
              <InfoRow label="City"      value={ext.city} />
              <InfoRow label="Country"   value={ext.country} />
              {ext.bio && (
                <View style={{ paddingTop: 10 }}>
                  <Text style={sc.infoLabel}>BIO</Text>
                  <Text style={[sc.infoValue, { marginTop: 4, lineHeight: 18 }]}>{ext.bio}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={s.editForm}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={[s.editField, { flex: 1 }]}>
                  <Text style={s.editLabel}>FIRST NAME *</Text>
                  <TextInput
                    style={s.editInput}
                    value={editFirstName}
                    onChangeText={setEditFirstName}
                    placeholder="First name"
                    placeholderTextColor={C.inkSoft}
                  />
                </View>
                <View style={[s.editField, { flex: 1 }]}>
                  <Text style={s.editLabel}>LAST NAME *</Text>
                  <TextInput
                    style={s.editInput}
                    value={editLastName}
                    onChangeText={setEditLastName}
                    placeholder="Last name"
                    placeholderTextColor={C.inkSoft}
                  />
                </View>
              </View>
              <View style={s.editField}>
                <Text style={s.editLabel}>PHONE</Text>
                <TextInput
                  style={s.editInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  keyboardType="phone-pad"
                  placeholder="+41 79 000 00 00"
                  placeholderTextColor={C.inkSoft}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={[s.editField, { flex: 1 }]}>
                  <Text style={s.editLabel}>CITY</Text>
                  <TextInput
                    style={s.editInput}
                    value={editCity}
                    onChangeText={setEditCity}
                    placeholder="e.g. Geneva"
                    placeholderTextColor={C.inkSoft}
                  />
                </View>
                <View style={[s.editField, { flex: 1 }]}>
                  <Text style={s.editLabel}>COUNTRY</Text>
                  <TextInput
                    style={s.editInput}
                    value={editCountry}
                    onChangeText={setEditCountry}
                    placeholder="e.g. Switzerland"
                    placeholderTextColor={C.inkSoft}
                  />
                </View>
              </View>
              <View style={s.editField}>
                <Text style={s.editLabel}>
                  BIO{'  '}<Text style={{ color: C.inkSoft, textTransform: 'none' }}>({editBio.length}/500)</Text>
                </Text>
                <TextInput
                  style={[s.editInput, { height: 80, textAlignVertical: 'top' }]}
                  value={editBio}
                  onChangeText={t => setEditBio(t.slice(0, 500))}
                  multiline
                  placeholder="A short professional bio…"
                  placeholderTextColor={C.inkSoft}
                />
              </View>
              <View style={[s.readonlyNote]}>
                <Text style={[s.editLabel, { color: C.amber }]}>🔒  READ-ONLY</Text>
                <Text style={s.readonlyText}>Email, role, and institution cannot be changed here.</Text>
              </View>
            </View>
          )}
        </SectionCard>

        {/* ── ACCOUNT INFORMATION ── */}
        <SectionCard>
          <SectionTitle icon="🔐" title="Account Information" />
          <Divider />
          <InfoRow label="Account Type" value={isAdmin ? 'Administrator' : 'Professor'} />
          <InfoRow label="Profile ID"   value={profile.id.slice(0, 8) + '…'} />
          <InfoRow label="Member Since" value={
            profile.created_at
              ? new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
              : undefined
          } />
          <InfoRow label="Last Updated" value={
            ext.updated_at
              ? new Date(ext.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
              : undefined
          } />
          <InfoRow label="Status" value={statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)} />
        </SectionCard>

        {/* ══════════ ADMIN-SPECIFIC ══════════ */}
        {isAdmin && (
          <SectionCard>
            <SectionTitle icon="🏫" title="Institution Overview" subtitle={settings?.name ?? 'Your institution'} />
            <Divider />
            <View style={s.statsRow}>
              <StatCard value={adminStats?.totalTeachers ?? 0} label={'Active\nProfessors'} color={C.leaf} />
              <StatCard value={adminStats?.totalStudents ?? 0} label={'Total\nStudents'}    color={C.blue} />
              <StatCard value={adminStats?.totalCourses  ?? 0} label={'Active\nCourses'}    color={C.purple} />
              <StatCard value={settings?.programs?.length ?? 0} label={'Programs\nOffered'} color={C.amber} />
            </View>
            {settings?.accreditation && (
              <View style={[s.infoBox, { marginTop: 12 }]}>
                <Text style={s.infoBoxText}>
                  🎓 Accreditation: <Text style={{ fontWeight: '700' }}>{settings.accreditation}</Text>
                </Text>
              </View>
            )}
          </SectionCard>
        )}

        {/* ══════════ PROFESSOR-SPECIFIC ══════════ */}
        {!isAdmin && (
          <>
            {/* Professional Information */}
            <SectionCard>
              <SectionTitle
                icon="🎓"
                title="Professional Information"
                subtitle={editing ? 'Editing — scroll up to save or cancel' : undefined}
              />
              <Divider />

              {!editing ? (
                <>
                  <InfoRow label="Position / Title"  value={ext.academic_title} />
                  <InfoRow label="Department"        value={ext.department} />
                  <InfoRow label="Specialization"    value={ext.specialization} />
                  <InfoRow label="Office Location"   value={ext.office_location} />
                  <InfoRow label="Programs"          value={programs.join(', ') || '—'} />
                  <InfoRow label="Semesters"         value={semesters.join(', ') || '—'} />
                  <InfoRow label="Courses Assigned"  value={String(courses.length)} />
                  <InfoRow label="Students Taught"   value={String(totalStudents)} />
                </>
              ) : (
                <View style={s.editForm}>
                  <View style={s.editField}>
                    <Text style={s.editLabel}>POSITION / JOB TITLE</Text>
                    <TextInput
                      style={s.editInput}
                      value={editTitle}
                      onChangeText={setEditTitle}
                      placeholder="e.g. Associate Professor, Lecturer"
                      placeholderTextColor={C.inkSoft}
                    />
                  </View>
                  <View style={s.editField}>
                    <Text style={s.editLabel}>DEPARTMENT</Text>
                    <TextInput
                      style={s.editInput}
                      value={editDept}
                      onChangeText={setEditDept}
                      placeholder="e.g. Finance & Accounting"
                      placeholderTextColor={C.inkSoft}
                    />
                  </View>
                  <View style={s.editField}>
                    <Text style={s.editLabel}>SPECIALIZATION</Text>
                    <TextInput
                      style={s.editInput}
                      value={editSpecialization}
                      onChangeText={setEditSpecialization}
                      placeholder="e.g. Behavioral Finance"
                      placeholderTextColor={C.inkSoft}
                    />
                  </View>
                  <View style={s.editField}>
                    <Text style={s.editLabel}>OFFICE LOCATION</Text>
                    <TextInput
                      style={s.editInput}
                      value={editOffice}
                      onChangeText={setEditOffice}
                      placeholder="e.g. Room 204, Building A"
                      placeholderTextColor={C.inkSoft}
                    />
                  </View>
                </View>
              )}
            </SectionCard>

            {/* My Courses */}
            {courses.length > 0 && (
              <SectionCard>
                <SectionTitle
                  icon="📚"
                  title="My Courses"
                  subtitle={`${courses.length} assigned course${courses.length !== 1 ? 's' : ''}`}
                />
                <Divider />
                {courses.map((course, i) => (
                  <View key={course.id} style={[s.courseRow, i === courses.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.courseName}>{course.name}</Text>
                      <View style={s.courseMetaRow}>
                        {course.program  && <View style={s.courseTag}><Text style={s.courseTagText}>{course.program}</Text></View>}
                        {course.semester && <View style={s.courseTag}><Text style={s.courseTagText}>{course.semester}</Text></View>}
                      </View>
                    </View>
                    {course.student_count !== undefined && (
                      <View style={s.courseCount}>
                        <Text style={s.courseCountNum}>{course.student_count}</Text>
                        <Text style={s.courseCountLabel}>students</Text>
                      </View>
                    )}
                  </View>
                ))}
              </SectionCard>
            )}

</>
        )}

        {/* ── QUICK ACTIONS ── */}
        <SectionCard>
          <SectionTitle icon="⚡" title="Quick Actions" />
          <Divider />
          <TouchableOpacity style={s.actionRow} onPress={() => setEditing(true)}>
            <Text style={s.actionIcon}>✏️</Text>
            <Text style={s.actionLabel}>Edit Profile</Text>
            <Text style={s.actionChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionRow}
            onPress={() => { setNewPassword(''); setConfirmPassword(''); setShowPasswordModal(true); }}
          >
            <Text style={s.actionIcon}>🔑</Text>
            <Text style={s.actionLabel}>Change Password</Text>
            <Text style={s.actionChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionRow} onPress={() => setShowNotifModal(true)}>
            <Text style={s.actionIcon}>🔔</Text>
            <Text style={s.actionLabel}>Notification Preferences</Text>
            <Text style={s.actionChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionRow} onPress={() => setShowSettingsModal(true)}>
            <Text style={s.actionIcon}>⚙️</Text>
            <Text style={s.actionLabel}>Account Settings</Text>
            <Text style={s.actionChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionRow, { borderBottomWidth: 0 }]}
            onPress={() => Alert.alert(
              'Log Out',
              'Are you sure you want to log out?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
              ],
            )}
          >
            <Text style={s.actionIcon}>🚪</Text>
            <Text style={[s.actionLabel, { color: C.red }]}>Log Out</Text>
            <Text style={[s.actionChevron, { color: C.red }]}>›</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* ── SUPPORT ── */}
        <SectionCard>
          <SectionTitle icon="💬" title="Support" />
          <Divider />

          {/* Feedback */}
          <TouchableOpacity
            style={[s.actionRow, { alignItems: 'flex-start' }]}
            onPress={() => Linking.openURL('https://forms.gle/ER4fGa68aJapZub29')}
          >
            <Text style={[s.actionIcon, { marginTop: 2 }]}>📝</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>Feedback</Text>
              <Text style={s.actionSub}>Share your thoughts about High Five</Text>
            </View>
            <Text style={[s.actionChevron, { marginTop: 2 }]}>›</Text>
          </TouchableOpacity>

          {/* Customer Support */}
          <TouchableOpacity
            style={[s.actionRow, { borderBottomWidth: 0, alignItems: 'flex-start' }]}
            onPress={() => Linking.openURL('https://forms.gle/eQAw3mqmPoFLgCnk6')}
          >
            <Text style={[s.actionIcon, { marginTop: 2 }]}>🎧</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>Customer Support</Text>
              <Text style={s.actionSub}>
                Share your school name, issue, and email. Our team will contact you within the next 2 hours.
              </Text>
            </View>
            <Text style={[s.actionChevron, { marginTop: 2 }]}>›</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* ── LEGAL ── */}
        <SectionCard>
          <SectionTitle icon="📄" title="Legal" />
          <Divider />
          <TouchableOpacity
            style={[s.actionRow, { borderBottomWidth: 0 }]}
            onPress={() => setShowTermsModal(true)}
          >
            <Text style={s.actionIcon}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>Terms & Conditions</Text>
              <View style={[
                s.termsStatusBadge,
                profile.accepted_terms
                  ? { backgroundColor: C.greenBg, borderColor: C.greenBdr }
                  : { backgroundColor: C.redBg,   borderColor: C.redBdr },
              ]}>
                <View style={[
                  s.termsStatusDot,
                  { backgroundColor: profile.accepted_terms ? C.green : C.red },
                ]} />
                <Text style={[
                  s.termsStatusText,
                  { color: profile.accepted_terms ? C.green : C.red },
                ]}>
                  {profile.accepted_terms ? `Accepted · ${TERMS_VERSION}` : 'Not accepted'}
                </Text>
              </View>
            </View>
            <Text style={s.actionChevron}>›</Text>
          </TouchableOpacity>
        </SectionCard>

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* ══ CHANGE PASSWORD MODAL ══ */}
      <Modal visible={showPasswordModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={m.overlay}
        >
          <View style={m.sheet}>
            <Text style={m.sheetTitle}>Change Password</Text>
            <Text style={m.sheetSub}>Enter a new password for your account</Text>
            <View style={m.field}>
              <Text style={m.fieldLabel}>NEW PASSWORD</Text>
              <TextInput
                style={m.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="At least 6 characters"
                placeholderTextColor={C.inkSoft}
              />
            </View>
            <View style={m.field}>
              <Text style={m.fieldLabel}>CONFIRM PASSWORD</Text>
              <TextInput
                style={m.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Repeat new password"
                placeholderTextColor={C.inkSoft}
              />
            </View>
            <View style={m.btnRow}>
              <TouchableOpacity style={[m.btn, m.btnSecondary]} onPress={() => setShowPasswordModal(false)}>
                <Text style={m.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[m.btn, m.btnPrimary]} onPress={handleChangePassword} disabled={changingPassword}>
                <Text style={m.btnPrimaryText}>{changingPassword ? 'Saving…' : 'Update Password'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══ NOTIFICATION PREFERENCES MODAL ══ */}
      <Modal visible={showNotifModal} animationType="slide" transparent>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <Text style={m.sheetTitle}>Notification Preferences</Text>
            <Text style={m.sheetSub}>Choose which notifications you'd like to receive</Text>
            {([
              { label: 'Student Warning Alerts',      sub: 'New at-risk students in your courses',   val: notifWarnings,   set: setNotifWarnings },
              { label: 'Syllabus Feedback',           sub: 'Approvals and comments on your syllabi', val: notifSyllabus,   set: setNotifSyllabus },
              { label: 'System Announcements',        sub: 'Platform updates and notices',           val: notifSystem,     set: setNotifSystem },
              { label: 'Assignment & Homework Tools', sub: 'Updates from AI assistance tools',       val: notifAssignment, set: setNotifAssignment },
            ] as const).map((item, i) => (
              <View key={i} style={m.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={m.toggleLabel}>{item.label}</Text>
                  <Text style={m.toggleSub}>{item.sub}</Text>
                </View>
                <Switch
                  value={item.val}
                  onValueChange={item.set}
                  trackColor={{ false: C.border, true: C.leaf }}
                  thumbColor={C.card}
                />
              </View>
            ))}
            <View style={m.btnRow}>
              <TouchableOpacity style={[m.btn, m.btnSecondary]} onPress={() => setShowNotifModal(false)}>
                <Text style={m.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[m.btn, m.btnPrimary]} onPress={handleSaveNotifs} disabled={savingNotifs}>
                <Text style={m.btnPrimaryText}>{savingNotifs ? 'Saving…' : 'Save Preferences'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ ACCOUNT SETTINGS MODAL ══ */}
      <Modal visible={showSettingsModal} animationType="slide" transparent>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <Text style={m.sheetTitle}>Account Settings</Text>
            <Text style={m.sheetSub}>Manage your display and language preferences</Text>
            <Text style={[m.fieldLabel, { marginBottom: 10 }]}>DISPLAY LANGUAGE</Text>
            <View style={m.langGrid}>
              {LANGUAGES.map(lang => (
                <TouchableOpacity
                  key={lang}
                  style={[m.langBtn, language === lang && m.langBtnActive]}
                  onPress={() => setLanguage(lang)}
                >
                  <Text style={[m.langBtnText, language === lang && m.langBtnTextActive]}>{lang}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={m.btnRow}>
              <TouchableOpacity style={[m.btn, m.btnSecondary]} onPress={() => setShowSettingsModal(false)}>
                <Text style={m.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[m.btn, m.btnPrimary]} onPress={handleSaveSettings} disabled={savingSettings}>
                <Text style={m.btnPrimaryText}>{savingSettings ? 'Saving…' : 'Save Settings'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ TERMS & CONDITIONS MODAL ══ */}
      <Modal visible={showTermsModal} animationType="slide" transparent={false}>
        <View style={{ flex: 1, backgroundColor: C.mist }}>
          {/* Header */}
          <View style={m.termsHeader}>
            <View style={{ flex: 1 }}>
              <Text style={m.termsHeaderTitle}>Terms & Conditions</Text>
              <Text style={m.termsHeaderSub}>{TERMS_VERSION}</Text>
            </View>
            <TouchableOpacity style={m.termsCloseBtn} onPress={() => setShowTermsModal(false)}>
              <Text style={m.termsCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Terms text */}
          <ScrollView style={{ flex: 1, backgroundColor: C.card }} contentContainerStyle={{ padding: 20 }}>
            <Text style={m.termsBody}>{TERMS_CONTENT}</Text>
            {profile.accepted_terms && (
              <View style={m.termsAcceptedBadge}>
                <Text style={m.termsAcceptedText}>
                  ✓  You accepted these Terms & Conditions on{' '}
                  {profile.accepted_terms_at
                    ? new Date(profile.accepted_terms_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })
                    : 'a previous session'
                  }.
                </Text>
              </View>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

// ── Page styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.mist },
  content:   { padding: 16, paddingBottom: 48 },
  centre:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  successBanner: {
    backgroundColor: C.greenBg, borderWidth: 1, borderColor: C.greenBdr,
    borderRadius: 10, padding: 12, marginBottom: 12, alignItems: 'center',
  },
  successText: { fontSize: 13, fontWeight: '700', color: C.green },

  // Header
  header: {
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20,
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1,
    borderColor: C.border, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  avatar:       { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText:   { fontSize: 28, fontWeight: '800', color: '#fff' },
  greeting:     { fontSize: 13, color: C.inkSoft, marginBottom: 2 },
  fullName:     { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 8, textAlign: 'center' },
  roleBadge:    { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 10 },
  roleBadgeText:{ fontSize: 12, fontWeight: '700', color: '#fff' },
  institution:  { fontSize: 13, color: C.inkMid, marginBottom: 2, textAlign: 'center' },
  email:        { fontSize: 13, color: C.inkSoft, marginBottom: 10 },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot:    { width: 7, height: 7, borderRadius: 4 },
  statusText:   { fontSize: 11, fontWeight: '700' },

  // Edit controls
  editBtn:     { backgroundColor: C.green50, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: C.border },
  editBtnText: { fontSize: 12, fontWeight: '700', color: C.forest },
  editForm:    { gap: 12 },
  editField:   {},
  editLabel:   { fontSize: 10, fontWeight: '700', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 5 },
  editInput:   { backgroundColor: C.mist, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: C.ink },
  readonlyNote:{ backgroundColor: C.amberBg, borderColor: C.amberBdr, borderWidth: 1, borderRadius: 8, padding: 10 },
  readonlyText:{ fontSize: 12, color: C.amber, marginTop: 2 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 8 },

  // Info box
  infoBox:    { backgroundColor: C.green50, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 10 },
  infoBoxText:{ fontSize: 12, color: C.inkMid },

  // My Courses
  courseRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  courseName:     { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 4 },
  courseMetaRow:  { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  courseTag:      { backgroundColor: C.green50, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: C.border },
  courseTagText:  { fontSize: 11, color: C.forest, fontWeight: '500' },
  courseCount:    { alignItems: 'center', minWidth: 48 },
  courseCountNum: { fontSize: 16, fontWeight: '800', color: C.forest },
  courseCountLabel:{ fontSize: 10, color: C.inkSoft },

  // Quick actions
  actionRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border },
  actionIcon:   { fontSize: 18, width: 28 },
  actionLabel:  { flex: 1, fontSize: 14, color: C.ink, fontWeight: '500' },
  actionSub:    { fontSize: 12, color: C.inkSoft, marginTop: 2, lineHeight: 17 },
  actionChevron:{ fontSize: 20, color: C.inkSoft, fontWeight: '300' },

  // Terms status badge
  termsStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  termsStatusDot:   { width: 6, height: 6, borderRadius: 3 },
  termsStatusText:  { fontSize: 11, fontWeight: '700' },
});

// ── Modal styles ──────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 4 },
  sheetSub:   { fontSize: 13, color: C.inkMid, marginBottom: 20 },

  field:      { marginBottom: 14 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  input:      { backgroundColor: C.mist, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.ink },

  toggleRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: C.ink },
  toggleSub:   { fontSize: 12, color: C.inkMid, marginTop: 2 },

  langGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  langBtn:         { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.mist },
  langBtnActive:   { backgroundColor: C.forest, borderColor: C.forest },
  langBtnText:     { fontSize: 13, fontWeight: '600', color: C.inkMid },
  langBtnTextActive:{ color: '#fff' },

  btnRow:          { flexDirection: 'row', gap: 10, marginTop: 20 },
  btn:             { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  btnPrimary:      { backgroundColor: C.forest, borderColor: C.forest },
  btnPrimaryText:  { fontSize: 14, fontWeight: '700', color: '#fff' },
  btnSecondary:    { backgroundColor: C.mist, borderColor: C.border },
  btnSecondaryText:{ fontSize: 14, fontWeight: '600', color: C.inkMid },

  // Terms full-screen modal
  termsHeader: {
    backgroundColor: C.forest, paddingTop: 52, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
  },
  termsHeaderTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  termsHeaderSub:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  termsCloseBtn:    { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  termsCloseBtnText:{ fontSize: 13, fontWeight: '700', color: '#fff' },
  termsBody:        { fontSize: 13, color: C.ink, lineHeight: 21 },
  termsAcceptedBadge: {
    backgroundColor: C.greenBg, borderWidth: 1, borderColor: C.greenBdr,
    borderRadius: 10, padding: 14, marginTop: 20,
  },
  termsAcceptedText: { fontSize: 13, color: C.green, fontWeight: '600', lineHeight: 19 },
});

export default ProfileScreen;
