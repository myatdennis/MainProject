import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  fetchDailyData,
  fetchHistoricalBaseline,
  initHealthKit,
  type DailyHealthData,
} from '@/lib/healthkit';
import {
  updateBaseline,
  seedBaseline,
  getComputedBaseline,
  isStressed,
  type ComputedBaseline,
} from '@/lib/baseline';
import {
  calculateRecoveryScore,
  calculateStrainScore,
  calculateReadinessScore,
} from '@/hooks/useRecoveryScore';
import { healthCache, getObject, setObject } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessedHealthDay {
  date: string;
  raw: DailyHealthData;
  baseline: ComputedBaseline;
  recoveryScore: number;
  strainScore: number;
  readinessScore: number;
  stressInferred: boolean;
  yesterdayStrain: number;
}

export interface HealthTrendPoint {
  date: string;
  hrv: number | null;
  restingHr: number | null;
  sleepHours: number | null;
  recoveryScore: number | null;
  strainScore: number | null;
}

interface HealthContextValue {
  today: ProcessedHealthDay | null;
  trends: HealthTrendPoint[];
  baseline: ComputedBaseline;
  isLoading: boolean;
  permissionGranted: boolean;
  requestPermissions: () => Promise<void>;
  refresh: () => Promise<void>;
}

const HealthContext = createContext<HealthContextValue>({
  today: null,
  trends: [],
  baseline: { hrvMedian: 45, restingHrMedian: 65, daysOfData: 0, isReliable: false },
  isLoading: false,
  permissionGranted: false,
  requestPermissions: async () => {},
  refresh: async () => {},
});

export function useHealthContext() {
  return useContext(HealthContext);
}

const TRENDS_CACHE_KEY = 'health_trends_v1';
const PERMISSION_KEY = 'healthkit_permission_granted';

// ─── Provider ─────────────────────────────────────────────────────────────────

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [today, setToday] = useState<ProcessedHealthDay | null>(null);
  const [trends, setTrends] = useState<HealthTrendPoint[]>(() => {
    return getObject<HealthTrendPoint[]>(healthCache, TRENDS_CACHE_KEY) ?? [];
  });
  const [baseline, setBaseline] = useState<ComputedBaseline>(getComputedBaseline());
  const [isLoading, setIsLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(
    () => healthCache.getBoolean(PERMISSION_KEY) ?? false,
  );

  const lastFetchDate = useRef<string>('');
  const permissionRef = useRef(permissionGranted);
  permissionRef.current = permissionGranted;

  // ── Build a trend point for a given date ─────────────────────────────────
  const buildTrendPoint = useCallback(async (date: Date): Promise<HealthTrendPoint> => {
    const dateStr = date.toISOString().split('T')[0];
    const cacheKey = `day_${dateStr}`;

    // Return cached if today's date is NOT this date (past days don't change)
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateStr !== todayStr) {
      const cached = getObject<HealthTrendPoint>(healthCache, cacheKey);
      if (cached) return cached;
    }

    try {
      const raw = await fetchDailyData(date);
      const b = getComputedBaseline();
      const recovery = calculateRecoveryScore({
        hrv: raw.hrv,
        restingHr: raw.restingHr,
        sleepHours: raw.sleepHours,
        sleepEfficiency: raw.sleepEfficiency,
        baseline: b,
        stressInferred: isStressed(raw.hrv, raw.restingHr),
      });
      const strain = calculateStrainScore({
        activeCalories: raw.activeCalories ?? 0,
        exerciseMinutes: raw.exerciseMinutes ?? 0,
        avgHeartRate: raw.avgWorkoutHr ?? 130,
      });
      const point: HealthTrendPoint = {
        date: dateStr,
        hrv: raw.hrv,
        restingHr: raw.restingHr,
        sleepHours: raw.sleepHours,
        recoveryScore: recovery,
        strainScore: strain,
      };
      if (dateStr !== todayStr) {
        setObject(healthCache, cacheKey, point);
      }
      return point;
    } catch {
      return { date: dateStr, hrv: null, restingHr: null, sleepHours: null, recoveryScore: null, strainScore: null };
    }
  }, []);

  // ── Refresh last 30 days of trends ────────────────────────────────────────
  const refreshTrends = useCallback(async () => {
    if (!permissionRef.current) return;

    const points: HealthTrendPoint[] = [];
    // Only fetch last 30 days from HealthKit; rely on cache + Supabase for older
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const point = await buildTrendPoint(d);
      points.push(point);
    }

    setObject(healthCache, TRENDS_CACHE_KEY, points);
    setTrends(points);
  }, [buildTrendPoint]);

  // ── Fetch + process today's data ──────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!permissionRef.current) return;

    const todayStr = new Date().toISOString().split('T')[0];
    if (lastFetchDate.current === todayStr) return;

    setIsLoading(true);
    try {
      const raw = await fetchDailyData(new Date());
      const userAge = 35;

      updateBaseline({ date: raw.date, hrv: raw.hrv, restingHr: raw.restingHr });
      const freshBaseline = getComputedBaseline();

      const stressInferred = isStressed(raw.hrv, raw.restingHr);

      const recoveryScore = calculateRecoveryScore({
        hrv: raw.hrv,
        restingHr: raw.restingHr,
        sleepHours: raw.sleepHours,
        sleepEfficiency: raw.sleepEfficiency,
        baseline: freshBaseline,
        stressInferred,
      });

      const strainScore = calculateStrainScore({
        activeCalories: raw.activeCalories ?? 0,
        exerciseMinutes: raw.exerciseMinutes ?? 0,
        avgHeartRate: raw.avgWorkoutHr ?? 130,
        userAge,
      });

      const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
      const yesterdayCache = getObject<{ strain: number }>(healthCache, `strain_${yesterdayStr}`);
      const yesterdayStrain = yesterdayCache?.strain ?? 0;

      const readinessScore = calculateReadinessScore({
        recoveryScore,
        yesterdayStrainScore: yesterdayStrain,
      });

      setObject(healthCache, `strain_${todayStr}`, { strain: strainScore });

      const processed: ProcessedHealthDay = {
        date: raw.date,
        raw,
        baseline: freshBaseline,
        recoveryScore,
        strainScore,
        readinessScore,
        stressInferred,
        yesterdayStrain,
      };

      setToday(processed);
      setBaseline(freshBaseline);
      lastFetchDate.current = todayStr;

      // Background: refresh trends + sync to Supabase
      refreshTrends().catch(() => {});
      syncToSupabase(processed).catch(() => {});
    } catch {
      // Silently fall back to cached data if available
    } finally {
      setIsLoading(false);
    }
  }, [refreshTrends]);

  // ── Request permissions + seed 30-day baseline ───────────────────────────
  const requestPermissions = useCallback(async () => {
    try {
      await initHealthKit();
      healthCache.set(PERMISSION_KEY, true);
      setPermissionGranted(true);
      permissionRef.current = true;

      const history = await fetchHistoricalBaseline(30);
      seedBaseline(history);
      setBaseline(getComputedBaseline());
    } catch {
      // HealthKit unavailable (simulator / Android) — graceful no-op
    }
  }, []);

  // ── Auto-refresh on mount + app foreground ───────────────────────────────
  useEffect(() => {
    if (permissionGranted) refresh();
  }, [permissionGranted, refresh]);

  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === 'active' && permissionRef.current) refresh();
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [refresh]);

  return (
    <HealthContext.Provider
      value={{ today, trends, baseline, isLoading, permissionGranted, requestPermissions, refresh }}
    >
      {children}
    </HealthContext.Provider>
  );
}

// ─── Supabase background sync ─────────────────────────────────────────────────

async function syncToSupabase(p: ProcessedHealthDay) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('health_snapshots').upsert({
    user_id: user.id,
    date: p.date,
    hrv: p.raw.hrv,
    resting_hr: p.raw.restingHr,
    sleep_hours: p.raw.sleepHours,
    sleep_efficiency: p.raw.sleepEfficiency,
    active_calories: p.raw.activeCalories,
    exercise_minutes: p.raw.exerciseMinutes,
    avg_heart_rate: p.raw.avgWorkoutHr,
    strain_score: p.strainScore,
    recovery_score: p.recoveryScore,
    readiness_score: p.readinessScore,
    stress_inferred: p.stressInferred,
  }, { onConflict: 'user_id,date' });
}
