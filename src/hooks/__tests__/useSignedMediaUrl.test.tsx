import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSignedMediaUrl } from '../useSignedMediaUrl';

const shouldBypassMediaSigningMock = vi.fn();
const signMediaAssetMock = vi.fn();
const shouldRefreshSignedUrlMock = vi.fn();

vi.mock('../../dal/media', () => ({
  shouldBypassMediaSigning: (...args: any[]) => shouldBypassMediaSigningMock(...args),
  signMediaAsset: (...args: any[]) => signMediaAssetMock(...args),
  shouldRefreshSignedUrl: (...args: any[]) => shouldRefreshSignedUrlMock(...args),
}));

describe('useSignedMediaUrl', () => {
  beforeEach(() => {
    shouldBypassMediaSigningMock.mockReset();
    signMediaAssetMock.mockReset();
    shouldRefreshSignedUrlMock.mockReset();
    sessionStorage.clear();

    shouldBypassMediaSigningMock.mockReturnValue(false);
    shouldRefreshSignedUrlMock.mockImplementation((expiresAt?: string | null) => !expiresAt || expiresAt === 'expired');
  });

  it('refreshes an expired signed URL for internal assets', async () => {
    const asset = {
      assetId: 'asset-123',
      bucket: 'course-videos',
      storagePath: 'courses/c-1/m-1/l-1/video.mp4',
      bytes: 123,
      mimeType: 'video/mp4',
      signedUrl: 'https://expired.example.com/video.mp4',
      urlExpiresAt: 'expired',
    };

    signMediaAssetMock.mockResolvedValueOnce({
      assetId: 'asset-123',
      signedUrl: 'https://signed.example.com/video.mp4',
      urlExpiresAt: '2099-01-01T00:00:00.000Z',
    });

    const { result } = renderHook(() =>
      useSignedMediaUrl({
        asset,
        autoRefresh: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.url).toBe('https://signed.example.com/video.mp4');
      expect(result.current.isLoading).toBe(false);
    });

    expect(signMediaAssetMock).toHaveBeenCalledWith('asset-123');
  });

  it('bypasses signing for direct external URLs', async () => {
    const asset = {
      assetId: 'https://cdn.example.com/video.mp4',
      bucket: 'external',
      storagePath: 'https://cdn.example.com/video.mp4',
      bytes: 0,
      mimeType: 'video/mp4',
      signedUrl: 'https://cdn.example.com/video.mp4',
    };

    shouldBypassMediaSigningMock.mockReturnValue(true);

    const { result } = renderHook(() =>
      useSignedMediaUrl({
        asset,
        autoRefresh: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.url).toBe('https://cdn.example.com/video.mp4');
      expect(result.current.isLoading).toBe(false);
    });

    expect(signMediaAssetMock).not.toHaveBeenCalled();
  });

  it('retries transient signing failures and recovers playback URL', async () => {
    const asset = {
      assetId: 'asset-retry-1',
      bucket: 'course-videos',
      storagePath: 'courses/c-1/m-1/l-1/video.mp4',
      bytes: 123,
      mimeType: 'video/mp4',
      signedUrl: null,
      urlExpiresAt: null,
    };

    signMediaAssetMock
      .mockRejectedValueOnce(new Error('Network timeout while signing media'))
      .mockResolvedValueOnce({
        assetId: 'asset-retry-1',
        signedUrl: 'https://signed.example.com/video-retry.mp4',
        urlExpiresAt: '2099-01-01T00:00:00.000Z',
      });

    const { result } = renderHook(() =>
      useSignedMediaUrl({
        asset,
        autoRefresh: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.url).toBe('https://signed.example.com/video-retry.mp4');
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    expect(signMediaAssetMock).toHaveBeenCalledTimes(2);
    expect(signMediaAssetMock).toHaveBeenNthCalledWith(1, 'asset-retry-1');
    expect(signMediaAssetMock).toHaveBeenNthCalledWith(2, 'asset-retry-1');
  });
});
