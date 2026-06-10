import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  useDerivedValue,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { TText } from './ui/TText';
import { getRecoveryZone, getRecoveryColor, getRecoveryMessage } from '@/types';
import { colors } from '@/theme';

interface RecoveryRingProps {
  score: number;
  size?: number;
  showScore?: boolean;
  showMessage?: boolean;
}

export function RecoveryRing({
  score,
  size = 160,
  showScore = true,
  showMessage = false,
}: RecoveryRingProps) {
  const zone = getRecoveryZone(score);
  const ringColor = getRecoveryColor(zone);
  const strokeWidth = size * 0.075;

  const rect = {
    x: strokeWidth / 2,
    y: strokeWidth / 2,
    width: size - strokeWidth,
    height: size - strokeWidth,
  };

  // Animate progress from 0 → score/100 on mount
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = 0;
    animatedProgress.value = withTiming(score / 100, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [score]);

  // Build static background path once
  const bgPath = Skia.Path.Make();
  bgPath.addArc(rect, -90, 360);

  // Build animated arc path using useDerivedValue (Skia v1.x pattern)
  const arcPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const sweep = 360 * animatedProgress.value;
    if (sweep > 0) {
      p.addArc(rect, -90, sweep);
    }
    return p;
  });

  return (
    <View
      style={styles.container}
      accessibilityLabel={`Recovery score ${score} out of 100`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: score }}
    >
      <Canvas style={{ width: size, height: size }}>
        {/* Background track */}
        <Path
          path={bgPath}
          color={colors.border}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
        />
        {/* Animated progress arc */}
        <Path
          path={arcPath}
          color={ringColor}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
        />
      </Canvas>

      {showScore && (
        <View style={[styles.centerContent, { width: size, height: size }]}>
          <TText
            style={{
              color: ringColor,
              fontSize: size * 0.27,
              fontWeight: '700',
              lineHeight: size * 0.3,
            }}
          >
            {score}
          </TText>
          <TText variant="caption" color="secondary">
            Recovery
          </TText>
        </View>
      )}

      {showMessage && (
        <TText variant="caption" color="secondary" style={styles.message}>
          {getRecoveryMessage(zone)}
        </TText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginTop: 12,
    textAlign: 'center',
    maxWidth: 220,
  },
});
