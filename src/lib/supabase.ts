import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: any;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not found. Please click "Connect to Supabase" in the top right to set up your database connection.');
  
  // Create a mock client that won't break the app
  const createMockQuery = () => ({
    select: () => createMockQuery(),
    insert: () => createMockQuery(),
    update: () => createMockQuery(),
    upsert: () => createMockQuery(),
    delete: () => createMockQuery(),
    eq: () => createMockQuery(),
    order: () => createMockQuery(),
    single: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    then: (resolve: any) => resolve({ data: [], error: null })
  });

  supabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signUp: () => Promise.resolve({ data: { user: null }, error: { message: 'Supabase not configured' } }),
      signInWithPassword: () => Promise.resolve({ data: { user: null }, error: { message: 'Supabase not configured' } }),
      signOut: () => Promise.resolve({ error: null }),
      resetPasswordForEmail: () => Promise.resolve({ error: { message: 'Password reset not available in demo mode' } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => createMockQuery()
  };
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

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
  completed: boolean;
  completed_at?: string;
  time_spent: number; // in seconds
  progress_percentage: number;
  last_accessed_at: string;
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