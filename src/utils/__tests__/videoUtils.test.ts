import { describe, expect, it } from 'vitest';
import { deriveExternalVideoCommitMetadata, resolveLessonVideoPlayback } from '../../utils/videoUtils';

describe('videoUtils', () => {
  describe('deriveExternalVideoCommitMetadata', () => {
    it('returns empty external metadata for blank values', () => {
      expect(deriveExternalVideoCommitMetadata('   ')).toEqual({
        isValid: true,
        normalizedUrl: '',
        sourceType: 'external',
      });
    });

    it('derives youtube metadata', () => {
      const result = deriveExternalVideoCommitMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      expect(result).toEqual({
        isValid: true,
        normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        sourceType: 'youtube',
        videoProvider: 'youtube',
        externalVideoId: 'dQw4w9WgXcQ',
      });
    });

    it('marks malformed urls as invalid', () => {
      const result = deriveExternalVideoCommitMetadata('notaurl');

      expect(result.isValid).toBe(false);
      expect(result.sourceType).toBe('external');
      expect(result.normalizedUrl).toBe('notaurl');
    });
  });

  describe('resolveLessonVideoPlayback', () => {
    it('resolves TED talk links to embed playback', () => {
      const result = resolveLessonVideoPlayback({
        videoUrl: 'https://www.ted.com/talks/brene_brown_the_power_of_vulnerability',
      } as any);

      expect(result.provider).toBe('ted');
      expect(result.mode).toBe('embed');
      expect(result.embedUrl).toContain('embed.ted.com/talks');
    });

    it('keeps generic external mp4 links as native playback', () => {
      const result = resolveLessonVideoPlayback({
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        videoSourceType: 'external',
      } as any);

      expect(result.provider).toBe('external');
      expect(result.mode).toBe('native');
      expect(result.embedUrl).toBeNull();
      expect(result.src).toContain('BigBuckBunny.mp4');
    });

    it('resolves internal signed assets to native playback without embed mode', () => {
      const result = resolveLessonVideoPlayback({
        videoSourceType: 'internal',
        videoAsset: {
          bucket: 'course-videos',
          storagePath: 'courses/c1/m1/l1/video.mp4',
          signedUrl: 'https://signed.example.com/courses/c1/m1/l1/video.mp4',
        },
      } as any);

      expect(result.provider).toBe('internal');
      expect(result.mode).toBe('native');
      expect(result.embedUrl).toBeNull();
      expect(result.src).toBe('https://signed.example.com/courses/c1/m1/l1/video.mp4');
    });
  });
});
