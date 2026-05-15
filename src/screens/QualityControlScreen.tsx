import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import QualityControlPanel from '../components/QualityControlPanel';
import { Course, ApprovalRequest, Notification } from '../types';
import { mockApprovals, mockNotifications } from '../mock';
import { Colors, Typography, Spacing } from '../theme';

interface Props {
  courses: Course[];
  onNewNotification: (n: Notification) => void;
}

const QualityControlScreen: React.FC<Props> = ({ courses, onNewNotification }) => {
  const handleSendApproval = (courseAId: string, courseBId: string) => {
    const approval: ApprovalRequest = {
      id: Date.now().toString(),
      course_id_a: courseAId,
      course_id_b: courseBId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    mockApprovals.push(approval);

    const notification: Notification = {
      id: Date.now().toString(),
      message: 'Your quality control comparison was sent to the administrator for approval.',
      type: 'approval_sent',
      read: false,
      created_at: new Date().toISOString(),
    };
    onNewNotification(notification);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Quality Control</Text>
      <QualityControlPanel courses={courses} onSendApproval={handleSendApproval} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.mist },
  content: { padding: Spacing.lg },
  title: { ...Typography.display, marginBottom: Spacing.lg },
});

export default QualityControlScreen;
