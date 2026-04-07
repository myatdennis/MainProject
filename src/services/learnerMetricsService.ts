import { getSupabase, hasSupabaseConfig } from '../lib/supabaseClient';

const isSupabaseReady = hasSupabaseConfig();
const unavailableTables = new Set<string>();

const isMissingTableError = (error: unknown) => {
  const code = String((error as any)?.code ?? '').toUpperCase();
  const status = Number((error as any)?.status ?? (error as any)?.statusCode ?? 0);
  const message = String((error as any)?.message ?? '').toLowerCase();
  return (
    code === '42P01' ||
    message.includes('relation') && message.includes('does not exist') ||
    message.includes('could not find') && message.includes('table') ||
    status === 404
  );
};

const markUnavailableIfMissing = (tableName: string, error: unknown) => {
  if (!isMissingTableError(error)) return;
  unavailableTables.add(tableName);
  console.warn(`[learnerMetricsService] ${tableName} is unavailable in this environment; disabling this metric source.`);
};

export interface PersistedGoal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  targetDate?: string;
  progress: number;
  status: 'active' | 'completed' | 'overdue';
}

export interface PersistedAchievement {
  id: string;
  userId: string;
  title: string;
  description?: string;
  earnedDate?: string;
  icon?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const mapGoal = (row: any): PersistedGoal => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  description: row.description ?? undefined,
  targetDate: row.target_date ?? undefined,
  progress: row.progress ?? 0,
  status: (row.status as PersistedGoal['status']) ?? 'active',
});

const mapAchievement = (row: any): PersistedAchievement => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  description: row.description ?? undefined,
  earnedDate: row.earned_date ?? undefined,
  icon: row.icon ?? undefined,
  rarity: (row.rarity as PersistedAchievement['rarity']) ?? 'common',
});

export const learnerMetricsService = {
  isEnabled(): boolean {
    return isSupabaseReady;
  },

  async fetchGoals(userId: string): Promise<PersistedGoal[]> {
    if (!isSupabaseReady || !userId || unavailableTables.has('user_learning_goals')) return [];
    try {
      const supabase = await getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('user_learning_goals')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data ?? []).map(mapGoal);
    } catch (error) {
      markUnavailableIfMissing('user_learning_goals', error);
      console.error('Failed to fetch learning goals:', error);
      return [];
    }
  },

  async upsertGoals(userId: string, goals: PersistedGoal[]): Promise<void> {
    if (!isSupabaseReady || !userId || goals.length === 0 || unavailableTables.has('user_learning_goals')) return;
    const payload = goals.map((goal) => ({
      id: goal.id,
      user_id: userId,
      title: goal.title,
      description: goal.description ?? null,
      target_date: goal.targetDate ?? null,
      progress: goal.progress ?? 0,
      status: goal.status ?? 'active',
      updated_at: new Date().toISOString(),
    }));

    try {
      const supabase = await getSupabase();
      if (!supabase) return;
      const { error } = await supabase.from('user_learning_goals').upsert(payload);
      if (error) throw error;
    } catch (error) {
      markUnavailableIfMissing('user_learning_goals', error);
      console.error('Failed to upsert learning goals:', error);
    }
  },

  async fetchAchievements(userId: string): Promise<PersistedAchievement[]> {
    if (!isSupabaseReady || !userId || unavailableTables.has('user_achievements')) return [];
    try {
      const supabase = await getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data ?? []).map(mapAchievement);
    } catch (error) {
      markUnavailableIfMissing('user_achievements', error);
      console.error('Failed to fetch achievements:', error);
      return [];
    }
  },

  async upsertAchievements(userId: string, achievements: PersistedAchievement[]): Promise<void> {
    if (!isSupabaseReady || !userId || achievements.length === 0 || unavailableTables.has('user_achievements')) return;
    const payload = achievements.map((item) => ({
      id: item.id,
      user_id: userId,
      title: item.title,
      description: item.description ?? null,
      earned_date: item.earnedDate ?? null,
      icon: item.icon ?? null,
      rarity: item.rarity ?? 'common',
      updated_at: new Date().toISOString(),
    }));

    try {
      const supabase = await getSupabase();
      if (!supabase) return;
      const { error } = await supabase.from('user_achievements').upsert(payload);
      if (error) throw error;
    } catch (error) {
      markUnavailableIfMissing('user_achievements', error);
      console.error('Failed to upsert achievements:', error);
    }
  },
};

export default learnerMetricsService;
