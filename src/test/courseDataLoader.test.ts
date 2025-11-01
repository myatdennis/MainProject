import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadCourse } from '../services/courseDataLoader';
import { normalizeCourse } from '../utils/courseNormalization';
import type { Course } from '../types/courseTypes';
import { courseStore } from '../store/courseStore';

const baseCourse: Course = {
  id: 'course-123',
  slug: 'inclusive-leadership',
  title: 'Inclusive Leadership Mastery',
  description: 'Lead with empathy and inclusion.',
  status: 'published',
  thumbnail: '',
  duration: '30 min',
  difficulty: 'Beginner',
  modules: [
    {
      id: 'module-1',
      title: 'Foundations',
      description: 'Basics of inclusive leadership',
      duration: '10 min',
      order: 1,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Why Inclusion Matters',
          type: 'video',
          duration: '5 min',
          order: 1,
          content: { videoUrl: 'https://example.com/video.mp4' }
        }
      ],
      resources: []
    }
  ],
  chapters: [],
  progress: 0,
  rating: 0,
  enrollments: 0,
  completionRate: 0,
  avgRating: 0,
  totalRatings: 0,
  keyTakeaways: ['Create psychological safety'],
  learningObjectives: [],
  prerequisites: [],
  tags: []
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(courseStore, 'init').mockResolvedValue();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('courseDataLoader', () => {
  it('loads a course by id from the local store fallback', async () => {
    vi.spyOn(courseStore, 'getAllCourses').mockReturnValue([baseCourse]);

    const result = await loadCourse('course-123', { preferRemote: false });

    expect(result).not.toBeNull();
    expect(result?.course.id).toBe('course-123');
    expect(result?.course.slug).toBe('inclusive-leadership');
    expect(result?.lessons).toHaveLength(1);
    expect(result?.lessons[0].moduleId).toBe('module-1');
  });

  it('loads a course by slug when ids do not match', async () => {
    const slugCourse: Course = {
      ...baseCourse,
      id: 'course-xyz',
      slug: undefined,
      title: 'Courageous Conversations',
      modules: baseCourse.modules
    };

    vi.spyOn(courseStore, 'getAllCourses').mockReturnValue([slugCourse]);

    const result = await loadCourse('courageous-conversations', { preferRemote: false });

    expect(result).not.toBeNull();
    expect(result?.course.id).toBe('course-xyz');
    expect(result?.course.slug).toBe('courageous-conversations');
  });
});

describe('normalizeCourse', () => {
  it('backfills missing lesson metadata without throwing', () => {
    const malformedCourse: Course = {
      ...baseCourse,
      modules: [
        {
          id: 'module-a',
          title: 'Module A',
          description: '',
          duration: undefined,
          order: undefined as any,
          lessons: [
            {
              id: 'lesson-x',
              title: 'Malformed Lesson',
              type: 'video',
              duration: undefined,
              order: undefined as any,
              content: null as any
            }
          ]
        }
      ]
    };

    const normalized = normalizeCourse(malformedCourse);

    expect(normalized.chapters[0].lessons[0].order).toBe(1);
    expect(normalized.chapters[0].lessons[0].content).toBeTypeOf('object');
  });
});
