import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { colors, spacing, radius } from '@/theme';
import type { Priority } from '@/lib/tasks';

interface RolloverSectionProps {
  items: Priority[];
  expanded: boolean;
  onToggle: () => void;
  onPromote: (item: Priority) => void;
  onDismiss: (id: string) => void;
}

export function RolloverSection({
  items,
  expanded,
  onToggle,
  onPromote,
  onDismiss,
}: RolloverSectionProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Collapsed header */}
      <Pressable
        onPress={onToggle}
        style={styles.header}
        accessibilityLabel={`Carried forward ${items.length} item${items.length !== 1 ? 's' : ''}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint={expanded ? 'Tap to collapse' : 'Tap to expand'}
      >
        <View style={styles.headerLeft}>
          <View style={styles.dot} />
          <TText variant="caption" color="secondary">
            Carried forward ({items.length})
          </TText>
        </View>
        <TText variant="caption" color="secondary">
          {expanded ? '▾' : '▸'}
        </TText>
      </Pressable>

      {/* Expanded items */}
      {expanded && (
        <View style={styles.list}>
          {items.map((item) => (
            <RolloverItem
              key={item.id}
              item={item}
              onPromote={() => onPromote(item)}
              onDismiss={() => onDismiss(item.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function RolloverItem({
  item,
  onPromote,
  onDismiss,
}: {
  item: Priority;
  onPromote: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={itemStyles.container}>
      <View style={itemStyles.textBlock}>
        <TText variant="small" color="secondary" style={itemStyles.fromLabel}>
          From yesterday
        </TText>
        <TText variant="body" numberOfLines={2}>{item.text}</TText>
      </View>
      <View style={itemStyles.actions}>
        <Pressable
          onPress={onPromote}
          style={itemStyles.promoteBtn}
          accessibilityLabel={`Add "${item.text}" to today's Top 3`}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <TText variant="small" style={{ color: colors.accent }}>Add to today</TText>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          style={itemStyles.dismissBtn}
          accessibilityLabel={`Dismiss "${item.text}"`}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <TText variant="small" color="secondary">✕</TText>
        </Pressable>
      </View>
    </View>
  );
}

const itemStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  fromLabel: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingTop: spacing[1],
  },
  promoteBtn: {
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: `${colors.accent}12`,
    minHeight: 28,
    justifyContent: 'center',
  },
  dismissBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing[3],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 36,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.textSecondary,
    opacity: 0.5,
  },
  list: {
    marginTop: spacing[2],
    gap: 0,
  },
});
