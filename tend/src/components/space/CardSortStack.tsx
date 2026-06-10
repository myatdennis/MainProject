import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { SwipeCard } from './SwipeCard';
import { colors, spacing } from '@/theme';
import type { BrainDumpCapture, CaptureAction } from '@/lib/braindump';

interface CardSortStackProps {
  captures: BrainDumpCapture[];
  onAction: (id: string, action: CaptureAction) => void;
  onDone: () => void;
}

export function CardSortStack({ captures, onAction, onDone }: CardSortStackProps) {
  const visibleCards = captures.slice(0, 3); // show top 3 in stack

  if (captures.length === 0) {
    return (
      <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyState}>
        <TText style={styles.emptyEmoji}>✓</TText>
        <TText variant="heading" style={styles.emptyTitle}>All sorted</TText>
        <TText variant="body" color="secondary" style={styles.emptyBody}>
          Your thoughts have been actioned. Good work.
        </TText>
        <Pressable onPress={onDone} style={styles.doneBtn}>
          <TText variant="medium" style={styles.doneBtnText}>Done</TText>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TText variant="body" color="secondary">
          {captures.length} left to sort
        </TText>
        <Pressable onPress={() => { onAction(captures[0].id, 'dismissed'); }} style={styles.skipBtn}>
          <TText variant="small" color="secondary">Skip</TText>
        </Pressable>
      </View>

      <View style={styles.stack}>
        {[...visibleCards].reverse().map((cap, i) => (
          <SwipeCard
            key={cap.id}
            capture={cap}
            index={visibleCards.length - 1 - i}
            total={visibleCards.length}
            onAction={onAction}
          />
        ))}
      </View>

      {/* Quick action row for accessibility / non-gesture usage */}
      <View style={styles.quickActions}>
        <Pressable
          onPress={() => onAction(captures[0].id, 'later')}
          style={[styles.actionBtn, styles.laterBtn]}
          accessibilityLabel="Mark as later"
        >
          <TText variant="small" style={styles.laterText}>Later</TText>
        </Pressable>
        <Pressable
          onPress={() => onAction(captures[0].id, 'task')}
          style={[styles.actionBtn, styles.taskBtn]}
          accessibilityLabel="Add to tasks"
        >
          <TText variant="small" style={styles.taskText}>+ Task</TText>
        </Pressable>
        <Pressable
          onPress={() => onAction(captures[0].id, 'today')}
          style={[styles.actionBtn, styles.todayBtn]}
          accessibilityLabel="Do today"
        >
          <TText variant="small" style={styles.todayText}>Today ✓</TText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing[4],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[1],
  },
  skipBtn: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
  },
  stack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing[4],
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingBottom: spacing[4],
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterBtn: {
    backgroundColor: colors.surfaceAlt,
  },
  taskBtn: {
    backgroundColor: `${colors.accent}15`,
  },
  todayBtn: {
    backgroundColor: `${colors.success}15`,
  },
  laterText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  taskText: {
    color: colors.accent,
    fontWeight: '600',
  },
  todayText: {
    color: colors.success,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[6],
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
    lineHeight: 24,
  },
  doneBtn: {
    marginTop: spacing[2],
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
  },
  doneBtnText: {
    color: '#fff',
  },
});
