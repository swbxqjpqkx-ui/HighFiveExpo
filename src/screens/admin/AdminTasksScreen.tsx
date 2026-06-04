import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { getAdminTasksList } from '../../services/supabase';
import { AdminTask } from '../../types';
import { Green, Ink, Tint } from '../../theme';

const C = {
  green50:  Green[50],
  green600: Green[600],
  green700: Green[700],
  text:     Ink.base,
  muted:    Ink[3],
  soft:     Ink[4],
  border:   Ink.line,
  borderSt: Ink.line2,
  red:      Tint.rose.ink,
  amber:    Tint.sun.ink,
  card:     Ink.surface,
  bg:       Ink.bg,
};

const priorityColor: Record<string, string> = {
  high:   C.red,
  medium: C.amber,
  low:    C.green600,
};

type FilterType = 'all' | 'pending' | 'completed';

const AdminTasksScreen: React.FC = () => {
  const [tasks, setTasks]   = useState<AdminTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [newTask, setNewTask] = useState('');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');

  useEffect(() => {
    getAdminTasksList()
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(prev => [...prev, {
      id: `t${Date.now()}`,
      title: newTask.trim(),
      due: 'No due date',
      priority: newPriority,
      completed: false,
    }]);
    setNewTask('');
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const filtered = tasks.filter(t => {
    if (filter === 'pending')   return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const pending   = filtered.filter(t => !t.completed);
  const completed = filtered.filter(t => t.completed);

  const TaskRow: React.FC<{ task: AdminTask }> = ({ task }) => (
    <View style={[ts.row, task.completed && ts.rowDone]}>
      <TouchableOpacity onPress={() => toggle(task.id)} style={[ts.checkbox, task.completed && ts.checkboxDone]}>
        {task.completed && <Text style={ts.checkMark}>✓</Text>}
      </TouchableOpacity>
      <View style={ts.body}>
        <Text style={[ts.title, task.completed && ts.textDone]}>{task.title}</Text>
        <Text style={ts.due}>{task.due}</Text>
      </View>
      <View style={[ts.badge, { backgroundColor: priorityColor[task.priority] + '20' }]}>
        <Text style={[ts.badgeText, { color: priorityColor[task.priority] }]}>
          {task.priority.toUpperCase()}
        </Text>
      </View>
      <TouchableOpacity onPress={() => deleteTask(task.id)} style={ts.deleteBtn}>
        <Text style={ts.deleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Tasks</Text>

      {/* Filter tabs */}
      <View style={s.tabs}>
        {(['all', 'pending', 'completed'] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.tab, filter === f && s.tabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.tabText, filter === f && s.tabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.green600} style={{ marginVertical: 30 }} />
      ) : (
        <>
          {/* Pending section */}
          {(filter === 'all' || filter === 'pending') && pending.length > 0 && (
            <View style={s.card}>
              <Text style={s.sectionTitle}>Pending ({pending.length})</Text>
              {pending.map(t => <TaskRow key={t.id} task={t} />)}
            </View>
          )}

          {/* Completed section */}
          {(filter === 'all' || filter === 'completed') && completed.length > 0 && (
            <View style={[s.card, { opacity: 0.75 }]}>
              <Text style={s.sectionTitle}>Completed ({completed.length})</Text>
              {completed.map(t => <TaskRow key={t.id} task={t} />)}
            </View>
          )}

          {filtered.length === 0 && (
            <Text style={s.empty}>No tasks found.</Text>
          )}
        </>
      )}

      {/* Add task */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Add New Task</Text>
        <TextInput
          style={s.input}
          value={newTask}
          onChangeText={setNewTask}
          placeholder="Task title..."
          placeholderTextColor={C.soft}
          onSubmitEditing={addTask}
          returnKeyType="done"
        />
        {/* Priority picker */}
        <View style={s.priorityRow}>
          <Text style={s.priorityLabel}>Priority:</Text>
          {(['high', 'medium', 'low'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={[s.priorityBtn, newPriority === p && { backgroundColor: priorityColor[p] + '25', borderColor: priorityColor[p] }]}
              onPress={() => setNewPriority(p)}
            >
              <Text style={[s.priorityBtnText, newPriority === p && { color: priorityColor[p] }]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.addBtn} onPress={addTask}>
          <Text style={s.addBtnText}>+ Add Task</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const ts = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  rowDone:     { opacity: 0.6 },
  checkbox:    { width: 20, height: 20, borderRadius: 6, borderWidth: 1.6, borderColor: C.borderSt, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkboxDone:{ backgroundColor: Green[500], borderColor: Green[500] },
  checkMark:   { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: 11 },
  body:        { flex: 1, gap: 3 },
  title:       { fontFamily: 'Montserrat-SemiBold', fontSize: 13, color: C.text, lineHeight: 18 },
  textDone:    { textDecorationLine: 'line-through', color: C.soft },
  due:         { fontFamily: 'Montserrat-Medium', fontSize: 11, color: C.soft },
  badge:       { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText:   { fontFamily: 'Montserrat-ExtraBold', fontSize: 9.5, letterSpacing: 0.6 },
  deleteBtn:   { padding: 4 },
  deleteText:  { fontFamily: 'Montserrat-Medium', fontSize: 14, color: C.soft },
});

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  content:      { padding: 20, paddingBottom: 40 },
  pageTitle:    { fontFamily: 'Montserrat-Bold', fontSize: 22, color: C.text, marginBottom: 16, letterSpacing: -0.5 },
  tabs:         { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab:          { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  tabActive:    { backgroundColor: Green[700], borderColor: Green[700] },
  tabText:      { fontFamily: 'Montserrat-SemiBold', fontSize: 12, color: C.muted },
  tabTextActive:{ color: '#fff' },
  card:         { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 22, marginBottom: 18 },
  sectionTitle: { fontFamily: 'Montserrat-Bold', fontSize: 15, color: C.text, marginBottom: 14, letterSpacing: -0.1 },
  empty:        { fontFamily: 'Montserrat-Medium', fontSize: 13, color: C.muted, textAlign: 'center', marginVertical: 30 },
  input:        { borderWidth: 1, borderColor: C.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Montserrat-Medium', fontSize: 13, color: C.text, backgroundColor: '#fafcfa', marginBottom: 12 },
  priorityRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  priorityLabel:{ fontFamily: 'Montserrat-SemiBold', fontSize: 12, color: C.muted },
  priorityBtn:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  priorityBtnText: { fontFamily: 'Montserrat-SemiBold', fontSize: 12, color: C.muted },
  addBtn:       { backgroundColor: Green[700], borderRadius: 10, padding: 13, alignItems: 'center' },
  addBtnText:   { fontFamily: 'Montserrat-Bold', color: '#fff', fontSize: 13 },
});

export default AdminTasksScreen;
