import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Task } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface Props {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

const TaskTracker: React.FC<Props> = ({ tasks, onTasksChange }) => {
  const [input, setInput] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const addTask = () => {
    if (!input.trim()) return;
    const newTask: Task = {
      id: Date.now().toString(),
      title: input.trim(),
      completed: false,
      created_at: new Date().toISOString().split('T')[0],
    };
    onTasksChange([...tasks, newTask]);
    setInput('');
  };

  const toggleTask = (id: string) =>
    onTasksChange(tasks.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)));

  const saveEdit = (id: string) => {
    onTasksChange(tasks.map(t => (t.id === id ? { ...t, title: editText } : t)));
    setEditId(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Task Tracker</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Add a new task..."
          placeholderTextColor={Colors.inkLight}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={addTask}
        />
        <TouchableOpacity style={styles.addBtn} onPress={addTask}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={tasks}
        keyExtractor={t => t.id}
        scrollEnabled={false}
        renderItem={({ item }) =>
          editId === item.id ? (
            <View style={styles.taskRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={editText}
                onChangeText={setEditText}
                onSubmitEditing={() => saveEdit(item.id)}
                autoFocus
              />
              <TouchableOpacity onPress={() => saveEdit(item.id)} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.taskRow, item.completed && styles.taskDone]}>
              <TouchableOpacity onPress={() => toggleTask(item.id)} style={styles.checkbox}>
                <Text>{item.completed ? '✅' : '⬜'}</Text>
              </TouchableOpacity>
              <Text style={[styles.taskText, item.completed && styles.taskTextDone]}>{item.title}</Text>
              <TouchableOpacity onPress={() => { setEditId(item.id); setEditText(item.title); }}>
                <Text style={styles.editBtn}>✏️</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { ...Typography.heading2, marginBottom: Spacing.sm },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  input: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 8, ...Typography.body, color: Colors.ink,
  },
  addBtn: { backgroundColor: Colors.leaf, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  addBtnText: { ...Typography.label, color: Colors.white, textTransform: 'none' },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: Spacing.sm },
  taskDone: { opacity: 0.45 },
  checkbox: { width: 24 },
  taskText: { flex: 1, ...Typography.body, color: Colors.ink, fontSize: 13 },
  taskTextDone: { textDecorationLine: 'line-through' },
  editBtn: { fontSize: 14 },
  saveBtn: { backgroundColor: Colors.forest, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  saveBtnText: { ...Typography.label, color: Colors.white, textTransform: 'none', fontSize: 12 },
});

export default TaskTracker;
