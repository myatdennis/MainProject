import { describe, expect, it } from 'vitest';
import { ensureLessonIntegrity } from '../persistenceIntegrity';

describe('ensureLessonIntegrity video handling', () => {
  it('preserves explicit external video links and clears stale videoAsset metadata', () => {
    const input = {
      id: 'course-1',
      modules: [
        {
          id: 'module-1',
          lessons: [
            {
              id: 'lesson-1',
              module_id: 'module-1',
              moduleId: 'module-1',
              type: 'video',
              order: 1,
              order_index: 1,
              title: 'External lesson',
              content: {
                videoSourceType: 'external',
                videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                videoAsset: {
                  assetId: 'legacy-asset-id',
                  bucket: 'course-videos',
                  storagePath: 'courses/legacy/path/video.mp4',
                  bytes: 12345,
                  mimeType: 'video/mp4',
                },
              },
            },
          ],
        },
      ],
    } as any;

    const { course, issues } = ensureLessonIntegrity(input);
  const lesson = course.modules?.[0]?.lessons?.[0] as any;

    expect(lesson.content.videoSourceType).toBe('external');
    expect(lesson.content.videoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(lesson.content.videoAsset).toBeUndefined();
    expect(issues).toContain('video_external_preserved:lesson-1');
  });

  it('fills metadata for internal video lessons missing asset details', () => {
    const input = {
      id: 'course-2',
      modules: [
        {
          id: 'module-2',
          lessons: [
            {
              id: 'lesson-2',
              module_id: 'module-2',
              moduleId: 'module-2',
              type: 'video',
              order: 1,
              order_index: 1,
              title: 'Internal lesson',
              content: {
                videoSourceType: 'internal',
                videoUrl: 'https://cdn.example.com/video.mp4',
              },
            },
          ],
        },
      ],
    } as any;

    const { course, issues } = ensureLessonIntegrity(input);
  const lesson = course.modules?.[0]?.lessons?.[0] as any;

    expect(lesson.content.videoAsset).toBeTruthy();
    expect(lesson.content.videoAsset?.storagePath).toBe('https://cdn.example.com/video.mp4');
    expect(issues.some((entry) => entry.startsWith('video_metadata_filled:lesson-2'))).toBe(true);
  });
});
