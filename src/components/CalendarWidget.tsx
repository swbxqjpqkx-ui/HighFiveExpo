import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Meeting, Deadline } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface Props {
  meetings: Meeting[];
  deadlines: Deadline[];
}

const CalendarWidget: React.FC<Props> = ({ meetings, deadlines }) => {
  const [selected, setSelected] = useState('');

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
      {selected && (selectedMeetings.length > 0 || selectedDeadlines.length > 0) && (
        <View style={styles.events}>
          {selectedMeetings.map(m => (
            <View key={m.id} style={[styles.eventItem, { borderLeftColor: Colors.leaf }]}>
              <Text style={styles.eventTitle}>📅 {m.title}</Text>
              <Text style={styles.eventTime}>{m.time}</Text>
            </View>
          ))}
          {selectedDeadlines.map(d => (
            <View key={d.id} style={[styles.eventItem, { borderLeftColor: Colors.red }]}>
              <Text style={styles.eventTitle}>⏰ {d.title}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  events: { padding: Spacing.md, gap: Spacing.sm },
  eventItem: { borderLeftWidth: 3, paddingLeft: Spacing.sm, paddingVertical: 4 },
  eventTitle: { ...Typography.body, color: Colors.ink },
  eventTime: { ...Typography.body },
});

export default CalendarWidget;
