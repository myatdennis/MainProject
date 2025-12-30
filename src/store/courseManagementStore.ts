import { Course, LearnerProgress, LessonProgress, ChapterProgress, CourseAnalytics, CourseRecommendation } from '../types/courseTypes';
import {
  getAllCoursesFromDatabase,
  syncCourseToDatabase,
  deleteCourseFromDatabase,
} from '../dal/adminCourses';
import type { NormalizedCourse } from '../utils/courseNormalization';
import { convertModulesToChapters, recalculateCourseDurations, buildModulesFromChapters } from '../utils/courseStructure';

// Enhanced Course Store with full CMS functionality
class CourseManagementStore {
  private courses: Map<string, Course> = new Map();
  private learnerProgress: Map<string, LearnerProgress> = new Map();
  private analytics: Map<string, CourseAnalytics> = new Map();
  private hydrationPromise: Promise<void>;
  private supabaseHydrated = false;
  private hasSupabaseConfig = Boolean(import.meta.env?.VITE_SUPABASE_URL) && Boolean(import.meta.env?.VITE_SUPABASE_ANON_KEY);
  
  constructor() {
    this.initializeSampleData();
    this.hydrationPromise = this.hydrateFromSupabase();
  }

  async ready(): Promise<void> {
    return this.hydrationPromise.catch(() => {});
  }

  private hydrateFromSupabase(): Promise<void> {
    if (!this.hasSupabaseConfig) {
      return Promise.resolve();
    }

    const hydrate = async () => {
      try {
        const remoteCourses = await getAllCoursesFromDatabase();
        if (!remoteCourses || remoteCourses.length === 0) {
          return;
        }

        remoteCourses.forEach((record: NormalizedCourse) => {
          const hydrated = convertModulesToChapters(record as unknown as Course);
          this.courses.set(hydrated.id, hydrated);
        });
        this.supabaseHydrated = true;
      } catch (error) {
        console.warn('[courseManagementStore] Failed to hydrate from Supabase:', error);
      }
    };

    return hydrate();
  }

  // Course Management
  createCourse(courseData: Partial<Course>): Course {
    const id = this.generateId('course');
    const course: Course = {
      id,
      title: courseData.title || 'New Course',
      description: courseData.description || '',
      thumbnail: courseData.thumbnail || 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800',
      instructorId: courseData.instructorId || 'instructor-1',
      instructorName: courseData.instructorName || 'Expert Instructor',
      instructorAvatar: courseData.instructorAvatar || 'https://images.pexels.com/photos/3184416/pexels-photo-3184416.jpeg?auto=compress&cs=tinysrgb&w=200',
      category: courseData.category || 'General',
      difficulty: courseData.difficulty || 'Beginner',
      duration: courseData.duration || '0 min',
      estimatedDuration: courseData.estimatedDuration || 60,
      learningObjectives: courseData.learningObjectives || [],
      prerequisites: courseData.prerequisites || [],
      tags: courseData.tags || [],
      language: courseData.language || 'English',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      enrollmentCount: 0,
      rating: 0,
      reviewCount: 0,
      chapters: [],
      accessibilityFeatures: {
        hasClosedCaptions: false,
        hasTranscripts: false,
        hasAudioDescription: false,
        hasSignLanguage: false,
        colorContrastCompliant: true,
        keyboardNavigable: true,
        screenReaderCompatible: true,
      },
      metadata: {},
      ...courseData,
    };

    const normalizedCourse = recalculateCourseDurations(course);
    this.courses.set(id, normalizedCourse);
    return normalizedCourse;
  }

  getCourse(id: string): Course | null {
    return this.courses.get(id) || null;
  }

  getAllCourses(): Course[] {
    return Array.from(this.courses.values());
  }

  setCourse(course: Course): Course {
    const normalized = recalculateCourseDurations({
      ...course,
      updatedAt: course.updatedAt || new Date().toISOString(),
    });
    this.courses.set(course.id, normalized);
    return normalized;
  }

  updateCourse(id: string, updates: Partial<Course>): Course | null {
    const course = this.courses.get(id);
    if (!course) return null;

    const updatedCourse = {
      ...course,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.courses.set(id, updatedCourse);
    return updatedCourse;
  }

  deleteCourse(id: string, options: { skipRemote?: boolean } = {}): boolean {
    const removed = this.courses.delete(id);
    if (removed && this.hasSupabaseConfig && !options.skipRemote) {
      deleteCourseFromDatabase(id).catch((error) => {
        console.warn('[courseManagementStore] Failed to delete course from Supabase:', error);
      });
    }
    return removed;
  }

  publishCourse(id: string): Course | null {
    const course = this.courses.get(id);
    if (!course) return null;

    const publishedCourse = {
      ...course,
      status: 'published' as const,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.courses.set(id, publishedCourse);
    if (this.hasSupabaseConfig) {
      const payload = buildModulesFromChapters(publishedCourse);
      syncCourseToDatabase(payload).catch((error) => {
        console.warn('[courseManagementStore] Failed to sync published course to Supabase:', error);
      });
    }
    return publishedCourse;
  }

  // Chapter and Lesson Management
  addChapterToCourse(courseId: string, chapterData: any) {
    const course = this.courses.get(courseId);
    if (!course) return null;

    const chapterId = this.generateId('chapter');
    const chapter = {
      id: chapterId,
      courseId,
      title: chapterData.title || 'New Chapter',
      description: chapterData.description || '',
      order: (course.chapters || []).length,
      estimatedDuration: 0,
      lessons: [],
      ...chapterData,
    };

    if (!course.chapters) course.chapters = [];
    course.chapters.push(chapter);
    this.courses.set(courseId, course);
    return chapter;
  }

  addLessonToChapter(courseId: string, chapterId: string, lessonData: any) {
    const course = this.courses.get(courseId);
    if (!course) return null;

    const chapter = (course.chapters || []).find(c => c.id === chapterId);
    if (!chapter) return null;

    const lessonId = this.generateId('lesson');
    const lesson = {
      id: lessonId,
      chapterId,
      title: lessonData.title || 'New Lesson',
      description: lessonData.description || '',
      type: lessonData.type || 'video',
      order: chapter.lessons.length,
      estimatedDuration: lessonData.estimatedDuration || 10,
      content: lessonData.content || {},
      isRequired: lessonData.isRequired !== false,
      resources: lessonData.resources || [],
      ...lessonData,
    };

    chapter.lessons.push(lesson);
    
    // Update chapter duration
    chapter.estimatedDuration = chapter.lessons.reduce((sum, l) => sum + (l.estimatedDuration || 0), 0);
    
    // Update course duration
    course.estimatedDuration = (course.chapters || []).reduce((sum, c) => sum + c.estimatedDuration, 0);

    this.courses.set(courseId, course);
    return lesson;
  }

  // Progress Tracking
  enrollLearner(learnerId: string, courseId: string): LearnerProgress {
    const progressId = `${learnerId}-${courseId}`;
    const existingProgress = this.learnerProgress.get(progressId);
    
    if (existingProgress) return existingProgress;

    const course = this.courses.get(courseId);
    if (!course) throw new Error('Course not found');

    const progress: LearnerProgress = {
      id: progressId,
      learnerId,
      courseId,
      enrolledAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      overallProgress: 0,
      timeSpent: 0,
      chapterProgress: (course.chapters || []).map(chapter => ({
        chapterId: chapter.id,
        progress: 0,
        timeSpent: 0,
        lessonProgress: chapter.lessons.map(lesson => ({
          lessonId: lesson.id,
          status: 'not-started' as const,
          progress: 0,
          timeSpent: 0,
        })),
      })),
      lessonProgress: [],
      bookmarks: [],
      notes: [],
    };

    this.learnerProgress.set(progressId, progress);
    
    // Update course enrollment count
    if (course.enrollmentCount) {
      course.enrollmentCount++;
    } else {
      course.enrollmentCount = 1;
    }
    this.courses.set(courseId, course);

    return progress;
  }

  updateProgress(learnerId: string, courseId: string, updates: Partial<LearnerProgress>): LearnerProgress | null {
    const progressId = `${learnerId}-${courseId}`;
    const progress = this.learnerProgress.get(progressId);
    
    if (!progress) return null;

    const updatedProgress = {
      ...progress,
      ...updates,
      lastAccessedAt: new Date().toISOString(),
    };

    this.learnerProgress.set(progressId, updatedProgress);
    return updatedProgress;
  }

  updateLessonProgress(learnerId: string, courseId: string, lessonId: string, lessonProgress: Partial<LessonProgress>): boolean {
    const progressId = `${learnerId}-${courseId}`;
    const progress = this.learnerProgress.get(progressId);
    
    if (!progress) return false;

    // Find and update lesson progress
    for (const chapterProgress of progress.chapterProgress) {
      const lessonProgressItem = chapterProgress.lessonProgress.find((lp: LessonProgress) => lp.lessonId === lessonId);
      if (lessonProgressItem) {
        Object.assign(lessonProgressItem, lessonProgress);
        
        // Recalculate chapter progress
        const totalLessons = chapterProgress.lessonProgress.length;
        const completedLessons = chapterProgress.lessonProgress.filter((lp: LessonProgress) => lp.status === 'completed').length;
        chapterProgress.progress = (completedLessons / totalLessons) * 100;
        
        // Recalculate overall progress
        const totalChapters = progress.chapterProgress.length;
        const overallProgress = progress.chapterProgress.reduce((sum: number, cp: ChapterProgress) => sum + cp.progress, 0) / totalChapters;
        progress.overallProgress = overallProgress;

        this.learnerProgress.set(progressId, progress);
        return true;
      }
    }

    return false;
  }

  // Bookmarks and Notes
  addBookmark(learnerId: string, courseId: string, bookmarkData: { lessonId: string; position: number; note?: string }): any {
    const progressId = `${learnerId}-${courseId}`;
    const progress = this.learnerProgress.get(progressId);
    
    if (!progress) return null;

    const newBookmark = {
      id: this.generateId('bookmark'),
      lessonId: bookmarkData.lessonId,
      position: bookmarkData.position,
      note: bookmarkData.note,
      createdAt: new Date().toISOString(),
    };

    progress.bookmarks.push(newBookmark);
    this.learnerProgress.set(progressId, progress);
    return newBookmark;
  }

  addNote(learnerId: string, courseId: string, noteData: { lessonId: string; content: string; position?: number; isPrivate?: boolean }): any {
    const progressId = `${learnerId}-${courseId}`;
    const progress = this.learnerProgress.get(progressId);
    
    if (!progress) return null;

    const newNote = {
      id: this.generateId('note'),
      lessonId: noteData.lessonId,
      position: noteData.position,
      content: noteData.content,
      isPrivate: noteData.isPrivate !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    progress.notes.push(newNote);
    this.learnerProgress.set(progressId, progress);
    return newNote;
  }

  // Course Player specific methods
  markLessonComplete(learnerId: string, courseId: string, lessonId: string): void {
    const progressId = `${learnerId}-${courseId}`;
    const progress = this.learnerProgress.get(progressId);
    
    if (!progress) return;

    const lessonProgress = progress.lessonProgress.find(lp => lp.lessonId === lessonId);
    if (lessonProgress) {
      lessonProgress.isCompleted = true;
      lessonProgress.completedAt = new Date().toISOString();
      lessonProgress.progressPercent = 100;
    } else {
      progress.lessonProgress.push({
        lessonId,
        status: 'completed',
        progress: 100,
        progressPercent: 100,
        isCompleted: true,
        timeSpent: 0,
        lastAccessedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      });
    }

    this.learnerProgress.set(progressId, progress);
  }

  getUserNotes(userId: string, courseId: string): any[] {
    const progressId = `${userId}-${courseId}`;
    const progress = this.learnerProgress.get(progressId);
    return progress?.notes || [];
  }

  getUserBookmarks(userId: string, courseId: string): any[] {
    const progressId = `${userId}-${courseId}`;
    const progress = this.learnerProgress.get(progressId);
    return progress?.bookmarks || [];
  }

  // Course Recommendations
  getRecommendationsForLearner(learnerId: string, limit: number = 5): CourseRecommendation[] {
    // Simple recommendation algorithm - in real app would use AI/ML
    const allCourses = this.getAllCourses().filter(c => c.status === 'published');
    const learnerCourses = Array.from(this.learnerProgress.values())
      .filter(p => p.learnerId === learnerId)
      .map(p => p.courseId);

    const recommendations = allCourses
      .filter(course => !learnerCourses.includes(course.id))
      .map(course => ({
        courseId: course.id,
        score: Math.random(), // Mock scoring
        reason: 'similar-content' as const,
        explanation: `Recommended based on your interest in ${course.category}`,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return recommendations;
  }

  // Analytics
  getCourseAnalytics(courseId: string): CourseAnalytics | null {
    return this.analytics.get(courseId) || null;
  }

  // Search and Filtering
  searchCourses(query: string, filters?: any): Course[] {
    const allCourses = this.getAllCourses();
    let results = allCourses;

    // Text search
    if (query) {
      results = results.filter(course =>
        course.title.toLowerCase().includes(query.toLowerCase()) ||
        course.description.toLowerCase().includes(query.toLowerCase()) ||
        (course.instructorName || '').toLowerCase().includes(query.toLowerCase()) ||
        (course.tags || []).some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
    }

    // Apply filters
    if (filters) {
      if (filters.category) {
        results = results.filter(course => course.category === filters.category);
      }
      if (filters.difficulty) {
        results = results.filter(course => course.difficulty === filters.difficulty);
      }
      if (filters.duration) {
        const [min, max] = filters.duration;
        results = results.filter(course => (course.estimatedDuration || 0) >= min && (course.estimatedDuration || 0) <= max);
      }
      if (filters.rating) {
        results = results.filter(course => (course.rating || 0) >= filters.rating);
      }
    }

    return results;
  }

  // Utility methods
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeSampleData(): void {
    if (this.hasSupabaseConfig || this.supabaseHydrated) {
      return;
    }
    this.createSampleCourses();
  }

  private createSampleCourses(): void {
    // Inclusive Leadership Course
    const inclusiveLeadership = this.createCourse({
      title: 'Inclusive Leadership Mastery',
      description: 'Comprehensive training on building inclusive teams and leading with empathy in diverse workplace environments.',
      category: 'Leadership',
      difficulty: 'Intermediate',
      estimatedDuration: 240,
      instructorName: 'Dr. Maya Patel',
      instructorAvatar: 'https://images.pexels.com/photos/3184416/pexels-photo-3184416.jpeg?auto=compress&cs=tinysrgb&w=200',
      learningObjectives: [
        'Understand the principles of inclusive leadership',
        'Develop strategies for building diverse teams',
        'Learn to recognize and address unconscious bias',
        'Create inclusive communication practices'
      ],
      tags: ['leadership', 'diversity', 'inclusion', 'management'],
      rating: 4.8,
      reviewCount: 156,
      enrollmentCount: 1247
    });

    // Add chapters to the course
    const chapter1 = this.addChapterToCourse(inclusiveLeadership.id, {
      title: 'Foundations of Inclusive Leadership',
      description: 'Understanding the core principles and benefits of inclusive leadership practices.',
    });

    if (chapter1) {
      this.addLessonToChapter(inclusiveLeadership.id, chapter1.id, {
        title: 'What is Inclusive Leadership?',
        type: 'video',
        estimatedDuration: 15,
        content: {
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoProvider: 'youtube',
          transcript: 'Welcome to our comprehensive course on inclusive leadership...',
          captions: [
            { startTime: 0, endTime: 5, text: 'Welcome to our comprehensive course' },
            { startTime: 5, endTime: 10, text: 'on inclusive leadership practices' }
          ]
        },
        resources: [
          {
            id: 'resource-1',
            title: 'Inclusive Leadership Framework PDF',
            type: 'pdf',
            url: '/resources/inclusive-leadership-framework.pdf',
            downloadable: true,
            size: '2.3 MB'
          }
        ]
      });

      this.addLessonToChapter(inclusiveLeadership.id, chapter1.id, {
        title: 'Benefits of Diversity',
        type: 'video',
        estimatedDuration: 12,
        content: {
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoProvider: 'youtube',
          transcript: 'Research shows that diverse teams outperform...'
        }
      });

      this.addLessonToChapter(inclusiveLeadership.id, chapter1.id, {
        title: 'Knowledge Check: Foundations',
        type: 'quiz',
        estimatedDuration: 8,
        content: {
          questions: [
            {
              id: 'q1',
              type: 'multiple-choice',
              question: 'What is the primary benefit of inclusive leadership?',
              options: [
                'Increased team performance',
                'Better decision making',
                'Enhanced innovation',
                'All of the above'
              ],
              correctAnswer: 'All of the above',
              points: 10,
              explanation: 'Inclusive leadership provides multiple benefits including performance, decision-making, and innovation improvements.'
            }
          ]
        },
        passingScore: 70,
        maxAttempts: 3
      });
    }

    // SafeSport-style course
    const safeSport = this.createCourse({
      title: 'Safe Sport Fundamentals',
      description: 'Essential training for creating safe, respectful sporting environments for all participants.',
      category: 'Safety & Compliance',
      difficulty: 'Beginner',
      estimatedDuration: 90,
      instructorName: 'Coach Jennifer Smith',
      learningObjectives: [
        'Understand SafeSport policies and procedures',
        'Recognize signs of misconduct',
        'Learn reporting protocols',
        'Create safe sporting environments'
      ],
      tags: ['safety', 'sports', 'compliance', 'ethics'],
      rating: 4.9,
      reviewCount: 89,
      enrollmentCount: 2156
    });

    // Tech Skills course
    const dataAnalytics = this.createCourse({
      title: 'Data Analytics for Business Leaders',
      description: 'Learn to leverage data analytics for strategic business decisions and competitive advantage.',
      category: 'Technology',
      difficulty: 'Advanced',
      estimatedDuration: 360,
      instructorName: 'Alex Chen',
      learningObjectives: [
        'Master data analysis fundamentals',
        'Build effective dashboards',
        'Make data-driven decisions',
        'Implement analytics strategies'
      ],
      tags: ['analytics', 'data', 'business', 'technology'],
      rating: 4.7,
      reviewCount: 203,
      enrollmentCount: 892
    });

    // Update course statuses
    this.publishCourse(inclusiveLeadership.id);
    this.publishCourse(safeSport.id);
    this.publishCourse(dataAnalytics.id);
  }

  // Get learner's enrolled courses
  getLearnerCourses(learnerId: string): { course: Course; progress: LearnerProgress }[] {
    const learnerProgressEntries = Array.from(this.learnerProgress.values())
      .filter(progress => progress.learnerId === learnerId);

    return learnerProgressEntries.map(progress => {
      const course = this.getCourse(progress.courseId);
      return { course: course!, progress };
    }).filter(item => item.course);
  }

  // Get progress for a specific course
  getLearnerProgress(learnerId: string, courseId: string): LearnerProgress | null {
    const progressId = `${learnerId}-${courseId}`;
    return this.learnerProgress.get(progressId) || null;
  }
}

export const courseManagementStore = new CourseManagementStore();
export default courseManagementStore;
