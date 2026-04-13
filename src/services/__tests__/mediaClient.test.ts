import { describe, expect, it, vi, beforeEach } from 'vitest';

const apiRequestMock = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  default: apiRequestMock,
}));

describe('mediaClient.signMediaAsset', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it('returns the unwrapped signed media payload from apiRequest', async () => {
    apiRequestMock.mockResolvedValue({
      assetId: 'asset-123',
      signedUrl: 'https://signed.example.com/video.mp4',
      urlExpiresAt: '2026-04-11T23:00:00.000Z',
      bucket: 'course-videos',
      storagePath: 'courses/course-1/video.mp4',
    });

    const { signMediaAsset } = await import('../mediaClient');
    const result = await signMediaAsset('asset-123');

    expect(apiRequestMock).toHaveBeenCalledWith('/api/media/assets/asset-123/sign', {
      method: 'POST',
      timeoutMs: 30000,
    });
    expect(result.signedUrl).toBe('https://signed.example.com/video.mp4');
    expect(result.assetId).toBe('asset-123');
  });

  it('bypasses signing for direct URLs', async () => {
    const { signMediaAsset } = await import('../mediaClient');
    const result = await signMediaAsset('https://cdn.example.com/video.mp4');

    expect(apiRequestMock).not.toHaveBeenCalled();
    expect(result.signedUrl).toBe('https://cdn.example.com/video.mp4');
    expect(result.metadata).toMatchObject({ directUrl: true, external: true });
  });
});
