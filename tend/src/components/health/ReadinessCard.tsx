import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { TText } from '@/components/ui/TText';
import { colors, spacing } from '@/theme';

interface ReadinessCardProps {
  score: number | null;
  recoveryScore: number | null;
  yesterdayStrain: number;
  stressInferred: boolean;
  isBuilding: boolean;
}

function getReadinessRecommendation(
  score: number,
  stressInferred: boolean,
  yesterdayStrain: number,
): string {
  if (stressInferred) {
    return "Your nervous system is working hard today. Keep demands light.";
  }
  if (score >= 75) {
    return "Your body is primed. Today is a good day to push.";
  }
  if (score >= 55) {
    return yesterdayStrain > 12
      ? "Good recovery considering yesterday's effort. Moderate intensity today."
      : "You're ready for a solid session. Stay within your plan.";
  }
  if (score >= 35) {
    return "Your body is still absorbing load. Reduce volume 20% today.";
  }
  return "Rest or rehab only today. Your body needs the time.";
}

export function ReadinessCard({
  score,
  recoveryScore,
  yesterdayStrain,
  stressInferred,
  isBuilding,
}: ReadinessCardProps) {
  const displayScore = score != null ? String(score) : '--';
  const scoreColor = score == null ? colors.textPrimary
    : score >= 67 ? colors.success
    : score >= 34 ? colors.warning
    : colors.danger;

  const recommendation = score != null
    ? getReadinessRecommendation(score, stressInferred, yesterdayStrain)
    : null;

  return (
    <Card style={styles.card}>
      <TText variant="heading">Readiness</TText>

      <View style={styles.scoreRow}>
        <TText style={[styles.bigScore, { color: scoreColor }]}>{displayScore}</TText>
        <View style={styles.components}>
          {recoveryScore != null && (
            <ComponentRow label="Recovery" value={recoveryScore} />
          )}
          {yesterdayStrain > 0 && (
            <ComponentRow label="Yesterday's strain" value={yesterdayStrain} isNegative />
          )}
        </View>
      </View>

      {recommendation && (
        <View style={styles.recommendationBox}>
          <TText variant="body" style={styles.recommendationText}>
            {recommendation}
          </TText>
        </View>
      )}

      {isBuilding && (
        <TText variant="caption" color="secondary">
          Scores improve as your baseline builds over the next 2 weeks.
        </TText>
      )}
    </Card>
  );
}

function ComponentRow({
  label,
  value,
  isNegative = false,
}: {
  label: string;
  value: number;
  isNegative?: boolean;
}) {
  return (
    <View style={componentStyles.row}>
      <TText variant="caption" color="secondary" style={{ flex: 1 }}>{label}</TText>
      <TText
        variant="mono"
        style={{ color: isNegative ? colors.accentWarm : colors.textSecondary }}
      >
        {isNegative ? `−${value}` : `+${value}`}
      </TText>
    </View>
  );
}

const componentStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
});

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
    gap: spacing[3],
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[6],
  },
  bigScore: {
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 52,
  },
  components: {
    flex: 1,
    gap: spacing[1],
    paddingTop: spacing[2],
  },
  recommendationBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: spacing[3],
  },
  recommendationText: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
