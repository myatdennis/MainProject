import { syncQueue, appStorage } from './storage';
import { syncJournalToSupabase } from './journal';
import { syncBrainDumpToSupabase, getTodaySessionId } from './braindump';
import { syncGoalsToSupabase } from './goals';
import { syncPrioritiesToSupabase, loadPriorities } from './tasks';
import { AppState, AppStateStatus } from 'react-native';

let flushInProgress = false;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

export async function flushSyncQueue(): Promise<void> {
  if (flushInProgress) return;
  flushInProgress = true;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const priorities = loadPriorities(today);
    await Promise.allSettled([
      syncJournalToSupabase(),
      syncBrainDumpToSupabase(getTodaySessionId()),
      syncGoalsToSupabase(),
      syncPrioritiesToSupabase(today, priorities),
    ]);
  } finally {
    flushInProgress = false;
  }
}

export function startSyncQueueListener(): void {
  if (appStateSubscription) return;
  appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      flushSyncQueue();
    }
  });
}

export function stopSyncQueueListener(): void {
  appStateSubscription?.remove();
  appStateSubscription = null;
}
