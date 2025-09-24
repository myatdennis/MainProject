export type Notification = {
  id: string;
  title: string;
  body?: string;
  orgId?: string;
  userId?: string;
  createdAt: string;
  read?: boolean;
};

const KEY = 'huddle_notifications_v1';

const read = (): Notification[] => {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Notification[]; } catch { return []; }
};

const write = (items: Notification[]) => localStorage.setItem(KEY, JSON.stringify(items));

export const listNotifications = async (opts?: { orgId?: string; userId?: string }) => {
  let items = read();
  if (opts?.orgId) items = items.filter(i => i.orgId === opts.orgId || !i.orgId);
  if (opts?.userId) items = items.filter(i => i.userId === opts.userId || !i.userId);
  return items.slice().sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt));
};

export const addNotification = async (n: Omit<Notification,'id'|'createdAt'>) => {
  const items = read();
  const note: Notification = { id: `note-${Date.now()}`, createdAt: new Date().toISOString(), ...n };
  items.push(note);
  write(items);
  return note;
};

export const clearNotifications = async () => { write([]); };

export default { listNotifications, addNotification, clearNotifications };
