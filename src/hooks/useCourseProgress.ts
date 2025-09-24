import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { courseStore } from '../store/courseStore';
import type { UserLessonProgress, UserCourseEnrollment, UserReflection } from '../lib/supabase';

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
      
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        // Demo mode - use local storage for progress tracking
        console.log('Running course progress in demo mode');
        
        const demoUserId = 'demo-user';
        const enrollmentKey = `huddle_enrollment_${courseId}`;
        const progressKey = `huddle_lesson_progress_${courseId}`;
        const reflectionsKey = `huddle_reflections_${courseId}`;
        
        // Load enrollment data from localStorage
        const savedEnrollment = localStorage.getItem(enrollmentKey);
        if (savedEnrollment) {
          setEnrollmentData(JSON.parse(savedEnrollment));
        } else {
          // Auto-enroll in demo mode
          const demoEnrollment = {
            user_id: demoUserId,
            course_id: courseId,
            enrolled_at: new Date().toISOString(),
            progress_percentage: 0,
            last_accessed_at: new Date().toISOString()
          };
          localStorage.setItem(enrollmentKey, JSON.stringify(demoEnrollment));
          setEnrollmentData(demoEnrollment);
        }
        
        // Load lesson progress from localStorage
        const savedProgress = localStorage.getItem(progressKey);
        if (savedProgress) {
          setLessonProgress(JSON.parse(savedProgress));
        }
        
        // Load reflections from localStorage
        const savedReflections = localStorage.getItem(reflectionsKey);
        if (savedReflections) {
          setReflections(JSON.parse(savedReflections));
        }
        
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
        const progressMap = progress.reduce((acc, item) => {
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
        const reflectionMap = reflectionData.reduce((acc, item) => {
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
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        // Demo mode - use local storage
        const demoUserId = 'demo-user';
        const enrollmentKey = `huddle_enrollment_${courseId}`;
        const enrollmentData = {
          user_id: demoUserId,
          course_id: courseId,
          enrolled_at: new Date().toISOString(),
          progress_percentage: 0,
          last_accessed_at: new Date().toISOString()
        };
        localStorage.setItem(enrollmentKey, JSON.stringify(enrollmentData));
        setEnrollmentData(enrollmentData);
        return enrollmentData;
      }
      
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
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        // Demo mode - use local storage
        const progressKey = `huddle_lesson_progress_${courseId}`;
        const currentProgress = JSON.parse(localStorage.getItem(progressKey) || '{}');
        
        const updateData = {
          user_id: 'demo-user',
          lesson_id: lessonId,
          completed: progressData.completed || false,
          progress_percentage: progressData.progressPercentage || 0,
          time_spent: progressData.timeSpent || 0,
          last_accessed_at: new Date().toISOString(),
          ...(progressData.completed && { completed_at: new Date().toISOString() })
        };
        
        currentProgress[lessonId] = updateData;
        localStorage.setItem(progressKey, JSON.stringify(currentProgress));
        
        setLessonProgress(prev => ({
          ...prev,
          [lessonId]: updateData
        }));
        
        // Update course progress in demo mode
        await updateCourseProgress();
        
        return updateData;
      }
      
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
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        // Demo mode - calculate progress from course store
        const course = courseStore.getCourse(courseId);
        if (!course) return;
        
        // Calculate progress from course modules/lessons
        const totalLessons = course.modules.reduce((acc, module) => acc + module.lessons.length, 0);
        const completedLessons = Object.values(lessonProgress).filter(p => p.completed).length;
        const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
        
        // Update enrollment progress in localStorage
        const enrollmentKey = `huddle_enrollment_${courseId}`;
        const currentEnrollment = JSON.parse(localStorage.getItem(enrollmentKey) || '{}');
        const updatedEnrollment = {
          ...currentEnrollment,
          progress_percentage: progressPercentage,
          last_accessed_at: new Date().toISOString(),
          ...(progressPercentage === 100 && { completed_at: new Date().toISOString() })
        };
        
        localStorage.setItem(enrollmentKey, JSON.stringify(updatedEnrollment));
        setEnrollmentData(updatedEnrollment);
        return;
      }
      
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
      const completedLessons = courseLessons.filter(lesson => 
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
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        // Demo mode - use local storage
        const reflectionsKey = `huddle_reflections_${courseId}`;
        const currentReflections = JSON.parse(localStorage.getItem(reflectionsKey) || '{}');
        
        const reflectionData = {
          user_id: 'demo-user',
          lesson_id: lessonId,
          content,
          updated_at: new Date().toISOString()
        };
        
        currentReflections[lessonId] = reflectionData;
        localStorage.setItem(reflectionsKey, JSON.stringify(currentReflections));
        
        setReflections(prev => ({
          ...prev,
          [lessonId]: reflectionData
        }));
        
        return reflectionData;
      }
      
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