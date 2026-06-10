import { useState, useEffect } from 'react';
import { healthCache, getObject, setObject } from '@/lib/storage';

export interface RecoveryInput {
  hrv: number | null;
  restingHr: number | null;
  sleepHours: number | null;
  sleepEfficiency: number | null;
}

interface UserBaseline {
  hrvMedian: number;
  restingHrMedian: number;
  daysOfData: number;
}

function getBaseline(): UserBaseline {
  return getObject<UserBaseline>(healthCache, 'baseline') ?? {
    hrvMedian: 45,
    restingHrMedian: 65,
    daysOfData: 0,
  };
}

export function calculateRecoveryScore({
  hrv,
  restingHr,
  sleepHours,
  sleepEfficiency,
}: RecoveryInput): number {
  const baseline = getBaseline();

  // HRV: higher = better
  const hrvScore = hrv != null
    ? Math.min((hrv / baseline.hrvMedian) * 100, 100)
    : 50;

  // Resting HR: lower = better
  const hrScore = restingHr != null
    ? Math.max(100 - ((restingHr - baseline.restingHrMedian) * 5), 0)
    : 50;

  // Sleep: 7–9 hours optimal
  const sleepScore = sleepHours == null ? 50
    : sleepHours >= 7 && sleepHours <= 9 ? 100
    : sleepHours < 7 ? (sleepHours / 7) * 100
    : Math.max(100 - ((sleepHours - 9) * 20), 60);

  // Efficiency bonus
  const efficiencyBonus = sleepEfficiency != null && sleepEfficiency >= 0.85 ? 5 : 0;

  // Stress inference: HRV suppression + HR elevation
  const stressed =
    restingHr != null &&
    hrv != null &&
    restingHr > baseline.restingHrMedian + 5 &&
    hrv < baseline.hrvMedian * 0.85;

  const raw = Math.round(
    hrvScore * 0.4 +
    hrScore * 0.3 +
    sleepScore * 0.25 +
    efficiencyBonus,
  );

  return Math.min(Math.max(stressed ? raw - 10 : raw, 0), 100);
}

export function calculateStrainScore({
  activeCalories,
  exerciseMinutes,
  avgHeartRate,
  userAge = 35,
}: {
  activeCalories: number;
  exerciseMinutes: number;
  avgHeartRate: number;
  userAge?: number;
}): number {
  const estimatedMaxHR = 220 - userAge;
  const heartRateReserve = avgHeartRate / estimatedMaxHR;
  const effortScore = heartRateReserve * exerciseMinutes * 0.1;
  const calorieScore = activeCalories / 500;
  return Math.min(Math.round((effortScore + calorieScore) * 50), 21);
}

export function calculateReadinessScore({
  recoveryScore,
  yesterdayStrainScore,
}: {
  recoveryScore: number;
  yesterdayStrainScore: number;
}): number {
  const strainPenalty =
    yesterdayStrainScore > 14 ? 15
    : yesterdayStrainScore > 10 ? 8
    : 0;
  return Math.max(recoveryScore - strainPenalty, 0);
}

export function useRecoveryScore(input: RecoveryInput | null) {
  const [score, setScore] = useState<number | null>(null);
  const [baselineDays, setBaselineDays] = useState(0);

  useEffect(() => {
    const baseline = getBaseline();
    setBaselineDays(baseline.daysOfData);

    if (input) {
      setScore(calculateRecoveryScore(input));
    }
  }, [input]);

  return { score, baselineDays, isBuilding: baselineDays < 14 };
}
