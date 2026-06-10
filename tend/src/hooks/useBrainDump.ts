import { useState, useCallback } from 'react';
import {
  getTodaySessionId,
  loadOrCreateSession,
  addCapture,
  actionCapture,
  markSessionSorted,
  syncBrainDumpToSupabase,
  BrainDumpSession,
  BrainDumpCapture,
  CaptureAction,
} from '@/lib/braindump';
import { savePriorities, loadPriorities } from '@/lib/tasks';

export function useBrainDump() {
  const sessionId = getTodaySessionId();
  const [session, setSession] = useState<BrainDumpSession>(() =>
    loadOrCreateSession(sessionId)
  );

  const reload = useCallback(() => {
    setSession(loadOrCreateSession(sessionId));
  }, [sessionId]);

  const addItem = useCallback((text: string): BrainDumpCapture | null => {
    if (!text.trim()) return null;
    const capture = addCapture(sessionId, text);
    reload();
    return capture;
  }, [sessionId, reload]);

  const actionItem = useCallback((captureId: string, action: CaptureAction) => {
    actionCapture(sessionId, captureId, action);
    reload();

    // Auto-promote "today" captures to first empty Top 3 slot
    if (action === 'today') {
      const today = new Date().toISOString().slice(0, 10);
      const priorities = loadPriorities(today);
      const capture = session.captures.find(c => c.id === captureId);
      if (capture) {
        const emptyIdx = priorities.findIndex(p => !p.text.trim());
        if (emptyIdx >= 0) {
          priorities[emptyIdx] = { ...priorities[emptyIdx], text: capture.text };
          savePriorities(today, priorities);
        }
      }
    }
  }, [sessionId, session.captures, reload]);

  const finishSort = useCallback(() => {
    markSessionSorted(sessionId);
    syncBrainDumpToSupabase(sessionId);
    reload();
  }, [sessionId, reload]);

  const unsortedCaptures = session.captures.filter(c => c.action === null && c.text.length > 0);
  const sortedCaptures = session.captures.filter(c => c.action !== null);

  return {
    session,
    unsortedCaptures,
    sortedCaptures,
    addItem,
    actionItem,
    finishSort,
    reload,
    isSorted: !!session.sortedAt,
    totalCount: session.captures.length,
  };
}
