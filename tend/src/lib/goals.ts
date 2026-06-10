import { appStorage, getObject, setObject } from './storage';
import { supabase } from './supabase';

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: 'business' | 'health' | 'personal' | 'learning';
  targetDate: string | null;
  milestones: Milestone[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

const GOALS_KEY = 'goals_v1';

export function loadGoals(): Goal[] {
  return getObject<Goal[]>(appStorage, GOALS_KEY) ?? [];
}

export function saveGoals(goals: Goal[]): void {
  setObject(appStorage, GOALS_KEY, goals);
}

export function createGoal(title: string, category: Goal['category'], targetDate?: string): Goal {
  const goal: Goal = {
    id: `goal_${Date.now()}`,
    title,
    description: '',
    category,
    targetDate: targetDate ?? null,
    milestones: [],
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archived: false,
  };
  const goals = loadGoals();
  saveGoals([goal, ...goals]);
  return goal;
}

export function updateGoal(id: string, updates: Partial<Goal>): void {
  const goals = loadGoals().map(g =>
    g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
  );
  saveGoals(goals);
}

export function deleteGoal(id: string): void {
  saveGoals(loadGoals().filter(g => g.id !== id));
}

export function addMilestone(goalId: string, title: string): void {
  const goals = loadGoals().map(g => {
    if (g.id !== goalId) return g;
    const milestone: Milestone = {
      id: `ms_${Date.now()}`,
      title,
      completed: false,
      completedAt: null,
    };
    return { ...g, milestones: [...g.milestones, milestone], updatedAt: new Date().toISOString() };
  });
  saveGoals(goals);
}

export function toggleMilestone(goalId: string, milestoneId: string): void {
  const goals = loadGoals().map(g => {
    if (g.id !== goalId) return g;
    const milestones = g.milestones.map(m => {
      if (m.id !== milestoneId) return m;
      return { ...m, completed: !m.completed, completedAt: !m.completed ? new Date().toISOString() : null };
    });
    return { ...g, milestones, updatedAt: new Date().toISOString() };
  });
  saveGoals(goals);
}

export function getGoalProgress(goal: Goal): number {
  if (goal.milestones.length === 0) return goal.completedAt ? 1 : 0;
  return goal.milestones.filter(m => m.completed).length / goal.milestones.length;
}

export async function syncGoalsToSupabase(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const goals = loadGoals();
    for (const goal of goals) {
      await supabase.from('goals').upsert({
        id: goal.id, user_id: user.id, title: goal.title,
        description: goal.description, category: goal.category,
        target_date: goal.targetDate, completed_at: goal.completedAt,
        archived: goal.archived, created_at: goal.createdAt, updated_at: goal.updatedAt,
      }, { onConflict: 'id' });
    }
  } catch { /* best-effort */ }
}
