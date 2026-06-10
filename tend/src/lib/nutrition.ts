import { appStorage, getObject, setObject } from './storage';
import { supabase } from './supabase';

export interface MacroTargets {
  calories: number;
  protein: number; // g
  carbs: number;   // g
  fat: number;     // g
}

export interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  loggedAt: string;
}

export interface DayLog {
  date: string;
  entries: FoodEntry[];
  targets: MacroTargets;
}

export const FOOD_PRESETS: Array<Omit<FoodEntry, 'id' | 'meal' | 'loggedAt'>> = [
  { name: 'Chicken breast 150g',  calories: 248, protein: 47, carbs: 0,  fat: 5,   servingSize: '150g' },
  { name: 'Greek yogurt 200g',    calories: 130, protein: 20, carbs: 8,  fat: 0.5, servingSize: '200g' },
  { name: 'Eggs × 2',             calories: 143, protein: 12, carbs: 1,  fat: 10,  servingSize: '2 eggs' },
  { name: 'Oats 80g',             calories: 296, protein: 10, carbs: 52, fat: 6,   servingSize: '80g dry' },
  { name: 'Rice 200g cooked',     calories: 258, protein: 5,  carbs: 56, fat: 0.4, servingSize: '200g' },
  { name: 'Salmon 150g',          calories: 280, protein: 38, carbs: 0,  fat: 13,  servingSize: '150g' },
  { name: 'Whey protein shake',   calories: 130, protein: 25, carbs: 5,  fat: 2,   servingSize: '1 scoop' },
  { name: 'Banana',               calories: 89,  protein: 1,  carbs: 23, fat: 0.3, servingSize: '1 medium' },
  { name: 'Almonds 30g',          calories: 174, protein: 6,  carbs: 6,  fat: 15,  servingSize: '30g' },
  { name: 'Sweet potato 200g',    calories: 172, protein: 3,  carbs: 40, fat: 0.1, servingSize: '200g' },
  { name: 'Cottage cheese 200g',  calories: 162, protein: 28, carbs: 6,  fat: 2,   servingSize: '200g' },
  { name: 'Beef mince 150g',      calories: 330, protein: 34, carbs: 0,  fat: 21,  servingSize: '150g' },
];

export const DEFAULT_TARGETS: MacroTargets = {
  calories: 2400,
  protein: 180,
  carbs: 250,
  fat: 80,
};

function dayKey(date: string) { return `nutrition_day_${date}`; }
function targetsKey() { return 'nutrition_targets_v1'; }

export function loadDayLog(date: string): DayLog {
  return getObject<DayLog>(appStorage, dayKey(date)) ?? {
    date,
    entries: [],
    targets: loadTargets(),
  };
}

export function loadTargets(): MacroTargets {
  return getObject<MacroTargets>(appStorage, targetsKey()) ?? DEFAULT_TARGETS;
}

export function saveTargets(targets: MacroTargets): void {
  setObject(appStorage, targetsKey(), targets);
}

export function addEntry(date: string, entry: Omit<FoodEntry, 'id' | 'loggedAt'>): FoodEntry {
  const log = loadDayLog(date);
  const newEntry: FoodEntry = {
    ...entry,
    id: `food_${Date.now()}`,
    loggedAt: new Date().toISOString(),
  };
  log.entries.push(newEntry);
  setObject(appStorage, dayKey(date), log);
  return newEntry;
}

export function removeEntry(date: string, entryId: string): void {
  const log = loadDayLog(date);
  log.entries = log.entries.filter(e => e.id !== entryId);
  setObject(appStorage, dayKey(date), log);
}

export function getDayTotals(entries: FoodEntry[]): MacroTargets {
  return entries.reduce((totals, e) => ({
    calories: totals.calories + e.calories,
    protein: totals.protein + e.protein,
    carbs: totals.carbs + e.carbs,
    fat: totals.fat + e.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

export function getWeeklyProteinAverage(days: number = 7): number {
  const today = new Date();
  let total = 0;
  let count = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const log = loadDayLog(date);
    if (log.entries.length > 0) {
      total += getDayTotals(log.entries).protein;
      count++;
    }
  }
  return count > 0 ? Math.round(total / count) : 0;
}
