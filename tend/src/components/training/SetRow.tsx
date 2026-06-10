import React from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';
import type { LoggedSet } from '@/lib/training';

interface SetRowProps {
  setNumber: number;
  set: LoggedSet;
  isBodyweight: boolean;
  onUpdate: (updates: Partial<LoggedSet>) => void;
  onComplete: () => void;
}

export function SetRow({ setNumber, set, isBodyweight, onUpdate, onComplete }: SetRowProps) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleComplete = () => {
    scale.value = withSpring(1.06, { damping: 6, stiffness: 400 }, () => {
      scale.value = withSpring(1, { damping: 10 });
    });
    onComplete();
  };

  return (
    <Animated.View style={[styles.row, set.completed && styles.rowDone, animStyle]}>
      <TText variant="caption" style={styles.setNum}>{setNumber}</TText>

      {!isBodyweight && (
        <View style={styles.field}>
          <TextInput
            style={[styles.input, set.completed && styles.inputDone]}
            value={set.weight === 0 ? '' : String(set.weight)}
            onChangeText={v => onUpdate({ weight: parseFloat(v) || 0 })}
            keyboardType="decimal-pad"
            placeholder="kg"
            placeholderTextColor={colors.textSecondary}
            editable={!set.completed}
            selectTextOnFocus
          />
          <TText variant="small" color="secondary">kg</TText>
        </View>
      )}

      <View style={styles.field}>
        <TextInput
          style={[styles.input, set.completed && styles.inputDone]}
          value={set.reps === 0 ? '' : String(set.reps)}
          onChangeText={v => onUpdate({ reps: parseInt(v, 10) || 0 })}
          keyboardType="number-pad"
          placeholder="reps"
          placeholderTextColor={colors.textSecondary}
          editable={!set.completed}
          selectTextOnFocus
        />
        <TText variant="small" color="secondary">reps</TText>
      </View>

      <Pressable
        onPress={handleComplete}
        disabled={set.completed}
        style={[styles.checkBtn, set.completed && styles.checkBtnDone]}
        accessibilityLabel={set.completed ? 'Set done' : 'Mark set complete'}
      >
        <TText style={[styles.checkIcon, set.completed && styles.checkIconDone]}>
          {set.completed ? '✓' : '○'}
        </TText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
  },
  rowDone: {
    opacity: 0.6,
  },
  setNum: {
    width: 20,
    textAlign: 'center',
    color: colors.textSecondary,
    fontWeight: '600',
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inputDone: {
    color: colors.textSecondary,
    borderBottomColor: 'transparent',
  },
  checkBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  checkBtnDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkIcon: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  checkIconDone: {
    color: '#fff',
  },
});
