import { MMKV } from 'react-native-mmkv';

export const appStorage = new MMKV({ id: 'tend-app' });
export const syncQueue = new MMKV({ id: 'tend-sync-queue' });
export const healthCache = new MMKV({ id: 'tend-health-cache' });

// ─── Typed helpers ────────────────────────────────────────────────────────────

export function getObject<T>(storage: MMKV, key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setObject<T>(storage: MMKV, key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

export function pushToQueue(storage: MMKV, key: string, item: unknown): void {
  const existing = getObject<unknown[]>(storage, key) ?? [];
  existing.push(item);
  setObject(storage, key, existing);
}
