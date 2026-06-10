import { useHealthContext } from '@/contexts/HealthContext';

export function useHealth() {
  return useHealthContext();
}

export function useRecovery() {
  const { today, baseline, isLoading } = useHealthContext();
  return {
    score: today?.recoveryScore ?? null,
    zone: today ? getZone(today.recoveryScore) : null,
    stressInferred: today?.stressInferred ?? false,
    isBuilding: !baseline.isReliable,
    daysOfData: baseline.daysOfData,
    isLoading,
  };
}

export function useStrain() {
  const { today } = useHealthContext();
  return {
    score: today?.strainScore ?? null,
    activeCalories: today?.raw.activeCalories ?? null,
    exerciseMinutes: today?.raw.exerciseMinutes ?? null,
    avgHr: today?.raw.avgWorkoutHr ?? null,
  };
}

export function useSleep() {
  const { today } = useHealthContext();
  return {
    hours: today?.raw.sleepHours ?? null,
    efficiency: today?.raw.sleepEfficiency ?? null,
    stages: today?.raw.sleepStages ?? null,
  };
}

export function useTrends(days: 7 | 30 | 90 = 7) {
  const { trends } = useHealthContext();
  return trends.slice(-days);
}

function getZone(score: number): 'high' | 'moderate' | 'low' {
  if (score >= 67) return 'high';
  if (score >= 34) return 'moderate';
  return 'low';
}
