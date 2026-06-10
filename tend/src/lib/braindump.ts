import { appStorage, syncQueue, getObject, setObject, pushToQueue } from './storage';
import { supabase } from './supabase';

export type CaptureAction = 'today' | 'task' | 'later' | 'dismissed' | null;

export interface BrainDumpCapture {
  id: string;
  text: string;
  createdAt: string;
  sessionId: string;
  action: CaptureAction;
  actionedAt: string | null;
  promotedTaskId: string | null;
}

export interface BrainDumpSession {
  id: string;
  date: string; // YYYY-MM-DD
  captures: BrainDumpCapture[];
  createdAt: string;
  sortedAt: string | null;
}

function sessionKey(id: string) { return `braindump_session_${id}`; }
function todayKey() { return `braindump_today_${new Date().toISOString().slice(0, 10)}`; }
function indexKey() { return 'braindump_sessions_v1'; }

export function getTodaySessionId(): string {
  const key = todayKey();
  const existing = appStorage.getString(key);
  if (existing) return existing;
  const id = `bd_${Date.now()}`;
  appStorage.set(key, id);
  return id;
}

export function loadSession(id: string): BrainDumpSession | null {
  return getObject<BrainDumpSession>(appStorage, sessionKey(id));
}

export function loadOrCreateSession(id: string): BrainDumpSession {
  const existing = loadSession(id);
  if (existing) return existing;
  const session: BrainDumpSession = {
    id,
    date: new Date().toISOString().slice(0, 10),
    captures: [],
    createdAt: new Date().toISOString(),
    sortedAt: null,
  };
  saveSession(session);
  return session;
}

export function saveSession(session: BrainDumpSession): void {
  setObject(appStorage, sessionKey(session.id), session);
  updateSessionIndex(session.id);
}

export function addCapture(sessionId: string, text: string): BrainDumpCapture {
  const session = loadOrCreateSession(sessionId);
  const capture: BrainDumpCapture = {
    id: `cap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    sessionId,
    action: null,
    actionedAt: null,
    promotedTaskId: null,
  };
  session.captures.push(capture);
  saveSession(session);
  return capture;
}

export function actionCapture(sessionId: string, captureId: string, action: CaptureAction): void {
  const session = loadSession(sessionId);
  if (!session) return;
  const capture = session.captures.find(c => c.id === captureId);
  if (!capture) return;
  capture.action = action;
  capture.actionedAt = new Date().toISOString();
  saveSession(session);
  pushToQueue(syncQueue, 'braindump_sync_queue', { type: 'action_capture', sessionId, captureId, action });
}

export function markSessionSorted(sessionId: string): void {
  const session = loadSession(sessionId);
  if (!session) return;
  saveSession({ ...session, sortedAt: new Date().toISOString() });
}

export function getSessionIndex(): string[] {
  const raw = appStorage.getString(indexKey());
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function updateSessionIndex(id: string): void {
  const ids = getSessionIndex();
  if (!ids.includes(id)) {
    appStorage.set(indexKey(), JSON.stringify([id, ...ids]));
  }
}

export function getUnsortedCount(sessionId: string): number {
  const session = loadSession(sessionId);
  if (!session) return 0;
  return session.captures.filter(c => c.action === null && c.text.length > 0).length;
}

export async function syncBrainDumpToSupabase(sessionId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const session = loadSession(sessionId);
    if (!session) return;
    await supabase.from('brain_dump_sessions').upsert({
      id: session.id,
      user_id: user.id,
      date: session.date,
      sorted_at: session.sortedAt,
      created_at: session.createdAt,
    }, { onConflict: 'id' });
    for (const cap of session.captures) {
      await supabase.from('brain_dump_captures').upsert({
        id: cap.id,
        session_id: session.id,
        user_id: user.id,
        text: cap.text,
        action: cap.action,
        actioned_at: cap.actionedAt,
        created_at: cap.createdAt,
      }, { onConflict: 'id' });
    }
  } catch {
    // best-effort
  }
}
