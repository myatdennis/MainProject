import apiRequest from '../utils/apiClient';

export type SignedMediaResponse = {
  assetId: string;
  signedUrl: string;
  urlExpiresAt: string;
  bucket?: string;
  storagePath?: string;
  mimeType?: string;
  bytes?: number;
  metadata?: Record<string, any> | null;
};

export const signMediaAsset = async (assetId: string): Promise<SignedMediaResponse> => {
  if (!assetId) {
    throw new Error('assetId is required to sign media');
  }
  const payload = await apiRequest<{ data: SignedMediaResponse }>(`/api/media/assets/${encodeURIComponent(assetId)}/sign`, {
    method: 'POST',
  });
  if (!payload?.data?.signedUrl) {
    throw new Error('Signed URL not returned by media service');
  }
  return payload.data;
};

export const shouldRefreshSignedUrl = (expiresAt?: string | null, bufferMs = 60_000) => {
  if (!expiresAt) return true;
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return true;
  return ts - Date.now() <= bufferMs;
};

export default {
  signMediaAsset,
  shouldRefreshSignedUrl,
};
