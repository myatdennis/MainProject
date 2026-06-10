import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';

interface RingData {
  progress: number;  // 0–1, capped at 1
  color: string;
  label: string;
  value: string;
  goal: string;
}

interface ActivityRingsProps {
  activeCalories: number | null;
  exerciseMinutes: number | null;
  stepCount: number | null;
  calorieGoal?: number;
  exerciseGoal?: number;
  stepGoal?: number;
}

function ActivityRingArc({
  progress,
  color,
  size,
  strokeWidth,
}: {
  progress: number;
  color: string;
  size: number;
  strokeWidth: number;
}) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const sw = strokeWidth;
  const rect = { x: sw / 2, y: sw / 2, width: size - sw, height: size - sw };

  const bgPath = Skia.Path.Make();
  bgPath.addArc(rect, -90, 360);

  const fgPath = Skia.Path.Make();
  const sweep = 360 * clampedProgress;
  if (sweep > 0) {
    fgPath.addArc(rect, -90, sweep);
  }

  // Overdone ring — second lap in lighter color
  const overPath = Skia.Path.Make();
  if (progress > 1) {
    const overSweep = 360 * (progress - 1);
    if (overSweep > 0) {
      overPath.addArc(rect, -90, overSweep);
    }
  }

  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={bgPath} color={`${color}25`} style="stroke" strokeWidth={sw} strokeCap="round" />
      <Path path={fgPath} color={color} style="stroke" strokeWidth={sw} strokeCap="round" />
      {progress > 1 && (
        <Path path={overPath} color={color} style="stroke" strokeWidth={sw * 0.7} strokeCap="round" />
      )}
    </Canvas>
  );
}

export function ActivityRings({
  activeCalories,
  exerciseMinutes,
  stepCount,
  calorieGoal = 400,
  exerciseGoal = 30,
  stepGoal = 8000,
}: ActivityRingsProps) {
  const rings: RingData[] = [
    {
      progress: activeCalories != null ? activeCalories / calorieGoal : 0,
      color: '#FF3B30', // Apple red — Move ring
      label: 'Move',
      value: activeCalories != null ? String(activeCalories) : '--',
      goal: `${calorieGoal} cal`,
    },
    {
      progress: exerciseMinutes != null ? exerciseMinutes / exerciseGoal : 0,
      color: '#30D158', // Apple green — Exercise ring
      label: 'Exercise',
      value: exerciseMinutes != null ? `${exerciseMinutes}m` : '--',
      goal: `${exerciseGoal} min`,
    },
    {
      progress: stepCount != null ? stepCount / stepGoal : 0,
      color: '#0A84FF', // Apple blue — Stand ring (using steps as proxy)
      label: 'Steps',
      value: stepCount != null ? stepCount.toLocaleString() : '--',
      goal: `${stepGoal.toLocaleString()}`,
    },
  ];

  const ringSize = 80;
  const strokeWidth = 10;

  return (
    <View style={styles.container}>
      <View style={styles.rings}>
        {rings.map((ring) => (
          <View key={ring.label} style={styles.ringWrapper}>
            <ActivityRingArc
              progress={ring.progress}
              color={ring.color}
              size={ringSize}
              strokeWidth={strokeWidth}
            />
            <View style={[styles.ringCenter, { width: ringSize, height: ringSize }]}>
              <TText variant="small" style={{ color: ring.color, fontWeight: '700', fontSize: 13 }}>
                {ring.value}
              </TText>
            </View>
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {rings.map((ring) => (
          <View key={ring.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ring.color }]} />
            <View>
              <TText variant="caption" style={{ color: ring.color, fontWeight: '600' }}>
                {ring.label}
              </TText>
              <TText variant="small" color="secondary">{ring.value} / {ring.goal}</TText>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
  },
  rings: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ringWrapper: {
    alignItems: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
