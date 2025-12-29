type SupabaseClient = import('@supabase/supabase-js').SupabaseClient;
type CreateClient = typeof import('@supabase/supabase-js').createClient;

type SupabaseModule = typeof import('@supabase/supabase-js');

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

const missingConfigMessage = 'Supabase credentials are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable syncing.';
let missingConfigLogged = false;

let supabaseClient: SupabaseClient | null = null;
let initError: Error | null = null;
let createClientLoader: Promise<CreateClient> | null = null;
let createClientFn: CreateClient | null = null;
let warnedAboutCdnFallback = false;

const SUPABASE_CDN_FALLBACK = 'https://esm.sh/@supabase/supabase-js@2.86.0?bundle&target=es2022';

const realtimeDefaults = {
  params: {
    eventsPerSecond: 10,
  },
};

async function importCreateClient(): Promise<CreateClient> {
  if (createClientFn) return createClientFn;
  if (!createClientLoader) {
    createClientLoader = loadSupabaseModule()
      .then((mod) => mod.createClient)
      .catch((error) => {
        initError = error instanceof Error ? error : new Error(String(error));
        if (import.meta.env.DEV) {
          console.error('[supabaseClient] Failed to load @supabase/supabase-js:', initError.message);
          console.info('👉 Run "npm install @supabase/supabase-js" to add the dependency or check your lockfile.');
        }
        createClientLoader = null;
        throw initError;
      });
  }
  createClientFn = await createClientLoader;
  return createClientFn;
}

async function loadSupabaseModule(): Promise<SupabaseModule> {
  try {
    return await import('@supabase/supabase-js');
  } catch (error) {
    if (shouldAttemptCdnFallback(error)) {
      return loadFromCdn(error as Error);
    }
    throw error;
  }
}

function shouldAttemptCdnFallback(error: unknown): boolean {
  if (!(error instanceof Error) || typeof error.message !== 'string') return false;
  const message = error.message;
  return (
    message.includes('Failed to resolve module specifier') ||
    message.includes('import call expects a relative or absolute URL') ||
    message.includes('Cannot find package') ||
    message.includes('Cannot find module')
  );
}

async function loadFromCdn(originalError: Error): Promise<SupabaseModule> {
  if (!warnedAboutCdnFallback) {
    console.warn('[supabaseClient] Falling back to CDN import for @supabase/supabase-js:', originalError.message);
    warnedAboutCdnFallback = true;
  }

  try {
    const module = await import(/* @vite-ignore */ SUPABASE_CDN_FALLBACK);
    console.info('[supabaseClient] Loaded @supabase/supabase-js via CDN fallback');
    return module as SupabaseModule;
  } catch (cdnError) {
    const reason = cdnError instanceof Error ? cdnError.message : String(cdnError);
    console.error('[supabaseClient] CDN fallback failed:', reason);
    // Re-throw the original error to preserve the root-cause stack for upstream handlers.
    throw originalError;
  }
}

function throwMissingSupabase(action?: string): never {
  const context = action ? ` (attempted ${action})` : '';
  const errorMessage = `${missingConfigMessage}${context}`;
  const error = new SupabaseConfigError(errorMessage);
  initError = error;
  if (!missingConfigLogged) {
    console.error('[supabaseClient] ' + errorMessage);
    missingConfigLogged = true;
  }
  throw error;
}

export function ensureSupabaseConfigured(action?: string): void {
  if (hasSupabaseConfig) return;
  throwMissingSupabase(action);
}

async function hydrateClient(): Promise<SupabaseClient | null> {
  if (!hasSupabaseConfig) {
    throwMissingSupabase('initializing Supabase client');
  }

  if (supabaseClient) return supabaseClient;

  try {
    const createClient = await importCreateClient();
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
    if (import.meta.env.DEV) {
      console.error('[supabaseClient] Failed to initialize client:', initError.message);
    }
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
  return supabaseClient;
}

export function getSupabaseStatus() {
  if (!hasSupabaseConfig) {
    return { status: 'disabled', reason: 'missing-env', message: missingConfigMessage } as const;
  }
  if (initError) {
    return { status: 'error', message: initError.message } as const;
  }
  return { status: supabaseClient ? 'ready' : 'idle' } as const;
}

export { missingConfigMessage as SUPABASE_MISSING_CONFIG_MESSAGE };

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
