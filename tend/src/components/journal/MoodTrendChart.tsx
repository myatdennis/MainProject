import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';
import type { MoodLevel } from '@/lib/journal';

interface MoodTrendChartProps {
  data: Array<{ date: string; mood: MoodLevel | null }>;
  days?: number;
}

const MOOD_Y: Record<MoodLevel, number> = { low: 0.85, neutral: 0.5, good: 0.15 };
const MOOD_COLOR: Record<MoodLevel, string> = {
  low: colors.danger,
  neutral: colors.warning,
  good: colors.success,
};

export function MoodTrendChart({ data, days = 14 }: MoodTrendChartProps) {
  const WIDTH = 280;
  const HEIGHT = 60;
  const PAD = 8;
  const innerW = WIDTH - PAD * 2;
  const innerH = HEIGHT - PAD * 2;

  const slice = data.slice(0, days).reverse();
  const points = slice.map((d, i) => ({
    x: PAD + (i / Math.max(1, slice.length - 1)) * innerW,
    y: d.mood ? PAD + MOOD_Y[d.mood] * innerH : null,
    mood: d.mood,
    date: d.date,
  }));

  const hasData = points.some(p => p.y !== null);

  if (!hasData) {
    return (
      <View style={styles.empty}>
        <TText variant="caption" color="secondary">Start journaling to see your mood trend.</TText>
      </View>
    );
  }

  // Lines between consecutive non-null points
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  let prev: { x: number; y: number } | null = null;
  for (const p of points) {
    if (p.y !== null) {
      if (prev) lines.push({ x1: prev.x, y1: prev.y, x2: p.x, y2: p.y });
      prev = { x: p.x, y: p.y };
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.labels}>
        <TText variant="small" color="secondary">😊</TText>
        <TText variant="small" color="secondary">😐</TText>
        <TText variant="small" color="secondary">😔</TText>
      </View>
      <Svg width={WIDTH} height={HEIGHT}>
        {lines.map((l, i) => (
          <Line
            key={i}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke={colors.textSecondary}
            strokeWidth={1.5}
            strokeOpacity={0.3}
            strokeDasharray="3 3"
          />
        ))}
        {points.map((p, i) =>
          p.y !== null && p.mood ? (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={5}
              fill={MOOD_COLOR[p.mood]}
              opacity={0.9}
            />
          ) : null
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  labels: {
    gap: 4,
    alignItems: 'center',
  },
  empty: {
    paddingVertical: spacing[3],
  },
});
