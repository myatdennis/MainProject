import React, { useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Circle } from 'react-native-svg';
import { Card } from '@/components/ui/Card';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';
import type { HealthTrendPoint } from '@/contexts/HealthContext';

type Window = 7 | 30 | 90;
type MetricKey = 'hrv' | 'restingHr' | 'sleepHours' | 'recovery' | 'strainVsRecovery';

interface TrendsChartProps {
  trends: HealthTrendPoint[];
}

const METRICS: { key: MetricKey; label: string; unit: string; color: string }[] = [
  { key: 'hrv', label: 'HRV', unit: 'ms', color: colors.accent },
  { key: 'restingHr', label: 'Resting HR', unit: 'bpm', color: colors.accentWarm },
  { key: 'sleepHours', label: 'Sleep', unit: 'h', color: '#6366F1' },
  { key: 'recovery', label: 'Recovery', unit: '', color: colors.success },
  { key: 'strainVsRecovery', label: 'Strain vs Recovery', unit: '', color: colors.accent },
];

export function TrendsChart({ trends }: TrendsChartProps) {
  const [window, setWindow] = useState<Window>(7);
  const [metric, setMetric] = useState<MetricKey>('hrv');

  const sliced = trends.slice(-window);

  return (
    <Card style={styles.card}>
      <TText variant="heading">Trends</TText>

      {/* Window toggle */}
      <View style={styles.toggle}>
        {([7, 30, 90] as Window[]).map((w) => (
          <Pressable
            key={w}
            onPress={() => setWindow(w)}
            style={[styles.toggleBtn, window === w && styles.toggleBtnActive]}
            accessibilityLabel={`${w} day window`}
            accessibilityRole="radio"
            accessibilityState={{ checked: window === w }}
          >
            <TText
              variant="caption"
              style={{ color: window === w ? '#fff' : colors.textSecondary }}
            >
              {w}d
            </TText>
          </Pressable>
        ))}
      </View>

      {/* Metric selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricScroll}>
        <View style={styles.metricRow}>
          {METRICS.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => setMetric(m.key)}
              style={[styles.metricChip, metric === m.key && { borderColor: m.color, backgroundColor: `${m.color}12` }]}
              accessibilityLabel={m.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: metric === m.key }}
            >
              <TText
                variant="small"
                style={{ color: metric === m.key ? m.color : colors.textSecondary }}
              >
                {m.label}
              </TText>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Chart */}
      <LineChartView
        data={sliced}
        metricKey={metric}
        color={METRICS.find((m) => m.key === metric)?.color ?? colors.accent}
        unit={METRICS.find((m) => m.key === metric)?.unit ?? ''}
      />
    </Card>
  );
}

interface LineChartViewProps {
  data: HealthTrendPoint[];
  metricKey: MetricKey;
  color: string;
  unit: string;
}

function LineChartView({ data, metricKey, color, unit }: LineChartViewProps) {
  const chartWidth = 320;
  const chartHeight = 140;
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const innerW = chartWidth - padL - padR;
  const innerH = chartHeight - padT - padB;

  function getValues(points: HealthTrendPoint[]): (number | null)[] {
    switch (metricKey) {
      case 'hrv': return points.map((p) => p.hrv);
      case 'restingHr': return points.map((p) => p.restingHr);
      case 'sleepHours': return points.map((p) => p.sleepHours);
      case 'recovery': return points.map((p) => p.recoveryScore);
      case 'strainVsRecovery': return points.map((p) => p.recoveryScore);
    }
  }

  const vals = getValues(data);
  const strainVals = metricKey === 'strainVsRecovery' ? data.map((p) => p.strainScore) : null;

  const validVals = [...vals, ...(strainVals ?? [])].filter((v): v is number => v != null);
  if (validVals.length < 2) {
    return (
      <View style={[styles.emptyChart, { width: chartWidth, height: chartHeight }]}>
        <TText variant="caption" color="secondary">Not enough data yet</TText>
      </View>
    );
  }

  const minVal = Math.min(...validVals);
  const maxVal = Math.max(...validVals);
  const range = maxVal - minVal || 1;

  const toX = (i: number) => padL + (i / (data.length - 1)) * innerW;
  const toY = (v: number) => padT + (1 - (v - minVal) / range) * innerH;

  function buildPath(values: (number | null)[]): string {
    let d = '';
    let prevX: number | null = null;
    let prevY: number | null = null;

    values.forEach((v, i) => {
      if (v == null) { prevX = null; prevY = null; return; }
      const x = toX(i);
      const y = toY(v);
      if (prevX == null) {
        d += `M ${x} ${y}`;
      } else {
        const cpx = prevX + (x - prevX) / 2;
        d += ` C ${cpx} ${prevY!} ${cpx} ${y} ${x} ${y}`;
      }
      prevX = x;
      prevY = y;
    });
    return d;
  }

  const mainPath = buildPath(vals);
  const secPath = strainVals ? buildPath(strainVals) : null;

  // Grid lines at 25% intervals
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    y: padT + pct * innerH,
    label: Math.round(maxVal - pct * range),
  }));

  // X axis labels — show first, middle, last
  const xLabels = [0, Math.floor(data.length / 2), data.length - 1]
    .filter((i) => i >= 0 && i < data.length)
    .map((i) => ({
      x: toX(i),
      label: formatDateLabel(data[i].date),
    }));

  return (
    <Svg width={chartWidth} height={chartHeight}>
      {/* Grid lines */}
      {gridYs.map((g) => (
        <React.Fragment key={g.y}>
          <Line
            x1={padL}
            y1={g.y}
            x2={chartWidth - padR}
            y2={g.y}
            stroke={colors.border}
            strokeWidth={1}
          />
          <SvgText
            x={padL - 4}
            y={g.y + 4}
            fontSize={9}
            fill={colors.textSecondary}
            textAnchor="end"
          >
            {g.label}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Main line */}
      {mainPath && (
        <Path
          d={mainPath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Secondary line (strain vs recovery) */}
      {secPath && (
        <Path
          d={secPath}
          fill="none"
          stroke={colors.accentWarm}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4,3"
        />
      )}

      {/* Dots at latest value */}
      {(() => {
        const lastIdx = vals.reduceRight((acc, v, i) => acc === -1 && v != null ? i : acc, -1);
        if (lastIdx === -1) return null;
        const lv = vals[lastIdx];
        if (lv == null) return null;
        return (
          <Circle
            cx={toX(lastIdx)}
            cy={toY(lv)}
            r={4}
            fill={color}
          />
        );
      })()}

      {/* X axis labels */}
      {xLabels.map((xl) => (
        <SvgText
          key={xl.x}
          x={xl.x}
          y={chartHeight - 6}
          fontSize={9}
          fill={colors.textSecondary}
          textAnchor="middle"
        >
          {xl.label}
        </SvgText>
      ))}
    </Svg>
  );
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
    gap: spacing[3],
  },
  toggle: {
    flexDirection: 'row',
    gap: spacing[1],
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    padding: 3,
    alignSelf: 'flex-start',
  },
  toggleBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    borderRadius: 16,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.accent,
  },
  metricScroll: {
    marginHorizontal: -spacing[4],
    paddingHorizontal: spacing[4],
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingVertical: 2,
  },
  metricChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
