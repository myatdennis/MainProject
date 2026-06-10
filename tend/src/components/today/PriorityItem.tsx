import React, { useRef, useCallback } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';
import type { Priority } from '@/lib/tasks';

interface PriorityItemProps {
  number: number;
  priority: Priority;
  onComplete: () => void;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput>;
  nextRef?: React.RefObject<TextInput>;
}

export function PriorityItem({
  number,
  priority,
  onComplete,
  onChangeText,
  onSubmitEditing,
  inputRef,
  nextRef,
}: PriorityItemProps) {
  const checkScale = useSharedValue(1);
  const rowOpacity = useSharedValue(1);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const rowStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
  }));

  const handleComplete = useCallback(() => {
    // Spring-bounce the check then settle
    checkScale.value = withSpring(1.3, { damping: 6, stiffness: 400 }, () => {
      checkScale.value = withSpring(1, { damping: 12, stiffness: 300 });
    });
    // Fade row slightly when done
    rowOpacity.value = withTiming(priority.done ? 1 : 0.65, { duration: 200 });
    onComplete();
  }, [onComplete, priority.done]);

  const handleSubmit = useCallback(() => {
    if (nextRef?.current) {
      nextRef.current.focus();
    } else {
      onSubmitEditing?.();
    }
  }, [nextRef, onSubmitEditing]);

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      {/* Check button */}
      <Animated.View style={checkStyle}>
        <Pressable
          onPress={handleComplete}
          style={[styles.check, priority.done && styles.checkDone]}
          accessibilityLabel={priority.done ? 'Mark incomplete' : 'Mark complete'}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: priority.done }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {priority.done && (
            <TText style={styles.checkmark}>✓</TText>
          )}
        </Pressable>
      </Animated.View>

      {/* Number */}
      <TText variant="mono" color="secondary" style={styles.number}>
        {number}
      </TText>

      {/* Text input */}
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          priority.done && styles.inputDone,
        ]}
        placeholder={
          number === 1
            ? 'Most important thing today…'
            : number === 2
            ? 'Second priority…'
            : 'Third priority…'
        }
        placeholderTextColor={colors.textSecondary}
        value={priority.text}
        onChangeText={onChangeText}
        returnKeyType={number < 3 ? 'next' : 'done'}
        onSubmitEditing={handleSubmit}
        accessibilityLabel={`Priority ${number}${priority.done ? ', completed' : ''}`}
        accessibilityHint={priority.done ? 'Double tap to undo' : 'Type to add a priority'}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 52,
    paddingVertical: spacing[1],
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '700',
  },
  number: {
    width: 14,
    textAlign: 'right',
    fontSize: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: spacing[2],
    minHeight: 44,
  },
  inputDone: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
});
