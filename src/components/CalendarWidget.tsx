import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Meeting, Deadline } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface Props {
  meetings: Meeting[];
  deadlines: Deadline[];
}

const prettyDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const CalendarWidget: React.FC<Props> = ({ meetings, deadlines }) => {
  const [selected, setSelected] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const markedDates: Record<string, any> = {};

  meetings.forEach(m => {
    markedDates[m.date] = { marked: true, dotColor: Colors.leaf };
  });

  deadlines.forEach(d => {
    if (markedDates[d.date]) {
      markedDates[d.date].dots = [
        ...(markedDates[d.date].dots ?? [{ color: Colors.leaf }]),
        { color: Colors.red },
      ];
      markedDates[d.date].marked = true;
    } else {
      markedDates[d.date] = { marked: true, dotColor: Colors.red };
    }
  });

  if (selected) {
    markedDates[selected] = { ...(markedDates[selected] ?? {}), selected: true, selectedColor: Colors.leaf };
  }

  const selectedMeetings = meetings.filter(m => m.date === selected);
  const selectedDeadlines = deadlines.filter(d => d.date === selected);

  return (
    <View style={styles.container}>
      <Calendar
        onDayPress={day => setSelected(day.dateString)}
        markedDates={markedDates}
        theme={{
          todayTextColor: Colors.leaf,
          selectedDayBackgroundColor: Colors.leaf,
          arrowColor: Colors.leaf,
          monthTextColor: Colors.forest,
          textMonthFontWeight: '500',
          dayTextColor: Colors.ink,
          textDayFontSize: 13,
        }}
      />
      {/* Day-details button — appears only after a day is selected */}
      {selected ? (
        <View style={styles.btnWrap}>
          <TouchableOpacity style={styles.detailsBtn} activeOpacity={0.8} onPress={() => setShowDetails(true)}>
            <Text style={styles.detailsBtnText}>📋 View {selected}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Daily details modal */}
      <Modal visible={showDetails} animationType="slide" transparent onRequestClose={() => setShowDetails(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{prettyDate(selected)}</Text>
            {selectedMeetings.length === 0 && selectedDeadlines.length === 0 ? (
              <Text style={styles.empty}>No events or plans for this day.</Text>
            ) : (
              <>
                {selectedMeetings.map(m => (
                  <View key={m.id} style={[styles.eventItem, { borderLeftColor: Colors.leaf }]}>
                    <Text style={styles.eventTitle}>📅 {m.title}</Text>
                    {!!m.time && <Text style={styles.eventTime}>{m.time}</Text>}
                  </View>
                ))}
                {selectedDeadlines.map(d => (
                  <View key={d.id} style={[styles.eventItem, { borderLeftColor: Colors.red }]}>
                    <Text style={styles.eventTitle}>⏰ {d.title}</Text>
                  </View>
                ))}
              </>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDetails(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  events: { padding: Spacing.md, gap: Spacing.sm },
  eventItem: { borderLeftWidth: 3, paddingLeft: Spacing.sm, paddingVertical: 4 },
  eventTitle: { ...Typography.body, color: Colors.ink },
  eventTime: { ...Typography.body },
  btnWrap: { padding: Spacing.md, paddingTop: Spacing.sm, alignItems: 'flex-start' },
  detailsBtn: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.leaf, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  detailsBtnText: { ...Typography.body, color: Colors.forest, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: Radius.md, borderTopRightRadius: Radius.md, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle: { ...Typography.heading1, color: Colors.forest, marginBottom: Spacing.sm },
  empty: { ...Typography.body, color: Colors.inkLight, paddingVertical: Spacing.sm },
  closeBtn: { marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  closeBtnText: { ...Typography.body, color: Colors.ink, fontWeight: '600' },
});

export default CalendarWidget;
