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

  it('reuses an existing signed_url when fresh signing fails but cached URL is still valid', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('storage temporarily unavailable'),
    });

    const futureExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const supabase = {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl,
        }),
      },
      from: vi.fn((table) => {
        if (table === 'course_media_assets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: '11111111-1111-4111-8111-111111111111',
                bucket: 'course-videos',
                storage_path: 'courses/c-2/m-2/l-2/video.mp4',
                signed_url: 'https://signed.example.com/cached-url',
                signed_url_expires_at: futureExpiry,
              },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnThis(),
        };
      }),
    };

    const mediaService = createMediaService({
      getSupabase: () => supabase,
      courseVideosBucket: 'course-videos',
      documentsBucket: 'documents',
    });

    const result = await mediaService.signAssetById({
      assetId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.fallback).not.toBe(true);
    expect(result.signedUrl).toBe('https://signed.example.com/cached-url');
    expect(result.expiresAt).toBe(futureExpiry);
  });
});
