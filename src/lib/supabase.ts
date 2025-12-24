// Lazy/dynamic import to avoid bundling supabase client when not configured
// This prevents runtime errors in environments without Supabase and avoids loading the supabase chunk unnecessarily.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

// Export a value that is either a Supabase client instance or null.
// Use top-level await with dynamic import so the module only loads when configured.
// Type is any to avoid importing supabase types eagerly.
// Consumers should handle the possibility of null (many already do).
// Defensive wrapper: some bundlers can still pre-evaluate dynamic import chunk.
// Provide a lazy getter so code only loads when actually needed.
let _supabase: any = null;
export async function getSupabase() {
  if (!hasSupabaseConfig) return null;
  if (_supabase) return _supabase;
  try {
    // If we're building for production and Supabase is configured at build time,
    // allow the bundler to include the supabase client so the dynamic import
    // resolves at runtime. In dev or when we explicitly want to avoid bundling,
    // keep the @vite-ignore strategy to prevent eager evaluation.
    const pkg: string = '@supabase' + '/supabase-js';
    let mod: any = null;
    // Always use a hidden/dynamic specifier so bundlers won't eagerly include
    // the supabase bundle in builds where it's not configured. This avoids
    // unexpected runtime evaluation of the large supabase chunk in demo/E2E
    // environments.
    mod = await import(/* @vite-ignore */ pkg);
    _supabase = mod.createClient(supabaseUrl!, supabaseAnonKey!, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
    return _supabase;
  } catch (err) {
    // In production we silence this to avoid noisy warnings when the client
    // intentionally falls back to a null client (e.g., E2E/demo mode).
    const isDevEnv = Boolean((import.meta as any)?.env?.DEV);
    if (isDevEnv) {
      // Only warn during local development. In production (or E2E/demo
      // builds) we intentionally silence this to avoid noisy console
      // messages that pollute Playwright captures and user telemetry.
      console.warn('[supabase] Dynamic import failed; falling back to null client:', err);
    }
    return null;
  }
}

// Backwards compatibility export (legacy code may import { supabase })
export const supabase: any = null;

// Database types
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
  content: any; // JSONB content
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
  time_spent: number; // in seconds
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
  answers: any; // JSONB
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
