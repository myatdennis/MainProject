import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TText } from '@/components/ui/TText';
import { Divider } from '@/components/ui/Divider';
import { colors, spacing } from '@/theme';
import type { BrainDumpCapture } from '@/lib/braindump';

interface SortedSummaryProps {
  captures: BrainDumpCapture[];
}

export function SortedSummary({ captures }: SortedSummaryProps) {
  const today = captures.filter(c => c.action === 'today');
  const tasks = captures.filter(c => c.action === 'task');
  const later = captures.filter(c => c.action === 'later');
  const dismissed = captures.filter(c => c.action === 'dismissed');

  return (
    <View style={styles.container}>
      {today.length > 0 && (
        <SummaryGroup
          label="Doing today"
          color={colors.success}
          items={today}
        />
      )}
      {tasks.length > 0 && (
        <>
          <Divider />
          <SummaryGroup label="Added to tasks" color={colors.accent} items={tasks} />
        </>
      )}
      {later.length > 0 && (
        <>
          <Divider />
          <SummaryGroup label="Saved for later" color={colors.textSecondary} items={later} />
        </>
      )}
      {dismissed.length > 0 && (
        <>
          <Divider />
          <SummaryGroup label="Let go" color={colors.border} items={dismissed} />
        </>
      )}
    </View>
  );
}

function SummaryGroup({ label, color, items }: {
  label: string;
  color: string;
  items: BrainDumpCapture[];
}) {
  return (
    <View style={styles.group}>
      <TText variant="caption" style={[styles.groupLabel, { color }]}>
        {label} ({items.length})
      </TText>
      {items.map(item => (
        <View key={item.id} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <TText variant="body" style={styles.itemText} numberOfLines={2}>
            {item.text}
          </TText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[3],
  },
  group: {
    gap: spacing[2],
  },
  groupLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 10,
    fontWeight: '600',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
    lineHeight: 22,
  },
});
