import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
  TextInput,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { Divider } from '@/components/ui/Divider';
import {
  getActiveHabitsForDate,
  createHabit,
  archiveHabit,
  toggleCompletion,
  isCompleted,
  HABIT_TEMPLATES,
  Habit,
} from '@/lib/habits';
import { colors, spacing } from '@/theme';

export function HabitsScreen() {
  const today = new Date().toISOString().slice(0, 10);
  const [habits, setHabits] = useState<Habit[]>(() => getActiveHabitsForDate(today));
  const [addVisible, setAddVisible] = useState(false);
  const [completions, setCompletions] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(getActiveHabitsForDate(today).map(h => [h.id, isCompleted(h.id, today)]))
  );
  const [customTitle, setCustomTitle] = useState('');
  const [customEmoji, setCustomEmoji] = useState('✦');

  const reload = () => {
    const active = getActiveHabitsForDate(today);
    setHabits(active);
    setCompletions(Object.fromEntries(active.map(h => [h.id, isCompleted(h.id, today)])));
  };

  const handleToggle = (id: string) => {
    toggleCompletion(id, today);
    setCompletions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddTemplate = (template: typeof HABIT_TEMPLATES[0]) => {
    createHabit(template.title, template.emoji, template.category);
    setAddVisible(false);
    reload();
  };

  const handleAddCustom = () => {
    if (!customTitle.trim()) return;
    createHabit(customTitle.trim(), customEmoji, 'custom');
    setCustomTitle('');
    setAddVisible(false);
    reload();
  };

  const handleArchive = (id: string) => {
    archiveHabit(id);
    reload();
  };

  const doneCount = Object.values(completions).filter(Boolean).length;
  const total = habits.length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <TText variant="title">Habits</TText>
            {total > 0 && (
              <TText variant="caption" color="secondary">
                {doneCount}/{total} today
              </TText>
            )}
          </View>
          <Pressable onPress={() => setAddVisible(true)} style={styles.addBtn}>
            <TText style={styles.addIcon}>+</TText>
          </Pressable>
        </View>

        {habits.length === 0 ? (
          <View style={styles.empty}>
            <TText variant="body" color="secondary" style={styles.emptyText}>
              Small daily actions compound.{'\n'}Add your first habit.
            </TText>
            <Pressable onPress={() => setAddVisible(true)} style={styles.emptyBtn}>
              <TText variant="small" style={styles.emptyBtnText}>Add habit</TText>
            </Pressable>
          </View>
        ) : (
          habits.map((habit, i) => (
            <Animated.View key={habit.id} entering={FadeInDown.duration(300).delay(i * 40)}>
              <HabitRow
                habit={habit}
                done={completions[habit.id] ?? false}
                onToggle={() => handleToggle(habit.id)}
                onArchive={() => handleArchive(habit.id)}
              />
            </Animated.View>
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={addVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setAddVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TText variant="heading">Add Habit</TText>
            <Pressable onPress={() => setAddVisible(false)}>
              <TText color="secondary">✕</TText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <TText variant="caption" color="secondary" style={styles.sectionLabel}>Quick add</TText>
            {HABIT_TEMPLATES.map(t => (
              <Pressable key={t.title} onPress={() => handleAddTemplate(t)} style={styles.templateRow}>
                <TText style={styles.templateEmoji}>{t.emoji}</TText>
                <TText variant="body">{t.title}</TText>
                <TText style={styles.templatePlus}>+</TText>
              </Pressable>
            ))}

            <Divider />

            <TText variant="caption" color="secondary" style={styles.sectionLabel}>Custom</TText>
            <View style={styles.customRow}>
              <TextInput
                style={styles.emojiInput}
                value={customEmoji}
                onChangeText={setCustomEmoji}
                maxLength={2}
              />
              <TextInput
                style={styles.customInput}
                placeholder="Habit name…"
                placeholderTextColor={colors.textSecondary}
                value={customTitle}
                onChangeText={setCustomTitle}
                returnKeyType="done"
                onSubmitEditing={handleAddCustom}
              />
            </View>
            {customTitle.trim().length > 0 && (
              <Pressable onPress={handleAddCustom} style={styles.createBtn}>
                <TText variant="medium" style={styles.createBtnText}>Add "{customTitle.trim()}"</TText>
              </Pressable>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function HabitRow({ habit, done, onToggle, onArchive }: {
  habit: Habit; done: boolean; onToggle: () => void; onArchive: () => void;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(1.12, { damping: 6, stiffness: 400 }, () => {
      scale.value = withSpring(1, { damping: 10 });
    });
    onToggle();
  };

  return (
    <Animated.View style={[styles.habitRow, done && styles.habitRowDone, anim]}>
      <Pressable onPress={handlePress} style={[styles.habitCheck, done && styles.habitCheckDone]}>
        <TText style={[styles.habitEmoji, done && styles.habitEmojiDone]}>{habit.emoji}</TText>
      </Pressable>
      <TText variant="body" style={[styles.habitTitle, done && styles.habitTitleDone]}>
        {habit.title}
      </TText>
      <Pressable onPress={onArchive} style={styles.archiveBtn} accessibilityLabel="Remove habit">
        <TText variant="small" color="secondary">···</TText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing[4], paddingBottom: 120, gap: spacing[2] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing[2], marginBottom: spacing[3] },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  addIcon: { color: '#fff', fontSize: 22, lineHeight: 26, fontWeight: '300' },
  empty: { alignItems: 'center', paddingVertical: spacing[8], gap: spacing[4] },
  emptyText: { fontStyle: 'italic', textAlign: 'center', lineHeight: 26 },
  emptyBtn: { backgroundColor: `${colors.accent}15`, paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: 20 },
  emptyBtnText: { color: colors.accent, fontWeight: '600' },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.surface, borderRadius: 14, padding: spacing[3] },
  habitRowDone: { backgroundColor: `${colors.success}08` },
  habitCheck: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  habitCheckDone: { borderColor: colors.success, backgroundColor: `${colors.success}15` },
  habitEmoji: { fontSize: 22 },
  habitEmojiDone: { opacity: 0.7 },
  habitTitle: { flex: 1, fontSize: 16 },
  habitTitleDone: { color: colors.textSecondary },
  archiveBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalBody: { padding: spacing[4], gap: spacing[3] },
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10, fontWeight: '600' },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  templateEmoji: { fontSize: 22, width: 32 },
  templatePlus: { fontSize: 22, color: colors.accent, marginLeft: 'auto' },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  emojiInput: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.surfaceAlt, textAlign: 'center', fontSize: 22 },
  customInput: { flex: 1, fontSize: 16, color: colors.textPrimary, borderBottomWidth: 2, borderBottomColor: colors.accent, paddingVertical: spacing[2] },
  createBtn: { backgroundColor: colors.accent, borderRadius: 14, padding: spacing[3], alignItems: 'center' },
  createBtnText: { color: '#fff' },
});
