import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TText } from '@/components/ui/TText';
import { getRecoveryZone } from '@/types';
import { colors, spacing } from '@/theme';

interface WorkoutPlan {
  name: string;
  duration: number;
  isRest: boolean;
  isYoga: boolean;
  hasRehab: boolean;
}

interface WorkoutCardProps {
  recoveryScore: number;
  onStartWorkout?: () => void;
}

const WEEKLY_PLAN: Record<number, WorkoutPlan> = {
  0: { name: 'Full Rest', duration: 0, isRest: true, isYoga: false, hasRehab: false },
  1: { name: 'Upper Push + Shoulder Prep', duration: 50, isRest: false, isYoga: false, hasRehab: true },
  2: { name: 'Lower Body — Quad Dominant', duration: 45, isRest: false, isYoga: false, hasRehab: false },
  3: { name: 'Rest + Yoga', duration: 30, isRest: false, isYoga: true, hasRehab: false },
  4: { name: 'Upper Pull + Trap Release', duration: 50, isRest: false, isYoga: false, hasRehab: true },
  5: { name: 'Lower Body — Hinge Dominant', duration: 45, isRest: false, isYoga: false, hasRehab: false },
  6: { name: 'Yoga or Active Recovery', duration: 30, isRest: false, isYoga: true, hasRehab: false },
};

export function getWorkoutForToday(): WorkoutPlan {
  return WEEKLY_PLAN[new Date().getDay()] ?? WEEKLY_PLAN[0];
}

export function WorkoutCard({ recoveryScore, onStartWorkout }: WorkoutCardProps) {
  const zone = getRecoveryZone(recoveryScore);
  const workout = getWorkoutForToday();

  if (workout.isRest) {
    return (
      <Card style={styles.card}>
        <TText variant="medium">Rest day</TText>
        <TText variant="caption" color="secondary">
          Recovery is training too. Let your body absorb the work.
        </TText>
      </Card>
    );
  }

  if (workout.isYoga) {
    const yogaLabel = zone === 'low'
      ? 'Back care or gentle flow'
      : zone === 'moderate'
      ? 'Flow — 20–30 min'
      : 'Any style works today';

    return (
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 2 }}>
            <TText variant="medium">{workout.name}</TText>
            <TText variant="caption" color="secondary">{yogaLabel}</TText>
          </View>
          <TText style={styles.yogaIcon}>🧘</TText>
        </View>
        <TText variant="caption" color="secondary">
          Opens Yoga with Adriene when Sprint 6 lands.
        </TText>
      </Card>
    );
  }

  // Strength training day
  const modLabel = zone === 'low'
    ? 'Rehab only today'
    : zone === 'moderate'
    ? '−20% volume, same intensity'
    : 'Follow plan as written';

  const modColor = zone === 'low' ? colors.danger
    : zone === 'moderate' ? colors.warning
    : colors.success;

  // If low recovery, start button label changes
  const buttonLabel = zone === 'low' ? 'Start Rehab' : 'Start Workout';

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 3 }}>
          <TText variant="medium">{workout.name}</TText>
          <View style={styles.metaRow}>
            <TText variant="caption" color="secondary">
              Est. {zone === 'low' ? '20' : workout.duration} min
            </TText>
            {workout.hasRehab && (
              <View style={styles.rehabBadge}>
                <TText variant="small" style={styles.rehabText}>Rehab included</TText>
              </View>
            )}
          </View>
        </View>
        <View style={[styles.modPill, { backgroundColor: `${modColor}15` }]}>
          <TText variant="small" style={{ color: modColor }}>{modLabel}</TText>
        </View>
      </View>

      {zone === 'low' && (
        <View style={styles.lowRecoveryNote}>
          <TText variant="caption" style={{ color: colors.textSecondary, lineHeight: 18 }}>
            Upper back tight today — drop to 2 sets, focus on feel over reps.
          </TText>
        </View>
      )}

      <Button
        label={buttonLabel}
        onPress={onStartWorkout ?? (() => {})}
        size="md"
        fullWidth
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
    gap: spacing[3],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  rehabBadge: {
    backgroundColor: `${colors.rehab}20`,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 6,
  },
  rehabText: {
    color: colors.rehab,
    fontSize: 10,
  },
  modPill: {
    paddingHorizontal: spacing[2],
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: 140,
    overflow: 'hidden',
  },
  lowRecoveryNote: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: spacing[3],
    borderLeftWidth: 2,
    borderLeftColor: colors.rehab,
  },
  yogaIcon: {
    fontSize: 28,
  },
});
