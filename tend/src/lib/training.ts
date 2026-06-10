import { appStorage, getObject, setObject } from './storage';
import AppleHealthKit from 'react-native-health';
import { Platform } from 'react-native';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ExerciseCategory = 'push' | 'pull' | 'legs' | 'rehab' | 'core';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  equipment: string[];
  defaultSets: number;
  defaultReps: string; // e.g. "8-10" or "12"
  defaultRest: number; // seconds
  notes?: string;
}

export interface LoggedSet {
  reps: number;
  weight: number; // kg; 0 for bodyweight
  completed: boolean;
  rpe?: number; // 1-10
}

export interface ExerciseLog {
  exerciseId: string;
  sets: LoggedSet[];
}

export interface WorkoutSession {
  id: string;
  date: string;
  workoutName: string;
  workoutDay: number; // 0-6
  exercises: ExerciseLog[];
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number;
  estimatedCalories: number;
  notes: string;
  synced: boolean;
}

// ─── Exercise Library ───────────────────────────────────────────────────────

export const EXERCISE_LIBRARY: Exercise[] = [
  // ── Push ──
  { id: 'bench_press',     name: 'Dumbbell Bench Press',     category: 'push', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '8-10', defaultRest: 90 },
  { id: 'incline_press',   name: 'Incline DB Press',         category: 'push', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '10-12', defaultRest: 90 },
  { id: 'ohp',             name: 'Overhead Press',           category: 'push', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '8-10', defaultRest: 90 },
  { id: 'lateral_raise',   name: 'Lateral Raises',           category: 'push', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '12-15', defaultRest: 60 },
  { id: 'front_raise',     name: 'Front Raises',             category: 'push', equipment: ['dumbbells'], defaultSets: 2, defaultReps: '12', defaultRest: 60 },
  { id: 'pushup',          name: 'Push-ups',                 category: 'push', equipment: ['bodyweight'], defaultSets: 3, defaultReps: '12-15', defaultRest: 60 },
  // ── Pull ──
  { id: 'pullup',          name: 'Pull-ups',                 category: 'pull', equipment: ['bar'], defaultSets: 3, defaultReps: '6-8', defaultRest: 120 },
  { id: 'db_row',          name: 'Dumbbell Row',             category: 'pull', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '10-12', defaultRest: 90 },
  { id: 'face_pull',       name: 'Face Pulls',               category: 'pull', equipment: ['band'], defaultSets: 3, defaultReps: '15-20', defaultRest: 60, notes: 'High anchor, elbows high' },
  { id: 'band_row',        name: 'Band Rows',                category: 'pull', equipment: ['band'], defaultSets: 3, defaultReps: '15', defaultRest: 60 },
  { id: 'ytw',             name: 'YTW Raises',               category: 'pull', equipment: ['band'], defaultSets: 2, defaultReps: '12 each', defaultRest: 60, notes: 'Light band, perfect form' },
  // ── Legs ──
  { id: 'goblet_squat',    name: 'Goblet Squat',             category: 'legs', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '10-12', defaultRest: 90 },
  { id: 'bulgarian_split', name: 'Bulgarian Split Squat',    category: 'legs', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '8-10 each', defaultRest: 90 },
  { id: 'step_up',         name: 'Step-ups',                 category: 'legs', equipment: ['dumbbells', 'box'], defaultSets: 3, defaultReps: '10 each', defaultRest: 75 },
  { id: 'leg_extension',   name: 'Bodyweight Leg Extension', category: 'legs', equipment: ['band'], defaultSets: 3, defaultReps: '15', defaultRest: 60 },
  { id: 'rdl',             name: 'Romanian Deadlift',        category: 'legs', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '10-12', defaultRest: 90 },
  { id: 'hip_thrust',      name: 'Hip Thrust',               category: 'legs', equipment: ['dumbbells'], defaultSets: 3, defaultReps: '12-15', defaultRest: 75 },
  { id: 'nordic_curl',     name: 'Nordic Hamstring Curl',    category: 'legs', equipment: ['bodyweight'], defaultSets: 3, defaultReps: '5-8', defaultRest: 120, notes: 'Slow eccentric' },
  { id: 'calf_raise',      name: 'Calf Raises',              category: 'legs', equipment: ['bodyweight'], defaultSets: 3, defaultReps: '15-20', defaultRest: 45 },
  // ── Rehab ──
  { id: 'shoulder_cir',    name: 'Shoulder Circles',         category: 'rehab', equipment: ['bodyweight'], defaultSets: 2, defaultReps: '10 each dir', defaultRest: 30 },
  { id: 'band_dislocate',  name: 'Band Dislocates',          category: 'rehab', equipment: ['band'], defaultSets: 2, defaultReps: '10', defaultRest: 30, notes: 'Wide grip, no pain' },
  { id: 'scap_retract',    name: 'Scapular Retractions',     category: 'rehab', equipment: ['band'], defaultSets: 2, defaultReps: '15', defaultRest: 30 },
  { id: 'trap_shrug',      name: 'Trap Release Shrugs',      category: 'rehab', equipment: ['dumbbells'], defaultSets: 2, defaultReps: '12', defaultRest: 30, notes: 'Slow, hold at top 2s' },
  { id: 'neck_roll',       name: 'Neck Rolls',               category: 'rehab', equipment: ['bodyweight'], defaultSets: 1, defaultReps: '5 each dir', defaultRest: 0 },
  { id: 'wall_slide',      name: 'Wall Slides',              category: 'rehab', equipment: ['bodyweight'], defaultSets: 2, defaultReps: '10', defaultRest: 30, notes: 'Back flat to wall' },
  // ── Core ──
  { id: 'plank',           name: 'Plank',                    category: 'core', equipment: ['bodyweight'], defaultSets: 3, defaultReps: '30-45s', defaultRest: 45 },
  { id: 'dead_bug',        name: 'Dead Bug',                 category: 'core', equipment: ['bodyweight'], defaultSets: 3, defaultReps: '8 each', defaultRest: 45 },
];

// ─── Workout Plans ──────────────────────────────────────────────────────────

export const WORKOUT_EXERCISES: Record<number, string[]> = {
  1: ['bench_press', 'incline_press', 'ohp', 'lateral_raise', 'face_pull', 'shoulder_cir', 'band_dislocate', 'wall_slide'],
  2: ['goblet_squat', 'bulgarian_split', 'step_up', 'leg_extension', 'calf_raise', 'dead_bug'],
  4: ['pullup', 'db_row', 'face_pull', 'ytw', 'band_row', 'trap_shrug', 'neck_roll', 'scap_retract'],
  5: ['rdl', 'hip_thrust', 'nordic_curl', 'step_up', 'calf_raise', 'plank'],
};

export function getExercisesForDay(day: number, recoveryZone: 'high' | 'moderate' | 'low'): Exercise[] {
  const ids = WORKOUT_EXERCISES[day] ?? [];
  let exercises = ids.map(id => EXERCISE_LIBRARY.find(e => e.id === id)).filter(Boolean) as Exercise[];

  if (recoveryZone === 'low') {
    // Rehab only
    exercises = exercises.filter(e => e.category === 'rehab');
    if (exercises.length === 0) exercises = EXERCISE_LIBRARY.filter(e => e.category === 'rehab').slice(0, 4);
  }

  return exercises;
}

export function getExercise(id: string): Exercise | undefined {
  return EXERCISE_LIBRARY.find(e => e.id === id);
}

// ─── Storage ────────────────────────────────────────────────────────────────

function sessionKey(id: string) { return `workout_session_${id}`; }
function historyKey(exerciseId: string) { return `exercise_history_${exerciseId}`; }
function sessionIndexKey() { return 'workout_sessions_index_v1'; }

export function saveSession(session: WorkoutSession): void {
  setObject(appStorage, sessionKey(session.id), session);
  const idx = getSessionIndex();
  if (!idx.includes(session.id)) {
    appStorage.set(sessionIndexKey(), JSON.stringify([session.id, ...idx]));
  }
  // Update per-exercise history for progressive overload suggestions
  for (const log of session.exercises) {
    const hist = getExerciseHistory(log.exerciseId);
    hist.unshift({ date: session.date, sets: log.sets });
    appStorage.set(historyKey(log.exerciseId), JSON.stringify(hist.slice(0, 12)));
  }
}

export function loadSession(id: string): WorkoutSession | null {
  return getObject<WorkoutSession>(appStorage, sessionKey(id));
}

export function getSessionIndex(): string[] {
  const raw = appStorage.getString(sessionIndexKey());
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export interface ExerciseHistoryEntry { date: string; sets: LoggedSet[] }

export function getExerciseHistory(exerciseId: string): ExerciseHistoryEntry[] {
  const raw = appStorage.getString(historyKey(exerciseId));
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export function suggestNextSet(exerciseId: string, targetReps: number): { weight: number; reps: number } {
  const hist = getExerciseHistory(exerciseId);
  if (hist.length === 0) return { weight: 0, reps: targetReps };
  const lastSets = hist[0].sets.filter(s => s.completed);
  if (lastSets.length === 0) return { weight: 0, reps: targetReps };

  const avgWeight = lastSets.reduce((s, set) => s + set.weight, 0) / lastSets.length;
  const avgReps = lastSets.reduce((s, set) => s + set.reps, 0) / lastSets.length;

  // Progressive overload: if hit target reps last session, add ~2.5% weight
  if (avgReps >= targetReps) {
    return { weight: Math.round(avgWeight * 1.025 * 2) / 2, reps: targetReps }; // round to 0.5kg
  }
  return { weight: avgWeight, reps: Math.round(avgReps) + 1 };
}

// ─── HealthKit Workout Write ────────────────────────────────────────────────

export async function writeWorkoutToHealthKit(session: WorkoutSession): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await new Promise<void>((resolve, reject) => {
      (AppleHealthKit as any).saveWorkout({
        type: 'TraditionalStrengthTraining',
        startDate: session.startedAt,
        endDate: session.completedAt ?? new Date().toISOString(),
        duration: session.durationSeconds,
        totalEnergyBurned: session.estimatedCalories,
        totalEnergyBurnedUnit: 'calorie',
      }, (err: any) => err ? reject(err) : resolve());
    });
  } catch {
    // Non-critical
  }
}

export function estimateCalories(durationSeconds: number, exerciseCount: number): number {
  // Rough estimate: ~5 cal/min for strength training
  const minutes = durationSeconds / 60;
  return Math.round(minutes * 5 + exerciseCount * 3);
}
