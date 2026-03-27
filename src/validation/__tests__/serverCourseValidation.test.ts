import { describe, expect, it } from 'vitest';
import { validateCourse as validateServerCourse } from '../../../server/lib/courseValidation.js';

const buildBaseCourse = () => ({
  id: 'course-1',
  title: 'Test Course Title',
  description: 'A sufficiently long description for validation to pass.',
  status: 'published',
  modules: [],
});

describe('server course publish validation', () => {
  it('allows external video lessons without internal storage metadata', () => {
    const course = {
      ...buildBaseCourse(),
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-1',
              title: 'External video lesson',
              type: 'video',
              content: {
                videoSourceType: 'external',
                videoProvider: 'youtube',
                videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              },
            },
          ],
        },
      ],
    };

    const result = validateServerCourse(course, { intent: 'publish' });
    expect(result.isValid).toBe(true);
    expect(result.issues.find((issue) => issue.code === 'lesson.video.metadata_missing')).toBeUndefined();
  });

  it('accepts legacy video_asset aliases during publish validation', () => {
    const course = {
      ...buildBaseCourse(),
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-1',
              title: 'Uploaded video lesson',
              type: 'video',
              content: {
                video_url: 'https://cdn.example.com/video.mp4',
                video_asset: {
                  storage_path: 'course-videos/video.mp4',
                  bucket: 'course-videos',
                  bytes: '1234',
                  mime_type: 'video/mp4',
                  uploaded_at: '2026-03-27T00:00:00.000Z',
                  source: 'api',
                },
              },
            },
          ],
        },
      ],
    };

    const result = validateServerCourse(course, { intent: 'publish' });
    expect(result.isValid).toBe(true);
    expect(result.issues.find((issue) => issue.code === 'lesson.video.metadata_missing')).toBeUndefined();
  });

  it('accepts nested video.asset urls as a playable source', () => {
    const course = {
      ...buildBaseCourse(),
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-1',
              title: 'Nested asset lesson',
              type: 'video',
              content: {
                video: {
                  asset: {
                    storage_path: 'course-videos/video.mp4',
                    bucket: 'course-videos',
                    bytes: '1234',
                    mime_type: 'video/mp4',
                    publicUrl: 'https://cdn.example.com/video.mp4',
                  },
                },
              },
            },
          ],
        },
      ],
    };

    const result = validateServerCourse(course, { intent: 'publish' });
    expect(result.isValid).toBe(true);
    expect(result.issues.find((issue) => issue.code === 'lesson.video.source_missing')).toBeUndefined();
    expect(result.issues.find((issue) => issue.code === 'lesson.video.metadata_missing')).toBeUndefined();
  });

  it('accepts resource and download lessons with document sources', () => {
    const course = {
      ...buildBaseCourse(),
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-resource',
              title: 'Resource lesson',
              type: 'resource',
              content: {
                fileUrl: 'https://cdn.example.com/resource.pdf',
              },
            },
            {
              id: 'lesson-download',
              title: 'Download lesson',
              type: 'download',
              content: {
                documentAsset: {
                  publicUrl: 'https://cdn.example.com/worksheet.pdf',
                },
              },
            },
          ],
        },
      ],
    };

    const result = validateServerCourse(course, { intent: 'publish' });
    expect(result.issues.find((issue) => issue.code === 'lesson.document.source_missing')).toBeUndefined();
  });

  it('requires reflection lessons to include learner-facing content', () => {
    const invalidCourse = {
      ...buildBaseCourse(),
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-reflection',
              title: 'Reflection lesson',
              type: 'reflection',
              content: {},
            },
          ],
        },
      ],
    };

    const validCourse = {
      ...buildBaseCourse(),
      modules: [
        {
          id: 'mod-1',
          title: 'Module 1',
          lessons: [
            {
              id: 'lesson-reflection',
              title: 'Reflection lesson',
              type: 'reflection',
              content: {
                reflectionPrompt: 'What did you learn?',
              },
            },
          ],
        },
      ],
    };

    const invalidResult = validateServerCourse(invalidCourse, { intent: 'publish' });
    expect(invalidResult.issues.find((issue) => issue.code === 'lesson.reflection.content_missing')).toBeDefined();

    const validResult = validateServerCourse(validCourse, { intent: 'publish' });
    expect(validResult.issues.find((issue) => issue.code === 'lesson.reflection.content_missing')).toBeUndefined();
  });
});
