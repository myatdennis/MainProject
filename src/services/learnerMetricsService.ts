import { getSupabase, hasSupabaseConfig } from '../lib/supabase';

const isSupabaseReady = hasSupabaseConfig;

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
    if (!isSupabaseReady || !userId) return [];
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
      console.error('Failed to fetch learning goals:', error);
      return [];
    }
  },

  async upsertGoals(userId: string, goals: PersistedGoal[]): Promise<void> {
    if (!isSupabaseReady || !userId || goals.length === 0) return;
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
      console.error('Failed to upsert learning goals:', error);
    }
  },

  async fetchAchievements(userId: string): Promise<PersistedAchievement[]> {
    if (!isSupabaseReady || !userId) return [];
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
      console.error('Failed to fetch achievements:', error);
      return [];
    }
  },

  async upsertAchievements(userId: string, achievements: PersistedAchievement[]): Promise<void> {
    if (!isSupabaseReady || !userId || achievements.length === 0) return;
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
      console.error('Failed to upsert achievements:', error);
    }
  },
};

export default learnerMetricsService;
