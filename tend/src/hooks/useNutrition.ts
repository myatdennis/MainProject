import { useState, useCallback } from 'react';
import {
  loadDayLog,
  addEntry,
  removeEntry,
  loadTargets,
  getDayTotals,
  DayLog,
  FoodEntry,
  MacroTargets,
} from '@/lib/nutrition';

export function useNutrition(date: string) {
  const [log, setLog] = useState<DayLog>(() => loadDayLog(date));
  const targets = loadTargets();

  const reload = useCallback(() => {
    setLog(loadDayLog(date));
  }, [date]);

  const add = useCallback((entry: Omit<FoodEntry, 'id' | 'loggedAt'>) => {
    addEntry(date, entry);
    reload();
  }, [date, reload]);

  const remove = useCallback((id: string) => {
    removeEntry(date, id);
    reload();
  }, [date, reload]);

  const totals = getDayTotals(log.entries);

  const proteinPct = targets.protein > 0 ? Math.min(1, totals.protein / targets.protein) : 0;
  const caloriePct = targets.calories > 0 ? Math.min(1, totals.calories / targets.calories) : 0;

  return {
    log,
    targets,
    totals,
    proteinPct,
    caloriePct,
    add,
    remove,
    reload,
  };
}
