import React, { useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';
import type { BrainDumpCapture, CaptureAction } from '@/lib/braindump';

interface SwipeCardProps {
  capture: BrainDumpCapture;
  index: number;   // 0 = top card
  total: number;
  onAction: (id: string, action: CaptureAction) => void;
}

const SWIPE_THRESHOLD = 80;
const DISMISS_VELOCITY = 600;

export function SwipeCard({ capture, index, total, onAction }: SwipeCardProps) {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const triggerAction = useCallback((action: CaptureAction) => {
    onAction(capture.id, action);
  }, [capture.id, onAction]);

  const pan = Gesture.Pan()
    .onStart(() => { isDragging.value = true; })
    .onUpdate(e => {
      if (index !== 0) return; // only top card is interactive
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.3;
    })
    .onEnd(e => {
      isDragging.value = false;
      const dx = e.translationX;
      const dy = e.translationY;
      const vx = e.velocityX;

      if (dx > SWIPE_THRESHOLD || vx > DISMISS_VELOCITY) {
        // Swipe right → today
        translateX.value = withTiming(width * 1.5, { duration: 250 });
        runOnJS(triggerAction)('today');
      } else if (dx < -SWIPE_THRESHOLD || vx < -DISMISS_VELOCITY) {
        // Swipe left → later
        translateX.value = withTiming(-width * 1.5, { duration: 250 });
        runOnJS(triggerAction)('later');
      } else if (dy < -SWIPE_THRESHOLD) {
        // Swipe up → task
        translateY.value = withTiming(-600, { duration: 250 });
        runOnJS(triggerAction)('task');
      } else {
        // Snap back
        translateX.value = withSpring(0, { damping: 16, stiffness: 250 });
        translateY.value = withSpring(0, { damping: 16, stiffness: 250 });
      }
    })
    .runOnJS(false);

  const cardStyle = useAnimatedStyle(() => {
    const isTop = index === 0;
    const stackOffset = index * 6;
    const stackScale = 1 - index * 0.04;

    const rotate = isTop
      ? `${interpolate(translateX.value, [-200, 0, 200], [-12, 0, 12], Extrapolation.CLAMP)}deg`
      : '0deg';

    return {
      transform: [
        { translateX: isTop ? translateX.value : 0 },
        { translateY: isTop ? translateY.value + stackOffset : stackOffset },
        { scale: stackScale },
        { rotate },
      ],
      opacity: interpolate(index, [0, 2], [1, 0.6], Extrapolation.CLAMP),
    };
  });

  // Direction label fades in as card is dragged
  const rightLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, 80], [0, 1], Extrapolation.CLAMP),
  }));
  const leftLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-20, -80], [0, 1], Extrapolation.CLAMP),
  }));
  const upLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-20, -60], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, cardStyle]}>
        {/* Action hint labels */}
        {index === 0 && (
          <>
            <Animated.View style={[styles.hintLabel, styles.hintRight, rightLabelStyle]}>
              <TText style={styles.hintTextGreen}>Today ✓</TText>
            </Animated.View>
            <Animated.View style={[styles.hintLabel, styles.hintLeft, leftLabelStyle]}>
              <TText style={styles.hintTextGray}>Later →</TText>
            </Animated.View>
            <Animated.View style={[styles.hintLabel, styles.hintUp, upLabelStyle]}>
              <TText style={styles.hintTextBlue}>↑ Task</TText>
            </Animated.View>
          </>
        )}

        <TText variant="body" style={styles.text}>{capture.text}</TText>

        {index === 0 && (
          <TText variant="small" color="secondary" style={styles.hint}>
            Swipe right → today  ·  left → later  ·  up → task
          </TText>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing[5],
    gap: spacing[3],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    minHeight: 140,
    justifyContent: 'center',
  },
  text: {
    fontSize: 18,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  hint: {
    textAlign: 'center',
    marginTop: spacing[2],
  },
  hintLabel: {
    position: 'absolute',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 8,
    borderWidth: 2,
  },
  hintRight: {
    top: spacing[3],
    left: spacing[3],
    borderColor: colors.success,
    transform: [{ rotate: '-15deg' }],
  },
  hintLeft: {
    top: spacing[3],
    right: spacing[3],
    borderColor: colors.textSecondary,
    transform: [{ rotate: '15deg' }],
  },
  hintUp: {
    top: spacing[3],
    alignSelf: 'center',
    borderColor: colors.accent,
  },
  hintTextGreen: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 14,
  },
  hintTextGray: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  hintTextBlue: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 14,
  },
});
