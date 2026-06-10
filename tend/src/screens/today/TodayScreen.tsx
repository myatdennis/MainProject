import React, { useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { TText } from '@/components/ui/TText';
import { Card, PressableCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RecoveryRing } from '@/components/RecoveryRing';
import { Divider } from '@/components/ui/Divider';
import { colors, spacing } from '@/theme';
import { getRecoveryZone, getRecoveryMessage } from '@/types';

// Placeholder recovery data — replaced by HealthKit in Sprint 2
const MOCK_RECOVERY = 74;

interface Priority {
  id: string;
  text: string;
  done: boolean;
}

const INITIAL_PRIORITIES: Priority[] = [
  { id: '1', text: '', done: false },
  { id: '2', text: '', done: false },
  { id: '3', text: '', done: false },
];

export function TodayScreen() {
  const [priorities, setPriorities] = useState<Priority[]>(INITIAL_PRIORITIES);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const recoveryScore = MOCK_RECOVERY;
  const zone = getRecoveryZone(recoveryScore);

  const today = new Date();
  const greeting = getGreeting();
  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  function togglePriority(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPriorities((prev) =>
      prev.map((p) => (p.id === id ? { ...p, done: !p.done } : p)),
    );
  }

  function updatePriorityText(id: string, text: string) {
    setPriorities((prev) =>
      prev.map((p) => (p.id === id ? { ...p, text } : p)),
    );
  }

  const hasAnyPriority = priorities.some((p) => p.text.trim());

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.header}>
          <TText variant="title">{greeting}</TText>
          <TText variant="caption" color="secondary">{dateLabel}</TText>
        </View>

        {/* Recovery Ring */}
        <View style={styles.ringSection}>
          <RecoveryRing score={recoveryScore} size={180} showScore showMessage={false} />
          <TText variant="body" style={styles.coachMessage}>
            {getRecoveryMessage(zone)}
          </TText>
        </View>

        {/* Top 3 Priorities */}
        <View style={styles.section}>
          <TText variant="heading" style={styles.sectionLabel}>Top 3</TText>
          {!hasAnyPriority && (
            <TText variant="body" color="secondary" style={styles.emptyPrompt}>
              What's one thing that would make today feel complete?
            </TText>
          )}
          <View style={styles.priorities}>
            {priorities.map((p, i) => (
              <PriorityRow
                key={p.id}
                number={i + 1}
                priority={p}
                onToggle={() => togglePriority(p.id)}
                onChangeText={(t) => updatePriorityText(p.id, t)}
              />
            ))}
          </View>
        </View>

        <Divider />

        {/* Today's Workout */}
        <View style={styles.section}>
          <TText variant="heading" style={styles.sectionLabel}>Today's Workout</TText>
          <WorkoutCard recoveryScore={recoveryScore} />
        </View>

        <Divider />

        {/* Daily Brief */}
        <View style={styles.section}>
          <Pressable
            onPress={() => setBriefExpanded((e) => !e)}
            style={styles.briefHeader}
            accessibilityLabel="Toggle daily brief"
            accessibilityRole="button"
          >
            <TText variant="heading">Daily Brief</TText>
            <TText variant="body" color="secondary">{briefExpanded ? '▾' : '▸'}</TText>
          </Pressable>
          {briefExpanded && <DailyBrief />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PriorityRow({
  number,
  priority,
  onToggle,
  onChangeText,
}: {
  number: number;
  priority: Priority;
  onToggle: () => void;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={styles.priorityRow}>
      <Pressable
        onPress={onToggle}
        style={[styles.priorityCheck, priority.done && styles.priorityCheckDone]}
        accessibilityLabel={priority.done ? 'Mark incomplete' : 'Mark complete'}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: priority.done }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {priority.done && <TText style={styles.checkmark}>✓</TText>}
      </Pressable>
      <TText variant="mono" color="secondary" style={styles.priorityNumber}>
        {number}
      </TText>
      <TextInput
        style={[styles.priorityInput, priority.done && styles.priorityTextDone]}
        placeholder="Add a priority…"
        placeholderTextColor={colors.textSecondary}
        value={priority.text}
        onChangeText={onChangeText}
        returnKeyType="next"
        accessibilityLabel={`Priority ${number}`}
      />
    </View>
  );
}

function WorkoutCard({ recoveryScore }: { recoveryScore: number }) {
  const zone = getRecoveryZone(recoveryScore);
  const workout = getWorkoutForToday(zone);

  return (
    <Card style={styles.workoutCard}>
      <View style={styles.workoutHeader}>
        <View>
          <TText variant="medium">{workout.name}</TText>
          <TText variant="caption" color="secondary">Est. {workout.duration} min</TText>
        </View>
        <TText variant="caption" color="secondary" style={styles.workoutMod}>
          {zone === 'low' ? 'Rehab only' : zone === 'moderate' ? '−20% volume' : 'As written'}
        </TText>
      </View>
      <Button label="Start Workout" onPress={() => {}} size="md" fullWidth />
    </Card>
  );
}

function DailyBrief() {
  return (
    <View style={styles.brief}>
      <TText variant="body" color="secondary">No open tasks for today.</TText>
      <TText variant="body" color="secondary" style={{ marginTop: spacing[2] }}>
        Take a moment to set your Top 3.
      </TText>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getWorkoutForToday(zone: ReturnType<typeof getRecoveryZone>) {
  const day = new Date().getDay(); // 0 Sun, 1 Mon…
  const plans: Record<number, { name: string; duration: number }> = {
    1: { name: 'Upper Push + Shoulder Prep', duration: 50 },
    2: { name: 'Lower Body — Quad Dominant', duration: 45 },
    3: { name: 'Rest + Yoga', duration: 30 },
    4: { name: 'Upper Pull + Trap Release', duration: 50 },
    5: { name: 'Lower Body — Hinge Dominant', duration: 45 },
    6: { name: 'Yoga or Active Recovery', duration: 30 },
    0: { name: 'Full Rest', duration: 0 },
  };
  return plans[day] ?? plans[0];
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing[4],
    paddingBottom: 120,
    gap: spacing[6],
  },
  header: {
    gap: spacing[1],
    paddingTop: spacing[2],
  },
  ringSection: {
    alignItems: 'center',
    gap: spacing[3],
  },
  coachMessage: {
    textAlign: 'center',
    color: colors.textSecondary,
    maxWidth: 280,
  },
  section: {
    gap: spacing[3],
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emptyPrompt: {
    fontStyle: 'italic',
  },
  priorities: {
    gap: spacing[2],
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 48,
    paddingVertical: spacing[1],
  },
  priorityCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityCheckDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 14,
  },
  priorityNumber: {
    width: 16,
    textAlign: 'right',
  },
  priorityInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 44,
    paddingVertical: spacing[2],
  },
  priorityTextDone: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  workoutCard: {
    gap: spacing[4],
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workoutMod: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  briefHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  brief: {
    padding: spacing[3],
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
  },
});
