import { describe, expect, it } from 'vitest';
import { canonicalizeLessonContent, deriveTextContent, hasVideoAssetMetadata } from '../../utils/lessonContent';
import type { Lesson } from '../../types/courseTypes';

describe('lessonContent utils', () => {
  it('normalizes text content aliases', () => {
    const content = canonicalizeLessonContent({ content: 'Hello world' });
    expect(content.textContent).toBe('Hello world');
    expect(deriveTextContent({ id: 'l1', title: '', type: 'text', content } as Lesson)).toBe('Hello world');
  });

  it('normalizes quiz questions', () => {
    const content = canonicalizeLessonContent({
      questions: [
        {
          text: 'Q1',
          options: ['Yes', 'No'],
          correctAnswerIndex: 1,
        },
      ],
    });
    expect(content.questions).toHaveLength(1);
    expect(content.questions?.[0]?.options?.[1]?.correct).toBe(true);
  });

  it('detects complete video asset metadata', () => {
    const lesson: Lesson = {
      id: 'video-1',
      title: 'Video Lesson',
      type: 'video',
      content: {
        videoUrl: 'https://cdn.example.com/video.mp4',
        videoAsset: {
          storagePath: 'videos/123.mp4',
          bucket: 'media',
          bytes: 1024,
          mimeType: 'video/mp4',
        },
      },
    };
    expect(hasVideoAssetMetadata(lesson)).toBe(true);
  });
});
