import { useState, useCallback, useRef, useEffect } from 'react';
import {
  loadEntry,
  saveEntry,
  updateStrokes,
  updateMood,
  createEmptyEntry,
  syncJournalToSupabase,
  JournalEntry,
  MoodLevel,
} from '@/lib/journal';
import { Stroke } from '@/lib/handwriting';

export function useJournalEntry(date: string) {
  const [entry, setEntry] = useState<JournalEntry>(() => loadEntry(date) ?? createEmptyEntry(date));
  const startTimeRef = useRef(Date.now());
  const strokesRef = useRef<Stroke[]>(entry.strokes);

  useEffect(() => {
    const loaded = loadEntry(date) ?? createEmptyEntry(date);
    setEntry(loaded);
    strokesRef.current = loaded.strokes;
    startTimeRef.current = Date.now();
  }, [date]);

  const addStroke = useCallback((stroke: Stroke) => {
    const next = [...strokesRef.current, stroke];
    strokesRef.current = next;
    updateStrokes(date, next);
    setEntry(prev => ({ ...prev, strokes: next }));
  }, [date]);

  const undoLastStroke = useCallback(() => {
    if (strokesRef.current.length === 0) return;
    const next = strokesRef.current.slice(0, -1);
    strokesRef.current = next;
    updateStrokes(date, next);
    setEntry(prev => ({ ...prev, strokes: next }));
  }, [date]);

  const clearStrokes = useCallback(() => {
    strokesRef.current = [];
    updateStrokes(date, []);
    setEntry(prev => ({ ...prev, strokes: [] }));
  }, [date]);

  const setMood = useCallback((mood: MoodLevel) => {
    updateMood(date, mood);
    setEntry(prev => ({ ...prev, mood }));
  }, [date]);

  const saveDuration = useCallback(() => {
    const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const updated = loadEntry(date);
    if (updated) {
      saveEntry({ ...updated, durationSeconds: updated.durationSeconds + seconds });
    }
    startTimeRef.current = Date.now();
    syncJournalToSupabase();
  }, [date]);

  return {
    entry,
    addStroke,
    undoLastStroke,
    clearStrokes,
    setMood,
    saveDuration,
    hasContent: entry.strokes.length > 0 || entry.mood !== null,
  };
}
