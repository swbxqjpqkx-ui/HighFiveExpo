import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { getAdminTasksList } from '../../services/supabase';
import { AdminTask } from '../../types';

const C = {
  green50:  '#f0f6ef',
  green600: '#2a8a4d',
  green700: '#1d6e3a',
  text:     '#1a2418',
  muted:    '#6b7264',
  soft:     '#8e948a',
  border:   '#e4ebe2',
  borderSt: '#d3ddd0',
  red:      '#d94343',
  amber:    '#d99a1f',
  card:     '#ffffff',
  bg:       '#f5f9f3',
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
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  rowDone:     { opacity: 0.6 },
  checkbox:    { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: C.borderSt, alignItems: 'center', justifyContent: 'center' },
  checkboxDone:{ backgroundColor: C.green600, borderColor: C.green600 },
  checkMark:   { color: '#fff', fontSize: 12, fontWeight: '700' },
  body:        { flex: 1, gap: 2 },
  title:       { fontSize: 13, color: C.text, fontWeight: '500' },
  textDone:    { textDecorationLine: 'line-through', color: C.soft },
  due:         { fontSize: 11, color: C.soft },
  badge:       { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText:   { fontSize: 10, fontWeight: '700' },
  deleteBtn:   { padding: 4 },
  deleteText:  { fontSize: 14, color: C.soft },
});

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  content:      { padding: 20, paddingBottom: 40 },
  pageTitle:    { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 16 },
  tabs:         { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab:          { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  tabActive:    { backgroundColor: C.green600, borderColor: C.green600 },
  tabText:      { fontSize: 12, color: C.muted, fontWeight: '600' },
  tabTextActive:{ color: '#fff' },
  card:         { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 12 },
  empty:        { fontSize: 13, color: C.muted, textAlign: 'center', marginVertical: 30 },
  input:        { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: C.text, backgroundColor: C.bg, marginBottom: 12 },
  priorityRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  priorityLabel:{ fontSize: 12, color: C.muted, fontWeight: '600' },
  priorityBtn:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  priorityBtnText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  addBtn:       { backgroundColor: C.green600, borderRadius: 8, padding: 12, alignItems: 'center' },
  addBtnText:   { color: '#fff', fontSize: 13, fontWeight: '700' },
});

export default AdminTasksScreen;
