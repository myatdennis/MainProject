import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Circle, Path, Skia, useValue, runTiming } from '@shopify/react-native-skia';
import { Easing } from 'react-native-reanimated';
import { TText } from './ui/TText';
import { getRecoveryZone, getRecoveryColor } from '@/types';
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
  const progress = useValue(0);

  const strokeWidth = size * 0.075;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    runTiming(progress, score / 100, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [score]);

  // Arc path using Skia
  const arcPath = Skia.Path.Make();
  arcPath.addArc(
    { x: strokeWidth / 2, y: strokeWidth / 2, width: size - strokeWidth, height: size - strokeWidth },
    -90,
    360 * (score / 100),
  );

  const bgPath = Skia.Path.Make();
  bgPath.addArc(
    { x: strokeWidth / 2, y: strokeWidth / 2, width: size - strokeWidth, height: size - strokeWidth },
    -90,
    360,
  );

  return (
    <View style={styles.container} accessibilityLabel={`Recovery score: ${score}`}>
      <Canvas style={{ width: size, height: size }}>
        {/* Background track */}
        <Path
          path={bgPath}
          color={colors.border}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
        />
        {/* Progress arc */}
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
          <TText variant="display" style={{ color: ringColor, fontSize: size * 0.28, lineHeight: size * 0.3 }}>
            {score}
          </TText>
          <TText variant="caption" color="secondary">
            Recovery
          </TText>
        </View>
      )}

      {showMessage && (
        <TText variant="caption" color="secondary" style={styles.message}>
          {zone === 'high' ? "You're recovered. Push hard today."
            : zone === 'moderate' ? 'Moderate energy today. Keep it controlled.'
            : 'Your body needs rest. Rehab and breathe today.'}
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
