import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getGreeting } from '../utils/greeting';
import { Colors, Typography, Spacing } from '../theme';

interface Props {
  name: string;
  location?: string;
}

const GreetingHeader: React.FC<Props> = ({ name, location }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = time.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{getGreeting(name)}</Text>
      <Text style={styles.time}>{timeStr}</Text>
      <Text style={styles.date}>{dateStr}</Text>
      {location && <Text style={styles.location}>📍 {location}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.lg },
  greeting: { ...Typography.display, marginBottom: 4 },
  time: { ...Typography.heading1, color: Colors.leaf, marginBottom: 2 },
  date: { ...Typography.body, marginBottom: 2 },
  location: { ...Typography.body },
});

export default GreetingHeader;
