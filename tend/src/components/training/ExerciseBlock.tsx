import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { TText } from '@/components/ui/TText';
import { SetRow } from './SetRow';
import { colors, spacing } from '@/theme';
import type { Exercise, ExerciseLog, LoggedSet } from '@/lib/training';

interface ExerciseBlockProps {
  exercise: Exercise;
  log: ExerciseLog;
  isActive: boolean;
  onUpdateSet: (setIndex: number, updates: Partial<LoggedSet>) => void;
  onCompleteSet: (setIndex: number) => void;
  onAddSet: () => void;
  onPress: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  push: '#5B6AF0',
  pull: '#4CAF82',
  legs: '#E05252',
  rehab: '#A78BFA',
  core: '#F59E0B',
};

export function ExerciseBlock({
  exercise,
  log,
  isActive,
  onUpdateSet,
  onCompleteSet,
  onAddSet,
  onPress,
}: ExerciseBlockProps) {
  const completedCount = log.sets.filter(s => s.completed).length;
  const allDone = completedCount === log.sets.length;
  const isBodyweight = exercise.equipment.includes('bodyweight') && !exercise.equipment.includes('dumbbells');
  const catColor = CATEGORY_COLORS[exercise.category] ?? colors.accent;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.container, isActive && styles.containerActive, allDone && styles.containerDone]}
      accessibilityLabel={exercise.name}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
        <View style={styles.nameGroup}>
          <TText variant="medium" style={allDone ? styles.textDone : undefined}>
            {exercise.name}
          </TText>
          <TText variant="caption" color="secondary">
            {exercise.defaultSets} × {exercise.defaultReps} · {exercise.defaultRest}s rest
          </TText>
        </View>
        <View style={styles.progressChip}>
          <TText variant="small" style={[styles.progressText, allDone && styles.progressDone]}>
            {completedCount}/{log.sets.length}
          </TText>
        </View>
      </View>

      {exercise.notes && (
        <TText variant="small" color="secondary" style={styles.notes}>
          {exercise.notes}
        </TText>
      )}

      {/* Sets — only expanded when active */}
      {isActive && (
        <View style={styles.sets}>
          {log.sets.map((set, i) => (
            <SetRow
              key={i}
              setNumber={i + 1}
              set={set}
              isBodyweight={isBodyweight}
              onUpdate={updates => onUpdateSet(i, updates)}
              onComplete={() => onCompleteSet(i)}
            />
          ))}
          <Pressable onPress={onAddSet} style={styles.addSetBtn}>
            <TText variant="small" style={styles.addSetText}>+ Add set</TText>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing[3],
    gap: spacing[3],
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  containerActive: {
    borderColor: colors.accent,
    backgroundColor: `${colors.accent}04`,
  },
  containerDone: {
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  nameGroup: {
    flex: 1,
    gap: 2,
  },
  textDone: {
    color: colors.textSecondary,
  },
  progressChip: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progressDone: {
    color: colors.success,
  },
  notes: {
    fontStyle: 'italic',
    marginLeft: spacing[3],
  },
  sets: {
    gap: spacing[2],
  },
  addSetBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
  },
  addSetText: {
    color: colors.accent,
    fontWeight: '600',
  },
});
