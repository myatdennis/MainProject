import { describe, it, expect, vi } from 'vitest';
import { createMediaService } from '../../services/mediaService.js';

describe('createMediaService.signAssetById', () => {
  it('signs legacy non-uuid storage paths using inferred course videos bucket', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example.com/courses/c-1/m-1/l-1/video.mp4' },
      error: null,
    });

    const supabase = {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };

    const mediaService = createMediaService({
      getSupabase: () => supabase,
      courseVideosBucket: 'course-videos',
      documentsBucket: 'documents',
    });

    const result = await mediaService.signAssetById({
      assetId: 'courses/c-1/m-1/l-1/video.mp4',
    });

    expect(result.fallback).toBe(false);
    expect(result.signedUrl).toBe('https://signed.example.com/courses/c-1/m-1/l-1/video.mp4');
    expect(result.asset).toMatchObject({
      id: 'courses/c-1/m-1/l-1/video.mp4',
      bucket: 'course-videos',
      storage_path: 'courses/c-1/m-1/l-1/video.mp4',
      metadata: {
        legacyStoragePath: true,
      },
    });

    expect(supabase.storage.from).toHaveBeenCalledWith('course-videos');
    expect(createSignedUrl).toHaveBeenCalledWith('courses/c-1/m-1/l-1/video.mp4', expect.any(Number));
  });
});
