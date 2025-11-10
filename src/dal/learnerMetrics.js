// Thin DAL facade over learner metrics service (Supabase-backed)
import { learnerMetricsService } from '../services/learnerMetricsService';
export { learnerMetricsService };
export const isEnabled = () => learnerMetricsService.isEnabled();
export const fetchGoals = (userId) => learnerMetricsService.fetchGoals(userId);
export const upsertGoals = (userId, goals) => learnerMetricsService.upsertGoals(userId, goals);
export const fetchAchievements = (userId) => learnerMetricsService.fetchAchievements(userId);
export const upsertAchievements = (userId, achievements) => learnerMetricsService.upsertAchievements(userId, achievements);
