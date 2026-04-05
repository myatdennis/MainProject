import { describe, expect, it } from 'vitest';
import { deriveExternalVideoCommitMetadata } from '../../utils/videoUtils';

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
});
