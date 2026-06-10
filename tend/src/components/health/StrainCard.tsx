import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { TText } from '@/components/ui/TText';
import { SparklineChart } from './SparklineChart';
import { colors, spacing } from '@/theme';
import type { HealthTrendPoint } from '@/contexts/HealthContext';

interface StrainCardProps {
  score: number | null;
  activeCalories: number | null;
  exerciseMinutes: number | null;
  avgHr: number | null;
  trends: HealthTrendPoint[];
}

// HR zone distribution is estimated from avg HR
function estimateZones(exerciseMinutes: number, avgHr: number, userAge = 35) {
  const maxHr = 220 - userAge;
  const pct = avgHr / maxHr;

  // Rough distribution based on avg HR intensity
  const hard = pct > 0.85 ? 0.5 : pct > 0.75 ? 0.3 : 0.15;
  const moderate = pct > 0.7 ? 0.4 : 0.35;
  const easy = 1 - hard - moderate;

  return {
    easy: Math.round(exerciseMinutes * easy),
    moderate: Math.round(exerciseMinutes * moderate),
    hard: Math.round(exerciseMinutes * hard),
  };
}

export function StrainCard({ score, activeCalories, exerciseMinutes, avgHr, trends }: StrainCardProps) {
  const displayScore = score != null ? String(score) : '--';
  const displayCals = activeCalories != null ? String(activeCalories) : '--';
  const displayMin = exerciseMinutes != null ? `${exerciseMinutes}m` : '--';

  const strainTrend = trends.slice(-7).map((t) => ({ value: t.strainScore }));

  const strainLabel = score == null ? ''
    : score > 17 ? 'High'
    : score > 13 ? 'Strenuous'
    : score > 9 ? 'Moderate'
    : score > 5 ? 'Low'
    : 'Minimal';

  const strainColor = score == null ? colors.textPrimary
    : score > 17 ? colors.danger
    : score > 13 ? colors.accentWarm
    : score > 9 ? colors.warning
    : colors.success;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View>
          <TText variant="heading">Strain</TText>
          <TText variant="caption" color="secondary">0 – 21 scale</TText>
        </View>
        <SparklineChart
          data={strainTrend}
          width={80}
          height={28}
          color={colors.accentWarm}
          showArea
        />
      </View>

      <View style={styles.scoreRow}>
        <TText style={[styles.bigScore, { color: strainColor }]}>{displayScore}</TText>
        {strainLabel ? (
          <View style={[styles.pill, { backgroundColor: `${strainColor}15` }]}>
            <TText variant="small" style={{ color: strainColor }}>{strainLabel}</TText>
          </View>
        ) : null}
      </View>

      <View style={styles.metricsRow}>
        <Metric label="Active Cal" value={displayCals} />
        <Metric label="Exercise" value={displayMin} />
        {avgHr && <Metric label="Avg HR" value={`${avgHr} bpm`} />}
      </View>

      {exerciseMinutes != null && exerciseMinutes > 0 && avgHr != null && (
        <HRZoneBar
          exerciseMinutes={exerciseMinutes}
          zones={estimateZones(exerciseMinutes, avgHr)}
        />
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={metricStyles.container}>
      <TText variant="mono" style={metricStyles.value}>{value}</TText>
      <TText variant="caption" color="secondary">{label}</TText>
    </View>
  );
}

const metricStyles = StyleSheet.create({
  container: { gap: 2 },
  value: { fontSize: 18, color: colors.textPrimary, fontWeight: '600' },
});

function HRZoneBar({
  exerciseMinutes,
  zones,
}: {
  exerciseMinutes: number;
  zones: { easy: number; moderate: number; hard: number };
}) {
  const total = exerciseMinutes || 1;
  return (
    <View style={zoneStyles.container}>
      <TText variant="caption" color="secondary">HR Zones</TText>
      <View style={zoneStyles.bar}>
        <View style={[zoneStyles.zone, { flex: zones.easy / total, backgroundColor: colors.success }]} />
        <View style={[zoneStyles.zone, { flex: zones.moderate / total, backgroundColor: colors.warning }]} />
        <View style={[zoneStyles.zone, { flex: zones.hard / total, backgroundColor: colors.accentWarm }]} />
      </View>
      <View style={zoneStyles.legend}>
        <TText variant="small" color="secondary">Easy {zones.easy}m</TText>
        <TText variant="small" color="secondary">Moderate {zones.moderate}m</TText>
        <TText variant="small" color="secondary">Hard {zones.hard}m</TText>
      </View>
    </View>
  );
}

const zoneStyles = StyleSheet.create({
  container: { gap: 4 },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.border,
    gap: 1,
  },
  zone: { borderRadius: 4 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  bigScore: {
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing[6],
  },
});
