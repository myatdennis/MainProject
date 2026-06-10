import { useState, useCallback, useRef, useEffect } from 'react';
import {
  WorkoutSession,
  ExerciseLog,
  LoggedSet,
  Exercise,
  getExercisesForDay,
  suggestNextSet,
  saveSession,
  writeWorkoutToHealthKit,
  estimateCalories,
} from '@/lib/training';
import { getWorkoutForToday } from '@/components/today/WorkoutCard';
import { getRecoveryZone } from '@/types';

export function useActiveWorkout(recoveryScore: number) {
  const workoutDay = new Date().getDay();
  const zone = getRecoveryZone(recoveryScore);
  const todayInfo = getWorkoutForToday();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  const exercises = getExercisesForDay(workoutDay, zone);

  const startWorkout = useCallback(() => {
    startTimeRef.current = new Date();
    const initialLogs: ExerciseLog[] = exercises.map(ex => ({
      exerciseId: ex.id,
      sets: Array.from({ length: ex.defaultSets }, (_, i) => {
        const repsNum = parseInt(ex.defaultReps.split('-')[0], 10) || 10;
        const suggestion = suggestNextSet(ex.id, repsNum);
        return {
          reps: suggestion.reps,
          weight: suggestion.weight,
          completed: false,
        };
      }),
    }));

    const newSession: WorkoutSession = {
      id: `ws_${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      workoutName: todayInfo.name,
      workoutDay,
      exercises: initialLogs,
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationSeconds: 0,
      estimatedCalories: 0,
      notes: '',
      synced: false,
    };
    setSession(newSession);
    setCurrentExerciseIndex(0);
  }, [exercises, todayInfo, workoutDay]);

  const updateSet = useCallback((exerciseIndex: number, setIndex: number, updates: Partial<LoggedSet>) => {
    setSession(prev => {
      if (!prev) return prev;
      const logs = prev.exercises.map((log, ei) => {
        if (ei !== exerciseIndex) return log;
        return {
          ...log,
          sets: log.sets.map((s, si) => si === setIndex ? { ...s, ...updates } : s),
        };
      });
      return { ...prev, exercises: logs };
    });
  }, []);

  const completeSet = useCallback((exerciseIndex: number, setIndex: number, restSeconds: number) => {
    updateSet(exerciseIndex, setIndex, { completed: true });
    startRestTimer(restSeconds);
  }, [updateSet]);

  const addSet = useCallback((exerciseIndex: number) => {
    setSession(prev => {
      if (!prev) return prev;
      const logs = prev.exercises.map((log, ei) => {
        if (ei !== exerciseIndex) return log;
        const lastSet = log.sets[log.sets.length - 1];
        return { ...log, sets: [...log.sets, { ...lastSet, completed: false }] };
      });
      return { ...prev, exercises: logs };
    });
  }, []);

  const startRestTimer = useCallback((seconds: number) => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setRestSecondsLeft(seconds);
    setRestTimerActive(true);
    restIntervalRef.current = setInterval(() => {
      setRestSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(restIntervalRef.current!);
          setRestTimerActive(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const skipRest = useCallback(() => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setRestTimerActive(false);
    setRestSecondsLeft(0);
  }, []);

  const finishWorkout = useCallback(async () => {
    if (!session || !startTimeRef.current) return null;
    const durationSeconds = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
    const completed: WorkoutSession = {
      ...session,
      completedAt: new Date().toISOString(),
      durationSeconds,
      estimatedCalories: estimateCalories(durationSeconds, session.exercises.length),
    };
    saveSession(completed);
    await writeWorkoutToHealthKit(completed);
    setSession(null);
    return completed;
  }, [session]);

  useEffect(() => {
    return () => { if (restIntervalRef.current) clearInterval(restIntervalRef.current); };
  }, []);

  const currentExercise: Exercise | undefined = session
    ? exercises[currentExerciseIndex]
    : undefined;

  const totalSets = session?.exercises.reduce((s, l) => s + l.sets.length, 0) ?? 0;
  const completedSets = session?.exercises.reduce((s, l) => s + l.sets.filter(x => x.completed).length, 0) ?? 0;
  const progress = totalSets > 0 ? completedSets / totalSets : 0;

  return {
    session,
    exercises,
    currentExerciseIndex,
    currentExercise,
    restTimerActive,
    restSecondsLeft,
    progress,
    completedSets,
    totalSets,
    startWorkout,
    updateSet,
    completeSet,
    addSet,
    skipRest,
    finishWorkout,
    setCurrentExerciseIndex,
    isStarted: !!session,
  };
}
