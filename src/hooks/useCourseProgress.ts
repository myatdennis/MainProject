import { useState, useEffect } from 'react';
import { getSupabase, hasSupabaseConfig } from '../lib/supabaseClient';
import type { UserLessonProgress, UserCourseEnrollment, UserReflection } from '../lib/supabaseClient';

export const useCourseProgress = (courseId: string) => {
  const [enrollmentData, setEnrollmentData] = useState<UserCourseEnrollment | null>(null);
  const [lessonProgress, setLessonProgress] = useState<{ [lessonId: string]: UserLessonProgress }>({});
  const [reflections, setReflections] = useState<{ [lessonId: string]: UserReflection }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProgressData();
  }, [courseId]);

  const loadProgressData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!hasSupabaseConfig) {
        setLoading(false);
        return;
      }
      const supabase = await getSupabase();
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Load enrollment data
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('user_course_enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .limit(1);

      if (enrollmentError) {
        console.error('Error loading enrollment:', enrollmentError);
        setError('Failed to load enrollment data');
        return;
      } else if (enrollment && enrollment.length > 0) {
        setEnrollmentData(enrollment[0]);
      } else {
        setEnrollmentData(null);
      }

      // Load lesson progress
      const { data: progress, error: progressError } = await supabase
        .from('user_lesson_progress')
        .select('*')
        .eq('user_id', user.id);

      if (progressError) {
        console.error('Error loading lesson progress:', progressError);
      } else if (progress) {
        const progressMap = progress.reduce((acc: { [lessonId: string]: UserLessonProgress }, item: UserLessonProgress) => {
          acc[item.lesson_id] = item;
          return acc;
        }, {} as { [lessonId: string]: UserLessonProgress });
        setLessonProgress(progressMap);
      }

      // Load reflections
      const { data: reflectionData, error: reflectionError } = await supabase
        .from('user_reflections')
        .select('*')
        .eq('user_id', user.id);

      if (reflectionError) {
        console.error('Error loading reflections:', reflectionError);
      } else if (reflectionData) {
        const reflectionMap = reflectionData.reduce((acc: { [lessonId: string]: UserReflection }, item: UserReflection) => {
          acc[item.lesson_id] = item;
          return acc;
        }, {} as { [lessonId: string]: UserReflection });
        setReflections(reflectionMap);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const enrollInCourse = async () => {
    try {
  if (!hasSupabaseConfig) throw new Error('User not authenticated (Supabase disabled)');
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase client unavailable');
  const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('user_course_enrollments')
        .upsert({
          user_id: user.id,
          course_id: courseId,
          enrolled_at: new Date().toISOString(),
          progress_percentage: 0,
          last_accessed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      setEnrollmentData(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll');
      throw err;
    }
  };

  const updateLessonProgress = async (
    lessonId: string, 
    progressData: {
      completed?: boolean;
      progressPercentage?: number;
      timeSpent?: number;
    }
  ) => {
    try {
  if (!hasSupabaseConfig) return;
  const supabase = await getSupabase();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const updateData = {
        user_id: user.id,
        lesson_id: lessonId,
        completed: progressData.completed || false,
        progress_percentage: progressData.progressPercentage || 0,
        time_spent: progressData.timeSpent || 0,
        last_accessed_at: new Date().toISOString(),
        ...(progressData.completed && { completed_at: new Date().toISOString() })
      };

      const { data, error } = await supabase
        .from('user_lesson_progress')
        .upsert(updateData)
        .select()
        .single();

      if (error) throw error;

      setLessonProgress(prev => ({
        ...prev,
        [lessonId]: data
      }));

      // Update course progress
      await updateCourseProgress();
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update progress');
      throw err;
    }
  };

  const updateCourseProgress = async () => {
    try {
      const supabase = await getSupabase();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all lessons for this course
      const { data: courseLessons } = await supabase
        .from('lessons')
        .select(`
          id,
          modules!inner(
            course_id
          )
        `)
        .eq('modules.course_id', courseId);

      if (!courseLessons) return;

      // Calculate progress percentage
      const totalLessons = courseLessons.length;
      const completedLessons = courseLessons.filter((lesson: any) => 
        lessonProgress[lesson.id]?.completed
      ).length;
      
      const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      // Update enrollment progress
      const { data, error } = await supabase
        .from('user_course_enrollments')
        .upsert({
          user_id: user.id,
          course_id: courseId,
          progress_percentage: progressPercentage,
          last_accessed_at: new Date().toISOString(),
          ...(progressPercentage === 100 && { completed_at: new Date().toISOString() })
        })
        .select()
        .single();

      if (error) throw error;
      setEnrollmentData(data);
    } catch (err) {
      console.error('Error updating course progress:', err);
    }
  };

  const saveReflection = async (lessonId: string, content: string) => {
    try {
  if (!hasSupabaseConfig) throw new Error('User not authenticated (Supabase disabled)');
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase client unavailable');
  const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('user_reflections')
        .upsert({
          user_id: user.id,
          lesson_id: lessonId,
          content,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      setReflections(prev => ({
        ...prev,
        [lessonId]: data
      }));

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save reflection');
      throw err;
    }
  };

  const submitQuizAttempt = async (
    lessonId: string,
    answers: any,
    score: number,
    maxScore: number
  ) => {
    try {
  if (!hasSupabaseConfig) throw new Error('User not authenticated (Supabase disabled)');
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase client unavailable');
  const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get current attempt number
      const { data: existingAttempts } = await supabase
        .from('user_quiz_attempts')
        .select('attempt_number')
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
        .order('attempt_number', { ascending: false })
        .limit(1);

      const attemptNumber = existingAttempts && existingAttempts.length > 0 
        ? existingAttempts[0].attempt_number + 1 
        : 1;

      const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
      const passed = percentage >= 80; // 80% passing score

      const { data, error } = await supabase
        .from('user_quiz_attempts')
        .insert({
          user_id: user.id,
          lesson_id: lessonId,
          attempt_number: attemptNumber,
          score,
          max_score: maxScore,
          percentage,
          answers,
          completed_at: new Date().toISOString(),
          passed
        })
        .select()
        .single();

      if (error) throw error;

      // If passed, mark lesson as completed
      if (passed) {
        await updateLessonProgress(lessonId, {
          completed: true,
          progressPercentage: 100
        });
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit quiz');
      throw err;
    }
  };

  return {
    enrollmentData,
    lessonProgress,
    reflections,
    loading,
    error,
    enrollInCourse,
    updateLessonProgress,
    saveReflection,
    submitQuizAttempt,
    refreshProgress: loadProgressData
  };
};