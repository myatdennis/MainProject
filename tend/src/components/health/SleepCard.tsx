import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { TText } from '@/components/ui/TText';
import { SparklineChart } from './SparklineChart';
import { colors, spacing } from '@/theme';
import type { SleepStages } from '@/lib/healthkit';
import type { HealthTrendPoint } from '@/contexts/HealthContext';

interface SleepCardProps {
  hours: number | null;
  efficiency: number | null;
  stages: SleepStages | null;
  trends: HealthTrendPoint[];
}

export function SleepCard({ hours, efficiency, stages, trends }: SleepCardProps) {
  const displayHours = hours != null ? formatHours(hours) : '--';
  const displayEfficiency = efficiency != null ? `${Math.round(efficiency * 100)}%` : '--';

  const sleepTrend = trends
    .slice(-7)
    .map((t) => ({ value: t.sleepHours }));

  const effLabel = efficiency == null
    ? ''
    : efficiency >= 0.9 ? 'Excellent'
    : efficiency >= 0.85 ? 'Good'
    : efficiency >= 0.75 ? 'Fair'
    : 'Poor';

  const effColor = efficiency == null
    ? colors.textSecondary
    : efficiency >= 0.85 ? colors.success
    : efficiency >= 0.75 ? colors.warning
    : colors.accentWarm;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <TText variant="heading">Sleep</TText>
        <SparklineChart
          data={sleepTrend}
          width={80}
          height={28}
          color={colors.accent}
          showArea
        />
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <TText variant="mono" style={styles.bigValue}>{displayHours}</TText>
          <TText variant="caption" color="secondary">Duration</TText>
          <TText variant="small" color="secondary">Time asleep last night</TText>
        </View>
        <View style={styles.metric}>
          <TText variant="mono" style={[styles.bigValue, { color: effColor }]}>
            {displayEfficiency}
          </TText>
          <TText variant="caption" color="secondary">Efficiency{effLabel ? ` · ${effLabel}` : ''}</TText>
          <TText variant="small" color="secondary">Time asleep ÷ time in bed</TText>
        </View>
      </View>

      {stages && (
        <SleepStagesBar stages={stages} totalHours={hours ?? 0} />
      )}
    </Card>
  );
}

function SleepStagesBar({
  stages,
  totalHours,
}: {
  stages: SleepStages;
  totalHours: number;
}) {
  const total = stages.core + stages.deep + stages.rem + stages.awake || 1;

  const segments = [
    { label: 'Core', hours: stages.core, color: colors.accent },
    { label: 'Deep', hours: stages.deep, color: '#6366F1' },
    { label: 'REM', hours: stages.rem, color: colors.success },
    { label: 'Awake', hours: stages.awake, color: colors.border },
  ];

  return (
    <View style={stagesStyles.container}>
      <TText variant="caption" color="secondary" style={{ marginBottom: spacing[2] }}>
        Sleep Stages
      </TText>

      {/* Stacked bar */}
      <View style={stagesStyles.bar}>
        {segments.map((seg) => (
          <View
            key={seg.label}
            style={[
              stagesStyles.segment,
              {
                flex: seg.hours / total,
                backgroundColor: seg.color,
              },
            ]}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={stagesStyles.legend}>
        {segments.map((seg) => (
          <View key={seg.label} style={stagesStyles.legendItem}>
            <View style={[stagesStyles.dot, { backgroundColor: seg.color }]} />
            <TText variant="small" color="secondary">
              {seg.label} {formatHours(seg.hours)}
            </TText>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatHours(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

const stagesStyles = StyleSheet.create({
  container: { gap: 6 },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    gap: 1,
  },
  segment: { borderRadius: 5 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
    gap: spacing[3],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  metric: {
    gap: 2,
  },
  bigValue: {
    fontSize: 24,
    color: colors.textPrimary,
    fontWeight: '600',
    lineHeight: 28,
  },
});
