import type { ComputedBaseline } from '@/lib/baseline';

// ─── Recovery Score ───────────────────────────────────────────────────────────

export interface RecoveryInput {
  hrv: number | null;
  restingHr: number | null;
  sleepHours: number | null;
  sleepEfficiency: number | null;
  baseline: ComputedBaseline;
  stressInferred?: boolean;
}

export function calculateRecoveryScore({
  hrv,
  restingHr,
  sleepHours,
  sleepEfficiency,
  baseline,
  stressInferred = false,
}: RecoveryInput): number {
  // HRV: higher = better. Normalize against rolling personal baseline.
  const hrvScore = hrv != null
    ? Math.min((hrv / baseline.hrvMedian) * 100, 100)
    : 50;

  // Resting HR: lower = better. Each bpm above baseline costs 5 points.
  const hrScore = restingHr != null
    ? Math.max(100 - ((restingHr - baseline.restingHrMedian) * 5), 0)
    : 50;

  // Sleep: 7–9 hours optimal.
  const sleepScore = sleepHours == null ? 50
    : sleepHours >= 7 && sleepHours <= 9 ? 100
    : sleepHours < 7 ? (sleepHours / 7) * 100
    : Math.max(100 - ((sleepHours - 9) * 20), 60);

  // Sleep efficiency bonus
  const efficiencyBonus = sleepEfficiency != null && sleepEfficiency >= 0.85 ? 5 : 0;

  const raw = Math.round(
    hrvScore * 0.40 +
    hrScore * 0.30 +
    sleepScore * 0.25 +
    efficiencyBonus,
  );

  // Stress inference dampens score by up to 10 points
  return Math.min(Math.max(stressInferred ? raw - 10 : raw, 0), 100);
}

// ─── Strain Score ─────────────────────────────────────────────────────────────

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

// ─── Readiness Score ──────────────────────────────────────────────────────────

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
