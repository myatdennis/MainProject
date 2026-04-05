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
    } as any);
    expect(content.questions).toHaveLength(1);
    expect((content.questions?.[0]?.options?.[1] as any)?.correct).toBe(true);
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

  it('promotes legacy body.videoUrl into top-level videoUrl', () => {
    const content = canonicalizeLessonContent({
      body: {
        videoUrl: 'https://cdn.example.com/legacy-body.mp4',
      },
    } as any);

    expect(content.videoUrl).toBe('https://cdn.example.com/legacy-body.mp4');
    expect(content.video?.url).toBe('https://cdn.example.com/legacy-body.mp4');
  });

  it('promotes legacy body.videoAsset and keeps signable metadata', () => {
    const content = canonicalizeLessonContent({
      body: {
        videoAsset: {
          assetId: 'asset-123',
          bucket: 'course-videos',
          storagePath: 'courses/c1/m1/l1/video.mp4',
          signed_url: 'https://signed.example.com/video.mp4',
        },
      },
    } as any);

    expect(content.videoAsset?.assetId).toBe('asset-123');
    expect(content.videoAsset?.bucket).toBe('course-videos');
    expect(content.videoAsset?.storagePath).toBe('courses/c1/m1/l1/video.mp4');
    expect(content.videoAsset?.signedUrl).toBe('https://signed.example.com/video.mp4');
    expect(content.videoUrl).toBe('https://signed.example.com/video.mp4');
  });

  it('promotes legacy body.video object when top-level video is missing', () => {
    const content = canonicalizeLessonContent({
      body: {
        video: {
          url: 'https://cdn.example.com/from-body-video-object.mp4',
          provider: 'native',
        },
      },
    } as any);

    expect(content.video?.url).toBe('https://cdn.example.com/from-body-video-object.mp4');
    expect(content.videoUrl).toBe('https://cdn.example.com/from-body-video-object.mp4');
    expect(content.videoProvider).toBe('native');
  });
});
