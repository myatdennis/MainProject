import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';
import { MoodLevel } from '@/lib/journal';

interface MoodSelectorProps {
  value: MoodLevel | null;
  onChange: (mood: MoodLevel) => void;
}

const MOODS: Array<{ level: MoodLevel; emoji: string; label: string; color: string }> = [
  { level: 'low',     emoji: '😔', label: 'Low',     color: colors.danger },
  { level: 'neutral', emoji: '😐', label: 'Okay',    color: colors.warning },
  { level: 'good',    emoji: '😊', label: 'Good',    color: colors.success },
];

function MoodButton({ mood, selected, onPress }: {
  mood: typeof MOODS[0];
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(1.25, { damping: 6, stiffness: 400 }, () => {
      scale.value = withSpring(1, { damping: 10, stiffness: 300 });
    });
    onPress();
  };

  return (
    <Pressable onPress={handlePress} accessibilityLabel={`Set mood to ${mood.label}`}>
      <Animated.View style={[
        styles.moodBtn,
        selected && { backgroundColor: `${mood.color}18`, borderColor: mood.color, borderWidth: 1.5 },
        animStyle,
      ]}>
        <TText style={styles.emoji}>{mood.emoji}</TText>
        <TText variant="small" style={[styles.label, selected && { color: mood.color }]}>
          {mood.label}
        </TText>
      </Animated.View>
    </Pressable>
  );
}

export function MoodSelector({ value, onChange }: MoodSelectorProps) {
  return (
    <View style={styles.container}>
      <TText variant="caption" color="secondary" style={styles.prompt}>
        How are you feeling?
      </TText>
      <View style={styles.row}>
        {MOODS.map(m => (
          <MoodButton
            key={m.level}
            mood={m}
            selected={value === m.level}
            onPress={() => onChange(m.level)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
    alignItems: 'center',
  },
  prompt: {
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  moodBtn: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  emoji: {
    fontSize: 28,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
  },
});
