// Thin DAL facade over learner metrics service (Supabase-backed)
import { learnerMetricsService } from '../services/learnerMetricsService';
export type { PersistedGoal, PersistedAchievement } from '../services/learnerMetricsService';
export { learnerMetricsService };

export const isEnabled = (): boolean => learnerMetricsService.isEnabled();
export const fetchGoals = (userId: string) => learnerMetricsService.fetchGoals(userId);
export const upsertGoals = (userId: string, goals: import('../services/learnerMetricsService').PersistedGoal[]) =>
  learnerMetricsService.upsertGoals(userId, goals);
export const fetchAchievements = (userId: string) => learnerMetricsService.fetchAchievements(userId);
export const upsertAchievements = (
  userId: string,
  achievements: import('../services/learnerMetricsService').PersistedAchievement[],
) => learnerMetricsService.upsertAchievements(userId, achievements);
