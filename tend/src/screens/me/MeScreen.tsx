import React from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { TText } from '@/components/ui/TText';
import { Card, PressableCard } from '@/components/ui/Card';
import { RecoveryRing } from '@/components/RecoveryRing';
import { Divider } from '@/components/ui/Divider';
import { SparklineChart } from '@/components/health/SparklineChart';
import { SleepCard } from '@/components/health/SleepCard';
import { StrainCard } from '@/components/health/StrainCard';
import { ReadinessCard } from '@/components/health/ReadinessCard';
import { ActivityRings } from '@/components/health/ActivityRings';
import { TrendsChart } from '@/components/health/TrendsChart';
import { BaselineBanner } from '@/components/health/BaselineBanner';
import { useHealth, useSleep, useStrain, useTrends } from '@/hooks/useHealth';
import { getRecoveryZone } from '@/types';
import { colors, spacing } from '@/theme';

export function MeScreen() {
  const {
    today,
    trends,
    baseline,
    isLoading,
    permissionGranted,
    requestPermissions,
  } = useHealth();

  const sleep = useSleep();
  const strain = useStrain();
  const trends7 = useTrends(7);

  // Recovery sparkline for card header
  const recoverySparkData = trends7.map((t) => ({ value: t.recoveryScore }));

  if (!permissionGranted) {
    return <HealthPermissionPrompt onRequest={requestPermissions} />;
  }

  if (isLoading && !today) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} />
          <TText variant="caption" color="secondary" style={{ marginTop: spacing[3] }}>
            Reading your health data…
          </TText>
        </View>
      </SafeAreaView>
    );
  }

  const recoveryScore = today?.recoveryScore ?? 0;
  const zone = getRecoveryZone(recoveryScore);

  const recoverLabel = zone === 'high' ? 'Well recovered'
    : zone === 'moderate' ? 'Moderate'
    : 'Rest day';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TText variant="title">Me</TText>
          <TText variant="caption" color="secondary">Body + progress</TText>
        </View>

        {/* Baseline building notice */}
        {!baseline.isReliable && (
          <BaselineBanner daysOfData={baseline.daysOfData} />
        )}

        {/* 1. Recovery Card */}
        <Card style={styles.recoveryCard}>
          <View style={styles.recoveryHeader}>
            <View style={styles.recoveryLeft}>
              <RecoveryRing score={recoveryScore} size={120} showScore />
            </View>
            <View style={styles.recoveryRight}>
              <TText variant="heading">{recoverLabel}</TText>
              {today?.stressInferred && (
                <TText variant="caption" style={styles.stressTag}>
                  Stress detected
                </TText>
              )}
              <SparklineChart
                data={recoverySparkData}
                width={140}
                height={36}
                color={colors.success}
                showDots
                showArea
              />
              <TText variant="small" color="secondary">7-day recovery trend</TText>
            </View>
          </View>
        </Card>

        <Divider />

        {/* 2. Sleep Card */}
        <SleepCard
          hours={sleep.hours}
          efficiency={sleep.efficiency}
          stages={sleep.stages}
          trends={trends}
        />

        <Divider />

        {/* 3. Strain Card */}
        <StrainCard
          score={strain.score}
          activeCalories={strain.activeCalories}
          exerciseMinutes={strain.exerciseMinutes}
          avgHr={strain.avgHr}
          trends={trends}
        />

        <Divider />

        {/* 4. Readiness Card */}
        <ReadinessCard
          score={today?.readinessScore ?? null}
          recoveryScore={recoveryScore}
          yesterdayStrain={today?.yesterdayStrain ?? 0}
          stressInferred={today?.stressInferred ?? false}
          isBuilding={!baseline.isReliable}
        />

        <Divider />

        {/* 5. Activity Rings */}
        <Card style={styles.card}>
          <TText variant="heading">Activity</TText>
          <ActivityRings
            activeCalories={today?.raw.activeCalories ?? null}
            exerciseMinutes={today?.raw.exerciseMinutes ?? null}
            stepCount={today?.raw.steps ?? null}
          />
        </Card>

        <Divider />

        {/* 6. Trends Chart */}
        <TrendsChart trends={trends} />

        <Divider />

        {/* 7. Progress stubs — Sprint 7 */}
        <View style={styles.section}>
          <TText variant="heading">Progress</TText>
          {(['Strength', 'Body', 'Feel'] as const).map((view) => (
            <PressableCard
              key={view}
              style={styles.progressRow}
              onPress={() => {}}
              accessibilityLabel={`${view} progress`}
              accessibilityRole="button"
            >
              <TText variant="medium">{view}</TText>
              <TText variant="caption" color="secondary">▸</TText>
            </PressableCard>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HealthPermissionPrompt({ onRequest }: { onRequest: () => void }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.permissionContainer}>
        <TText variant="title" style={{ textAlign: 'center' }}>Connect Apple Health</TText>
        <TText variant="body" color="secondary" style={styles.permissionText}>
          Tend reads your HRV, resting heart rate, and sleep to calculate your recovery score.
          {'\n\n'}
          Your data stays on your device.
        </TText>
        <PressableCard style={styles.permissionButton} onPress={onRequest} accessibilityRole="button">
          <TText variant="medium" color="accent" style={{ textAlign: 'center' }}>
            Connect Apple Health
          </TText>
        </PressableCard>
      </View>
    </SafeAreaView>
  );
}

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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryCard: {
    padding: spacing[4],
  },
  recoveryHeader: {
    flexDirection: 'row',
    gap: spacing[4],
    alignItems: 'center',
  },
  recoveryLeft: {
    alignItems: 'center',
  },
  recoveryRight: {
    flex: 1,
    gap: spacing[2],
  },
  stressTag: {
    color: colors.warning,
    backgroundColor: `${colors.warning}15`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  card: {
    padding: spacing[4],
    gap: spacing[3],
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
  permissionContainer: {
    flex: 1,
    padding: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[6],
  },
  permissionText: {
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionButton: {
    padding: spacing[4],
    width: '100%',
  },
});
