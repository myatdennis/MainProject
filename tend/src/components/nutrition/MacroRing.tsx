import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { TText } from '@/components/ui/TText';
import { colors } from '@/theme';

interface MacroRingProps {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
  size?: number;
}

export function MacroRing({ label, value, target, unit, color, size = 80 }: MacroRingProps) {
  const progress = target > 0 ? Math.min(1, value / target) : 0;
  const STROKE = 7;
  const R = (size - STROKE) / 2;

  const arcPath = Skia.Path.Make();
  arcPath.addArc(
    { x: STROKE / 2, y: STROKE / 2, width: size - STROKE, height: size - STROKE },
    -90,
    360 * progress,
  );

  const isOver = value > target;

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size }}>
        <Canvas style={{ width: size, height: size }}>
          <Circle cx={size / 2} cy={size / 2} r={R} color={`${color}20`} style="stroke" strokeWidth={STROKE} />
          <Path path={arcPath} color={isOver ? colors.warning : color} style="stroke" strokeWidth={STROKE} strokeCap="round" />
        </Canvas>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <TText style={[styles.value, { color }]}>{Math.round(value)}</TText>
          <TText variant="small" color="secondary">{unit}</TText>
        </View>
      </View>
      <TText variant="small" color="secondary" style={styles.label}>{label}</TText>
      <TText variant="caption" color="secondary">{Math.round(target - value > 0 ? target - value : 0)} left</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  label: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 10,
  },
});
