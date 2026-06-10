import React, { useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { TText } from '@/components/ui/TText';
import { Card, PressableCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RecoveryRing } from '@/components/RecoveryRing';
import { Divider } from '@/components/ui/Divider';
import { BaselineBanner } from '@/components/health/BaselineBanner';
import { useHealth } from '@/hooks/useHealth';
import { getRecoveryZone, getRecoveryMessage } from '@/types';
import { colors, spacing } from '@/theme';

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
  const { today, baseline, isLoading } = useHealth();
  const [priorities, setPriorities] = useState<Priority[]>(INITIAL_PRIORITIES);
  const [briefExpanded, setBriefExpanded] = useState(false);

  const recoveryScore = today?.recoveryScore ?? 0;
  const zone = getRecoveryZone(recoveryScore);
  const stressInferred = today?.stressInferred ?? false;

  const today_ = new Date();
  const dateLabel = today_.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const hasAnyPriority = priorities.some((p) => p.text.trim());

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

  const coachMessage = stressInferred
    ? "Your nervous system is working hard today. Keep demands light."
    : getRecoveryMessage(zone);

  // Show score only if there's real data or baseline is being built with placeholder
  const displayScore = (today || !isLoading) ? recoveryScore : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.header}>
          <TText variant="title">{getGreeting()}</TText>
          <TText variant="caption" color="secondary">{dateLabel}</TText>
        </View>

        {/* Baseline notice */}
        {!baseline.isReliable && baseline.daysOfData > 0 && (
          <BaselineBanner daysOfData={baseline.daysOfData} />
        )}

        {/* Recovery Ring */}
        <View style={styles.ringSection}>
          {isLoading && !today ? (
            <View style={styles.ringPlaceholder}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <RecoveryRing score={displayScore} size={180} showScore showMessage={false} />
          )}
          <TText variant="body" style={styles.coachMessage}>{coachMessage}</TText>
          {stressInferred && (
            <TText variant="caption" style={styles.stressNote}>
              HRV + resting HR signal elevated stress
            </TText>
          )}
        </View>

        {/* Top 3 Priorities */}
        <View style={styles.section}>
          <TText variant="caption" style={styles.sectionLabel}>Top 3</TText>
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
          <TText variant="caption" style={styles.sectionLabel}>Today's Workout</TText>
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

// ─── Sub-components ───────────────────────────────────────────────────────────

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
      <TText variant="mono" color="secondary" style={styles.priorityNumber}>{number}</TText>
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
  const workout = getWorkoutForToday();
  const modLabel = zone === 'low' ? 'Rehab only'
    : zone === 'moderate' ? '−20% volume'
    : 'As written';
  const modColor = zone === 'low' ? colors.danger
    : zone === 'moderate' ? colors.warning
    : colors.success;

  if (workout.isRest) {
    return (
      <Card style={styles.workoutCard}>
        <TText variant="medium" color="secondary">Rest day</TText>
        <TText variant="caption" color="secondary">
          Recovery is training too. Let your body absorb the work.
        </TText>
      </Card>
    );
  }

  return (
    <Card style={styles.workoutCard}>
      <View style={styles.workoutHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <TText variant="medium">{workout.name}</TText>
          <TText variant="caption" color="secondary">Est. {workout.duration} min</TText>
        </View>
        <View style={[styles.modPill, { backgroundColor: `${modColor}15` }]}>
          <TText variant="small" style={{ color: modColor }}>{modLabel}</TText>
        </View>
      </View>
      <Button label="Start Workout" onPress={() => {}} size="md" fullWidth />
    </Card>
  );
}

function DailyBrief() {
  return (
    <View style={styles.brief}>
      <TText variant="body" color="secondary">No open tasks today.</TText>
      <TText variant="body" color="secondary" style={{ marginTop: spacing[2] }}>
        Set your Top 3 to anchor the day.
      </TText>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function getWorkoutForToday() {
  const day = new Date().getDay();
  const plan: Record<number, { name: string; duration: number; isRest: boolean }> = {
    1: { name: 'Upper Push + Shoulder Prep', duration: 50, isRest: false },
    2: { name: 'Lower Body — Quad Dominant', duration: 45, isRest: false },
    3: { name: 'Rest + Yoga', duration: 30, isRest: false },
    4: { name: 'Upper Pull + Trap Release', duration: 50, isRest: false },
    5: { name: 'Lower Body — Hinge Dominant', duration: 45, isRest: false },
    6: { name: 'Yoga or Active Recovery', duration: 30, isRest: false },
    0: { name: 'Full Rest', duration: 0, isRest: true },
  };
  return plan[day] ?? plan[0];
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
  ringPlaceholder: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachMessage: {
    textAlign: 'center',
    color: colors.textSecondary,
    maxWidth: 280,
  },
  stressNote: {
    color: colors.warning,
    textAlign: 'center',
  },
  section: {
    gap: spacing[3],
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emptyPrompt: {
    fontStyle: 'italic',
  },
  priorities: {
    gap: spacing[1],
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 48,
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
    padding: spacing[4],
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  modPill: {
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: 8,
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
