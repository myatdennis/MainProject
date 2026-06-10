import { useState, useCallback } from 'react';
import { getEntryDates, loadEntry, getMoodHistory, JournalEntry, MoodLevel } from '@/lib/journal';

export function useJournal() {
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => setRefreshToken(t => t + 1), []);

  const entryDates = getEntryDates();

  const getEntry = useCallback((date: string): JournalEntry | null => {
    return loadEntry(date);
  }, [refreshToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const moodHistory = getMoodHistory(30);

  const streak = calculateStreak(entryDates);

  return {
    entryDates,
    getEntry,
    moodHistory,
    streak,
    refresh,
  };
}

function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...dates].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);

  let streak = 0;
  let current = today;

  for (const date of sorted) {
    if (date === current) {
      streak++;
      const d = new Date(current);
      d.setDate(d.getDate() - 1);
      current = d.toISOString().slice(0, 10);
    } else {
      break;
    }
  }

  return streak;
}
