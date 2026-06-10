/**
 * HealthKit integration for Tend.
 * Apple Watch SE 2nd Gen: NO SpO2, NO skin temperature. Never query those.
 */
import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
} from 'react-native-health';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HKSample {
  startDate: string;
  endDate: string;
  value: number;
}

export interface HKSleepSample {
  startDate: string;
  endDate: string;
  value: 'INBED' | 'ASLEEP' | 'AWAKE' | 'ASLEEPCORE' | 'ASLEEPDEEP' | 'ASLEEPREM';
}

export interface HKWorkoutSample {
  activityName: string;
  calories: number;
  duration: number; // seconds
  startDate: string;
  endDate: string;
  sourceName: string;
}

export interface DailyHealthData {
  date: string;
  hrv: number | null;           // SDNN in ms
  restingHr: number | null;     // bpm
  sleepHours: number | null;
  sleepEfficiency: number | null;
  sleepStages: SleepStages | null;
  activeCalories: number | null;
  exerciseMinutes: number | null;
  avgWorkoutHr: number | null;
  steps: number | null;
  workouts: HKWorkoutSample[];
}

export interface SleepStages {
  core: number;   // hours
  deep: number;   // hours
  rem: number;    // hours
  awake: number;  // hours during sleep window
}

// ─── Permissions ─────────────────────────────────────────────────────────────

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.AppleExerciseTime,
      AppleHealthKit.Constants.Permissions.Workout,
    ],
    write: [
      AppleHealthKit.Constants.Permissions.Workout,
    ],
  },
};

let _initialized = false;

export function initHealthKit(): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  if (_initialized) return Promise.resolve();

  return new Promise((resolve, reject) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (err) => {
      if (err) {
        reject(new Error(err));
      } else {
        _initialized = true;
        resolve();
      }
    });
  });
}

// ─── Raw fetchers (promisified) ───────────────────────────────────────────────

function dateISO(d: Date) {
  return d.toISOString();
}

function startOfDay(d: Date) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function fetchHRV(startDate: Date, endDate: Date): Promise<HKSample[]> {
  if (Platform.OS !== 'ios') return Promise.resolve([]);
  return new Promise((resolve) => {
    AppleHealthKit.getHeartRateVariabilitySamples(
      { startDate: dateISO(startDate), endDate: dateISO(endDate) },
      (err, results) => {
        if (err) { resolve([]); return; }
        resolve((results as HKSample[]) ?? []);
      },
    );
  });
}

export function fetchRestingHR(startDate: Date, endDate: Date): Promise<HKSample[]> {
  if (Platform.OS !== 'ios') return Promise.resolve([]);
  return new Promise((resolve) => {
    AppleHealthKit.getRestingHeartRate(
      { startDate: dateISO(startDate), endDate: dateISO(endDate) },
      (err, result) => {
        if (err || !result) { resolve([]); return; }
        // API returns single sample or array depending on version
        const arr = Array.isArray(result) ? result : [result];
        resolve(arr as HKSample[]);
      },
    );
  });
}

export function fetchSleepSamples(startDate: Date, endDate: Date): Promise<HKSleepSample[]> {
  if (Platform.OS !== 'ios') return Promise.resolve([]);
  return new Promise((resolve) => {
    AppleHealthKit.getSleepSamples(
      { startDate: dateISO(startDate), endDate: dateISO(endDate) },
      (err, results) => {
        if (err) { resolve([]); return; }
        resolve((results as HKSleepSample[]) ?? []);
      },
    );
  });
}

export function fetchActiveCalories(startDate: Date, endDate: Date): Promise<number> {
  if (Platform.OS !== 'ios') return Promise.resolve(0);
  return new Promise((resolve) => {
    AppleHealthKit.getActiveEnergyBurned(
      { startDate: dateISO(startDate), endDate: dateISO(endDate) },
      (err, results) => {
        if (err || !results) { resolve(0); return; }
        const total = (results as HKSample[]).reduce((sum, s) => sum + (s.value ?? 0), 0);
        resolve(Math.round(total));
      },
    );
  });
}

export function fetchExerciseMinutes(startDate: Date, endDate: Date): Promise<number> {
  if (Platform.OS !== 'ios') return Promise.resolve(0);
  return new Promise((resolve) => {
    AppleHealthKit.getAppleExerciseTime(
      { startDate: dateISO(startDate), endDate: dateISO(endDate), includeManuallyAdded: false },
      (err, result) => {
        if (err || !result) { resolve(0); return; }
        resolve(Math.round((result as { value: number }).value ?? 0));
      },
    );
  });
}

export function fetchHeartRateSamples(startDate: Date, endDate: Date): Promise<HKSample[]> {
  if (Platform.OS !== 'ios') return Promise.resolve([]);
  return new Promise((resolve) => {
    AppleHealthKit.getHeartRateSamples(
      { startDate: dateISO(startDate), endDate: dateISO(endDate) },
      (err, results) => {
        if (err) { resolve([]); return; }
        resolve((results as HKSample[]) ?? []);
      },
    );
  });
}

export function fetchSteps(startDate: Date, endDate: Date): Promise<number> {
  if (Platform.OS !== 'ios') return Promise.resolve(0);
  return new Promise((resolve) => {
    AppleHealthKit.getStepCount(
      { startDate: dateISO(startDate), endDate: dateISO(endDate) },
      (err, result) => {
        if (err || !result) { resolve(0); return; }
        resolve(Math.round((result as { value: number }).value ?? 0));
      },
    );
  });
}

export function fetchWorkouts(startDate: Date, endDate: Date): Promise<HKWorkoutSample[]> {
  if (Platform.OS !== 'ios') return Promise.resolve([]);
  return new Promise((resolve) => {
    AppleHealthKit.getWorkoutSamples(
      { startDate: dateISO(startDate), endDate: dateISO(endDate) },
      (err, results) => {
        if (err) { resolve([]); return; }
        resolve((results as unknown as HKWorkoutSample[]) ?? []);
      },
    );
  });
}

// ─── Sleep parsing ────────────────────────────────────────────────────────────

export function parseSleepSamples(samples: HKSleepSample[]): {
  totalHours: number;
  efficiency: number | null;
  stages: SleepStages | null;
} {
  let inBedMs = 0;
  let asleepMs = 0;
  let coreMs = 0;
  let deepMs = 0;
  let remMs = 0;
  let awakeMs = 0;

  for (const s of samples) {
    const dur = new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
    if (dur <= 0) continue;
    switch (s.value) {
      case 'INBED': inBedMs += dur; break;
      case 'ASLEEP': asleepMs += dur; break;
      case 'ASLEEPCORE': coreMs += dur; break;
      case 'ASLEEPDEEP': deepMs += dur; break;
      case 'ASLEEPREM': remMs += dur; break;
      case 'AWAKE': awakeMs += dur; break;
    }
  }

  const totalAsleepMs = asleepMs + coreMs + deepMs + remMs;
  const totalHours = totalAsleepMs / 3_600_000;
  const efficiency = inBedMs > 0 ? totalAsleepMs / inBedMs : null;

  const hasStages = coreMs + deepMs + remMs > 0;
  const stages: SleepStages | null = hasStages
    ? {
        core: coreMs / 3_600_000,
        deep: deepMs / 3_600_000,
        rem: remMs / 3_600_000,
        awake: awakeMs / 3_600_000,
      }
    : null;

  return { totalHours, efficiency, stages };
}

// ─── Aggregate daily fetch ────────────────────────────────────────────────────

export async function fetchDailyData(date: Date): Promise<DailyHealthData> {
  const dayStart = startOfDay(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Sleep covers the prior night: 6pm yesterday → noon today
  const sleepStart = new Date(dayStart);
  sleepStart.setDate(sleepStart.getDate() - 1);
  sleepStart.setHours(18, 0, 0, 0);
  const sleepEnd = new Date(dayStart);
  sleepEnd.setHours(12, 0, 0, 0);

  const [hrvSamples, hrSamples, sleepSamples, activeCalories, exerciseMinutes, steps] =
    await Promise.all([
      fetchHRV(dayStart, dayEnd),
      fetchRestingHR(dayStart, dayEnd),
      fetchSleepSamples(sleepStart, sleepEnd),
      fetchActiveCalories(dayStart, dayEnd),
      fetchExerciseMinutes(dayStart, dayEnd),
      fetchSteps(dayStart, dayEnd),
    ]);

  // HRV: take the most recent sample (Watch records overnight)
  const hrv = hrvSamples.length > 0
    ? hrvSamples[hrvSamples.length - 1].value
    : null;

  // Resting HR: most recent
  const restingHr = hrSamples.length > 0
    ? hrSamples[hrSamples.length - 1].value
    : null;

  // Sleep
  const { totalHours: sleepHours, efficiency: sleepEfficiency, stages: sleepStages } =
    parseSleepSamples(sleepSamples);

  // Avg workout HR for today (use during-workout HR samples)
  const workoutHrSamples = await fetchHeartRateSamples(dayStart, dayEnd);
  const avgWorkoutHr = workoutHrSamples.length > 0
    ? Math.round(workoutHrSamples.reduce((s, r) => s + r.value, 0) / workoutHrSamples.length)
    : null;

  return {
    date: dayStart.toISOString().split('T')[0],
    hrv,
    restingHr,
    sleepHours: sleepHours > 0 ? sleepHours : null,
    sleepEfficiency,
    sleepStages,
    activeCalories: activeCalories || null,
    exerciseMinutes: exerciseMinutes || null,
    avgWorkoutHr,
    steps: steps || null,
    workouts: [],
  };
}

/**
 * Fetch the last N days of HRV + resting HR for baseline building.
 * Returns one entry per day (most recent sample per day).
 */
export async function fetchHistoricalBaseline(days: number): Promise<
  Array<{ date: string; hrv: number | null; restingHr: number | null }>
> {
  const results: Array<{ date: string; hrv: number | null; restingHr: number | null }> = [];

  for (let i = 0; i < days; i++) {
    const d = daysAgo(i);
    const start = startOfDay(d);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [hrvSamples, hrSamples] = await Promise.all([
      fetchHRV(start, end),
      fetchRestingHR(start, end),
    ]);

    results.push({
      date: start.toISOString().split('T')[0],
      hrv: hrvSamples.length > 0 ? hrvSamples[hrvSamples.length - 1].value : null,
      restingHr: hrSamples.length > 0 ? hrSamples[hrSamples.length - 1].value : null,
    });
  }

  return results;
}
