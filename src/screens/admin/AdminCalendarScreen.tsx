import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { getAdminCalendarEvents } from '../../services/supabase';
import { AdminCalendarEvent } from '../../types';

const C = {
  green50:  '#f0f6ef',
  green100: '#e2efe5',
  green600: '#2a8a4d',
  green700: '#1d6e3a',
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

type FilterType = 'all' | 'meeting' | 'deadline' | 'event';
type EventType = 'meeting' | 'deadline' | 'event';

const TYPE_DOT_COLORS: Record<EventType, string> = {
  meeting:  '#7a5acc',
  deadline: '#d94343',
  event:    '#d99a1f',
};

const TYPE_COLORS: Record<string, string> = {
  meeting:  C.purple,
  deadline: C.red,
  event:    C.amber,
};

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const AdminCalendarScreen: React.FC = () => {
  const [events, setEvents]     = useState<AdminCalendarEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<FilterType>('all');

  // ── Add event modal state ──────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle]   = useState('');
  const [newDate, setNewDate]     = useState('');
  const [newTime, setNewTime]     = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newType, setNewType]     = useState<EventType>('meeting');
  const [formError, setFormError] = useState('');

  const resetForm = () => {
    setNewTitle(''); setNewDate(''); setNewTime('');
    setNewEndTime(''); setNewLocation(''); setNewType('meeting'); setFormError('');
  };

  const handleAddEvent = () => {
    if (!newTitle.trim()) { setFormError('Please enter a title.'); return; }
    if (!newDate.trim())  { setFormError('Please enter a date (e.g. 2026-05-20).'); return; }
    if (!newTime.trim())  { setFormError('Please enter a start time (e.g. 09:00).'); return; }
    const ev: AdminCalendarEvent = {
      id:       `ev_${Date.now()}`,
      title:    newTitle.trim(),
      date:     newDate.trim(),
      time:     newTime.trim(),
      end_time: newEndTime.trim() || undefined,
      location: newLocation.trim() || 'TBD',
      type:     newType,
      color:    TYPE_DOT_COLORS[newType],
    };
    setEvents(prev => [...prev, ev]);
    // TODO: await supabase.from('admin_calendar').insert(ev);
    resetForm();
    setShowModal(false);
  };

  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth();

  useEffect(() => {
    getAdminCalendarEvents()
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const eventDays = new Set(
    events
      .filter(e => new Date(e.date).getMonth() === month && new Date(e.date).getFullYear() === year)
      .map(e => new Date(e.date).getDate())
  );

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter);

  const typeBadge = (type: string) => ({
    meeting:  { bg: C.purple + '20', color: C.purple },
    deadline: { bg: C.red + '20',    color: C.red },
    event:    { bg: C.amber + '20',  color: C.amber },
  }[type] ?? { bg: C.green50, color: C.green600 });

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header row with title + add button */}
      <View style={s.titleRow}>
        <Text style={s.pageTitle}>Calendar</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowModal(true)}>
          <Text style={s.addBtnText}>+ Add Event</Text>
        </TouchableOpacity>
      </View>

      {/* Add Event Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => { resetForm(); setShowModal(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>New Event</Text>

            {/* Title */}
            <Text style={s.fieldLabel}>Title *</Text>
            <TextInput
              style={s.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="e.g. Department Meeting"
              placeholderTextColor={C.soft}
            />

            {/* Date */}
            <Text style={s.fieldLabel}>Date * (YYYY-MM-DD)</Text>
            <TextInput
              style={s.input}
              value={newDate}
              onChangeText={setNewDate}
              placeholder="e.g. 2026-05-20"
              placeholderTextColor={C.soft}
              keyboardType="numbers-and-punctuation"
            />

            {/* Time row */}
            <View style={s.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Start Time * (HH:MM)</Text>
                <TextInput
                  style={s.input}
                  value={newTime}
                  onChangeText={setNewTime}
                  placeholder="09:00"
                  placeholderTextColor={C.soft}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>End Time (optional)</Text>
                <TextInput
                  style={s.input}
                  value={newEndTime}
                  onChangeText={setNewEndTime}
                  placeholder="10:30"
                  placeholderTextColor={C.soft}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            {/* Location */}
            <Text style={s.fieldLabel}>Location</Text>
            <TextInput
              style={s.input}
              value={newLocation}
              onChangeText={setNewLocation}
              placeholder="Room 101 / Online / TBD"
              placeholderTextColor={C.soft}
            />

            {/* Type picker */}
            <Text style={s.fieldLabel}>Type</Text>
            <View style={s.typePicker}>
              {(['meeting', 'deadline', 'event'] as EventType[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.typeChip, newType === t && { backgroundColor: TYPE_COLORS[t], borderColor: TYPE_COLORS[t] }]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[s.typeChipText, newType === t && { color: '#fff' }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Error */}
            {formError ? <Text style={s.formError}>{formError}</Text> : null}

            {/* Buttons */}
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { resetForm(); setShowModal(false); }}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleAddEvent}>
                <Text style={s.saveBtnText}>Save Event</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Mini month grid */}
      <View style={s.card}>
        <Text style={s.monthTitle}>{MONTHS[month]} {year}</Text>
        <View style={s.daysHeader}>
          {DAYS_OF_WEEK.map(d => (
            <Text key={d} style={s.dayLabel}>{d}</Text>
          ))}
        </View>
        <View style={s.grid}>
          {cells.map((day, idx) => {
            const isToday = day === today.getDate();
            const hasEvent = day !== null && eventDays.has(day);
            return (
              <View key={idx} style={s.cellWrap}>
                {day !== null ? (
                  <View style={[s.cell, isToday && s.cellToday]}>
                    <Text style={[s.cellText, isToday && s.cellTextToday]}>{day}</Text>
                    {hasEvent && <View style={[s.dot, isToday && s.dotToday]} />}
                  </View>
                ) : (
                  <View style={s.cell} />
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Filter tabs */}
      <View style={s.tabs}>
        {(['all', 'meeting', 'deadline', 'event'] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.tab, filter === f && s.tabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.tabText, filter === f && s.tabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}{f === 'all' ? 's' : 's'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Events list */}
      {loading ? (
        <ActivityIndicator size="large" color={C.green600} style={{ marginVertical: 30 }} />
      ) : (
        <View style={s.card}>
          {filtered.length === 0 ? (
            <Text style={s.empty}>No events found.</Text>
          ) : (
            filtered
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
              .map(ev => {
                const tb = typeBadge(ev.type);
                return (
                  <View key={ev.id} style={s.evRow}>
                    <View style={s.evTimeCol}>
                      <Text style={s.evTime}>{ev.time}</Text>
                      {ev.end_time && <Text style={s.evEndTime}>{ev.end_time}</Text>}
                    </View>
                    <View style={[s.evAccent, { backgroundColor: ev.color ?? C.green600 }]} />
                    <View style={s.evBody}>
                      <Text style={s.evTitle}>{ev.title}</Text>
                      <Text style={s.evLoc}>📍 {ev.location}</Text>
                      <View style={s.evFooter}>
                        <Text style={s.evDate}>{ev.date}</Text>
                        <View style={[s.badge, { backgroundColor: tb.bg }]}>
                          <Text style={[s.badgeText, { color: tb.color }]}>
                            {ev.type.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })
          )}
        </View>
      )}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  content:      { padding: 20, paddingBottom: 40 },
  titleRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  pageTitle:    { fontSize: 22, fontWeight: '800', color: C.text },
  addBtn:       { backgroundColor: C.green600, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText:   { fontSize: 13, fontWeight: '700', color: '#fff' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 16 },
  fieldLabel:   { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 10 },
  input:        { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text },
  timeRow:      { flexDirection: 'row', gap: 10 },
  typePicker:   { flexDirection: 'row', gap: 8, marginTop: 2 },
  typeChip:     { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', backgroundColor: C.card },
  typeChipText: { fontSize: 13, fontWeight: '600', color: C.muted },
  formError:    { fontSize: 13, color: C.red, marginTop: 10, fontWeight: '600' },
  modalBtns:    { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn:    { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  cancelBtnText:{ fontSize: 14, fontWeight: '600', color: C.muted },
  saveBtn:      { flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: C.green600, alignItems: 'center' },
  saveBtnText:  { fontSize: 14, fontWeight: '700', color: '#fff' },
  card:         { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  monthTitle:   { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
  daysHeader:   { flexDirection: 'row', marginBottom: 8 },
  dayLabel:     { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: C.muted },
  grid:         { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap:     { width: `${100 / 7}%` as any, alignItems: 'center', marginBottom: 4 },
  cell:         { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cellToday:    { backgroundColor: C.green600 },
  cellText:     { fontSize: 13, color: C.text },
  cellTextToday:{ color: '#fff', fontWeight: '700' },
  dot:          { width: 4, height: 4, borderRadius: 2, backgroundColor: C.green600, marginTop: 1 },
  dotToday:     { backgroundColor: '#fff' },
  tabs:         { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  tabActive:    { backgroundColor: C.green600, borderColor: C.green600 },
  tabText:      { fontSize: 12, color: C.muted, fontWeight: '600' },
  tabTextActive:{ color: '#fff' },
  empty:        { fontSize: 13, color: C.muted, paddingVertical: 12 },
  evRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  evTimeCol:    { width: 44, alignItems: 'flex-end', paddingTop: 2 },
  evTime:       { fontSize: 12, fontWeight: '700', color: C.text },
  evEndTime:    { fontSize: 10, color: C.soft },
  evAccent:     { width: 3, borderRadius: 2, alignSelf: 'stretch', minHeight: 40 },
  evBody:       { flex: 1, gap: 3 },
  evTitle:      { fontSize: 14, fontWeight: '700', color: C.text },
  evLoc:        { fontSize: 12, color: C.muted },
  evFooter:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  evDate:       { fontSize: 11, color: C.soft },
  badge:        { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:    { fontSize: 10, fontWeight: '700' },
});

export default AdminCalendarScreen;
