import { useState, useEffect } from 'react';
import { appStorage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  displayName: string | null;
  fitnessGoal: string | null;
  trainingDaysPerWeek: number;
  yogaTime: 'morning' | 'evening';
}

const PROFILE_KEY = 'user_profile_v1';

function loadCached(): UserProfile | null {
  const raw = appStorage.getString(PROFILE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function saveCache(p: UserProfile) {
  appStorage.set(PROFILE_KEY, JSON.stringify(p));
}

export function useUserProfile(): UserProfile & { isLoaded: boolean } {
  const [profile, setProfile] = useState<UserProfile>(() => loadCached() ?? {
    displayName: null,
    fitnessGoal: null,
    trainingDaysPerWeek: 4,
    yogaTime: 'morning',
  });
  const [isLoaded, setIsLoaded] = useState(!!loadCached());

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('users')
          .select('display_name, fitness_goal, training_days_per_week, yoga_time')
          .eq('id', user.id)
          .single();

        if (data) {
          const p: UserProfile = {
            displayName: data.display_name ?? null,
            fitnessGoal: data.fitness_goal ?? null,
            trainingDaysPerWeek: data.training_days_per_week ?? 4,
            yogaTime: (data.yoga_time as 'morning' | 'evening') ?? 'morning',
          };
          saveCache(p);
          setProfile(p);
        }
      } catch {
        // Stay with cached
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  return { ...profile, isLoaded };
}
