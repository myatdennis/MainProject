import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
  TextInput,
  Modal,
} from 'react-native';
import Animated, { FadeInDown, FadeOut, Layout } from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { Divider } from '@/components/ui/Divider';
import { loadAllTasks, saveAllTasks, StoredTask } from '@/lib/tasks';
import { colors, spacing } from '@/theme';

type TaskFilter = 'today' | 'upcoming' | 'all';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function makeId() { return `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

export function TasksScreen() {
  const today = todayStr();
  const [tasks, setTasks] = useState<StoredTask[]>(() => loadAllTasks());
  const [filter, setFilter] = useState<TaskFilter>('today');
  const [addVisible, setAddVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState(today);

  const reload = () => setTasks(loadAllTasks());

  const addTask = () => {
    if (!newTitle.trim()) return;
    const task: StoredTask = {
      id: makeId(),
      title: newTitle.trim(),
      status: 'active',
      dueDate: newDue || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synced: false,
    };
    const all = loadAllTasks();
    saveAllTasks([task, ...all]);
    setNewTitle('');
    setNewDue(today);
    setAddVisible(false);
    reload();
  };

  const toggle = (id: string) => {
    const all = loadAllTasks().map(t =>
      t.id === id
        ? { ...t, status: (t.status === 'active' ? 'done' : 'active') as StoredTask['status'], updatedAt: new Date().toISOString() }
        : t
    );
    saveAllTasks(all);
    reload();
  };

  const remove = (id: string) => {
    saveAllTasks(loadAllTasks().filter(t => t.id !== id));
    reload();
  };

  const filtered = tasks.filter(t => {
    if (filter === 'today') return t.dueDate === today && t.status === 'active';
    if (filter === 'upcoming') return (t.dueDate ?? '') > today && t.status === 'active';
    return t.status === 'active';
  });

  const doneTasks = filter === 'today'
    ? tasks.filter(t => t.dueDate === today && t.status === 'done')
    : [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TText variant="title">Tasks</TText>
        <Pressable onPress={() => setAddVisible(true)} style={styles.addBtn}>
          <TText style={styles.addIcon}>+</TText>
        </Pressable>
      </View>

      {/* Filter tabs */}
      <View style={styles.filters}>
        {(['today', 'upcoming', 'all'] as TaskFilter[]).map(f => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
          >
            <TText variant="small" style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </TText>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <View style={styles.empty}>
            <TText variant="body" color="secondary" style={styles.emptyText}>
              {filter === 'today' ? 'Nothing due today.' : 'All clear.'}
            </TText>
          </View>
        )}

        {filtered.map((task, i) => (
          <Animated.View
            key={task.id}
            entering={FadeInDown.duration(250).delay(i * 30)}
            exiting={FadeOut.duration(200)}
            layout={Layout.springify()}
          >
            <TaskRow task={task} onToggle={() => toggle(task.id)} onRemove={() => remove(task.id)} />
          </Animated.View>
        ))}

        {doneTasks.length > 0 && (
          <>
            <Divider />
            <TText variant="caption" color="secondary" style={styles.doneLabel}>Done today</TText>
            {doneTasks.map(task => (
              <TaskRow key={task.id} task={task} onToggle={() => toggle(task.id)} onRemove={() => remove(task.id)} />
            ))}
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={addVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setAddVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TText variant="heading">New Task</TText>
            <Pressable onPress={() => setAddVisible(false)}>
              <TText color="secondary">✕</TText>
            </Pressable>
          </View>
          <View style={styles.modalBody}>
            <TextInput
              style={styles.titleInput}
              placeholder="What needs doing?"
              placeholderTextColor={colors.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={addTask}
            />
            <View style={styles.dueRow}>
              <TText variant="caption" color="secondary">Due date</TText>
              <View style={styles.dueDateBtns}>
                {['Today', 'Tomorrow', 'Next week'].map((label, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() + (i === 0 ? 0 : i === 1 ? 1 : 7));
                  const ds = d.toISOString().slice(0, 10);
                  return (
                    <Pressable
                      key={label}
                      onPress={() => setNewDue(ds)}
                      style={[styles.dueDateBtn, newDue === ds && styles.dueDateBtnActive]}
                    >
                      <TText variant="small" style={newDue === ds ? styles.dueDateBtnTextActive : undefined}>
                        {label}
                      </TText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Pressable onPress={addTask} style={styles.createBtn} disabled={!newTitle.trim()}>
              <TText variant="medium" style={styles.createBtnText}>Add Task</TText>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function TaskRow({ task, onToggle, onRemove }: { task: StoredTask; onToggle: () => void; onRemove: () => void }) {
  const done = task.status === 'done';
  return (
    <View style={[styles.taskRow, done && styles.taskRowDone]}>
      <Pressable onPress={onToggle} style={[styles.check, done && styles.checkDone]} accessibilityLabel="Toggle task">
        {done && <TText style={styles.checkIcon}>✓</TText>}
      </Pressable>
      <View style={styles.taskMeta}>
        <TText variant="body" style={done ? styles.taskTitleDone : undefined}>{task.title}</TText>
        {task.dueDate && !done && (
          <TText variant="small" color="secondary">{formatDue(task.dueDate)}</TText>
        )}
      </View>
      <Pressable onPress={onRemove} style={styles.removeBtn} accessibilityLabel="Remove task">
        <TText variant="small" color="secondary">✕</TText>
      </Pressable>
    </View>
  );
}

function formatDue(date: string): string {
  const today = todayStr();
  if (date === today) return 'Today';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow';
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  addIcon: { color: '#fff', fontSize: 22, lineHeight: 26, fontWeight: '300' },
  filters: { flexDirection: 'row', paddingHorizontal: spacing[4], gap: spacing[2], marginBottom: spacing[2] },
  filterTab: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: 20, backgroundColor: colors.surfaceAlt },
  filterTabActive: { backgroundColor: colors.accent },
  filterText: { color: colors.textSecondary },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: 120, gap: spacing[2] },
  empty: { alignItems: 'center', paddingVertical: spacing[8] },
  emptyText: { fontStyle: 'italic' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.surface, borderRadius: 12, padding: spacing[3] },
  taskRowDone: { opacity: 0.55 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.accent },
  checkIcon: { color: '#fff', fontSize: 12, fontWeight: '700' },
  taskMeta: { flex: 1, gap: 2 },
  taskTitleDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  removeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  doneLabel: { textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10, fontWeight: '600', marginBottom: spacing[1] },
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalBody: { padding: spacing[4], gap: spacing[4] },
  titleInput: { fontSize: 18, color: colors.textPrimary, borderBottomWidth: 2, borderBottomColor: colors.accent, paddingVertical: spacing[2] },
  dueRow: { gap: spacing[2] },
  dueDateBtns: { flexDirection: 'row', gap: spacing[2] },
  dueDateBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: 10, borderWidth: 1.5, borderColor: colors.border },
  dueDateBtnActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}15` },
  dueDateBtnTextActive: { color: colors.accent, fontWeight: '600' },
  createBtn: { backgroundColor: colors.accent, borderRadius: 14, padding: spacing[4], alignItems: 'center', marginTop: spacing[2] },
  createBtnText: { color: '#fff' },
});
