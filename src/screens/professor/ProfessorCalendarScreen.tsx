import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { getProfessorCalendarEvents, createProfessorCalendarEvent } from '../../services/supabase';
import { AdminCalendarEvent, Profile } from '../../types';
import { normalizeDateInput, normalizeTimeInput } from '../../utils/calendarInput';
import { Green, Ink, Tint } from '../../theme';

const C = {
  green50:  Green[50],
  green100: Green[100],
  green600: Green[600],
  green700: Green[700],
  text:     Ink.base,
  muted:    Ink[3],
  soft:     Ink[4],
  border:   Ink.line,
  red:      Tint.rose.ink,
  amber:    Tint.sun.ink,
  blue:     Tint.sky.ink,
  purple:   Tint.violet.ink,
  card:     Ink.surface,
  bg:       Ink.bg,
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

interface Props {
  profile: Profile;
}

const ProfessorCalendarScreen: React.FC<Props> = ({ profile }) => {
  const [events, setEvents]     = useState<AdminCalendarEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<FilterType>('all');

  // ── Selected day / daily-details state ─────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState('');   // 'YYYY-MM-DD'
  const [showDayDetails, setShowDayDetails] = useState(false);

  // ── Add event modal state ──────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle]   = useState('');
  const [newDate, setNewDate]     = useState('');
  const [newTime, setNewTime]     = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newType, setNewType]     = useState<EventType>('meeting');
  const [formError, setFormError] = useState('');
  const [saving, setSaving]       = useState(false);

  const resetForm = () => {
    setNewTitle(''); setNewDate(''); setNewTime('');
    setNewEndTime(''); setNewLocation(''); setNewType('meeting'); setFormError('');
  };

  const handleAddEvent = async () => {
    if (saving) return;
    if (!newTitle.trim()) { setFormError('Please enter a title.'); return; }
    if (!newDate.trim())  { setFormError('Please enter a date (e.g. 2026-05-20).'); return; }
    if (!newTime.trim())  { setFormError('Please enter a start time (e.g. 09:00).'); return; }

    // Normalize flexible date / time input to the format the app + Supabase use.
    const normDate = normalizeDateInput(newDate);
    if (!normDate) { setFormError('Please enter a valid date, e.g. 2026-05-20 or 04/06/26.'); return; }
    const normTime = normalizeTimeInput(newTime);
    if (!normTime) { setFormError('Please enter a valid start time, e.g. 9, 9:30 or 09:30.'); return; }
    let normEndTime: string | undefined;
    if (newEndTime.trim()) {
      const e = normalizeTimeInput(newEndTime);
      if (!e) { setFormError('Please enter a valid end time, e.g. 10 or 10:30.'); return; }
      normEndTime = e;
    }

    setFormError('');
    setSaving(true);
    try {
      // Persist to Supabase first and get the real saved row (with its DB id).
      const saved = await createProfessorCalendarEvent(profile.id, {
        title:    newTitle.trim(),
        date:     normDate,
        time:     normTime,
        end_time: normEndTime,
        location: newLocation.trim() || 'TBD',
        type:     newType,
        color:    TYPE_DOT_COLORS[newType],
      });
      // Only after a successful insert: update local state with the saved row.
      setEvents(prev => [...prev, saved]);
      resetForm();
      setShowModal(false);
    } catch (err) {
      console.error('Failed to save professor calendar event:', err);
      setFormError('Could not save the event. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const today = new Date();
  // Month/year currently shown in the grid (defaults to the current month).
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());   // 0–11
  const year  = viewYear;
  const month = viewMonth;

  const stepMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0)  { m = 11; y -= 1; }
    if (m > 11) { m = 0;  y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };
  const stepYear = (delta: number) => setViewYear(y => y + delta);

  useEffect(() => {
    getProfessorCalendarEvents(profile.id)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile.id]);

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

  // Build a 'YYYY-MM-DD' string for a given day number in the displayed month.
  const dayToDateStr = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // Events for the currently selected day.
  const selectedDayEvents = events
    .filter(e => e.date === selectedDate)
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time));

  const prettyDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

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
            <Text style={s.fieldLabel}>Date * (e.g. 2026-05-20 or 04/06/26)</Text>
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
                <Text style={s.fieldLabel}>Start Time * (e.g. 9, 9:30)</Text>
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
                <Text style={s.fieldLabel}>End Time (optional, e.g. 10:30)</Text>
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
              <TouchableOpacity style={s.saveBtn} onPress={handleAddEvent} disabled={saving}>
                <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Event'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Daily details modal */}
      <Modal visible={showDayDetails} animationType="slide" transparent onRequestClose={() => setShowDayDetails(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{prettyDate(selectedDate)}</Text>
            {selectedDayEvents.length === 0 ? (
              <Text style={s.empty}>No events or plans for this day.</Text>
            ) : (
              selectedDayEvents.map(ev => {
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
                        <View style={[s.badge, { backgroundColor: tb.bg }]}>
                          <Text style={[s.badgeText, { color: tb.color }]}>{ev.type.toUpperCase()}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
            <TouchableOpacity style={[s.cancelBtn, { marginTop: 18 }]} onPress={() => setShowDayDetails(false)}>
              <Text style={s.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Mini month grid */}
      <View style={s.card}>
        <View style={s.monthNav}>
          <View style={s.monthNavSide}>
            <TouchableOpacity style={s.navBtn} onPress={() => stepYear(-1)} accessibilityLabel="Previous year">
              <Text style={s.navArrow}>«</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.navBtn} onPress={() => stepMonth(-1)} accessibilityLabel="Previous month">
              <Text style={s.navArrow}>‹</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.monthTitle}>{MONTHS[month]} {year}</Text>
          <View style={s.monthNavSide}>
            <TouchableOpacity style={s.navBtn} onPress={() => stepMonth(1)} accessibilityLabel="Next month">
              <Text style={s.navArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.navBtn} onPress={() => stepYear(1)} accessibilityLabel="Next year">
              <Text style={s.navArrow}>»</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.daysHeader}>
          {DAYS_OF_WEEK.map(d => (
            <Text key={d} style={s.dayLabel}>{d}</Text>
          ))}
        </View>
        <View style={s.grid}>
          {cells.map((day, idx) => {
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const hasEvent = day !== null && eventDays.has(day);
            const isSelected = day !== null && dayToDateStr(day) === selectedDate;
            return (
              <View key={idx} style={s.cellWrap}>
                {day !== null ? (
                  <TouchableOpacity
                    style={[s.cell, isToday && s.cellToday, isSelected && s.cellSelected]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedDate(dayToDateStr(day))}
                  >
                    <Text style={[s.cellText, isToday && s.cellTextToday]}>{day}</Text>
                    {hasEvent && <View style={[s.dot, isToday && s.dotToday]} />}
                  </TouchableOpacity>
                ) : (
                  <View style={s.cell} />
                )}
              </View>
            );
          })}
        </View>

        {/* Day-details button — appears only after a day is selected */}
        {selectedDate ? (
          <TouchableOpacity style={s.dayDetailsBtn} activeOpacity={0.8} onPress={() => setShowDayDetails(true)}>
            <Text style={s.dayDetailsBtnText}>📋 View {selectedDate}</Text>
          </TouchableOpacity>
        ) : null}
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
  monthNav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthNavSide: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtn:       { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.green50, borderWidth: 1, borderColor: C.green100 },
  navArrow:     { fontSize: 16, fontWeight: '800', color: C.green700, lineHeight: 18 },
  monthTitle:   { fontSize: 16, fontWeight: '700', color: C.text },
  daysHeader:   { flexDirection: 'row', marginBottom: 8 },
  dayLabel:     { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: C.muted },
  grid:         { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap:     { width: `${100 / 7}%` as any, alignItems: 'center', marginBottom: 4 },
  cell:         { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cellToday:    { backgroundColor: C.green600 },
  cellSelected: { borderWidth: 2, borderColor: C.green600 },
  dayDetailsBtn:    { marginTop: 14, alignSelf: 'flex-start', backgroundColor: C.green50, borderWidth: 1, borderColor: C.green100, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  dayDetailsBtnText:{ fontSize: 13, fontWeight: '700', color: C.green700 },
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

export default ProfessorCalendarScreen;
