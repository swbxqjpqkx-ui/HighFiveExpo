import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Switch, TextInput, TouchableOpacity,
} from 'react-native';
import { getOpenDayStats } from '../../services/supabase';
import { OpenDayStat } from '../../types';

const C = {
  green50:  '#f0f6ef',
  green100: '#e2efe5',
  green600: '#2a8a4d',
  green700: '#1d6e3a',
  green900: '#0f4a26',
  text:     '#1a2418',
  muted:    '#6b7264',
  soft:     '#8e948a',
  border:   '#e4ebe2',
  red:      '#d94343',
  amber:    '#d99a1f',
  blue:     '#3b6fd1',
  purple:   '#7a5acc',
  card:     '#ffffff',
  bg:       '#f5f9f3',
};

const MOCK_REGISTRATIONS = [
  { id: 'r1', name: 'Emma Schneider',   email: 'emma.s@gmail.com',    country: 'Switzerland', registered_at: '2026-05-10' },
  { id: 'r2', name: 'Luca Bianchi',     email: 'luca.b@email.it',     country: 'Italy',       registered_at: '2026-05-09' },
  { id: 'r3', name: 'Sophie Martin',    email: 'sophie.m@free.fr',    country: 'France',      registered_at: '2026-05-09' },
  { id: 'r4', name: 'Kai Müller',       email: 'kai.m@web.de',        country: 'Germany',     registered_at: '2026-05-08' },
  { id: 'r5', name: 'Ana Costa',        email: 'ana.c@sapo.pt',       country: 'Portugal',    registered_at: '2026-05-08' },
];

const MOCK_AMBASSADORS = [
  { id: 'a1', name: 'Mia Hofmann',    role: 'Lead Ambassador', initials: 'MH', color: C.green600 },
  { id: 'a2', name: 'Tom Richter',    role: 'Campus Guide',    initials: 'TR', color: C.blue },
  { id: 'a3', name: 'Sara Nguyen',    role: 'Social Media',    initials: 'SN', color: C.purple },
  { id: 'a4', name: 'Ben Fischer',    role: 'Campus Guide',    initials: 'BF', color: C.amber },
  { id: 'a5', name: 'Lena Braun',     role: 'Registration',   initials: 'LB', color: C.red },
  { id: 'a6', name: 'Marc Dupont',    role: 'Campus Guide',    initials: 'MD', color: C.green600 },
];

const COUNTRY_STATS = [
  { country: 'Switzerland', count: 78 },
  { country: 'Germany',     count: 52 },
  { country: 'France',      count: 44 },
  { country: 'Italy',       count: 37 },
  { country: 'Portugal',    count: 29 },
  { country: 'Spain',       count: 25 },
  { country: 'Austria',     count: 22 },
  { country: 'Other',       count: 25 },
];

const AdminOpenDayScreen: React.FC = () => {
  const [stat, setStat]               = useState<OpenDayStat | null>(null);
  const [loading, setLoading]         = useState(true);
  const [regOpen, setRegOpen]         = useState(true);
  const [eventDate, setEventDate]     = useState('2026-05-24');
  const [capacityMax, setCapacityMax] = useState('400');

  useEffect(() => {
    getOpenDayStats()
      .then(setStat)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const capPct = stat ? Math.round((stat.capacity / (parseInt(capacityMax) || stat.capacity_max)) * 100) : 0;
  const maxReg = Math.max(...COUNTRY_STATS.map(c => c.count));

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.headerRow}>
        <View>
          <Text style={s.pageTitle}>Open Day</Text>
          <Text style={s.pageSub}>Next: May 24, 2026 · in {stat?.days_until ?? 10} days</Text>
        </View>
        <View style={s.datePill}>
          <Text style={s.datePillText}>📅 May 24, 2026</Text>
        </View>
      </View>

      {/* Stats row */}
      {loading ? (
        <ActivityIndicator size="large" color={C.green600} style={{ marginVertical: 30 }} />
      ) : (
        <View style={s.statsRow}>
          {[
            { label: 'Registrations', value: String(stat?.total_registrations ?? 312), color: C.green600, bg: C.green50 },
            { label: 'Countries',     value: String(stat?.countries_count ?? 23),      color: C.blue,     bg: '#eef3fb' },
            { label: 'Ambassadors',   value: String(stat?.ambassadors_count ?? 45),    color: C.purple,   bg: '#f2eefb' },
            { label: 'Capacity',      value: `${stat?.capacity ?? 312}/${stat?.capacity_max ?? 400}`, color: C.amber, bg: '#fdf6e8' },
          ].map(item => (
            <View key={item.label} style={[s.statCard, { backgroundColor: item.bg, borderColor: item.color + '40' }]}>
              <Text style={[s.statVal, { color: item.color }]}>{item.value}</Text>
              <Text style={s.statLbl}>{item.label}</Text>
              {item.label === 'Capacity' && (
                <View style={s.capBarTrack}>
                  <View style={[s.capBarFill, { width: `${capPct}%` as any }]} />
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Admin form */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Event Settings</Text>
        <View style={s.formRow}>
          <Text style={s.formLabel}>Event Date</Text>
          <TextInput
            style={s.formInput}
            value={eventDate}
            onChangeText={setEventDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.soft}
          />
        </View>
        <View style={s.formRow}>
          <Text style={s.formLabel}>Capacity Max</Text>
          <TextInput
            style={s.formInput}
            value={capacityMax}
            onChangeText={setCapacityMax}
            keyboardType="number-pad"
            placeholderTextColor={C.soft}
          />
        </View>
        <View style={s.formRow}>
          <Text style={s.formLabel}>Registration Open</Text>
          <Switch
            value={regOpen}
            onValueChange={setRegOpen}
            trackColor={{ true: C.green600, false: '#ccc' }}
            thumbColor="#fff"
          />
        </View>
        <TouchableOpacity style={s.saveBtn}>
          <Text style={s.saveBtnText}>Save Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Registrations table */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Recent Registrations</Text>
        <View style={s.tableHeader}>
          <Text style={[s.th, { flex: 2 }]}>Name</Text>
          <Text style={[s.th, { flex: 2 }]}>Email</Text>
          <Text style={[s.th, { flex: 1 }]}>Country</Text>
          <Text style={[s.th, { flex: 1 }]}>Date</Text>
        </View>
        {MOCK_REGISTRATIONS.map((r, i) => (
          <View key={r.id} style={[s.tableRow, i % 2 === 0 && s.tableRowAlt]}>
            <Text style={[s.td, { flex: 2, fontWeight: '600' }]}>{r.name}</Text>
            <Text style={[s.td, { flex: 2, color: C.muted }]}>{r.email}</Text>
            <Text style={[s.td, { flex: 1 }]}>{r.country}</Text>
            <Text style={[s.td, { flex: 1, color: C.soft }]}>{r.registered_at}</Text>
          </View>
        ))}
      </View>

      {/* Ambassadors */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Ambassadors ({MOCK_AMBASSADORS.length})</Text>
        <View style={s.ambassadorsGrid}>
          {MOCK_AMBASSADORS.map(amb => (
            <View key={amb.id} style={s.ambassadorChip}>
              <View style={[s.ambAvatar, { backgroundColor: amb.color }]}>
                <Text style={s.ambInitials}>{amb.initials}</Text>
              </View>
              <View>
                <Text style={s.ambName}>{amb.name}</Text>
                <Text style={s.ambRole}>{amb.role}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Countries */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Registrations by Country</Text>
        {COUNTRY_STATS.map(c => (
          <View key={c.country} style={s.barRow}>
            <Text style={s.barLabel}>{c.country}</Text>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${(c.count / maxReg) * 100}%` as any }]} />
            </View>
            <Text style={s.barCount}>{c.count}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  content:        { padding: 20, paddingBottom: 40 },
  headerRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  pageTitle:      { fontSize: 22, fontWeight: '800', color: C.text },
  pageSub:        { fontSize: 13, color: C.muted, marginTop: 2 },
  datePill:       { backgroundColor: C.green50, borderWidth: 1, borderColor: C.green600 + '40', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  datePillText:   { fontSize: 12, color: C.green700, fontWeight: '600' },
  statsRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard:       { flex: 1, minWidth: 120, borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  statVal:        { fontSize: 24, fontWeight: '900' },
  statLbl:        { fontSize: 11, color: C.muted },
  capBarTrack:    { height: 4, backgroundColor: C.border, borderRadius: 2, marginTop: 4 },
  capBarFill:     { height: 4, backgroundColor: C.amber, borderRadius: 2 },
  card:           { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  sectionTitle:   { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14 },
  formRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  formLabel:      { fontSize: 13, color: C.text, fontWeight: '500' },
  formInput:      { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: C.text, minWidth: 120, backgroundColor: C.bg },
  saveBtn:        { backgroundColor: C.green600, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 12 },
  saveBtnText:    { color: '#fff', fontSize: 13, fontWeight: '700' },
  tableHeader:    { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 4 },
  tableRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  tableRowAlt:    { backgroundColor: C.bg, borderRadius: 6 },
  th:             { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  td:             { fontSize: 13, color: C.text },
  ambassadorsGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ambassadorChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 8 },
  ambAvatar:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  ambInitials:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  ambName:        { fontSize: 13, fontWeight: '600', color: C.text },
  ambRole:        { fontSize: 11, color: C.muted },
  barRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barLabel:       { width: 100, fontSize: 12, color: C.text },
  barTrack:       { flex: 1, height: 10, backgroundColor: C.green100, borderRadius: 5 },
  barFill:        { height: 10, borderRadius: 5, backgroundColor: C.green600 },
  barCount:       { width: 36, fontSize: 12, color: C.muted, textAlign: 'right' },
});

export default AdminOpenDayScreen;
