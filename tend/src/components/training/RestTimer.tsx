import React, { useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';

interface RestTimerProps {
  seconds: number;
  totalSeconds: number;
  onSkip: () => void;
}

export function RestTimer({ seconds, totalSeconds, onSkip }: RestTimerProps) {
  const progress = totalSeconds > 0 ? (totalSeconds - seconds) / totalSeconds : 1;
  const SIZE = 100;
  const STROKE = 6;
  const R = (SIZE - STROKE) / 2;
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const prevSeconds = useRef(seconds);
  useEffect(() => {
    if (seconds === 10 && prevSeconds.current > 10) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (seconds === 0 && prevSeconds.current > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevSeconds.current = seconds;
  }, [seconds]);

  const arcPath = Skia.Path.Make();
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + 2 * Math.PI * progress;
  const rect = { x: STROKE / 2, y: STROKE / 2, width: SIZE - STROKE, height: SIZE - STROKE };
  arcPath.addArc(rect, -90, 360 * progress);

  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} style={styles.container}>
      <View style={styles.row}>
        <View style={styles.ringWrapper}>
          <Canvas style={{ width: SIZE, height: SIZE }}>
            {/* Background track */}
            <Circle cx={cx} cy={cy} r={R} color={`${colors.accent}20`} style="stroke" strokeWidth={STROKE} />
            {/* Progress arc */}
            <Path path={arcPath} color={seconds <= 10 ? colors.warning : colors.accent} style="stroke" strokeWidth={STROKE} strokeCap="round" />
          </Canvas>
          <View style={styles.ringCenter}>
            <TText style={[styles.countdown, seconds <= 10 && styles.countdownWarn]}>
              {seconds}
            </TText>
            <TText variant="small" color="secondary">rest</TText>
          </View>
        </View>

        <View style={styles.info}>
          <TText variant="body" color="secondary">Rest period</TText>
          <TText variant="caption" color="secondary">
            {seconds > 10 ? 'Breathe. Reset.' : 'Almost time.'}
          </TText>
          <Pressable onPress={onSkip} style={styles.skipBtn} accessibilityLabel="Skip rest">
            <TText variant="small" style={styles.skipText}>Skip →</TText>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: `${colors.accent}08`,
    borderRadius: 16,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: `${colors.accent}20`,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  ringWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  countdown: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 32,
  },
  countdownWarn: {
    color: colors.warning,
  },
  info: {
    flex: 1,
    gap: spacing[1],
  },
  skipBtn: {
    marginTop: spacing[2],
    alignSelf: 'flex-start',
    paddingVertical: spacing[1],
  },
  skipText: {
    color: colors.accent,
    fontWeight: '600',
  },
});
