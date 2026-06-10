import { useState, useEffect, useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  loadPriorities,
  savePriorities,
  loadRolloverCandidates,
  daysSinceLastOpen,
  setLastOpenDate,
  syncPrioritiesToSupabase,
  type Priority,
} from '@/lib/tasks';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export interface UseTodayPrioritiesReturn {
  priorities: Priority[];
  rolloverItems: Priority[];
  rolloverExpanded: boolean;
  showWelcomeBack: boolean;
  hasAnyText: boolean;
  update: (id: string, text: string) => void;
  complete: (id: string) => void;
  promoteRollover: (item: Priority) => void;
  dismissRollover: (id: string) => void;
  toggleRolloverExpanded: () => void;
}

export function useTodayPriorities(): UseTodayPrioritiesReturn {
  const today = todayStr();
  const yesterday = yesterdayStr();

  const [priorities, setPriorities] = useState<Priority[]>(() => loadPriorities(today));
  const [rolloverItems, setRolloverItems] = useState<Priority[]>(() =>
    loadRolloverCandidates(yesterday),
  );
  const [rolloverExpanded, setRolloverExpanded] = useState(false);
  const [showWelcomeBack] = useState(() => daysSinceLastOpen() >= 3);

  // Debounce ref: save 600ms after last keystroke
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Record today as last open date on mount
  useEffect(() => {
    setLastOpenDate();
  }, []);

  const persistPriorities = useCallback((next: Priority[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePriorities(today, next);
      syncPrioritiesToSupabase(today, next).catch(() => {});
    }, 600);
  }, [today]);

  const update = useCallback((id: string, text: string) => {
    setPriorities((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, text } : p));
      persistPriorities(next);
      return next;
    });
  }, [persistPriorities]);

  const complete = useCallback((id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPriorities((prev) => {
      const item = prev.find((p) => p.id === id);
      // Toggle: if already done, un-complete
      const next = prev.map((p) =>
        p.id === id ? { ...p, done: !p.done } : p,
      );
      savePriorities(today, next);
      syncPrioritiesToSupabase(today, next).catch(() => {});
      return next;
    });
  }, [today]);

  const promoteRollover = useCallback((item: Priority) => {
    // Find first empty slot in Top 3
    setPriorities((prev) => {
      const emptyIdx = prev.findIndex((p) => !p.text.trim());
      if (emptyIdx === -1) return prev; // All slots filled
      const next = prev.map((p, i) =>
        i === emptyIdx ? { ...p, text: item.text, done: false } : p,
      );
      savePriorities(today, next);
      syncPrioritiesToSupabase(today, next).catch(() => {});
      return next;
    });
    // Remove from rollover
    setRolloverItems((prev) => prev.filter((r) => r.id !== item.id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [today]);

  const dismissRollover = useCallback((id: string) => {
    setRolloverItems((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const toggleRolloverExpanded = useCallback(() => {
    setRolloverExpanded((v) => !v);
  }, []);

  const hasAnyText = priorities.some((p) => p.text.trim().length > 0);

  return {
    priorities,
    rolloverItems,
    rolloverExpanded,
    showWelcomeBack,
    hasAnyText,
    update,
    complete,
    promoteRollover,
    dismissRollover,
    toggleRolloverExpanded,
  };
}
