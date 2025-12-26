import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

let supabaseClient: SupabaseClient | null = null;
let initError: Error | null = null;

const realtimeDefaults = {
  params: {
    eventsPerSecond: 10,
  },
};

function hydrateClient(): SupabaseClient | null {
  if (!hasSupabaseConfig) {
    if (import.meta.env.DEV) {
      console.info('[supabaseClient] Supabase not configured – falling back to demo data.');
    }
    return null;
  }
  if (supabaseClient) return supabaseClient;
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
      },
      db: {
        schema: 'public',
      },
      realtime: realtimeDefaults,
    });
    initError = null;
  } catch (error) {
    initError = error instanceof Error ? error : new Error(String(error));
    supabaseClient = null;
    console.error('[supabaseClient] Failed to initialize client:', initError.message);
  }
  return supabaseClient;
}

export async function getSupabase(): Promise<SupabaseClient | null> {
  return hydrateClient();
}

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  return hydrateClient();
}

export function getSupabaseSync(): SupabaseClient | null {
  return hydrateClient();
}

export function getSupabaseStatus() {
  if (!hasSupabaseConfig) {
    return { status: 'disabled', reason: 'missing-env' } as const;
  }
  if (initError) {
    return { status: 'error', message: initError.message } as const;
  }
  return { status: supabaseClient ? 'ready' : 'idle' } as const;
}

export { supabaseClient };

export default supabaseClient;

export interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  organization?: string;
  role?: string;
  cohort?: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  thumbnail?: string;
  duration?: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimated_time?: string;
  prerequisites: string[];
  learning_objectives: string[];
  key_takeaways: string[];
  tags: string[];
  type?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  due_date?: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  duration?: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  type: 'video' | 'interactive' | 'quiz' | 'download' | 'text';
  duration?: string;
  order_index: number;
  content: any;
  created_at: string;
  updated_at: string;
}

export interface UserCourseEnrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  completed_at?: string;
  progress_percentage: number;
  last_accessed_at: string;
}

export interface UserLessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  module_id?: string;
  course_id?: string;
  completed: boolean;
  completed_at?: string;
  time_spent: number;
  progress_percentage: number;
  last_accessed_at: string;
  status?: 'not-started' | 'in-progress' | 'completed';
  score?: number;
  attempts?: number;
  last_position?: number;
}

export interface UserQuizAttempt {
  id: string;
  user_id: string;
  lesson_id: string;
  attempt_number: number;
  score: number;
  max_score: number;
  percentage: number;
  answers: any;
  started_at: string;
  completed_at?: string;
  passed: boolean;
}

export interface UserReflection {
  id: string;
  user_id: string;
  lesson_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}
