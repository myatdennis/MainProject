import { appStorage, syncQueue, getObject, setObject, pushToQueue } from './storage';
import { serializeStrokes, deserializeStrokes, Stroke } from './handwriting';
import { supabase } from './supabase';

export type MoodLevel = 'low' | 'neutral' | 'good';

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  strokes: Stroke[];
  mood: MoodLevel | null;
  anchorQuestionId: number | null;
  anchorAnswer: string | null; // OCR text
  textContent: string | null;  // full OCR text of all strokes
  wordCount: number;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

function entryKey(date: string) { return `journal_entry_${date}`; }
function indexKey() { return 'journal_index_v1'; }

export function loadEntry(date: string): JournalEntry | null {
  return getObject<JournalEntry>(appStorage, entryKey(date));
}

export function saveEntry(entry: JournalEntry): void {
  setObject(appStorage, entryKey(entry.date), { ...entry, synced: false });
  updateIndex(entry.date);
  pushToQueue(syncQueue, 'journal_sync_queue', { type: 'upsert_entry', date: entry.date });
}

export function updateStrokes(date: string, strokes: Stroke[]): void {
  const existing = loadEntry(date) ?? createEmptyEntry(date);
  saveEntry({
    ...existing,
    strokes,
    updatedAt: new Date().toISOString(),
    wordCount: estimateWordCount(strokes),
  });
}

export function updateMood(date: string, mood: MoodLevel): void {
  const existing = loadEntry(date) ?? createEmptyEntry(date);
  saveEntry({ ...existing, mood, updatedAt: new Date().toISOString() });
}

export function updateOcrText(date: string, text: string, anchorAnswer?: string): void {
  const existing = loadEntry(date) ?? createEmptyEntry(date);
  saveEntry({
    ...existing,
    textContent: text,
    anchorAnswer: anchorAnswer ?? existing.anchorAnswer,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    updatedAt: new Date().toISOString(),
  });
}

export function getEntryDates(): string[] {
  const raw = appStorage.getString(indexKey());
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export function createEmptyEntry(date: string): JournalEntry {
  const now = new Date().toISOString();
  return {
    id: `journal_${date}`,
    date,
    strokes: [],
    mood: null,
    anchorQuestionId: null,
    anchorAnswer: null,
    textContent: null,
    wordCount: 0,
    durationSeconds: 0,
    createdAt: now,
    updatedAt: now,
    synced: false,
  };
}

function updateIndex(date: string): void {
  const dates = getEntryDates();
  if (!dates.includes(date)) {
    const sorted = [...dates, date].sort().reverse();
    appStorage.set(indexKey(), JSON.stringify(sorted));
  }
}

function estimateWordCount(strokes: Stroke[]): number {
  // rough estimate: ~10 strokes per word for cursive handwriting
  return Math.max(0, Math.floor(strokes.length / 10));
}

export async function syncJournalToSupabase(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const dates = getEntryDates();
    for (const date of dates.slice(0, 7)) { // sync last 7 days
      const entry = loadEntry(date);
      if (!entry || entry.synced) continue;

      const { error } = await supabase.from('journal_entries').upsert({
        id: entry.id,
        user_id: user.id,
        date: entry.date,
        mood: entry.mood,
        text_content: entry.textContent,
        word_count: entry.wordCount,
        duration_seconds: entry.durationSeconds,
        anchor_question_id: entry.anchorQuestionId,
        anchor_answer: entry.anchorAnswer,
        stroke_data: serializeStrokes(entry.strokes),
        created_at: entry.createdAt,
        updated_at: entry.updatedAt,
      }, { onConflict: 'id' });

      if (!error) {
        setObject(appStorage, entryKey(date), { ...entry, synced: true });
      }
    }
  } catch {
    // silent — sync is best-effort
  }
}

export function getMoodHistory(days: number): Array<{ date: string; mood: MoodLevel | null }> {
  const result: Array<{ date: string; mood: MoodLevel | null }> = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const entry = loadEntry(dateStr);
    result.push({ date: dateStr, mood: entry?.mood ?? null });
  }
  return result;
}
