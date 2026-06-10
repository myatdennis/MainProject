import React from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { TText } from '@/components/ui/TText';
import { Card } from '@/components/ui/Card';
import { RecoveryRing } from '@/components/RecoveryRing';
import { Divider } from '@/components/ui/Divider';
import { colors, spacing } from '@/theme';
import { getRecoveryZone } from '@/types';
import { calculateStrainScore, calculateReadinessScore } from '@/hooks/useRecoveryScore';

// Placeholder values — Sprint 2 wires HealthKit
const MOCK = {
  recovery: 74,
  sleepHours: 7.2,
  sleepEfficiency: 0.87,
  activeCalories: 420,
  exerciseMinutes: 48,
  avgHR: 142,
  yesterdayStrain: 12,
};

export function MeScreen() {
  const zone = getRecoveryZone(MOCK.recovery);
  const strain = calculateStrainScore({
    activeCalories: MOCK.activeCalories,
    exerciseMinutes: MOCK.exerciseMinutes,
    avgHeartRate: MOCK.avgHR,
  });
  const readiness = calculateReadinessScore({
    recoveryScore: MOCK.recovery,
    yesterdayStrainScore: MOCK.yesterdayStrain,
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TText variant="title">Me</TText>
          <TText variant="caption" color="secondary">Body + progress</TText>
        </View>

        {/* Recovery Card */}
        <Card style={styles.recoveryCard}>
          <View style={styles.recoveryRow}>
            <RecoveryRing score={MOCK.recovery} size={120} showScore />
            <View style={styles.recoveryMeta}>
              <MetricPill
                label="Readiness"
                value={String(readiness)}
                color={colors.accent}
              />
              <MetricPill
                label="Strain"
                value={String(strain)}
                color={colors.accentWarm}
              />
              <TText variant="caption" color="secondary" style={{ marginTop: spacing[2] }}>
                {zone === 'high' ? 'Well recovered'
                  : zone === 'moderate' ? 'Moderate'
                  : 'Rest day'}
              </TText>
            </View>
          </View>
        </Card>

        <Divider />

        {/* Sleep Card */}
        <Card style={styles.card}>
          <TText variant="heading">Sleep</TText>
          <View style={styles.metricsRow}>
            <Metric label="Duration" value={`${MOCK.sleepHours}h`} />
            <Metric label="Efficiency" value={`${Math.round(MOCK.sleepEfficiency * 100)}%`} />
          </View>
          <TText variant="caption" color="secondary">
            Efficiency = time asleep ÷ time in bed. Above 85% is solid.
          </TText>
        </Card>

        <Divider />

        {/* Strain Card */}
        <Card style={styles.card}>
          <TText variant="heading">Strain</TText>
          <View style={styles.metricsRow}>
            <Metric label="Score" value={String(strain)} />
            <Metric label="Active Cal" value={String(MOCK.activeCalories)} />
            <Metric label="Exercise" value={`${MOCK.exerciseMinutes}m`} />
          </View>
          <HRZoneBar exerciseMinutes={MOCK.exerciseMinutes} />
        </Card>

        <Divider />

        {/* Progress Sections */}
        <View style={styles.section}>
          <TText variant="heading">Progress</TText>
          {['Strength', 'Body', 'Feel'].map((view) => (
            <Card key={view} style={[styles.card, styles.progressRow]}>
              <TText variant="medium">{view}</TText>
              <TText variant="caption" color="secondary">▸</TText>
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
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
  container: { alignItems: 'center', gap: 2 },
  value: { fontSize: 22, color: colors.textPrimary, fontWeight: '600' },
});

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={pillStyles.container}>
      <TText style={[pillStyles.value, { color }]}>{value}</TText>
      <TText variant="caption" color="secondary">{label}</TText>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
  },
});

function HRZoneBar({ exerciseMinutes }: { exerciseMinutes: number }) {
  // Placeholder distribution — Sprint 6 uses real HealthKit data
  const easy = Math.round(exerciseMinutes * 0.4);
  const moderate = Math.round(exerciseMinutes * 0.4);
  const hard = exerciseMinutes - easy - moderate;

  const total = exerciseMinutes || 1;

  return (
    <View style={zoneStyles.container}>
      <TText variant="caption" color="secondary" style={{ marginBottom: 6 }}>HR Zones</TText>
      <View style={zoneStyles.bar}>
        <View style={[zoneStyles.zone, { flex: easy / total, backgroundColor: colors.success }]} />
        <View style={[zoneStyles.zone, { flex: moderate / total, backgroundColor: colors.warning }]} />
        <View style={[zoneStyles.zone, { flex: hard / total, backgroundColor: colors.accentWarm }]} />
      </View>
      <View style={zoneStyles.legend}>
        <TText variant="small" color="secondary">Easy {easy}m</TText>
        <TText variant="small" color="secondary">Moderate {moderate}m</TText>
        <TText variant="small" color="secondary">Hard {hard}m</TText>
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
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing[4],
    paddingBottom: 120,
    gap: spacing[4],
  },
  header: {
    gap: spacing[1],
    paddingTop: spacing[2],
  },
  recoveryCard: {
    padding: spacing[4],
  },
  recoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  recoveryMeta: {
    flex: 1,
    gap: spacing[2],
  },
  card: {
    padding: spacing[4],
    gap: spacing[3],
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  section: {
    gap: spacing[3],
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
  },
});
