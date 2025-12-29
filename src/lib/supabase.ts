import supabaseClient, {
  getSupabase,
  getSupabaseClient,
  getSupabaseStatus,
  getSupabaseSync,
  hasSupabaseConfig,
  supabaseClient as supabase,
  type Course,
  type Lesson,
  type Module,
  type UserCourseEnrollment,
  type UserLessonProgress,
  type UserProfile,
  type UserQuizAttempt,
  type UserReflection,
} from './supabaseClient';

// Legacy shim: keep exporting the same APIs so older imports continue to work,
// but route everything through the consolidated supabaseClient implementation.
export { getSupabase, getSupabaseClient, getSupabaseStatus, getSupabaseSync, hasSupabaseConfig, supabase };

export type {
  Course,
  Lesson,
  Module,
  UserCourseEnrollment,
  UserLessonProgress,
  UserProfile,
  UserQuizAttempt,
  UserReflection,
};

export default supabaseClient;
