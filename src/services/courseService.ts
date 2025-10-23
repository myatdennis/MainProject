import { supabase } from '../lib/supabase';
import type { Course, Module, Lesson } from '../lib/supabase';

export class CourseService {
  // Sync course data from localStorage to Supabase
  static async syncCourseToDatabase(course: any) {
    // Check if Supabase is properly configured
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.warn('Supabase not configured - skipping database sync for course:', course.title);
      return null;
    }

    try {
      console.log('Syncing course to database:', course.id, course.title);
      
      // Insert/update course
      const organizationId = course.organizationId || course.organization_id || null;

      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .upsert({
          id: course.id,
          title: course.title,
          description: course.description,
          status: course.status,
          thumbnail: course.thumbnail,
          duration: course.duration,
          difficulty: course.difficulty,
          estimated_time: course.estimatedTime,
          prerequisites: course.prerequisites,
          learning_objectives: course.learningObjectives,
          key_takeaways: course.keyTakeaways,
          tags: course.tags,
          type: course.type,
          created_by: course.createdBy,
          organization_id: organizationId,
          updated_at: new Date().toISOString(),
          published_at: course.publishedDate,
          due_date: course.dueDate
        })
        .select()
        .single();

      if (courseError) throw courseError;
      console.log('Course synced successfully:', courseData.id);

      // Sync modules
      await Promise.all(
        course.modules.map(async (module: any) => {
          console.log('Syncing module:', module.id, module.title);
          const { data: moduleData, error: moduleError } = await supabase
            .from('modules')
            .upsert({
              id: module.id,
              course_id: course.id,
              title: module.title,
              description: module.description,
              duration: module.duration,
              order_index: module.order,
              organization_id: organizationId,
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (moduleError) throw moduleError;

          const lessons = Array.isArray(module.lessons) ? module.lessons : [];

          await Promise.all(
            lessons.map(async (lesson: any) => {
              console.log('Syncing lesson:', lesson.id, lesson.title);
              const { error: lessonError } = await supabase
                .from('lessons')
                .upsert({
                  id: lesson.id,
                  module_id: module.id,
                  title: lesson.title,
                  type: lesson.type,
                  duration: lesson.duration,
                  order_index: lesson.order,
                  content: lesson.content,
                  organization_id: organizationId,
                  updated_at: new Date().toISOString()
                });

              if (lessonError) throw lessonError;
              console.log('Lesson synced successfully:', lesson.id);
            })
          );

          return moduleData;
        })
      );

      return courseData;
    } catch (error) {
      console.error('Error syncing course to database:', error);
      throw error;
    }
  }

  // Load course data from Supabase
  static async loadCourseFromDatabase(courseId: string) {
    // Check if Supabase is properly configured
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.warn('Supabase not configured - cannot load course from database');
      throw new Error('Supabase not configured');
    }

    try {
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select(`
          *,
          modules (
            *,
            lessons (*)
          )
        `)
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;

      // Transform database format to frontend format
      const transformedCourse = {
        id: course.id,
        title: course.title,
        description: course.description,
        status: course.status,
        thumbnail: course.thumbnail,
        duration: course.duration,
        difficulty: course.difficulty,
        estimatedTime: course.estimated_time,
        prerequisites: course.prerequisites,
        learningObjectives: course.learning_objectives,
        keyTakeaways: course.key_takeaways,
        tags: course.tags,
        type: course.type,
        createdBy: course.created_by,
        createdDate: course.created_at,
        lastUpdated: course.updated_at,
        publishedDate: course.published_at,
        dueDate: course.due_date,
        modules: course.modules
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((module: any) => ({
            id: module.id,
            title: module.title,
            description: module.description,
            duration: module.duration,
            order: module.order_index,
            lessons: module.lessons
              .sort((a: any, b: any) => a.order_index - b.order_index)
              .map((lesson: any) => ({
                id: lesson.id,
                title: lesson.title,
                type: lesson.type,
                duration: lesson.duration,
                content: lesson.content,
                completed: false, // Will be set by progress hook
                order: lesson.order_index
              })),
            resources: [] // Resources would be loaded separately if needed
          }))
      };

      return transformedCourse;
    } catch (error) {
      console.error('Error loading course from database:', error);
      throw error;
    }
  }

  // Get all published courses
  static async getPublishedCourses() {
    // Check if Supabase is properly configured
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.warn('Supabase not configured - cannot load published courses from database');
      return [];
    }

    try {
      const { data: courses, error } = await supabase
        .from('courses')
        .select(`
          *,
          modules (
            *,
            lessons (*)
          )
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return courses.map((course: any) => ({
        id: course.id,
        title: course.title,
        description: course.description,
        status: course.status,
        thumbnail: course.thumbnail,
        duration: course.duration,
        difficulty: course.difficulty,
        estimatedTime: course.estimated_time,
        prerequisites: course.prerequisites,
        learningObjectives: course.learning_objectives,
        keyTakeaways: course.key_takeaways,
        tags: course.tags,
        type: course.type,
        lessons: course.modules.reduce((acc: number, module: any) => acc + module.lessons.length, 0),
        rating: 4.8, // Would calculate from actual ratings
        progress: 0, // Would be set by enrollment data
        modules: course.modules
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((module: any) => ({
            id: module.id,
            title: module.title,
            description: module.description,
            duration: module.duration,
            order: module.order_index,
            lessons: module.lessons
              .sort((a: any, b: any) => a.order_index - b.order_index)
              .map((lesson: any) => ({
                id: lesson.id,
                title: lesson.title,
                type: lesson.type,
                duration: lesson.duration,
                content: lesson.content,
                completed: false,
                order: lesson.order_index
              })),
            resources: []
          }))
      }));
    } catch (error) {
      console.error('Error loading published courses:', error);
      throw error;
    }
  }

  // Get all courses from database
  static async getAllCoursesFromDatabase() {
    // Check if Supabase is properly configured
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.warn('Supabase not configured - cannot load courses from database');
      return [];
    }

    try {
      const { data: courses, error } = await supabase
        .from('courses')
        .select(`
          *,
          modules (
            *,
            lessons (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform database format to frontend format
      return (courses || []).map((course: any) => ({
        id: course.id,
        title: course.title,
        description: course.description,
        status: course.status,
        thumbnail: course.thumbnail,
        duration: course.duration,
        difficulty: course.difficulty,
        estimatedTime: course.estimated_time,
        prerequisites: course.prerequisites,
        learningObjectives: course.learning_objectives,
        keyTakeaways: course.key_takeaways,
        tags: course.tags,
        type: course.type,
        createdBy: course.created_by,
        createdDate: course.created_at,
        lastUpdated: course.updated_at,
        publishedDate: course.published_at,
        dueDate: course.due_date,
        enrollments: 0, // Would be calculated from enrollments table
        completions: 0, // Would be calculated from progress table
        completionRate: 0, // Would be calculated
        avgRating: 0, // Would be calculated from ratings
        totalRatings: 0, // Would be calculated
        lessons: course.modules.reduce((acc: number, module: any) => acc + module.lessons.length, 0),
        rating: 0,
        progress: 0,
        modules: course.modules
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((module: any) => ({
            id: module.id,
            title: module.title,
            description: module.description,
            duration: module.duration,
            order: module.order_index,
            lessons: module.lessons
              .sort((a: any, b: any) => a.order_index - b.order_index)
              .map((lesson: any) => ({
                id: lesson.id,
                title: lesson.title,
                type: lesson.type,
                duration: lesson.duration,
                content: lesson.content,
                completed: false,
                order: lesson.order_index
              })),
            resources: []
          }))
      }));
    } catch (error) {
      console.error('Error loading courses from database:', error);
      // Return empty array instead of throwing to allow fallback to local storage
      return [];
    }
  }
}
