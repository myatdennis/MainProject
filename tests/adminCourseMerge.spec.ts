import { describe, it, expect } from 'vitest';
import { mergePersistedCourse, mapPersistedLessonType, formatMinutesLabel } from '../src/utils/adminCourseMerge';
import type { Course } from '../src/types/courseTypes';
import type { NormalizedCourse } from '../src/utils/courseNormalization';

const buildLocalCourse = (): Course => ({
  id: 'course-local',
  slug: 'course-local',
  title: 'Local Draft Course',
  description: 'Local description',
  thumbnail: 'https://example.com/thumb.jpg',
  difficulty: 'Beginner',
  status: 'draft',
  duration: '0 min',
  modules: [
    {
      id: 'module-1',
      title: 'Local Module',
      description: 'Local module description',
      duration: '0 min',
      order: 1,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Local Lesson',
          type: 'video',
          order: 1,
          estimatedDuration: 10,
          duration: '10 min',
          content: { notes: 'Local notes', videoUrl: 'https://example.com/video.mp4' },
          resources: [],
        }
      ],
      resources: []
    }
  ],
  certification: {
    available: false,
    name: '',
    requirements: [],
    validFor: '1 year',
    renewalRequired: false,
  },
  lessons: 1,
  keyTakeaways: [],
  prerequisites: [],
  learningObjectives: [],
  tags: [],
  progress: 0,
});

const buildPersistedCourse = (): NormalizedCourse => ({
  id: 'course-remote',
  slug: 'course-remote',
  title: 'Remote Course Title',
  description: 'Remote description',
  thumbnail: 'https://example.com/thumb-remote.jpg',
  difficulty: 'Beginner',
  status: 'published',
  duration: '0 min',
  modules: [
    {
      id: 'module-1',
      title: 'Remote Module Title',
      description: 'Remote module description',
      duration: '0 min',
      order: 1,
      lessons: [
        ({
          id: 'lesson-1',
          title: 'Remote Lesson Title',
          type: 'resource' as any,
          order: 1,
          content: { body: { notes: 'Remote notes' } } as any,
          durationSeconds: 600,
        }) as any
      ],
      resources: []
    },
    {
      id: 'module-2',
      title: 'New Remote Module',
      description: 'Fresh content from server',
      duration: '0 min',
      order: 2,
      lessons: [
        ({
          id: 'lesson-2',
          title: 'Brand New Lesson',
          type: 'video',
          order: 1,
          durationSeconds: 300,
          content: { body: { videoUrl: 'https://example.com/new-video.mp4' } } as any,
        }) as any
      ],
      resources: []
    }
  ],
  chapters: [],
  lessons: 2,
  certification: {
    available: true,
    name: 'Server Certificate',
    requirements: ['Complete all lessons'],
    validFor: '1 year',
    renewalRequired: false,
  },
  keyTakeaways: [],
  prerequisites: [],
  learningObjectives: [],
  tags: [],
  progress: 0,
});

describe('adminCourseMerge utils', () => {
  it('maps persisted lesson types with sensible defaults', () => {
    expect(mapPersistedLessonType('resource')).toBe('interactive');
    expect(mapPersistedLessonType('reflection')).toBe('text');
    expect(mapPersistedLessonType('video')).toBe('video');
    expect(mapPersistedLessonType('resource', 'quiz')).toBe('quiz');
  });

  it('formats minutes into friendly labels', () => {
    expect(formatMinutesLabel(0)).toBe('0 min');
    expect(formatMinutesLabel(45)).toBe('45 min');
    expect(formatMinutesLabel(60)).toBe('1h');
    expect(formatMinutesLabel(135)).toBe('2h 15m');
  });

  it('merges persisted course data into local draft while preserving local edits', () => {
    const local = buildLocalCourse();
    const persisted = buildPersistedCourse();

    const merged = mergePersistedCourse(local, persisted);

    expect(merged.id).toBe('course-remote');
    expect(merged.status).toBe('published');
  expect(merged.modules).toBeDefined();
  const modules = merged.modules ?? [];
  expect(modules).toHaveLength(2);

  const mergedFirstModule = modules[0];
    expect(mergedFirstModule.id).toBe('module-1');
    expect(mergedFirstModule.title).toBe('Remote Module Title');
    expect(mergedFirstModule.lessons).toHaveLength(1);

    const mergedFirstLesson = mergedFirstModule.lessons[0];
    expect(mergedFirstLesson.title).toBe('Remote Lesson Title');
    // Keeps local video type because local draft already selected a video lesson
    expect(mergedFirstLesson.type).toBe('video');
    // Local duration metadata wins
    expect(mergedFirstLesson.duration).toBe('10 min');
    expect(mergedFirstLesson.content.videoUrl).toBe('https://example.com/video.mp4');

  const newModule = modules[1];
    expect(newModule.id).toBe('module-2');
    expect(newModule.duration).toBe('5 min');
    expect(newModule.lessons[0].estimatedDuration).toBe(5);
    expect(newModule.lessons[0].duration).toBe('5 min');

    expect(merged.duration).toBe('15 min');
    expect(merged.lessons).toBe(2);
  });
});
