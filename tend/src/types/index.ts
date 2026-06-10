// ─── Health ──────────────────────────────────────────────────────────────────

export interface HealthSnapshot {
  id: string;
  userId: string;
  date: string;
  hrv: number | null;
  restingHr: number | null;
  sleepHours: number | null;
  sleepEfficiency: number | null;
  activeCalories: number | null;
  exerciseMinutes: number | null;
  strainScore: number | null;
  recoveryScore: number | null;
  readinessScore: number | null;
  stressInferred: boolean;
  createdAt: string;
}

export type RecoveryZone = 'high' | 'moderate' | 'low';

export function getRecoveryZone(score: number): RecoveryZone {
  if (score >= 67) return 'high';
  if (score >= 34) return 'moderate';
  return 'low';
}

export function getRecoveryColor(zone: RecoveryZone): string {
  switch (zone) {
    case 'high': return '#4CAF82';
    case 'moderate': return '#F0B429';
    case 'low': return '#E05252';
  }
}

export function getRecoveryMessage(zone: RecoveryZone): string {
  switch (zone) {
    case 'high': return "You're recovered. Push hard today.";
    case 'moderate': return 'Moderate energy today. Keep it controlled.';
    case 'low': return 'Your body needs rest. Rehab and breathe today.';
  }
}

// ─── Journal ─────────────────────────────────────────────────────────────────

export type Mood = -1 | 0 | 1;

export interface JournalEntry {
  id: string;
  userId: string;
  date: string;
  anchorQuestion: string;
  mood: Mood | null;
  recoveryAtWrite: number | null;
  contentBlocks: ContentBlock[];
  linkedGoals: string[];
  linkedTasks: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentBlock {
  type: 'text' | 'handwriting';
  content: string;
  section?: 'anchor' | 'intentions' | 'mind' | 'goals';
}

export interface StrokeData {
  id: string;
  entryId: string;
  strokes: Stroke[];
  recognizedText: string;
  createdAt: string;
}

export interface Stroke {
  points: StrokePoint[];
  color: string;
  width: number;
  opacity: number;
  tool: PenTool;
}

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  timestamp: number;
}

export type PenTool = 'ballpoint' | 'fountain' | 'marker' | 'pencil' | 'eraser';

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  userId: string;
  title: string;
  notes: string;
  dueDate: string | null;
  position: number;
  status: 'active' | 'done';
  goalId: string | null;
  projectId: string | null;
  source: 'brain_dump' | 'journal' | 'manual' | 'voice';
  createdAt: string;
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  userId: string;
  title: string;
  category: 'health' | 'business' | 'personal';
  targetDate: string | null;
  status: 'active' | 'done' | 'paused';
  progress: number;
  milestones: Milestone[];
  createdAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
}

// ─── Fitness ─────────────────────────────────────────────────────────────────

export interface WorkoutSession {
  id: string;
  userId: string;
  planId: string;
  date: string;
  exercises: ExerciseLog[];
  durationMinutes: number;
  totalVolumeLbs: number;
  strainContribution: number;
  recoveryAtStart: number | null;
  notes: string;
  createdAt: string;
}

export interface ExerciseLog {
  exerciseId: string;
  name: string;
  sets: SetLog[];
}

export interface SetLog {
  setNumber: number;
  weight: number;
  reps: number;
  completedAt: string;
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export type TabName = 'today' | 'space' | 'build' | 'me';

// ─── Capture ─────────────────────────────────────────────────────────────────

export interface CaptureItem {
  id: string;
  userId: string;
  type: 'text' | 'drawing' | 'voice';
  content: string;
  transcription?: string;
  createdAt: string;
}
