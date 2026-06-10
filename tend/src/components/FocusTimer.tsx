import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { TText } from './ui/TText';
import { Button } from './ui/Button';
import { colors, spacing, radius } from '@/theme';

const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

interface FocusTimerProps {
  visible: boolean;
  onClose: () => void;
}

type Phase = 'work' | 'break' | 'idle';

export function FocusTimer({ visible, onClose }: FocusTimerProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringOpacity = useSharedValue(1);

  const totalSeconds = phase === 'break' ? BREAK_SECONDS : WORK_SECONDS;
  const progress = 1 - secondsLeft / totalSeconds;

  const size = 220;
  const strokeWidth = 14;
  const arcRadius = (size - strokeWidth) / 2;

  const arcPath = Skia.Path.Make();
  arcPath.addArc(
    { x: strokeWidth / 2, y: strokeWidth / 2, width: size - strokeWidth, height: size - strokeWidth },
    -90,
    360 * progress,
  );

  const bgPath = Skia.Path.Make();
  bgPath.addArc(
    { x: strokeWidth / 2, y: strokeWidth / 2, width: size - strokeWidth, height: size - strokeWidth },
    -90,
    360,
  );

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback((p: Phase) => {
    clearTimer();
    const total = p === 'break' ? BREAK_SECONDS : WORK_SECONDS;
    setSecondsLeft(total);
    setPhase(p);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearTimer();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        if (s === 11) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        return s - 1;
      });
    }, 1000);
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setPhase('idle');
    setSecondsLeft(WORK_SECONDS);
  }, [clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeLabel = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
  }));

  const ringColor = phase === 'break' ? colors.success : colors.accent;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <TText variant="heading" style={styles.title}>
            {phase === 'idle' ? 'Focus Timer' : phase === 'work' ? 'Focus' : 'Break'}
          </TText>

          <Animated.View style={[styles.ringWrapper, pulseStyle]}>
            <Canvas style={{ width: size, height: size }}>
              <Path
                path={bgPath}
                color={colors.border}
                style="stroke"
                strokeWidth={strokeWidth}
                strokeCap="round"
              />
              <Path
                path={arcPath}
                color={ringColor}
                style="stroke"
                strokeWidth={strokeWidth}
                strokeCap="round"
              />
            </Canvas>
            <View style={[styles.ringCenter, { width: size, height: size }]}>
              <TText variant="display" style={{ fontSize: 48, color: ringColor }}>
                {timeLabel}
              </TText>
              <TText variant="caption" color="secondary">
                {phase === 'idle' ? '25 min focus' : phase === 'break' ? '5 min break' : 'remaining'}
              </TText>
            </View>
          </Animated.View>

          <View style={styles.actions}>
            {phase === 'idle' && (
              <Button label="Start Focus" onPress={() => start('work')} fullWidth />
            )}
            {phase === 'work' && secondsLeft === 0 && (
              <Button label="Start Break" onPress={() => start('break')} fullWidth />
            )}
            {phase === 'break' && secondsLeft === 0 && (
              <Button label="Another Round" onPress={() => start('work')} fullWidth />
            )}
            {(phase === 'work' || phase === 'break') && secondsLeft > 0 && (
              <Button label="Stop" onPress={reset} variant="secondary" fullWidth />
            )}
          </View>

          <Pressable onPress={onClose} style={styles.dismiss} accessibilityLabel="Close focus timer">
            <TText variant="caption" color="secondary">Dismiss</TText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[6],
    paddingBottom: Platform.OS === 'ios' ? 48 : spacing[6],
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing[4],
  },
  title: {
    marginBottom: spacing[6],
  },
  ringWrapper: {
    marginBottom: spacing[8],
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    width: '100%',
    marginBottom: spacing[4],
  },
  dismiss: {
    padding: spacing[3],
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
