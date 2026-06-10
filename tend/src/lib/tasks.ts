/**
 * Offline-first task + priority storage.
 * All writes go to MMKV first; Supabase sync runs in the background.
 */
import { appStorage, syncQueue, getObject, setObject, pushToQueue } from './storage';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Priority {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

export interface PriorityStore {
  priorities: Priority[];
  savedAt: string;
}

export interface StoredTask {
  id: string;
  userId: string;
  title: string;
  notes: string;
  dueDate: string | null;
  position: number;
  status: 'active' | 'done';
  source: 'brain_dump' | 'journal' | 'manual' | 'voice';
  createdAt: string;
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const priorityKey = (date: string) => `priorities_${date}`;
const LAST_OPEN_KEY = 'last_open_date';
const TASKS_KEY = 'tasks_v1';

// ─── Priority CRUD ────────────────────────────────────────────────────────────

export function loadPriorities(date: string): Priority[] {
  const store = getObject<PriorityStore>(appStorage, priorityKey(date));
  if (store) return store.priorities;
  // Default: three empty slots
  return [
    { id: `${date}_1`, text: '', done: false, createdAt: new Date().toISOString() },
    { id: `${date}_2`, text: '', done: false, createdAt: new Date().toISOString() },
    { id: `${date}_3`, text: '', done: false, createdAt: new Date().toISOString() },
  ];
}

export function savePriorities(date: string, priorities: Priority[]): void {
  const store: PriorityStore = { priorities, savedAt: new Date().toISOString() };
  setObject(appStorage, priorityKey(date), store);
  // Queue Supabase sync
  pushToQueue(syncQueue, 'priority_sync', { date, priorities, savedAt: store.savedAt });
}

export function loadRolloverCandidates(fromDate: string): Priority[] {
  const store = getObject<PriorityStore>(appStorage, priorityKey(fromDate));
  if (!store) return [];
  return store.priorities.filter((p) => !p.done && p.text.trim().length > 0);
}

// ─── Last-open tracking (for welcome-back state) ──────────────────────────────

export function getLastOpenDate(): string | null {
  return appStorage.getString(LAST_OPEN_KEY) ?? null;
}

export function setLastOpenDate(): void {
  appStorage.set(LAST_OPEN_KEY, new Date().toISOString().split('T')[0]);
}

export function daysSinceLastOpen(): number {
  const last = getLastOpenDate();
  if (!last) return 0;
  const lastMs = new Date(last).getTime();
  const nowMs = new Date().setHours(0, 0, 0, 0);
  return Math.floor((nowMs - lastMs) / 86_400_000);
}

// ─── Task CRUD ─────────────────────────────────────────────────────────────────

export function loadAllTasks(): StoredTask[] {
  return getObject<StoredTask[]>(appStorage, TASKS_KEY) ?? [];
}

export function saveAllTasks(tasks: StoredTask[]): void {
  setObject(appStorage, TASKS_KEY, tasks);
}

export function upsertTask(task: StoredTask): void {
  const all = loadAllTasks();
  const idx = all.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    all[idx] = task;
  } else {
    all.push(task);
  }
  saveAllTasks(all);
  pushToQueue(syncQueue, 'task_sync', task);
}

export function getTasksDueOn(date: string): StoredTask[] {
  return loadAllTasks()
    .filter((t) => t.dueDate === date && t.status === 'active')
    .sort((a, b) => a.position - b.position);
}

export function getUpcomingTasks(fromDate: string, days = 3): StoredTask[] {
  const from = new Date(fromDate);
  const to = new Date(fromDate);
  to.setDate(to.getDate() + days);
  const toStr = to.toISOString().split('T')[0];

  return loadAllTasks()
    .filter((t) => t.status === 'active' && t.dueDate && t.dueDate > fromDate && t.dueDate <= toStr)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.position - b.position);
}

// ─── Supabase background sync ─────────────────────────────────────────────────

export async function syncPrioritiesToSupabase(date: string, priorities: Priority[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const tasks = priorities
    .filter((p) => p.text.trim())
    .map((p, i) => ({
      id: p.id,
      user_id: user.id,
      title: p.text.trim(),
      notes: '',
      due_date: date,
      position: i + 1,
      status: p.done ? 'done' : 'active',
      source: 'manual' as const,
      created_at: p.createdAt,
    }));

  if (tasks.length > 0) {
    await supabase.from('tasks').upsert(tasks, { onConflict: 'id' });
  }
}

export async function fetchTasksFromSupabase(date: string): Promise<StoredTask[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active'])
    .order('position', { ascending: true });

  if (error || !data) return [];

  return data.map((t) => ({
    id: t.id,
    userId: t.user_id,
    title: t.title,
    notes: t.notes ?? '',
    dueDate: t.due_date,
    position: t.position,
    status: t.status,
    source: t.source,
    createdAt: t.created_at,
  }));
}
