import { appStorage, getObject, setObject } from './storage';

export interface Habit {
  id: string;
  title: string;
  emoji: string;
  category: 'health' | 'mind' | 'work' | 'custom';
  activeDays: number[]; // 0-6 (Sun-Sat); empty = daily
  createdAt: string;
  archived: boolean;
}

export interface HabitCompletion {
  habitId: string;
  date: string;
  completedAt: string;
}

const HABITS_KEY = 'habits_v1';
function completionKey(date: string) { return `habit_completions_${date}`; }

export const HABIT_TEMPLATES: Pick<Habit, 'title' | 'emoji' | 'category'>[] = [
  { title: 'Morning walk', emoji: '🚶', category: 'health' },
  { title: 'Meditate 10 min', emoji: '🧘', category: 'mind' },
  { title: 'Read 20 pages', emoji: '📖', category: 'mind' },
  { title: 'No phone first hour', emoji: '📵', category: 'mind' },
  { title: 'Drink 2L water', emoji: '💧', category: 'health' },
  { title: 'Evening journal', emoji: '✍️', category: 'mind' },
  { title: 'Cold shower', emoji: '🚿', category: 'health' },
  { title: 'Weekly review', emoji: '📊', category: 'work' },
];

export function loadHabits(): Habit[] {
  return getObject<Habit[]>(appStorage, HABITS_KEY) ?? [];
}

export function saveHabits(habits: Habit[]): void {
  setObject(appStorage, HABITS_KEY, habits);
}

export function createHabit(title: string, emoji: string, category: Habit['category'], activeDays: number[] = []): Habit {
  const habit: Habit = {
    id: `habit_${Date.now()}`,
    title,
    emoji,
    category,
    activeDays,
    createdAt: new Date().toISOString(),
    archived: false,
  };
  saveHabits([...loadHabits(), habit]);
  return habit;
}

export function archiveHabit(id: string): void {
  saveHabits(loadHabits().map(h => h.id === id ? { ...h, archived: true } : h));
}

export function getCompletions(date: string): HabitCompletion[] {
  return getObject<HabitCompletion[]>(appStorage, completionKey(date)) ?? [];
}

export function toggleCompletion(habitId: string, date: string): void {
  const completions = getCompletions(date);
  const existing = completions.find(c => c.habitId === habitId);
  if (existing) {
    setObject(appStorage, completionKey(date), completions.filter(c => c.habitId !== habitId));
  } else {
    setObject(appStorage, completionKey(date), [
      ...completions,
      { habitId, date, completedAt: new Date().toISOString() },
    ]);
  }
}

export function getActiveHabitsForDate(date: string): Habit[] {
  const dow = new Date(date + 'T12:00:00').getDay();
  return loadHabits().filter(h => {
    if (h.archived) return false;
    if (h.activeDays.length === 0) return true; // daily
    return h.activeDays.includes(dow);
  });
}

export function isCompleted(habitId: string, date: string): boolean {
  return getCompletions(date).some(c => c.habitId === habitId);
}
