import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import {
  loadGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  addMilestone,
  toggleMilestone,
  getGoalProgress,
  Goal,
} from '@/lib/goals';
import { colors, spacing } from '@/theme';

const CATEGORIES: Goal['category'][] = ['business', 'health', 'personal', 'learning'];
const CAT_COLORS: Record<Goal['category'], string> = {
  business: colors.accent,
  health: colors.success,
  personal: '#F59E0B',
  learning: '#A78BFA',
};
const CAT_EMOJI: Record<Goal['category'], string> = {
  business: '⚡', health: '💪', personal: '🌱', learning: '📚',
};

export function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>(() => loadGoals().filter(g => !g.archived));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addVisible, setAddVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Goal['category']>('business');
  const [milestoneInputs, setMilestoneInputs] = useState<Record<string, string>>({});

  const reload = () => setGoals(loadGoals().filter(g => !g.archived));

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createGoal(newTitle.trim(), newCategory);
    setNewTitle('');
    setAddVisible(false);
    reload();
  };

  const handleComplete = (id: string) => {
    updateGoal(id, { completedAt: new Date().toISOString() });
    reload();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete goal?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteGoal(id); reload(); } },
    ]);
  };

  const handleAddMilestone = (goalId: string) => {
    const text = milestoneInputs[goalId]?.trim();
    if (!text) return;
    addMilestone(goalId, text);
    setMilestoneInputs(prev => ({ ...prev, [goalId]: '' }));
    reload();
  };

  const activeGoals = goals.filter(g => !g.completedAt);
  const completedGoals = goals.filter(g => !!g.completedAt);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TText variant="title">Goals</TText>
          <Pressable onPress={() => setAddVisible(true)} style={styles.addBtn}>
            <TText style={styles.addIcon}>+</TText>
          </Pressable>
        </View>

        {activeGoals.length === 0 && (
          <View style={styles.empty}>
            <TText variant="body" color="secondary" style={styles.emptyText}>
              What are you building toward?
            </TText>
          </View>
        )}

        {activeGoals.map((goal, i) => {
          const progress = getGoalProgress(goal);
          const color = CAT_COLORS[goal.category];
          const isOpen = expanded === goal.id;

          return (
            <Animated.View key={goal.id} entering={FadeInDown.duration(300).delay(i * 40)} layout={Layout.springify()}>
              <Pressable
                onPress={() => setExpanded(isOpen ? null : goal.id)}
                style={[styles.goalCard, { borderLeftColor: color }]}
              >
                <View style={styles.goalHeader}>
                  <TText style={styles.goalEmoji}>{CAT_EMOJI[goal.category]}</TText>
                  <View style={styles.goalMeta}>
                    <TText variant="medium">{goal.title}</TText>
                    {goal.milestones.length > 0 && (
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
                      </View>
                    )}
                  </View>
                  <TText variant="caption" color="secondary">
                    {isOpen ? '▾' : '▸'}
                  </TText>
                </View>

                {isOpen && (
                  <View style={styles.milestones}>
                    {goal.milestones.map(ms => (
                      <Pressable
                        key={ms.id}
                        onPress={() => { toggleMilestone(goal.id, ms.id); reload(); }}
                        style={styles.milestoneRow}
                      >
                        <View style={[styles.msDot, ms.completed && { backgroundColor: color }]} />
                        <TText variant="body" style={ms.completed ? styles.msDone : undefined}>
                          {ms.title}
                        </TText>
                      </Pressable>
                    ))}

                    <View style={styles.addMsRow}>
                      <TextInput
                        style={styles.msInput}
                        placeholder="Add milestone…"
                        placeholderTextColor={colors.textSecondary}
                        value={milestoneInputs[goal.id] ?? ''}
                        onChangeText={v => setMilestoneInputs(p => ({ ...p, [goal.id]: v }))}
                        returnKeyType="done"
                        onSubmitEditing={() => handleAddMilestone(goal.id)}
                      />
                    </View>

                    <View style={styles.goalActions}>
                      <Pressable onPress={() => handleComplete(goal.id)} style={styles.completeBtn}>
                        <TText variant="small" style={{ color: color }}>Mark complete</TText>
                      </Pressable>
                      <Pressable onPress={() => handleDelete(goal.id)} style={styles.deleteBtn}>
                        <TText variant="small" color="secondary">Delete</TText>
                      </Pressable>
                    </View>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}

        {completedGoals.length > 0 && (
          <>
            <Divider />
            <TText variant="caption" color="secondary" style={styles.completedLabel}>
              Completed ({completedGoals.length})
            </TText>
            {completedGoals.map(goal => (
              <View key={goal.id} style={[styles.goalCard, styles.goalCardDone]}>
                <TText variant="body" color="secondary" style={styles.goalDoneText}>
                  ✓ {goal.title}
                </TText>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* New goal modal */}
      <Modal visible={addVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setAddVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TText variant="heading">New Goal</TText>
            <Pressable onPress={() => setAddVisible(false)}>
              <TText color="secondary">✕</TText>
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            <TextInput
              style={styles.titleInput}
              placeholder="What are you building?"
              placeholderTextColor={colors.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />

            <TText variant="caption" color="secondary" style={styles.catLabel}>Category</TText>
            <View style={styles.catRow}>
              {CATEGORIES.map(cat => (
                <Pressable
                  key={cat}
                  onPress={() => setNewCategory(cat)}
                  style={[styles.catBtn, newCategory === cat && { backgroundColor: `${CAT_COLORS[cat]}20`, borderColor: CAT_COLORS[cat] }]}
                >
                  <TText style={styles.catEmoji}>{CAT_EMOJI[cat]}</TText>
                  <TText variant="small" style={newCategory === cat ? { color: CAT_COLORS[cat] } : undefined}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </TText>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={handleCreate} style={styles.createBtn} disabled={!newTitle.trim()}>
              <TText variant="medium" style={styles.createBtnText}>Create Goal</TText>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing[4], paddingBottom: 120, gap: spacing[3] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing[2], marginBottom: spacing[2] },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  addIcon: { color: '#fff', fontSize: 22, lineHeight: 26, fontWeight: '300' },
  empty: { alignItems: 'center', paddingVertical: spacing[8] },
  emptyText: { fontStyle: 'italic', textAlign: 'center' },
  goalCard: { backgroundColor: colors.surface, borderRadius: 14, padding: spacing[4], gap: spacing[3], borderLeftWidth: 4, borderLeftColor: colors.accent },
  goalCardDone: { opacity: 0.6, borderLeftColor: colors.border },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  goalEmoji: { fontSize: 22 },
  goalMeta: { flex: 1, gap: spacing[1] },
  progressBar: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  milestones: { gap: spacing[2] },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[1] },
  msDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.border },
  msDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  addMsRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing[2] },
  msInput: { fontSize: 15, color: colors.textPrimary, paddingVertical: spacing[1] },
  goalActions: { flexDirection: 'row', gap: spacing[3], justifyContent: 'flex-end' },
  completeBtn: { paddingVertical: spacing[1], paddingHorizontal: spacing[2] },
  deleteBtn: { paddingVertical: spacing[1], paddingHorizontal: spacing[2] },
  goalDoneText: { textDecorationLine: 'line-through' },
  completedLabel: { textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10, fontWeight: '600' },
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalBody: { padding: spacing[4], gap: spacing[4] },
  titleInput: { fontSize: 18, color: colors.textPrimary, borderBottomWidth: 2, borderBottomColor: colors.accent, paddingVertical: spacing[2] },
  catLabel: { textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10, fontWeight: '600' },
  catRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  catBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', gap: 2 },
  catEmoji: { fontSize: 20 },
  createBtn: { backgroundColor: colors.accent, borderRadius: 14, padding: spacing[4], alignItems: 'center', marginTop: spacing[2] },
  createBtnText: { color: '#fff' },
});
