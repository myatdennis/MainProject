import { useState, useEffect, useCallback } from 'react';
import {
  loadAllTasks,
  saveAllTasks,
  fetchTasksFromSupabase,
  getTasksDueOn,
  getUpcomingTasks,
  type StoredTask,
} from '@/lib/tasks';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export interface UseTasksReturn {
  tasksDueToday: StoredTask[];
  upcomingTasks: StoredTask[];
  openTaskCount: number;
  allTasks: StoredTask[];
  refresh: () => Promise<void>;
  completeTask: (id: string) => void;
}

export function useTasks(): UseTasksReturn {
  const today = todayStr();
  const [allTasks, setAllTasks] = useState<StoredTask[]>(() => loadAllTasks());

  const tasksDueToday = allTasks.filter((t) => t.dueDate === today && t.status === 'active');
  const upcomingTasks = getUpcomingTasks(today, 3);
  const openTaskCount = allTasks.filter((t) => t.status === 'active' && t.dueDate === today).length;

  const refresh = useCallback(async () => {
    try {
      const remote = await fetchTasksFromSupabase(today);
      if (remote.length > 0) {
        // Merge: remote wins for existing IDs, keep local-only tasks
        const local = loadAllTasks();
        const remoteIds = new Set(remote.map((t) => t.id));
        const localOnly = local.filter((t) => !remoteIds.has(t.id));
        const merged = [...remote, ...localOnly];
        saveAllTasks(merged);
        setAllTasks(merged);
      }
    } catch {
      // Stay with cached data
    }
  }, [today]);

  const completeTask = useCallback((id: string) => {
    setAllTasks((prev) => {
      const next = prev.map((t) => t.id === id ? { ...t, status: 'done' as const } : t);
      saveAllTasks(next);
      return next;
    });
  }, []);

  // Fetch from Supabase on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tasksDueToday, upcomingTasks, openTaskCount, allTasks, refresh, completeTask };
}
